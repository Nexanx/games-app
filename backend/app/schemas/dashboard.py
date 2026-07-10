from pydantic import BaseModel

from app.schemas.games import BacklogEntryRead, CompletedGameEntryRead
from app.schemas.poe import PoeCharacterRead


class GamesSummary(BaseModel):
    backlog: int = 0
    completed: int = 0


class CurrencyHighlight(BaseModel):
    name: str
    value: float
    category: str
    icon_url: str | None = None


class LeagueSummary(BaseModel):
    name: str | None = None
    game_version: str | None = None
    status: str | None = None
    characters: int = 0
    playtime_minutes: int = 0


class DashboardSummary(BaseModel):
    games: GamesSummary
    total_game_playtime_hours: float
    recent_backlog_entries: list[BacklogEntryRead]
    recent_completed_games: list[CompletedGameEntryRead]
    poe_character_count: int
    recent_poe_characters: list[PoeCharacterRead]
    poe_playtime_by_version: dict[str, int]
    top_currency_drops: list[CurrencyHighlight]
    latest_league: LeagueSummary
