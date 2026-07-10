from datetime import date

import pytest
from sqlalchemy import func, select

from app.models import BacklogEntry, CompletedGameEntry, Game


def add_game(db_session, title: str, *, platforms: list[str] | None = None) -> Game:
    game = Game(
        title=title,
        genres=["RPG"],
        platforms=platforms or ["PC"],
        external_source="manual",
    )
    db_session.add(game)
    db_session.commit()
    return game


def test_create_completed_game_accepts_decimal_hours_and_defaults_to_today(client, db_session):
    game = add_game(db_session, "Decimal Game")

    response = client.post("/api/completed-games", json={"game_id": game.id, "playtime_hours": 25.5})

    assert response.status_code == 201
    assert response.json()["playtime_hours"] == 25.5
    assert response.json()["completion_date"] == date.today().isoformat()


def test_create_completed_game_rejects_negative_hours(client, db_session):
    game = add_game(db_session, "Invalid Game")

    response = client.post("/api/completed-games", json={"game_id": game.id, "playtime_hours": -0.5})

    assert response.status_code == 422
    assert db_session.scalar(select(func.count(CompletedGameEntry.id))) == 0


def test_years_are_counted_sorted_and_year_query_only_returns_requested_year(client, db_session):
    game_2024 = add_game(db_session, "Older")
    game_2026_a = add_game(db_session, "Newest A")
    game_2026_b = add_game(db_session, "Newest B")
    db_session.add_all(
        [
            CompletedGameEntry(game_id=game_2024.id, completion_date=date(2024, 6, 1), playtime_hours=10),
            CompletedGameEntry(game_id=game_2026_a.id, completion_date=date(2026, 7, 15), playtime_hours=12),
            CompletedGameEntry(game_id=game_2026_b.id, completion_date=date(2026, 1, 3), playtime_hours=8),
        ]
    )
    db_session.commit()

    years = client.get("/api/completed-games/years")
    entries = client.get("/api/completed-games", params={"year": 2026})

    assert years.status_code == 200
    assert years.json() == [
        {"year": 2026, "completed_games_count": 2},
        {"year": 2024, "completed_games_count": 1},
    ]
    assert [item["game"]["title"] for item in entries.json()] == ["Newest A", "Newest B"]
    assert all(item["completion_date"].startswith("2026-") for item in entries.json())


def test_custom_statistics_are_created_and_visible_in_details(client, db_session):
    game = add_game(db_session, "Stats Game")

    created = client.post(
        "/api/completed-games",
        json={
            "game_id": game.id,
            "completion_date": "2025-07-15",
            "playtime_hours": 12,
            "custom_statistics": [
                {"name": "Liczba śmierci", "value": "42", "value_type": "number"},
                {"name": "Tryb hardcore", "value": "false", "value_type": "boolean"},
            ],
        },
    )
    details = client.get(f"/api/completed-games/{created.json()['id']}")

    assert created.status_code == 201
    assert [item["name"] for item in details.json()["custom_statistics"]] == ["Liczba śmierci", "Tryb hardcore"]


def test_completing_backlog_entry_removes_it_only_after_success(client, db_session):
    game = add_game(db_session, "Backlog Game")
    backlog = BacklogEntry(game_id=game.id, position=0, preferred_platform="PC")
    db_session.add(backlog)
    db_session.commit()

    response = client.post(
        "/api/completed-games",
        json={
            "game_id": game.id,
            "backlog_entry_id": backlog.id,
            "completion_date": "2025-07-15",
            "playtime_hours": 30.25,
        },
    )

    assert response.status_code == 201
    assert db_session.get(BacklogEntry, backlog.id) is None
    assert response.json()["completion_date"] == "2025-07-15"


def test_completion_transaction_rolls_back_when_commit_fails(client, db_session, monkeypatch):
    game = add_game(db_session, "Rollback Game")
    backlog = BacklogEntry(game_id=game.id, position=0)
    db_session.add(backlog)
    db_session.commit()

    def fail_commit():
        raise RuntimeError("simulated database failure")

    monkeypatch.setattr(db_session, "commit", fail_commit)
    with pytest.raises(RuntimeError, match="simulated database failure"):
        client.post(
            "/api/completed-games",
            json={"game_id": game.id, "backlog_entry_id": backlog.id, "playtime_hours": 1},
        )

    assert db_session.get(BacklogEntry, backlog.id) is not None
    assert db_session.scalar(select(func.count(CompletedGameEntry.id))) == 0


def test_editing_completion_date_moves_entry_between_year_queries(client, db_session):
    game = add_game(db_session, "Move Game")
    created = client.post(
        "/api/completed-games",
        json={"game_id": game.id, "completion_date": "2025-12-31", "playtime_hours": 4},
    ).json()

    updated = client.patch(
        f"/api/completed-games/{created['id']}", json={"completion_date": "2026-01-01"}
    )

    assert updated.status_code == 200
    assert client.get("/api/completed-games", params={"year": 2025}).json() == []
    assert len(client.get("/api/completed-games", params={"year": 2026}).json()) == 1


def test_year_and_month_validation_and_empty_year(client):
    assert client.get("/api/completed-games", params={"year": 1800}).status_code == 422
    assert client.get("/api/completed-games", params={"year": 2026, "month": 13}).status_code == 422
    response = client.get("/api/completed-games", params={"year": 2026})
    assert response.status_code == 200
    assert response.json() == []
