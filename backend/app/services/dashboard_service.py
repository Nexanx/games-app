from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import asc, desc, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models import BacklogEntry, CompletedGameEntry, PoeCharacter, PoeLeague
from app.schemas.dashboard import (
    DashboardBacklogEntry,
    DashboardCompletedGame,
    DashboardCurrentYearSummary,
    DashboardGamesSummary,
    DashboardMonthSummary,
    DashboardPoeSummary,
    DashboardSummary,
    LeagueSummary,
)
from app.services.completed_games_service import build_year_dashboard, get_completed_entries_for_year

logger = logging.getLogger(__name__)


def build_dashboard_summary(session: Session, today: date | None = None) -> DashboardSummary:
    today = today or date.today()
    current_entries = get_completed_entries_for_year(session, today.year)
    year_dashboard = build_year_dashboard(today.year, current_entries)

    next_backlog = session.scalars(
        select(BacklogEntry)
        .options(selectinload(BacklogEntry.game))
        .order_by(asc(BacklogEntry.position), asc(BacklogEntry.created_at), asc(BacklogEntry.id))
        .limit(5)
    ).all()
    recent_completed = session.scalars(
        select(CompletedGameEntry)
        .options(selectinload(CompletedGameEntry.game))
        .order_by(desc(CompletedGameEntry.completion_date), desc(CompletedGameEntry.updated_at), desc(CompletedGameEntry.id))
        .limit(5)
    ).all()
    backlog_count = session.scalar(select(func.count(BacklogEntry.id))) or 0

    first_trend_month = max(1, today.month - 5)
    trend = [
        DashboardMonthSummary(
            month=item.month,
            completed_games_count=item.completed_games_count,
            total_playtime_hours=item.total_playtime_hours,
        )
        for item in year_dashboard.monthly
        if first_trend_month <= item.month <= today.month
    ]
    most_active_month = year_dashboard.most_active_month
    top_platform = next((item.label for item in year_dashboard.platforms if item.label != "Brak platformy"), None)

    games = DashboardGamesSummary(
        backlog_count=int(backlog_count),
        current_year=DashboardCurrentYearSummary(
            year=today.year,
            completed_games_count=year_dashboard.completed_games_count,
            total_playtime_hours=year_dashboard.total_playtime_hours,
            games_with_playtime_count=year_dashboard.games_with_playtime_count,
            average_rating=year_dashboard.average_rating,
            rated_games_count=year_dashboard.rated_games_count,
            most_active_month=DashboardMonthSummary(
                month=most_active_month.month,
                completed_games_count=most_active_month.completed_games_count,
                total_playtime_hours=most_active_month.total_playtime_hours,
            ) if most_active_month else None,
            top_platform=top_platform,
            trend=trend,
        ),
        next_backlog_entries=[
            DashboardBacklogEntry(
                id=entry.id,
                position=entry.position,
                title=entry.game.title,
                cover_url=entry.game.cover_url,
                preferred_platform=entry.preferred_platform,
                note=entry.note,
            )
            for entry in next_backlog
        ],
        recent_completed_games=[
            DashboardCompletedGame(
                id=entry.id,
                title=entry.game.title,
                cover_url=entry.game.cover_url,
                completion_date=entry.completion_date.isoformat(),
                playtime_hours=entry.playtime_hours,
                rating=entry.rating,
            )
            for entry in recent_completed
        ],
    )

    try:
        poe = _build_poe_summary(session)
        poe_error = None
    except SQLAlchemyError:
        session.rollback()
        logger.exception("Could not build the optional Path of Exile dashboard section")
        poe = None
        poe_error = "Nie udało się pobrać skrótu Path of Exile. Dane gier są nadal dostępne."

    return DashboardSummary(games=games, poe=poe, poe_error=poe_error)


def _build_poe_summary(session: Session) -> DashboardPoeSummary:
    playtime_rows = session.execute(
        select(
            PoeCharacter.game_version,
            func.count(PoeCharacter.id).label("character_count"),
            func.coalesce(func.sum(PoeCharacter.playtime_minutes), 0).label("playtime_minutes"),
        ).group_by(PoeCharacter.game_version)
    ).all()
    playtime_by_version = {"poe1": 0, "poe2": 0}
    character_count = 0
    for row in playtime_rows:
        character_count += int(row.character_count)
        playtime_by_version[row.game_version] = int(row.playtime_minutes)

    latest_league = session.scalars(
        select(PoeLeague).order_by(desc(PoeLeague.start_date), desc(PoeLeague.created_at))
    ).first()
    league_summary = LeagueSummary()
    if latest_league:
        league_stats = session.execute(
            select(
                func.count(PoeCharacter.id).label("character_count"),
                func.coalesce(func.sum(PoeCharacter.playtime_minutes), 0).label("playtime_minutes"),
            ).where(PoeCharacter.league_id == latest_league.id)
        ).one()
        league_summary = LeagueSummary(
            name=latest_league.name,
            game_version=latest_league.game_version,
            status=latest_league.status,
            characters=int(league_stats.character_count),
            playtime_minutes=int(league_stats.playtime_minutes),
        )

    return DashboardPoeSummary(
        character_count=character_count,
        playtime_by_version=playtime_by_version,
        latest_league=league_summary,
    )
