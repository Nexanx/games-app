"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Area, AreaChart, CartesianGrid, Legend, Line, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ResponsiveContainer } from "@/components/analytics/AnalyticsChartContainer";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/select";
import { formatHours } from "@/lib/utils";
import { api } from "@/services/api";
import type { CompletedGamesForecast } from "@/types";

type Metric = "completed_games" | "playtime";

export function ForecastSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const metric: Metric = searchParams.get("forecastMetric") === "playtime" ? "playtime" : "completed_games";
  const requestedAhead = Number(searchParams.get("monthsAhead"));
  const monthsAhead = Number.isInteger(requestedAhead) && requestedAhead >= 1 && requestedAhead <= 12 ? requestedAhead : 6;
  const [data, setData] = useState<CompletedGamesForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null); setData(null);
    api.getCompletedGamesForecast(metric, monthsAhead, controller.signal)
      .then(setData)
      .catch((reason) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Nie udało się przygotować prognozy."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [metric, monthsAhead, retry]);

  function update(key: string, value: string) { const params = new URLSearchParams(searchParams.toString()); params.set("section", "forecast"); params.set(key, value); router.replace(`?${params.toString()}`, { scroll: false }); }

  return <section className="space-y-6" aria-labelledby="forecast-heading">
    <div><p className="text-sm font-semibold text-primary">Szacunek oparty na historii</p><h2 id="forecast-heading" className="mt-1 text-2xl font-bold">Prognozy</h2></div>
    <Card><CardHeader><CardTitle>Parametry prognozy</CardTitle><CardDescription>Obliczenia są wykonywane dopiero po otwarciu tej sekcji. Prognoza nigdy nie obejmuje ocen ani konkretnych tytułów.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1.5 text-sm"><span className="font-semibold">Metryka</span><Select value={metric} onChange={(event) => update("forecastMetric", event.target.value)}><option value="completed_games">Liczba ukończonych gier</option><option value="playtime">Łączny czas gry</option></Select></label>
      <label className="space-y-1.5 text-sm"><span className="font-semibold">Horyzont</span><Select value={monthsAhead} onChange={(event) => update("monthsAhead", event.target.value)}>{[3,6,9,12].map((value) => <option key={value} value={value}>{value} miesięcy</option>)}</Select></label>
    </CardContent></Card>
    {loading ? <LoadingState label="Ocena jakości danych i modeli" /> : null}
    {error ? <div className="space-y-3"><ErrorState message={error} /><Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>Spróbuj ponownie</Button></div> : null}
    {!loading && !error && data ? <ForecastResult data={data} /> : null}
  </section>;
}

function ForecastResult({ data }: { data: CompletedGamesForecast }) {
  if (!data.sufficient_data) return <Card className="border-dashed"><CardHeader><CardTitle>Brak wiarygodnej prognozy</CardTitle><CardDescription>{data.reason}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p>Wymagania: {data.minimum_requirements}</p><p className="text-muted-foreground">Dostępne: {data.observations_count} miesięcy, {data.active_months_count} aktywnych miesięcy, {data.source_entries_count} odpowiednich wpisów.</p>{data.historical.length ? <HistoricalTable data={data} /> : null}</CardContent></Card>;
  const combined = [...data.historical.slice(-24).map((item) => ({ period: item.period, actual: item.value })), ...data.forecast.map((item) => ({ period: item.period, forecast: item.value, lower: item.lower_bound, upper: item.upper_bound }))];
  const firstForecast = data.forecast[0]?.period;
  const finalValue = data.forecast.at(-1)?.value;
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Model" value={data.model ?? "Brak"} /><Stat label="Prognoza końcowa" value={finalValue == null ? "Brak" : formatValue(finalValue, data.metric)} /><Stat label="MAE" value={data.mae == null ? "Brak" : formatValue(data.mae, data.metric)} /><Stat label="RMSE" value={data.rmse == null ? "Brak" : formatValue(data.rmse, data.metric)} /></div>
    <Card><CardHeader><CardTitle>Dane historyczne i prognozowane</CardTitle><CardDescription>Wynik jest szacunkiem. Model wybrano według niższego MAE na końcowym holdoucie historycznym; linie przerywane pokazują przybliżony przedział ±1,96 RMSE.</CardDescription></CardHeader><CardContent><div className="h-96" role="img" aria-label={`Prognoza: ${data.metric === "playtime" ? "czas gry" : "liczba ukończeń"}`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={combined} margin={{ top: 16, right: 24, bottom: 16, left: 8 }}><defs><linearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.45}/><stop offset="95%" stopColor="#34d399" stopOpacity={0}/></linearGradient><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.45}/><stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="period" stroke="#94a3b8" minTickGap={24} /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [formatValue(Number(value), data.metric), String(name)]} /><Legend /><Area type="monotone" dataKey="actual" name="Historia" stroke="#34d399" fill="url(#historyFill)" connectNulls={false} isAnimationActive={false} /><Area type="monotone" dataKey="forecast" name="Prognoza" stroke="#a78bfa" fill="url(#forecastFill)" connectNulls={false} isAnimationActive={false} /><Line dataKey="lower" name="Dolna granica" stroke="#94a3b8" strokeDasharray="4 4" dot={false} isAnimationActive={false} /><Line dataKey="upper" name="Górna granica" stroke="#94a3b8" strokeDasharray="4 4" dot={false} isAnimationActive={false} />{firstForecast ? <ReferenceLine x={firstForecast} stroke="#fbbf24" label={{ value: "Start prognozy", fill: "#fbbf24", position: "insideTopRight" }} /> : null}</AreaChart></ResponsiveContainer></div><details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">Pokaż dane prognozy w tabeli</summary><HistoricalTable data={data} includeForecast /></details></CardContent></Card>
    <Card><CardContent className="p-4 text-sm text-muted-foreground">Model: {data.model}. Walidacja: MAE {formatValue(data.mae ?? 0, data.metric)}, RMSE {formatValue(data.rmse ?? 0, data.metric)}. Obserwacje: {data.observations_count}, aktywne miesiące: {data.active_months_count}, wpisy źródłowe: {data.source_entries_count}. {data.minimum_requirements}</CardContent></Card>
  </div>;
}

function HistoricalTable({ data, includeForecast = false }: { data: CompletedGamesForecast; includeForecast?: boolean }) { const rows = includeForecast ? [...data.historical, ...data.forecast] : data.historical; return <div className="mt-3 max-h-72 overflow-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead className="sticky top-0 bg-card text-muted-foreground"><tr><th className="p-2">Miesiąc</th><th className="p-2">Wartość</th><th className="p-2">Typ</th></tr></thead><tbody>{rows.map((item) => <tr key={`${item.period}-${item.lower_bound ?? "history"}`} className="border-b border-border/60"><td className="p-2">{item.period}</td><td className="p-2">{formatValue(item.value, data.metric)}</td><td className="p-2">{item.lower_bound == null ? "Historia" : "Prognoza"}</td></tr>)}</tbody></table></div>; }
function Stat({ label, value }: { label: string; value: string }) { return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></CardContent></Card>; }
function formatValue(value: number, metric: CompletedGamesForecast["metric"]) { return metric === "playtime" ? formatHours(value) : `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value)} gier`; }
const tooltipStyle = { backgroundColor: "#020617", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" };
