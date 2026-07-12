import { describe, expect, it } from "vitest";

import { analyticsPeriodLabel, buildAnalyticsInsights, trendValueLabel } from "../lib/analytics";
import type { CompletedGamesYearDashboard } from "../types";

const dashboard: CompletedGamesYearDashboard = {
  year: 2026,
  completed_games_count: 2,
  total_playtime_hours: 30,
  average_playtime_hours: 15,
  games_with_playtime_count: 2,
  average_rating: 9,
  rated_games_count: 1,
  best_rated_game: { id: 1, title: "Najlepsza", completion_date: "2026-07-10", playtime_hours: 20, rating: 9 },
  longest_game: { id: 1, title: "Najlepsza", completion_date: "2026-07-10", playtime_hours: 20, rating: 9 },
  shortest_game: { id: 2, title: "Krótka", completion_date: "2026-07-01", playtime_hours: 10 },
  most_active_month: { month: 7, completed_games_count: 2, total_playtime_hours: 30, games_with_playtime_count: 2, average_rating: 9 },
  active_months_count: 1,
  monthly: [],
  platforms: [{ label: "PC", completed_games_count: 2, percentage: 100, total_playtime_hours: 30, average_rating: 9 }],
  genres: [],
  best_rated_games: [],
  longest_games: [],
  shortest_games: [],
  latest_completions: [],
  filter_options: { platforms: ["PC"], genres: [] }
};

describe("analytics presentation", () => {
  it("describes the active month and formats trend values without technical empties", () => {
    expect(analyticsPeriodLabel(2026, { month: 7, platforms: [], genres: [] })).toBe("Lipiec 2026");
    expect(trendValueLabel(0, "rating", false)).toBe("Brak ocen");
  });

  it("builds deterministic insights only from available data", () => {
    expect(buildAnalyticsInsights(dashboard)).toEqual([
      "Najwięcej gier ukończono w lipcu — 2.",
      "Najczęściej wybieraną platformą była PC.",
      "Najwyżej ocenioną grą była Najlepsza — 9/10.",
      "Średni czas ukończenia gry z podanym czasem wyniósł 15 godz."
    ]);
    expect(buildAnalyticsInsights({ ...dashboard, best_rated_game: null, average_playtime_hours: null, platforms: [], most_active_month: null })).toEqual([]);
  });
});
