import { describe, expect, it } from "vitest";

import {
  completedYearFiltersFromSearchParams,
  completedYearFiltersToSearchParams,
  currentCompletedGamesYear,
  getAvailableYearNavigation,
  getCompletedYearFiltersError,
  getYearNavigation,
  groupCompletedGamesByMonth,
  hasCompletedYearFilters,
  ratingAfterWheel,
  todayAsInputValue
} from "../lib/completed-games";
import type { CompletedGameEntry } from "../types";

function entry(id: number, completionDate: string): CompletedGameEntry {
  return {
    id,
    game_id: id,
    completion_date: completionDate,
    playtime_hours: 1,
    custom_statistics: [],
    created_at: `${completionDate}T12:00:00Z`,
    updated_at: `${completionDate}T12:00:00Z`,
    game: {
      id,
      title: `Game ${id}`,
      genres: [],
      platforms: [],
      external_source: "manual",
      created_at: `${completionDate}T12:00:00Z`,
      updated_at: `${completionDate}T12:00:00Z`
    }
  };
}

describe("completed games grouping", () => {
  it("groups only populated months from newest to oldest", () => {
    const groups = groupCompletedGamesByMonth([
      entry(1, "2026-06-10"),
      entry(2, "2026-07-01"),
      entry(3, "2026-07-20")
    ]);

    expect(groups.map((group) => group.label)).toEqual(["Lipiec", "Czerwiec"]);
    expect(groups[0].entries.map((item) => item.id)).toEqual([3, 2]);
  });

  it("navigates between years that actually contain entries", () => {
    const years = [
      { year: 2026, completed_games_count: 2 },
      { year: 2024, completed_games_count: 1 }
    ];

    expect(getAvailableYearNavigation(2026, years)).toEqual({ newerYear: null, olderYear: 2024 });
    expect(getAvailableYearNavigation(2024, years)).toEqual({ newerYear: 2026, olderYear: null });
  });

  it("selects the nearest available years around an empty year", () => {
    const years = [
      { year: 2027, completed_games_count: 2 },
      { year: 2026, completed_games_count: 11 },
      { year: 2024, completed_games_count: 3 }
    ];

    expect(getYearNavigation(2025, years)).toEqual({ newerYear: 2026, olderYear: 2024 });
  });

  it("uses the local calendar date as the default form value", () => {
    expect(todayAsInputValue(new Date(2026, 6, 10, 23, 30))).toBe("2026-07-10");
    expect(currentCompletedGamesYear(new Date(2026, 0, 1))).toBe(2026);
  });

  it("keeps combined filters in the URL and can clear their state", () => {
    const filters = completedYearFiltersFromSearchParams(
      new URLSearchParams("month=7&platform=PC&platform=PS5&genre=RPG&rating_min=8&rating_max=9&date_from=2026-07-01&date_to=2026-07-31&playtime_min=5&playtime_max=80")
    );

    expect(filters).toEqual({
      month: 7,
      platforms: ["PC", "PS5"],
      genres: ["RPG"],
      ratingMin: 8,
      ratingMax: 9,
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      playtimeMin: 5,
      playtimeMax: 80
    });
    expect(hasCompletedYearFilters(filters)).toBe(true);
    expect(completedYearFiltersToSearchParams(filters).toString()).toBe(
      "month=7&platform=PC&platform=PS5&genre=RPG&rating_min=8&rating_max=9&date_from=2026-07-01&date_to=2026-07-31&playtime_min=5&playtime_max=80"
    );
    expect(hasCompletedYearFilters({ platforms: [], genres: [] })).toBe(false);
  });

  it("changes ratings by half a point with the wheel and keeps the scale bounds", () => {
    expect(ratingAfterWheel("8", -100)).toBe("8.5");
    expect(ratingAfterWheel("8", 100)).toBe("7.5");
    expect(ratingAfterWheel("", -100)).toBe("0.5");
    expect(ratingAfterWheel("10", -100)).toBe("10");
    expect(ratingAfterWheel("0", 100)).toBe("0");
  });

  it("validates date, rating and playtime ranges", () => {
    expect(getCompletedYearFiltersError({ platforms: [], genres: [], dateFrom: "2026-08-01", dateTo: "2026-07-01" })).toContain("Data początkowa");
    expect(getCompletedYearFiltersError({ platforms: [], genres: [], ratingMin: 9, ratingMax: 8 })).toContain("Minimalna ocena");
    expect(getCompletedYearFiltersError({ platforms: [], genres: [], playtimeMin: 20, playtimeMax: 10 })).toContain("Minimalny czas");
    expect(getCompletedYearFiltersError({ platforms: [], genres: [], playtimeMin: 10, playtimeMax: 20 })).toBeNull();
  });
});
