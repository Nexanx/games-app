from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.session import get_session
from app.integrations.game_provider import GameProvider, GameProviderConfigurationError, GameProviderRequestError
from app.models import Game
from app.schemas.games import (
    GameCreate,
    GameDiscoveryPreferencesRead,
    GameDiscoveryPreferencesUpdate,
    GameRecommendedReleasesPage,
    GameRecommendationFeedbackCreate,
    GameRecommendationFeedbackRead,
    GameRead,
    GameRecommendationsRead,
    GameReleasesPage,
    GameSearchPage,
    GameSearchResult,
    GameUpdate,
    HiddenGameReleaseCreate,
    ReleaseMatchLevel,
)
from app.services.backlog_service import (
    filter_games_not_on_backlog,
    find_game_by_external_identity,
    find_game_by_title_without_external_identity,
    get_backlog_identity_index,
    is_game_on_backlog,
    normalize_external_key,
    normalize_game_title,
)
from app.services.recommendation_service import (
    PLATFORM_FAMILIES,
    RecommendationProfile,
    build_recommendation_profile,
    delete_recommendation_feedback,
    genre_slug,
    get_discovery_preferences,
    hide_game_release,
    list_hidden_game_releases,
    platform_family,
    rank_release_recommendations,
    rank_recommendations,
    save_recommendation_feedback,
    save_discovery_preferences,
    unhide_game_release,
)

router = APIRouter()


@router.get("/search", response_model=GameSearchPage)
async def search_games(
    query: str = Query(..., min_length=1, max_length=100),
    page: int = Query(1, ge=1, le=50),
    page_size: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_session),
) -> GameSearchPage:
    provider = GameProvider(get_settings())
    try:
        return await _search_available_games(provider, query, page, page_size, db)
    except GameProviderConfigurationError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "GAME_PROVIDER_NOT_CONFIGURED", "message": "RAWG_API_KEY is not configured."},
        ) from exc
    except GameProviderRequestError as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "GAME_PROVIDER_REQUEST_FAILED", "message": "RAWG API request failed."},
        ) from exc


@router.get("", response_model=list[GameRead])
def list_games(db: Session = Depends(get_session)) -> list[Game]:
    return db.scalars(select(Game).order_by(Game.title)).all()


@router.get("/recommendations", response_model=GameRecommendationsRead)
async def get_game_recommendations(db: Session = Depends(get_session)) -> GameRecommendationsRead:
    profile = build_recommendation_profile(db)
    provider = GameProvider(get_settings())
    try:
        candidates = await provider.discover(
            page_size=40,
            genres=profile.genre_slugs if profile.personalized else None,
            parent_platforms=profile.parent_platform_ids or None,
            ordering="-rating" if profile.personalized else "-added",
        )
    except (GameProviderConfigurationError, GameProviderRequestError) as exc:
        raise _provider_http_error(exc) from exc

    personalized = profile.personalized
    return GameRecommendationsRead(
        results=rank_recommendations(profile, candidates.results),
        personalized=personalized,
        notice=(
            None
            if personalized
            else "Dodaj i oceń więcej ukończonych gier, aby otrzymać lepiej dopasowane rekomendacje."
        ),
    )


@router.put("/recommendations/feedback", response_model=GameRecommendationFeedbackRead)
def put_game_recommendation_feedback(
    payload: GameRecommendationFeedbackCreate,
    db: Session = Depends(get_session),
) -> GameRecommendationFeedbackRead:
    try:
        return save_recommendation_feedback(db, payload.game, payload.verdict)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/recommendations/feedback", status_code=204)
