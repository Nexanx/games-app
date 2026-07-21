import { describe, expect, it } from "vitest";

import {
  getDiscoveryGameKey,
  groupReleasesByDate,
  parseDismissedRecommendationKeys
} from "../lib/discovery";
import type { GameSearchResult } from "../types";

function game(title: string, externalId: string, releaseDate?: string | null): GameSearchResult {
  return {
    title,
    genres: ["RPG"],
    platforms: ["PC"],
    external_id: externalId,
    external_source: "RAWG",
    source: "RAWG",
    release_date: releaseDate
  };
}

describe("game discovery helpers", () => {
  it("builds stable provider keys and safely reads locally dismissed recommendations", () => {
    expect(getDiscoveryGameKey(game("Hades", "123"))).toBe("rawg:123");
    expect([...parseDismissedRecommendationKeys('["rawg:123",42,"rawg:456"]')]).toEqual([
      "rawg:123",
      "rawg:456"
    ]);
    expect([...parseDismissedRecommendationKeys("invalid")]).toEqual([]);
  });

  it("groups releases chronologically and keeps missing dates explicit", () => {
    const groups = groupReleasesByDate([
      game("Unknown", "3", null),
      game("Beta", "2", "2026-09-10"),
      game("Alpha", "1", "2026-09-10"),
      game("Earlier", "4", "2026-09-02")
    ]);

    expect(groups.map((group) => group.date)).toEqual(["2026-09-02", "2026-09-10", null]);
    expect(groups[1].games.map((entry) => entry.title)).toEqual(["Alpha", "Beta"]);
  });
});
