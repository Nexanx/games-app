from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.database.session import get_session
from app.models import BacklogEntry, CompletedGameEntry, CustomStatistic, Game
from app.schemas.completed_games import (
    CompletedGamesComparisonRead,
    CompletedGamesForecastRead,
    CompletedGamesHistoryRead,
    CompletedGamesMonthComparisonRead,
    CompletedGamesYearActivityRead,
    CompletedGamesYearDashboardRead,
    CompletedGamesYearReportRead,
)
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
from app.services.completed_games_service import (
    build_comparison,
    build_year_dashboard,
    filter_completed_entries,
    get_completed_entries_for_year,
)
from app.services.analytics_service import (
    build_forecast,
    build_history_summary,
    build_month_comparison,
    build_year_activity,
    build_year_report,
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


@router.get("/history", response_model=CompletedGamesHistoryRead)
def get_completed_games_history(db: Session = Depends(get_session)) -> CompletedGamesHistoryRead:
    return build_history_summary(db)


@router.get("", response_model=list[CompletedGameEntryRead])
def list_completed_games(
    year: int = Query(..., ge=1900, le=9998),
    month: int | None = Query(default=None, ge=1, le=12),
    platform: list[str] | None = Query(default=None),
    genre: list[str] | None = Query(default=None),
    rating_min: float | None = Query(default=None, ge=0, le=10),
    rating_max: float | None = Query(default=None, ge=0, le=10),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    playtime_min: float | None = Query(default=None, ge=0),
    playtime_max: float | None = Query(default=None, ge=0),
    db: Session = Depends(get_session),
) -> list[CompletedGameEntry]:
    _validate_filter_ranges(rating_min, rating_max, date_from, date_to, playtime_min, playtime_max)
    start, end = _date_range(year, month)
    entries = db.scalars(
        _entry_query()
        .where(CompletedGameEntry.completion_date >= start, CompletedGameEntry.completion_date < end)
        .order_by(desc(CompletedGameEntry.completion_date), desc(CompletedGameEntry.created_at))
    ).all()
    return filter_completed_entries(
        entries,
        platforms=platform or [],
        genres=genre or [],
        rating_min=rating_min,
        rating_max=rating_max,
        date_from=date_from,
        date_to=date_to,
        playtime_min=playtime_min,
        playtime_max=playtime_max,
    )


@router.get("/year/{year}/dashboard", response_model=CompletedGamesYearDashboardRead)
def get_completed_games_year_dashboard(
    year: int,
    month: int | None = Query(default=None, ge=1, le=12),
    platform: list[str] | None = Query(default=None),
    genre: list[str] | None = Query(default=None),
    rating_min: float | None = Query(default=None, ge=0, le=10),
    rating_max: float | None = Query(default=None, ge=0, le=10),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    playtime_min: float | None = Query(default=None, ge=0),
    playtime_max: float | None = Query(default=None, ge=0),
    db: Session = Depends(get_session),
) -> CompletedGamesYearDashboardRead:
    if year < 1900 or year > 9998:
        raise HTTPException(status_code=422, detail="Invalid year")
    _validate_filter_ranges(rating_min, rating_max, date_from, date_to, playtime_min, playtime_max)
    year_entries = get_completed_entries_for_year(db, year)
    period_entries = [entry for entry in year_entries if month is None or entry.completion_date.month == month]
    filtered_entries = filter_completed_entries(
        period_entries,
        platforms=platform or [],
        genres=genre or [],
        rating_min=rating_min,
        rating_max=rating_max,
        date_from=date_from,
        date_to=date_to,
        playtime_min=playtime_min,
        playtime_max=playtime_max,
    )
    return build_year_dashboard(year, filtered_entries, filter_option_entries=year_entries)


@router.get("/comparison", response_model=CompletedGamesComparisonRead)
def compare_completed_games(
    years: str = Query(..., min_length=1, max_length=99),
    db: Session = Depends(get_session),
) -> CompletedGamesComparisonRead:
    try:
        parsed_years = [int(value.strip()) for value in years.split(",") if value.strip()]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="years must be a comma separated list of years") from exc
    unique_years = sorted(set(parsed_years), reverse=True)
    if len(unique_years) < 2:
        raise HTTPException(status_code=422, detail="Select at least two distinct years")
    if len(unique_years) > 8 or any(year < 1900 or year > 9998 for year in unique_years):
        raise HTTPException(status_code=422, detail="Invalid years selection")
    return build_comparison(db, unique_years)


@router.get("/year/{year}/report", response_model=CompletedGamesYearReportRead)
def get_completed_games_year_report(
    year: int,
    db: Session = Depends(get_session),
) -> CompletedGamesYearReportRead:
    if year < 1900 or year > 9998:
        raise HTTPException(status_code=422, detail="Invalid year")
    return build_year_report(
        year,
        get_completed_entries_for_year(db, year),
        get_completed_entries_for_year(db, year - 1),
    )


@router.get("/year/{year}/activity", response_model=CompletedGamesYearActivityRead)
def get_completed_games_year_activity(
    year: int,
    db: Session = Depends(get_session),
) -> CompletedGamesYearActivityRead:
    if year < 1900 or year > 9998:
        raise HTTPException(status_code=422, detail="Invalid year")
    return build_year_activity(year, get_completed_entries_for_year(db, year))


@router.get("/month-comparison", response_model=CompletedGamesMonthComparisonRead)
def compare_completed_game_months(
    year: int = Query(..., ge=1900, le=9998),
    month_a: int = Query(..., ge=1, le=12),
    month_b: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_session),
) -> CompletedGamesMonthComparisonRead:
    if month_a == month_b:
        raise HTTPException(status_code=422, detail="Select two different months")
    return build_month_comparison(year, month_a, month_b, get_completed_entries_for_year(db, year))


@router.get("/forecast", response_model=CompletedGamesForecastRead)
def get_completed_games_forecast(
    metric: Literal["completed_games", "playtime"] = Query(default="completed_games"),
    months_ahead: int = Query(default=6, ge=1, le=12),
    db: Session = Depends(get_session),
) -> CompletedGamesForecastRead:
    return build_forecast(db, metric, months_ahead)


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


def _validate_filter_ranges(
    rating_min: float | None,
    rating_max: float | None,
    date_from: date | None,
    date_to: date | None,
    playtime_min: float | None,
    playtime_max: float | None,
) -> None:
    if rating_min is not None and rating_max is not None and rating_min > rating_max:
        raise HTTPException(status_code=422, detail="rating_min cannot be greater than rating_max")
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from cannot be greater than date_to")
    if playtime_min is not None and playtime_max is not None and playtime_min > playtime_max:
        raise HTTPException(status_code=422, detail="playtime_min cannot be greater than playtime_max")
