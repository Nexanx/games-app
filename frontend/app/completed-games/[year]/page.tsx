"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Filter, Plus, X } from "lucide-react";

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
  getCompletedYearFiltersError,
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
  const filtersError = getCompletedYearFiltersError(filters);

  const [entries, setEntries] = useState<CompletedGameEntry[]>([]);
  const [years, setYears] = useState<CompletedGamesYear[]>([]);
  const [dashboard, setDashboard] = useState<CompletedGamesYearDashboard | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!validYear) return;
    if (filtersError) {
      setEntries([]);
      setEntriesError(null);
      setEntriesLoading(false);
      return;
    }

    const controller = new AbortController();
    setEntriesLoading(true);
    setEntriesError(null);
    api
      .listCompletedGames(year, {
        month: filters.month,
        platform: filters.platforms,
        genre: filters.genres,
        rating_min: filters.ratingMin,
        rating_max: filters.ratingMax,
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
        playtime_min: filters.playtimeMin,
        playtime_max: filters.playtimeMax
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
  }, [filterQuery, filters.dateFrom, filters.dateTo, filters.genres, filters.month, filters.platforms, filters.playtimeMax, filters.playtimeMin, filters.ratingMax, filters.ratingMin, filtersError, validYear, year]);

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
    updateFilters({ ...filters, [bound]: value });
  }

  function updatePlaytime(bound: "playtimeMin" | "playtimeMax", rawValue: string) {
    const parsed = rawValue === "" ? undefined : Number(rawValue);
    const value = typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
    updateFilters({ ...filters, [bound]: value });
  }

  function toggleMonth(month: number) {
    setCollapsedMonths((current) => {
      const next = new Set(current);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Historia roczna</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Ukończone gry — {year}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{completedCount == null ? "Ładowanie liczby ukończeń…" : completedGamesLabel(completedCount)} · {entriesLoading ? "aktualizowanie wyników…" : `wyświetlono: ${entries.length}`}</p>
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
              <legend className="text-sm font-semibold">Moja ocena</legend>
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
            <div className="grid gap-5 lg:grid-cols-2">
              <fieldset>
                <legend className="text-sm font-semibold">Data ukończenia</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm text-muted-foreground">
                    <span>Od</span>
                    <Input type="date" min={`${year}-01-01`} max={`${year}-12-31`} value={filters.dateFrom ?? ""} onChange={(event) => updateFilters({ ...filters, dateFrom: event.target.value || undefined })} />
                  </label>
                  <label className="space-y-1.5 text-sm text-muted-foreground">
                    <span>Do</span>
                    <Input type="date" min={`${year}-01-01`} max={`${year}-12-31`} value={filters.dateTo ?? ""} onChange={(event) => updateFilters({ ...filters, dateTo: event.target.value || undefined })} />
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-semibold">Czas gry w godzinach</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm text-muted-foreground">
                    <span>Minimum</span>
                    <Input type="number" min={0} step="any" value={filters.playtimeMin ?? ""} onChange={(event) => updatePlaytime("playtimeMin", event.target.value)} placeholder="np. 5" />
                  </label>
                  <label className="space-y-1.5 text-sm text-muted-foreground">
                    <span>Maksimum</span>
                    <Input type="number" min={0} step="any" value={filters.playtimeMax ?? ""} onChange={(event) => updatePlaytime("playtimeMax", event.target.value)} placeholder="np. 100" />
                  </label>
                </div>
              </fieldset>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {filtersError ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{filtersError}</p> : null}

      {entriesError ? <ErrorState message={entriesError} /> : null}
      {entriesLoading ? <LoadingState label="Aktualizowanie listy gier" /> : null}
      {!entriesLoading && !entriesError && !filtersError && !entries.length ? (
        <EmptyState
          title={filtersActive ? "Brak gier spełniających wybrane filtry" : `Brak ukończonych gier w ${year} roku`}
          description={filtersActive ? "Wyczyść filtry albo wybierz inne kryteria." : "Dodaj pierwszy wpis z datą ukończenia w tym roku."}
        />
      ) : null}
      {!entriesLoading && !entriesError && !filtersError ? monthGroups.map((group) => (
        <section key={group.month} className="space-y-3" aria-labelledby={`month-${group.month}`}>
          <h2 id={`month-${group.month}`} className="border-b border-border">
            <button
              type="button"
              className="flex min-h-12 w-full items-center gap-3 rounded-md pb-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={!collapsedMonths.has(group.month)}
              aria-controls={`month-games-${group.month}`}
              onClick={() => toggleMonth(group.month)}
            >
              <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${collapsedMonths.has(group.month) ? "-rotate-90" : ""}`} aria-hidden="true" />
              <span className="text-xl font-bold">{group.label}</span>
              <span className="ml-auto text-sm font-normal text-muted-foreground">{gamesCountLabel(group.entries.length)}</span>
            </button>
          </h2>
          {!collapsedMonths.has(group.month) ? <div id={`month-games-${group.month}`} className="space-y-3">{group.entries.map((entry) => <CompletedGameCard key={entry.id} entry={entry} />)}</div> : null}
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
    + Number(filters.ratingMax !== undefined)
    + Number(Boolean(filters.dateFrom))
    + Number(Boolean(filters.dateTo))
    + Number(filters.playtimeMin !== undefined)
    + Number(filters.playtimeMax !== undefined);
}

function completedGamesLabel(count: number) { return count === 1 ? "1 ukończona gra" : `${count} ukończonych gier`; }

function gamesCountLabel(count: number) {
  if (count === 1) return "1 gra";
  if (count >= 2 && count <= 4) return `${count} gry`;
  return `${count} gier`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
