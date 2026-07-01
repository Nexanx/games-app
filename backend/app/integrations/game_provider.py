from datetime import date

import httpx

from app.core.config import Settings
from app.schemas.games import GameSearchResult


class GameProviderConfigurationError(RuntimeError):
    pass


class GameProviderRequestError(RuntimeError):
    pass


class GameProvider:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def search(self, query: str) -> list[GameSearchResult]:
        normalized_query = query.strip()
        if not normalized_query:
            return []
        if not self.settings.rawg_api_key:
            raise GameProviderConfigurationError("RAWG_API_KEY is not configured.")
        return await self._search_rawg(normalized_query)

    async def _search_rawg(self, query: str) -> list[GameSearchResult]:
        params = {"key": self.settings.rawg_api_key, "search": query, "page_size": 10}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get("https://api.rawg.io/api/games", params=params)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise GameProviderRequestError("RAWG request failed.") from exc
        payload = response.json()
        results: list[GameSearchResult] = []
        for item in payload.get("results", []):
            results.append(
                GameSearchResult(
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
                    source="RAWG",
                )
            )
        return results

    @staticmethod
    def _parse_date(value: str | None) -> date | None:
        if not value:
            return None
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
