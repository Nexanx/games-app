"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { ResponsiveContainer } from "@/components/analytics/AnalyticsChartContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { historyCategoryChartData, historyYearChartData } from "@/lib/analytics-history";
import { formatHours } from "@/lib/utils";
import { api } from "@/services/api";
import type { CompletedGameHighlight, CompletedGamesHistory } from "@/types";

const colors = ["#34d399", "#22d3ee", "#a78bfa", "#fbbf24", "#fb7185"];
const tooltipStyle = { backgroundColor: "#020617", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" };

export function AnalyticsHistory() {
  const [data, setData] = useState<CompletedGamesHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api.getCompletedGamesHistory(controller.signal)
      .then(setData)
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof Error ? reason.message : "Nie udało się pobrać analizy całej historii.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  if (loading && !data) return <LoadingState label="Analizowanie całej historii" />;
  if (error) return <div className="space-y-3"><ErrorState message={error} /><Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>Spróbuj ponownie</Button></div>;
  if (!data?.summary.completed_games_count) return <Card className="border-dashed"><CardContent className="p-8 text-center"><p className="font-semibold">Brak ukończonych gier do analizy.</p><p className="mt-1 text-sm text-muted-foreground">Podsumowanie całej historii pojawi się po dodaniu pierwszego ukończenia.</p></CardContent></Card>;
  return <HistoryContent data={data} />;
}

function HistoryContent({ data }: { data: CompletedGamesHistory }) {
  const yearly = useMemo(() => historyYearChartData(data.yearly), [data.yearly]);
  const platformData = useMemo(() => historyCategoryChartData(data.yearly, "platforms"), [data.yearly]);
  const genreData = useMemo(() => historyCategoryChartData(data.yearly, "genres"), [data.yearly]);
  const summary = data.summary;
  return <div className="space-y-6" aria-busy={false}>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Podsumowanie całej historii">
      <HistoryStat label="Ukończone gry" value={formatNumber(summary.completed_games_count)} />
      <HistoryStat label="Łączny czas gry" value={summary.games_with_playtime_count ? formatHours(summary.total_playtime_hours) : "Brak danych"} />
      <HistoryStat label="Średnia ocena" value={summary.average_rating == null ? "Brak ocen" : `${formatNumber(summary.average_rating)}/10`} />
      <HistoryStat label="Mediana oceny" value={summary.median_rating == null ? "Brak ocen" : `${formatNumber(summary.median_rating)}/10`} />
      <HistoryStat label="Średni czas gry" value={summary.average_playtime_hours == null ? "Brak danych" : formatHours(summary.average_playtime_hours)} />
      <HistoryStat label="Aktywne lata" value={formatNumber(data.active_years_count)} />
      <HistoryStat label="Najwięcej ukończeń" value={yearMetric(data.best_year_by_completions?.year, data.best_year_by_completions?.completed_games_count, "gier")} href={yearHref(data.best_year_by_completions?.year)} />
      <HistoryStat label="Najwięcej czasu" value={data.best_year_by_playtime ? `${data.best_year_by_playtime.year} · ${formatHours(data.best_year_by_playtime.total_playtime_hours)}` : "Brak danych"} href={yearHref(data.best_year_by_playtime?.year)} />
      <HistoryStat label="Najczęstsza platforma" value={summary.top_platform?.label ?? "Brak danych"} />
      <HistoryStat label="Najczęstszy gatunek" value={summary.top_genre?.label ?? "Brak danych"} />
    </section>

    <section className="grid gap-4 lg:grid-cols-2" aria-label="Najważniejsze gry całej historii">
      <GameHighlight label="Najlepiej oceniona gra" game={summary.best_rated_game} value={summary.best_rated_game?.rating == null ? "Brak oceny" : `${formatNumber(summary.best_rated_game.rating)}/10`} />
      <GameHighlight label="Najdłuższa gra" game={summary.longest_game} value={summary.longest_game ? formatHours(summary.longest_game.playtime_hours) : "Brak czasu"} />
    </section>

    <section className="grid gap-4 xl:grid-cols-2" aria-label="Wyniki według roku">
      <YearBarChart title="Liczba ukończonych gier w każdym roku" description="Każdy słupek używa jednej jednostki: liczby ukończeń." data={yearly} dataKey="completed_games_count" name="Ukończone gry" formatter={(value) => `${formatNumber(value)} gier`} color="#34d399" />
      <YearBarChart title="Łączny czas gry w każdym roku" description="Czas jest sumowany wyłącznie z wpisów, które mają podaną wartość." data={yearly} dataKey="total_playtime_hours" name="Czas gry" formatter={formatHours} color="#22d3ee" />
    </section>

    <Card><CardHeader><CardTitle>Średnia ocena według roku</CardTitle><CardDescription>Brak punktu oznacza rok bez ocen użytkownika. Skala pozostaje 0–10.</CardDescription></CardHeader><CardContent><div className="h-80" role="img" aria-label="Średnia ocena gier w kolejnych latach"><ResponsiveContainer width="100%" height="100%"><LineChart data={yearly} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="year" stroke="#94a3b8" /><YAxis domain={[0, 10]} stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${formatNumber(Number(value))}/10`, "Średnia ocena"]} /><Line type="monotone" dataKey="average_rating" name="Średnia ocena" stroke="#fbbf24" strokeWidth={3} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></CardContent></Card>

    <section className="grid gap-4 xl:grid-cols-2" aria-label="Kategorie na przestrzeni lat">
      <CategoryChart title="Platformy na przestrzeni lat" description="Pięć najczęstszych platform w całej historii; brak platformy nie jest traktowany jako kategoria." data={platformData} />
      <CategoryChart title="Gatunki na przestrzeni lat" description="Pięć najczęstszych gatunków. Gra wielogatunkowa może należeć do kilku segmentów." data={genreData} />
    </section>

    <Card><CardHeader><CardTitle>Przejdź do konkretnego roku</CardTitle><CardDescription>„Cała historia” pozostaje osobnym trybem i nie jest dodawana jako sztuczny rok.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{data.yearly.map((item) => <Link key={item.year} href={`/analytics/${item.year}`}><Button variant="secondary">{item.year} · {item.completed_games_count} gier</Button></Link>)}</CardContent></Card>
  </div>;
}

function HistoryStat({ label, value, href }: { label: string; value: string; href?: string | null }) { const content = <Card className="h-full"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></CardContent></Card>; return href ? <Link href={href} className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</Link> : content; }
function GameHighlight({ label, game, value }: { label: string; game?: CompletedGameHighlight | null; value: string }) { return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p>{game ? <Link href={`/completed-games/entry/${game.id}`} className="mt-1 flex items-center justify-between gap-3 font-semibold hover:text-accent"><span>{game.title}</span><span>{value}</span></Link> : <p className="mt-1 font-semibold">Brak danych</p>}</CardContent></Card>; }
function YearBarChart({ title, description, data, dataKey, name, formatter, color }: { title: string; description: string; data: ReturnType<typeof historyYearChartData>; dataKey: "completed_games_count" | "total_playtime_hours"; name: string; formatter: (value: number) => string; color: string }) { return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent><div className="h-80" role="img" aria-label={title}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="year" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatter(Number(value)), name]} /><Bar dataKey={dataKey} name={name} fill={color} radius={[5,5,0,0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></CardContent></Card>; }
function CategoryChart({ title, description, data }: { title: string; description: string; data: ReturnType<typeof historyCategoryChartData> }) { return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{data.labels.length ? <div className="h-80" role="img" aria-label={title}><ResponsiveContainer width="100%" height="100%"><BarChart data={data.rows} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="year" stroke="#94a3b8" /><YAxis allowDecimals={false} stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} /><Legend />{data.labels.map((label, index) => <Bar key={label} dataKey={label} stackId="categories" fill={colors[index % colors.length]} isAnimationActive={false} />)}</BarChart></ResponsiveContainer></div> : <p className="text-sm text-muted-foreground">Brak danych o kategoriach.</p>}</CardContent></Card>; }
function yearHref(year?: number | null) { return year ? `/analytics/${year}` : null; }
function yearMetric(year: number | undefined, value: number | undefined, unit: string) { return year && value != null ? `${year} · ${formatNumber(value)} ${unit}` : "Brak danych"; }
function formatNumber(value: number) { return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value); }