def remove_game_recommendation_feedback(
    external_source: str = Query(..., min_length=1, max_length=50),
    external_id: str = Query(..., min_length=1, max_length=255),
    db: Session = Depends(get_session),
) -> None:
    try:
        removed = delete_recommendation_feedback(db, external_source, external_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not removed:
        raise HTTPException(status_code=404, detail="Recommendation feedback not found")


@router.get("/releases", response_model=GameReleasesPage)
async def get_game_releases(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    platform: str | None = Query(default=None, max_length=40),
    genre: str | None = Query(default=None, max_length=80),
    search: str | None = Query(default=None, max_length=100),
    minimum_rating: float | None = Query(default=None, ge=0, le=100),
    release_status: Literal["all", "upcoming", "released", "tba"] = Query(default="all"),
    sort: Literal["release_date", "rating", "title"] = Query(default="release_date"),
    page: int = Query(default=1, ge=1, le=50),
    page_size: int = Query(default=20, ge=1, le=40),
    db: Session = Depends(get_session),
) -> GameReleasesPage:
    start, end = _release_date_range(date_from, date_to)
    parent_platform_ids = _release_platform_ids(platform)
    genres = _release_genre_slugs(genre)
    ordering = {
        "release_date": "released",
        "rating": "-rating",
        "title": "name",
    }[sort]

    provider = GameProvider(get_settings())
    try:
        releases = await provider.discover(
            page=page,
            page_size=page_size,
            date_from=start,
            date_to=end,
            genres=genres,
            parent_platforms=parent_platform_ids,
            query=search,
            ordering=ordering,
        )
    except (GameProviderConfigurationError, GameProviderRequestError) as exc:
        raise _provider_http_error(exc) from exc

    profile = build_recommendation_profile(db)
    results = _prepare_release_results(
        releases.results,
        profile=profile,
        date_from=start,
        date_to=end,
        platform=platform,
        genre=genre,
        minimum_rating=minimum_rating,
        release_status=release_status,
    )
    return GameReleasesPage(
        results=results,
        page=page,
        page_size=page_size,
        has_next=releases.has_next,
    )


@router.get("/releases/recommended", response_model=GameRecommendedReleasesPage)
async def get_recommended_game_releases(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    platform: str | None = Query(default=None, max_length=40),
    genre: str | None = Query(default=None, max_length=80),
    search: str | None = Query(default=None, max_length=100),
    minimum_rating: float | None = Query(default=None, ge=0, le=100),
    release_status: Literal["all", "upcoming", "released", "tba"] = Query(default="all"),
    match_level: ReleaseMatchLevel = Query(default="balanced"),
    page: int = Query(default=1, ge=1, le=50),
    page_size: int = Query(default=20, ge=1, le=40),
    db: Session = Depends(get_session),
) -> GameRecommendedReleasesPage:
    start, end = _release_date_range(date_from, date_to)
    profile = build_recommendation_profile(db)
    parent_platform_ids = _release_platform_ids(platform)
    if parent_platform_ids is None and profile.parent_platform_ids:
        parent_platform_ids = profile.parent_platform_ids
    genres = _release_genre_slugs(genre)

    provider = GameProvider(get_settings())
    try:
        releases = await provider.discover(
            page=page,
            page_size=40,
            date_from=start,
            date_to=end,
            genres=genres,
            parent_platforms=parent_platform_ids,
            query=search,
            ordering="-rating",
        )
    except (GameProviderConfigurationError, GameProviderRequestError) as exc:
        raise _provider_http_error(exc) from exc

    candidates = _prepare_release_results(
        releases.results,
        profile=profile,
        date_from=start,
        date_to=end,
        platform=platform,
        genre=genre,
        minimum_rating=minimum_rating,
        release_status=release_status,
    )
    ranked = rank_release_recommendations(
        profile,
        candidates,
        match_level=match_level,
        limit=page_size + 1,
    )
    has_more_ranked = len(ranked) > page_size
    return GameRecommendedReleasesPage(
        results=ranked[:page_size],
        page=page,
        page_size=page_size,
        has_next=releases.has_next or has_more_ranked,
        personalized=profile.personalized,
        notice=(
            None
            if profile.personalized
            else "Dodaj i oceń więcej ukończonych gier, aby premiery były lepiej dopasowane."
        ),
        match_level=match_level,
    )


@router.get("/releases/preferences", response_model=GameDiscoveryPreferencesRead)
def get_game_release_preferences(
    db: Session = Depends(get_session),
) -> GameDiscoveryPreferencesRead:
    return get_discovery_preferences(db)


@router.put("/releases/preferences", response_model=GameDiscoveryPreferencesRead)
def put_game_release_preferences(
    payload: GameDiscoveryPreferencesUpdate,
    db: Session = Depends(get_session),
) -> GameDiscoveryPreferencesRead:
    unsupported_platforms = [
        value for value in payload.platforms if platform_family(value) not in PLATFORM_FAMILIES
    ]
    unsupported_genres = [value for value in payload.genres if genre_slug(value) is None]
    if unsupported_platforms or unsupported_genres:
        raise HTTPException(
            status_code=422,
            detail={
                "unsupported_platforms": unsupported_platforms,
                "unsupported_genres": unsupported_genres,
            },
        )
    return save_discovery_preferences(db, payload)


@router.get("/releases/hidden", response_model=GameReleasesPage)
def get_hidden_game_releases(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    platform: str | None = Query(default=None, max_length=40),
    genre: str | None = Query(default=None, max_length=80),
    search: str | None = Query(default=None, max_length=100),
    minimum_rating: float | None = Query(default=None, ge=0, le=100),
    release_status: Literal["all", "upcoming", "released", "tba"] = Query(default="all"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=40),
    db: Session = Depends(get_session),
) -> GameReleasesPage:
    start, end = _release_date_range(date_from, date_to)
    _release_platform_ids(platform)
    _release_genre_slugs(genre)
    profile = build_recommendation_profile(db)
    results = _prepare_release_results(
        list_hidden_game_releases(db),
        profile=profile,
        date_from=start,
        date_to=end,
        platform=platform,
        genre=genre,
        minimum_rating=minimum_rating,
        release_status=release_status,
        search=search,
    )
    offset = (page - 1) * page_size
    return GameReleasesPage(
        results=results[offset : offset + page_size],
        page=page,
        page_size=page_size,
        has_next=offset + page_size < len(results),
    )


@router.put("/releases/hidden", status_code=204)
def put_hidden_game_release(
    payload: HiddenGameReleaseCreate,
    db: Session = Depends(get_session),
) -> None:
    try:
        hide_game_release(db, payload.game)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/releases/hidden", status_code=204)
def delete_hidden_game_release(
    external_source: str = Query(..., min_length=1, max_length=50),
    external_id: str = Query(..., min_length=1, max_length=255),
    db: Session = Depends(get_session),
) -> None:
    try:
        removed = unhide_game_release(db, external_source, external_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not removed:
        raise HTTPException(status_code=404, detail="Hidden release not found")


@router.get("/rawg/{external_id}", response_model=GameSearchResult)
async def get_rawg_game(external_id: str) -> GameSearchResult:
    provider = GameProvider(get_settings())
    try:
        return await provider.get_game(external_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (GameProviderConfigurationError, GameProviderRequestError) as exc:
        raise _provider_http_error(exc) from exc


@router.post("", response_model=GameRead, status_code=201)
async def create_game(
    payload: GameCreate,
    response: Response,
    db: Session = Depends(get_session),
) -> Game:
    data = payload.model_dump()
    existing = _find_existing_game(db, data)
    if existing:
        _update_external_ratings(existing, data, db)
        response.status_code = 200
        return existing
    if not data.get("cover_url"):
        result = await _find_cover_result(payload.title)
        data = _merge_provider_data(data, result)

    existing = _find_existing_game(db, data)
    if existing:
        _update_external_ratings(existing, data, db)
        response.status_code = 200
        return existing

    game = Game(**data)
    db.add(game)
    db.commit()
    db.refresh(game)
    return game


@router.get("/{game_id}", response_model=GameRead)
def get_game(game_id: int, db: Session = Depends(get_session)) -> Game:
    game = db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.patch("/{game_id}", response_model=GameRead)
def update_game(game_id: int, payload: GameUpdate, db: Session = Depends(get_session)) -> Game:
    game = db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(game, key, value)
    db.commit()
    db.refresh(game)
    return game


@router.delete("/{game_id}", status_code=204)
def delete_game(game_id: int, db: Session = Depends(get_session)) -> None:
    game = db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    db.delete(game)
    db.commit()


async def _find_cover_result(title: str) -> GameSearchResult:
    provider = GameProvider(get_settings())
    try:
        page = await provider.search(title)
    except GameProviderConfigurationError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "GAME_COVER_PROVIDER_NOT_CONFIGURED",
                "message": "RAWG_API_KEY is required when adding a game without cover_url.",
            },
        ) from exc
    except GameProviderRequestError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "GAME_COVER_PROVIDER_REQUEST_FAILED",
                "message": "RAWG API request failed while fetching cover.",
            },
        ) from exc

    result = _select_cover_result(page.results, title)
    if not result:
        raise HTTPException(
            status_code=404,
            detail={"code": "GAME_COVER_NOT_FOUND", "message": "RAWG did not return a cover for this title."},
        )
    return result


