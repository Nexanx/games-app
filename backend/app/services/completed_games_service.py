from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Iterable

from sqlalchemy import and_, desc, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import CompletedGameEntry
from app.schemas.completed_games import (
    CompletedGameHighlightRead,
    CompletedGamesComparisonRead,
    CompletedGamesComparisonYearRead,
    CompletedGamesFilterOptionsRead,
    CompletedGamesMonthSummaryRead,
    CompletedGamesYearDashboardRead,
)


def get_completed_entries_for_year(db: Session, year: int) -> list[CompletedGameEntry]:
    start = date(year, 1, 1)
    end = date(year + 1, 1, 1)
    return db.scalars(
        select(CompletedGameEntry)
        .options(selectinload(CompletedGameEntry.game))
        .where(CompletedGameEntry.completion_date >= start, CompletedGameEntry.completion_date < end)
        .order_by(desc(CompletedGameEntry.completion_date), desc(CompletedGameEntry.created_at))
    ).all()


def filter_completed_entries(
    entries: Iterable[CompletedGameEntry],
    *,
    platforms: Iterable[str] = (),
    genres: Iterable[str] = (),
    rating_min: float | None = None,
    rating_max: float | None = None,
) -> list[CompletedGameEntry]:
    wanted_platforms = {_normalize(value) for value in platforms if _normalize(value)}
    wanted_genres = {_normalize(value) for value in genres if _normalize(value)}

    filtered: list[CompletedGameEntry] = []
    for entry in entries:
        entry_platforms = {_normalize(entry.platform)} if entry.platform else set()
        entry_platforms.update(_normalize(value) for value in entry.game.platforms if _normalize(value))
        entry_genres = {_normalize(value) for value in entry.game.genres if _normalize(value)}

        if wanted_platforms and not entry_platforms.intersection(wanted_platforms):
            continue
        if wanted_genres and not entry_genres.intersection(wanted_genres):
            continue
        if rating_min is not None and (entry.rating is None or entry.rating < rating_min):
            continue
        if rating_max is not None and (entry.rating is None or entry.rating > rating_max):
            continue
        filtered.append(entry)
    return filtered


def build_year_dashboard(year: int, entries: Iterable[CompletedGameEntry]) -> CompletedGamesYearDashboardRead:
    entry_list = list(entries)
    monthly = _monthly_summaries(entry_list, include_empty=False, descending=True)
    ratings = [entry.rating for entry in entry_list if entry.rating is not None]
    total_playtime = sum(entry.playtime_hours for entry in entry_list)
    best_rated = max(
        (entry for entry in entry_list if entry.rating is not None),
        key=lambda entry: (entry.rating or 0, entry.completion_date, entry.id),
        default=None,
    )
    longest = max(
        entry_list,
        key=lambda entry: (entry.playtime_hours, entry.completion_date, entry.id),
        default=None,
    )

    return CompletedGamesYearDashboardRead(
        year=year,
        completed_games_count=len(entry_list),
        total_playtime_hours=_rounded(total_playtime),
        average_playtime_hours=_rounded(total_playtime / len(entry_list)) if entry_list else None,
        average_rating=_rounded(sum(ratings) / len(ratings)) if ratings else None,
        best_rated_game=_highlight(best_rated),
        longest_game=_highlight(longest),
        active_months_count=len(monthly),
        monthly=monthly,
        filter_options=_filter_options(entry_list),
    )


def build_comparison(
    db: Session,
    years: Iterable[int],
) -> CompletedGamesComparisonRead:
    ordered_years = sorted(set(years), reverse=True)
    entries_by_year: dict[int, list[CompletedGameEntry]] = defaultdict(list)
    date_ranges = [
        and_(
            CompletedGameEntry.completion_date >= date(year, 1, 1),
            CompletedGameEntry.completion_date < date(year + 1, 1, 1),
        )
        for year in ordered_years
    ]
    if date_ranges:
        comparison_entries = db.scalars(
            select(CompletedGameEntry)
            .options(selectinload(CompletedGameEntry.game))
            .where(or_(*date_ranges))
            .order_by(desc(CompletedGameEntry.completion_date), desc(CompletedGameEntry.created_at))
        ).all()
        for entry in comparison_entries:
            entries_by_year[entry.completion_date.year].append(entry)

    result: list[CompletedGamesComparisonYearRead] = []
    for year in ordered_years:
        entries = entries_by_year.get(year, [])
        ratings = [entry.rating for entry in entries if entry.rating is not None]
        total_playtime = sum(entry.playtime_hours for entry in entries)
        result.append(
            CompletedGamesComparisonYearRead(
                year=year,
                completed_games_count=len(entries),
                total_playtime_hours=_rounded(total_playtime),
                average_playtime_hours=_rounded(total_playtime / len(entries)) if entries else None,
                average_rating=_rounded(sum(ratings) / len(ratings)) if ratings else None,
                monthly=_monthly_summaries(entries, include_empty=True, descending=False),
            )
        )
    return CompletedGamesComparisonRead(years=result)


def _monthly_summaries(
    entries: Iterable[CompletedGameEntry], *, include_empty: bool, descending: bool
) -> list[CompletedGamesMonthSummaryRead]:
    groups: dict[int, list[CompletedGameEntry]] = defaultdict(list)
    for entry in entries:
        groups[entry.completion_date.month].append(entry)

    months = range(1, 13) if include_empty else sorted(groups, reverse=descending)
    summaries: list[CompletedGamesMonthSummaryRead] = []
    for month in months:
        month_entries = groups.get(month, [])
        if not month_entries and not include_empty:
            continue
        ratings = [entry.rating for entry in month_entries if entry.rating is not None]
        total_playtime = sum(entry.playtime_hours for entry in month_entries)
        summaries.append(
            CompletedGamesMonthSummaryRead(
                month=month,
                completed_games_count=len(month_entries),
                total_playtime_hours=_rounded(total_playtime),
                average_rating=_rounded(sum(ratings) / len(ratings)) if ratings else None,
            )
        )
    return summaries


def _filter_options(entries: Iterable[CompletedGameEntry]) -> CompletedGamesFilterOptionsRead:
    platforms: dict[str, str] = {}
    genres: dict[str, str] = {}
    for entry in entries:
        values = [entry.platform] if entry.platform else []
        values.extend(entry.game.platforms)
        for value in values:
            normalized = _normalize(value)
            if normalized:
                platforms.setdefault(normalized, value.strip())
        for value in entry.game.genres:
            normalized = _normalize(value)
            if normalized:
                genres.setdefault(normalized, value.strip())
    return CompletedGamesFilterOptionsRead(
        platforms=sorted(platforms.values(), key=str.casefold),
        genres=sorted(genres.values(), key=str.casefold),
    )


def _highlight(entry: CompletedGameEntry | None) -> CompletedGameHighlightRead | None:
    if entry is None:
        return None
    return CompletedGameHighlightRead(
        id=entry.id,
        title=entry.game.title,
        completion_date=entry.completion_date.isoformat(),
        playtime_hours=_rounded(entry.playtime_hours),
        rating=entry.rating,
        cover_url=entry.game.cover_url,
    )


def _normalize(value: str | None) -> str:
    return value.strip().casefold() if value else ""


def _rounded(value: float) -> float:
    return round(float(value), 2)
