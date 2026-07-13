from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.database.session import get_session
from app.integrations.poe_leagues import (
    PoeLeagueProvider,
    PoeLeagueProviderConfigurationError,
    PoeLeagueProviderRequestError,
)
from app.integrations.poe_build import PoeBuildParseError, PoeBuildService
from app.models import PoeCharacter, PoeCurrencyStat, PoeEquipmentItem, PoeLeague
from app.schemas.poe import (
    PoeBuildCodeRequest,
    PoeBuildPreview,
    PoeCharacterCreate,
    PoeCharacterPobImport,
    PoeCharacterRead,
    PoeCharacterUpdate,
    PoeCurrencyStatCreate,
    PoeCurrencyStatRead,
    PoeCurrencyStatUpdate,
    PoeEquipmentItemRead,
    PoeLeagueCreate,
    PoeLeagueRead,
    PoeLeagueSyncRequest,
    PoeLeagueSyncResult,
    PoeLeagueUpdate,
    PoeStatsReorder,
)
from app.services.poe_league_service import upsert_poe_leagues
from app.services.poe_service import reorder_currency_stats

router = APIRouter()


@router.get("/leagues", response_model=list[PoeLeagueRead])
def list_leagues(
    game_version: str | None = Query(default=None, pattern="^poe[12]$"),
    db: Session = Depends(get_session),
) -> list[PoeLeague]:
    stmt = select(PoeLeague)
    if game_version:
        stmt = stmt.where(PoeLeague.game_version == game_version)
    return db.scalars(stmt.order_by(desc(PoeLeague.start_date), PoeLeague.name)).all()


@router.post("/leagues", response_model=PoeLeagueRead, status_code=201)
def create_league(payload: PoeLeagueCreate, db: Session = Depends(get_session)) -> PoeLeague:
    _validate_league_period(payload.start_date, payload.end_date)
    existing = db.scalar(
        select(PoeLeague).where(
            PoeLeague.name == payload.name,
            PoeLeague.game_version == payload.game_version,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Liga o tej nazwie już istnieje dla wybranej gry.")
    league = PoeLeague(**payload.model_dump())
    db.add(league)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Nie udało się zapisać kompletnego snapshotu postaci.") from exc
    db.refresh(league)
    return league


@router.post("/leagues/sync", response_model=PoeLeagueSyncResult)
async def sync_leagues(payload: PoeLeagueSyncRequest, db: Session = Depends(get_session)) -> PoeLeagueSyncResult:
    provider = PoeLeagueProvider(get_settings())
    try:
        candidates = await provider.fetch(payload.game_version)
    except PoeLeagueProviderConfigurationError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "POE_LEAGUE_PROVIDER_NOT_CONFIGURED",
                "message": "POE_API_TOKEN jest wymagany do synchronizacji lig z oficjalnego API Path of Exile.",
            },
        ) from exc
    except PoeLeagueProviderRequestError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "POE_LEAGUE_PROVIDER_REQUEST_FAILED",
                "message": "Nie udało się pobrać lig z oficjalnego API Path of Exile.",
            },
        ) from exc

    created, updated, leagues = upsert_poe_leagues(db, candidates)
    return PoeLeagueSyncResult(created=created, updated=updated, leagues=leagues)


