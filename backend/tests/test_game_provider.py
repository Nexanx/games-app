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
                        "platforms": [{"platform": {"name": "PC"}}],
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

