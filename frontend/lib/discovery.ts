import type { GameSearchResult } from "@/types";

export const DISMISSED_RECOMMENDATIONS_KEY = "games-tracker.dismissed-recommendations";

export function getDiscoveryGameKey(game: GameSearchResult) {
  const externalId = game.external_id?.trim().toLocaleLowerCase("pl-PL");
  return externalId
    ? `${game.external_source.trim().toLocaleLowerCase("pl-PL")}:${externalId}`
    : `title:${game.title.trim().toLocaleLowerCase("pl-PL")}`;
}

export function parseDismissedRecommendationKeys(value: string | null) {
  if (!value) return new Set<string>();
  try {
    const parsed: unknown = JSON.parse(value);
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export function groupReleasesByDate(games: GameSearchResult[]) {
  const groups = new Map<string, GameSearchResult[]>();
  games.forEach((game) => {
    const key = game.release_date || "unknown";
    groups.set(key, [...(groups.get(key) ?? []), game]);
  });
  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === "unknown") return 1;
      if (right === "unknown") return -1;
      return left.localeCompare(right);
    })
    .map(([date, entries]) => ({
      date: date === "unknown" ? null : date,
      games: [...entries].sort((left, right) => left.title.localeCompare(right.title, "pl"))
    }));
}

export function formatReleaseDate(value?: string | null) {
  if (!value) return "Brak dokładnej daty";
  return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );
}
