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
    games_with_playtime_count: int = 0
    average_rating: float | None = None


class CompletedGamesFilterOptionsRead(BaseModel):
    platforms: list[str] = Field(default_factory=list)
    genres: list[str] = Field(default_factory=list)


class CompletedGamesDistributionItemRead(BaseModel):
    label: str
    completed_games_count: int
    percentage: float | None = None
    total_playtime_hours: float
    average_rating: float | None = None


class CompletedGamesYearDashboardRead(BaseModel):
    year: int
    completed_games_count: int
    total_playtime_hours: float
    average_playtime_hours: float | None = None
    games_with_playtime_count: int = 0
    average_rating: float | None = None
    rated_games_count: int = 0
    best_rated_game: CompletedGameHighlightRead | None = None
    longest_game: CompletedGameHighlightRead | None = None
    shortest_game: CompletedGameHighlightRead | None = None
    most_active_month: CompletedGamesMonthSummaryRead | None = None
    active_months_count: int
    monthly: list[CompletedGamesMonthSummaryRead] = Field(default_factory=list)
    platforms: list[CompletedGamesDistributionItemRead] = Field(default_factory=list)
    genres: list[CompletedGamesDistributionItemRead] = Field(default_factory=list)
    best_rated_games: list[CompletedGameHighlightRead] = Field(default_factory=list)
    longest_games: list[CompletedGameHighlightRead] = Field(default_factory=list)
    shortest_games: list[CompletedGameHighlightRead] = Field(default_factory=list)
    latest_completions: list[CompletedGameHighlightRead] = Field(default_factory=list)
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
