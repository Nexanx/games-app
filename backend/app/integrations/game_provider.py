from datetime import date
from typing import Any

import httpx

from app.core.config import Settings
from app.schemas.games import GameSearchResult


MOCK_GAMES: list[dict[str, Any]] = [
    {
        "title": "Hades",
        "description": "Roguelike action game with fast runs, permanent upgrades and a sharp mythological style.",
        "cover_url": "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80",
        "release_date": date(2020, 9, 17),
        "genres": ["Action", "Roguelike"],
        "platforms": ["PC", "Switch", "PlayStation", "Xbox"],
        "external_id": "mock-hades",
        "external_source": "mock",
        "external_url": "https://www.supergiantgames.com/games/hades/",
        "source": "mock",
    },
    {
        "title": "Disco Elysium",
        "description": "Narrative RPG focused on investigation, inner voices and character choices.",
        "cover_url": "https://images.unsplash.com/photo-1520690214124-2405c5217036?auto=format&fit=crop&w=800&q=80",
        "release_date": date(2019, 10, 15),
        "genres": ["RPG", "Narrative"],
        "platforms": ["PC", "PlayStation", "Xbox", "Switch"],
        "external_id": "mock-disco-elysium",
        "external_source": "mock",
        "external_url": "https://discoelysium.com/",
        "source": "mock",
    },
    {
        "title": "Elden Ring",
        "description": "Open-world action RPG about exploration, bosses and flexible builds.",
        "cover_url": "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80",
        "release_date": date(2022, 2, 25),
        "genres": ["Action RPG", "Soulslike"],
        "platforms": ["PC", "PlayStation", "Xbox"],
        "external_id": "mock-elden-ring",
        "external_source": "mock",
        "external_url": "https://en.bandainamcoent.eu/elden-ring/elden-ring",
        "source": "mock",
    },
]


class GameProvider:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def search(self, query: str) -> list[GameSearchResult]:
        normalized_query = query.strip()
        if not normalized_query:
            return []
        if self.settings.rawg_api_key:
            try:
                return await self._search_rawg(normalized_query)
            except httpx.HTTPError:
                return self._search_mock(normalized_query)
        return self._search_mock(normalized_query)

    async def _search_rawg(self, query: str) -> list[GameSearchResult]:
        params = {"key": self.settings.rawg_api_key, "search": query, "page_size": 10}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get("https://api.rawg.io/api/games", params=params)
            response.raise_for_status()
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
        return results or self._search_mock(query)

    def _search_mock(self, query: str) -> list[GameSearchResult]:
        query_lower = query.lower()
        matches = [item for item in MOCK_GAMES if query_lower in item["title"].lower()]
        if not matches:
            matches = MOCK_GAMES[:]
        return [GameSearchResult(**item) for item in matches[:10]]

    @staticmethod
    def _parse_date(value: str | None) -> date | None:
        if not value:
            return None
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None

