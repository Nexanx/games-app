import type {
  BacklogEntry,
  BacklogBatchResult,
  BackupDocument,
  BackupImportResult,
  ChatMessage,
  ChatSession,
  ChatStatus,
  CompletedGamesComparison,
  CompletedGamesFilters,
  CompletedGamesYearDashboard,
  DashboardSummary,
  Game,
  GameSearchPage,
  GameSearchResult,
  CompletedGameEntry,
  CompletedGamesYear,
  CustomStatistic,
  PoeCharacter,
  PoeCurrencyStat,
  PoeLeague,
  PoeLeagueSyncResult,
  PoeNinjaImportResult
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

type QueryScalar = string | number | boolean;
type QueryValue = QueryScalar | QueryScalar[] | null | undefined;

function qs(params: Record<string, QueryValue>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== "") searchParams.append(key, String(item));
      });
    } else if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const value = searchParams.toString();
  return value ? `?${value}` : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });
  } catch {
    throw new Error(`Nie udało się połączyć z API (${API_URL}). Sprawdź, czy backend działa i czy adres API jest poprawny.`);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  code?: string;
  errorId?: string;
  status: number;

  constructor(message: string, { code, errorId, status }: { code?: string; errorId?: string; status: number }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.errorId = errorId;
    this.status = status;
  }
}

async function readApiError(response: Response): Promise<ApiError> {
  const defaultMessage = `API error ${response.status}`;
  const text = await response.text();
  if (!text) {
    return new ApiError(defaultMessage, { status: response.status });
  }
  try {
    const payload = JSON.parse(text);
    const detail = payload?.detail;
    if (typeof detail === "string") {
      return new ApiError(detail, { status: response.status });
    }
    if (detail?.message) {
      return new ApiError(detail.message, { code: detail.code, errorId: detail.error_id, status: response.status });
    }
    if (detail?.code) {
      return new ApiError(defaultMessage, { code: detail.code, errorId: detail.error_id, status: response.status });
    }
    return new ApiError(JSON.stringify(payload) || defaultMessage, { status: response.status });
  } catch {
    return new ApiError(text || defaultMessage, { status: response.status });
  }
}

