import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { navItems } from "../components/layout/nav-items";
import { APP_NAME } from "../lib/app-config";

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("application UI configuration", () => {
  it("uses the Games Tracker name in shared frontend configuration and PWA manifest", () => {
    const manifest = JSON.parse(readProjectFile("public/manifest.webmanifest"));

    expect(APP_NAME).toBe("Games Tracker");
    expect(manifest.name).toBe("Games Tracker");
    expect(manifest.short_name).toBe("Games");
  });

  it("does not expose the old application name or private backend text in shared chrome", () => {
    const sidebar = readProjectFile("components/layout/Sidebar.tsx");
    const layout = readProjectFile("app/layout.tsx");
    const manifest = readProjectFile("public/manifest.webmanifest");

    const combined = `${sidebar}\n${layout}\n${manifest}`;

    expect(combined).not.toContain("Games & PoE Private Tracker");
    expect(combined).not.toContain("Games & Path of Exile Tracker");
    expect(combined).not.toContain("Prywatna aplikacja bez kont, logowania i ról");
    expect(combined).not.toContain("Dane zapisuje lokalny backend FastAPI");
  });

  it("removes the settings tab from primary navigation", () => {
    const hrefs = navItems.map((item) => item.href);
    expect(hrefs).not.toContain("/settings");
    expect(navItems.map((item) => item.label)).not.toContain("Ustawienia");
    expect(hrefs).toContain("/analytics");
    expect(navItems).toHaveLength(6);
  });

  it("uses one controlled form submission for RAWG search", () => {
    const search = readProjectFile("components/games/GameSearch.tsx");

    expect(search).toContain("onSubmit={(event) => {");
    expect(search).toContain("event.preventDefault();");
    expect(search).toContain('<Button\n            type="submit"');
    expect(search).not.toContain('onKeyDown={(event) => event.key === "Enter" && startSearch()}');
    expect(search).toContain('<Button type="button" onClick={addSelected}');
  });

  it("exposes all-history analytics as a separate mode instead of a synthetic year", () => {
    const yearlyAnalytics = readProjectFile("app/analytics/[year]/page.tsx");
    const historyAnalytics = readProjectFile("app/analytics/history/page.tsx");

    expect(yearlyAnalytics).toContain('href="/analytics/history"');
    expect(historyAnalytics).toContain("Analizy — Cała historia");
    expect(historyAnalytics).toContain("<AnalyticsHistory />");
  });
});
