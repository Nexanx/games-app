from pydantic import BaseModel, Field

from app.schemas.games import ExternalRating


class CompletedGameHighlightRead(BaseModel):
    id: int
    title: str
    completion_date: str
    playtime_hours: float
    rating: float | None = None
    cover_url: str | None = None
    platform: str | None = None
    genres: list[str] = Field(default_factory=list)
    external_ratings: list[ExternalRating] = Field(default_factory=list)


class CompletedGamesMonthSummaryRead(BaseModel):
    month: int = Field(..., ge=1, le=12)
    completed_games_count: int
    total_playtime_hours: float
    games_with_playtime_count: int = 0
    average_playtime_hours: float | None = None
    median_playtime_hours: float | None = None
    average_rating: float | None = None
    median_rating: float | None = None
    rated_games_count: int = 0
    unique_platforms_count: int = 0
    unique_genres_count: int = 0
    best_rated_game: CompletedGameHighlightRead | None = None


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
    poe_playtime_hours: float = 0
    combined_playtime_hours: float = 0
    poe_leagues_count: int = 0
    poe_characters_count: int = 0
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
    scatter_games: list[CompletedGameHighlightRead] = Field(default_factory=list)
    filter_options: CompletedGamesFilterOptionsRead


class CompletedGamesComparisonYearRead(BaseModel):
    year: int
    completed_games_count: int
    total_playtime_hours: float
    poe_playtime_hours: float = 0
    combined_playtime_hours: float = 0
    poe_leagues_count: int = 0
    poe_characters_count: int = 0
    average_playtime_hours: float | None = None
    average_rating: float | None = None
    monthly: list[CompletedGamesMonthSummaryRead] = Field(default_factory=list)


class CompletedGamesComparisonRead(BaseModel):
    years: list[CompletedGamesComparisonYearRead] = Field(default_factory=list)


class CompletedGamesPeriodMetricsRead(BaseModel):
    completed_games_count: int = 0
    total_playtime_hours: float = 0
    poe_playtime_hours: float = 0
    combined_playtime_hours: float = 0
    poe_leagues_count: int = 0
    poe_characters_count: int = 0
    average_playtime_hours: float | None = None
    median_playtime_hours: float | None = None
    games_with_playtime_count: int = 0
    average_rating: float | None = None
    median_rating: float | None = None
    rated_games_count: int = 0
    unrated_games_count: int = 0
    unique_platforms_count: int = 0
    unique_genres_count: int = 0
    top_platform: CompletedGamesDistributionItemRead | None = None
    top_genre: CompletedGamesDistributionItemRead | None = None
    best_rated_game: CompletedGameHighlightRead | None = None
    longest_game: CompletedGameHighlightRead | None = None
    shortest_game: CompletedGameHighlightRead | None = None


class CompletedGamesPeriodDifferenceRead(BaseModel):
    metric: str
    current_value: float | None = None
    previous_value: float | None = None
    absolute_change: float | None = None
    percentage_change: float | None = None
    has_percentage_baseline: bool = False


class CompletedGamesYearReportRead(BaseModel):
    year: int
    generated_at: str
    summary: CompletedGamesPeriodMetricsRead
    monthly: list[CompletedGamesMonthSummaryRead] = Field(default_factory=list)
    platforms: list[CompletedGamesDistributionItemRead] = Field(default_factory=list)
    genres: list[CompletedGamesDistributionItemRead] = Field(default_factory=list)
    first_completion: CompletedGameHighlightRead | None = None
    last_completion: CompletedGameHighlightRead | None = None
    longest_active_streak_months: int = 0
    most_active_month: CompletedGamesMonthSummaryRead | None = None
    most_playtime_month: CompletedGamesMonthSummaryRead | None = None
    most_diverse_month: CompletedGamesMonthSummaryRead | None = None
    insights: list[str] = Field(default_factory=list)
    previous_year: int | None = None
    previous_year_differences: list[CompletedGamesPeriodDifferenceRead] = Field(default_factory=list)
    scatter_games: list[CompletedGameHighlightRead] = Field(default_factory=list)


class CompletedGamesDayActivityRead(BaseModel):
    date: str
    completed_games_count: int
    total_playtime_hours: float
    average_rating: float | None = None
    games: list[CompletedGameHighlightRead] = Field(default_factory=list)


class CompletedGamesYearActivityRead(BaseModel):
    year: int
    days: list[CompletedGamesDayActivityRead] = Field(default_factory=list)


class CompletedGamesMonthPeriodRead(BaseModel):
    month: int = Field(..., ge=1, le=12)
    summary: CompletedGamesPeriodMetricsRead
    platforms: list[CompletedGamesDistributionItemRead] = Field(default_factory=list)
    genres: list[CompletedGamesDistributionItemRead] = Field(default_factory=list)
    games: list[CompletedGameHighlightRead] = Field(default_factory=list)


class CompletedGamesMonthComparisonRead(BaseModel):
    year: int
    month_a: CompletedGamesMonthPeriodRead
    month_b: CompletedGamesMonthPeriodRead
    differences: list[CompletedGamesPeriodDifferenceRead] = Field(default_factory=list)


class CompletedGamesForecastPointRead(BaseModel):
    period: str
    value: float
    lower_bound: float | None = None
    upper_bound: float | None = None


class CompletedGamesForecastModelScoreRead(BaseModel):
    model: str
    mae: float
    rmse: float
    is_baseline: bool = False


class CompletedGamesForecastCumulativeYearRead(BaseModel):
    year: int
    historical: list[CompletedGamesForecastPointRead] = Field(default_factory=list)
    forecast: list[CompletedGamesForecastPointRead] = Field(default_factory=list)


class CompletedGamesForecastRead(BaseModel):
    metric: str
    sufficient_data: bool
    reason: str | None = None
    model: str | None = None
    historical: list[CompletedGamesForecastPointRead] = Field(default_factory=list)
    forecast: list[CompletedGamesForecastPointRead] = Field(default_factory=list)
    mae: float | None = None
    rmse: float | None = None
    observations_count: int = 0
    active_months_count: int = 0
    source_entries_count: int = 0
    years_count: int = 0
    zero_months_count: int = 0
    missing_source_values_count: int = 0
    validation_months_count: int = 0
    model_scores: list[CompletedGamesForecastModelScoreRead] = Field(default_factory=list)
    cumulative_years: list[CompletedGamesForecastCumulativeYearRead] = Field(default_factory=list)
    minimum_requirements: str


class CompletedGamesHistoryYearRead(BaseModel):
    year: int
    completed_games_count: int = 0
    total_playtime_hours: float = 0
    poe_playtime_hours: float = 0
    combined_playtime_hours: float = 0
    poe_leagues_count: int = 0
    poe_characters_count: int = 0
    average_playtime_hours: float | None = None
    average_rating: float | None = None
    platforms: list[CompletedGamesDistributionItemRead] = Field(default_factory=list)
    genres: list[CompletedGamesDistributionItemRead] = Field(default_factory=list)


class CompletedGamesHistoryRead(BaseModel):
    summary: CompletedGamesPeriodMetricsRead
    active_years_count: int = 0
    best_year_by_completions: CompletedGamesHistoryYearRead | None = None
    best_year_by_playtime: CompletedGamesHistoryYearRead | None = None
    yearly: list[CompletedGamesHistoryYearRead] = Field(default_factory=list)
    platforms: list[CompletedGamesDistributionItemRead] = Field(default_factory=list)
    genres: list[CompletedGamesDistributionItemRead] = Field(default_factory=list)
