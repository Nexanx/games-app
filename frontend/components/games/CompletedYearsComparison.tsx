import { BarChart3, Clock3, Star } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { polishMonthNames } from "@/lib/completed-games";
import { formatHours } from "@/lib/utils";
import type { CompletedGamesComparison, CompletedGamesYear } from "@/types";

const comparisonColors = ["bg-emerald-400", "bg-cyan-400"];

export function CompletedYearsComparison({ availableYears, selectedYears, comparison, loading, onSelectedYearsChange }: {
  availableYears: CompletedGamesYear[];
  selectedYears: number[];
  comparison: CompletedGamesComparison | null;
  loading: boolean;
  onSelectedYearsChange: (years: number[]) => void;
}) {
  const firstYear = selectedYears[0] ?? availableYears[0]?.year;
  const secondYear = selectedYears[1] ?? availableYears.find((item) => item.year !== firstYear)?.year;
  const canCompare = firstYear !== undefined && secondYear !== undefined && firstYear !== secondYear;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />Porównaj lata</CardTitle>
        <CardDescription>Wybierz dwa lata, aby zestawić liczbę gier, czas, oceny i miesięczny trend.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-5">
        <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="comparison-year-a">Pierwszy rok</Label><Select id="comparison-year-a" value={firstYear ?? ""} onChange={(event) => secondYear !== undefined && onSelectedYearsChange([Number(event.target.value), secondYear])}>{availableYears.map((item) => <option key={item.year} value={item.year} disabled={item.year === secondYear}>{item.year} ({item.completed_games_count})</option>)}</Select></div>
          <div className="space-y-1.5"><Label htmlFor="comparison-year-b">Drugi rok</Label><Select id="comparison-year-b" value={secondYear ?? ""} onChange={(event) => firstYear !== undefined && onSelectedYearsChange([firstYear, Number(event.target.value)])}>{availableYears.map((item) => <option key={item.year} value={item.year} disabled={item.year === firstYear}>{item.year} ({item.completed_games_count})</option>)}</Select></div>
        </div>
        {!canCompare ? <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">Do porównania potrzebne są dwa różne lata z historii.</p> : null}
        {canCompare && loading ? <p className="text-sm text-muted-foreground">Ładowanie porównania…</p> : null}
        {canCompare && !loading && comparison ? <ComparisonData comparison={comparison} /> : null}
      </CardContent>
    </Card>
  );
}

function ComparisonData({ comparison }: { comparison: CompletedGamesComparison }) {
  const monthlyMaximum = Math.max(1, ...comparison.years.flatMap((year) => year.monthly.map((month) => month.completed_games_count)));
  return <div className="min-w-0 space-y-5">
    <div className="grid gap-3 sm:grid-cols-2">
      {comparison.years.map((year, index) => <div key={year.year} className="rounded-lg border border-border bg-background/55 p-4"><p className="text-lg font-bold">{year.year}</p><dl className="mt-3 grid gap-2 text-sm"><Metric icon={BarChart3} label="Ukończone" value={String(year.completed_games_count)} /><Metric icon={Clock3} label="Łączny czas" value={year.average_playtime_hours == null ? "Brak danych" : formatHours(year.total_playtime_hours)} /><Metric icon={Clock3} label="Średni czas" value={year.average_playtime_hours == null ? "Brak danych" : formatHours(year.average_playtime_hours)} /><Metric icon={Star} label="Średnia ocena" value={year.average_rating == null ? "Brak ocen" : `${formatNumber(year.average_rating)}/10`} /></dl><span className={`mt-3 block h-1.5 w-12 rounded ${comparisonColors[index]}`} aria-hidden="true" /></div>)}
    </div>
    <div className="min-w-0 rounded-lg border border-border bg-background/35 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda wykresu">{comparison.years.map((year, index) => <span key={year.year} className="inline-flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-full ${comparisonColors[index]}`} aria-hidden="true" />{year.year}</span>)}</div>
      <div className="min-w-0 space-y-2" role="img" aria-label="Porównanie liczby ukończonych gier w miesiącach">
        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <div key={month} className="grid min-w-0 grid-cols-[58px_1fr] items-center gap-2 sm:grid-cols-[82px_1fr] sm:gap-3"><span className="truncate text-[11px] text-muted-foreground sm:text-xs">{polishMonthNames[month - 1]}</span><div className="min-w-0 space-y-1">{comparison.years.map((year, yearIndex) => { const count = year.monthly.find((item) => item.month === month)?.completed_games_count ?? 0; return <div key={year.year} className="flex min-w-0 items-center gap-2"><div className="h-3 min-w-0 flex-1 overflow-hidden rounded bg-muted" title={`${year.year}: ${count} ukończonych gier`}><div className={`h-full rounded ${comparisonColors[yearIndex]}`} style={{ width: `${count / monthlyMaximum * 100}%` }} /></div><span className="w-4 shrink-0 text-right text-xs tabular-nums">{count}</span></div>; })}</div></div>)}
      </div>
    </div>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) { return <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}</dt><dd className="font-semibold">{value}</dd></div>; }
function formatNumber(value: number) { return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value); }
