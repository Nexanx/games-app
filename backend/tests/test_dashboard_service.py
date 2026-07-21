from datetime import date

from sqlalchemy.exc import OperationalError

from app.models import BacklogEntry, CompletedGameEntry, Game, PoeCharacter, PoeLeague
from app.services import dashboard_service
from app.services.dashboard_service import build_dashboard_summary


def add_game(db_session, title: str, *, cover_url: str | None = None, external_ratings: list[dict] | None = None) -> Game:
    game = Game(title=title, cover_url=cover_url, genres=["RPG"], platforms=["PC"], external_source="manual", external_ratings=external_ratings or [])
    db_session.add(game)
    db_session.flush()
    return game


def test_dashboard_summary_uses_current_year_and_backlog_order(db_session):
    current = add_game(db_session, "Current Game", cover_url="https://example.com/current.jpg", external_ratings=[{"source": "Metacritic", "value": 88, "scale": 100, "count": None}])
    unrated = add_game(db_session, "Unrated Game")
    older = add_game(db_session, "Older Game")
    db_session.add_all([
        CompletedGameEntry(game_id=current.id, completion_date=date(2026, 7, 10), playtime_hours=12.5, rating=9, platform="PC"),
        CompletedGameEntry(game_id=unrated.id, completion_date=date(2026, 6, 1), playtime_hours=0, rating=None, platform="PC"),
        CompletedGameEntry(game_id=older.id, completion_date=date(2025, 12, 31), playtime_hours=50, rating=4, platform="PlayStation 5"),
    ])

    later = add_game(db_session, "Later in queue")
    first = add_game(db_session, "First in queue", cover_url="https://example.com/first.jpg", external_ratings=[{"source": "Metacritic", "value": 79, "scale": 100, "count": None}])
    db_session.add_all([
        BacklogEntry(game_id=later.id, position=4),
        BacklogEntry(game_id=first.id, position=0, preferred_platform="PC", note="Najpierw ta"),
    ])
    db_session.commit()

    summary = build_dashboard_summary(db_session, today=date(2026, 7, 13))

    assert summary.games.backlog_count == 2
    assert summary.games.current_year.year == 2026
    assert summary.games.current_year.completed_games_count == 2
    assert summary.games.current_year.total_playtime_hours == 12.5
    assert summary.games.current_year.games_with_playtime_count == 1
    assert summary.games.current_year.average_rating == 9
    assert summary.games.current_year.rated_games_count == 1
    assert summary.games.current_year.top_platform == "PC"
    assert [item.month for item in summary.games.current_year.trend] == [2, 3, 4, 5, 6, 7]
    assert [item.title for item in summary.games.next_backlog_entries] == ["First in queue", "Later in queue"]
    assert summary.games.next_backlog_entries[0].note == "Najpierw ta"
    assert summary.games.next_backlog_entries[0].external_ratings[0].value == 79
    assert [item.title for item in summary.games.recent_completed_games][:2] == ["Current Game", "Unrated Game"]
    assert summary.games.recent_completed_games[0].external_ratings[0].value == 88


def test_dashboard_keeps_poe_as_a_compact_secondary_summary(db_session):
    league = PoeLeague(name="Test League", game_version="poe2", status="active")
    db_session.add(league)
    db_session.flush()
    db_session.add(PoeCharacter(name="TestChar", game_version="poe2", level=88, league_id=league.id, playtime_minutes=240))
    db_session.commit()

    summary = build_dashboard_summary(db_session, today=date(2026, 7, 13))

    assert summary.poe is not None
    assert summary.poe.character_count == 1
    assert summary.poe.playtime_by_version["poe2"] == 240
    assert summary.poe.latest_league.name == "Test League"
    assert summary.poe.latest_league.characters == 1
    assert summary.poe_error is None


def test_optional_poe_failure_does_not_block_game_dashboard(db_session, monkeypatch):
    game = add_game(db_session, "Still visible")
    db_session.add(CompletedGameEntry(game_id=game.id, completion_date=date(2026, 7, 10), playtime_hours=2.5, rating=8))
    db_session.commit()

    def fail_poe(_session):
        raise OperationalError("SELECT poe", {}, RuntimeError("temporary failure"))

    monkeypatch.setattr(dashboard_service, "_build_poe_summary", fail_poe)

    summary = build_dashboard_summary(db_session, today=date(2026, 7, 13))

    assert summary.games.current_year.completed_games_count == 1
    assert summary.games.recent_completed_games[0].title == "Still visible"
    assert summary.poe is None
    assert summary.poe_error == "Nie udało się pobrać skrótu Path of Exile. Dane gier są nadal dostępne."


def test_dashboard_endpoint_returns_compact_start_screen_payload(client, db_session):
    game = add_game(db_session, "Endpoint Game")
    db_session.add(CompletedGameEntry(game_id=game.id, completion_date=date(2026, 7, 10), playtime_hours=4, rating=None))
    db_session.commit()

    response = client.get("/api/dashboard/summary")

    assert response.status_code == 200
    payload = response.json()
    assert payload["games"]["current_year"]["year"] == 2026
    assert payload["games"]["current_year"]["average_rating"] is None
    assert payload["games"]["recent_completed_games"][0]["title"] == "Endpoint Game"
    assert "top_currency_drops" not in payload
    assert "recent_poe_characters" not in payload
