"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck2, ChevronLeft, ChevronRight, Filter, Plus, RotateCcw, X } from "lucide-react";

import { CompletedYearDashboard } from "@/components/games/CompletedYearDashboard";
import { CompletedYearsComparison } from "@/components/games/CompletedYearsComparison";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/select";
import { analyticsPeriodLabel } from "@/lib/analytics";
import {
  completedYearFiltersFromSearchParams,
  completedYearFiltersToSearchParams,
  currentCompletedGamesYear,
  getAvailableYearNavigation,
  hasCompletedYearFilters,
  polishMonthNames,
  type CompletedYearFilters
} from "@/lib/completed-games";
import { api } from "@/services/api";
import type { CompletedGamesComparison, CompletedGamesFilterOptions, CompletedGamesYear, CompletedGamesYearDashboard } from "@/types";

const emptyFilters: CompletedYearFilters = { platforms: [], genres: [] };

export default function AnalyticsYearPage() {
  const { year: yearParam } = useParams<{ year: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const year = Number(yearParam);
  const validYear = Number.isInteger(year) && year >= 1900 && year <= 9998;
  const filterQuery = searchParams.toString();
  const filters = useMemo(
    () => completedYearFiltersFromSearchParams(searchParams),
    // The serialized URL is the stable source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterQuery]
  );
  const filtersActive = hasCompletedYearFilters(filters);
  const [years, setYears] = useState<CompletedGamesYear[]>([]);
  const [dashboard, setDashboard] = useState<CompletedGamesYearDashboard | null>(null);
  const [filterOptions, setFilterOptions] = useState<CompletedGamesFilterOptions>({ platforms: [], genres: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(filtersActive);
  const [comparisonYears, setComparisonYears] = useState<number[]>([]);
  const [comparison, setComparison] = useState<CompletedGamesComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const comparisonInitialized = useRef(false);

  useEffect(() => {
    if (!validYear) return;
    const controller = new AbortController();
    api.listCompletedYears(controller.signal)
      .then(setYears)
      .catch(() => undefined);
    return () => controller.abort();
  }, [validYear, year]);

  useEffect(() => {
    if (!validYear) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDashboard(null);
    api.getCompletedYearDashboard(year, {
      month: filters.month,
      platform: filters.platforms,
      genre: filters.genres,
      rating_min: filters.ratingMin,
      rating_max: filters.ratingMax
    }, controller.signal)
      .then((result) => { setDashboard(result); setFilterOptions(result.filter_options); })
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Nie udało się pobrać analiz.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filterQuery, filters.genres, filters.month, filters.platforms, filters.ratingMax, filters.ratingMin, retryKey, validYear, year]);

  const availableYears = useMemo(() => {
    const current = years.find((item) => item.year === year);
    const candidates = current || !dashboard ? years : [{ year, completed_games_count: dashboard.completed_games_count }, ...years];
    return [...candidates].sort((left, right) => right.year - left.year);
  }, [dashboard, year, years]);
  const navigation = useMemo(() => getAnalyticsYearNavigation(year, years), [year, years]);
  const comparisonYearsKey = comparisonYears.join(",");

  useEffect(() => {
    if (comparisonInitialized.current || availableYears.length < 2) return;
    comparisonInitialized.current = true;
    setComparisonYears(availableYears.slice(0, 2).map((item) => item.year));
  }, [availableYears]);

  useEffect(() => {
    if (comparisonYears.length !== 2) { setComparison(null); setComparisonError(null); return; }
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

  function updateFilters(nextFilters: CompletedYearFilters) {
    const query = completedYearFiltersToSearchParams(nextFilters).toString();
    router.replace(`/analytics/${year}${query ? `?${query}` : ""}`, { scroll: false });
  }

  function updateRating(bound: "ratingMin" | "ratingMax", raw: string) {
    const parsed = raw === "" ? undefined : Number(raw);
    const value = parsed !== undefined && Number.isFinite(parsed) && parsed >= 0 && parsed <= 10 ? parsed : undefined;
    const next = { ...filters, [bound]: value };
    if (next.ratingMin !== undefined && next.ratingMax !== undefined && next.ratingMin > next.ratingMax) {
      if (bound === "ratingMin") next.ratingMax = undefined;
      else next.ratingMin = undefined;
    }
    updateFilters(next);
  }

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Statystyki ukończeń</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Analizy — {year}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Aktywny okres: <strong className="text-foreground">{analyticsPeriodLabel(year, filters)}</strong>{filtersActive ? ` · ${activeFiltersCount(filters)} aktywne filtry` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href={`/completed-games/${year}${filterQuery ? `?${filterQuery}` : ""}`}><Button variant="secondary"><CalendarCheck2 className="h-4 w-4" aria-hidden="true" />Lista gier</Button></Link><Link href="/completed-games/new"><Button><Plus className="h-4 w-4" aria-hidden="true" />Dodaj grę</Button></Link></div>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex flex-wrap gap-2">
            {navigation.olderYear ? <Link href={`/analytics/${navigation.olderYear}`}><Button variant="secondary"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Poprzedni rok ({navigation.olderYear})</Button></Link> : null}
            {navigation.newerYear ? <Link href={`/analytics/${navigation.newerYear}`}><Button variant="secondary">Następny rok ({navigation.newerYear})<ChevronRight className="h-4 w-4" aria-hidden="true" /></Button></Link> : null}
            {year !== currentCompletedGamesYear() ? <Link href={`/analytics/${currentCompletedGamesYear()}`}><Button variant="ghost"><RotateCcw className="h-4 w-4" aria-hidden="true" />Bieżący rok</Button></Link> : null}
          </div>
          <Select className="sm:w-52" value={String(year)} onChange={(event) => event.target.value && router.push(`/analytics/${event.target.value}`)} aria-label="Wybierz rok analiz">
            {!years.some((item) => item.year === year) ? <option value={year}>{year} (brak wpisów)</option> : null}
            {years.map((item) => <option key={item.year} value={item.year}>{item.year} ({item.completed_games_count})</option>)}
          </Select>
        </CardContent>
      </Card>

      <Button type="button" variant={filtersActive ? "primary" : "secondary"} className="min-h-12 w-full justify-start" aria-expanded={filtersOpen} aria-controls="analytics-filters" onClick={() => setFiltersOpen((value) => !value)}><Filter className="h-5 w-5" aria-hidden="true" />Filtry analizy<span className="ml-auto text-xs font-normal">{filtersActive ? `${activeFiltersCount(filters)} aktywne` : filtersOpen ? "Ukryj" : "Pokaż"}</span></Button>
      {filtersOpen ? <AnalyticsFilters filters={filters} options={filterOptions} onChange={updateFilters} onRatingChange={updateRating} /> : null}

      {loading ? <LoadingState label="Aktualizowanie analiz" /> : null}
      {!loading && error ? <div className="space-y-3"><ErrorState message={error} /><Button type="button" variant="secondary" onClick={() => setRetryKey((value) => value + 1)}><RotateCcw className="h-4 w-4" aria-hidden="true" />Spróbuj ponownie</Button></div> : null}
      {!loading && !error && dashboard?.completed_games_count === 0 ? <EmptyAnalysis year={year} filtersActive={filtersActive} onClear={() => updateFilters(emptyFilters)} /> : null}
      {!loading && !error && dashboard && dashboard.completed_games_count > 0 ? <CompletedYearDashboard dashboard={dashboard} filters={filters} /> : null}

      {availableYears.length >= 2 ? <CompletedYearsComparison availableYears={availableYears} selectedYears={comparisonYears} comparison={comparison} loading={comparisonLoading} onSelectedYearsChange={setComparisonYears} /> : null}
      {comparisonError ? <ErrorState message={comparisonError} /> : null}
    </div>
  );
}

function AnalyticsFilters({ filters, options, onChange, onRatingChange }: { filters: CompletedYearFilters; options: CompletedGamesFilterOptions; onChange: (filters: CompletedYearFilters) => void; onRatingChange: (bound: "ratingMin" | "ratingMax", value: string) => void }) {
  return <Card id="analytics-filters"><CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0"><div><CardTitle>Zakres i filtry</CardTitle><CardDescription>Wszystkie karty, wykresy, rankingi i wnioski korzystają z tego samego zestawu danych.</CardDescription></div><Button type="button" variant="secondary" disabled={!hasCompletedYearFilters(filters)} onClick={() => onChange(emptyFilters)}><X className="h-4 w-4" aria-hidden="true" />Wyczyść filtry</Button></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
    <label className="space-y-1.5 text-sm"><span className="font-semibold">Miesiąc</span><Select value={filters.month ?? ""} onChange={(event) => onChange({ ...filters, month: event.target.value ? Number(event.target.value) : undefined })}><option value="">Cały rok</option>{polishMonthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</Select></label>
    <label className="space-y-1.5 text-sm"><span className="font-semibold">Platforma</span><Select value={filters.platforms[0] ?? ""} onChange={(event) => onChange({ ...filters, platforms: event.target.value ? [event.target.value] : [] })}><option value="">Wszystkie</option>{options.platforms.map((value) => <option key={value} value={value}>{value}</option>)}</Select></label>
    <label className="space-y-1.5 text-sm"><span className="font-semibold">Gatunek</span><Select value={filters.genres[0] ?? ""} onChange={(event) => onChange({ ...filters, genres: event.target.value ? [event.target.value] : [] })}><option value="">Wszystkie</option>{options.genres.map((value) => <option key={value} value={value}>{value}</option>)}</Select></label>
    <label className="space-y-1.5 text-sm"><span className="font-semibold">Ocena od</span><Input type="number" min={0} max={10} step={0.5} value={filters.ratingMin ?? ""} onChange={(event) => onRatingChange("ratingMin", event.target.value)} placeholder="np. 7" /></label>
    <label className="space-y-1.5 text-sm"><span className="font-semibold">Ocena do</span><Input type="number" min={0} max={10} step={0.5} value={filters.ratingMax ?? ""} onChange={(event) => onRatingChange("ratingMax", event.target.value)} placeholder="np. 10" /></label>
  </CardContent></Card>;
}

function EmptyAnalysis({ year, filtersActive, onClear }: { year: number; filtersActive: boolean; onClear: () => void }) {
  return <Card className="border-dashed"><CardContent className="flex min-h-52 flex-col items-center justify-center gap-4 p-6 text-center"><div><p className="font-semibold">{filtersActive ? "Brak gier spełniających wybrane filtry" : `Brak ukończonych gier w ${year} roku.`}</p><p className="mt-1 text-sm text-muted-foreground">{filtersActive ? "Wyczyść filtry albo wybierz inne kryteria." : "Po dodaniu pierwszego ukończenia pojawią się tutaj statystyki i wykresy."}</p></div><div className="flex flex-wrap justify-center gap-2">{filtersActive ? <Button type="button" variant="secondary" onClick={onClear}><X className="h-4 w-4" aria-hidden="true" />Wyczyść filtry</Button> : null}<Link href="/completed-games/new"><Button><Plus className="h-4 w-4" aria-hidden="true" />Dodaj ukończoną grę</Button></Link></div></CardContent></Card>;
}

function activeFiltersCount(filters: CompletedYearFilters) { return Number(filters.month !== undefined) + filters.platforms.length + filters.genres.length + Number(filters.ratingMin !== undefined) + Number(filters.ratingMax !== undefined); }

function getAnalyticsYearNavigation(year: number, years: CompletedGamesYear[]) {
  if (years.some((item) => item.year === year)) return getAvailableYearNavigation(year, years);
  const ordered = years.map((item) => item.year).sort((left, right) => right - left);
  return { newerYear: ordered.find((item) => item > year) ?? null, olderYear: ordered.find((item) => item < year) ?? null };
}
