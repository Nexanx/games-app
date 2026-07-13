"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis
} from "recharts";
import { ResponsiveContainer } from "@/components/analytics/AnalyticsChartContainer";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { polishMonthNames } from "@/lib/completed-games";
import { formatHours } from "@/lib/utils";
import type { CompletedGamesDistributionItem, CompletedGamesYearDashboard } from "@/types";

type Metric = "games" | "time" | "rating";
type ScatterDatum = { title: string; playtime: number; rating: number; date: string };

const colors = ["#34d399", "#22d3ee", "#a78bfa", "#fbbf24", "#fb7185", "#94a3b8"];
const metrics: Array<{ value: Metric; label: string; unit: string }> = [
  { value: "games", label: "Ukończone gry", unit: "gry" },
  { value: "time", label: "Czas gry", unit: "godz." },
  { value: "rating", label: "Średnia ocena", unit: "/10" }
];

export function AnalyticsTrends({ dashboard }: { dashboard: CompletedGamesYearDashboard }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMetric = searchParams.get("metric");
  const metric: Metric = requestedMetric === "time" || requestedMetric === "rating" ? requestedMetric : "games";
  const monthly = dashboard.monthly.map((item) => ({
    month: item.month,
    label: polishMonthNames[item.month - 1].slice(0, 3),
    games: item.completed_games_count,
    time: item.total_playtime_hours,
    rating: item.average_rating
  }));
  const distribution = dashboard.genres.filter((item) => !item.label.startsWith("Brak ")).slice(0, 8);
  const pieData = useMemo(() => compactDistribution(dashboard.platforms), [dashboard.platforms]);
  const scatter = dashboard.scatter_games.map((entry) => ({
    title: entry.title,
    playtime: entry.playtime_hours,
    rating: entry.rating as number,
    date: entry.completion_date
  }));
  const selected = metrics.find((item) => item.value === metric) ?? metrics[0];

  function selectMetric(value: Metric) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "trends");
    params.set("metric", value);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <section className="space-y-6" aria-labelledby="trends-heading">
      <div><p className="text-sm font-semibold text-primary">Zmiany w czasie i zależności</p><h2 id="trends-heading" className="mt-1 text-2xl font-bold">Trendy — {dashboard.year}</h2></div>
      <Card>
        <CardHeader><CardTitle>Trend miesięczny</CardTitle><CardDescription>Wykres liniowy pokazuje pełny rok. Zmiana metryki nie wykonuje nowego requestu.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2" aria-label="Metryka trendu">{metrics.map((item) => <Button key={item.value} type="button" variant={metric === item.value ? "primary" : "secondary"} aria-pressed={metric === item.value} onClick={() => selectMetric(item.value)}>{item.label}</Button>)}</div>
          <div className="h-80 min-w-0" role="img" aria-label={`${selected.label} w kolejnych miesiącach ${dashboard.year} roku`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis allowDecimals={metric !== "games"} stroke="#94a3b8" width={48} domain={metric === "rating" ? [0, 10] : [0, "auto"]} label={{ value: selected.unit, angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatMetric(Number(value), metric), selected.label]} labelFormatter={(label) => `Miesiąc: ${label}`} />
                <Line type="monotone" dataKey={metric} name={selected.label} stroke="#34d399" strokeWidth={3} connectNulls={false} activeDot={{ r: 6 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details><summary className="cursor-pointer text-sm font-semibold">Pokaż dane trendu w tabeli</summary><MonthlyTable dashboard={dashboard} /></details>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Najczęstsze gatunki</CardTitle><CardDescription>Poziome słupki ułatwiają porównanie dłuższych nazw kategorii.</CardDescription></CardHeader>
          <CardContent>{distribution.length ? <div className="h-80" role="img" aria-label="Liczba ukończonych gier według gatunku"><ResponsiveContainer width="100%" height="100%"><BarChart data={distribution} layout="vertical" margin={{ left: 16, right: 24 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis type="number" allowDecimals={false} stroke="#94a3b8" /><YAxis type="category" dataKey="label" width={100} stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} gier`, "Ukończenia"]} /><Bar dataKey="completed_games_count" fill="#22d3ee" radius={[0, 4, 4, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div> : <NoData label="Brak danych o gatunkach." />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Udział platform</CardTitle><CardDescription>Wykres pierścieniowy pokazuje udział platform w ukończeniach; drobne pozycje są łączone jako „Inne”.</CardDescription></CardHeader>
          <CardContent>{pieData.length ? <><div className="h-72" role="img" aria-label="Procentowy udział platform"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="76%" paddingAngle={2} isAnimationActive={false} label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} gier`, "Ukończenia"]} /><Legend /></PieChart></ResponsiveContainer></div><ul className="sr-only">{pieData.map((item) => <li key={item.name}>{item.name}: {item.value}</li>)}</ul></> : <NoData label="Brak danych o platformach." />}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Czas gry a ocena</CardTitle><CardDescription>Każdy punkt odpowiada jednemu ukończeniu z podanym czasem i oceną.</CardDescription></CardHeader>
        <CardContent>{scatter.length >= 4 ? <><div className="h-80" role="img" aria-label="Zależność czasu gry i oceny"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis type="number" dataKey="playtime" name="Czas" unit=" godz." stroke="#94a3b8" /><YAxis type="number" dataKey="rating" name="Ocena" unit="/10" domain={[0, 10]} stroke="#94a3b8" /><ZAxis dataKey="title" name="Gra" /><Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} /><Scatter data={scatter} fill="#a78bfa" isAnimationActive={false} /></ScatterChart></ResponsiveContainer></div><p className="mt-3 text-xs text-muted-foreground">Liczba kompletnych obserwacji: {scatter.length}.</p></> : <NoData label={`Za mało kompletnych obserwacji do wykresu punktowego (${scatter.length}/4).`} />}</CardContent>
      </Card>
    </section>
  );
}