export const api = {
  dashboard: () => request<DashboardSummary>("/dashboard/summary"),
  searchGames: (query: string, page = 1, pageSize = 10) =>
    request<GameSearchPage>(`/games/search${qs({ query, page, page_size: pageSize })}`),
  createGame: (payload: Partial<Game>) =>
    request<Game>("/games", { method: "POST", body: JSON.stringify(payload) }),
  listGames: () => request<Game[]>("/games"),
  listBacklog: (params: Record<string, QueryValue> = {}) =>
    request<BacklogEntry[]>(`/backlog${qs(params)}`),
  getBacklog: (id: number) => request<BacklogEntry>(`/backlog/${id}`),
  createBacklog: (payload: Partial<BacklogEntry> & { game_id: number }) =>
    request<BacklogEntry>("/backlog", { method: "POST", body: JSON.stringify(payload) }),
  createBacklogBatch: (payload: { games: GameSearchResult[] }) =>
    request<BacklogBatchResult>("/backlog/batch", { method: "POST", body: JSON.stringify(payload) }),
  patchBacklog: (id: number, payload: Partial<BacklogEntry>) =>
    request<BacklogEntry>(`/backlog/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteBacklog: (id: number) => request<void>(`/backlog/${id}`, { method: "DELETE" }),
  reorderBacklog: (ordered_ids: number[]) =>
    request<BacklogEntry[]>("/backlog/reorder", { method: "POST", body: JSON.stringify({ ordered_ids }) }),
  listCompletedYears: () => request<CompletedGamesYear[]>("/completed-games/years"),
  listCompletedGames: (year: number, filters: CompletedGamesFilters = {}) =>
    request<CompletedGameEntry[]>(`/completed-games${qs({ year, ...filters })}`),
  getCompletedYearDashboard: (year: number) =>
    request<CompletedGamesYearDashboard>(`/completed-games/year/${year}/dashboard`),
  compareCompletedYears: (years: number[]) =>
    request<CompletedGamesComparison>(`/completed-games/comparison${qs({ years: years.join(",") })}`),
  getCompletedGame: (id: number) => request<CompletedGameEntry>(`/completed-games/${id}`),
  createCompletedGame: (payload: Partial<CompletedGameEntry> & { game_id: number; backlog_entry_id?: number | null }) =>
    request<CompletedGameEntry>("/completed-games", { method: "POST", body: JSON.stringify(payload) }),
  patchCompletedGame: (id: number, payload: Partial<CompletedGameEntry>) =>
    request<CompletedGameEntry>(`/completed-games/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCompletedGame: (id: number) => request<void>(`/completed-games/${id}`, { method: "DELETE" }),
  listCustomStatistics: (entryId: number) =>
    request<CustomStatistic[]>(`/completed-games/${entryId}/statistics`),
  createCustomStatistic: (entryId: number, payload: Partial<CustomStatistic>) =>
    request<CustomStatistic>(`/completed-games/${entryId}/statistics`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  patchCustomStatistic: (id: number, payload: Partial<CustomStatistic>) =>
    request<CustomStatistic>(`/completed-games/statistics/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteCustomStatistic: (id: number) =>
    request<void>(`/completed-games/statistics/${id}`, { method: "DELETE" }),
  exportBackup: () => request<BackupDocument>("/backup/export"),
  importBackup: (payload: { mode: "replace"; backup: BackupDocument }) =>
    request<BackupImportResult>("/backup/import", { method: "POST", body: JSON.stringify(payload) }),
  listLeagues: () => request<PoeLeague[]>("/poe/leagues"),
  createLeague: (payload: Partial<PoeLeague>) =>
    request<PoeLeague>("/poe/leagues", { method: "POST", body: JSON.stringify(payload) }),
  syncLeagues: (game_version?: string) =>
    request<PoeLeagueSyncResult>("/poe/leagues/sync", {
      method: "POST",
      body: JSON.stringify({ game_version: game_version || null })
    }),
  listCharacters: (params: Record<string, QueryValue> = {}) =>
    request<PoeCharacter[]>(`/poe/characters${qs(params)}`),
  getCharacter: (id: number) => request<PoeCharacter>(`/poe/characters/${id}`),
  createCharacter: (payload: Partial<PoeCharacter>) =>
    request<PoeCharacter>("/poe/characters", { method: "POST", body: JSON.stringify(payload) }),
  patchCharacter: (id: number, payload: Partial<PoeCharacter>) =>
    request<PoeCharacter>(`/poe/characters/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCharacter: (id: number) => request<void>(`/poe/characters/${id}`, { method: "DELETE" }),
  importFromNinja: (url: string) =>
    request<PoeNinjaImportResult>("/poe/import-from-ninja", {
      method: "POST",
      body: JSON.stringify({ url })
    }),
  listPoeStats: (characterId: number) => request<PoeCurrencyStat[]>(`/poe/characters/${characterId}/stats`),
  createPoeStat: (characterId: number, payload: Partial<PoeCurrencyStat>) =>
    request<PoeCurrencyStat>(`/poe/characters/${characterId}/stats`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  patchPoeStat: (id: number, payload: Partial<PoeCurrencyStat>) =>
    request<PoeCurrencyStat>(`/poe/stats/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deletePoeStat: (id: number) => request<void>(`/poe/stats/${id}`, { method: "DELETE" }),
  reorderPoeStats: (characterId: number, ordered_ids: number[]) =>
    request<PoeCurrencyStat[]>(`/poe/characters/${characterId}/stats/reorder`, {
      method: "POST",
      body: JSON.stringify({ ordered_ids })
    }),
  chat: (message: string, session_id?: number) =>
    request<{ session_id: number; answer: string; message: ChatMessage }>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, session_id })
    }),
  chatStatus: () => request<ChatStatus>("/chat/status"),
  listChatSessions: () => request<ChatSession[]>("/chat/sessions"),
  getChatSession: (id: number) => request<ChatSession>(`/chat/sessions/${id}`)
};
