"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Filter,
  ListPlus,
  Loader2,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  X
} from "lucide-react";

import { ExternalRatings } from "@/components/games/ExternalRatings";
import { GameCover } from "@/components/games/GameCover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatReleaseDate, getDiscoveryGameKey, groupReleasesByDate } from "@/lib/discovery";
import { api } from "@/services/api";
import type {
  GameDiscoveryPreferences,
  GameReleaseFilters,
  GameReleaseRecommendation,
  GameSearchResult,
  ReleaseMatchLevel,
  ReleaseViewMode
} from "@/types";

const PLATFORM_OPTIONS = ["PC", "PlayStation", "Xbox", "Nintendo", "iOS", "macOS", "Linux", "Android", "Web"];
const GENRE_OPTIONS = ["Action", "Adventure", "RPG", "Strategy", "Shooter", "Indie", "Simulation", "Puzzle", "Racing", "Sports", "Fighting", "Platformer"];
const MATCH_LEVEL_LABELS: Record<ReleaseMatchLevel, string> = {
  strict: "Ścisłe",
  balanced: "Zrównoważone",
  discovery: "Odkrywanie"
};

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

function initialFilters(): GameReleaseFilters {
  return {
    ...currentMonthRange(),
    platform: "",
    genre: "",
    search: "",
    minimum_rating: "",
    release_status: "all",
    sort: "release_date"
  };
}

function asUnranked(game: GameSearchResult): GameReleaseRecommendation {
  return {
    game,
    score: 0,
    match_label: "Może Cię zainteresować",
    reasons: []
  };
}

