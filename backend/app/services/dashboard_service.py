from collections import Counter

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.models import BacklogGame, PoeCharacter, PoeCurrencyStat, PoeLeague
from app.schemas.dashboard import CurrencyHighlight, DashboardSummary, LeagueSummary, StatusCounts


def build_dashboard_summary(session: Session) -> DashboardSummary:
    backlog_entries = session.scalars(select(BacklogGame)).all()
    status_counter = Counter(entry.status for entry in backlog_entries)

    recent_added = session.scalars(
        select(BacklogGame)
        .options(selectinload(BacklogGame.game))
        .order_by(desc(BacklogGame.created_at))
        .limit(5)
    ).all()
    recent_completed = session.scalars(
        select(BacklogGame)
        .options(selectinload(BacklogGame.game))
        .where(BacklogGame.status == "completed")
        .order_by(desc(BacklogGame.completed_at), desc(BacklogGame.updated_at))
        .limit(5)
    ).all()

    characters = session.scalars(select(PoeCharacter).options(selectinload(PoeCharacter.league))).all()
    poe_playtime = {"poe1": 0, "poe2": 0}
    for character in characters:
        poe_playtime[character.game_version] = poe_playtime.get(character.game_version, 0) + character.playtime_minutes

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
        league_characters = [character for character in characters if character.league_id == latest_league.id]
        league_summary = LeagueSummary(
            name=latest_league.name,
            game_version=latest_league.game_version,
            status=latest_league.status,
            characters=len(league_characters),
            playtime_minutes=sum(character.playtime_minutes for character in league_characters),
        )

    return DashboardSummary(
        games=StatusCounts(
            to_play=status_counter.get("to_play", 0),
            playing=status_counter.get("playing", 0),
            completed=status_counter.get("completed", 0),
            abandoned=status_counter.get("abandoned", 0),
            paused=status_counter.get("paused", 0),
        ),
        total_game_playtime_minutes=sum(entry.playtime_minutes for entry in backlog_entries),
        recent_added_games=recent_added,
        recent_completed_games=recent_completed,
        poe_character_count=len(characters),
        recent_poe_characters=sorted(characters, key=lambda item: item.created_at, reverse=True)[:5],
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

