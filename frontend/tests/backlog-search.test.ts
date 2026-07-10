import { describe, expect, it } from "vitest";

import {
  filterSearchResultsForBacklog,
  getBatchFeedback,
  getBatchSelectionKeys,
  getExternalGameKey,
  toggleSearchSelection
} from "../lib/backlog-search";
import type { BacklogEntry, GameSearchResult } from "../types";

function result(overrides: Partial<GameSearchResult> = {}): GameSearchResult {
  return {
    title: "Elden Ring",
    genres: ["RPG"],
    platforms: ["PC"],
    external_id: "3498",
    external_source: "rawg",
    source: "rawg",
    ...overrides
  };
}

function backlogEntry(game: GameSearchResult): BacklogEntry {
  return {
    id: 1,
    game_id: 1,
    game: {
      id: 1,
      title: game.title,
      genres: game.genres,
      platforms: game.platforms,
      external_id: game.external_id,
      external_source: game.external_source || game.source,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z"
    },
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z"
  };
}

describe("backlog RAWG search helpers", () => {
  it("matches stable external identifiers case-insensitively", () => {
    expect(getExternalGameKey(result({ external_id: "RAWG-42", external_source: "RAWG" }))).toBe("rawg:rawg-42");
    expect(filterSearchResultsForBacklog([result()], [backlogEntry(result())])).toEqual([]);
  });

  it("uses a normalized title only when one of the games has no external identifier", () => {
    const manuallyAdded = result({ title: "The Witcher 3: Wild Hunt", external_id: null, external_source: "manual", source: "manual" });
    const rawgResult = result({ title: "the-witcher 3 wild hunt", external_id: "3328" });

    expect(filterSearchResultsForBacklog([rawgResult], [backlogEntry(manuallyAdded)])).toEqual([]);
    expect(filterSearchResultsForBacklog([rawgResult], [backlogEntry(result({ title: rawgResult.title, external_id: "other-id" }))])).toEqual([rawgResult]);
  });

  it("adds and removes a selection without duplicating its key", () => {
    const game = result();
    const selected = toggleSearchSelection({}, game);

    expect(Object.values(selected)).toEqual([game]);
    expect(toggleSearchSelection(selected, game)).toEqual({});
  });

  it("reports partial batch outcomes with failed titles", () => {
    expect(getBatchFeedback({
      added: [{ title: "Hades" }],
      already_exists: [{ title: "Elden Ring" }],
      failed: [{ title: "Broken Game", message: "timeout" }]
    })).toBe("Dodano do listy: 1. Już na liście: 1. Nie udało się dodać: Broken Game.");
  });

  it("matches successful batch items back to the selected RAWG result", () => {
    const game = result();
    const selected = toggleSearchSelection({}, game);

    expect(getBatchSelectionKeys([
      { title: "Elden Ring", external_id: "3498", external_source: "rawg" }
    ], selected)).toEqual(new Set(["rawg:3498"]));
  });
});
