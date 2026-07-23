import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardContent } from "../components/dashboard/DashboardContent";
import type { DashboardSummary } from "../types";

const summary: DashboardSummary = {
  games: {
    backlog_count: 2,
    current_year: {
      year: 2026,
      completed_games_count: 2,
      total_playtime_hours: 24.5,
      games_with_playtime_count: 1,
      average_rating: 9,
      rated_games_count: 1,
      most_active_month: { month: 7, completed_games_count: 2, total_playtime_hours: 24.5 },
      top_platform: "PC",
      trend: [
        { month: 6, completed_games_count: 0, total_playtime_hours: 0 },
        { month: 7, completed_games_count: 2, total_playtime_hours: 24.5 }
      ]
    },
    next_backlog_entries: [{ id: 8, position: 0, title: "Next Game", preferred_platform: "PC", note: "Najpierw ta" }],
    recent_completed_games: [{ id: 4, title: "Finished Game", completion_date: "2026-07-10", playtime_hours: 24.5, rating: 9 }]
  },
  poe: {
    character_count: 1,
    playtime_by_version: { poe1: 0, poe2: 240 },
    latest_league: { name: "Test League", game_version: "poe2", characters: 1, playtime_minutes: 240 }
  },
  poe_error: null
};

describe("Dashboard start screen", () => {
  it("shows current-year statistics, recent activity, queue order and useful links", () => {
    const html = renderToStaticMarkup(<DashboardContent summary={summary} />);

    expect(html).toContain("Ekran startowy · 2026");
    expect(html).toContain("Ukończone gry");
    expect(html).toContain("24,5 godz.");
    expect(html).toContain("9/10");
    expect(html).toContain("Finished Game");
    expect(html).toContain("#1 · Next Game");
    expect(html).toContain("Najpierw ta");
    expect(html).toContain('href="/completed-games/new"');
    expect(html).toContain('href="/completed-games/new?backlog=8"');
    expect(html).toContain('href="/backlog"');
    expect(html).toContain('href="/analytics/2026"');
    expect(html).toContain('role="img"');
    expect(html).toContain("Najwięcej gier ukończono w lipcu — 2.");
  });

  it("uses responsive grids, keyboard focus styles and no full analytical views", () => {
    const html = renderToStaticMarkup(<DashboardContent summary={summary} />);

    expect(html).toContain("min-[420px]:grid-cols-2");
    expect(html).toContain("xl:grid-cols-4");
    expect(html).toContain("focus-visible:ring-2");
    expect(html).not.toContain("Heatmapa");
    expect(html).not.toContain("Porównanie miesięcy");
    expect(html).not.toContain("Prognozy");
  });

  it("provides actionable empty states without technical placeholder values", () => {
    const empty: DashboardSummary = {
      games: {
        backlog_count: 0,
        current_year: { year: 2026, completed_games_count: 0, total_playtime_hours: 0, games_with_playtime_count: 0, average_rating: null, rated_games_count: 0, most_active_month: null, top_platform: null, trend: [] },
        next_backlog_entries: [],
        recent_completed_games: []
      },
      poe: null,
      poe_error: null
    };

    const html = renderToStaticMarkup(<DashboardContent summary={empty} />);

    expect(html).toContain("Brak ukończonych gier w 2026 roku");
    expect(html).toContain("Lista Do ogrania jest pusta");
    expect(html).toContain("Brak danych");
    expect(html).toContain("Brak ocen");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
    expect(html).not.toContain("null");
  });

  it("keeps the game dashboard visible when the optional PoE section fails", () => {
    const partial = { ...summary, poe: null, poe_error: "Nie udało się pobrać skrótu Path of Exile. Dane gier są nadal dostępne." };
    const html = renderToStaticMarkup(<DashboardContent summary={partial} />);

    expect(html).toContain("Finished Game");
    expect(html).toContain("Nie udało się pobrać skrótu Path of Exile");
    expect(html).toContain('role="alert"');
  });
});
