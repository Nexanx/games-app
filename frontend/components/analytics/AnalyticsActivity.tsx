"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Flame, RotateCcw } from "lucide-react";

import { GameCover } from "@/components/games/GameCover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/select";
import { polishMonthNames } from "@/lib/completed-games";
import { allYearDateKeys, heatIntensityLevel } from "@/lib/analytics-sections";
import { formatHours } from "@/lib/utils";
import { api } from "@/services/api";
import type { CompletedGamesDayActivity, CompletedGamesYearActivity } from "@/types";

type Mode = "calendar" | "heatmap";
type HeatMetric = "games" | "time" | "rating";

export function AnalyticsActivity({ year, mode }: { year: number; mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CompletedGamesYearActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    api.getCompletedYearActivity(year, controller.signal)
      .then(setData)
      .catch((reason) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Nie udało się pobrać aktywności."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry, year]);

  const byDate = useMemo(() => new Map((data?.days ?? []).map((item) => [item.date, item])), [data]);
  const dayParam = searchParams.get("day");
  const selectedDay = dayParam ? byDate.get(dayParam) ?? null : null;

  function updateParams(values: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", mode);
    Object.entries(values).forEach(([key, value]) => value === null ? params.delete(key) : params.set(key, value));
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  if (loading) return <LoadingState label="Ładowanie aktywności dziennej" />;
  if (error) return <div className="space-y-3"><ErrorState message={error} /><Button variant="secondary" onClick={() => setRetry((value) => value + 1)}><RotateCcw className="h-4 w-4" aria-hidden="true" />Spróbuj ponownie</Button></div>;
  if (!data?.days.length) return <EmptyActivity year={year} />;

  return (
    <section className="space-y-6" aria-labelledby="activity-heading">
      <div><p className="text-sm font-semibold text-primary">Aktywność dzienna</p><h2 id="activity-heading" className="mt-1 text-2xl font-bold">{mode === "calendar" ? "Kalendarz ukończeń" : "Heatmapa aktywności"} — {year}</h2></div>
      {mode === "calendar" ? <CalendarView year={year} days={byDate} searchParams={searchParams} onUpdate={updateParams} /> : <HeatmapView year={year} days={byDate} searchParams={searchParams} onUpdate={updateParams} />}
      <DayDetails day={selectedDay} />
    </section>
  );
}

function CalendarView({ year, days, searchParams, onUpdate }: { year: number; days: Map<string, CompletedGamesDayActivity>; searchParams: URLSearchParams | ReadonlyURLSearchParamsLike; onUpdate: (values: Record<string, string | null>) => void }) {
  const activeMonths = Array.from(new Set(Array.from(days.keys()).map((value) => Number(value.slice(5, 7)))));
  const requested = Number(searchParams.get("calendarMonth"));
  const month = Number.isInteger(requested) && requested >= 1 && requested <= 12 ? requested : activeMonths.at(-1) ?? new Date().getMonth() + 1;
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, month, 0).getDate();
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />{polishMonthNames[month - 1]}</CardTitle><CardDescription>Wybierz miesiąc, a następnie dzień oznaczony liczbą ukończeń.</CardDescription></CardHeader><CardContent className="space-y-4">
    <label className="block max-w-xs space-y-1.5 text-sm"><span className="font-semibold">Miesiąc kalendarza</span><Select value={month} onChange={(event) => onUpdate({ calendarMonth: event.target.value, day: null })}>{polishMonthNames.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</Select></label>
    <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground" aria-hidden="true">{["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"].map((label) => <span key={label} className="py-1">{label}</span>)}</div>
    <div className="grid grid-cols-7 gap-1">{Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: count }, (_, index) => index + 1).map((day) => { const key = dateKey(year, month, day); const activity = days.get(key); return <button key={key} type="button" disabled={!activity} onClick={() => onUpdate({ day: key })} aria-label={activity ? `${day} ${polishMonthNames[month - 1]}: ${activity.completed_games_count} ukończeń` : `${day} ${polishMonthNames[month - 1]}: brak ukończeń`} className="relative min-h-12 rounded-md border border-border bg-background/45 p-1 text-left text-sm enabled:hover:border-accent enabled:hover:bg-muted disabled:opacity-45"><span>{day}</span>{activity ? <span className="absolute bottom-1 right-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{activity.completed_games_count}</span> : null}</button>; })}</div>
  </CardContent></Card>;
}

function HeatmapView({ year, days, searchParams, onUpdate }: { year: number; days: Map<string, CompletedGamesDayActivity>; searchParams: URLSearchParams | ReadonlyURLSearchParamsLike; onUpdate: (values: Record<string, string | null>) => void }) {
  const raw = searchParams.get("heatMetric");
  const metric: HeatMetric = raw === "time" || raw === "rating" ? raw : "games";
  const dates = allYearDateKeys(year);
  const values = dates.map((value) => heatValue(days.get(value), metric));
  const maximum = Math.max(0, ...values);
  const offset = (new Date(year, 0, 1).getDay() + 6) % 7;
  return <Card className="min-w-0"><CardHeader><CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-primary" aria-hidden="true" />Cały rok</CardTitle><CardDescription>Każda komórka to jeden dzień. Dokładne wartości są dostępne w opisie i po kliknięciu.</CardDescription></CardHeader><CardContent className="min-w-0 space-y-5">
    <div className="flex flex-wrap gap-2" aria-label="Metryka heatmapy">{([{"value":"games","label":"Ukończenia"},{"value":"time","label":"Czas gry"},{"value":"rating","label":"Średnia ocena"}] as Array<{value:HeatMetric;label:string}>).map((item) => <Button key={item.value} type="button" variant={metric === item.value ? "primary" : "secondary"} aria-pressed={metric === item.value} onClick={() => onUpdate({ heatMetric: item.value })}>{item.label}</Button>)}</div>
    <div className="overflow-x-auto pb-2"><div className="mb-2 flex min-w-[760px] justify-between px-1 text-[10px] text-muted-foreground">{polishMonthNames.map((label) => <span key={label}>{label.slice(0, 3)}</span>)}</div><div className="grid min-w-[760px] grid-flow-col grid-rows-7 gap-1" role="img" aria-label={`Heatmapa ${heatMetricLabel(metric)} w ${year} roku`}>{Array.from({ length: offset }, (_, index) => <span key={`offset-${index}`} className="h-3 w-3" />)}{dates.map((value) => { const activity = days.get(value); const intensity = heatIntensityLevel(heatValue(activity, metric), maximum); return <button key={value} type="button" onClick={() => activity && onUpdate({ day: value })} disabled={!activity} title={heatDescription(value, activity)} aria-label={heatDescription(value, activity)} className={`h-3 w-3 rounded-[2px] border border-white/5 ${heatClasses[intensity]} enabled:hover:ring-2 enabled:hover:ring-accent`} />; })}</div></div>
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Mniej</span>{heatClasses.map((className, index) => <i key={className} className={`h-3 w-3 rounded-[2px] ${className}`} aria-label={`Poziom intensywności ${index}`} />)}<span>Więcej</span></div>
  </CardContent></Card>;
}

function DayDetails({ day }: { day: CompletedGamesDayActivity | null }) {
  if (!day) return <Card className="border-dashed"><CardContent className="p-5 text-sm text-muted-foreground">Wybierz aktywny dzień, aby zobaczyć ukończone gry.</CardContent></Card>;
  return <Card><CardHeader><CardTitle>{new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(new Date(`${day.date}T12:00:00`))}</CardTitle><CardDescription>{day.completed_games_count} ukończeń · {day.total_playtime_hours ? formatHours(day.total_playtime_hours) : "Brak danych o czasie"}</CardDescription></CardHeader><CardContent><ul className="space-y-2">{day.games.map((game) => <li key={game.id}><Link href={`/completed-games/entry/${game.id}`} className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-md border border-border bg-background/45 p-2 transition hover:border-accent/70"><GameCover src={game.cover_url} title={game.title} alt="" variant="thumbnail" className="w-10" /><span className="min-w-0"><strong className="block truncate">{game.title}</strong><span className="block text-xs text-muted-foreground">{game.playtime_hours > 0 ? formatHours(game.playtime_hours) : "Brak czasu"} · {game.rating == null ? "Brak oceny" : `${game.rating}/10`} · {game.platform ?? "Brak platformy"}</span><span className="block truncate text-xs text-muted-foreground">{game.genres?.join(", ") || "Brak gatunku"}</span></span></Link></li>)}</ul></CardContent></Card>;
}

function EmptyActivity({ year }: { year: number }) { return <Card className="border-dashed"><CardContent className="p-8 text-center"><p className="font-semibold">Brak ukończeń w {year} roku.</p><p className="mt-1 text-sm text-muted-foreground">Kalendarz i heatmapa pojawią się po dodaniu ukończonej gry.</p></CardContent></Card>; }
function dateKey(year: number, month: number, day: number) { return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }
function heatValue(day: CompletedGamesDayActivity | undefined, metric: HeatMetric) { if (!day) return 0; if (metric === "games") return day.completed_games_count; if (metric === "time") return day.total_playtime_hours; return day.average_rating ?? 0; }
function heatMetricLabel(metric: HeatMetric) { return metric === "games" ? "liczby ukończeń" : metric === "time" ? "czasu gry" : "średniej oceny"; }
function heatDescription(value: string, day?: CompletedGamesDayActivity) { return `${new Intl.DateTimeFormat("pl-PL").format(new Date(`${value}T12:00:00`))}: ${day?.completed_games_count ?? 0} ukończeń, ${day?.total_playtime_hours ? formatHours(day.total_playtime_hours) : "brak czasu"}, ${day?.average_rating == null ? "brak ocen" : `średnia ${day.average_rating}/10`}`; }
const heatClasses = ["bg-slate-800", "bg-emerald-950", "bg-emerald-800", "bg-emerald-600", "bg-emerald-400"];
type ReadonlyURLSearchParamsLike = Pick<URLSearchParams, "get" | "toString">;
