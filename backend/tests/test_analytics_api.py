from datetime import date

from app.models import CompletedGameEntry, Game


def add_completion(
    db_session,
    title: str,
    completion_date: date,
    *,
    playtime: float = 0,
    rating: float | None = None,
    platform: str | None = "PC",
    genres: list[str] | None = None,
) -> CompletedGameEntry:
    game = Game(title=title, genres=genres or ["RPG"], platforms=[platform] if platform else [], external_source="manual")
    db_session.add(game)
    db_session.flush()
    entry = CompletedGameEntry(game_id=game.id, completion_date=completion_date, playtime_hours=playtime, rating=rating, platform=platform)
    db_session.add(entry)
    db_session.commit()
    return entry


def test_year_report_calculates_medians_events_months_and_safe_year_changes(client, db_session):
    add_completion(db_session, "Previous without time", date(2025, 2, 1), playtime=0)
    add_completion(db_session, "First", date(2026, 1, 2), playtime=10, rating=7, genres=["RPG", "Akcja"])
    add_completion(db_session, "Middle", date(2026, 2, 2), playtime=20, rating=None, platform="PlayStation 5", genres=["Akcja"])
    add_completion(db_session, "Last", date(2026, 3, 2), playtime=30, rating=9, genres=["Strategia"])

    response = client.get("/api/completed-games/year/2026/report")

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["average_playtime_hours"] == 20
    assert payload["summary"]["median_playtime_hours"] == 20
    assert payload["summary"]["average_rating"] == 8
    assert payload["summary"]["median_rating"] == 8
    assert payload["summary"]["rated_games_count"] == 2
    assert payload["summary"]["unrated_games_count"] == 1
    assert payload["first_completion"]["title"] == "First"
    assert payload["last_completion"]["title"] == "Last"
    assert payload["longest_active_streak_months"] == 3
    assert payload["most_diverse_month"]["month"] == 1
    assert len(payload["monthly"]) == 12
    assert payload["monthly"][0]["best_rated_game"]["title"] == "First"
    total_time_change = next(item for item in payload["previous_year_differences"] if item["metric"] == "total_playtime_hours")
    assert total_time_change["absolute_change"] == 60
    assert total_time_change["percentage_change"] is None
    assert total_time_change["has_percentage_baseline"] is False


def test_activity_groups_multiple_games_per_day_and_supports_leap_day(client, db_session):
    add_completion(db_session, "Leap A", date(2024, 2, 29), playtime=5, rating=8)
    add_completion(db_session, "Leap B", date(2024, 2, 29), playtime=7, rating=None)

    response = client.get("/api/completed-games/year/2024/activity")

    assert response.status_code == 200
    assert response.json()["days"] == [{
        "date": "2024-02-29",
        "completed_games_count": 2,
        "total_playtime_hours": 12.0,
        "average_rating": 8.0,
        "games": response.json()["days"][0]["games"],
    }]
    assert [game["title"] for game in response.json()["days"][0]["games"]] == ["Leap A", "Leap B"]


def test_month_comparison_returns_metrics_games_and_zero_safe_differences(client, db_session):
    add_completion(db_session, "July", date(2026, 7, 10), playtime=12, rating=9, genres=["RPG", "Akcja"])

    response = client.get("/api/completed-games/month-comparison", params={"year": 2026, "month_a": 6, "month_b": 7})

    assert response.status_code == 200
    payload = response.json()
    assert payload["month_a"]["summary"]["completed_games_count"] == 0
    assert payload["month_b"]["summary"]["completed_games_count"] == 1
    assert payload["month_b"]["games"][0]["title"] == "July"
    games_change = next(item for item in payload["differences"] if item["metric"] == "completed_games_count")
    assert games_change["absolute_change"] == 1
    assert games_change["percentage_change"] is None
    assert games_change["has_percentage_baseline"] is False
    assert client.get("/api/completed-games/month-comparison", params={"year": 2026, "month_a": 7, "month_b": 7}).status_code == 422


def test_forecast_refuses_small_data_and_validates_parameters(client, db_session):
    add_completion(db_session, "Only one", date(2026, 1, 1), playtime=5)

    payload = client.get("/api/completed-games/forecast", params={"metric": "completed_games", "months_ahead": 6}).json()

    assert payload["sufficient_data"] is False
    assert "Za mało danych" in payload["reason"]
    assert payload["minimum_requirements"]
    assert client.get("/api/completed-games/forecast", params={"metric": "rating"}).status_code == 422
    assert client.get("/api/completed-games/forecast", params={"months_ahead": 13}).status_code == 422


def test_forecast_compares_simple_models_and_reports_validation_errors(client, db_session):
    for index in range(18):
        year = 2025 + index // 12
        month = index % 12 + 1
        add_completion(db_session, f"Game {index}", date(year, month, 10), playtime=10 + index)

    response = client.get("/api/completed-games/forecast", params={"metric": "completed_games", "months_ahead": 6})

    assert response.status_code == 200
    payload = response.json()
    assert payload["sufficient_data"] is True
    assert payload["model"] in {"Regresja liniowa", "Średnia ruchoma (3 miesiące)"}
    assert payload["mae"] is not None
    assert payload["rmse"] is not None
    assert payload["observations_count"] >= 12
    assert len(payload["forecast"]) == 6
