export type GameStatus = "to_play" | "playing" | "completed" | "abandoned" | "paused";
export type PoeVersion = "poe1" | "poe2";

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

export interface BacklogGame {
  id: number;
  game_id: number;
  game: Game;
  status: GameStatus | string;
  position: number;
  rating?: number | null;
  playtime_minutes: number;
  completion_percent: number;
  started_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameStat {
  id: number;
  backlog_game_id: number;
  name: string;
  value: number;
  unit?: string | null;
  notes?: string | null;
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
  games: Record<GameStatus, number>;
  total_game_playtime_minutes: number;
  recent_added_games: BacklogGame[];
  recent_completed_games: BacklogGame[];
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

export interface Setting {
  id: number;
  key: string;
  value: unknown;
  updated_at: string;
}