export default function ReleasesPage() {
  const [filters, setFilters] = useState<GameReleaseFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<GameReleaseFilters>(initialFilters);
  const [view, setView] = useState<ReleaseViewMode>("for_you");
  const [matchLevel, setMatchLevel] = useState<ReleaseMatchLevel>("balanced");
  const [items, setItems] = useState<GameReleaseRecommendation[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<GameDiscoveryPreferences>({ platforms: [], genres: [] });
  const [preferenceDraft, setPreferenceDraft] = useState<GameDiscoveryPreferences>({ platforms: [], genres: [] });
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  async function load(
    nextFilters: GameReleaseFilters,
    nextPage = 1,
    nextView = view,
    nextLevel = matchLevel
  ) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const requestFilters = { ...nextFilters, page: nextPage, page_size: 20 };
      if (nextView === "for_you") {
        const response = await api.getRecommendedGameReleases(
          { ...requestFilters, match_level: nextLevel },
          controller.signal
        );
        setItems(response.results);
        setNotice(response.notice ?? null);
        setPage(response.page);
        setHasNext(response.has_next);
      } else {
        const response = nextView === "hidden"
          ? await api.getHiddenGameReleases(requestFilters, controller.signal)
          : await api.getGameReleases(requestFilters, controller.signal);
        setItems(response.results.map(asUnranked));
        setNotice(null);
        setPage(response.page);
        setHasNext(response.has_next);
      }
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
    const preferencesController = new AbortController();
    api.getGameReleasePreferences(preferencesController.signal)
      .then((response) => {
        setPreferences(response);
        setPreferenceDraft(response);
      })
      .catch((requestError) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError(requestError instanceof Error ? requestError.message : "Nie udało się pobrać preferencji premier.");
        }
      });
    void load(initialFilters(), 1, "for_you", "balanced");
    return () => {
      preferencesController.abort();
      activeRequest.current?.abort();
    };
    // Initial state is intentionally loaded once.
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
    const next = initialFilters();
    setFilters(next);
    void load(next, 1);
  }

  function changeView(nextView: ReleaseViewMode) {
    if (nextView === view) return;
    setView(nextView);
    void load(appliedFilters, 1, nextView, matchLevel);
  }

  function changeMatchLevel(nextLevel: ReleaseMatchLevel) {
    setMatchLevel(nextLevel);
    if (view === "for_you") void load(appliedFilters, 1, view, nextLevel);
  }

  function togglePreference(kind: keyof GameDiscoveryPreferences, value: string) {
    setPreferenceDraft((current) => {
      const selected = current[kind].includes(value);
      return {
        ...current,
        [kind]: selected
          ? current[kind].filter((item) => item !== value)
          : [...current[kind], value]
      };
    });
  }

  async function savePreferences() {
    if (preferencesSaving) return;
    setPreferencesSaving(true);
    setError(null);
    try {
      const saved = await api.saveGameReleasePreferences(preferenceDraft);
      setPreferences(saved);
      setPreferenceDraft(saved);
      if (view === "for_you") await load(appliedFilters, 1, view, matchLevel);
      setStatus("Preferencje premier zostały zapisane. Ranking został przeliczony.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nie udało się zapisać preferencji.");
    } finally {
      setPreferencesSaving(false);
    }
  }

  async function addToBacklog(item: GameReleaseRecommendation) {
    const key = getDiscoveryGameKey(item.game);
    if (busyKey || item.game.already_on_backlog || item.game.already_completed) return;
    setBusyKey(key);
    setError(null);
    try {
      await api.createBacklogBatch({ games: [item.game] });
      if (view === "for_you") {
        setItems((current) => current.filter((candidate) => getDiscoveryGameKey(candidate.game) !== key));
      } else {
        setItems((current) => current.map((candidate) => (
          getDiscoveryGameKey(candidate.game) === key
            ? { ...candidate, game: { ...candidate.game, already_on_backlog: true } }
            : candidate
        )));
      }
      setStatus(`„${item.game.title}” jest już na liście Do ogrania.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nie udało się dodać gry do listy.");
    } finally {
      setBusyKey(null);
    }
  }

  async function hideRelease(item: GameReleaseRecommendation) {
    const key = getDiscoveryGameKey(item.game);
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    try {
      await api.hideGameRelease(item.game);
      if (view === "for_you") {
        setItems((current) => current.filter((candidate) => getDiscoveryGameKey(candidate.game) !== key));
      } else {
        setItems((current) => current.map((candidate) => (
          getDiscoveryGameKey(candidate.game) === key
            ? { ...candidate, game: { ...candidate.game, hidden: true } }
            : candidate
        )));
      }
      setStatus(`Ukryto premierę „${item.game.title}”.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nie udało się ukryć premiery.");
    } finally {
      setBusyKey(null);
    }
  }

  async function restoreRelease(item: GameReleaseRecommendation) {
    const key = getDiscoveryGameKey(item.game);
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    try {
      await api.unhideGameRelease(item.game);
      setItems((current) => current.filter((candidate) => getDiscoveryGameKey(candidate.game) !== key));
      setStatus(`Przywrócono premierę „${item.game.title}”.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nie udało się przywrócić premiery.");
    } finally {
      setBusyKey(null);
    }
  }

  const itemByKey = useMemo(
    () => new Map(items.map((item) => [getDiscoveryGameKey(item.game), item])),
    [items]
  );
  const releaseGroups = view === "all" && appliedFilters.sort === "release_date"
    ? groupReleasesByDate(items.map((item) => item.game))
    : null;
  const preferencesChanged = JSON.stringify(preferences) !== JSON.stringify(preferenceDraft);

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
            Domyślny ranking korzysta z ocen, gatunków, platform i zapisanych reakcji. Daty premier pochodzą z RAWG i mogą ulec zmianie.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2" aria-label="Widok premier">
        <Button type="button" variant={view === "for_you" ? "primary" : "secondary"} onClick={() => changeView("for_you")} aria-pressed={view === "for_you"}>
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Dla Ciebie
        </Button>
        <Button type="button" variant={view === "all" ? "primary" : "secondary"} onClick={() => changeView("all")} aria-pressed={view === "all"}>
          Wszystkie premiery
        </Button>
        <Button type="button" variant={view === "hidden" ? "primary" : "secondary"} onClick={() => changeView("hidden")} aria-pressed={view === "hidden"}>
          <EyeOff className="h-4 w-4" aria-hidden="true" /> Ukryte premiery
        </Button>
      </div>

      {view === "for_you" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" aria-hidden="true" /> Dopasowanie premier</CardTitle>
            <CardDescription>
              Puste preferencje oznaczają automatyczne wnioskowanie z historii. Platformy są warunkiem dostępności, a gatunki dodatkowym sygnałem.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Poziom dopasowania</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(MATCH_LEVEL_LABELS) as ReleaseMatchLevel[]).map((level) => (
                  <Button key={level} type="button" variant={matchLevel === level ? "primary" : "secondary"} onClick={() => changeMatchLevel(level)} aria-pressed={matchLevel === level}>
                    {MATCH_LEVEL_LABELS[level]}
                  </Button>
                ))}
              </div>
            </div>
            <PreferenceButtons label="Obserwowane platformy" options={PLATFORM_OPTIONS} selected={preferenceDraft.platforms} onToggle={(value) => togglePreference("platforms", value)} />
            <PreferenceButtons label="Preferowane gatunki" options={GENRE_OPTIONS} selected={preferenceDraft.genres} onToggle={(value) => togglePreference("genres", value)} />
            <Button type="button" onClick={() => void savePreferences()} disabled={!preferencesChanged || preferencesSaving}>
              {preferencesSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Zapisz preferencje
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-4">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterField label="Od"><Input type="date" required value={filters.date_from} onChange={(event) => setFilters({ ...filters, date_from: event.target.value })} /></FilterField>
            <FilterField label="Do"><Input type="date" required value={filters.date_to} onChange={(event) => setFilters({ ...filters, date_to: event.target.value })} /></FilterField>
            <FilterField label="Platforma">
              <Select value={filters.platform} onChange={(event) => setFilters({ ...filters, platform: event.target.value })}>
                <option value="">Wszystkie</option>
                {PLATFORM_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Gatunek">
              <Select value={filters.genre} onChange={(event) => setFilters({ ...filters, genre: event.target.value })}>
                <option value="">Wszystkie</option>
                {GENRE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Minimalna ocena zewnętrzna">
              <Select value={filters.minimum_rating} onChange={(event) => setFilters({ ...filters, minimum_rating: event.target.value })}>
                <option value="">Bez minimum</option>
                <option value="60">60/100</option>
                <option value="70">70/100</option>
                <option value="80">80/100</option>
                <option value="90">90/100</option>
              </Select>
            </FilterField>
            <FilterField label="Status wydania">
              <Select value={filters.release_status} onChange={(event) => setFilters({ ...filters, release_status: event.target.value as GameReleaseFilters["release_status"] })}>
                <option value="all">Wszystkie</option>
                <option value="upcoming">Nadchodzące</option>
                <option value="released">Już wydane</option>
                <option value="tba">Termin niepewny</option>
              </Select>
            </FilterField>
            {view === "all" ? (
              <FilterField label="Sortowanie">
                <Select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value as GameReleaseFilters["sort"] })}>
                  <option value="release_date">Data premiery</option>
                  <option value="rating">Ocena RAWG</option>
                  <option value="title">Tytuł</option>
                </Select>
              </FilterField>
            ) : null}
            <FilterField label="Tytuł">
              <span className="flex gap-2">
                <Input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Szukaj tytułu" />
                <Button type="submit" disabled={loading} aria-label="Szukaj"><Search className="h-4 w-4" aria-hidden="true" /></Button>
              </span>
            </FilterField>
            <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-4">
              <Button type="submit" disabled={loading}><Filter className="h-4 w-4" aria-hidden="true" /> Zastosuj filtry</Button>
              <Button type="button" variant="ghost" onClick={clearFilters} disabled={loading}><X className="h-4 w-4" aria-hidden="true" /> Bieżący miesiąc</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {notice ? <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">{notice}</p> : null}
      {status ? <p className="rounded-md border border-accent/40 bg-accent/10 p-3 text-sm" role="status">{status}</p> : null}
      {error ? <p className="rounded-md bg-destructive/15 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
      {loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {view === "for_you" ? "Dopasowywanie premier…" : "Pobieranie premier…"}</p> : null}
      {!loading ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Wyniki na stronie: <strong className="text-foreground">{items.length}</strong> · Zakres {formatReleaseDate(appliedFilters.date_from)} – {formatReleaseDate(appliedFilters.date_to)}
        </p>
      ) : null}

      {!loading && !items.length && !error ? (
        <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">
          {view === "hidden" ? "Brak ukrytych premier spełniających filtry." : "Brak premier spełniających wybrane kryteria i poziom dopasowania."}
        </p>
      ) : null}

      {releaseGroups ? releaseGroups.map((group) => (
        <section key={group.date ?? "unknown"} className="space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <h2 className="text-lg font-semibold">{formatReleaseDate(group.date)}</h2>
            <Badge>{group.games.length}</Badge>
          </div>
          <div className="space-y-3">
            {group.games.map((game) => {
              const item = itemByKey.get(getDiscoveryGameKey(game));
              return item ? <ReleaseCard key={getDiscoveryGameKey(game)} item={item} view={view} busyKey={busyKey} onAdd={addToBacklog} onHide={hideRelease} onRestore={restoreRelease} /> : null;
            })}
          </div>
        </section>
      )) : (
        <div className="space-y-3">
          {items.map((item) => <ReleaseCard key={getDiscoveryGameKey(item.game)} item={item} view={view} busyKey={busyKey} onAdd={addToBacklog} onHide={hideRelease} onRestore={restoreRelease} />)}
        </div>
      )}

      {!loading && (page > 1 || hasNext) ? (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Strona {page}</span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void load(appliedFilters, page - 1)} disabled={loading || page <= 1}><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Poprzednia</Button>
            <Button type="button" variant="secondary" onClick={() => void load(appliedFilters, page + 1)} disabled={loading || !hasNext}>Następna <ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1 text-xs text-muted-foreground">{label}{children}</label>;
}

function PreferenceButtons({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button key={option} type="button" variant={selected.includes(option) ? "secondary" : "ghost"} onClick={() => onToggle(option)} aria-pressed={selected.includes(option)}>
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ReleaseCard({
  item,
  view,
  busyKey,
  onAdd,
  onHide,
  onRestore
}: {
  item: GameReleaseRecommendation;
  view: ReleaseViewMode;
  busyKey: string | null;
  onAdd: (item: GameReleaseRecommendation) => Promise<void>;
  onHide: (item: GameReleaseRecommendation) => Promise<void>;
  onRestore: (item: GameReleaseRecommendation) => Promise<void>;
}) {
  const key = getDiscoveryGameKey(item.game);
  const busy = busyKey === key;
  const platformDates = item.game.platform_release_dates?.filter((entry) => entry.release_date) ?? [];
  return (
    <Card className="overflow-hidden">
      <CardContent className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[100px_minmax(0,1fr)_auto] sm:p-4">
        <GameCover src={item.game.cover_url} title={item.game.title} className="h-auto w-full self-start" />
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-start gap-2">
            {item.game.external_id ? (
              <Link href={`/releases/${item.game.external_id}`} className="text-lg font-semibold hover:text-accent">{item.game.title}</Link>
            ) : <h3 className="text-lg font-semibold">{item.game.title}</h3>}
            {view === "for_you" ? <Badge>{item.match_label}</Badge> : null}
            {item.game.already_on_backlog ? <Badge>Już na liście</Badge> : null}
            {item.game.already_completed ? <Badge>Ukończona</Badge> : null}
            {item.game.hidden && view !== "hidden" ? <Badge>Ukryta</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{formatReleaseDate(item.game.release_date)} · {item.game.genres.join(", ") || "Brak danych o gatunku"}</p>
          <p className="text-xs text-muted-foreground">{item.game.platforms.join(", ") || "Brak danych o platformach"}</p>
          {view === "for_you" && item.reasons.length ? <p className="text-sm leading-5">{item.reasons.join(" ")}</p> : null}
          {platformDates.length ? <p className="text-xs leading-5 text-muted-foreground">Daty platformowe: {platformDates.slice(0, 4).map((entry) => `${entry.platform}: ${formatReleaseDate(entry.release_date)}`).join(" · ")}</p> : null}
          {item.game.release_date_tba ? <Badge>Termin orientacyjny</Badge> : null}
          <ExternalRatings ratings={item.game.external_ratings} updatedAt={item.game.external_ratings_updated_at} compact />
        </div>
        <div className="col-span-2 flex flex-wrap items-start gap-2 sm:col-span-1 sm:max-w-52">
          {view === "hidden" ? (
            <Button type="button" variant="secondary" onClick={() => void onRestore(item)} disabled={Boolean(busyKey)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />} Przywróć
            </Button>
          ) : (
            <>
              <Button type="button" onClick={() => void onAdd(item)} disabled={Boolean(busyKey) || item.game.already_on_backlog || item.game.already_completed}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ListPlus className="h-4 w-4" aria-hidden="true" />}
                {item.game.already_on_backlog ? "Już na liście" : item.game.already_completed ? "Ukończona" : "Dodaj do ogrania"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void onHide(item)} disabled={Boolean(busyKey) || item.game.hidden}>
                <EyeOff className="h-4 w-4" aria-hidden="true" /> {item.game.hidden ? "Ukryta" : "Nie interesuje mnie"}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
