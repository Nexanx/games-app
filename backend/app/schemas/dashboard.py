from pydantic import BaseModel

from app.schemas.games import BacklogGameRead
from app.schemas.poe import PoeCharacterRead


class StatusCounts(BaseModel):
    to_play: int = 0
    playing: int = 0
    completed: int = 0
    abandoned: int = 0
    paused: int = 0


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
    games: StatusCounts
    total_game_playtime_minutes: int
    recent_added_games: list[BacklogGameRead]
    recent_completed_games: list[BacklogGameRead]
    poe_character_count: int
    recent_poe_characters: list[PoeCharacterRead]
    poe_playtime_by_version: dict[str, int]
    top_currency_drops: list[CurrencyHighlight]
    latest_league: LeagueSummary

