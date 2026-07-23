"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck2, ChartNoAxesCombined, Filter, Plus, RotateCcw, X } from "lucide-react";

import { AnalyticsSectionNav } from "@/components/analytics/AnalyticsSectionNav";
import { CompletedYearDashboard } from "@/components/games/CompletedYearDashboard";
import { CompletedYearsComparison } from "@/components/games/CompletedYearsComparison";
import { YearNavigation } from "@/components/games/YearNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/select";
import { analyticsPeriodLabel } from "@/lib/analytics";
import { parseAnalyticsSection, type AnalyticsSection } from "@/lib/analytics-sections";
import { completedYearFiltersFromSearchParams, completedYearFiltersToSearchParams, currentCompletedGamesYear, hasCompletedYearFilters, polishMonthNames, type CompletedYearFilters } from "@/lib/completed-games";
import { api } from "@/services/api";
import type { CompletedGamesComparison, CompletedGamesFilterOptions, CompletedGamesYear, CompletedGamesYearDashboard } from "@/types";

const AnalyticsTrends = dynamic(() => import("@/components/analytics/AnalyticsTrends").then((module) => module.AnalyticsTrends), { ssr: false, loading: SectionLoading });
const AnalyticsHeatmap = dynamic(() => import("@/components/analytics/AnalyticsHeatmap").then((module) => module.AnalyticsHeatmap), { ssr: false, loading: SectionLoading });
const MonthComparison = dynamic(() => import("@/components/analytics/MonthComparison").then((module) => module.MonthComparison), { ssr: false, loading: SectionLoading });
const ForecastSection = dynamic(() => import("@/components/analytics/ForecastSection").then((module) => module.ForecastSection), { ssr: false, loading: SectionLoading });
const AnnualReport = dynamic(() => import("@/components/analytics/AnnualReport").then((module) => module.AnnualReport), { ssr: false, loading: SectionLoading });

const emptyFilters: CompletedYearFilters = { platforms: [], genres: [] };

