export type PoeVersion = "poe1" | "poe2";
export type StatisticValueType = "text" | "number" | "boolean";

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
}

export interface CompletedGameHighlight {
  id: number;
  title: string;
  completion_date: string;
  playtime_hours: number;
  rating?: number | null;
  cover_url?: string | null;
}

export interface CompletedGamesMonthSummary {
  month: number;
  completed_games_count: number;
  total_playtime_hours: number;
  games_with_playtime_count: number;
  average_rating?: number | null;
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
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoeNinjaImportResult extends Partial<PoeCharacter> {
  league_name?: string | null;
  league_id?: number | null;
  notes: string;
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

export interface DashboardSummary {
  games: { backlog: number; completed: number };
  total_game_playtime_hours: number;
  recent_backlog_entries: BacklogEntry[];
  recent_completed_games: CompletedGameEntry[];
  poe_character_count: number;
  recent_poe_characters: PoeCharacter[];
  poe_playtime_by_version: Record<string, number>;
  top_currency_drops: Array<{ name: string; value: number; category: string; icon_url?: string | null }>;
  latest_league: {
    name?: string | null;
    game_version?: string | null;
    status?: string | null;
    characters: number;
    playtime_minutes: number;
  };
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
