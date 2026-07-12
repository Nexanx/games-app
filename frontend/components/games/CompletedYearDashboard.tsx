"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, Clock3, Gamepad2, ListOrdered, Star, Timer, Trophy } from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";
import { GameCover } from "@/components/games/GameCover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAnalyticsInsights, trendValue, trendValueLabel, type TrendMetric } from "@/lib/analytics";
import { completedYearFiltersToSearchParams, polishMonthNames, type CompletedYearFilters } from "@/lib/completed-games";
import { asDate, formatHours } from "@/lib/utils";
import type { CompletedGameHighlight, CompletedGamesDistributionItem, CompletedGamesYearDashboard } from "@/types";

const trendMetrics: Array<{ value: TrendMetric; label: string }> = [
  { value: "games", label: "Ukończone gry" },
  { value: "time", label: "Czas gry" },
  { value: "rating", label: "Średnia ocena" }
];

export function CompletedYearDashboard({
  dashboard,
  filters
}: {
  dashboard: CompletedGamesYearDashboard;
  filters: CompletedYearFilters;
}) {
  const insights = useMemo(() => buildAnalyticsInsights(dashboard), [dashboard]);
  const timeContext = dashboard.games_with_playtime_count < dashboard.completed_games_count
    ? `Dane dla ${dashboard.games_with_playtime_count} z ${dashboard.completed_games_count} wpisów`
    : "Na podstawie wpisów z podanym czasem";

  return (
    <section className="min-w-0 space-y-6" aria-labelledby="year-summary-heading">
      <div>
        <p className="text-sm font-semibold text-primary">Najważniejsze podsumowanie</p>
        <h2 id="year-summary-heading" className="mt-1 text-xl font-bold">Statystyki {dashboard.year}</h2>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Ukończone gry" value={dashboard.completed_games_count} helper="W wybranym okresie" icon={Gamepad2} accent="text-emerald-300" />
        <StatCard label="Łączny czas gry" value={dashboard.games_with_playtime_count ? formatHours(dashboard.total_playtime_hours) : "Brak danych"} helper={timeContext} icon={Timer} accent="text-amber-300" />
        <StatCard label="Średni czas jednej gry" value={dashboard.average_playtime_hours == null ? "Brak danych" : formatHours(dashboard.average_playtime_hours)} helper={timeContext} icon={Clock3} accent="text-cyan-300" />
        <StatCard label="Średnia ocena" value={dashboard.average_rating == null ? "Brak ocen" : `${formatNumber(dashboard.average_rating)}/10`} helper={dashboard.rated_games_count ? `${dashboard.rated_games_count} ocenionych wpisów` : undefined} icon={Star} accent="text-yellow-300" />
        <StatCard label="Najlepiej oceniona gra" value={dashboard.best_rated_game?.title ?? "Brak ocen"} helper={dashboard.best_rated_game?.rating == null ? undefined : `${formatNumber(dashboard.best_rated_game.rating)}/10`} icon={Trophy} accent="text-violet-300" />
        <StatCard label="Najbardziej aktywny miesiąc" value={dashboard.most_active_month ? polishMonthNames[dashboard.most_active_month.month - 1] : "Brak danych"} helper={dashboard.most_active_month ? completionCountLabel(dashboard.most_active_month.completed_games_count) : undefined} icon={CalendarDays} accent="text-primary" />
      </div>

      {insights.length ? (
        <Card>
          <CardHeader><CardTitle>Najważniejsze wnioski</CardTitle></CardHeader>
          <CardContent><ul className="grid gap-2 text-sm sm:grid-cols-2">{insights.map((insight) => <li key={insight} className="rounded-md bg-muted/55 p-3">{insight}</li>)}</ul></CardContent>
        </Card>
      ) : null}

      <MonthlyTrend dashboard={dashboard} filters={filters} />

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <DistributionCard title="Platformy" description="Udział według platformy zapisanej przy ukończeniu." items={dashboard.platforms} kind="platform" year={dashboard.year} filters={filters} />
        <DistributionCard title="Gatunki" description="Procent oznacza udział ukończonych gier z danym gatunkiem. Gra wielogatunkowa jest liczona w każdej kategorii, więc suma może przekroczyć 100%." items={dashboard.genres} kind="genre" year={dashboard.year} filters={filters} />
      </div>

      <section className="space-y-3" aria-labelledby="rankings-heading">
        <div><p className="text-sm font-semibold text-primary">Szczegółowe dane</p><h2 id="rankings-heading" className="mt-1 text-xl font-bold">Rankingi gier</h2></div>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <RankingCard title="Najlepiej ocenione" entries={dashboard.best_rated_games} metric={(entry) => entry.rating == null ? "Brak oceny" : `${formatNumber(entry.rating)}/10`} empty="Brak ocen w wybranym okresie" />
          <RankingCard title="Najdłuższe" entries={dashboard.longest_games} metric={(entry) => formatHours(entry.playtime_hours)} empty="Brak danych o czasie gry" />
          <RankingCard title="Najnowsze ukończenia" entries={dashboard.latest_completions} empty="Brak ukończeń" />
        </div>
        {dashboard.shortest_games.length ? <details className="rounded-lg border border-border bg-card/70 p-4"><summary className="cursor-pointer font-semibold">Pokaż najkrótsze ukończone gry</summary><div className="mt-3"><RankingList entries={dashboard.shortest_games} metric={(entry) => formatHours(entry.playtime_hours)} /></div></details> : null}
      </section>
    </section>
  );
}

