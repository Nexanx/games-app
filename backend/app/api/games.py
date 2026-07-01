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
def create_game(payload: GameCreate, db: Session = Depends(get_session)) -> Game:
    game = Game(**payload.model_dump())
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
