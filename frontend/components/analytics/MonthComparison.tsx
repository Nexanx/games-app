"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Legend, PolarAngleAxis, PolarGrid, Radar, RadarChart, Tooltip, XAxis, YAxis } from "recharts";
import { ResponsiveContainer } from "@/components/analytics/AnalyticsChartContainer";

import { GameCover } from "@/components/games/GameCover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/select";
import { polishMonthNames } from "@/lib/completed-games";
import { normalizePair, percentageChangeLabel, replaceAnalyticsSearchParams } from "@/lib/analytics-sections";
import { formatHours } from "@/lib/utils";
import { api } from "@/services/api";
import type { CompletedGamesMonthComparison, CompletedGamesMonthPeriod, CompletedGamesPeriodDifference } from "@/types";

const metricLabels: Record<string, string> = {
  completed_games_count: "Ukończone gry", total_playtime_hours: "Łączny czas",
  average_playtime_hours: "Średni czas", median_playtime_hours: "Mediana czasu",
  average_rating: "Średnia ocena", median_rating: "Mediana ocen", rated_games_count: "Ocenione gry",
  unique_platforms_count: "Różne platformy", unique_genres_count: "Różne gatunki"
};

export function MonthComparison({ year }: { year: number }) {
  const searchParams = useSearchParams();
  const defaultB = year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
  const defaultA = Math.max(1, defaultB - 1);
  const [months, setMonths] = useState(() => initialMonths(searchParams, defaultA, defaultB));
  const { monthA, monthB } = months;
  const [data, setData] = useState<CompletedGamesMonthComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    api.compareCompletedMonths(year, monthA, monthB, controller.signal)
      .then(setData)
      .catch((reason) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Nie udało się porównać miesięcy."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [monthA, monthB, retry, year]);

  function setMonth(key: "monthA" | "monthB", value: number) {
    const next = { ...months, [key]: value };
    setMonths(next);
    replaceAnalyticsSearchParams(searchParams, { section: "compare", monthA: String(next.monthA), monthB: String(next.monthB) });
  }

  return <section className="space-y-6" aria-labelledby="month-comparison-heading">
    <div><p className="text-sm font-semibold text-primary">Dwa okresy obok siebie</p><h2 id="month-comparison-heading" className="mt-1 text-2xl font-bold">Porównanie miesięcy — {year}</h2></div>
    <Card><CardHeader><CardTitle>Wybierz miesiące</CardTitle><CardDescription>Miesiące muszą być różne. Wybór jest zapisany w adresie URL.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1.5 text-sm"><span className="font-semibold">Pierwszy miesiąc</span><Select value={monthA} onChange={(event) => setMonth("monthA", Number(event.target.value))}>{polishMonthNames.map((label, index) => <option key={label} value={index + 1} disabled={index + 1 === monthB}>{label}</option>)}</Select></label>
      <label className="space-y-1.5 text-sm"><span className="font-semibold">Drugi miesiąc</span><Select value={monthB} onChange={(event) => setMonth("monthB", Number(event.target.value))}>{polishMonthNames.map((label, index) => <option key={label} value={index + 1} disabled={index + 1 === monthA}>{label}</option>)}</Select></label>
    </CardContent></Card>
    {loading && !data ? <LoadingState label="Porównywanie miesięcy" /> : null}
    {loading && data ? <p className="text-sm text-muted-foreground" role="status">Aktualizowanie porównania…</p> : null}
    {error ? <div className="space-y-3"><ErrorState message={error} /><Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>Spróbuj ponownie</Button></div> : null}
    {data ? <div aria-busy={loading}><ComparisonContent data={data} /></div> : null}
  </section>;
}

function ComparisonContent({ data }: { data: CompletedGamesMonthComparison }) {
  const chartData = [
    { metric: "Gry", a: data.month_a.summary.completed_games_count, b: data.month_b.summary.completed_games_count },
    { metric: "Platformy", a: data.month_a.summary.unique_platforms_count, b: data.month_b.summary.unique_platforms_count },
    { metric: "Gatunki", a: data.month_a.summary.unique_genres_count, b: data.month_b.summary.unique_genres_count }
  ];
  const radarData = useMemo(() => normalizedRadar(data), [data]);
  return <div className="space-y-6">
    <div className="grid gap-4 lg:grid-cols-2"><MonthCard period={data.month_a} /><MonthCard period={data.month_b} /></div>
    <Card><CardHeader><CardTitle>Tabela porównawcza</CardTitle><CardDescription>Zmiana oznacza wartość drugiego miesiąca minus wartość pierwszego. Nie jest automatycznie oceniana jako dobra lub zła.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="p-2">Metryka</th><th className="p-2">{polishMonthNames[data.month_a.month - 1]}</th><th className="p-2">{polishMonthNames[data.month_b.month - 1]}</th><th className="p-2">Różnica</th><th className="p-2">Zmiana procentowa</th></tr></thead><tbody>{data.differences.map((item) => <DifferenceRow key={item.metric} difference={item} />)}</tbody></table></CardContent></Card>
    <div className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Porównanie kategorii</CardTitle><CardDescription>Grupowane słupki obejmują metryki w tej samej jednostce — liczby kategorii lub gier.</CardDescription></CardHeader><CardContent><div className="h-72" role="img" aria-label="Porównanie liczby gier, platform i gatunków"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="metric" stroke="#94a3b8" /><YAxis allowDecimals={false} stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} /><Legend /><Bar dataKey="a" name={polishMonthNames[data.month_a.month - 1]} fill="#34d399" isAnimationActive={false} /><Bar dataKey="b" name={polishMonthNames[data.month_b.month - 1]} fill="#22d3ee" isAnimationActive={false} /></BarChart></ResponsiveContainer></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Znormalizowany profil miesięcy</CardTitle><CardDescription>Radar pokazuje wartości znormalizowane do 0–100 względem lepszego wyniku z tych dwóch miesięcy. Nie są to bezpośrednio godziny ani oceny.</CardDescription></CardHeader><CardContent><div className="h-72" role="img" aria-label="Znormalizowany radar profilu miesięcy"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData}><PolarGrid stroke="#475569" /><PolarAngleAxis dataKey="metric" stroke="#94a3b8" /><Radar name={polishMonthNames[data.month_a.month - 1]} dataKey="a" stroke="#34d399" fill="#34d399" fillOpacity={0.2} isAnimationActive={false} /><Radar name={polishMonthNames[data.month_b.month - 1]} dataKey="b" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.2} isAnimationActive={false} /><Legend /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Math.round(Number(value))}%`, "Wartość znormalizowana"]} /></RadarChart></ResponsiveContainer></div></CardContent></Card>
    </div>
    <div className="grid gap-4 xl:grid-cols-2"><GameList period={data.month_a} /><GameList period={data.month_b} /></div>
  </div>;
}

function MonthCard({ period }: { period: CompletedGamesMonthPeriod }) { const s = period.summary; return <Card><CardHeader><CardTitle>{polishMonthNames[period.month - 1]}</CardTitle>{!s.completed_games_count ? <CardDescription>Brak ukończeń w tym miesiącu.</CardDescription> : null}</CardHeader><CardContent><dl className="grid grid-cols-2 gap-3 text-sm"><Metric label="Ukończone" value={String(s.completed_games_count)} /><Metric label="Łączny czas" value={s.games_with_playtime_count ? formatHours(s.total_playtime_hours) : "Brak danych"} /><Metric label="Średni czas" value={s.average_playtime_hours == null ? "Brak danych" : formatHours(s.average_playtime_hours)} /><Metric label="Mediana czasu" value={s.median_playtime_hours == null ? "Brak danych" : formatHours(s.median_playtime_hours)} /><Metric label="Średnia ocena" value={s.average_rating == null ? "Brak ocen" : `${formatNumber(s.average_rating)}/10`} /><Metric label="Mediana ocen" value={s.median_rating == null ? "Brak ocen" : `${formatNumber(s.median_rating)}/10`} /><Metric label="Top platforma" value={s.top_platform?.label ?? "Brak danych"} /><Metric label="Top gatunek" value={s.top_genre?.label ?? "Brak danych"} /></dl></CardContent></Card>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-muted/55 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>; }
function DifferenceRow({ difference }: { difference: CompletedGamesPeriodDifference }) { const label = metricLabels[difference.metric] ?? difference.metric; return <tr className="border-b border-border/60"><th className="p-2 font-medium">{label}</th><td className="p-2">{formatDifferenceValue(difference.previous_value, difference.metric)}</td><td className="p-2">{formatDifferenceValue(difference.current_value, difference.metric)}</td><td className="p-2">{formatSigned(difference.absolute_change, difference.metric)}</td><td className="p-2">{percentageChangeLabel(difference.previous_value, difference.percentage_change)}</td></tr>; }
function GameList({ period }: { period: CompletedGamesMonthPeriod }) { return <Card><CardHeader><CardTitle>Gry — {polishMonthNames[period.month - 1]}</CardTitle></CardHeader><CardContent>{period.games.length ? <ul className="space-y-2">{period.games.map((game) => <li key={game.id}><Link href={`/completed-games/entry/${game.id}`} className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-md border border-border bg-background/45 p-2 hover:border-accent"><GameCover src={game.cover_url} title={game.title} alt="" variant="thumbnail" className="w-10" /><span className="min-w-0"><strong className="block truncate">{game.title}</strong><span className="block text-xs text-muted-foreground">{game.playtime_hours > 0 ? formatHours(game.playtime_hours) : "Brak czasu"} · {game.rating == null ? "Brak oceny" : `${formatNumber(game.rating)}/10`} · {game.platform ?? "Brak platformy"}</span><span className="block truncate text-xs text-muted-foreground">{game.genres?.join(", ") || "Brak gatunku"}</span></span></Link></li>)}</ul> : <p className="text-sm text-muted-foreground">Brak ukończeń w tym miesiącu.</p>}</CardContent></Card>; }

function normalizedRadar(data: CompletedGamesMonthComparison) { const a = data.month_a.summary; const b = data.month_b.summary; const rows = [["Gry", a.completed_games_count, b.completed_games_count],["Czas", a.total_playtime_hours, b.total_playtime_hours],["Ocena", a.average_rating ?? 0, b.average_rating ?? 0],["Gatunki", a.unique_genres_count, b.unique_genres_count],["Platformy", a.unique_platforms_count, b.unique_platforms_count]] as Array<[string,number,number]>; return rows.map(([metric,left,right]) => { const normalized = normalizePair(left, right); return {metric,a:normalized.left,b:normalized.right}; }); }
function formatDifferenceValue(value: number | null | undefined, metric: string) { if (value == null) return "Brak danych"; if (metric.includes("playtime") || metric === "total_playtime_hours") return formatHours(value); if (metric.includes("rating")) return `${formatNumber(value)}/10`; return formatNumber(value); }
function formatSigned(value: number | null | undefined, metric: string) { if (value == null) return "Brak danych"; const prefix = value > 0 ? "+" : value < 0 ? "−" : ""; if (metric.includes("playtime") || metric === "total_playtime_hours") return `${prefix}${formatHours(Math.abs(value))}`; return `${value > 0 ? "+" : ""}${formatNumber(value)}`; }
function formatNumber(value: number) { return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value); }
function validMonth(value: number) { return Number.isInteger(value) && value >= 1 && value <= 12; }
function initialMonths(searchParams: Pick<URLSearchParams, "get">, defaultA: number, defaultB: number) {
  const parsedA = Number(searchParams.get("monthA"));
  const parsedB = Number(searchParams.get("monthB"));
  const monthA = validMonth(parsedA) ? parsedA : defaultA;
  const monthB = validMonth(parsedB) && parsedB !== monthA ? parsedB : defaultB === monthA ? Math.min(12, monthA + 1) : defaultB;
  return { monthA, monthB };
}
const tooltipStyle = { backgroundColor: "#020617", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" };
