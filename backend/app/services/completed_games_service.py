from __future__ import annotations

from collections import defaultdict
from datetime import date
from statistics import median
from typing import Iterable

from sqlalchemy import and_, desc, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import CompletedGameEntry
from app.schemas.completed_games import (
    CompletedGameHighlightRead,
    CompletedGamesComparisonRead,
    CompletedGamesComparisonYearRead,
    CompletedGamesDistributionItemRead,
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
    date_from: date | None = None,
    date_to: date | None = None,
    playtime_min: float | None = None,
    playtime_max: float | None = None,
) -> list[CompletedGameEntry]:
    wanted_platforms = {_normalize(value) for value in platforms if _normalize(value)}
    wanted_genres = {_normalize(value) for value in genres if _normalize(value)}

    filtered: list[CompletedGameEntry] = []
    for entry in entries:
        # The platform saved on the completion is authoritative. Supported game
        # platforms are not the same thing as the platform actually chosen.
        entry_platforms = {_normalize(entry.platform)} if entry.platform else set()
        entry_genres = {_normalize(value) for value in entry.game.genres if _normalize(value)}

        if wanted_platforms and not entry_platforms.intersection(wanted_platforms):
            continue
        if wanted_genres and not entry_genres.intersection(wanted_genres):
            continue
        if rating_min is not None and (entry.rating is None or entry.rating < rating_min):
            continue
        if rating_max is not None and (entry.rating is None or entry.rating > rating_max):
            continue
        if date_from is not None and entry.completion_date < date_from:
            continue
        if date_to is not None and entry.completion_date > date_to:
            continue
        if playtime_min is not None and entry.playtime_hours < playtime_min:
            continue
        if playtime_max is not None and entry.playtime_hours > playtime_max:
            continue
        filtered.append(entry)
    return filtered


