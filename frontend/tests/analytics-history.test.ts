import { describe, expect, it } from "vitest";

import { historyCategoryChartData, historyYearChartData } from "../lib/analytics-history";
import type { CompletedGamesHistoryYear } from "../types";

const years: CompletedGamesHistoryYear[] = [
  { year: 2025, completed_games_count: 3, total_playtime_hours: 30, average_rating: 8, average_playtime_hours: 10, platforms: [{ label: "PC", completed_games_count: 2, total_playtime_hours: 20 }, { label: "PS5", completed_games_count: 1, total_playtime_hours: 10 }], genres: [{ label: "RPG", completed_games_count: 2, total_playtime_hours: 20 }] },
  { year: 2024, completed_games_count: 1, total_playtime_hours: 5, average_rating: null, average_playtime_hours: 5, platforms: [{ label: "PC", completed_games_count: 1, total_playtime_hours: 5 }], genres: [{ label: "Akcja", completed_games_count: 1, total_playtime_hours: 5 }] }
];

describe("all-history analytics data", () => {
  it("orders yearly chart data chronologically without mixing units", () => {
    expect(historyYearChartData(years)).toEqual([
      { year: 2024, completed_games_count: 1, total_playtime_hours: 5, average_rating: null },
      { year: 2025, completed_games_count: 3, total_playtime_hours: 30, average_rating: 8 }
    ]);
  });

  it("builds consistent multi-year category series", () => {
    expect(historyCategoryChartData(years, "platforms")).toEqual({
      labels: ["PC", "PS5"],
      rows: [{ year: 2024, PC: 1, PS5: 0 }, { year: 2025, PC: 2, PS5: 1 }]
    });
  });
});
