"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  EyeOff,
  ListPlus,
  Loader2,
  Sparkles,
  ThumbsDown,
  ThumbsUp
} from "lucide-react";

import { ExternalRatings } from "@/components/games/ExternalRatings";
import { GameCover } from "@/components/games/GameCover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DISMISSED_RECOMMENDATIONS_KEY,
  getDiscoveryGameKey,
  parseDismissedRecommendationKeys
} from "@/lib/discovery";
import { api } from "@/services/api";
import type {
  GameRecommendation,
  GameRecommendations,
  GameRecommendationVerdict,
  GameSearchResult
} from "@/types";

export function GameRecommendations({ onBacklogChanged }: { onBacklogChanged: () => void | Promise<void> }) {
  const [allRecommendations, setAllRecommendations] = useState<GameRecommendation[]>([]);
  const [recommendations, setRecommendations] = useState<GameRecommendation[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [lastFeedbackGame, setLastFeedbackGame] = useState<GameSearchResult | null>(null);

  const applyResponse = useCallback((response: GameRecommendations) => {
    const dismissed = parseDismissedRecommendationKeys(
      window.localStorage.getItem(DISMISSED_RECOMMENDATIONS_KEY)
    );
    const visible = response.results.filter((item) => !dismissed.has(getDiscoveryGameKey(item.game)));
    setAllRecommendations(response.results);
    setRecommendations(visible);
    setHiddenCount(response.results.length - visible.length);
    setNotice(response.notice ?? null);
  }, []);

  const loadRecommendations = useCallback(async (signal?: AbortSignal, showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const response = await api.getGameRecommendations(signal);
      applyResponse(response);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "Nie udało się pobrać rekomendacji.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    const controller = new AbortController();
    void loadRecommendations(controller.signal);
    return () => controller.abort();
  }, [loadRecommendations]);

  function dismiss(item: GameRecommendation) {
    const key = getDiscoveryGameKey(item.game);
    const dismissed = parseDismissedRecommendationKeys(
      window.localStorage.getItem(DISMISSED_RECOMMENDATIONS_KEY)
    );
    dismissed.add(key);
    window.localStorage.setItem(DISMISSED_RECOMMENDATIONS_KEY, JSON.stringify([...dismissed]));
    setRecommendations((current) => current.filter((candidate) => getDiscoveryGameKey(candidate.game) !== key));
    setHiddenCount((current) => current + 1);
  }

  function restoreDismissed() {
    window.localStorage.removeItem(DISMISSED_RECOMMENDATIONS_KEY);
    setRecommendations(allRecommendations);
    setHiddenCount(0);
  }

  async function addToBacklog(item: GameRecommendation) {
    const key = getDiscoveryGameKey(item.game);
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    try {
      await api.createBacklogBatch({ games: [item.game] });
      setRecommendations((current) => current.filter((candidate) => getDiscoveryGameKey(candidate.game) !== key));
      setAllRecommendations((current) => current.filter((candidate) => getDiscoveryGameKey(candidate.game) !== key));
      await Promise.resolve(onBacklogChanged());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nie udało się dodać gry do listy.");
    } finally {
      setBusyKey(null);
    }
  }

  async function sendFeedback(item: GameRecommendation, verdict: GameRecommendationVerdict) {
    const key = getDiscoveryGameKey(item.game);
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    setFeedbackStatus(null);
    try {
      await api.saveGameRecommendationFeedback(item.game, verdict);
      setRecommendations((current) => current.filter((candidate) => getDiscoveryGameKey(candidate.game) !== key));
      setAllRecommendations((current) => current.filter((candidate) => getDiscoveryGameKey(candidate.game) !== key));
      setFeedbackStatus(
        verdict === "positive"
          ? `Zapamiętano, że „${item.game.title}” pasuje do Ciebie. Lista została przeliczona.`
          : `Zapamiętano, że „${item.game.title}” nie pasuje do Ciebie. Lista została przeliczona.`
      );
      setLastFeedbackGame(item.game);
      await loadRecommendations(undefined, false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nie udało się zapisać opinii.");
    } finally {
      setBusyKey(null);
    }
  }

  async function undoFeedback() {
    if (!lastFeedbackGame || busyKey) return;
    const key = getDiscoveryGameKey(lastFeedbackGame);
    setBusyKey(key);
    setError(null);
    try {
      await api.deleteGameRecommendationFeedback(lastFeedbackGame);
      setLastFeedbackGame(null);
      setFeedbackStatus("Opinia została cofnięta. Lista została ponownie przeliczona.");
      await loadRecommendations(undefined, false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nie udało się cofnąć opinii.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-md bg-accent/15 p-2 text-accent">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Polecane dla Ciebie</CardTitle>
            <CardDescription>
              Ranking na podstawie Twoich ocen, gatunków, platform i zapisanych opinii o propozycjach.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice ? <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">{notice}</p> : null}
        {feedbackStatus ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent/40 bg-accent/10 p-3 text-sm">
            <p role="status">{feedbackStatus}</p>
            {lastFeedbackGame ? (
              <Button type="button" variant="ghost" onClick={() => void undoFeedback()} disabled={Boolean(busyKey)}>
                Cofnij opinię
              </Button>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="rounded-md bg-destructive/15 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Analizowanie biblioteki i danych RAWG…
          </p>
        ) : null}
        {!loading && !recommendations.length && !error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            <p>Brak nowych propozycji. Ocenione propozycje nie pojawią się ponownie.</p>
            {hiddenCount ? <Button type="button" variant="ghost" onClick={restoreDismissed}>Pokaż ukryte ({hiddenCount})</Button> : null}
          </div>
        ) : null}
        {recommendations.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {recommendations.map((item) => {
              const key = getDiscoveryGameKey(item.game);
              const busy = busyKey === key;
              return (
                <article key={key} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-md border border-border bg-background/45 p-3">
                  <GameCover src={item.game.cover_url} title={item.game.title} className="h-auto w-full self-start" />
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold leading-5">{item.game.title}</h3>
                      <Badge>{item.kind === "personalized" ? "Dopasowana" : "Popularna w RAWG"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.game.genres.join(", ") || item.game.platforms.join(", ")}</p>
                    <p className="text-sm leading-5">{item.reason}</p>
                    <ExternalRatings ratings={item.game.external_ratings} updatedAt={item.game.external_ratings_updated_at} compact />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button type="button" onClick={() => void addToBacklog(item)} disabled={Boolean(busyKey)}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ListPlus className="h-4 w-4" aria-hidden="true" />}
                        Dodaj do ogrania
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => void sendFeedback(item, "positive")} disabled={Boolean(busyKey)}>
                        <ThumbsUp className="h-4 w-4" aria-hidden="true" /> Pasuje do mnie
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => void sendFeedback(item, "negative")} disabled={Boolean(busyKey)}>
                        <ThumbsDown className="h-4 w-4" aria-hidden="true" /> Nie dla mnie
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => dismiss(item)} disabled={Boolean(busyKey)}>
                        <EyeOff className="h-4 w-4" aria-hidden="true" /> Ukryj
                      </Button>
                      {item.game.external_url ? (
                        <a className="inline-flex min-h-11 items-center gap-2 px-2 text-sm text-muted-foreground hover:text-foreground" href={item.game.external_url} target="_blank" rel="noreferrer">
                          RAWG <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
        {!loading && recommendations.length && hiddenCount ? (
          <Button type="button" variant="ghost" onClick={restoreDismissed}>Pokaż ukryte ({hiddenCount})</Button>
        ) : null}
        <p className="text-xs text-muted-foreground">
          „Pasuje do mnie” i „Nie dla mnie” wpływają na kolejne propozycje. „Ukryj” działa neutralnie tylko w tej przeglądarce. Źródło kandydatów i popularności: RAWG.
        </p>
      </CardContent>
    </Card>
  );
}
