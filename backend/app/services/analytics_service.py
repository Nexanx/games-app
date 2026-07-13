from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from math import sqrt
from statistics import median
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CompletedGameEntry
from app.schemas.completed_games import (
    CompletedGameHighlightRead,
    CompletedGamesDayActivityRead,
    CompletedGamesForecastPointRead,
    CompletedGamesForecastRead,
    CompletedGamesMonthComparisonRead,
    CompletedGamesMonthPeriodRead,
    CompletedGamesPeriodDifferenceRead,
    CompletedGamesPeriodMetricsRead,
    CompletedGamesYearActivityRead,
    CompletedGamesYearReportRead,
)
from app.services.completed_games_service import (
    _distribution,
    _highlight,
    _monthly_summaries,
    _rounded,
)

FORECAST_REQUIREMENTS = "Co najmniej 12 miesięcy obserwacji, 6 aktywnych miesięcy i 12 odpowiednich wpisów."


def build_period_metrics(entries: Iterable[CompletedGameEntry]) -> CompletedGamesPeriodMetricsRead:
    items = list(entries)
    timed = [entry for entry in items if entry.playtime_hours > 0]
    rated = [entry for entry in items if entry.rating is not None]
    platforms = _distribution(items, kind="platform")
    genres = _distribution(items, kind="genre")
    rated_sorted = sorted(rated, key=lambda entry: (-(entry.rating or 0), -entry.completion_date.toordinal(), entry.game.title.casefold(), entry.id))
    longest = sorted(timed, key=lambda entry: (-entry.playtime_hours, -entry.completion_date.toordinal(), entry.game.title.casefold(), entry.id))
    shortest = sorted(timed, key=lambda entry: (entry.playtime_hours, -entry.completion_date.toordinal(), entry.game.title.casefold(), entry.id))
    playtimes = [entry.playtime_hours for entry in timed]
    ratings = [entry.rating for entry in rated if entry.rating is not None]
    return CompletedGamesPeriodMetricsRead(
        completed_games_count=len(items),
        total_playtime_hours=_rounded(sum(playtimes)),
        average_playtime_hours=_rounded(sum(playtimes) / len(playtimes)) if playtimes else None,
        median_playtime_hours=_rounded(median(playtimes)) if playtimes else None,
        games_with_playtime_count=len(playtimes),
        average_rating=_rounded(sum(ratings) / len(ratings)) if ratings else None,
        median_rating=_rounded(median(ratings)) if ratings else None,
        rated_games_count=len(ratings),
        unrated_games_count=len(items) - len(ratings),
        unique_platforms_count=len([item for item in platforms if item.label != "Brak platformy"]),
        unique_genres_count=len([item for item in genres if item.label != "Brak gatunku"]),
        top_platform=next((item for item in platforms if item.label != "Brak platformy"), None),
        top_genre=next((item for item in genres if item.label != "Brak gatunku"), None),
        best_rated_game=_highlight(rated_sorted[0]) if rated_sorted else None,
        longest_game=_highlight(longest[0]) if longest else None,
        shortest_game=_highlight(shortest[0]) if shortest else None,
    )


