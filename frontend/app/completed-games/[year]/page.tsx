"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Filter, Plus, X } from "lucide-react";

import { CompletedGameCard } from "@/components/games/CompletedGameCard";
import { YearNavigation } from "@/components/games/YearNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/select";
import {
  completedYearFiltersFromSearchParams,
  completedYearFiltersToSearchParams,
  currentCompletedGamesYear,
  groupCompletedGamesByMonth,
  hasCompletedYearFilters,
  type CompletedYearFilters
} from "@/lib/completed-games";
import { api } from "@/services/api";
import type {
  CompletedGameEntry,
  CompletedGamesYear,
  CompletedGamesYearDashboard
} from "@/types";

const emptyFilters: CompletedYearFilters = { platforms: [], genres: [] };

export default function CompletedGamesYearPage() {
  const { year: yearParam } = useParams<{ year: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const year = Number(yearParam);
  const validYear = Number.isInteger(year) && year >= 1900 && year <= 9998;
  const filterQuery = searchParams.toString();
  const filters = useMemo(
    () => completedYearFiltersFromSearchParams(searchParams),
    // The URL, not the mutable ReadonlyURLSearchParams object, is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterQuery]
  );
  const filtersActive = hasCompletedYearFilters(filters);

  const [entries, setEntries] = useState<CompletedGameEntry[]>([]);
  const [years, setYears] = useState<CompletedGamesYear[]>([]);
  const [dashboard, setDashboard] = useState<CompletedGamesYearDashboard | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!validYear) return;

    const controller = new AbortController();
    setEntriesLoading(true);
    setEntriesError(null);
    api
      .listCompletedGames(year, {
        month: filters.month,
        platform: filters.platforms,
        genre: filters.genres,
        rating_min: filters.ratingMin,
        rating_max: filters.ratingMax
      }, controller.signal)
      .then((result) => {
        setEntries(result);
      })
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setEntriesError(err instanceof Error ? err.message : "Nie udało się pobrać ukończonych gier.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setEntriesLoading(false);
      });

    return () => controller.abort();
  }, [filterQuery, filters.genres, filters.month, filters.platforms, filters.ratingMax, filters.ratingMin, validYear, year]);

  useEffect(() => {
    if (!validYear) return;

    const controller = new AbortController();
    setMetadataLoading(true);
    setMetadataError(null);
    setYears([]);
    setDashboard(null);

    Promise.allSettled([api.listCompletedYears(controller.signal), api.getCompletedYearDashboard(year, {}, controller.signal)])
      .then(([yearsResult, dashboardResult]) => {
        if (controller.signal.aborted) return;

        const errors: string[] = [];
        if (yearsResult.status === "fulfilled") {
          setYears(yearsResult.value);
        } else {
          errors.push(getErrorMessage(yearsResult.reason, "Nie udało się pobrać listy innych lat."));
        }

        if (dashboardResult.status === "fulfilled") {
          setDashboard(dashboardResult.value);
        } else {
          errors.push(getErrorMessage(dashboardResult.reason, "Nie udało się pobrać podsumowania roku."));
        }

        if (errors.length) setMetadataError(errors.join(" "));
      })
      .finally(() => {
        if (!controller.signal.aborted) setMetadataLoading(false);
      });

    return () => controller.abort();
  }, [validYear, year]);

  const monthGroups = useMemo(() => groupCompletedGamesByMonth(entries), [entries]);
  const completedCount = dashboard?.completed_games_count ?? years.find((item) => item.year === year)?.completed_games_count;

  if (!validYear) return <ErrorState message="Nieprawidłowy rok." />;
  if (metadataLoading && entriesLoading && !dashboard) {
    return <LoadingState label={`Ładowanie ukończonych gier z ${year} roku`} />;
  }

  function updateFilters(nextFilters: CompletedYearFilters) {
    const query = completedYearFiltersToSearchParams(nextFilters).toString();
    router.replace(`/completed-games/${year}${query ? `?${query}` : ""}`, { scroll: false });
  }

  function toggleFilterValue(kind: "platforms" | "genres", value: string) {
    const values = filters[kind];
    const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
    updateFilters({ ...filters, [kind]: nextValues });
  }

  function updateRating(bound: "ratingMin" | "ratingMax", rawValue: string) {
    const parsed = rawValue === "" ? undefined : Number(rawValue);
    const value = typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 10 ? parsed : undefined;
    const nextFilters = { ...filters, [bound]: value };
    if (nextFilters.ratingMin !== undefined && nextFilters.ratingMax !== undefined && nextFilters.ratingMin > nextFilters.ratingMax) {
      if (bound === "ratingMin") nextFilters.ratingMax = undefined;
      else nextFilters.ratingMin = undefined;
    }
    updateFilters(nextFilters);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Historia roczna</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Ukończone gry — {year}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{completedCount == null ? "Ładowanie liczby ukończeń…" : completedGamesLabel(completedCount)}{filtersActive ? ` · po filtrach: ${entries.length}` : ""}</p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <Link href="/completed-games/new"><Button><Plus className="h-4 w-4" aria-hidden="true" />Dodaj grę</Button></Link>
          <YearNavigation year={year} years={years} hrefForYear={(target) => `/completed-games/${target}`} ariaLabel="Wybór roku ukończonych gier" currentCalendarYear={currentCompletedGamesYear()} />
        </div>
      </header>

      {metadataError ? <ErrorState message={metadataError} /> : null}
      <Button
        type="button"
        variant={filtersActive ? "primary" : "secondary"}
        className="min-h-12 w-full justify-start"
        aria-expanded={filtersOpen}
        aria-controls="completed-games-filters"
        onClick={() => setFiltersOpen((current) => !current)}
      >
        <Filter className="h-5 w-5" aria-hidden="true" />
        <span>Filtry</span>
        <span className="ml-auto text-xs font-normal">
          {filtersActive ? `${getActiveFiltersCount(filters)} aktywne` : filtersOpen ? "Ukryj" : "Pokaż"}
        </span>
      </Button>

      {filtersOpen ? (
        <Card id="completed-games-filters">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Filtry wpisów</CardTitle>
              <CardDescription>Filtry dotyczą wyłącznie wybranego roku i są zapisane w adresie URL.</CardDescription>
            </div>
            <Button type="button" variant="secondary" disabled={!filtersActive} onClick={() => updateFilters(emptyFilters)}>
              <X className="h-4 w-4" aria-hidden="true" /> Wyczyść filtry
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <CheckboxFilterGroup
                legend="Platformy"
                values={dashboard?.filter_options.platforms ?? []}
                selected={filters.platforms}
                onToggle={(value) => toggleFilterValue("platforms", value)}
                emptyLabel="Brak platform w tym roku."
              />
              <CheckboxFilterGroup
                legend="Gatunki"
                values={dashboard?.filter_options.genres ?? []}
                selected={filters.genres}
                onToggle={(value) => toggleFilterValue("genres", value)}
                emptyLabel="Brak gatunków w tym roku."
              />
            </div>
            <fieldset>
              <legend className="text-sm font-semibold">Ocena</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm text-muted-foreground">
                  <span>Od</span>
                  <Input type="number" min={0} max={10} step={0.5} value={filters.ratingMin ?? ""} onChange={(event) => updateRating("ratingMin", event.target.value)} placeholder="np. 8" />
                </label>
                <label className="space-y-1.5 text-sm text-muted-foreground">
                  <span>Do</span>
                  <Input type="number" min={0} max={10} step={0.5} value={filters.ratingMax ?? ""} onChange={(event) => updateRating("ratingMax", event.target.value)} placeholder="np. 10" />
                </label>
              </div>
            </fieldset>
          </CardContent>
        </Card>
      ) : null}

      {entriesError ? <ErrorState message={entriesError} /> : null}
      {entriesLoading ? <LoadingState label="Aktualizowanie listy gier" /> : null}
      {!entriesLoading && !entriesError && !entries.length ? (
        <EmptyState
          title={filtersActive ? "Brak gier spełniających wybrane filtry" : `Brak ukończonych gier w ${year} roku`}
          description={filtersActive ? "Wyczyść filtry albo wybierz inne kryteria." : "Dodaj pierwszy wpis z datą ukończenia w tym roku."}
        />
      ) : null}
      {!entriesLoading && !entriesError ? monthGroups.map((group) => (
        <section key={group.month} className="space-y-3" aria-labelledby={`month-${group.month}`}>
          <div className="flex items-baseline justify-between border-b border-border pb-2"><h2 id={`month-${group.month}`} className="text-xl font-bold">{group.label}</h2><span className="text-sm text-muted-foreground">{group.entries.length} gier</span></div>
          <div className="space-y-3">{group.entries.map((entry) => <CompletedGameCard key={entry.id} entry={entry} />)}</div>
        </section>
      )) : null}

    </div>
  );
}

function CheckboxFilterGroup({
  legend,
  values,
  selected,
  onToggle,
  emptyLabel
}: {
  legend: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  emptyLabel: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{legend}</legend>
      {values.length ? (
        <div className="mt-2 grid max-h-52 gap-2 overflow-y-auto rounded-md border border-border bg-background/35 p-3 sm:grid-cols-2">
          {values.map((value) => (
            <label key={value} className="flex min-h-9 items-center gap-2 rounded px-1 text-sm hover:bg-muted">
              <input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} className="h-4 w-4 accent-primary" />
              <span className="min-w-0 truncate">{value}</span>
            </label>
          ))}
        </div>
      ) : <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>}
    </fieldset>
  );
}

function getActiveFiltersCount(filters: CompletedYearFilters) {
  return Number(filters.month !== undefined)
    + filters.platforms.length
    + filters.genres.length
    + Number(filters.ratingMin !== undefined)
    + Number(filters.ratingMax !== undefined);
}

function completedGamesLabel(count: number) { return count === 1 ? "1 ukończona gra" : `${count} ukończonych gier`; }

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
