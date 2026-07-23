from datetime import date, datetime, timezone

from sqlalchemy import select

from app.api import games as games_api
from app.models import (
    BacklogEntry,
    CompletedGameEntry,
    Game,
    GameDiscoveryPreferences,
    GameRecommendationFeedback,
    HiddenGameRelease,
)
from app.schemas.games import ExternalRating, GameSearchPage, GameSearchResult


def rawg_game(
    title: str,
    external_id: str,
    *,
    genres: list[str] | None = None,
    tags: list[str] | None = None,
    platforms: list[str] | None = None,
    rating: float = 4.5,
    release_date: date | None = date(2026, 9, 10),
) -> GameSearchResult:
    platform_values = platforms or ["PC"]
    return GameSearchResult(
        title=title,
        cover_url="https://example.com/cover.jpg",
        release_date=release_date,
        genres=genres or ["RPG"],
        platforms=platform_values,
        tags=tags if tags is not None else ["Story Rich"],
        external_id=external_id,
        external_source="RAWG",
        external_url=f"https://rawg.io/games/{external_id}",
        external_ratings=[ExternalRating(source="RAWG", value=rating, scale=5, count=100)],
        external_ratings_updated_at=datetime(2026, 7, 21, tzinfo=timezone.utc),
        source="RAWG",
        platform_release_dates=[
            {"platform": platform, "release_date": release_date}
            for platform in platform_values
        ],
    )


class FakeDiscoveryProvider:
    results = GameSearchPage(results=[], page=1, page_size=40, has_next=False)
    calls: list[dict[str, object]] = []

    def __init__(self, _settings):
        pass

    async def discover(self, **kwargs) -> GameSearchPage:
        type(self).calls.append(kwargs)
        return type(self).results

    async def get_game(self, external_id: str) -> GameSearchResult:
        return rawg_game("Details", external_id)


def add_completion(db_session, title: str, external_id: str, rating: float, *, genre: str = "RPG") -> None:
    game = Game(
        title=title,
        genres=[genre],
        platforms=["PC"],
        external_id=external_id,
        external_source="RAWG",
        external_ratings=[],
    )
    db_session.add(game)
    db_session.flush()
    db_session.add(
        CompletedGameEntry(
            game_id=game.id,
            completion_date=date(2026, 1, 1),
            playtime_hours=10,
            rating=rating,
            platform="PC",
        )
    )


def test_recommendations_use_rated_history_and_exclude_completed_backlog_and_duplicates(
    client, db_session, monkeypatch
):
    add_completion(db_session, "Completed A", "1", 9)
    add_completion(db_session, "Completed B", "2", 8)
    add_completion(db_session, "Completed C", "3", 10)
    backlog_game = Game(
        title="Queued",
        genres=["RPG"],
        platforms=["PC"],
        external_id="4",
        external_source="RAWG",
        external_ratings=[],
    )
    db_session.add(backlog_game)
    db_session.flush()
    db_session.add(BacklogEntry(game_id=backlog_game.id, position=0))
    db_session.commit()

    candidate = rawg_game("Fresh RPG", "5")
    FakeDiscoveryProvider.calls = []
    FakeDiscoveryProvider.results = GameSearchPage(
        results=[
            rawg_game("Completed A", "1"),
            rawg_game("Queued", "4"),
            candidate,
            candidate,
        ],
        page=1,
        page_size=40,
        has_next=False,
    )
    monkeypatch.setattr(games_api, "GameProvider", FakeDiscoveryProvider)

    response = client.get("/api/games/recommendations")

    assert response.status_code == 200
    payload = response.json()
    assert payload["personalized"] is True
    assert payload["notice"] is None
    assert [item["game"]["external_id"] for item in payload["results"]] == ["5"]
    assert payload["results"][0]["kind"] == "personalized"
    assert "RPG" in payload["results"][0]["reason"]
    assert FakeDiscoveryProvider.calls == [
        {
            "page_size": 40,
            "genres": ["role-playing-games-rpg"],
            "parent_platforms": [1],
            "ordering": "-rating",
        }
    ]


