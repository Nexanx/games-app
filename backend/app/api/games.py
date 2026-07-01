from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.session import get_session
from app.integrations.game_provider import GameProvider, GameProviderConfigurationError, GameProviderRequestError
from app.models import Game
from app.schemas.games import GameCreate, GameRead, GameSearchResult, GameUpdate

router = APIRouter()


@router.get("/search", response_model=list[GameSearchResult])
async def search_games(query: str = Query(..., min_length=1, max_length=100)) -> list[GameSearchResult]:
    provider = GameProvider(get_settings())
    try:
        return await provider.search(query)
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
async def create_game(payload: GameCreate, db: Session = Depends(get_session)) -> Game:
    data = payload.model_dump()
    if not data.get("cover_url"):
        result = await _find_cover_result(payload.title)
        data = _merge_provider_data(data, result)

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
        results = await provider.search(title)
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

    result = _select_cover_result(results, title)
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
    return merged
