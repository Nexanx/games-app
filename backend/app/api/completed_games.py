from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.database.session import get_session
from app.models import BacklogEntry, CompletedGameEntry, CustomStatistic, Game
from app.schemas.games import (
    CompletedGameEntryCreate,
    CompletedGameEntryRead,
    CompletedGameEntryUpdate,
    CompletedGamesYearRead,
    CustomStatisticBase,
    CustomStatisticInput,
    CustomStatisticRead,
    CustomStatisticUpdate,
)

router = APIRouter()


@router.get("/years", response_model=list[CompletedGamesYearRead])
def list_completed_years(db: Session = Depends(get_session)) -> list[CompletedGamesYearRead]:
    year_expression = func.extract("year", CompletedGameEntry.completion_date)
    rows = db.execute(
        select(year_expression.label("year"), func.count(CompletedGameEntry.id).label("completed_games_count"))
        .group_by(year_expression)
        .order_by(desc(year_expression))
    ).all()
    return [
        CompletedGamesYearRead(year=int(row.year), completed_games_count=int(row.completed_games_count))
        for row in rows
    ]


@router.get("", response_model=list[CompletedGameEntryRead])
def list_completed_games(
    year: int = Query(..., ge=1900, le=9998),
    month: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_session),
) -> list[CompletedGameEntry]:
    start, end = _date_range(year, month)
    return db.scalars(
        _entry_query()
        .where(CompletedGameEntry.completion_date >= start, CompletedGameEntry.completion_date < end)
        .order_by(desc(CompletedGameEntry.completion_date), desc(CompletedGameEntry.created_at))
    ).all()


@router.post("", response_model=CompletedGameEntryRead, status_code=201)
def create_completed_game(
    payload: CompletedGameEntryCreate, db: Session = Depends(get_session)
) -> CompletedGameEntry:
    if not db.get(Game, payload.game_id):
        raise HTTPException(status_code=404, detail="Game not found")

    backlog_entry = None
    if payload.backlog_entry_id is not None:
        backlog_entry = db.get(BacklogEntry, payload.backlog_entry_id)
        if not backlog_entry:
            raise HTTPException(status_code=404, detail="Backlog entry not found")
        if backlog_entry.game_id != payload.game_id:
            raise HTTPException(status_code=400, detail="Backlog entry does not match selected game")

    entry_data = payload.model_dump(exclude={"backlog_entry_id", "custom_statistics"})
    entry = CompletedGameEntry(**entry_data)
    entry.custom_statistics = [CustomStatistic(**stat.model_dump()) for stat in payload.custom_statistics]
    db.add(entry)
    if backlog_entry:
        db.delete(backlog_entry)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    return _get_entry(db, entry.id)


@router.get("/statistics/{statistic_id}", response_model=CustomStatisticRead)
def get_custom_statistic(statistic_id: int, db: Session = Depends(get_session)) -> CustomStatistic:
    statistic = db.get(CustomStatistic, statistic_id)
    if not statistic:
        raise HTTPException(status_code=404, detail="Custom statistic not found")
    return statistic


@router.patch("/statistics/{statistic_id}", response_model=CustomStatisticRead)
def update_custom_statistic(
    statistic_id: int, payload: CustomStatisticUpdate, db: Session = Depends(get_session)
) -> CustomStatistic:
    statistic = db.get(CustomStatistic, statistic_id)
    if not statistic:
        raise HTTPException(status_code=404, detail="Custom statistic not found")
    data = payload.model_dump(exclude_unset=True)
    validated = CustomStatisticBase.model_validate(
        {
            "name": data.get("name", statistic.name),
            "value": data.get("value", statistic.value),
            "value_type": data.get("value_type", statistic.value_type),
        }
    )
    for key, value in validated.model_dump().items():
        setattr(statistic, key, value)
    db.commit()
    db.refresh(statistic)
    return statistic


@router.delete("/statistics/{statistic_id}", status_code=204)
def delete_custom_statistic(statistic_id: int, db: Session = Depends(get_session)) -> None:
    statistic = db.get(CustomStatistic, statistic_id)
    if not statistic:
        raise HTTPException(status_code=404, detail="Custom statistic not found")
    db.delete(statistic)
    db.commit()


@router.get("/{entry_id}/statistics", response_model=list[CustomStatisticRead])
def list_custom_statistics(entry_id: int, db: Session = Depends(get_session)) -> list[CustomStatistic]:
    if not db.get(CompletedGameEntry, entry_id):
        raise HTTPException(status_code=404, detail="Completed game entry not found")
    return db.scalars(
        select(CustomStatistic)
        .where(CustomStatistic.completed_game_entry_id == entry_id)
        .order_by(CustomStatistic.id)
    ).all()


@router.post("/{entry_id}/statistics", response_model=CustomStatisticRead, status_code=201)
def create_custom_statistic(
    entry_id: int, payload: CustomStatisticInput, db: Session = Depends(get_session)
) -> CustomStatistic:
    if not db.get(CompletedGameEntry, entry_id):
        raise HTTPException(status_code=404, detail="Completed game entry not found")
    statistic = CustomStatistic(completed_game_entry_id=entry_id, **payload.model_dump())
    db.add(statistic)
    db.commit()
    db.refresh(statistic)
    return statistic


@router.get("/{entry_id}", response_model=CompletedGameEntryRead)
def get_completed_game(entry_id: int, db: Session = Depends(get_session)) -> CompletedGameEntry:
    return _get_entry(db, entry_id)


@router.patch("/{entry_id}", response_model=CompletedGameEntryRead)
def update_completed_game(
    entry_id: int, payload: CompletedGameEntryUpdate, db: Session = Depends(get_session)
) -> CompletedGameEntry:
    entry = _get_entry(db, entry_id)
    data = payload.model_dump(exclude_unset=True, exclude={"custom_statistics"})
    for key, value in data.items():
        setattr(entry, key, value)
    if payload.custom_statistics is not None:
        entry.custom_statistics = [CustomStatistic(**stat.model_dump()) for stat in payload.custom_statistics]
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    return _get_entry(db, entry.id)


@router.delete("/{entry_id}", status_code=204)
def delete_completed_game(entry_id: int, db: Session = Depends(get_session)) -> None:
    entry = db.get(CompletedGameEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Completed game entry not found")
    db.delete(entry)
    db.commit()


def _entry_query():
    return select(CompletedGameEntry).options(
        selectinload(CompletedGameEntry.game), selectinload(CompletedGameEntry.custom_statistics)
    )


def _get_entry(db: Session, entry_id: int) -> CompletedGameEntry:
    entry = db.scalars(_entry_query().where(CompletedGameEntry.id == entry_id)).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Completed game entry not found")
    return entry


def _date_range(year: int, month: int | None) -> tuple[date, date]:
    if month is None:
        return date(year, 1, 1), date(year + 1, 1, 1)
    start = date(year, month, 1)
    if month == 12:
        return start, date(year + 1, 1, 1)
    return start, date(year, month + 1, 1)