def build_year_dashboard(
    year: int,
    entries: Iterable[CompletedGameEntry],
    *,
    filter_option_entries: Iterable[CompletedGameEntry] | None = None,
) -> CompletedGamesYearDashboardRead:
    entry_list = list(entries)
    monthly = _monthly_summaries(entry_list, include_empty=True, descending=False)
    ratings = [entry.rating for entry in entry_list if entry.rating is not None]
    timed_entries = [entry for entry in entry_list if entry.playtime_hours > 0]
    total_playtime = sum(entry.playtime_hours for entry in timed_entries)
    rated_entries = sorted(
        (entry for entry in entry_list if entry.rating is not None),
        key=lambda entry: (-(entry.rating or 0), -entry.completion_date.toordinal(), entry.game.title.casefold(), entry.id),
    )
    longest_entries = sorted(
        timed_entries,
        key=lambda entry: (-entry.playtime_hours, -entry.completion_date.toordinal(), entry.game.title.casefold(), entry.id),
    )
    shortest_entries = sorted(
        timed_entries,
        key=lambda entry: (entry.playtime_hours, -entry.completion_date.toordinal(), entry.game.title.casefold(), entry.id),
    )
    latest_entries = sorted(
        entry_list,
        key=lambda entry: (-entry.completion_date.toordinal(), entry.game.title.casefold(), entry.id),
    )
    active_months = [month for month in monthly if month.completed_games_count]
    most_active_month = sorted(
        active_months,
        key=lambda month: (-month.completed_games_count, -month.total_playtime_hours, month.month),
    )[0] if active_months else None

    return CompletedGamesYearDashboardRead(
        year=year,
        completed_games_count=len(entry_list),
        total_playtime_hours=_rounded(total_playtime),
        average_playtime_hours=_rounded(total_playtime / len(timed_entries)) if timed_entries else None,
        games_with_playtime_count=len(timed_entries),
        average_rating=_rounded(sum(ratings) / len(ratings)) if ratings else None,
        rated_games_count=len(ratings),
        best_rated_game=_highlight(rated_entries[0]) if rated_entries else None,
        longest_game=_highlight(longest_entries[0]) if longest_entries else None,
        shortest_game=_highlight(shortest_entries[0]) if shortest_entries else None,
        most_active_month=most_active_month,
        active_months_count=len(active_months),
        monthly=monthly,
        platforms=_distribution(entry_list, kind="platform"),
        genres=_distribution(entry_list, kind="genre"),
        best_rated_games=[_highlight(entry) for entry in rated_entries[:5]],
        longest_games=[_highlight(entry) for entry in longest_entries[:5]],
        shortest_games=[_highlight(entry) for entry in shortest_entries[:5]],
        latest_completions=[_highlight(entry) for entry in latest_entries[:5]],
        scatter_games=[_highlight(entry) for entry in entry_list if entry.playtime_hours > 0 and entry.rating is not None],
        filter_options=_filter_options(filter_option_entries if filter_option_entries is not None else entry_list),
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
        timed_entries = [entry for entry in entries if entry.playtime_hours > 0]
        total_playtime = sum(entry.playtime_hours for entry in timed_entries)
        result.append(
            CompletedGamesComparisonYearRead(
                year=year,
                completed_games_count=len(entries),
                total_playtime_hours=_rounded(total_playtime),
                average_playtime_hours=_rounded(total_playtime / len(timed_entries)) if timed_entries else None,
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
        playtimes = [entry.playtime_hours for entry in month_entries if entry.playtime_hours > 0]
        total_playtime = sum(playtimes)
        games_with_playtime_count = len(playtimes)
        platforms = {_normalize(entry.platform) for entry in month_entries if _normalize(entry.platform)}
        genres = {_normalize(genre) for entry in month_entries for genre in entry.game.genres if _normalize(genre)}
        best_rated = sorted(
            (entry for entry in month_entries if entry.rating is not None),
            key=lambda entry: (-(entry.rating or 0), -entry.completion_date.toordinal(), entry.game.title.casefold(), entry.id),
        )
        summaries.append(
            CompletedGamesMonthSummaryRead(
                month=month,
                completed_games_count=len(month_entries),
                total_playtime_hours=_rounded(total_playtime),
                games_with_playtime_count=games_with_playtime_count,
                average_playtime_hours=_rounded(total_playtime / games_with_playtime_count) if games_with_playtime_count else None,
                median_playtime_hours=_rounded(median(playtimes)) if playtimes else None,
                average_rating=_rounded(sum(ratings) / len(ratings)) if ratings else None,
                median_rating=_rounded(median(ratings)) if ratings else None,
                rated_games_count=len(ratings),
                unique_platforms_count=len(platforms),
                unique_genres_count=len(genres),
                best_rated_game=_highlight(best_rated[0]) if best_rated else None,
            )
        )
    return summaries


def _filter_options(entries: Iterable[CompletedGameEntry]) -> CompletedGamesFilterOptionsRead:
    platforms: dict[str, str] = {}
    genres: dict[str, str] = {}
    for entry in entries:
        values = [entry.platform] if entry.platform else []
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


def _distribution(
    entries: Iterable[CompletedGameEntry], *, kind: str
) -> list[CompletedGamesDistributionItemRead]:
    entry_list = list(entries)
    groups: dict[str, dict[str, object]] = {}
    for entry in entry_list:
        if kind == "platform":
            labels = [entry.platform.strip()] if entry.platform and entry.platform.strip() else ["Brak platformy"]
        else:
            labels = [value.strip() for value in entry.game.genres if value.strip()] or ["Brak gatunku"]
        for label in dict.fromkeys(labels):
            normalized = _normalize(label)
            group = groups.setdefault(normalized, {"label": label, "entries": []})
            group["entries"].append(entry)

    result: list[CompletedGamesDistributionItemRead] = []
    for group in groups.values():
        group_entries = group["entries"]
        group_ratings = [entry.rating for entry in group_entries if entry.rating is not None]
        count = len(group_entries)
        result.append(
            CompletedGamesDistributionItemRead(
                label=str(group["label"]),
                completed_games_count=count,
                percentage=_rounded(count * 100 / len(entry_list)) if entry_list else None,
                total_playtime_hours=_rounded(sum(entry.playtime_hours for entry in group_entries if entry.playtime_hours > 0)),
                average_rating=_rounded(sum(group_ratings) / len(group_ratings)) if group_ratings else None,
            )
        )
    return sorted(result, key=lambda item: (-item.completed_games_count, item.label.casefold()))


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
        platform=entry.platform,
        genres=entry.game.genres,
        external_ratings=entry.game.external_ratings,
    )


def _normalize(value: str | None) -> str:
    return value.strip().casefold() if value else ""


def _rounded(value: float) -> float:
    return round(float(value), 2)
