"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ListPlus, Loader2, Search } from "lucide-react";

import { GameCover } from "@/components/games/GameCover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  filterSearchResultsForBacklog,
  getBatchFeedback,
  getBatchSelectionKeys,
  getSearchResultKey,
  toggleSearchSelection,
  type BacklogBatchItem,
  type NormalizedBacklogBatchResult
} from "@/lib/backlog-search";
import { api } from "@/services/api";
import type { BacklogEntry, GameSearchPage, GameSearchResult } from "@/types";

type BacklogApiContract = {
  searchGames: (query: string, page?: number, pageSize?: number, signal?: AbortSignal) => Promise<GameSearchResult[] | GameSearchPage>;
  createBacklogBatch: (payload: { games: GameSearchResult[] }) => Promise<unknown>;
};

const backlogApi = api as unknown as BacklogApiContract;

function normalizeSearchResponse(response: GameSearchResult[] | GameSearchPage, requestedPage: number): GameSearchPage {
  if (Array.isArray(response)) {
    return { results: response, page: requestedPage, page_size: response.length, has_next: false };
  }

  return {
    results: Array.isArray(response.results) ? response.results : [],
    page: Number.isInteger(response.page) ? response.page : requestedPage,
    page_size: Number.isInteger(response.page_size) ? response.page_size : response.results.length,
    has_next: Boolean(response.has_next)
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function asText(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function normalizeBatchItems(value: unknown): BacklogBatchItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const game = asRecord(record.game);
    const title = asText(record.title) ?? asText(game?.title);
    if (!title) return [];

    return [{
      title,
      external_id: asText(record.external_id) ?? asText(game?.external_id),
      external_source: asText(record.external_source) ?? asText(game?.external_source),
      source: asText(record.source) ?? asText(game?.source),
      message: asText(record.message) ?? asText(record.reason)
    }];
  });
}

function normalizeBatchResponse(response: unknown): NormalizedBacklogBatchResult {
  const record = asRecord(response);
  return {
    added: normalizeBatchItems(record?.added),
    already_exists: normalizeBatchItems(record?.already_exists),
    failed: normalizeBatchItems(record?.failed)
  };
}

export function GameSearch({
  existingEntries,
  onAdded
}: {
  existingEntries: BacklogEntry[];
  onAdded: () => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<Record<string, GameSearchResult>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; warning: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const activeSearch = useRef<AbortController | null>(null);

  useEffect(() => () => activeSearch.current?.abort(), []);

  useEffect(() => {
    setResults((current) => filterSearchResultsForBacklog(current, existingEntries));
  }, [existingEntries]);

  async function loadPage(queryValue: string, requestedPage: number) {
    const currentRequestId = ++requestId.current;
    activeSearch.current?.abort();
    const controller = new AbortController();
    activeSearch.current = controller;
    setLoading(true);
    setError(null);

    try {
      const payload = await backlogApi.searchGames(queryValue, requestedPage, 10, controller.signal);
      const response = normalizeSearchResponse(payload, requestedPage);
      const visibleResults = filterSearchResultsForBacklog(response.results, existingEntries);

      if (currentRequestId !== requestId.current) return;
      setResults(visibleResults);
      setPage(response.page);
      setHasNext(response.has_next);
      setHasSearched(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (currentRequestId === requestId.current) {
        setError(err instanceof Error ? err.message : "Nie udało się wyszukać gier w RAWG.");
      }
    } finally {
      if (currentRequestId === requestId.current) {
        setLoading(false);
      }
      if (activeSearch.current === controller) activeSearch.current = null;
    }
  }

  function startSearch() {
    const nextQuery = query.trim();
    if (!nextQuery) return;

    setSubmittedQuery(nextQuery);
    setSelected({});
    setFeedback(null);
    void loadPage(nextQuery, 1);
  }

  function changePage(nextPage: number) {
    if (!submittedQuery || nextPage < 1) return;
    setFeedback(null);
    void loadPage(submittedQuery, nextPage);
  }

  async function addSelected() {
    const selectedGames = Object.values(selected);
    if (!selectedGames.length || submitting) return;

    setSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const batch = normalizeBatchResponse(await backlogApi.createBacklogBatch({ games: selectedGames }));
      const processedKeys = getBatchSelectionKeys(
        [...batch.added, ...batch.already_exists],
        selected
      );
      const warning = Boolean(batch.failed.length || batch.already_exists.length);

      setFeedback({ message: getBatchFeedback(batch), warning });
      if (processedKeys.size) {
        setResults((current) => current.filter((game) => !processedKeys.has(getSearchResultKey(game))));
        setSelected((current) => Object.fromEntries(
          Object.entries(current).filter(([key]) => !processedKeys.has(key))
        ));
      }

      if (batch.added.length || batch.already_exists.length) {
        void Promise.resolve(onAdded()).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się dodać zaznaczonych gier do listy.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCount = Object.keys(selected).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wyszukaj gry</CardTitle>
        <CardDescription>
          Zaznacz kilka wyników RAWG, aby dodać je do listy „Do ogrania” jedną operacją.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Wpisz tytuł gry"
            aria-label="Tytuł wyszukiwanej gry"
            onKeyDown={(event) => event.key === "Enter" && startSearch()}
          />
          <Button type="button" onClick={startSearch} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
            Szukaj
          </Button>
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border bg-background/45 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Zaznaczono: <strong className="text-foreground">{selectedCount}</strong>
          </p>
          <Button type="button" onClick={addSelected} disabled={!selectedCount || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ListPlus className="h-4 w-4" aria-hidden="true" />}
            Dodaj zaznaczone ({selectedCount})
          </Button>
        </div>

        {feedback ? (
          <p
            className={feedback.warning ? "text-sm text-amber-200" : "text-sm text-emerald-300"}
            role="status"
          >
            {feedback.message}
          </p>
        ) : null}
        {error ? <p className="rounded-md bg-destructive/15 p-3 text-sm text-destructive" role="alert">{error}</p> : null}

        {loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Wyszukiwanie RAWG…</p> : null}

        {!loading && hasSearched && !results.length ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Brak nowych gier możliwych do dodania dla tego zapytania.
          </p>
        ) : null}

        {results.length ? (
          <div className="space-y-2" aria-label="Wyniki wyszukiwania RAWG">
            {results.map((result, index) => {
              const key = getSearchResultKey(result);
              const inputId = `rawg-result-${page}-${index}`;
              const isSelected = Boolean(selected[key]);

              return (
                <div
                  key={key}
                  className={
                    isSelected
                      ? "flex items-center gap-3 rounded-md border border-accent bg-accent/10 p-2"
                      : "flex items-center gap-3 rounded-md border border-border bg-background/55 p-2"
                  }
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => setSelected((current) => toggleSearchSelection(current, result))}
                    className="h-5 w-5 shrink-0 accent-primary"
                    aria-label={`Zaznacz grę ${result.title}`}
                  />
                  <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <GameCover src={result.cover_url} title={result.title} variant="thumbnail" className="h-16 w-12 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{result.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{result.genres.join(", ") || result.source}</span>
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        ) : null}

        {hasSearched ? (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Strona {page}</span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => changePage(page - 1)} disabled={loading || page <= 1}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Poprzednia
              </Button>
              <Button type="button" variant="secondary" onClick={() => changePage(page + 1)} disabled={loading || !hasNext}>
                Następna <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
