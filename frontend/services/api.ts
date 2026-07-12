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
const DEFAULT_TIMEOUT_MS = 15_000;

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

type RequestOptions = RequestInit & { timeoutMs?: number };

function validationMessage(detail: unknown): string | null {
  if (!Array.isArray(detail)) return null;
  const messages = detail.flatMap((issue) => {
    if (!issue || typeof issue !== "object") return [];
    const record = issue as { loc?: unknown; msg?: unknown };
    if (typeof record.msg !== "string") return [];
    const field = Array.isArray(record.loc) ? record.loc.at(-1) : null;
    return [typeof field === "string" ? `${field}: ${record.msg}` : record.msg];
  });
  return messages.length ? `Sprawdź poprawność danych: ${messages.join("; ")}` : null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal, ...init } = options;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort("timeout"), timeoutMs);
  const abortFromCaller = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      if (externalSignal?.aborted) throw new DOMException("Żądanie anulowane", "AbortError");
      throw new Error("Serwer nie odpowiedział w wymaganym czasie. Spróbuj ponownie.");
    }
    throw new Error(`Nie udało się połączyć z API (${API_URL}). Sprawdź, czy backend działa i czy adres API jest poprawny.`);
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromCaller);
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
    const readableValidation = validationMessage(detail);
    if (readableValidation) {
      return new ApiError(readableValidation, { code: "VALIDATION_ERROR", status: response.status });
    }
    if (typeof detail === "string") {
      return new ApiError(detail, { status: response.status });
    }
    if (detail?.message) {
      return new ApiError(detail.message, { code: detail.code, errorId: detail.error_id, status: response.status });
    }
    if (detail?.code) {
      return new ApiError(defaultMessage, { code: detail.code, errorId: detail.error_id, status: response.status });
    }
    return new ApiError("Serwer nie mógł przetworzyć żądania.", { status: response.status });
  } catch {
    return new ApiError(defaultMessage, { status: response.status });
  }
}

export const api = {
  dashboard: () => request<DashboardSummary>("/dashboard/summary"),
  searchGames: (query: string, page = 1, pageSize = 10, signal?: AbortSignal) =>
    request<GameSearchPage>(`/games/search${qs({ query, page, page_size: pageSize })}`, { signal }),
  createGame: (payload: Partial<Game>) =>
    request<Game>("/games", { method: "POST", body: JSON.stringify(payload) }),
  listGames: () => request<Game[]>("/games"),
  listBacklog: (params: Record<string, QueryValue> = {}, signal?: AbortSignal) =>
    request<BacklogEntry[]>(`/backlog${qs(params)}`, { signal }),
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
  listCompletedYears: (signal?: AbortSignal) => request<CompletedGamesYear[]>("/completed-games/years", { signal }),
  listCompletedGames: (year: number, filters: CompletedGamesFilters = {}, signal?: AbortSignal) =>
    request<CompletedGameEntry[]>(`/completed-games${qs({ year, ...filters })}`, { signal }),
  getCompletedYearDashboard: (year: number, signal?: AbortSignal) =>
    request<CompletedGamesYearDashboard>(`/completed-games/year/${year}/dashboard`, { signal }),
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
