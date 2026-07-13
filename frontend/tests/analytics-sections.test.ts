import { afterEach, describe, expect, it, vi } from "vitest";

import { allYearDateKeys, analyticsSections, analyticsSectionUrl, heatIntensityLevel, normalizePair, parseAnalyticsSection, percentageChangeLabel, replaceAnalyticsSearchParams } from "../lib/analytics-sections";

afterEach(() => vi.unstubAllGlobals());

describe("analytics sections", () => {
  it("keeps supported sections in shareable URLs and falls back to summary", () => {
    expect(parseAnalyticsSection("heatmap")).toBe("heatmap");
    expect(parseAnalyticsSection("calendar")).toBe("summary");
    expect(parseAnalyticsSection("unknown")).toBe("summary");
    expect(analyticsSections).toEqual(["summary", "trends", "heatmap", "compare", "forecast", "report"]);
    expect(analyticsSectionUrl(2026, "compare", new URLSearchParams("monthA=7&monthB=8"))).toBe("/analytics/2026?monthA=7&monthB=8&section=compare");
  });

  it("replaces local analytics parameters without navigation or scrolling", () => {
    const replaceState = vi.fn();
    const scrollTo = vi.fn();
    vi.stubGlobal("window", { history: { state: { route: "analytics" }, replaceState }, scrollTo });

    const url = replaceAnalyticsSearchParams(new URLSearchParams("section=trends&metric=games"), { metric: "time" });

    expect(url).toBe("?section=trends&metric=time");
    expect(replaceState).toHaveBeenCalledWith({ route: "analytics" }, "", "?section=trends&metric=time");
    expect(scrollTo).not.toHaveBeenCalled();
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