export default function AnalyticsYearPage() {
  const { year: yearParam } = useParams<{ year: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const year = Number(yearParam);
  const validYear = Number.isInteger(year) && year >= 1900 && year <= 9998;
  const filterQuery = completedYearFiltersToSearchParams(completedYearFiltersFromSearchParams(searchParams)).toString();
  const requestedSection = searchParams.get("section");
  const section: AnalyticsSection = parseAnalyticsSection(requestedSection);
  const needsDashboard = section === "summary" || section === "trends";
  const filters = useMemo(() => completedYearFiltersFromSearchParams(new URLSearchParams(filterQuery)), [filterQuery]);
  const filtersActive = hasCompletedYearFilters(filters);
  const [years, setYears] = useState<CompletedGamesYear[]>([]);
  const [dashboard, setDashboard] = useState<CompletedGamesYearDashboard | null>(null);
  const [filterOptions, setFilterOptions] = useState<CompletedGamesFilterOptions>({ platforms: [], genres: [] });
  const [loading, setLoading] = useState(needsDashboard);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(filtersActive);
  const [comparisonYears, setComparisonYears] = useState<number[]>([]);
  const [comparison, setComparison] = useState<CompletedGamesComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const comparisonInitialized = useRef(false);

  useEffect(() => { if (!validYear) return; const controller = new AbortController(); api.listAnalyticsYears(controller.signal).then(setYears).catch(() => undefined); return () => controller.abort(); }, [validYear, year]);

  useEffect(() => {
    if (!validYear || !needsDashboard) { setLoading(false); setError(null); return; }
    const controller = new AbortController(); setLoading(true); setError(null); setDashboard(null);
    api.getCompletedYearDashboard(year, { month: filters.month, platform: filters.platforms, genre: filters.genres, rating_min: filters.ratingMin, rating_max: filters.ratingMax }, controller.signal)
      .then((result) => { setDashboard(result); setFilterOptions(result.filter_options); })
      .catch((reason) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Nie udało się pobrać analiz."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filterQuery, filters.genres, filters.month, filters.platforms, filters.ratingMax, filters.ratingMin, needsDashboard, retryKey, validYear, year]);

  const availableYears = useMemo(() => { const current = years.find((item) => item.year === year); const candidates = current || !dashboard ? years : [{ year, completed_games_count: dashboard.completed_games_count }, ...years]; return [...candidates].sort((left, right) => right.year - left.year); }, [dashboard, year, years]);
  const comparisonYearsKey = comparisonYears.join(",");

  useEffect(() => { if (section !== "summary" || comparisonInitialized.current || availableYears.length < 2) return; comparisonInitialized.current = true; setComparisonYears(availableYears.slice(0, 2).map((item) => item.year)); }, [availableYears, section]);
  useEffect(() => { if (section !== "summary" || comparisonYears.length !== 2) { setComparison(null); setComparisonError(null); return; } let active = true; setComparisonLoading(true); setComparisonError(null); api.compareCompletedYears(comparisonYears).then((result) => { if (active) setComparison(result); }).catch((reason) => { if (active) setComparisonError(reason instanceof Error ? reason.message : "Nie udało się porównać lat."); }).finally(() => { if (active) setComparisonLoading(false); }); return () => { active = false; }; }, [comparisonYears, comparisonYearsKey, section]);

  if (!validYear) return <ErrorState message="Nieprawidłowy rok." />;

  function updateFilters(nextFilters: CompletedYearFilters) { const params = completedYearFiltersToSearchParams(nextFilters); if (section !== "summary") params.set("section", section); if (section === "trends" && searchParams.get("metric")) params.set("metric", searchParams.get("metric") as string); router.replace(`/analytics/${year}${params.size ? `?${params}` : ""}`, { scroll: false }); }
  function updateRating(bound: "ratingMin" | "ratingMax", raw: string) { const parsed = raw === "" ? undefined : Number(raw); const value = parsed !== undefined && Number.isFinite(parsed) && parsed >= 0 && parsed <= 10 ? parsed : undefined; const next = { ...filters, [bound]: value }; if (next.ratingMin !== undefined && next.ratingMax !== undefined && next.ratingMin > next.ratingMax) { if (bound === "ratingMin") next.ratingMax = undefined; else next.ratingMin = undefined; } updateFilters(next); }
  const yearHref = (target: number) => `/analytics/${target}${section === "summary" ? "" : `?section=${section}`}`;

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-primary">Statystyki ukończeń</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Analizy — {year}</h1><p className="mt-2 text-sm text-muted-foreground">{needsDashboard ? <>Aktywny okres: <strong className="text-foreground">{analyticsPeriodLabel(year, filters)}</strong>{filtersActive ? ` · ${activeFiltersCount(filters)} aktywne filtry` : ""}</> : "Wybierz sekcję, aby przeanalizować zapisane ukończenia."}</p></div><div className="flex flex-col items-start gap-3 lg:items-end"><div className="flex flex-wrap gap-2"><Link href="/analytics/history"><Button variant="secondary"><ChartNoAxesCombined className="h-4 w-4" aria-hidden="true" />Cała historia</Button></Link><Link href={`/completed-games/${year}`}><Button variant="secondary"><CalendarCheck2 className="h-4 w-4" aria-hidden="true" />Lista gier</Button></Link><Link href="/completed-games/new"><Button><Plus className="h-4 w-4" aria-hidden="true" />Dodaj grę</Button></Link></div><YearNavigation year={year} years={years} hrefForYear={yearHref} ariaLabel="Wybór roku analiz" currentCalendarYear={currentCompletedGamesYear()} /></div></header>
    <AnalyticsSectionNav year={year} active={section} />
    {needsDashboard ? <><Button type="button" variant={filtersActive ? "primary" : "secondary"} className="min-h-12 w-full justify-start" aria-expanded={filtersOpen} aria-controls="analytics-filters" onClick={() => setFiltersOpen((value) => !value)}><Filter className="h-5 w-5" aria-hidden="true" />Filtry analizy<span className="ml-auto text-xs font-normal">{filtersActive ? `${activeFiltersCount(filters)} aktywne` : filtersOpen ? "Ukryj" : "Pokaż"}</span></Button>{filtersOpen ? <AnalyticsFilters filters={filters} options={filterOptions} onChange={updateFilters} onRatingChange={updateRating} /> : null}</> : null}
    {loading ? <LoadingState label="Aktualizowanie analiz" /> : null}
    {!loading && error ? <div className="space-y-3"><ErrorState message={error} /><Button type="button" variant="secondary" onClick={() => setRetryKey((value) => value + 1)}><RotateCcw className="h-4 w-4" aria-hidden="true" />Spróbuj ponownie</Button></div> : null}
    {!loading && !error && needsDashboard && dashboard?.completed_games_count === 0 && (filtersActive || !(dashboard.poe_leagues_count ?? 0)) ? <EmptyAnalysis year={year} filtersActive={filtersActive} onClear={() => updateFilters(emptyFilters)} /> : null}
    {!loading && !error && dashboard && (dashboard.completed_games_count > 0 || (!filtersActive && (dashboard.poe_leagues_count ?? 0) > 0)) && section === "summary" ? <CompletedYearDashboard dashboard={dashboard} filters={filters} /> : null}
    {!loading && !error && dashboard && dashboard.completed_games_count > 0 && section === "trends" ? <AnalyticsTrends dashboard={dashboard} /> : null}
    {section === "heatmap" ? <AnalyticsHeatmap year={year} /> : null}
    {section === "compare" ? <MonthComparison year={year} /> : null}
    {section === "forecast" ? <ForecastSection /> : null}
    {section === "report" ? <AnnualReport year={year} /> : null}
    {section === "summary" && availableYears.length >= 2 ? <CompletedYearsComparison availableYears={availableYears} selectedYears={comparisonYears} comparison={comparison} loading={comparisonLoading} onSelectedYearsChange={setComparisonYears} /> : null}
    {comparisonError ? <ErrorState message={comparisonError} /> : null}
  </div>;
}

function AnalyticsFilters({ filters, options, onChange, onRatingChange }: { filters: CompletedYearFilters; options: CompletedGamesFilterOptions; onChange: (filters: CompletedYearFilters) => void; onRatingChange: (bound: "ratingMin" | "ratingMax", value: string) => void }) { return <Card id="analytics-filters"><CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0"><div><CardTitle>Zakres i filtry</CardTitle><CardDescription>Filtry wpływają na podsumowanie i trendy oraz pozostają w adresie URL.</CardDescription></div><Button type="button" variant="secondary" disabled={!hasCompletedYearFilters(filters)} onClick={() => onChange(emptyFilters)}><X className="h-4 w-4" aria-hidden="true" />Wyczyść filtry</Button></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><FilterSelect label="Miesiąc" value={filters.month ?? ""} onChange={(value) => onChange({ ...filters, month: value ? Number(value) : undefined })} options={polishMonthNames.map((label,index)=>({label,value:String(index+1)}))} /><FilterSelect label="Platforma" value={filters.platforms[0] ?? ""} onChange={(value) => onChange({ ...filters, platforms: value ? [value] : [] })} options={options.platforms.map((value)=>({label:value,value}))} /><FilterSelect label="Gatunek" value={filters.genres[0] ?? ""} onChange={(value) => onChange({ ...filters, genres: value ? [value] : [] })} options={options.genres.map((value)=>({label:value,value}))} /><label className="space-y-1.5 text-sm"><span className="font-semibold">Ocena od</span><Input type="number" min={0} max={10} step={0.5} value={filters.ratingMin ?? ""} onChange={(event) => onRatingChange("ratingMin", event.target.value)} /></label><label className="space-y-1.5 text-sm"><span className="font-semibold">Ocena do</span><Input type="number" min={0} max={10} step={0.5} value={filters.ratingMax ?? ""} onChange={(event) => onRatingChange("ratingMax", event.target.value)} /></label></CardContent></Card>; }
function FilterSelect({ label, value, options, onChange }: { label: string; value: string | number; options: Array<{label:string;value:string}>; onChange: (value:string)=>void }) { return <label className="space-y-1.5 text-sm"><span className="font-semibold">{label}</span><Select value={value} onChange={(event)=>onChange(event.target.value)}><option value="">Wszystkie</option>{options.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</Select></label>; }
function EmptyAnalysis({ year, filtersActive, onClear }: { year: number; filtersActive: boolean; onClear: () => void }) { return <Card className="border-dashed"><CardContent className="flex min-h-52 flex-col items-center justify-center gap-4 p-6 text-center"><div><p className="font-semibold">{filtersActive ? "Brak gier spełniających wybrane filtry" : `Brak ukończonych gier w ${year} roku.`}</p><p className="mt-1 text-sm text-muted-foreground">{filtersActive ? "Wyczyść filtry albo wybierz inne kryteria." : "Po dodaniu pierwszego ukończenia pojawią się tutaj statystyki i wykresy."}</p></div>{filtersActive ? <Button type="button" variant="secondary" onClick={onClear}><X className="h-4 w-4" aria-hidden="true" />Wyczyść filtry</Button> : null}</CardContent></Card>; }
function activeFiltersCount(filters: CompletedYearFilters) { return Number(filters.month !== undefined) + filters.platforms.length + filters.genres.length + Number(filters.ratingMin !== undefined) + Number(filters.ratingMax !== undefined); }
function SectionLoading() { return <LoadingState label="Ładowanie sekcji analitycznej" />; }
