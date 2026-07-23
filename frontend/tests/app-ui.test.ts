import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isNavItemActive,
  mobileMoreGroups,
  mobilePrimaryItems,
  navGroups,
  navItems
} from "../components/layout/nav-items";
import { APP_NAME } from "../lib/app-config";

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("application UI configuration", () => {
  it("uses the Games Tracker name in shared frontend configuration and PWA manifest", () => {
    const manifest = JSON.parse(readProjectFile("public/manifest.webmanifest"));

    expect(APP_NAME).toBe("Games Tracker");
    expect(manifest.name).toBe("Games Tracker");
    expect(manifest.short_name).toBe("Games Tracker");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192" }),
      expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512" }),
      expect.objectContaining({ src: "/icons/icon-maskable.svg", purpose: "maskable" })
    ]));
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

  it("groups navigation and keeps mobile navigation focused on primary destinations", () => {
    const hrefs = navItems.map((item) => item.href);
    expect(hrefs).not.toContain("/settings");
    expect(navItems.map((item) => item.label)).not.toContain("Ustawienia");
    expect(navGroups.map((group) => group.label)).toEqual(["Główne", "Statystyki", "Dodatkowe"]);
    expect(navGroups[0].items.map((item) => item.href)).toEqual(["/", "/backlog", "/completed-games", "/poe"]);
    expect(mobilePrimaryItems.map((item) => item.href)).toEqual(["/", "/backlog", "/completed-games", "/poe"]);
    expect(mobileMoreGroups.flatMap((group) => group.items.map((item) => item.href))).toEqual([
      "/analytics",
      "/releases",
      "/chatbot",
      "/backup"
    ]);
    expect(navItems).toHaveLength(8);
  });

  it("matches active navigation without marking similarly prefixed routes", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/backlog/12", "/backlog")).toBe(true);
    expect(isNavItemActive("/backlog-extra", "/backlog")).toBe(false);
    expect(isNavItemActive("/analytics/history", "/analytics")).toBe(true);
  });

  it("uses one backup manager on its dedicated route", () => {
    const dashboard = readProjectFile("app/page.tsx");
    const backup = readProjectFile("app/backup/page.tsx");

    expect(dashboard).not.toContain("<BackupManager");
    expect(backup).toContain("<BackupManager />");
    expect(backup).toContain("Kopia danych");
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

  it("keeps discovery outside analytics and out of primary mobile navigation", () => {
    const backlog = readProjectFile("app/backlog/page.tsx");
    const releases = readProjectFile("app/releases/page.tsx");
    const recommendations = readProjectFile("components/games/GameRecommendations.tsx");

    expect(mobilePrimaryItems.map((item) => item.href)).not.toContain("/releases");
    expect(backlog).toContain('href="/releases"');
    expect(backlog).toContain("<GameRecommendations");
    expect(backlog.indexOf("<GameRecommendations")).toBeGreaterThan(backlog.indexOf("<BacklogList"));
    expect(releases).toContain("Premiery");
    expect(releases).toContain("Dla Ciebie");
    expect(releases).toContain("Wszystkie premiery");
    expect(releases).toContain("Ukryte premiery");
    expect(releases).toContain("Nie interesuje mnie");
    expect(releases).toContain("getRecommendedGameReleases");
    expect(releases).toContain("saveGameReleasePreferences");
    expect(releases).toContain("matchLevel");
    expect(recommendations).toContain("Polecane dla Ciebie");
    expect(recommendations).toContain("Dodaj do ogrania");
    expect(recommendations).toContain("Pasuje do mnie");
    expect(recommendations).toContain("Nie dla mnie");
    expect(recommendations).toContain("Cofnij opinię");
    expect(recommendations).toContain("saveGameRecommendationFeedback");
  });

  it("uses a same-origin API path with a development-only backend proxy", () => {
    const apiService = readProjectFile("services/api.ts");
    const nextConfig = readProjectFile("next.config.mjs");
    const startScript = readFileSync(join(process.cwd(), "..", "scripts", "start_app.ps1"), "utf8");

    expect(apiService).toContain('process.env.NEXT_PUBLIC_API_URL ?? "/api"');
    expect(nextConfig).toContain('process.env.NODE_ENV !== "development"');
    expect(nextConfig).toContain('source: "/api/:path*"');
    expect(nextConfig).toContain('destination: "http://127.0.0.1:8000/api/:path*"');
    expect(nextConfig).toContain("devIndicators: false");
    expect(startScript).toContain('$LocalApiSetting = "NEXT_PUBLIC_API_URL=/api"');
    expect(startScript).toContain("Zmieniono lokalny adres API na /api");
  });
});
