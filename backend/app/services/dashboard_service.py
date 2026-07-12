from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.models import BacklogEntry, CompletedGameEntry, PoeCharacter, PoeCurrencyStat, PoeLeague
from app.schemas.dashboard import CurrencyHighlight, DashboardSummary, GamesSummary, LeagueSummary


def build_dashboard_summary(session: Session) -> DashboardSummary:
    recent_backlog_entries = session.scalars(
        select(BacklogEntry)
        .options(selectinload(BacklogEntry.game))
        .order_by(desc(BacklogEntry.created_at))
        .limit(5)
    ).all()
    recent_completed = session.scalars(
        select(CompletedGameEntry)
        .options(
            selectinload(CompletedGameEntry.game),
            selectinload(CompletedGameEntry.custom_statistics),
        )
        .order_by(desc(CompletedGameEntry.completion_date), desc(CompletedGameEntry.updated_at))
        .limit(5)
    ).all()
    backlog_count = session.scalar(select(func.count(BacklogEntry.id))) or 0
    completed_count = session.scalar(select(func.count(CompletedGameEntry.id))) or 0
    total_game_playtime_hours = session.scalar(select(func.sum(CompletedGameEntry.playtime_hours))) or 0

    poe_playtime = {"poe1": 0, "poe2": 0}
    playtime_rows = session.execute(
        select(
            PoeCharacter.game_version,
            func.count(PoeCharacter.id).label("character_count"),
            func.coalesce(func.sum(PoeCharacter.playtime_minutes), 0).label("playtime_minutes"),
        ).group_by(PoeCharacter.game_version)
    ).all()
    character_count = 0
    for row in playtime_rows:
        character_count += int(row.character_count)
        poe_playtime[row.game_version] = int(row.playtime_minutes)

    recent_characters = session.scalars(
        select(PoeCharacter)
        .options(selectinload(PoeCharacter.league))
        .order_by(desc(PoeCharacter.created_at))
        .limit(5)
    ).all()

    top_currency_rows = session.execute(
        select(
            PoeCurrencyStat.name,
            PoeCurrencyStat.category,
            PoeCurrencyStat.icon_url,
            func.sum(PoeCurrencyStat.value).label("total_value"),
        )
        .group_by(PoeCurrencyStat.name, PoeCurrencyStat.category, PoeCurrencyStat.icon_url)
        .order_by(desc("total_value"))
        .limit(8)
    ).all()

    latest_league = session.scalars(select(PoeLeague).order_by(desc(PoeLeague.start_date), desc(PoeLeague.created_at))).first()
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

    return DashboardSummary(
        games=GamesSummary(backlog=backlog_count, completed=completed_count),
        total_game_playtime_hours=float(total_game_playtime_hours),
        recent_backlog_entries=recent_backlog_entries,
        recent_completed_games=recent_completed,
        poe_character_count=character_count,
        recent_poe_characters=recent_characters,
        poe_playtime_by_version=poe_playtime,
        top_currency_drops=[
            CurrencyHighlight(
                name=row.name,
                category=row.category,
                icon_url=row.icon_url,
                value=float(row.total_value or 0),
            )
            for row in top_currency_rows
        ],
        latest_league=league_summary,
    )
