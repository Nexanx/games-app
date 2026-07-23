import pytest

from app.core.config import Settings
from app.integrations import game_provider
from app.integrations.game_provider import GameProvider, GameProviderConfigurationError


@pytest.mark.anyio
async def test_game_provider_requires_rawg_key():
    provider = GameProvider(Settings(rawg_api_key=None))

    with pytest.raises(GameProviderConfigurationError):
        await provider.search("Hades")


@pytest.mark.anyio
async def test_game_provider_forwards_pagination_and_maps_response(monkeypatch):
    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "next": "https://api.rawg.io/api/games?page=4",
                "results": [
                    {
                        "id": 123,
                        "name": "Hades",
                        "background_image": "https://example.com/hades.jpg",
                        "released": "2020-09-17",
                        "genres": [{"name": "Action"}],
                        "tags": [{"name": "Story Rich"}, {"name": "Roguelike"}],
                        "platforms": [{"platform": {"name": "PC"}, "released_at": "2020-09-17"}],
                        "slug": "hades",
                        "rating": 4.4,
                        "rating_top": 5,
                        "ratings_count": 123,
                        "metacritic": 83,
                    }
                ],
            }

    class FakeAsyncClient:
        def __init__(self, *, timeout):
            captured["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url, *, params):
            captured["url"] = url
            captured["params"] = params
            return FakeResponse()

    monkeypatch.setattr(game_provider.httpx, "AsyncClient", FakeAsyncClient)
    provider = GameProvider(Settings(rawg_api_key="test-key"))

    result = await provider.search("Hades", page=3, page_size=15)

    assert captured["params"] == {"key": "test-key", "search": "Hades", "page": 3, "page_size": 15}
    assert result.page == 3
    assert result.page_size == 15
    assert result.has_next is True
    assert result.results[0].external_id == "123"
    assert result.results[0].tags == ["Story Rich", "Roguelike"]
    assert result.results[0].platform_release_dates[0].model_dump(mode="json") == {
        "platform": "PC",
        "release_date": "2020-09-17",
    }
    assert [rating.model_dump() for rating in result.results[0].external_ratings] == [
        {"source": "RAWG", "value": 4.4, "scale": 5.0, "count": 123},
        {"source": "Metacritic", "value": 83.0, "scale": 100.0, "count": None},
    ]
    assert result.results[0].external_ratings_updated_at is not None


@pytest.mark.anyio
async def test_game_provider_fetches_single_game_by_rawg_id(monkeypatch):
    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "id": 123,
                "name": "Hades",
                "slug": "hades",
                "rating": 4.4,
                "rating_top": 5,
                "ratings_count": 123,
                "metacritic": 83,
            }

    class FakeAsyncClient:
        def __init__(self, *, timeout):
            captured["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url, *, params):
            captured["url"] = url
            captured["params"] = params
            return FakeResponse()

    monkeypatch.setattr(game_provider.httpx, "AsyncClient", FakeAsyncClient)

    result = await GameProvider(Settings(rawg_api_key="test-key")).get_game("123")

    assert captured["url"] == "https://api.rawg.io/api/games/123"
    assert captured["params"] == {"key": "test-key"}
    assert result.external_id == "123"
    assert result.external_ratings[1].model_dump() == {
        "source": "Metacritic",
        "value": 83.0,
        "scale": 100.0,
        "count": None,
    }


def test_game_provider_treats_zero_and_invalid_scores_as_missing():
    assert GameProvider._external_ratings({"rating": 0, "rating_top": 5, "ratings_count": 0, "metacritic": 0}) == []
    assert GameProvider._external_ratings({"rating": 8, "rating_top": 5, "metacritic": 120}) == []


@pytest.mark.anyio
async def test_game_provider_discovers_games_with_server_side_filters(monkeypatch):
    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "next": None,
                "results": [
                    {
                        "id": 999,
                        "name": "Incomplete release",
                        "genres": None,
                        "tags": None,
                        "platforms": None,
                    }
                ],
            }

    class FakeAsyncClient:
        def __init__(self, *, timeout):
            captured["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url, *, params):
            captured["calls"] = int(captured.get("calls", 0)) + 1
            captured["url"] = url
            captured["params"] = params
            return FakeResponse()

    monkeypatch.setattr(game_provider.httpx, "AsyncClient", FakeAsyncClient)
    game_provider.clear_discovery_cache()
    provider = GameProvider(Settings(rawg_api_key="test-key"))

    result = await provider.discover(
        page=2,
        page_size=20,
        date_from=game_provider.date(2026, 8, 1),
        date_to=game_provider.date(2026, 8, 31),
        genres=["role-playing-games-rpg"],
        parent_platforms=[1, 2],
        query="witcher",
        ordering="released",
    )
    cached_result = await provider.discover(
        page=2,
        page_size=20,
        date_from=game_provider.date(2026, 8, 1),
        date_to=game_provider.date(2026, 8, 31),
        genres=["role-playing-games-rpg"],
        parent_platforms=[1, 2],
        query="witcher",
        ordering="released",
    )

    assert captured["url"] == "https://api.rawg.io/api/games"
    assert captured["params"] == {
        "key": "test-key",
        "page": 2,
        "page_size": 20,
        "ordering": "released",
        "dates": "2026-08-01,2026-08-31",
        "genres": "role-playing-games-rpg",
        "parent_platforms": "1,2",
        "search": "witcher",
        "search_precise": True,
    }
    assert len(result.results) == 1
    assert len(cached_result.results) == 1
    assert captured["calls"] == 1
    assert result.results[0].title == "Incomplete release"
    assert result.results[0].genres == []
    assert result.results[0].platforms == []
    assert result.results[0].tags == []
    assert result.results[0].platform_release_dates == []