def _select_cover_result(results: list[GameSearchResult], title: str) -> GameSearchResult | None:
    with_cover = [result for result in results if result.cover_url]
    if not with_cover:
        return None
    normalized_title = title.strip().casefold()
    exact_match = next(
        (result for result in with_cover if result.title.strip().casefold() == normalized_title),
        None,
    )
    return exact_match or with_cover[0]


def _merge_provider_data(data: dict, result: GameSearchResult) -> dict:
    merged = data.copy()
    merged["cover_url"] = result.cover_url
    if not merged.get("description") and result.description:
        merged["description"] = result.description
    if not merged.get("release_date") and result.release_date:
        merged["release_date"] = result.release_date
    if not merged.get("genres") and result.genres:
        merged["genres"] = result.genres
    if not merged.get("platforms") and result.platforms:
        merged["platforms"] = result.platforms
    if not merged.get("external_id") and result.external_id:
        merged["external_id"] = result.external_id
    if (not merged.get("external_source") or merged.get("external_source") == "manual") and result.external_source:
        merged["external_source"] = result.external_source
    if not merged.get("external_url") and result.external_url:
        merged["external_url"] = result.external_url
    if not merged.get("external_ratings") and result.external_ratings:
        merged["external_ratings"] = [rating.model_dump(mode="json") for rating in result.external_ratings]
        merged["external_ratings_updated_at"] = result.external_ratings_updated_at
    return merged


