"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Filter, ListPlus, Loader2, Search, X } from "lucide-react";

import { ExternalRatings } from "@/components/games/ExternalRatings";
import { GameCover } from "@/components/games/GameCover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatReleaseDate, getDiscoveryGameKey, groupReleasesByDate } from "@/lib/discovery";
import { api } from "@/services/api";
import type { GameReleaseFilters, GameSearchResult } from "@/types";

const PLATFORM_OPTIONS = ["PC", "PlayStation", "Xbox", "Nintendo", "iOS", "macOS", "Linux", "Android", "Web"];
const GENRE_OPTIONS = ["Action", "Adventure", "RPG", "Strategy", "Shooter", "Indie", "Simulation", "Puzzle", "Racing", "Sports", "Fighting", "Platformer"];

function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const toIso = (value: Date) => {
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  };
  return {
    date_from: toIso(new Date(year, month, 1)),
    date_to: toIso(new Date(year, month + 1, 0))
  };
}

export default function ReleasesPage() {
  const [filters, setFilters] = useState<GameReleaseFilters>(() => ({
    ...currentMonthRange(), platform: "", genre: "", search: ""
  }));
  const [appliedFilters, setAppliedFilters] = useState<GameReleaseFilters>(() => ({
    ...currentMonthRange(), platform: "", genre: "", search: ""
  }));
  const [games, setGames] = useState<GameSearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  async function load(nextFilters: GameReleaseFilters, nextPage = 1) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await api.getGameReleases({ ...nextFilters, page: nextPage, page_size: 20 }, controller.signal);
      setGames(response.results);
      setPage(response.page);
      setHasNext(response.has_next);
      setAppliedFilters(nextFilters);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "Nie udało się pobrać premier.");
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void load(filters, 1);
    return () => activeRequest.current?.abort();
    // Initial range is intentionally loaded once; later changes are submitted by the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (filters.date_from > filters.date_to) {
      setError("Data początkowa nie może być późniejsza niż końcowa.");
      return;
    }
    void load(filters, 1);
  }

  function clearFilters() {
    const next = { ...currentMonthRange(), platform: "", genre: "", search: "" };
    setFilters(next);
    void load(next, 1);
  }

  async function addToBacklog(game: GameSearchResult) {
    const key = getDiscoveryGameKey(game);
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    try {
      await api.createBacklogBatch({ games: [game] });
      setAdded((current) => new Set(current).add(key));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nie udało się dodać gry do listy.");
    } finally {
      setBusyKey(null);
    }
  }

  const groups = groupReleasesByDate(games);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link href="/backlog" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Wróć do listy Do ogrania
        </Link>
        <div>
          <p className="text-sm font-semibold text-primary">Odkrywaj nowe gry</p>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Premiery</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Lista premier według danych RAWG. Daty, szczególnie przyszłe i zależne od platformy, mogą ulec zmianie.
          </p>
        </div>
      </header>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-1 text-xs text-muted-foreground">
              Od
              <Input type="date" required value={filters.date_from} onChange={(event) => setFilters({ ...filters, date_from: event.target.value })} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Do
              <Input type="date" required value={filters.date_to} onChange={(event) => setFilters({ ...filters, date_to: event.target.value })} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Platforma
              <Select value={filters.platform} onChange={(event) => setFilters({ ...filters, platform: event.target.value })}>
                <option value="">Wszystkie</option>
                {PLATFORM_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Gatunek
              <Select value={filters.genre} onChange={(event) => setFilters({ ...filters, genre: event.target.value })}>
                <option value="">Wszystkie</option>
                {GENRE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2 xl:col-span-2">
              Tytuł
              <span className="flex gap-2">
                <Input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Szukaj tytułu" />
                <Button type="submit" disabled={loading}><Search className="h-4 w-4" aria-hidden="true" /> Szukaj</Button>
              </span>
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-6">
              <Button type="submit" disabled={loading}><Filter className="h-4 w-4" aria-hidden="true" /> Zastosuj filtry</Button>
              <Button type="button" variant="ghost" onClick={clearFilters} disabled={loading}><X className="h-4 w-4" aria-hidden="true" /> Bieżący miesiąc</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? <p className="rounded-md bg-destructive/15 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
      {loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Pobieranie premier z RAWG…</p> : null}
      {!loading ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Wyniki na stronie: <strong className="text-foreground">{games.length}</strong> · Zakres {formatReleaseDate(appliedFilters.date_from)} – {formatReleaseDate(appliedFilters.date_to)}
        </p>
      ) : null}

      {!loading && !groups.length && !error ? (
        <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">Brak premier spełniających wybrane kryteria.</p>
      ) : null}

      {groups.map((group) => (
        <section key={group.date ?? "unknown"} className="space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <h2 className="text-lg font-semibold">{formatReleaseDate(group.date)}</h2>
            <Badge>{group.games.length}</Badge>
          </div>
          <div className="space-y-3">
            {group.games.map((game) => {
              const key = getDiscoveryGameKey(game);
              const isAdded = added.has(key);
              const platformDates = game.platform_release_dates?.filter((item) => item.release_date) ?? [];
              return (
                <Card key={key} className="overflow-hidden">
                  <CardContent className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[100px_minmax(0,1fr)_auto] sm:p-4">
                    <GameCover src={game.cover_url} title={game.title} className="h-auto w-full self-start" />
                    <div className="min-w-0 space-y-2">
                      {game.external_id ? (
                        <Link href={`/releases/${game.external_id}`} className="text-lg font-semibold hover:text-accent">{game.title}</Link>
                      ) : <h3 className="text-lg font-semibold">{game.title}</h3>}
                      <p className="text-sm text-muted-foreground">{game.genres.join(", ") || "Brak danych o gatunku"}</p>
                      <p className="text-xs text-muted-foreground">{game.platforms.join(", ") || "Brak danych o platformach"}</p>
                      {platformDates.length ? (
                        <p className="text-xs leading-5 text-muted-foreground">
                          Daty platformowe: {platformDates.slice(0, 4).map((item) => `${item.platform}: ${formatReleaseDate(item.release_date)}`).join(" · ")}
                        </p>
                      ) : null}
                      {game.release_date_tba ? <Badge>Termin orientacyjny</Badge> : null}
                      <ExternalRatings ratings={game.external_ratings} updatedAt={game.external_ratings_updated_at} compact />
                    </div>
                    <div className="col-span-2 flex items-start sm:col-span-1">
                      <Button type="button" onClick={() => void addToBacklog(game)} disabled={isAdded || Boolean(busyKey)}>
                        {busyKey === key ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ListPlus className="h-4 w-4" aria-hidden="true" />}
                        {isAdded ? "Dodano" : "Dodaj do ogrania"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      {!loading && (page > 1 || hasNext) ? (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Strona {page}</span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void load(appliedFilters, page - 1)} disabled={loading || page <= 1}><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Poprzednia</Button>
            <Button type="button" variant="secondary" onClick={() => void load(appliedFilters, page + 1)} disabled={loading || !hasNext}>Następna <ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Źródło: <a href="https://rawg.io/apidocs" target="_blank" rel="noreferrer" className="underline hover:text-foreground">RAWG Video Games Database API</a>. Data ogólna i daty dla poszczególnych platform mogą się różnić.
      </p>
    </div>
  );
}