function MonthlyTable({ dashboard }: { dashboard: CompletedGamesYearDashboard }) {
  return <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="p-2">Miesiąc</th><th className="p-2">Gry</th><th className="p-2">Czas</th><th className="p-2">Średnia ocena</th></tr></thead><tbody>{dashboard.monthly.map((item) => <tr key={item.month} className="border-b border-border/60"><td className="p-2 font-medium">{polishMonthNames[item.month - 1]}</td><td className="p-2">{item.completed_games_count}</td><td className="p-2">{item.games_with_playtime_count ? formatHours(item.total_playtime_hours) : "Brak danych"}</td><td className="p-2">{item.average_rating == null ? "Brak ocen" : `${formatNumber(item.average_rating)}/10`}</td></tr>)}</tbody></table></div>;
}

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterDatum }> }) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  return <div className="rounded-md border border-border bg-slate-950 p-3 text-xs text-slate-100 shadow-xl"><p className="font-semibold">{item.title}</p><p>{formatHours(item.playtime)}</p><p>{formatNumber(item.rating)}/10</p><p>{new Intl.DateTimeFormat("pl-PL").format(new Date(`${item.date}T12:00:00`))}</p></div>;
}

function compactDistribution(items: CompletedGamesDistributionItem[]) {
  const valid = items.filter((item) => !item.label.startsWith("Brak "));
  const head = valid.slice(0, 5).map((item, index) => ({ name: item.label, value: item.completed_games_count, fill: colors[index] }));
  const rest = valid.slice(5).reduce((sum, item) => sum + item.completed_games_count, 0);
  if (rest) head.push({ name: "Inne", value: rest, fill: colors[5] });
  return head;
}

function formatMetric(value: number, metric: Metric) { if (metric === "time") return formatHours(value); if (metric === "rating") return `${formatNumber(value)}/10`; return `${formatNumber(value)} gier`; }
function formatNumber(value: number) { return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value); }
function NoData({ label }: { label: string }) { return <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">{label}</p>; }
const tooltipStyle = { backgroundColor: "#020617", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" };