def test_recommendations_label_cold_start_results_as_popular(client, db_session, monkeypatch):
    add_completion(db_session, "Only rated game", "1", 9, genre="Action")
    db_session.commit()
    FakeDiscoveryProvider.calls = []
    FakeDiscoveryProvider.results = GameSearchPage(
        results=[rawg_game("Popular candidate", "20", genres=["Action"])],
        page=1,
        page_size=40,
        has_next=False,
    )
    monkeypatch.setattr(games_api, "GameProvider", FakeDiscoveryProvider)

    response = client.get("/api/games/recommendations")

    assert response.status_code == 200
    payload = response.json()
    assert payload["personalized"] is False
    assert payload["notice"] == "Dodaj i oceń więcej ukończonych gier, aby otrzymać lepiej dopasowane rekomendacje."
    assert payload["results"][0]["kind"] == "popular"
    assert "Popularna" in payload["results"][0]["reason"]
    assert FakeDiscoveryProvider.calls[0]["ordering"] == "-added"


def test_recommendation_feedback_is_persistent_and_reranks_similar_games(
    client, db_session, monkeypatch
):
    add_completion(db_session, "Completed A", "1", 9)
    add_completion(db_session, "Completed B", "2", 8)
    add_completion(db_session, "Completed C", "3", 10)
    db_session.commit()

    liked = rawg_game("Fantasy match", "40", tags=["Fantasy", "Story Rich"])
    disliked = rawg_game("Space mismatch", "41", tags=["Space", "Sci-fi"])
    positive_response = client.put(
        "/api/games/recommendations/feedback",
        json={"game": liked.model_dump(mode="json"), "verdict": "positive"},
    )
    negative_response = client.put(
        "/api/games/recommendations/feedback",
        json={"game": disliked.model_dump(mode="json"), "verdict": "negative"},
    )

    FakeDiscoveryProvider.results = GameSearchPage(
        results=[
            liked,
            disliked,
            rawg_game("Another space game", "42", tags=["Space", "Sci-fi"]),
            rawg_game("Another fantasy game", "43", tags=["Fantasy", "Story Rich"]),
        ],
        page=1,
        page_size=40,
        has_next=False,
    )
    monkeypatch.setattr(games_api, "GameProvider", FakeDiscoveryProvider)
    recommendations = client.get("/api/games/recommendations")

    assert positive_response.status_code == 200
    assert negative_response.status_code == 200
    assert recommendations.status_code == 200
    payload = recommendations.json()
    assert [item["game"]["external_id"] for item in payload["results"]] == ["43"]
    assert "Fantasy" in payload["results"][0]["reason"]
    assert db_session.scalar(select(GameRecommendationFeedback).where(
        GameRecommendationFeedback.external_id == "40"
    )).verdict == "positive"
    assert len(db_session.scalars(select(GameRecommendationFeedback)).all()) == 2


