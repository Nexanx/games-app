from datetime import date

import pytest
from sqlalchemy import func, select

from app.models import BacklogEntry, CompletedGameEntry, Game


def add_game(
    db_session,
    title: str,
    *,
    platforms: list[str] | None = None,
    genres: list[str] | None = None,
) -> Game:
    game = Game(
        title=title,
        genres=genres or ["RPG"],
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


def test_year_dashboard_returns_aggregates_months_and_filter_options(client, db_session):
    rpg = add_game(db_session, "RPG Game", platforms=["PC"])
    action = add_game(db_session, "Action Game", platforms=["PlayStation 5"])
    db_session.add_all(
        [
            CompletedGameEntry(
                game_id=rpg.id,
                completion_date=date(2026, 7, 20),
                playtime_hours=20,
                rating=9,
                platform="PC",
            ),
            CompletedGameEntry(
                game_id=action.id,
                completion_date=date(2026, 6, 5),
                playtime_hours=40,
                rating=7,
                platform="PlayStation 5",
            ),
        ]
    )
    db_session.commit()

    response = client.get("/api/completed-games/year/2026/dashboard")

    assert response.status_code == 200
    payload = response.json()
    assert payload["completed_games_count"] == 2
    assert payload["total_playtime_hours"] == 60
    assert payload["average_playtime_hours"] == 30
    assert payload["average_rating"] == 8
    assert payload["best_rated_game"]["title"] == "RPG Game"
    assert payload["longest_game"]["title"] == "Action Game"
    assert payload["active_months_count"] == 2
    assert [item["month"] for item in payload["monthly"]] == list(range(1, 13))
    assert payload["monthly"][5]["completed_games_count"] == 1
    assert payload["monthly"][6]["completed_games_count"] == 1
    assert payload["filter_options"]["platforms"] == ["PC", "PlayStation 5"]
    assert payload["filter_options"]["genres"] == ["RPG"]


def test_completed_games_filters_can_be_combined_and_comparison_keeps_empty_months(client, db_session):
    pc_rpg = add_game(db_session, "PC RPG", platforms=["PC"])
    console_rpg = add_game(db_session, "Console RPG", platforms=["PlayStation 5"])
    older = add_game(db_session, "Older RPG", platforms=["PC"])
    db_session.add_all(
        [
            CompletedGameEntry(
                game_id=pc_rpg.id,
                completion_date=date(2026, 5, 20),
                playtime_hours=10,
                rating=9,
                platform="PC",
            ),
            CompletedGameEntry(
                game_id=console_rpg.id,
                completion_date=date(2026, 4, 20),
                playtime_hours=8,
                rating=6,
                platform="PlayStation 5",
            ),
            CompletedGameEntry(
                game_id=older.id,
                completion_date=date(2025, 1, 1),
                playtime_hours=12,
                rating=8,
                platform="PC",
            ),
        ]
    )
    db_session.commit()

    filtered = client.get(
        "/api/completed-games",
        params=[("year", "2026"), ("platform", "pc"), ("genre", "rpg"), ("rating_min", "8")],
    )
    comparison = client.get("/api/completed-games/comparison", params={"years": "2025,2026"})

    assert filtered.status_code == 200
    assert [item["game"]["title"] for item in filtered.json()] == ["PC RPG"]
    assert comparison.status_code == 200
    years = comparison.json()["years"]
    assert [item["year"] for item in years] == [2026, 2025]
    assert len(years[0]["monthly"]) == 12
    assert years[0]["monthly"][4]["completed_games_count"] == 1


def test_empty_year_dashboard_uses_clear_empty_values(client):
    response = client.get("/api/completed-games/year/2026/dashboard")

    assert response.status_code == 200
    payload = response.json()
    assert payload["year"] == 2026
    assert payload["completed_games_count"] == 0
    assert payload["average_playtime_hours"] is None
    assert payload["average_rating"] is None
    assert payload["best_rated_game"] is None
    assert payload["most_active_month"] is None
    assert len(payload["monthly"]) == 12
    assert all(item["completed_games_count"] == 0 for item in payload["monthly"])
    assert all(item["average_playtime_hours"] is None for item in payload["monthly"])
    assert payload["platforms"] == []
    assert payload["genres"] == []
    assert payload["scatter_games"] == []
    assert payload["filter_options"] == {"platforms": [], "genres": []}


def test_dashboard_ignores_missing_ratings_and_zero_time_in_averages(client, db_session):
    timed = add_game(db_session, "Timed")
    missing = add_game(db_session, "Missing values")
    db_session.add_all(
        [
            CompletedGameEntry(game_id=timed.id, completion_date=date(2026, 2, 1), playtime_hours=12.5, rating=8.5, platform="PC"),
            CompletedGameEntry(game_id=missing.id, completion_date=date(2026, 2, 2), playtime_hours=0, rating=None),
        ]
    )
    db_session.commit()

    payload = client.get("/api/completed-games/year/2026/dashboard").json()

    assert payload["completed_games_count"] == 2
    assert payload["total_playtime_hours"] == 12.5
    assert payload["average_playtime_hours"] == 12.5
    assert payload["games_with_playtime_count"] == 1
    assert payload["average_rating"] == 8.5
    assert payload["rated_games_count"] == 1
    assert payload["longest_game"]["title"] == "Timed"
    assert payload["shortest_game"]["title"] == "Timed"


def test_dashboard_counts_each_genre_and_uses_completion_platform(client, db_session):
    multi = add_game(db_session, "Multi", platforms=["PC", "PlayStation 5"], genres=["RPG", "Akcja"])
    db_session.add(CompletedGameEntry(game_id=multi.id, completion_date=date(2026, 3, 1), playtime_hours=10, rating=9, platform="PlayStation 5"))
    db_session.commit()

    payload = client.get("/api/completed-games/year/2026/dashboard").json()
    filtered_pc = client.get("/api/completed-games/year/2026/dashboard", params={"platform": "PC"}).json()

    assert [
        (item["label"], item["completed_games_count"], item["percentage"])
        for item in payload["genres"]
    ] == [("Akcja", 1, 100.0), ("RPG", 1, 100.0)]
    assert payload["platforms"] == [{"label": "PlayStation 5", "completed_games_count": 1, "percentage": 100.0, "total_playtime_hours": 10.0, "average_rating": 9.0}]
    assert filtered_pc["completed_games_count"] == 0
    assert payload["filter_options"]["platforms"] == ["PlayStation 5"]


def test_dashboard_filters_apply_to_all_aggregates_and_keep_year_options(client, db_session):
    pc = add_game(db_session, "PC RPG", genres=["RPG"])
    console = add_game(db_session, "Console Action", genres=["Akcja"])
    db_session.add_all([
        CompletedGameEntry(game_id=pc.id, completion_date=date(2026, 5, 1), playtime_hours=20, rating=9, platform="PC"),
        CompletedGameEntry(game_id=console.id, completion_date=date(2026, 6, 1), playtime_hours=5, rating=6, platform="PlayStation 5"),
    ])
    db_session.commit()

    payload = client.get("/api/completed-games/year/2026/dashboard", params={"month": 5, "genre": "rpg", "rating_min": 8}).json()

    assert payload["completed_games_count"] == 1
    assert payload["total_playtime_hours"] == 20
    assert payload["best_rated_games"][0]["title"] == "PC RPG"
    assert payload["monthly"][4]["completed_games_count"] == 1
    assert sum(item["completed_games_count"] for item in payload["monthly"]) == 1
    assert payload["filter_options"] == {"platforms": ["PC", "PlayStation 5"], "genres": ["Akcja", "RPG"]}
