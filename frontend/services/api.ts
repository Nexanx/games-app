import type {
  BacklogGame,
  ChatMessage,
  ChatSession,
  DashboardSummary,
  Game,
  GameSearchResult,
  GameStat,
  PoeCharacter,
  PoeCurrencyStat,
  PoeLeague,
  PoeLeagueSyncResult,
  PoeNinjaImportResult,
  Setting
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

type QueryValue = string | number | boolean | null | undefined;

function qs(params: Record<string, QueryValue>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
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
    throw new Error(await readApiError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function readApiError(response: Response) {
  const defaultMessage = `API error ${response.status}`;
  const text = await response.text();
  if (!text) {
    return defaultMessage;
  }
  try {
    const payload = JSON.parse(text);
    const detail = payload?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (detail?.code && detail?.message) {
      return `${detail.code}: ${detail.message}`;
    }
    if (detail?.message) {
      return detail.message;
    }
    return JSON.stringify(payload) || defaultMessage;
  } catch {
    return text || defaultMessage;
  }
}

export const api = {
  dashboard: () => request<DashboardSummary>("/dashboard/summary"),
  searchGames: (query: string) => request<GameSearchResult[]>(`/games/search${qs({ query })}`),
  createGame: (payload: Partial<Game>) =>
    request<Game>("/games", { method: "POST", body: JSON.stringify(payload) }),
  listBacklog: (params: Record<string, QueryValue> = {}) =>
    request<BacklogGame[]>(`/backlog${qs(params)}`),
  getBacklog: (id: number) => request<BacklogGame>(`/backlog/${id}`),
  createBacklog: (payload: Partial<BacklogGame> & { game_id: number }) =>
    request<BacklogGame>("/backlog", { method: "POST", body: JSON.stringify(payload) }),
  patchBacklog: (id: number, payload: Partial<BacklogGame>) =>
    request<BacklogGame>(`/backlog/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteBacklog: (id: number) => request<void>(`/backlog/${id}`, { method: "DELETE" }),
  markBacklog: (id: number, action: "mark-completed" | "mark-playing" | "mark-abandoned") =>
    request<BacklogGame>(`/backlog/${id}/${action}`, { method: "POST" }),
  reorderBacklog: (ordered_ids: number[]) =>
    request<BacklogGame[]>("/backlog/reorder", { method: "POST", body: JSON.stringify({ ordered_ids }) }),
  listGameStats: (entryId: number) => request<GameStat[]>(`/backlog/${entryId}/stats`),
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
  listChatSessions: () => request<ChatSession[]>("/chat/sessions"),
  getChatSession: (id: number) => request<ChatSession>(`/chat/sessions/${id}`),
  listSettings: () => request<Setting[]>("/settings"),
  upsertSetting: (payload: { key: string; value: unknown }) =>
    request<Setting>("/settings", { method: "PUT", body: JSON.stringify(payload) })
};
