"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Flame, RotateCcw } from "lucide-react";

import { GameCover } from "@/components/games/GameCover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { allYearDateKeys, heatIntensityLevel, replaceAnalyticsSearchParams } from "@/lib/analytics-sections";
import { polishMonthNames } from "@/lib/completed-games";
import { formatHours } from "@/lib/utils";
import { api } from "@/services/api";
import type { CompletedGamesDayActivity, CompletedGamesYearActivity } from "@/types";

type HeatMetric = "games" | "time" | "rating";

export function AnalyticsHeatmap({ year }: { year: number }) {
  const searchParams = useSearchParams();
  const [metric, setMetric] = useState<HeatMetric>(() => parseHeatMetric(searchParams.get("heatMetric")));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(() => searchParams.get("day"));
  const [data, setData] = useState<CompletedGamesYearActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api.getCompletedYearActivity(year, controller.signal)
      .then(setData)
      .catch((reason) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Nie udało się pobrać aktywności."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry, year]);

  const byDate = useMemo(() => new Map((data?.days ?? []).map((item) => [item.date, item])), [data]);
  const selectedDay = selectedDayKey ? byDate.get(selectedDayKey) ?? null : null;

  function selectMetric(value: HeatMetric) {
    setMetric(value);
    replaceAnalyticsSearchParams(searchParams, { section: "heatmap", heatMetric: value, day: selectedDayKey });
  }

  function selectDay(value: string) {
    setSelectedDayKey(value);
    replaceAnalyticsSearchParams(searchParams, { section: "heatmap", heatMetric: metric, day: value });
  }

  if (loading && !data) return <LoadingState label="Ładowanie aktywności dziennej" />;
  if (error && !data) return <div className="space-y-3"><ErrorState message={error} /><Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}><RotateCcw className="h-4 w-4" aria-hidden="true" />Spróbuj ponownie</Button></div>;
  if (!data?.days.length) return <EmptyHeatmap year={year} />;

  return (
    <section className="space-y-6" aria-labelledby="heatmap-heading">
      <div><p className="text-sm font-semibold text-primary">Aktywność dzienna</p><h2 id="heatmap-heading" className="mt-1 text-2xl font-bold">Heatmapa aktywności — {year}</h2></div>
      {loading ? <p className="text-sm text-muted-foreground" role="status">Aktualizowanie aktywności…</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <HeatmapView year={year} days={byDate} metric={metric} onMetricChange={selectMetric} onDayChange={selectDay} />
      <DayDetails day={selectedDay} />
    </section>
  );
}

function HeatmapView({ year, days, metric, onMetricChange, onDayChange }: { year: number; days: Map<string, CompletedGamesDayActivity>; metric: HeatMetric; onMetricChange: (metric: HeatMetric) => void; onDayChange: (day: string) => void }) {
  const dates = allYearDateKeys(year);
  const values = dates.map((value) => heatValue(days.get(value), metric));
  const maximum = Math.max(0, ...values);
  const offset = (new Date(year, 0, 1).getDay() + 6) % 7;
  return <Card className="min-w-0"><CardHeader><CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-primary" aria-hidden="true" />Cały rok</CardTitle><CardDescription>Każda komórka to jeden dzień. Dokładne wartości są dostępne w opisie i po kliknięciu.</CardDescription></CardHeader><CardContent className="min-w-0 space-y-5">
    <div className="flex flex-wrap gap-2" aria-label="Metryka heatmapy">{([{"value":"games","label":"Ukończenia"},{"value":"time","label":"Czas gry"},{"value":"rating","label":"Średnia ocena"}] as Array<{value:HeatMetric;label:string}>).map((item) => <Button key={item.value} type="button" variant={metric === item.value ? "primary" : "secondary"} aria-pressed={metric === item.value} onClick={() => onMetricChange(item.value)}>{item.label}</Button>)}</div>
    <div className="overflow-x-auto pb-2"><div className="mb-2 flex min-w-[760px] justify-between px-1 text-[10px] text-muted-foreground">{polishMonthNames.map((label) => <span key={label}>{label.slice(0, 3)}</span>)}</div><div className="grid min-w-[760px] grid-flow-col grid-rows-7 gap-1" role="img" aria-label={`Heatmapa ${heatMetricLabel(metric)} w ${year} roku`}>{Array.from({ length: offset }, (_, index) => <span key={`offset-${index}`} className="h-3 w-3" />)}{dates.map((value) => { const activity = days.get(value); const intensity = heatIntensityLevel(heatValue(activity, metric), maximum); return <button key={value} type="button" onClick={() => activity && onDayChange(value)} disabled={!activity} title={heatDescription(value, activity)} aria-label={heatDescription(value, activity)} className={`h-3 w-3 rounded-[2px] border border-white/5 ${heatClasses[intensity]} enabled:hover:ring-2 enabled:hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} />; })}</div></div>
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Mniej</span>{heatClasses.map((className, index) => <i key={className} className={`h-3 w-3 rounded-[2px] ${className}`} aria-label={`Poziom intensywności ${index}`} />)}<span>Więcej</span></div>
  </CardContent></Card>;
}

function DayDetails({ day }: { day: CompletedGamesDayActivity | null }) {
  if (!day) return <Card className="border-dashed"><CardContent className="p-5 text-sm text-muted-foreground">Wybierz aktywny dzień, aby zobaczyć ukończone gry.</CardContent></Card>;
  return <Card><CardHeader><CardTitle>{new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(new Date(`${day.date}T12:00:00`))}</CardTitle><CardDescription>{day.completed_games_count} ukończeń · {day.total_playtime_hours ? formatHours(day.total_playtime_hours) : "Brak danych o czasie"}</CardDescription></CardHeader><CardContent><ul className="space-y-2">{day.games.map((game) => <li key={game.id}><Link href={`/completed-games/entry/${game.id}`} className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-md border border-border bg-background/45 p-2 transition hover:border-accent/70"><GameCover src={game.cover_url} title={game.title} alt="" variant="thumbnail" className="w-10" /><span className="min-w-0"><strong className="block truncate">{game.title}</strong><span className="block text-xs text-muted-foreground">{game.playtime_hours > 0 ? formatHours(game.playtime_hours) : "Brak czasu"} · {game.rating == null ? "Brak oceny" : `${game.rating}/10`} · {game.platform ?? "Brak platformy"}</span><span className="block truncate text-xs text-muted-foreground">{game.genres?.join(", ") || "Brak gatunku"}</span></span></Link></li>)}</ul></CardContent></Card>;
}

function EmptyHeatmap({ year }: { year: number }) { return <Card className="border-dashed"><CardContent className="p-8 text-center"><p className="font-semibold">Brak ukończeń w {year} roku.</p><p className="mt-1 text-sm text-muted-foreground">Heatmapa pojawi się po dodaniu ukończonej gry.</p></CardContent></Card>; }
function parseHeatMetric(value: string | null): HeatMetric { return value === "time" || value === "rating" ? value : "games"; }
function heatValue(day: CompletedGamesDayActivity | undefined, metric: HeatMetric) { if (!day) return 0; if (metric === "games") return day.completed_games_count; if (metric === "time") return day.total_playtime_hours; return day.average_rating ?? 0; }
function heatMetricLabel(metric: HeatMetric) { return metric === "games" ? "liczby ukończeń" : metric === "time" ? "czasu gry" : "średniej oceny"; }
function heatDescription(value: string, day?: CompletedGamesDayActivity) { return `${new Intl.DateTimeFormat("pl-PL").format(new Date(`${value}T12:00:00`))}: ${day?.completed_games_count ?? 0} ukończeń, ${day?.total_playtime_hours ? formatHours(day.total_playtime_hours) : "brak czasu"}, ${day?.average_rating == null ? "brak ocen" : `średnia ${day.average_rating}/10`}`; }
const heatClasses = ["bg-slate-800", "bg-emerald-950", "bg-emerald-800", "bg-emerald-600", "bg-emerald-400"];
