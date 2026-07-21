export type PoeVersion = "poe1" | "poe2";
export type StatisticValueType = "text" | "number" | "boolean";

export interface ExternalRating {
  source: "RAWG" | "Metacritic";
  value: number;
  scale: number;
  count?: number | null;
}

export interface Game {
  id: number;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  release_date?: string | null;
  genres: string[];
  platforms: string[];
  external_id?: string | null;
  external_source: string;
  external_url?: string | null;
  external_ratings?: ExternalRating[];
  external_ratings_updated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameSearchResult extends Omit<Game, "id" | "created_at" | "updated_at"> {
  source: string;
}

export interface GameSearchPage {
  results: GameSearchResult[];
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface BacklogEntry {
  id: number;
  game_id: number;
  game: Game;
  position: number;
  preferred_platform?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomStatistic {
  id?: number;
  completed_game_entry_id?: number;
  name: string;
  value: string;
  value_type: StatisticValueType;
  created_at?: string;
  updated_at?: string;
}

export interface CompletedGameEntry {
  id: number;
  game_id: number;
  game: Game;
  completion_date: string;
  playtime_hours: number;
  rating?: number | null;
  platform?: string | null;
  review?: string | null;
  custom_statistics: CustomStatistic[];
  created_at: string;
  updated_at: string;
}

export interface CompletedGamesYear {
  year: number;
  completed_games_count: number;
}

export interface CompletedGamesFilters {
  month?: number;
  platform?: string[];
  genre?: string[];
  rating_min?: number;
  rating_max?: number;
  date_from?: string;
  date_to?: string;
  playtime_min?: number;
  playtime_max?: number;
}

export interface CompletedGameHighlight {
  id: number;
  title: string;
  completion_date: string;
  playtime_hours: number;
  rating?: number | null;
  cover_url?: string | null;
  platform?: string | null;
  genres?: string[];
  external_ratings?: ExternalRating[];
}

export interface CompletedGamesMonthSummary {
  month: number;
  completed_games_count: number;
  total_playtime_hours: number;
  games_with_playtime_count: number;
  average_playtime_hours?: number | null;
  median_playtime_hours?: number | null;
  average_rating?: number | null;
  median_rating?: number | null;
  rated_games_count: number;
  unique_platforms_count: number;
  unique_genres_count: number;
  best_rated_game?: CompletedGameHighlight | null;
}

export interface CompletedGamesFilterOptions {
  platforms: string[];
  genres: string[];
}

export interface CompletedGamesDistributionItem {
  label: string;
  completed_games_count: number;
  percentage?: number | null;
  total_playtime_hours: number;
  average_rating?: number | null;
}

export interface CompletedGamesYearDashboard {
  year: number;
  completed_games_count: number;
  total_playtime_hours: number;
  average_playtime_hours?: number | null;
  games_with_playtime_count: number;
  average_rating?: number | null;
  rated_games_count: number;
  best_rated_game?: CompletedGameHighlight | null;
  longest_game?: CompletedGameHighlight | null;
  shortest_game?: CompletedGameHighlight | null;
  most_active_month?: CompletedGamesMonthSummary | null;
  active_months_count: number;
  monthly: CompletedGamesMonthSummary[];
  platforms: CompletedGamesDistributionItem[];
  genres: CompletedGamesDistributionItem[];
  best_rated_games: CompletedGameHighlight[];
  longest_games: CompletedGameHighlight[];
  shortest_games: CompletedGameHighlight[];
  latest_completions: CompletedGameHighlight[];
  scatter_games: CompletedGameHighlight[];
  filter_options: CompletedGamesFilterOptions;
}

export interface CompletedGamesComparisonYear {
  year: number;
  completed_games_count: number;
  total_playtime_hours: number;
  average_playtime_hours?: number | null;
  average_rating?: number | null;
  monthly: CompletedGamesMonthSummary[];
}

export interface CompletedGamesComparison {
  years: CompletedGamesComparisonYear[];
}

export interface CompletedGamesPeriodMetrics {
  completed_games_count: number;
  total_playtime_hours: number;
  average_playtime_hours?: number | null;
  median_playtime_hours?: number | null;
  games_with_playtime_count: number;
  average_rating?: number | null;
  median_rating?: number | null;
  rated_games_count: number;
  unrated_games_count: number;
  unique_platforms_count: number;
  unique_genres_count: number;
  top_platform?: CompletedGamesDistributionItem | null;
  top_genre?: CompletedGamesDistributionItem | null;
  best_rated_game?: CompletedGameHighlight | null;
  longest_game?: CompletedGameHighlight | null;
  shortest_game?: CompletedGameHighlight | null;
}

export interface CompletedGamesPeriodDifference {
  metric: string;
  current_value?: number | null;
  previous_value?: number | null;
  absolute_change?: number | null;
  percentage_change?: number | null;
  has_percentage_baseline: boolean;
}

export interface CompletedGamesYearReport {
  year: number;
  generated_at: string;
  summary: CompletedGamesPeriodMetrics;
  monthly: CompletedGamesMonthSummary[];
  platforms: CompletedGamesDistributionItem[];
  genres: CompletedGamesDistributionItem[];
  first_completion?: CompletedGameHighlight | null;
  last_completion?: CompletedGameHighlight | null;
  longest_active_streak_months: number;
  most_active_month?: CompletedGamesMonthSummary | null;
  most_playtime_month?: CompletedGamesMonthSummary | null;
  most_diverse_month?: CompletedGamesMonthSummary | null;
  insights: string[];
  previous_year?: number | null;
  previous_year_differences: CompletedGamesPeriodDifference[];
  scatter_games: CompletedGameHighlight[];
}

export interface CompletedGamesDayActivity {
  date: string;
  completed_games_count: number;
  total_playtime_hours: number;
  average_rating?: number | null;
  games: CompletedGameHighlight[];
}

export interface CompletedGamesYearActivity {
  year: number;
  days: CompletedGamesDayActivity[];
}

export interface CompletedGamesMonthPeriod {
  month: number;
  summary: CompletedGamesPeriodMetrics;
  platforms: CompletedGamesDistributionItem[];
  genres: CompletedGamesDistributionItem[];
  games: CompletedGameHighlight[];
}

export interface CompletedGamesMonthComparison {
  year: number;
  month_a: CompletedGamesMonthPeriod;
  month_b: CompletedGamesMonthPeriod;
  differences: CompletedGamesPeriodDifference[];
}

export interface CompletedGamesForecastPoint {
  period: string;
  value: number;
  lower_bound?: number | null;
  upper_bound?: number | null;
}

export interface CompletedGamesForecastModelScore {
  model: string;
  mae: number;
  rmse: number;
  is_baseline: boolean;
}

export interface CompletedGamesForecastCumulativeYear {
  year: number;
  historical: CompletedGamesForecastPoint[];
  forecast: CompletedGamesForecastPoint[];
}

export interface CompletedGamesForecast {
  metric: "completed_games" | "playtime";
  sufficient_data: boolean;
  reason?: string | null;
  model?: string | null;
  historical: CompletedGamesForecastPoint[];
  forecast: CompletedGamesForecastPoint[];
  mae?: number | null;
  rmse?: number | null;
  observations_count: number;
  active_months_count: number;
  source_entries_count: number;
  years_count: number;
  zero_months_count: number;
  missing_source_values_count: number;
  validation_months_count: number;
  model_scores: CompletedGamesForecastModelScore[];
  cumulative_years: CompletedGamesForecastCumulativeYear[];
  minimum_requirements: string;
}

export interface CompletedGamesHistoryYear {
  year: number;
  completed_games_count: number;
  total_playtime_hours: number;
  average_playtime_hours?: number | null;
  average_rating?: number | null;
  platforms: CompletedGamesDistributionItem[];
  genres: CompletedGamesDistributionItem[];
}

export interface CompletedGamesHistory {
  summary: CompletedGamesPeriodMetrics;
  active_years_count: number;
  best_year_by_completions?: CompletedGamesHistoryYear | null;
  best_year_by_playtime?: CompletedGamesHistoryYear | null;
  yearly: CompletedGamesHistoryYear[];
  platforms: CompletedGamesDistributionItem[];
  genres: CompletedGamesDistributionItem[];
}

export interface BacklogBatchItem {
  title: string;
  external_id?: string | null;
  external_source?: string | null;
  source?: string | null;
  message?: string | null;
}

export interface BacklogBatchResult {
  added: BacklogEntry[];
  already_exists: BacklogBatchItem[];
  failed: BacklogBatchItem[];
}

export interface BackupDocument {
  format_version: number;
  exported_at: string;
  app_name: string;
  data: Record<string, unknown>;
}

export interface BackupImportResult {
  mode: "replace";
  restored: Record<string, number>;
}

export interface PoeLeague {
  id: number;
  name: string;
  game_version: PoeVersion;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoeLeagueSyncResult {
  created: number;
  updated: number;
  leagues: PoeLeague[];
  source: string;
}

export interface PoeCharacter {
  id: number;
  name: string;
  game_version: PoeVersion;
  character_class?: string | null;
  ascendancy?: string | null;
  level: number;
  league_id?: number | null;
  league?: PoeLeague | null;
  poe_ninja_url?: string | null;
  profile_url?: string | null;
  build_name?: string | null;
  main_skill?: string | null;
  mode?: string | null;
  status: string;
  playtime_minutes: number;
  snapshot_source: "manual" | "pob" | "poe_ninja_pob";
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoeEquipmentItem {
  id: number;
  character_id: number;
  slot: string;
  name: string;
  base_type?: string | null;
  rarity?: string | null;
  item_text: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PoeBuildPreview {
  game_version: PoeVersion;
  character_class?: string | null;
  ascendancy?: string | null;
  level: number;
  equipment_count: number;
}

export interface PoeCurrencyStat {
  id: number;
  character_id: number;
  league_id?: number | null;
  name: string;
  category: string;
  icon_url?: string | null;
  value: number;
  display_order: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardMonthSummary {
  month: number;
  completed_games_count: number;
  total_playtime_hours: number;
}

export interface DashboardCurrentYearSummary {
  year: number;
  completed_games_count: number;
  total_playtime_hours: number;
  games_with_playtime_count: number;
  average_rating?: number | null;
  rated_games_count: number;
  most_active_month?: DashboardMonthSummary | null;
  top_platform?: string | null;
  trend: DashboardMonthSummary[];
}

export interface DashboardBacklogEntry {
  id: number;
  position: number;
  title: string;
  cover_url?: string | null;
  preferred_platform?: string | null;
  note?: string | null;
  external_ratings?: ExternalRating[];
}

export interface DashboardCompletedGame {
  id: number;
  title: string;
  cover_url?: string | null;
  completion_date: string;
  playtime_hours: number;
  rating?: number | null;
  external_ratings?: ExternalRating[];
}

export interface DashboardPoeSummary {
  character_count: number;
  playtime_by_version: Record<string, number>;
  latest_league: {
    name?: string | null;
    game_version?: string | null;
    status?: string | null;
    characters: number;
    playtime_minutes: number;
  };
}

export interface DashboardSummary {
  games: {
    backlog_count: number;
    current_year: DashboardCurrentYearSummary;
    next_backlog_entries: DashboardBacklogEntry[];
    recent_completed_games: DashboardCompletedGame[];
  };
  poe?: DashboardPoeSummary | null;
  poe_error?: string | null;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: "user" | "assistant" | string;
  content: string;
  created_at: string;
}

export interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

export interface ChatStatus {
  configured: boolean;
  missing: string[];
  message: string;
}

export interface ChatErrorDetail {
  code:
    | "llm_not_configured"
    | "llm_auth_error"
    | "llm_timeout"
    | "llm_rate_limited"
    | "llm_provider_unavailable"
    | "llm_network_error"
    | "llm_invalid_response"
    | "llm_internal_error";
  message: string;
  error_id: string;
  missing?: string[];
}
