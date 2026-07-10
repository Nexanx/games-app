from pydantic import BaseModel, Field


class CompletedGameHighlightRead(BaseModel):
    id: int
    title: str
    completion_date: str
    playtime_hours: float
    rating: float | None = None
    cover_url: str | None = None


class CompletedGamesMonthSummaryRead(BaseModel):
    month: int = Field(..., ge=1, le=12)
    completed_games_count: int
    total_playtime_hours: float
    average_rating: float | None = None


class CompletedGamesFilterOptionsRead(BaseModel):
    platforms: list[str] = Field(default_factory=list)
    genres: list[str] = Field(default_factory=list)


class CompletedGamesYearDashboardRead(BaseModel):
    year: int
    completed_games_count: int
    total_playtime_hours: float
    average_playtime_hours: float | None = None
    average_rating: float | None = None
    best_rated_game: CompletedGameHighlightRead | None = None
    longest_game: CompletedGameHighlightRead | None = None
    active_months_count: int
    monthly: list[CompletedGamesMonthSummaryRead] = Field(default_factory=list)
    filter_options: CompletedGamesFilterOptionsRead


class CompletedGamesComparisonYearRead(BaseModel):
    year: int
    completed_games_count: int
    total_playtime_hours: float
    average_playtime_hours: float | None = None
    average_rating: float | None = None
    monthly: list[CompletedGamesMonthSummaryRead] = Field(default_factory=list)


class CompletedGamesComparisonRead(BaseModel):
    years: list[CompletedGamesComparisonYearRead] = Field(default_factory=list)
