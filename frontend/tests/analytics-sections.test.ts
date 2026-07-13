import { describe, expect, it } from "vitest";

import { allYearDateKeys, analyticsSectionUrl, heatIntensityLevel, normalizePair, parseAnalyticsSection, percentageChangeLabel } from "../lib/analytics-sections";

describe("analytics sections", () => {
  it("keeps supported sections in shareable URLs and falls back to summary", () => {
    expect(parseAnalyticsSection("heatmap")).toBe("heatmap");
    expect(parseAnalyticsSection("unknown")).toBe("summary");
    expect(analyticsSectionUrl(2026, "compare", new URLSearchParams("monthA=7&monthB=8"))).toBe("/analytics/2026?monthA=7&monthB=8&section=compare");
  });

  it("includes leap day in annual activity", () => {
    expect(allYearDateKeys(2024)).toHaveLength(366);
    expect(allYearDateKeys(2024)).toContain("2024-02-29");
    expect(allYearDateKeys(2025)).toHaveLength(365);
  });

  it("calculates bounded heatmap levels without NaN", () => {
    expect(heatIntensityLevel(0, 0)).toBe(0);
    expect(heatIntensityLevel(Number.NaN, 10)).toBe(0);
    expect(heatIntensityLevel(5, 10)).toBe(2);
    expect(heatIntensityLevel(20, 10)).toBe(4);
  });

  it("normalizes profiles and handles missing percentage baselines", () => {
    expect(normalizePair(2, 4)).toEqual({ left: 50, right: 100 });
    expect(percentageChangeLabel(0, null)).toBe("Brak wartości bazowej do obliczenia zmiany procentowej.");
    expect(percentageChangeLabel(10, 25)).toBe("+25%");
  });
});
