from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from math import sqrt
from statistics import median
from typing import Iterable

from sqlalchemy import case, desc, func, select
from sqlalchemy.orm import Session, joinedload

from app.models import CompletedGameEntry, Game
from app.schemas.completed_games import (
    CompletedGameHighlightRead,
    CompletedGamesDayActivityRead,
    CompletedGamesDistributionItemRead,
    CompletedGamesForecastPointRead,
    CompletedGamesForecastCumulativeYearRead,
    CompletedGamesForecastModelScoreRead,
    CompletedGamesForecastRead,
    CompletedGamesHistoryRead,
    CompletedGamesHistoryYearRead,
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

FORECAST_REQUIREMENTS = "Co najmniej 12 miesięcy obserwacji, 2 lata, 6 aktywnych miesięcy i 12 odpowiednich wpisów."


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
    years_count = len({period.year for period in periods})
    zero_months_count = sum(value == 0 for value in values)
    missing_source_values_count = 0 if metric == "completed_games" else sum(entry.playtime_hours <= 0 for entry in historical_entries)
    historical = [CompletedGamesForecastPointRead(period=_period_label(period), value=_rounded(value)) for period, value in zip(periods, values)]
    if len(values) < 12 or years_count < 2 or active_months < 6 or source_entries < 12:
        return CompletedGamesForecastRead(
            metric=metric, sufficient_data=False,
            reason="Za mało danych do przygotowania wiarygodnej prognozy. Dodaj więcej ukończonych gier lub wybierz dłuższy okres.",
            historical=historical, observations_count=len(values), active_months_count=active_months,
            source_entries_count=source_entries, years_count=years_count, zero_months_count=zero_months_count,
            missing_source_values_count=missing_source_values_count, minimum_requirements=FORECAST_REQUIREMENTS,
        )
    holdout = min(3, max(1, len(values) // 4))
    train = values[:-holdout]
    actual = values[-holdout:]
    candidates = ["Ostatnia wartość", "Średnia ruchoma (3 miesiące)", "Regresja liniowa"]
    scores: list[CompletedGamesForecastModelScoreRead] = []
    for candidate in candidates:
        predictions = [
            max(0, _model_predict(candidate, values[: len(train) + index]))
            for index in range(holdout)
        ]
        candidate_mae, candidate_rmse = _errors(actual, predictions)
        scores.append(CompletedGamesForecastModelScoreRead(
            model=candidate,
            mae=_rounded(candidate_mae),
            rmse=_rounded(candidate_rmse),
            is_baseline=candidate == "Ostatnia wartość",
        ))
    selected = min(scores, key=lambda score: (score.mae, score.rmse, candidates.index(score.model)))
    model = selected.model
    mae, rmse = selected.mae, selected.rmse
    future_periods = _month_range(_next_month(last), _add_months(last, months_ahead))
    forecast = []
    future_history = list(values)
    for period in future_periods:
        prediction = max(0, _model_predict(model, future_history))
        spread = 1.96 * rmse
        forecast.append(CompletedGamesForecastPointRead(
            period=_period_label(period), value=_rounded(prediction),
            lower_bound=_rounded(max(0, prediction - spread)), upper_bound=_rounded(prediction + spread),
        ))
        future_history.append(prediction)
    cumulative_years = (
        _cumulative_playtime_years(periods, values, future_periods, forecast)
        if metric == "playtime"
        else []
    )
    return CompletedGamesForecastRead(
        metric=metric, sufficient_data=True, model=model, historical=historical, forecast=forecast,
        mae=_rounded(mae), rmse=_rounded(rmse), observations_count=len(values), active_months_count=active_months,
        source_entries_count=source_entries, years_count=years_count, zero_months_count=zero_months_count,
        missing_source_values_count=missing_source_values_count, validation_months_count=holdout,
        model_scores=scores, cumulative_years=cumulative_years, minimum_requirements=FORECAST_REQUIREMENTS,
    )


def build_history_summary(db: Session) -> CompletedGamesHistoryRead:
    year_expression = func.extract("year", CompletedGameEntry.completion_date)
    timed_value = case((CompletedGameEntry.playtime_hours > 0, CompletedGameEntry.playtime_hours), else_=None)
    yearly_rows = db.execute(
        select(
            year_expression.label("year"),
            func.count(CompletedGameEntry.id).label("completed_games_count"),
            func.coalesce(func.sum(timed_value), 0).label("total_playtime_hours"),
            func.avg(timed_value).label("average_playtime_hours"),
            func.avg(CompletedGameEntry.rating).label("average_rating"),
        )
        .group_by(year_expression)
        .order_by(year_expression)
    ).all()

    if not yearly_rows:
        return CompletedGamesHistoryRead(summary=CompletedGamesPeriodMetricsRead())

    aggregate = db.execute(
        select(
            func.count(CompletedGameEntry.id).label("completed_games_count"),
            func.coalesce(func.sum(timed_value), 0).label("total_playtime_hours"),
            func.avg(timed_value).label("average_playtime_hours"),
            func.count(timed_value).label("games_with_playtime_count"),
            func.avg(CompletedGameEntry.rating).label("average_rating"),
            func.count(CompletedGameEntry.rating).label("rated_games_count"),
        )
    ).one()
    ratings = list(db.scalars(
        select(CompletedGameEntry.rating)
        .where(CompletedGameEntry.rating.is_not(None))
        .order_by(CompletedGameEntry.rating)
    ).all())
    playtimes = list(db.scalars(
        select(CompletedGameEntry.playtime_hours)
        .where(CompletedGameEntry.playtime_hours > 0)
        .order_by(CompletedGameEntry.playtime_hours)
    ).all())
    category_rows = db.execute(
        select(
            year_expression.label("year"),
            CompletedGameEntry.platform,
            CompletedGameEntry.playtime_hours,
            CompletedGameEntry.rating,
            Game.genres,
        ).join(Game, Game.id == CompletedGameEntry.game_id)
    ).all()
    platforms, platforms_by_year = _history_distributions(category_rows, kind="platform")
    genres, genres_by_year = _history_distributions(category_rows, kind="genre")
    best_rated = db.scalars(
        select(CompletedGameEntry)
        .join(Game, Game.id == CompletedGameEntry.game_id)
        .options(joinedload(CompletedGameEntry.game))
        .where(CompletedGameEntry.rating.is_not(None))
        .order_by(desc(CompletedGameEntry.rating), desc(CompletedGameEntry.completion_date), Game.title, CompletedGameEntry.id)
        .limit(1)
    ).first()
    longest = db.scalars(
        select(CompletedGameEntry)
        .join(Game, Game.id == CompletedGameEntry.game_id)
        .options(joinedload(CompletedGameEntry.game))
        .where(CompletedGameEntry.playtime_hours > 0)
        .order_by(desc(CompletedGameEntry.playtime_hours), desc(CompletedGameEntry.completion_date), Game.title, CompletedGameEntry.id)
        .limit(1)
    ).first()

    yearly = [
        CompletedGamesHistoryYearRead(
            year=int(row.year),
            completed_games_count=int(row.completed_games_count),
            total_playtime_hours=_rounded(row.total_playtime_hours),
            average_playtime_hours=_rounded(row.average_playtime_hours) if row.average_playtime_hours is not None else None,
            average_rating=_rounded(row.average_rating) if row.average_rating is not None else None,
            platforms=platforms_by_year.get(int(row.year), []),
            genres=genres_by_year.get(int(row.year), []),
        )
        for row in yearly_rows
    ]
    completed_games_count = int(aggregate.completed_games_count)
    rated_games_count = int(aggregate.rated_games_count)
    summary = CompletedGamesPeriodMetricsRead(
        completed_games_count=completed_games_count,
        total_playtime_hours=_rounded(aggregate.total_playtime_hours),
        average_playtime_hours=_rounded(aggregate.average_playtime_hours) if aggregate.average_playtime_hours is not None else None,
        median_playtime_hours=_rounded(median(playtimes)) if playtimes else None,
        games_with_playtime_count=int(aggregate.games_with_playtime_count),
        average_rating=_rounded(aggregate.average_rating) if aggregate.average_rating is not None else None,
        median_rating=_rounded(median(ratings)) if ratings else None,
        rated_games_count=rated_games_count,
        unrated_games_count=completed_games_count - rated_games_count,
        unique_platforms_count=len([item for item in platforms if item.label != "Brak platformy"]),
        unique_genres_count=len([item for item in genres if item.label != "Brak gatunku"]),
        top_platform=next((item for item in platforms if item.label != "Brak platformy"), None),
        top_genre=next((item for item in genres if item.label != "Brak gatunku"), None),
        best_rated_game=_highlight(best_rated),
        longest_game=_highlight(longest),
    )
    return CompletedGamesHistoryRead(
        summary=summary,
        active_years_count=len(yearly),
        best_year_by_completions=max(yearly, key=lambda item: (item.completed_games_count, item.total_playtime_hours, item.year)),
        best_year_by_playtime=max(yearly, key=lambda item: (item.total_playtime_hours, item.completed_games_count, item.year)),
        yearly=yearly,
        platforms=platforms,
        genres=genres,
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


def _model_predict(model: str, values: list[float]) -> float:
    if not values:
        return 0
    if model == "Ostatnia wartość":
        return values[-1]
    if model == "Średnia ruchoma (3 miesiące)":
        return _moving_average(values)
    return _linear_predict(values, len(values))


def _cumulative_playtime_years(
    historical_periods: list[date],
    historical_values: list[float],
    future_periods: list[date],
    forecast: list[CompletedGamesForecastPointRead],
) -> list[CompletedGamesForecastCumulativeYearRead]:
    result: list[CompletedGamesForecastCumulativeYearRead] = []
    for year in sorted({period.year for period in future_periods}):
        running = 0.0
        historical: list[CompletedGamesForecastPointRead] = []
        for period, value in zip(historical_periods, historical_values):
            if period.year != year:
                continue
            running += max(0, value)
            historical.append(CompletedGamesForecastPointRead(period=_period_label(period), value=_rounded(running)))

        lower_running = running
        upper_running = running
        projected: list[CompletedGamesForecastPointRead] = []
        for period, point in zip(future_periods, forecast):
            if period.year != year:
                continue
            running += max(0, point.value)
            lower_running += max(0, point.lower_bound or 0)
            upper_running += max(0, point.upper_bound or point.value)
            projected.append(CompletedGamesForecastPointRead(
                period=point.period,
                value=_rounded(running),
                lower_bound=_rounded(lower_running),
                upper_bound=_rounded(max(upper_running, running)),
            ))
        result.append(CompletedGamesForecastCumulativeYearRead(
            year=year,
            historical=historical,
            forecast=projected,
        ))
    return result


def _history_distributions(rows, *, kind: str):
    all_groups: dict[str, dict[str, object]] = {}
    yearly_groups: dict[int, dict[str, dict[str, object]]] = defaultdict(dict)
    year_entry_counts: dict[int, int] = defaultdict(int)
    total_entries = len(rows)
    for row in rows:
        year = int(row.year)
        year_entry_counts[year] += 1
        if kind == "platform":
            labels = [row.platform.strip()] if row.platform and row.platform.strip() else ["Brak platformy"]
        else:
            labels = [value.strip() for value in (row.genres or []) if value.strip()] or ["Brak gatunku"]
        for label in dict.fromkeys(labels):
            key = label.casefold()
            _add_distribution_value(all_groups, key, label, row.playtime_hours, row.rating)
            _add_distribution_value(yearly_groups[year], key, label, row.playtime_hours, row.rating)
    overall = _distribution_values(all_groups, total_entries)
    yearly = {
        year: _distribution_values(groups, year_entry_counts[year])
        for year, groups in yearly_groups.items()
    }
    return overall, yearly


def _add_distribution_value(
    groups: dict[str, dict[str, object]],
    key: str,
    label: str,
    playtime: float,
    rating: float | None,
) -> None:
    group = groups.setdefault(key, {"label": label, "count": 0, "playtime": 0.0, "ratings": []})
    group["count"] = int(group["count"]) + 1
    if playtime > 0:
        group["playtime"] = float(group["playtime"]) + playtime
    if rating is not None:
        group["ratings"].append(rating)


def _distribution_values(
    groups: dict[str, dict[str, object]],
    entries_count: int,
) -> list[CompletedGamesDistributionItemRead]:
    result = []
    for group in groups.values():
        ratings = group["ratings"]
        count = int(group["count"])
        result.append(CompletedGamesDistributionItemRead(
            label=str(group["label"]),
            completed_games_count=count,
            percentage=_rounded(count * 100 / entries_count) if entries_count else None,
            total_playtime_hours=_rounded(float(group["playtime"])),
            average_rating=_rounded(sum(ratings) / len(ratings)) if ratings else None,
        ))
    return sorted(result, key=lambda item: (-item.completed_games_count, item.label.casefold()))


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
