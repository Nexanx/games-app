"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CalendarCheck2, ChevronLeft, ChevronRight } from "lucide-react";

import { CompletedYearDashboard } from "@/components/games/CompletedYearDashboard";
import { CompletedYearsComparison } from "@/components/games/CompletedYearsComparison";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/select";
import { getAvailableYearNavigation } from "@/lib/completed-games";
import { api } from "@/services/api";
import type { CompletedGamesComparison, CompletedGamesYear, CompletedGamesYearDashboard } from "@/types";

export default function AnalyticsYearPage() {
  const { year: yearParam } = useParams<{ year: string }>();
  const router = useRouter();
  const year = Number(yearParam);
  const validYear = Number.isInteger(year) && year >= 1900 && year <= 9998;
  const [years, setYears] = useState<CompletedGamesYear[]>([]);
  const [dashboard, setDashboard] = useState<CompletedGamesYearDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparisonYears, setComparisonYears] = useState<number[]>([]);
  const [comparison, setComparison] = useState<CompletedGamesComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const comparisonInitialized = useRef(false);

  useEffect(() => {
    if (!validYear) return;
    let active = true;
    setLoading(true);
    setError(null);
    setDashboard(null);
    setComparisonYears([]);
    setComparison(null);
    comparisonInitialized.current = false;

    Promise.all([api.listCompletedYears(), api.getCompletedYearDashboard(year)])
      .then(([yearItems, yearDashboard]) => {
        if (!active) return;
        setYears(yearItems);
        setDashboard(yearDashboard);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Nie udało się pobrać analiz.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [validYear, year]);

  const availableYears = useMemo(() => {
    const current = years.find((item) => item.year === year);
    const candidates = current || !dashboard ? years : [{ year, completed_games_count: dashboard.completed_games_count }, ...years];
    return [...candidates].sort((left, right) => right.year - left.year);
  }, [dashboard, year, years]);
  const navigation = useMemo(() => getAnalyticsYearNavigation(year, years), [year, years]);
  const comparisonYearsKey = comparisonYears.join(",");

  useEffect(() => {
    if (comparisonInitialized.current || !availableYears.length) return;
    comparisonInitialized.current = true;
    setComparisonYears(availableYears.slice(0, 2).map((item) => item.year));
  }, [availableYears]);

  useEffect(() => {
    if (comparisonYears.length < 2) {
      setComparison(null);
      setComparisonError(null);
      return;
    }
    let active = true;
    setComparisonLoading(true);
    setComparisonError(null);
    api.compareCompletedYears(comparisonYears)
      .then((result) => { if (active) setComparison(result); })
      .catch((reason) => { if (active) setComparisonError(reason instanceof Error ? reason.message : "Nie udało się porównać lat."); })
      .finally(() => { if (active) setComparisonLoading(false); });
    return () => { active = false; };
  }, [comparisonYears, comparisonYearsKey]);

  if (!validYear) return <ErrorState message="Nieprawidłowy rok." />;
  if (loading) return <LoadingState label={`Ładowanie analiz z ${year} roku`} />;
  if (error || !dashboard) return <ErrorState message={error ?? "Nie udało się pobrać analiz."} />;

  function selectComparisonYears(nextYears: number[]) {
    setComparisonYears(Array.from(new Set(nextYears)).sort((left, right) => right - left).slice(0, 8));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Statystyki ukończeń</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Analizy — {year}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Podsumowanie roku, wykres miesięczny i porównanie wyników między latami.</p>
        </div>
        <Link href={`/completed-games/${year}`}><Button variant="secondary"><CalendarCheck2 className="h-4 w-4" aria-hidden="true" />Lista gier</Button></Link>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex flex-wrap gap-2">
            {navigation.olderYear ? <Link href={`/analytics/${navigation.olderYear}`}><Button variant="secondary"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Poprzedni rok ({navigation.olderYear})</Button></Link> : null}
            {navigation.newerYear ? <Link href={`/analytics/${navigation.newerYear}`}><Button variant="secondary">Następny rok ({navigation.newerYear})<ChevronRight className="h-4 w-4" aria-hidden="true" /></Button></Link> : null}
          </div>
          <Select className="sm:w-52" value={String(year)} onChange={(event) => event.target.value && router.push(`/analytics/${event.target.value}`)} aria-label="Wybierz rok analiz">
            {!years.some((item) => item.year === year) ? <option value={year}>{year} (brak wpisów)</option> : null}
            {years.map((item) => <option key={item.year} value={item.year}>{item.year} ({item.completed_games_count})</option>)}
          </Select>
        </CardContent>
      </Card>

      <CompletedYearDashboard dashboard={dashboard} />
      <CompletedYearsComparison
        availableYears={availableYears}
        selectedYears={comparisonYears}
        comparison={comparison}
        loading={comparisonLoading}
        onSelectedYearsChange={selectComparisonYears}
      />
      {comparisonError ? <ErrorState message={comparisonError} /> : null}
    </div>
  );
}

function getAnalyticsYearNavigation(year: number, years: CompletedGamesYear[]) {
  if (years.some((item) => item.year === year)) return getAvailableYearNavigation(year, years);
  const ordered = years.map((item) => item.year).sort((left, right) => right - left);
  return {
    newerYear: ordered.find((item) => item > year) ?? null,
    olderYear: ordered.find((item) => item < year) ?? null
  };
}
