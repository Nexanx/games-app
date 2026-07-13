from dataclasses import dataclass
from datetime import date, datetime

import httpx

from app.core.config import Settings


class PoeLeagueProviderConfigurationError(RuntimeError):
    pass


class PoeLeagueProviderRequestError(RuntimeError):
    pass


@dataclass(frozen=True)
class PoeLeagueCandidate:
    name: str
    game_version: str
    start_date: date | None
    end_date: date | None
    status: str
    notes: str | None = None


class PoeLeagueProvider:
    api_url = "https://api.pathofexile.com/league"

    def __init__(self, settings: Settings):
        self.settings = settings

    async def fetch(self, game_version: str | None = None) -> list[PoeLeagueCandidate]:
        if not self.settings.poe_api_token:
            raise PoeLeagueProviderConfigurationError("POE_API_TOKEN is not configured.")

        versions = [game_version] if game_version else ["poe1", "poe2"]
        leagues: list[PoeLeagueCandidate] = []
        async with httpx.AsyncClient(timeout=15) as client:
            for version in versions:
                realm = "poe2" if version == "poe2" else "pc"
                leagues.extend(await self._fetch_realm(client, realm, version))
        return leagues

    async def _fetch_realm(
        self, client: httpx.AsyncClient, realm: str, game_version: str
    ) -> list[PoeLeagueCandidate]:
        params = {"realm": realm, "type": "main", "limit": 50}
        headers = {
            "Authorization": f"Bearer {self.settings.poe_api_token}",
            "User-Agent": self.settings.app_name,
        }
        try:
            response = await client.get(self.api_url, params=params, headers=headers)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise PoeLeagueProviderRequestError("Path of Exile league API request failed.") from exc

        return [
            self._to_candidate(item, game_version)
            for item in payload.get("leagues", [])
            if item.get("name") or item.get("id")
        ]

    def _to_candidate(self, item: dict, game_version: str) -> PoeLeagueCandidate:
        start_date = self._parse_date(item.get("startAt"))
        end_date = self._parse_date(item.get("endAt"))
        name = item.get("name") or item.get("id")
        return PoeLeagueCandidate(
            name=name,
            game_version=game_version,
            start_date=start_date,
            end_date=end_date,
            status=self._status(start_date, end_date),
            notes="Zaimportowano z oficjalnego API Path of Exile.",
        )

    @staticmethod
    def _parse_date(value: str | None) -> date | None:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            return None

    @staticmethod
    def _status(start_date: date | None, end_date: date | None) -> str:
        today = date.today()
        if start_date and start_date > today:
            return "planned"
        if end_date and end_date < today:
            return "completed"
        return "active"