def _update_external_ratings(existing: Game, data: dict, db: Session) -> None:
    ratings = data.get("external_ratings")
    if not ratings:
        return
    existing.external_ratings = ratings
    existing.external_ratings_updated_at = data.get("external_ratings_updated_at")
    db.commit()
    db.refresh(existing)


async def _search_available_games(
    provider: GameProvider,
    query: str,
    page: int,
    page_size: int,
    db: Session,
) -> GameSearchPage:
    """Build a logical results page after excluding active backlog games.

    RAWG paginates before the application can know which results are already
    queued.  We consume only as many provider pages as needed to assemble the
    requested client page plus one extra result, which makes ``has_next``
    accurate without exposing empty pages caused by filtering.
    """

    identities = get_backlog_identity_index(db)
    start = (page - 1) * page_size
    end = start + page_size
    available: list[GameSearchResult] = []
    seen_keys: set[tuple[str, str] | tuple[str, str, str]] = set()
    raw_page = 1

    while True:
        provider_page = await provider.search(query, page=raw_page, page_size=page_size)
        for result in filter_games_not_on_backlog(provider_page.results, identities):
            result_key = _search_result_key(result)
            if result_key in seen_keys:
                continue
            seen_keys.add(result_key)
            available.append(result)

        if len(available) > end or not provider_page.has_next:
            break
        raw_page += 1

    return GameSearchPage(
        results=available[start:end],
        page=page,
        page_size=page_size,
        has_next=len(available) > end,
    )


def _release_date_range(
    date_from: date | None,
    date_to: date | None,
) -> tuple[date, date]:
    today = date.today()
    start = date_from or today.replace(day=1)
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    end = date_to or (next_month - timedelta(days=1))
    if start > end:
        raise HTTPException(status_code=422, detail="date_from cannot be greater than date_to")
    if (end - start).days > 366:
        raise HTTPException(status_code=422, detail="Release date range cannot exceed 366 days")
    return start, end


def _release_platform_ids(platform: str | None) -> list[int] | None:
    if not platform:
        return None
    family = platform_family(platform)
    if not family or family not in PLATFORM_FAMILIES:
        raise HTTPException(status_code=422, detail="Unsupported platform filter")
    return [PLATFORM_FAMILIES[family][1]]