def build_year_report(year: int, entries: Iterable[CompletedGameEntry], previous_entries: Iterable[CompletedGameEntry]) -> CompletedGamesYearReportRead:
    items = list(entries)
    previous_items = list(previous_entries)
    summary = build_period_metrics(items)
    previous_summary = build_period_metrics(previous_items)
    monthly = _monthly_summaries(items, include_empty=True, descending=False)
    active = [item for item in monthly if item.completed_games_count]
    ordered = sorted(items, key=lambda entry: (entry.completion_date, entry.game.title.casefold(), entry.id))
    most_active = min(active, key=lambda item: (-item.completed_games_count, -item.total_playtime_hours, item.month)) if active else None
    most_playtime = min(active, key=lambda item: (-item.total_playtime_hours, -item.completed_games_count, item.month)) if active else None
    most_diverse = min(active, key=lambda item: (-item.unique_genres_count, -item.completed_games_count, item.month)) if active else None
    platforms = _distribution(items, kind="platform")
    genres = _distribution(items, kind="genre")
    return CompletedGamesYearReportRead(
        year=year,
        generated_at=datetime.now(timezone.utc).isoformat(),
        summary=summary,
        monthly=monthly,
        platforms=platforms,
        genres=genres,
        first_completion=_highlight(ordered[0]) if ordered else None,
        last_completion=_highlight(ordered[-1]) if ordered else None,
        longest_active_streak_months=_longest_month_streak(active),
        most_active_month=most_active,
        most_playtime_month=most_playtime,
        most_diverse_month=most_diverse,
        insights=_report_insights(summary, most_active, most_playtime),
        previous_year=year - 1 if previous_items else None,
        previous_year_differences=_year_differences(summary, previous_summary) if previous_items else [],
        scatter_games=[_highlight(entry) for entry in items if entry.playtime_hours > 0 and entry.rating is not None],
    )


def build_year_activity(year: int, entries: Iterable[CompletedGameEntry]) -> CompletedGamesYearActivityRead:
    grouped: dict[date, list[CompletedGameEntry]] = defaultdict(list)
    for entry in entries:
        grouped[entry.completion_date].append(entry)
    days = []
    for day, day_entries in sorted(grouped.items()):
        ratings = [entry.rating for entry in day_entries if entry.rating is not None]
        days.append(CompletedGamesDayActivityRead(
            date=day.isoformat(),
            completed_games_count=len(day_entries),
            total_playtime_hours=_rounded(sum(entry.playtime_hours for entry in day_entries if entry.playtime_hours > 0)),
            average_rating=_rounded(sum(ratings) / len(ratings)) if ratings else None,
            games=[_highlight(entry) for entry in sorted(day_entries, key=lambda entry: (entry.game.title.casefold(), entry.id))],
        ))
    return CompletedGamesYearActivityRead(year=year, days=days)


def build_month_comparison(year: int, month_a: int, month_b: int, entries: Iterable[CompletedGameEntry]) -> CompletedGamesMonthComparisonRead:
    items = list(entries)
    a_items = [entry for entry in items if entry.completion_date.month == month_a]
    b_items = [entry for entry in items if entry.completion_date.month == month_b]
    a = _month_period(month_a, a_items)
    b = _month_period(month_b, b_items)
    return CompletedGamesMonthComparisonRead(
        year=year,
        month_a=a,
        month_b=b,
        differences=_comparison_differences(a.summary, b.summary),
    )