@router.patch("/leagues/{league_id}", response_model=PoeLeagueRead)
def update_league(league_id: int, payload: PoeLeagueUpdate, db: Session = Depends(get_session)) -> PoeLeague:
    league = db.get(PoeLeague, league_id)
    if not league:
        raise HTTPException(status_code=404, detail="Nie znaleziono ligi.")
    changes = payload.model_dump(exclude_unset=True)
    next_name = changes.get("name", league.name)
    next_version = changes.get("game_version", league.game_version)
    _validate_league_period(
        changes.get("start_date", league.start_date),
        changes.get("end_date", league.end_date),
    )
    duplicate = db.scalar(
        select(PoeLeague).where(
            PoeLeague.id != league.id,
            PoeLeague.name == next_name,
            PoeLeague.game_version == next_version,
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Liga o tej nazwie już istnieje dla wybranej gry.")
    if next_version != league.game_version and db.scalar(
        select(PoeCharacter.id).where(PoeCharacter.league_id == league.id).limit(1)
    ):
        raise HTTPException(
            status_code=409,
            detail="Nie można zmienić wersji ligi, do której są przypisane postacie.",
        )
    for key, value in changes.items():
        setattr(league, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Liga o tej nazwie już istnieje dla wybranej gry.") from exc
    db.refresh(league)
    return league


@router.delete("/leagues/{league_id}", status_code=204)
def delete_league(league_id: int, db: Session = Depends(get_session)) -> None:
    league = db.get(PoeLeague, league_id)
    if not league:
        raise HTTPException(status_code=404, detail="Nie znaleziono ligi.")
    db.delete(league)
    db.commit()


@router.get("/characters", response_model=list[PoeCharacterRead])
def list_characters(
    game_version: str | None = Query(default=None, pattern="^poe[12]$"),
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
    _validate_character_league(db, payload.league_id, payload.game_version)
    character = PoeCharacter(**payload.model_dump())
    db.add(character)
    db.commit()
    return db.scalars(
        select(PoeCharacter).options(selectinload(PoeCharacter.league)).where(PoeCharacter.id == character.id)
    ).one()


@router.post("/pob/preview", response_model=PoeBuildPreview)
def preview_pob(payload: PoeBuildCodeRequest) -> PoeBuildPreview:
    try:
        snapshot = PoeBuildService().preview(payload.code)
    except PoeBuildParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return PoeBuildPreview(
        game_version=snapshot.game_version,
        character_class=snapshot.character_class,
        ascendancy=snapshot.ascendancy,
        level=snapshot.level,
        equipment_count=len(snapshot.equipment),
    )


@router.post("/characters/import-pob", response_model=PoeCharacterRead, status_code=201)
def import_pob_character(payload: PoeCharacterPobImport, db: Session = Depends(get_session)) -> PoeCharacter:
    try:
        preview = PoeBuildService().preview(payload.code)
    except PoeBuildParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    _validate_character_league(db, payload.league_id, preview.game_version)

    character = PoeCharacter(
        name=payload.name,
        game_version=preview.game_version,
        character_class=preview.character_class,
        ascendancy=preview.ascendancy,
        level=preview.level,
        league_id=payload.league_id,
        poe_ninja_url=payload.poe_ninja_url,
        status=payload.status,
        playtime_minutes=payload.playtime_minutes,
        snapshot_source="poe_ninja_pob" if payload.poe_ninja_url else "pob",
        notes=payload.notes,
    )
    db.add(character)
    db.flush()
    db.add_all(
        PoeEquipmentItem(character_id=character.id, **item.model_dump())
        for item in preview.equipment
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Liga o tej nazwie już istnieje dla wybranej gry.") from exc
    return db.scalars(
        select(PoeCharacter).options(selectinload(PoeCharacter.league)).where(PoeCharacter.id == character.id)
    ).one()


@router.get("/characters/{character_id}", response_model=PoeCharacterRead)
def get_character(character_id: int, db: Session = Depends(get_session)) -> PoeCharacter:
    character = db.scalars(
        select(PoeCharacter).options(selectinload(PoeCharacter.league)).where(PoeCharacter.id == character_id)
    ).first()
    if not character:
        raise HTTPException(status_code=404, detail="Nie znaleziono postaci.")
    return character


@router.patch("/characters/{character_id}", response_model=PoeCharacterRead)
def update_character(character_id: int, payload: PoeCharacterUpdate, db: Session = Depends(get_session)) -> PoeCharacter:
    character = db.get(PoeCharacter, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Nie znaleziono postaci.")
    changes = payload.model_dump(exclude_unset=True)
    _validate_character_league(
        db,
        changes.get("league_id", character.league_id),
        changes.get("game_version", character.game_version),
    )
    for key, value in changes.items():
        setattr(character, key, value)
    db.commit()
    return db.scalars(
        select(PoeCharacter).options(selectinload(PoeCharacter.league)).where(PoeCharacter.id == character_id)
    ).one()


@router.delete("/characters/{character_id}", status_code=204)
def delete_character(character_id: int, db: Session = Depends(get_session)) -> None:
    character = db.get(PoeCharacter, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Nie znaleziono postaci.")
    db.delete(character)
    db.commit()


@router.get("/characters/{character_id}/equipment", response_model=list[PoeEquipmentItemRead])
def list_equipment(character_id: int, db: Session = Depends(get_session)) -> list[PoeEquipmentItem]:
    if not db.get(PoeCharacter, character_id):
        raise HTTPException(status_code=404, detail="Nie znaleziono postaci.")
    return db.scalars(
        select(PoeEquipmentItem)
        .where(PoeEquipmentItem.character_id == character_id)
        .order_by(PoeEquipmentItem.display_order, PoeEquipmentItem.id)
    ).all()


@router.get("/characters/{character_id}/stats", response_model=list[PoeCurrencyStatRead])
def list_currency_stats(character_id: int, db: Session = Depends(get_session)) -> list[PoeCurrencyStat]:
    if not db.get(PoeCharacter, character_id):
        raise HTTPException(status_code=404, detail="Nie znaleziono postaci.")
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
        raise HTTPException(status_code=404, detail="Nie znaleziono postaci.")
    data = payload.model_dump()
    if data.get("league_id") is None:
        data["league_id"] = character.league_id
    elif not db.get(PoeLeague, data["league_id"]):
        raise HTTPException(status_code=404, detail="Nie znaleziono ligi.")
    stat = PoeCurrencyStat(character_id=character_id, **data)
    db.add(stat)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Statystyka o tej nazwie już istnieje dla tej postaci.",
        ) from exc
    db.refresh(stat)
    return stat


@router.patch("/stats/{stat_id}", response_model=PoeCurrencyStatRead)
def update_currency_stat(stat_id: int, payload: PoeCurrencyStatUpdate, db: Session = Depends(get_session)) -> PoeCurrencyStat:
    stat = db.get(PoeCurrencyStat, stat_id)
    if not stat:
        raise HTTPException(status_code=404, detail="Nie znaleziono statystyki dropów.")
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("league_id") is not None and not db.get(PoeLeague, changes["league_id"]):
        raise HTTPException(status_code=404, detail="Nie znaleziono ligi.")
    for key, value in changes.items():
        setattr(stat, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Statystyka o tej nazwie już istnieje dla tej postaci.",
        ) from exc
    db.refresh(stat)
    return stat


@router.delete("/stats/{stat_id}", status_code=204)
def delete_currency_stat(stat_id: int, db: Session = Depends(get_session)) -> None:
    stat = db.get(PoeCurrencyStat, stat_id)
    if not stat:
        raise HTTPException(status_code=404, detail="Nie znaleziono statystyki dropów.")
    db.delete(stat)
    db.commit()


@router.post("/characters/{character_id}/stats/reorder", response_model=list[PoeCurrencyStatRead])
def reorder_stats(character_id: int, payload: PoeStatsReorder, db: Session = Depends(get_session)) -> list[PoeCurrencyStat]:
    try:
        return reorder_currency_stats(db, character_id, payload.ordered_ids)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _validate_character_league(db: Session, league_id: int | None, game_version: str) -> None:
    if league_id is None:
        return
    league = db.get(PoeLeague, league_id)
    if not league:
        raise HTTPException(status_code=404, detail="Nie znaleziono ligi.")
    if league.game_version != game_version:
        raise HTTPException(
            status_code=422,
            detail="Liga i postać muszą należeć do tej samej wersji Path of Exile.",
        )


def _validate_league_period(start_date: date | None, end_date: date | None) -> None:
    if start_date and end_date and end_date < start_date:
        raise HTTPException(
            status_code=422,
            detail="Data zakończenia ligi nie może być wcześniejsza niż data rozpoczęcia.",
        )
    PoeEquipmentItemRead,
