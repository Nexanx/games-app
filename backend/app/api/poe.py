from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.database.session import get_session
from app.integrations.poe_ninja import PoeNinjaService
from app.models import PoeCharacter, PoeCurrencyStat, PoeLeague
from app.schemas.poe import (
    PoeCharacterCreate,
    PoeCharacterRead,
    PoeCharacterUpdate,
    PoeCurrencyStatCreate,
    PoeCurrencyStatRead,
    PoeCurrencyStatUpdate,
    PoeLeagueCreate,
    PoeLeagueRead,
    PoeLeagueUpdate,
    PoeNinjaImportRequest,
    PoeNinjaImportResult,
    PoeStatsReorder,
)
from app.services.poe_service import reorder_currency_stats

router = APIRouter()


@router.get("/leagues", response_model=list[PoeLeagueRead])
def list_leagues(game_version: str | None = None, db: Session = Depends(get_session)) -> list[PoeLeague]:
    stmt = select(PoeLeague)
    if game_version:
        stmt = stmt.where(PoeLeague.game_version == game_version)
    return db.scalars(stmt.order_by(desc(PoeLeague.start_date), PoeLeague.name)).all()


@router.post("/leagues", response_model=PoeLeagueRead, status_code=201)
def create_league(payload: PoeLeagueCreate, db: Session = Depends(get_session)) -> PoeLeague:
    league = PoeLeague(**payload.model_dump())
    db.add(league)
    db.commit()
    db.refresh(league)
    return league


@router.patch("/leagues/{league_id}", response_model=PoeLeagueRead)
def update_league(league_id: int, payload: PoeLeagueUpdate, db: Session = Depends(get_session)) -> PoeLeague:
    league = db.get(PoeLeague, league_id)
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(league, key, value)
    db.commit()
    db.refresh(league)
    return league


@router.delete("/leagues/{league_id}", status_code=204)
def delete_league(league_id: int, db: Session = Depends(get_session)) -> None:
    league = db.get(PoeLeague, league_id)
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    db.delete(league)
    db.commit()


@router.get("/characters", response_model=list[PoeCharacterRead])
def list_characters(
    game_version: str | None = None,
    league_id: int | None = None,
    status: str | None = None,
    search: str | None = None,
    sort: str = Query("added", pattern="^(level|playtime|added)$"),
    db: Session = Depends(get_session),
) -> list[PoeCharacter]:
    stmt = select(PoeCharacter).options(selectinload(PoeCharacter.league))
    if game_version:
        stmt = stmt.where(PoeCharacter.game_version == game_version)
    if league_id:
        stmt = stmt.where(PoeCharacter.league_id == league_id)
    if status:
        stmt = stmt.where(PoeCharacter.status == status)
    if search:
        stmt = stmt.where(PoeCharacter.name.ilike(f"%{search}%"))
    if sort == "level":
        stmt = stmt.order_by(desc(PoeCharacter.level), desc(PoeCharacter.updated_at))
    elif sort == "playtime":
        stmt = stmt.order_by(desc(PoeCharacter.playtime_minutes), desc(PoeCharacter.updated_at))
    else:
        stmt = stmt.order_by(desc(PoeCharacter.created_at))
    return db.scalars(stmt).all()


@router.post("/characters", response_model=PoeCharacterRead, status_code=201)
def create_character(payload: PoeCharacterCreate, db: Session = Depends(get_session)) -> PoeCharacter:
    character = PoeCharacter(**payload.model_dump())
    db.add(character)
    db.commit()
    return db.scalars(
        select(PoeCharacter).options(selectinload(PoeCharacter.league)).where(PoeCharacter.id == character.id)
    ).one()


@router.get("/characters/{character_id}", response_model=PoeCharacterRead)
def get_character(character_id: int, db: Session = Depends(get_session)) -> PoeCharacter:
    character = db.scalars(
        select(PoeCharacter).options(selectinload(PoeCharacter.league)).where(PoeCharacter.id == character_id)
    ).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


@router.patch("/characters/{character_id}", response_model=PoeCharacterRead)
def update_character(character_id: int, payload: PoeCharacterUpdate, db: Session = Depends(get_session)) -> PoeCharacter:
    character = db.get(PoeCharacter, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(character, key, value)
    db.commit()
    return db.scalars(
        select(PoeCharacter).options(selectinload(PoeCharacter.league)).where(PoeCharacter.id == character_id)
    ).one()


@router.delete("/characters/{character_id}", status_code=204)
def delete_character(character_id: int, db: Session = Depends(get_session)) -> None:
    character = db.get(PoeCharacter, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    db.delete(character)
    db.commit()


@router.post("/import-from-ninja", response_model=PoeNinjaImportResult)
def import_from_ninja(payload: PoeNinjaImportRequest) -> PoeNinjaImportResult:
    return PoeNinjaService().import_from_url(payload.url)


@router.get("/characters/{character_id}/stats", response_model=list[PoeCurrencyStatRead])
def list_currency_stats(character_id: int, db: Session = Depends(get_session)) -> list[PoeCurrencyStat]:
    return db.scalars(
        select(PoeCurrencyStat)
        .where(PoeCurrencyStat.character_id == character_id)
        .order_by(PoeCurrencyStat.display_order, PoeCurrencyStat.name)
    ).all()


@router.post("/characters/{character_id}/stats", response_model=PoeCurrencyStatRead, status_code=201)
def create_currency_stat(
    character_id: int, payload: PoeCurrencyStatCreate, db: Session = Depends(get_session)
) -> PoeCurrencyStat:
    character = db.get(PoeCharacter, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    data = payload.model_dump()
    if data.get("league_id") is None:
        data["league_id"] = character.league_id
    stat = PoeCurrencyStat(character_id=character_id, **data)
    db.add(stat)
    db.commit()
    db.refresh(stat)
    return stat


@router.patch("/stats/{stat_id}", response_model=PoeCurrencyStatRead)
def update_currency_stat(stat_id: int, payload: PoeCurrencyStatUpdate, db: Session = Depends(get_session)) -> PoeCurrencyStat:
    stat = db.get(PoeCurrencyStat, stat_id)
    if not stat:
        raise HTTPException(status_code=404, detail="Currency stat not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(stat, key, value)
    db.commit()
    db.refresh(stat)
    return stat


@router.delete("/stats/{stat_id}", status_code=204)
def delete_currency_stat(stat_id: int, db: Session = Depends(get_session)) -> None:
    stat = db.get(PoeCurrencyStat, stat_id)
    if not stat:
        raise HTTPException(status_code=404, detail="Currency stat not found")
    db.delete(stat)
    db.commit()


@router.post("/characters/{character_id}/stats/reorder", response_model=list[PoeCurrencyStatRead])
def reorder_stats(character_id: int, payload: PoeStatsReorder, db: Session = Depends(get_session)) -> list[PoeCurrencyStat]:
    try:
        return reorder_currency_stats(db, character_id, payload.ordered_ids)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

