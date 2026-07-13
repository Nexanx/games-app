import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnalyticsSectionNav } from "../components/analytics/AnalyticsSectionNav";
import { YearNavigation } from "../components/games/YearNavigation";

describe("compact year navigation", () => {
  it("shows adjacent available years, counts and an expandable list without a select panel", () => {
    const html = renderToStaticMarkup(
      <YearNavigation
        year={2026}
        years={[
          { year: 2027, completed_games_count: 3 },
          { year: 2026, completed_games_count: 11 },
          { year: 2024, completed_games_count: 2 }
        ]}
        hrefForYear={(year) => `/analytics/${year}`}
        ariaLabel="Wybór roku analiz"
      />
    );

    expect(html).toContain("Wybór roku analiz");
    expect(html).toContain('href="/analytics/2024"');
    expect(html).toContain('href="/analytics/2027"');
    expect(html).toContain("11 gier");
    expect(html).toContain("Inne lata");
    expect(html).toContain("<details");
    expect(html).not.toContain("<select");
  });

  it("offers the current calendar year as an empty view without inventing other empty years", () => {
    const html = renderToStaticMarkup(
      <YearNavigation
        year={2026}
        years={[{ year: 2024, completed_games_count: 2 }]}
        hrefForYear={(year) => `/completed-games/${year}`}
        ariaLabel="Wybór roku ukończonych gier"
        currentCalendarYear={2026}
      />
    );

    expect(html).toContain("0 gier");
    expect(html).toContain('href="/completed-games/2024"');
    expect(html).not.toContain("2025");
  });
});

describe("analytics section navigation", () => {
  it("renders six responsive sections and marks the active one", () => {
    const html = renderToStaticMarkup(<AnalyticsSectionNav year={2026} active="heatmap" />);

    expect((html.match(/href="\/analytics\/2026/g) ?? [])).toHaveLength(6);
    expect(html).toContain("Podsumowanie");
    expect(html).toContain("Porównanie miesięcy");
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain("Kalendarz");
  });
});
