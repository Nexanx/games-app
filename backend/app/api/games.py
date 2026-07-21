from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.session import get_session
from app.integrations.game_provider import GameProvider, GameProviderConfigurationError, GameProviderRequestError
from app.models import Game
from app.schemas.games import GameCreate, GameRead, GameSearchPage, GameSearchResult, GameUpdate
from app.services.backlog_service import (
    filter_games_not_on_backlog,
    find_game_by_external_identity,
    find_game_by_title_without_external_identity,
    get_backlog_identity_index,
    normalize_external_key,
    normalize_game_title,
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
