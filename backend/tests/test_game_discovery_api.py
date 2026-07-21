from datetime import date, datetime, timezone

from sqlalchemy import select

from app.api import games as games_api
from app.models import BacklogEntry, CompletedGameEntry, Game, GameRecommendationFeedback
from app.schemas.games import ExternalRating, GameSearchPage, GameSearchResult


def rawg_game(
    title: str,
    external_id: str,
    *,
    genres: list[str] | None = None,
    tags: list[str] | None = None,
) -> GameSearchResult:
    return GameSearchResult(
        title=title,
        cover_url="https://example.com/cover.jpg",
        release_date=date(2026, 9, 10),
        genres=genres or ["RPG"],
        platforms=["PC"],
        tags=tags if tags is not None else ["Story Rich"],
        external_id=external_id,
        external_source="RAWG",
        external_url=f"https://rawg.io/games/{external_id}",
        external_ratings=[ExternalRating(source="RAWG", value=4.5, scale=5, count=100)],
        external_ratings_updated_at=datetime(2026, 7, 21, tzinfo=timezone.utc),
        source="RAWG",
        platform_release_dates=[{"platform": "PC", "release_date": date(2026, 9, 10)}],
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
        results=[rawg_game("September RPG", "30")],
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
        {"platform": "PC", "release_date": "2026-09-10"}
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
