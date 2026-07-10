from datetime import date

from app.models import BacklogEntry, CompletedGameEntry, Game, PoeCharacter, PoeCurrencyStat, PoeLeague
from app.services.dashboard_service import build_dashboard_summary


def test_dashboard_summary_counts_games_and_poe(db_session):
    game = Game(title="Done Game", genres=[], platforms=[], external_source="manual")
    db_session.add(game)
    db_session.flush()
    db_session.add(CompletedGameEntry(game_id=game.id, completion_date=date(2026, 7, 10), playtime_hours=2.5))
    backlog_game = Game(title="Next Game", genres=[], platforms=[], external_source="manual")
    db_session.add(backlog_game)
    db_session.flush()
    db_session.add(BacklogEntry(game_id=backlog_game.id, position=0))

    league = PoeLeague(name="Test League", game_version="poe2", status="active")
    db_session.add(league)
    db_session.flush()
    character = PoeCharacter(name="TestChar", game_version="poe2", level=88, league_id=league.id, playtime_minutes=240)
    db_session.add(character)
    db_session.flush()
    db_session.add(PoeCurrencyStat(character_id=character.id, league_id=league.id, name="Divine Orb", category="currency", value=3))
    db_session.commit()

    summary = build_dashboard_summary(db_session)

    assert summary.games.completed == 1
    assert summary.games.backlog == 1
    assert summary.total_game_playtime_hours == 2.5
    assert summary.poe_character_count == 1
    assert summary.poe_playtime_by_version["poe2"] == 240
    assert summary.top_currency_drops[0].name == "Divine Orb"
