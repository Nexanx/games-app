from app.models import BacklogGame, Game, PoeCharacter, PoeCurrencyStat, PoeLeague
from app.services.dashboard_service import build_dashboard_summary


def test_dashboard_summary_counts_games_and_poe(db_session):
    game = Game(title="Done Game", genres=[], platforms=[], external_source="manual")
    db_session.add(game)
    db_session.flush()
    db_session.add(BacklogGame(game_id=game.id, status="completed", position=0, playtime_minutes=125))

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
    assert summary.total_game_playtime_minutes == 125
    assert summary.poe_character_count == 1
    assert summary.poe_playtime_by_version["poe2"] == 240
    assert summary.top_currency_drops[0].name == "Divine Orb"