def test_recommendation_feedback_upserts_the_same_external_game(client, db_session):
    candidate = rawg_game("Change my mind", "50", tags=["Co-op"])
    first = client.put(
        "/api/games/recommendations/feedback",
        json={"game": candidate.model_dump(mode="json"), "verdict": "negative"},
    )
    second = client.put(
        "/api/games/recommendations/feedback",
        json={"game": candidate.model_dump(mode="json"), "verdict": "positive"},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    feedback = db_session.scalar(select(GameRecommendationFeedback))
    assert feedback.verdict == "positive"
    assert len(db_session.scalars(select(GameRecommendationFeedback)).all()) == 1

    deleted = client.delete(
        "/api/games/recommendations/feedback",
        params={"external_source": "RAWG", "external_id": "50"},
    )

    assert deleted.status_code == 204
    assert len(db_session.scalars(select(GameRecommendationFeedback)).all()) == 0


def test_releases_forward_validated_rawg_filters(client, monkeypatch):
    FakeDiscoveryProvider.calls = []
    FakeDiscoveryProvider.results = GameSearchPage(
        results=[rawg_game("September RPG", "30", platforms=["PlayStation 5"])],
        page=2,
        page_size=20,
        has_next=True,
    )
    monkeypatch.setattr(games_api, "GameProvider", FakeDiscoveryProvider)

    response = client.get(
        "/api/games/releases",
        params={
            "date_from": "2026-09-01",
            "date_to": "2026-09-30",
            "platform": "PlayStation",
            "genre": "RPG",
            "search": "final",
            "page": 2,
        },
    )

    assert response.status_code == 200
    assert response.json()["results"][0]["platform_release_dates"] == [
        {"platform": "PlayStation 5", "release_date": "2026-09-10"}
    ]
    assert FakeDiscoveryProvider.calls == [
        {
            "page": 2,
            "page_size": 20,
            "date_from": date(2026, 9, 1),
            "date_to": date(2026, 9, 30),
            "genres": ["role-playing-games-rpg"],
            "parent_platforms": [2],
            "query": "final",
            "ordering": "released",
        }
    ]


def test_releases_reject_invalid_or_excessive_ranges(client):
    reversed_response = client.get(
        "/api/games/releases",
        params={"date_from": "2026-10-01", "date_to": "2026-09-01"},
    )
    excessive_response = client.get(
        "/api/games/releases",
        params={"date_from": "2026-01-01", "date_to": "2027-01-03"},
    )

    assert reversed_response.status_code == 422
    assert excessive_response.status_code == 422


def test_release_game_can_be_added_without_creating_a_duplicate(client, db_session, monkeypatch):
    monkeypatch.setattr(games_api, "GameProvider", FakeDiscoveryProvider)
    detail = client.get("/api/games/rawg/55")
    first = client.post("/api/backlog/batch", json={"games": [detail.json()]})
    second = client.post("/api/backlog/batch", json={"games": [detail.json()]})

    assert detail.status_code == 200
    assert first.status_code == 201
    assert second.status_code == 200
    assert len(second.json()["already_exists"]) == 1
    assert len(db_session.scalars(select(BacklogEntry)).all()) == 1


def test_recommended_releases_rank_preferences_and_exclude_owned_hidden_and_unsupported(
    client, db_session, monkeypatch
):
    add_completion(db_session, "Rated RPG A", "101", 10)
    add_completion(db_session, "Rated RPG B", "102", 9)
    add_completion(db_session, "Rated RPG C", "103", 9)
    add_completion(db_session, "Already completed", "104", 8)
    backlog_game = Game(
        title="Already queued",
        genres=["RPG"],
        platforms=["PC"],
        external_id="105",
        external_source="RAWG",
        external_ratings=[],
    )
    db_session.add(backlog_game)
    db_session.flush()
    db_session.add(BacklogEntry(game_id=backlog_game.id, position=0))
    db_session.commit()

    hidden_game = rawg_game("Hidden release", "106")
    assert client.put(
        "/api/games/releases/hidden",
        json={"game": hidden_game.model_dump(mode="json")},
    ).status_code == 204

    preferred = rawg_game("Preferred RPG", "201")
    novelty = rawg_game("Action discovery", "202", genres=["Action"])
    FakeDiscoveryProvider.calls = []
    FakeDiscoveryProvider.results = GameSearchPage(
        results=[
            novelty,
            rawg_game("Console only", "203", platforms=["PlayStation 5"]),
            rawg_game("Already completed", "104"),
            rawg_game("Already queued", "105"),
            hidden_game,
            preferred,
            preferred,
        ],
        page=1,
        page_size=40,
        has_next=False,
    )
    monkeypatch.setattr(games_api, "GameProvider", FakeDiscoveryProvider)

    response = client.get(
        "/api/games/releases/recommended",
        params={
            "date_from": "2026-09-01",
            "date_to": "2026-09-30",
            "match_level": "discovery",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    ids = [item["game"]["external_id"] for item in payload["results"]]
    assert ids[0] == "201"
    assert "202" in ids
    assert not {"104", "105", "106", "203"} & set(ids)
    assert len(ids) == len(set(ids))
    assert "RPG" in payload["results"][0]["reasons"][0]
    assert payload["results"][0]["score"] > payload["results"][1]["score"]
    assert len(FakeDiscoveryProvider.calls) == 1


def test_release_match_levels_share_scoring_and_only_discovery_adds_novelty(
    client, db_session, monkeypatch
):
    add_completion(db_session, "Rated RPG A", "301", 9)
    add_completion(db_session, "Rated RPG B", "302", 9)
    add_completion(db_session, "Rated RPG C", "303", 9)
    db_session.commit()
    FakeDiscoveryProvider.results = GameSearchPage(
        results=[
            rawg_game("Strong RPG", "304"),
            rawg_game("Novel action", "305", genres=["Action"]),
        ],
        page=1,
        page_size=40,
        has_next=False,
    )
    monkeypatch.setattr(games_api, "GameProvider", FakeDiscoveryProvider)

    def ids_for(level: str) -> list[str]:
        response = client.get(
            "/api/games/releases/recommended",
            params={
                "date_from": "2026-09-01",
                "date_to": "2026-09-30",
                "match_level": level,
            },
        )
        assert response.status_code == 200
        return [item["game"]["external_id"] for item in response.json()["results"]]

    assert ids_for("strict") == ["304"]
    assert ids_for("balanced") == ["304"]
    assert ids_for("discovery") == ["304", "305"]


def test_release_preferences_cold_start_filters_and_pagination(
    client, monkeypatch
):
    preferences = client.put(
        "/api/games/releases/preferences",
        json={"platforms": ["PC"], "genres": []},
    )
    assert preferences.status_code == 200

    FakeDiscoveryProvider.calls = []
    FakeDiscoveryProvider.results = GameSearchPage(
        results=[
            rawg_game("Good PC release", "401", rating=4.5),
            rawg_game("Low rated PC release", "402", rating=3.0),
            rawg_game("Wrong genre", "403", genres=["Action"]),
        ],
        page=1,
        page_size=40,
        has_next=True,
    )
    monkeypatch.setattr(games_api, "GameProvider", FakeDiscoveryProvider)

    response = client.get(
        "/api/games/releases/recommended",
        params={
            "date_from": "2026-09-01",
            "date_to": "2026-09-30",
            "platform": "PC",
            "genre": "RPG",
            "minimum_rating": 80,
            "release_status": "upcoming",
            "page": 2,
            "page_size": 1,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["page"] == 2
    assert payload["personalized"] is False
    assert payload["notice"] == "Dodaj i oceń więcej ukończonych gier, aby premiery były lepiej dopasowane."
    assert [item["game"]["external_id"] for item in payload["results"]] == ["401"]
    assert payload["results"][0]["match_label"] == "Może Cię zainteresować"
    assert FakeDiscoveryProvider.calls == [
        {
            "page": 2,
            "page_size": 40,
            "date_from": date(2026, 9, 1),
            "date_to": date(2026, 9, 30),
            "genres": ["role-playing-games-rpg"],
            "parent_platforms": [1],
            "query": None,
            "ordering": "-rating",
        }
    ]


def test_hidden_release_is_persistent_filterable_and_can_be_restored(client, db_session):
    hidden = rawg_game("Hidden RPG", "501")
    saved = client.put(
        "/api/games/releases/hidden",
        json={"game": hidden.model_dump(mode="json")},
    )
    visible = client.get(
        "/api/games/releases/hidden",
        params={
            "date_from": "2026-09-01",
            "date_to": "2026-09-30",
            "platform": "PC",
            "genre": "RPG",
            "page_size": 1,
        },
    )
    filtered_out = client.get(
        "/api/games/releases/hidden",
        params={
            "date_from": "2026-09-01",
            "date_to": "2026-09-30",
            "genre": "Action",
        },
    )
    restored = client.delete(
        "/api/games/releases/hidden",
        params={"external_source": "RAWG", "external_id": "501"},
    )

    assert saved.status_code == 204
    assert visible.status_code == 200
    assert visible.json()["results"][0]["external_id"] == "501"
    assert visible.json()["results"][0]["hidden"] is True
    assert filtered_out.json()["results"] == []
    assert restored.status_code == 204
    assert db_session.scalar(select(HiddenGameRelease)) is None


def test_recommended_releases_update_after_backlog_add_and_avoid_rawg_n_plus_one(
    client, db_session, monkeypatch
):
    add_completion(db_session, "Rated RPG A", "601", 9)
    add_completion(db_session, "Rated RPG B", "602", 9)
    add_completion(db_session, "Rated RPG C", "603", 9)
    db_session.commit()
    candidate = rawg_game("Queue next", "604")
    FakeDiscoveryProvider.calls = []
    FakeDiscoveryProvider.results = GameSearchPage(
        results=[candidate],
        page=1,
        page_size=40,
        has_next=False,
    )
    monkeypatch.setattr(games_api, "GameProvider", FakeDiscoveryProvider)
    params = {"date_from": "2026-09-01", "date_to": "2026-09-30"}

    before = client.get("/api/games/releases/recommended", params=params)
    added = client.post(
        "/api/backlog/batch",
        json={"games": [candidate.model_dump(mode="json")]},
    )
    after = client.get("/api/games/releases/recommended", params=params)

    assert [item["game"]["external_id"] for item in before.json()["results"]] == ["604"]
    assert added.status_code == 201
    assert after.json()["results"] == []
    assert len(FakeDiscoveryProvider.calls) == 2


def test_recommended_releases_rank_repeatedly_low_rated_genres_lower(
    client, db_session, monkeypatch
):
    add_completion(db_session, "Loved RPG A", "701", 9)
    add_completion(db_session, "Loved RPG B", "702", 9)
    add_completion(db_session, "Loved RPG C", "703", 9)
    add_completion(db_session, "Disliked shooter A", "704", 3, genre="Shooter")
    add_completion(db_session, "Disliked shooter B", "705", 4, genre="Shooter")
    db_session.commit()
    FakeDiscoveryProvider.results = GameSearchPage(
        results=[
            rawg_game("Matching RPG", "706"),
            rawg_game("Repeatedly disliked genre", "707", genres=["Shooter"]),
        ],
        page=1,
        page_size=40,
        has_next=False,
    )
    monkeypatch.setattr(games_api, "GameProvider", FakeDiscoveryProvider)

    response = client.get(
        "/api/games/releases/recommended",
        params={
            "date_from": "2026-09-01",
            "date_to": "2026-09-30",
            "match_level": "discovery",
        },
    )

    assert response.status_code == 200
    results = response.json()["results"]
    assert [item["game"]["external_id"] for item in results] == ["706", "707"]
    assert results[0]["score"] > results[1]["score"]


def test_balanced_release_results_limit_one_dominant_genre(
    client, db_session, monkeypatch
):
    for index in range(3):
        add_completion(db_session, f"RPG history {index}", f"80{index}", 9, genre="RPG")
        add_completion(db_session, f"Adventure history {index}", f"81{index}", 9, genre="Adventure")
    db_session.commit()
    candidates = [
        rawg_game(f"A RPG {index}", f"82{index}", genres=["RPG"])
        for index in range(6)
    ] + [
        rawg_game(f"Z Adventure {index}", f"83{index}", genres=["Adventure"])
        for index in range(3)
    ]
    FakeDiscoveryProvider.results = GameSearchPage(
        results=candidates,
        page=1,
        page_size=40,
        has_next=False,
    )
    monkeypatch.setattr(games_api, "GameProvider", FakeDiscoveryProvider)

    response = client.get(
        "/api/games/releases/recommended",
        params={
            "date_from": "2026-09-01",
            "date_to": "2026-09-30",
            "match_level": "balanced",
            "page_size": 6,
        },
    )

    assert response.status_code == 200
    genres = [item["game"]["genres"][0] for item in response.json()["results"]]
    assert len(genres) == 6
    assert genres.count("RPG") == 3
    assert genres.count("Adventure") == 3
