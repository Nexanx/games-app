from datetime import date

import httpx

from app.core.config import Settings
from app.schemas.games import GameSearchPage, GameSearchResult


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

    async def _search_rawg(self, query: str, *, page: int, page_size: int) -> GameSearchPage:
        params = {
            "key": self.settings.rawg_api_key,
            "search": query,
            "page": page,
            "page_size": page_size,
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get("https://api.rawg.io/api/games", params=params)
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPError as exc:
            raise GameProviderRequestError("RAWG request failed.") from exc
        except ValueError as exc:
            raise GameProviderRequestError("RAWG returned an invalid response.") from exc
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
        return GameSearchPage(
            results=results,
            page=page,
            page_size=page_size,
            has_next=bool(payload.get("next")),
        )

    @staticmethod
    def _parse_date(value: str | None) -> date | None:
        if not value:
            return None
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
