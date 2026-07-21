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

    async def discover(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        date_from: date | None = None,
        date_to: date | None = None,
        genres: list[str] | None = None,
        parent_platforms: list[int] | None = None,
        query: str | None = None,
        ordering: str = "-rating",
    ) -> GameSearchPage:
        """Fetch one filtered RAWG list page without issuing per-game requests."""

        if not self.settings.rawg_api_key:
            raise GameProviderConfigurationError("RAWG_API_KEY is not configured.")
        params: dict[str, object] = {
            "key": self.settings.rawg_api_key,
            "page": page,
            "page_size": page_size,
            "ordering": ordering,
        }
        if date_from is not None and date_to is not None:
            params["dates"] = f"{date_from.isoformat()},{date_to.isoformat()}"
        if genres:
            params["genres"] = ",".join(dict.fromkeys(genres))
        if parent_platforms:
            params["parent_platforms"] = ",".join(str(value) for value in dict.fromkeys(parent_platforms))
        if query and query.strip():
            params["search"] = query.strip()
            params["search_precise"] = True

        fetched_at = datetime.now(timezone.utc)
        payload = await self._request_rawg("https://api.rawg.io/api/games", params=params)
        return GameSearchPage(
            results=[self._map_result(item, fetched_at) for item in payload.get("results", [])],
            page=page,
            page_size=page_size,
            has_next=bool(payload.get("next")),
        )

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
        genres = [genre.get("name") for genre in self._object_list(item.get("genres")) if genre.get("name")]
        tags = [tag.get("name") for tag in self._object_list(item.get("tags")) if tag.get("name")]
        platform_names: list[str] = []
        platform_release_dates: list[dict[str, object]] = []
        for platform_entry in self._object_list(item.get("platforms")):
            platform = platform_entry.get("platform")
            if not isinstance(platform, dict) or not platform.get("name"):
                continue
            platform_name = str(platform["name"])
            platform_names.append(platform_name)
            platform_release_dates.append(
                {
                    "platform": platform_name,
                    "release_date": self._parse_date(platform_entry.get("released_at")),
                }
            )
        return GameSearchResult(
            title=item.get("name") or "Untitled",
            description=item.get("description_raw") or None,
            cover_url=item.get("background_image"),
            release_date=self._parse_date(item.get("released")),
            genres=genres,
            platforms=platform_names,
            tags=tags,
            external_id=str(item.get("id")) if item.get("id") is not None else None,
            external_source="RAWG",
            external_url=f"https://rawg.io/games/{item.get('slug')}" if item.get("slug") else None,
            external_ratings=external_ratings,
            external_ratings_updated_at=fetched_at,
            source="RAWG",
            release_date_tba=bool(item.get("tba")),
            platform_release_dates=platform_release_dates,
        )

    @staticmethod
    def _object_list(value: object) -> list[dict]:
        if not isinstance(value, list):
            return []
        return [item for item in value if isinstance(item, dict)]

    @staticmethod
    def _parse_date(value: object) -> date | None:
        if not isinstance(value, str) or not value:
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