function MonthlyTrend({ dashboard, filters }: { dashboard: CompletedGamesYearDashboard; filters: CompletedYearFilters }) {
  const [metric, setMetric] = useState<TrendMetric>("games");
  const maximum = Math.max(1, ...dashboard.monthly.map((month) => trendValue(month, metric)));
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />Trend miesięczny</CardTitle>
        <CardDescription>Pełny rok od stycznia do grudnia. Kliknij miesiąc, aby przejść do wpisów źródłowych.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-5">
        <div className="flex flex-wrap gap-2" aria-label="Metryka wykresu">
          {trendMetrics.map((item) => <Button key={item.value} type="button" className="min-h-9 px-3 py-1.5 text-sm" variant={metric === item.value ? "primary" : "secondary"} aria-pressed={metric === item.value} onClick={() => setMetric(item.value)}>{item.label}</Button>)}
        </div>
        <div className="grid h-60 min-w-0 grid-cols-12 items-end gap-1 border-b border-l border-border px-1 pt-4 sm:gap-2" role="img" aria-label={`Trend miesięczny: ${trendMetrics.find((item) => item.value === metric)?.label}`}>
          {dashboard.monthly.map((month) => {
            const value = trendValue(month, metric);
            const hasRating = month.average_rating != null;
            const hasTime = month.games_with_playtime_count > 0;
            const hasMetricData = metric !== "rating" || hasRating;
            const hasVisibleValue = metric !== "time" || hasTime;
            const query = completedYearFiltersToSearchParams({ ...filters, month: month.month }).toString();
            return (
              <Link key={month.month} href={`/completed-games/${dashboard.year}?${query}`} className="group flex h-full min-w-0 flex-col items-center justify-end gap-1 focus-visible:rounded" title={`${polishMonthNames[month.month - 1]}: ${hasVisibleValue ? trendValueLabel(value, metric, hasRating) : "Brak danych o czasie gry"}`}>
                <span className="text-[10px] tabular-nums text-muted-foreground sm:text-xs">{!hasMetricData || !hasVisibleValue ? "–" : formatCompact(value)}</span>
                <span className="w-full min-w-1 rounded-t bg-emerald-400 transition group-hover:bg-emerald-300" style={{ height: `${value ? Math.max(5, value / maximum * 100) : 0}%` }} />
                <span className="pb-1 text-[10px] text-muted-foreground sm:hidden">{polishMonthNames[month.month - 1].slice(0, 1)}</span>
                <span className="hidden pb-1 text-[10px] text-muted-foreground sm:block">{polishMonthNames[month.month - 1].slice(0, 3)}</span>
              </Link>
            );
          })}
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Pokaż dane wykresu w tabeli</summary>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="pb-2">Miesiąc</th><th className="pb-2">Gry</th><th className="pb-2">Czas</th><th className="pb-2">Średnia ocena</th></tr></thead><tbody>{dashboard.monthly.map((month) => <tr key={month.month} className="border-b border-border/60 last:border-0"><td className="py-2 font-medium">{polishMonthNames[month.month - 1]}</td><td>{month.completed_games_count}</td><td>{month.games_with_playtime_count ? formatHours(month.total_playtime_hours) : "Brak danych"}</td><td>{month.average_rating == null ? "Brak ocen" : `${formatNumber(month.average_rating)}/10`}</td></tr>)}</tbody></table></div>
        </details>
      </CardContent>
    </Card>
  );
}

