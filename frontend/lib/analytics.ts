import { polishMonthNames, type CompletedYearFilters } from "./completed-games";
import { formatHours } from "./utils";
import type { CompletedGamesYearDashboard } from "../types";

export type TrendMetric = "games" | "time" | "rating";

export function analyticsPeriodLabel(year: number, filters: CompletedYearFilters) {
  return filters.month === undefined ? `${year} rok` : `${polishMonthNames[filters.month - 1]} ${year}`;
}

export function buildAnalyticsInsights(dashboard: CompletedGamesYearDashboard) {
  const insights: string[] = [];
  if (dashboard.most_active_month) {
    insights.push(
      `Najwięcej gier ukończono w ${monthLocative(dashboard.most_active_month.month)} — ${dashboard.most_active_month.completed_games_count}.`
    );
  }
  const topPlatform = dashboard.platforms.find((item) => item.label !== "Brak platformy");
  if (topPlatform) insights.push(`Najczęściej wybieraną platformą była ${topPlatform.label}.`);
  if (dashboard.best_rated_game?.rating != null) {
    insights.push(`Najwyżej ocenioną grą była ${dashboard.best_rated_game.title} — ${formatNumber(dashboard.best_rated_game.rating)}/10.`);
  }
  if (dashboard.average_playtime_hours != null) {
    insights.push(`Średni czas ukończenia gry z podanym czasem wyniósł ${formatHours(dashboard.average_playtime_hours)}`);
  }
  return insights.slice(0, 4);
}

export function trendValue(
  month: CompletedGamesYearDashboard["monthly"][number],
  metric: TrendMetric
) {
  if (metric === "games") return month.completed_games_count;
  if (metric === "time") return month.total_playtime_hours;
  return month.average_rating ?? 0;
}

export function trendValueLabel(value: number, metric: TrendMetric, hasRating = true) {
  if (metric === "games") return new Intl.NumberFormat("pl-PL").format(value);
  if (metric === "time") return formatHours(value);
  return hasRating ? `${formatNumber(value)}/10` : "Brak ocen";
}

function monthLocative(month: number) {
  return [
    "styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu",
    "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"
  ][month - 1];
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value);
}
