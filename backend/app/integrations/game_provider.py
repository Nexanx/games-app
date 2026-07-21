from datetime import date, datetime, timezone

import httpx

from app.core.config import Settings
from app.schemas.games import ExternalRating, GameSearchPage, GameSearchResult


class GameProviderConfigurationError(RuntimeError):
    pass


class GameProviderRequestError(RuntimeError):
    pass


class GameProvider:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def search(self, query: str, *, page: int = 1, page_size: int = 10) -> GameSearchPage:
        normalized_query = query.strip()
        if not normalized_query:
            return GameSearchPage(results=[], page=page, page_size=page_size, has_next=False)
        if not self.settings.rawg_api_key:
            raise GameProviderConfigurationError("RAWG_API_KEY is not configured.")
        return await self._search_rawg(normalized_query, page=page, page_size=page_size)

    async def get_game(self, external_id: str) -> GameSearchResult:
        normalized_id = external_id.strip()
        if not normalized_id:
            raise ValueError("RAWG game ID cannot be empty.")
        if not self.settings.rawg_api_key:
            raise GameProviderConfigurationError("RAWG_API_KEY is not configured.")
        payload = await self._request_rawg(
            f"https://api.rawg.io/api/games/{normalized_id}",
            params={"key": self.settings.rawg_api_key},
        )
        return self._map_result(payload, datetime.now(timezone.utc))

    async def _search_rawg(self, query: str, *, page: int, page_size: int) -> GameSearchPage:
        params = {
            "key": self.settings.rawg_api_key,
            "search": query,
            "page": page,
            "page_size": page_size,
        }
        fetched_at = datetime.now(timezone.utc)
        payload = await self._request_rawg("https://api.rawg.io/api/games", params=params)
        results = [self._map_result(item, fetched_at) for item in payload.get("results", [])]
        return GameSearchPage(
            results=results,
            page=page,
            page_size=page_size,
            has_next=bool(payload.get("next")),
        )

    async def _request_rawg(self, url: str, *, params: dict[str, object]) -> dict:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPError as exc:
            raise GameProviderRequestError("RAWG request failed.") from exc
        except ValueError as exc:
            raise GameProviderRequestError("RAWG returned an invalid response.") from exc
        if not isinstance(payload, dict):
            raise GameProviderRequestError("RAWG returned an invalid response.")
        return payload

    def _map_result(self, item: dict, fetched_at: datetime) -> GameSearchResult:
        external_ratings = self._external_ratings(item)
        return GameSearchResult(
            title=item.get("name") or "Untitled",
            description=None,
            cover_url=item.get("background_image"),
            release_date=self._parse_date(item.get("released")),
            genres=[genre.get("name") for genre in item.get("genres", []) if genre.get("name")],
            platforms=[
                platform.get("platform", {}).get("name")
                for platform in item.get("platforms", [])
                if platform.get("platform", {}).get("name")
            ],
            external_id=str(item.get("id")) if item.get("id") is not None else None,
            external_source="RAWG",
            external_url=f"https://rawg.io/games/{item.get('slug')}" if item.get("slug") else None,
            external_ratings=external_ratings,
            external_ratings_updated_at=fetched_at,
            source="RAWG",
        )

    @staticmethod
    def _parse_date(value: str | None) -> date | None:
        if not value:
            return None
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None

    @staticmethod
    def _external_ratings(item: dict) -> list[ExternalRating]:
        ratings: list[ExternalRating] = []
        rawg_value = GameProvider._positive_number(item.get("rating"))
        rawg_scale = GameProvider._positive_number(item.get("rating_top"))
        ratings_count = GameProvider._positive_integer(item.get("ratings_count"))
        if rawg_value is not None and rawg_scale is not None and rawg_value <= rawg_scale:
            ratings.append(ExternalRating(source="RAWG", value=rawg_value, scale=rawg_scale, count=ratings_count))

        metacritic = GameProvider._positive_number(item.get("metacritic"))
        if metacritic is not None and metacritic <= 100:
            ratings.append(ExternalRating(source="Metacritic", value=metacritic, scale=100))
        return ratings

    @staticmethod
    def _positive_number(value: object) -> float | None:
        try:
            parsed = float(value) if value is not None else 0
        except (TypeError, ValueError):
            return None
        return parsed if parsed > 0 else None

    @staticmethod
    def _positive_integer(value: object) -> int | None:
        try:
            parsed = int(value) if value is not None else 0
        except (TypeError, ValueError):
            return None
        return parsed if parsed > 0 else None
