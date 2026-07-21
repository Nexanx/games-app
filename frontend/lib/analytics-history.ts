import type { CompletedGamesHistoryYear } from "@/types";

export type HistoryYearChartRow = {
  year: number;
  completed_games_count: number;
  total_playtime_hours: number;
  average_rating: number | null;
};

export function historyYearChartData(years: CompletedGamesHistoryYear[]): HistoryYearChartRow[] {
  return [...years]
    .sort((left, right) => left.year - right.year)
    .map((item) => ({
      year: item.year,
      completed_games_count: item.completed_games_count,
      total_playtime_hours: item.total_playtime_hours,
      average_rating: item.average_rating ?? null
    }));
}

export function historyCategoryChartData(
  years: CompletedGamesHistoryYear[],
  kind: "platforms" | "genres",
  limit = 5
) {
  const totals = new Map<string, number>();
  for (const year of years) {
    for (const item of year[kind]) {
      if (item.label.startsWith("Brak ")) continue;
      totals.set(item.label, (totals.get(item.label) ?? 0) + item.completed_games_count);
    }
  }
  const labels = [...totals]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "pl"))
    .slice(0, limit)
    .map(([label]) => label);
  const rows = [...years]
    .sort((left, right) => left.year - right.year)
    .map((year) => ({
      year: year.year,
      ...Object.fromEntries(labels.map((label) => [
        label,
        year[kind].find((item) => item.label === label)?.completed_games_count ?? 0
      ]))
    }));
  return { labels, rows };
}