def build_forecast(db: Session, metric: str, months_ahead: int, today: date | None = None) -> CompletedGamesForecastRead:
    today = today or date.today()
    entries = db.execute(
        select(CompletedGameEntry.completion_date, CompletedGameEntry.playtime_hours)
        .order_by(CompletedGameEntry.completion_date)
    ).all()
    cutoff = date(today.year, today.month, 1)
    historical_entries = [entry for entry in entries if entry.completion_date < cutoff]
    if not historical_entries:
        return _insufficient_forecast(metric, "Brak zakończonych pełnych miesięcy do analizy.")
    first = date(historical_entries[0].completion_date.year, historical_entries[0].completion_date.month, 1)
    last = _previous_month(cutoff)
    periods = _month_range(first, last)
    entries_by_month = defaultdict(list)
    for entry in historical_entries:
        entries_by_month[(entry.completion_date.year, entry.completion_date.month)].append(entry)
    values = []
    for period in periods:
        month_entries = entries_by_month[(period.year, period.month)]
        values.append(float(len(month_entries)) if metric == "completed_games" else sum(entry.playtime_hours for entry in month_entries if entry.playtime_hours > 0))
    active_months = sum(value > 0 for value in values)
    source_entries = len(historical_entries) if metric == "completed_games" else sum(entry.playtime_hours > 0 for entry in historical_entries)
    historical = [CompletedGamesForecastPointRead(period=_period_label(period), value=_rounded(value)) for period, value in zip(periods, values)]
    if len(values) < 12 or active_months < 6 or source_entries < 12:
        return CompletedGamesForecastRead(
            metric=metric, sufficient_data=False,
            reason="Za mało danych do przygotowania wiarygodnej prognozy. Dodaj więcej ukończonych gier lub wybierz dłuższy okres.",
            historical=historical, observations_count=len(values), active_months_count=active_months,
            source_entries_count=source_entries, minimum_requirements=FORECAST_REQUIREMENTS,
        )
    holdout = min(3, max(1, len(values) // 4))
    train = values[:-holdout]
    actual = values[-holdout:]
    linear_predictions = [_linear_predict(train, len(train) + index) for index in range(holdout)]
    moving_predictions = [_moving_average(values[:len(train) + index]) for index in range(holdout)]
    linear_mae, linear_rmse = _errors(actual, linear_predictions)
    moving_mae, moving_rmse = _errors(actual, moving_predictions)
    if moving_mae <= linear_mae:
        model = "Średnia ruchoma (3 miesiące)"
        mae, rmse = moving_mae, moving_rmse
        predictor = lambda index: _moving_average(values)
    else:
        model = "Regresja liniowa"
        mae, rmse = linear_mae, linear_rmse
        predictor = lambda index: _linear_predict(values, len(values) + index)
    future_periods = _month_range(_next_month(last), _add_months(last, months_ahead))
    forecast = []
    for index, period in enumerate(future_periods):
        prediction = max(0, predictor(index))
        spread = 1.96 * rmse
        forecast.append(CompletedGamesForecastPointRead(
            period=_period_label(period), value=_rounded(prediction),
            lower_bound=_rounded(max(0, prediction - spread)), upper_bound=_rounded(prediction + spread),
        ))
    return CompletedGamesForecastRead(
        metric=metric, sufficient_data=True, model=model, historical=historical, forecast=forecast,
        mae=_rounded(mae), rmse=_rounded(rmse), observations_count=len(values), active_months_count=active_months,
        source_entries_count=source_entries, minimum_requirements=FORECAST_REQUIREMENTS,
    )


def _month_period(month: int, entries: list[CompletedGameEntry]) -> CompletedGamesMonthPeriodRead:
    return CompletedGamesMonthPeriodRead(
        month=month,
        summary=build_period_metrics(entries),
        platforms=_distribution(entries, kind="platform"),
        genres=_distribution(entries, kind="genre"),
        games=[_highlight(entry) for entry in sorted(entries, key=lambda entry: (-entry.completion_date.toordinal(), entry.game.title.casefold(), entry.id))],
    )


def _comparison_differences(a: CompletedGamesPeriodMetricsRead, b: CompletedGamesPeriodMetricsRead) -> list[CompletedGamesPeriodDifferenceRead]:
    metrics = [
        ("completed_games_count", a.completed_games_count, b.completed_games_count),
        ("total_playtime_hours", a.total_playtime_hours, b.total_playtime_hours),
        ("average_playtime_hours", a.average_playtime_hours, b.average_playtime_hours),
        ("median_playtime_hours", a.median_playtime_hours, b.median_playtime_hours),
        ("average_rating", a.average_rating, b.average_rating),
        ("median_rating", a.median_rating, b.median_rating),
        ("rated_games_count", a.rated_games_count, b.rated_games_count),
        ("unique_platforms_count", a.unique_platforms_count, b.unique_platforms_count),
        ("unique_genres_count", a.unique_genres_count, b.unique_genres_count),
    ]
    return [_difference(name, left, right) for name, left, right in metrics]


def _year_differences(current: CompletedGamesPeriodMetricsRead, previous: CompletedGamesPeriodMetricsRead) -> list[CompletedGamesPeriodDifferenceRead]:
    return [
        _difference("completed_games_count", previous.completed_games_count, current.completed_games_count),
        _difference("total_playtime_hours", previous.total_playtime_hours, current.total_playtime_hours),
        _difference("average_rating", previous.average_rating, current.average_rating),
        _difference("average_playtime_hours", previous.average_playtime_hours, current.average_playtime_hours),
    ]


def _difference(metric: str, base: float | int | None, compared: float | int | None) -> CompletedGamesPeriodDifferenceRead:
    if base is None or compared is None:
        return CompletedGamesPeriodDifferenceRead(metric=metric, previous_value=base, current_value=compared)
    absolute = float(compared) - float(base)
    has_baseline = float(base) != 0
    return CompletedGamesPeriodDifferenceRead(
        metric=metric, previous_value=float(base), current_value=float(compared), absolute_change=_rounded(absolute),
        percentage_change=_rounded(absolute / float(base) * 100) if has_baseline else None,
        has_percentage_baseline=has_baseline,
    )


def _longest_month_streak(active_months) -> int:
    active = {item.month for item in active_months}
    longest = current = 0
    for month in range(1, 13):
        current = current + 1 if month in active else 0
        longest = max(longest, current)
    return longest


def _report_insights(summary, most_active, most_playtime) -> list[str]:
    insights = []
    if most_active:
        insights.append(f"Najwięcej gier ukończono w {_month_locative(most_active.month)} — {most_active.completed_games_count}.")
    if summary.games_with_playtime_count:
        insights.append(f"Łączny czas gry wyniósł {summary.total_playtime_hours:g} godz.")
    if summary.top_platform:
        insights.append(f"Najczęściej wybieraną platformą była {summary.top_platform.label}.")
    if summary.top_genre:
        insights.append(f"Najczęściej wybieranym gatunkiem był {summary.top_genre.label}.")
    if most_playtime and most_playtime.total_playtime_hours > 0:
        insights.append(f"Najwięcej czasu przypadało na {_month_accusative(most_playtime.month)} — {most_playtime.total_playtime_hours:g} godz.")
    return insights


def _month_locative(month: int) -> str:
    return ["styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu", "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"][month - 1]


def _month_accusative(month: int) -> str:
    return ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"][month - 1]


def _linear_predict(values: list[float], x: int) -> float:
    n = len(values)
    xs = list(range(n))
    mean_x = sum(xs) / n
    mean_y = sum(values) / n
    denominator = sum((item - mean_x) ** 2 for item in xs)
    slope = sum((item - mean_x) * (value - mean_y) for item, value in zip(xs, values)) / denominator if denominator else 0
    return mean_y + slope * (x - mean_x)


def _moving_average(values: list[float]) -> float:
    window = values[-3:]
    return sum(window) / len(window) if window else 0


def _errors(actual: list[float], predicted: list[float]) -> tuple[float, float]:
    errors = [actual_value - max(0, predicted_value) for actual_value, predicted_value in zip(actual, predicted)]
    return sum(abs(item) for item in errors) / len(errors), sqrt(sum(item ** 2 for item in errors) / len(errors))


def _insufficient_forecast(metric: str, reason: str) -> CompletedGamesForecastRead:
    return CompletedGamesForecastRead(metric=metric, sufficient_data=False, reason=reason, minimum_requirements=FORECAST_REQUIREMENTS)


def _period_label(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def _next_month(value: date) -> date:
    return date(value.year + (value.month == 12), 1 if value.month == 12 else value.month + 1, 1)


def _previous_month(value: date) -> date:
    return date(value.year - (value.month == 1), 12 if value.month == 1 else value.month - 1, 1)


def _add_months(value: date, count: int) -> date:
    result = value
    for _ in range(count):
        result = _next_month(result)
    return result


def _month_range(start: date, end: date) -> list[date]:
    result = []
    current = start
    while current <= end:
        result.append(current)
        current = _next_month(current)
    return result
