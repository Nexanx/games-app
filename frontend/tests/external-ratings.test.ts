import { describe, expect, it } from "vitest";

import { NO_EXTERNAL_RATING_LABEL, externalRatingLabel, externalRatingsFetchedLabel, metacriticValueLabel } from "../lib/external-ratings";

describe("external rating presentation", () => {
  it("keeps the original RAWG scale and vote count", () => {
    expect(externalRatingLabel({ source: "RAWG", value: 4.4, scale: 5, count: 123 })).toBe(
      "Ocena zewnętrzna · RAWG: 4,4/5 · 123 głosy"
    );
  });

  it("labels Metacritic separately and never converts its scale", () => {
    expect(externalRatingLabel({ source: "Metacritic", value: 88, scale: 100 })).toBe("Metacritic: 88/100");
    expect(metacriticValueLabel([{ source: "Metacritic", value: 88, scale: 100 }])).toBe("88/100");
    expect(metacriticValueLabel([{ source: "RAWG", value: 4.4, scale: 5 }])).toBe(NO_EXTERNAL_RATING_LABEL);
  });

  it("has explicit fallbacks for missing ratings, votes and invalid timestamps", () => {
    expect(NO_EXTERNAL_RATING_LABEL).toBe("Brak oceny zewnętrznej");
    expect(externalRatingLabel({ source: "RAWG", value: 4, scale: 5 })).toContain("brak liczby głosów");
    expect(externalRatingsFetchedLabel("invalid")).toBeNull();
  });
});