def _release_genre_slugs(genre: str | None) -> list[str] | None:
    if not genre:
        return None
    slug = genre_slug(genre)
    if not slug:
        raise HTTPException(status_code=422, detail="Unsupported genre filter")
    return [slug]


def _prepare_release_results(
    games: list[GameSearchResult],
    *,
    profile: RecommendationProfile,
    date_from: date,
    date_to: date,
    platform: str | None,
    genre: str | None,
    minimum_rating: float | None,
    release_status: Literal["all", "upcoming", "released", "tba"],
    search: str | None = None,
) -> list[GameSearchResult]:
    platform_key = platform_family(platform) if platform else None
    genre_key = normalize_game_title(genre or "")
    search_key = (search or "").strip().casefold()
    today = date.today()
    results: list[GameSearchResult] = []
    seen_external: set[tuple[str, str]] = set()
    seen_titles: set[str] = set()

    for game in games:
        external_key = normalize_external_key(game.external_source, game.external_id)
        title_key = normalize_game_title(game.title)
        if (
            (external_key and external_key in seen_external)
            or (not external_key and title_key in seen_titles)
        ):
            continue
        if game.release_date and not (date_from <= game.release_date <= date_to):
            continue
        if search_key and search_key not in game.title.casefold():
            continue
        if platform_key and platform_key not in {
            family for value in game.platforms if (family := platform_family(value))
        }:
            continue
        if genre_key and genre_key not in {
            normalize_game_title(value) for value in game.genres
        }:
            continue
        if minimum_rating is not None and _normalized_external_rating(game) < minimum_rating:
            continue
        if release_status == "tba" and not (game.release_date_tba or game.release_date is None):
            continue
        if release_status == "upcoming" and (
            game.release_date is None or game.release_date <= today
        ):
            continue
        if release_status == "released" and (
            game.release_date is None or game.release_date > today
        ):
            continue

        already_completed = bool(
            (external_key and external_key in profile.completed_external_keys)
            or (
                not external_key
                and title_key in profile.completed_titles_without_external_keys
            )
        )
        already_on_backlog = is_game_on_backlog(
            game.title,
            game.external_source,
            game.external_id,
            profile.backlog_identities,
        )
        hidden = bool(external_key and external_key in profile.hidden_external_keys)
        results.append(
            game.model_copy(
                update={
                    "already_completed": already_completed,
                    "already_on_backlog": already_on_backlog,
                    "hidden": hidden,
                }
            )
        )
        if external_key:
            seen_external.add(external_key)
        else:
            seen_titles.add(title_key)
    return results


def _normalized_external_rating(game: GameSearchResult) -> float:
    values = [
        rating.value / rating.scale * 100
        for rating in game.external_ratings
        if rating.scale > 0
    ]
    return max(values, default=0)


def _search_result_key(result: GameSearchResult) -> tuple[str, str] | tuple[str, str, str]:
    external_key = normalize_external_key(result.external_source, result.external_id)
    if external_key:
        return external_key
    return ("title", normalize_game_title(result.title), result.external_source.strip().casefold())


def _find_existing_game(db: Session, data: dict) -> Game | None:
    existing = find_game_by_external_identity(db, data.get("external_source"), data.get("external_id"))
    if existing:
        return existing
    if normalize_external_key(data.get("external_source"), data.get("external_id")):
        return find_game_by_title_without_external_identity(db, data["title"])
    # A manually entered game has no stable provider ID, so reuse only a
    # locally manual title match. This keeps direct manual additions from
    # producing a second active backlog entry for the same game.
    return find_game_by_title_without_external_identity(db, data["title"])


def _provider_http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, GameProviderConfigurationError):
        return HTTPException(
            status_code=503,
            detail={"code": "GAME_PROVIDER_NOT_CONFIGURED", "message": "RAWG_API_KEY is not configured."},
        )
    return HTTPException(
        status_code=502,
        detail={"code": "GAME_PROVIDER_REQUEST_FAILED", "message": "RAWG API request failed."},
    )
