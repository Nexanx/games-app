from pydantic import BaseModel, Field

from app.schemas.games import ExternalRating


class DashboardBacklogEntry(BaseModel):
    id: int
    position: int
    title: str
    cover_url: str | None = None
    preferred_platform: str | None = None
    note: str | None = None
    external_ratings: list[ExternalRating] = Field(default_factory=list)


class DashboardCompletedGame(BaseModel):
    id: int
    title: str
    cover_url: str | None = None
    completion_date: str
    playtime_hours: float
    rating: float | None = None
    external_ratings: list[ExternalRating] = Field(default_factory=list)


class DashboardMonthSummary(BaseModel):
    month: int = Field(..., ge=1, le=12)
    completed_games_count: int = 0
    total_playtime_hours: float = 0


class DashboardCurrentYearSummary(BaseModel):
    year: int
    completed_games_count: int = 0
    total_playtime_hours: float = 0
    games_with_playtime_count: int = 0
    average_rating: float | None = None
    rated_games_count: int = 0
    most_active_month: DashboardMonthSummary | None = None
    top_platform: str | None = None
    trend: list[DashboardMonthSummary] = Field(default_factory=list)


class DashboardGamesSummary(BaseModel):
    backlog_count: int = 0
    current_year: DashboardCurrentYearSummary
    next_backlog_entries: list[DashboardBacklogEntry] = Field(default_factory=list)
    recent_completed_games: list[DashboardCompletedGame] = Field(default_factory=list)


class LeagueSummary(BaseModel):
    name: str | None = None
    game_version: str | None = None
    characters: int = 0
    playtime_minutes: int = 0


class DashboardPoeSummary(BaseModel):
    character_count: int = 0
    playtime_by_version: dict[str, int] = Field(default_factory=dict)
    latest_league: LeagueSummary = Field(default_factory=LeagueSummary)


class DashboardSummary(BaseModel):
    games: DashboardGamesSummary
    poe: DashboardPoeSummary | None = None
    poe_error: str | None = None