function DistributionCard({ title, description, items, kind, year, filters }: { title: string; description: string; items: CompletedGamesDistributionItem[]; kind: "platform" | "genre"; year: number; filters: CompletedYearFilters }) {
  const visible = items.slice(0, 6);
  return <Card className="min-w-0"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="space-y-2">{visible.map((item) => <DistributionRow key={item.label} item={item} kind={kind} year={year} filters={filters} />)}{items.length > visible.length ? <details className="pt-2"><summary className="cursor-pointer text-sm font-semibold">Pokaż wszystkie ({items.length})</summary><div className="mt-2 space-y-2">{items.slice(6).map((item) => <DistributionRow key={item.label} item={item} kind={kind} year={year} filters={filters} />)}</div></details> : null}</CardContent></Card>;
}

function DistributionRow({ item, kind, year, filters }: { item: CompletedGamesDistributionItem; kind: "platform" | "genre"; year: number; filters: CompletedYearFilters }) {
  const canFilter = !item.label.startsWith("Brak ");
  const next = { ...filters, platforms: kind === "platform" ? [item.label] : filters.platforms, genres: kind === "genre" ? [item.label] : filters.genres };
  const content = <><span className="min-w-0 truncate font-medium">{item.label}</span><span className="shrink-0 text-muted-foreground">{item.completed_games_count} {item.percentage != null ? `· ${formatNumber(item.percentage)}%` : ""}</span></>;
  return canFilter ? <Link href={`/completed-games/${year}?${completedYearFiltersToSearchParams(next)}`} className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-background/45 px-3 text-sm transition hover:border-accent/70">{content}</Link> : <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-background/45 px-3 text-sm">{content}</div>;
}

function RankingCard({ title, entries, metric, empty }: { title: string; entries: CompletedGameHighlight[]; metric?: (entry: CompletedGameHighlight) => string; empty: string }) {
  return <Card className="min-w-0"><CardHeader><CardTitle className="flex items-center gap-2"><ListOrdered className="h-5 w-5 text-primary" aria-hidden="true" />{title}</CardTitle></CardHeader><CardContent>{entries.length ? <RankingList entries={entries} metric={metric} /> : <p className="text-sm text-muted-foreground">{empty}</p>}</CardContent></Card>;
}

function RankingList({ entries, metric }: { entries: CompletedGameHighlight[]; metric?: (entry: CompletedGameHighlight) => string }) {
  return <ol className="space-y-2">{entries.map((entry, index) => <li key={entry.id}><Link href={`/completed-games/entry/${entry.id}`} className="grid min-h-14 grid-cols-[1.5rem_2rem_1fr_auto] items-center gap-2 rounded-md border border-border bg-background/45 p-2 text-sm transition hover:border-accent/70"><span className="text-center font-bold text-muted-foreground">{index + 1}</span><GameCover src={entry.cover_url} title={entry.title} alt="" variant="thumbnail" className="w-8" /><span className="min-w-0"><span className="block truncate font-semibold">{entry.title}</span><span className="block text-xs text-muted-foreground">{asDate(entry.completion_date)}</span></span>{metric ? <span className="shrink-0 font-semibold text-accent">{metric(entry)}</span> : null}</Link></li>)}</ol>;
}

function formatNumber(value: number) { return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value); }
function formatCompact(value: number) { return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(value); }
function completionCountLabel(count: number) { return count === 1 ? "1 ukończenie" : count >= 2 && count <= 4 ? `${count} ukończenia` : `${count} ukończeń`; }
