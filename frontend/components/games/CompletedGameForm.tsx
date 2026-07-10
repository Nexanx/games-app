"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Save } from "lucide-react";

import { CustomStatisticsFields } from "@/components/games/CustomStatisticsFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayAsInputValue } from "@/lib/completed-games";
import { splitList } from "@/lib/utils";
import { api } from "@/services/api";
import type { BacklogEntry, CompletedGameEntry, CustomStatistic, GameSearchResult } from "@/types";

type GameDraft = {
  title: string;
  description: string;
  cover_url: string;
  release_date: string;
  genres: string;
  platforms: string;
  external_id?: string | null;
  external_source: string;
  external_url?: string | null;
};

const emptyGameDraft: GameDraft = {
  title: "",
  description: "",
  cover_url: "",
  release_date: "",
  genres: "",
  platforms: "",
  external_source: "manual"
};

export function CompletedGameForm({ entry }: { entry?: CompletedGameEntry }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBacklogId = searchParams.get("backlog") || "";
  const [backlogEntries, setBacklogEntries] = useState<BacklogEntry[]>([]);
  const [sourceMode, setSourceMode] = useState<"backlog" | "other">(initialBacklogId ? "backlog" : "other");
  const [backlogId, setBacklogId] = useState(initialBacklogId);
  const [gameDraft, setGameDraft] = useState<GameDraft>(emptyGameDraft);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [completionDate, setCompletionDate] = useState(entry?.completion_date || todayAsInputValue());
  const [playtimeHours, setPlaytimeHours] = useState(entry ? String(entry.playtime_hours) : "");
  const [rating, setRating] = useState(entry?.rating == null ? "" : String(entry.rating));
  const [platform, setPlatform] = useState(entry?.platform || "");
  const [review, setReview] = useState(entry?.review || "");
  const [statistics, setStatistics] = useState<CustomStatistic[]>(entry?.custom_statistics || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBacklog = useMemo(
    () => backlogEntries.find((backlogEntry) => String(backlogEntry.id) === backlogId),
    [backlogEntries, backlogId]
  );

  useEffect(() => {
    if (entry) return;
    api.listBacklog().then((items) => {
      setBacklogEntries(items);
      if (!initialBacklogId && items.length) {
        setBacklogId(String(items[0].id));
      }
    }).catch((err) => setError(err instanceof Error ? err.message : "Nie udało się pobrać listy Do ogrania"));
  }, [entry, initialBacklogId]);

  useEffect(() => {
    if (!selectedBacklog) return;
    setPlatform(selectedBacklog.preferred_platform || selectedBacklog.game.platforms[0] || "");
  }, [selectedBacklog]);

  async function searchGames() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await api.searchGames(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wyszukać gry");
    } finally {
      setSearching(false);
    }
  }

  function chooseResult(result: GameSearchResult) {
    setGameDraft({
      title: result.title,
      description: result.description || "",
      cover_url: result.cover_url || "",
      release_date: result.release_date || "",
      genres: result.genres.join(", "),
      platforms: result.platforms.join(", "),
      external_id: result.external_id,
      external_source: result.external_source || result.source,
      external_url: result.external_url
    });
    setPlatform(result.platforms[0] || "");
    setResults([]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const hours = Number(playtimeHours.replace(",", "."));
    const parsedRating = rating === "" ? null : Number(rating.replace(",", "."));
    if (!completionDate) return setError("Wybierz datę ukończenia.");
    if (!Number.isFinite(hours) || hours < 0) return setError("Czas gry musi być liczbą równą lub większą od zera.");
    if (parsedRating !== null && (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 10)) {
      return setError("Ocena musi mieścić się w zakresie od 0 do 10.");
    }
    if (statistics.some((statistic) => !statistic.name.trim() || statistic.value === "")) {
      return setError("Każda własna statystyka musi mieć nazwę i wartość.");
    }
    if (statistics.some((statistic) => statistic.value_type === "number" && !Number.isFinite(Number(statistic.value)))) {
      return setError("Wartość statystyki liczbowej musi być liczbą.");
    }

    setSaving(true);
    try {
      const custom_statistics = statistics.map(({ name, value, value_type }) => ({ name: name.trim(), value, value_type }));
      let saved: CompletedGameEntry;
      if (entry) {
        saved = await api.patchCompletedGame(entry.id, {
          completion_date: completionDate,
          playtime_hours: hours,
          rating: parsedRating,
          platform: platform || null,
          review: review || null,
          custom_statistics
        });
      } else {
        let gameId: number;
        let selectedBacklogId: number | null = null;
        if (sourceMode === "backlog") {
          if (!selectedBacklog) throw new Error("Wybierz grę z listy Do ogrania.");
          gameId = selectedBacklog.game_id;
          selectedBacklogId = selectedBacklog.id;
        } else {
          if (!gameDraft.title.trim()) throw new Error("Wyszukaj grę albo wpisz jej tytuł.");
          const game = await api.createGame({
            title: gameDraft.title.trim(),
            description: gameDraft.description || null,
            cover_url: gameDraft.cover_url || null,
            release_date: gameDraft.release_date || null,
            genres: splitList(gameDraft.genres),
            platforms: splitList(gameDraft.platforms),
            external_id: gameDraft.external_id || null,
            external_source: gameDraft.external_source,
            external_url: gameDraft.external_url || null
          });
          gameId = game.id;
        }
        saved = await api.createCompletedGame({
          game_id: gameId,
          backlog_entry_id: selectedBacklogId,
          completion_date: completionDate,
          playtime_hours: hours,
          rating: parsedRating,
          platform: platform || null,
          review: review || null,
          custom_statistics
        });
      }
      router.push(`/completed-games/${saved.completion_date.slice(0, 4)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać ukończonej gry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      {!entry ? (
        <Card>
          <CardHeader>
            <CardTitle>Wybierz grę</CardTitle>
            <CardDescription>Możesz użyć pozycji z listy Do ogrania albo wyszukać inną grę.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={sourceMode} onChange={(event) => setSourceMode(event.target.value as "backlog" | "other")} aria-label="Źródło gry">
              <option value="backlog">Z listy Do ogrania</option>
              <option value="other">Inna gra</option>
            </Select>
            {sourceMode === "backlog" ? (
              <div className="space-y-2">
                <Label htmlFor="backlog-game">Gra z listy</Label>
                <Select id="backlog-game" value={backlogId} onChange={(event) => setBacklogId(event.target.value)}>
                  {!backlogEntries.length ? <option value="">Lista jest pusta</option> : null}
                  {backlogEntries.map((backlogEntry) => <option key={backlogEntry.id} value={backlogEntry.id}>{backlogEntry.game.title}</option>)}
                </Select>
                {selectedBacklog ? (
                  <p className="text-sm text-amber-200">Po zapisaniu gra zostanie usunięta z listy „Do ogrania”.</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wyszukaj grę w RAWG" />
                  <Button type="button" onClick={searchGames} disabled={searching}><Search className="h-4 w-4" aria-hidden="true" />Szukaj</Button>
                </div>
                {results.length ? (
                  <div className="max-h-72 space-y-2 overflow-auto rounded-lg border border-border p-2">
                    {results.map((result) => (
                      <button
                        type="button"
                        key={`${result.external_source}-${result.external_id}-${result.title}`}
                        className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted"
                        onClick={() => chooseResult(result)}
                      >
                        <span className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">{result.cover_url ? <img src={result.cover_url} alt="" className="h-full w-full object-cover" /> : null}</span>
                        <span className="min-w-0"><strong className="block truncate">{result.title}</strong><span className="block truncate text-xs text-muted-foreground">{result.genres.join(", ")}</span></span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tytuł" htmlFor="game-title"><Input id="game-title" value={gameDraft.title} onChange={(event) => setGameDraft({ ...gameDraft, title: event.target.value })} /></Field>
                  <Field label="URL okładki" htmlFor="game-cover"><Input id="game-cover" value={gameDraft.cover_url} onChange={(event) => setGameDraft({ ...gameDraft, cover_url: event.target.value })} /></Field>
                  <Field label="Platformy" htmlFor="game-platforms"><Input id="game-platforms" value={gameDraft.platforms} onChange={(event) => setGameDraft({ ...gameDraft, platforms: event.target.value })} placeholder="PC, PS5" /></Field>
                  <Field label="Gatunki" htmlFor="game-genres"><Input id="game-genres" value={gameDraft.genres} onChange={(event) => setGameDraft({ ...gameDraft, genres: event.target.value })} placeholder="RPG, Action" /></Field>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="flex items-center gap-4 p-4"><strong className="text-lg">{entry.game.title}</strong></CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dane ukończenia</CardTitle>
          <CardDescription>Sam wpis oznacza, że gra została ukończona.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Data ukończenia" htmlFor="completion-date"><Input id="completion-date" type="date" required value={completionDate} onChange={(event) => setCompletionDate(event.target.value)} /></Field>
            <Field label="Czas gry w godzinach" htmlFor="playtime-hours"><Input id="playtime-hours" type="number" min={0} step="any" required value={playtimeHours} onChange={(event) => setPlaytimeHours(event.target.value)} placeholder="25.5" /></Field>
            <Field label="Ocena (0–10)" htmlFor="rating"><Input id="rating" type="number" min={0} max={10} step={0.5} value={rating} onChange={(event) => setRating(event.target.value)} /></Field>
            <Field label="Platforma" htmlFor="platform"><Input id="platform" value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder="PC" /></Field>
          </div>
          <Field label="Notatka lub recenzja" htmlFor="review"><Textarea id="review" value={review} onChange={(event) => setReview(event.target.value)} /></Field>
          <CustomStatisticsFields statistics={statistics} onChange={setStatistics} />
          {error ? <p className="rounded-md bg-destructive/15 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
          <Button type="submit" disabled={saving}><Save className="h-4 w-4" aria-hidden="true" />{saving ? "Zapisywanie…" : "Zapisz ukończoną grę"}</Button>
        </CardContent>
      </Card>
    </form>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}
