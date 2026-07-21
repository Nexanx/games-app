"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, ListPlus, Loader2 } from "lucide-react";

import { ExternalRatings } from "@/components/games/ExternalRatings";
import { GameCover } from "@/components/games/GameCover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatReleaseDate } from "@/lib/discovery";
import { api } from "@/services/api";
import type { GameSearchResult } from "@/types";

export default function ReleaseDetailsPage() {
  const params = useParams<{ id: string }>();
  const [game, setGame] = useState<GameSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        setGame(await api.getRawgGame(params.id, controller.signal));
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Nie udało się pobrać szczegółów gry.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [params.id]);

  async function addToBacklog() {
    if (!game || adding) return;
    setAdding(true);
    setError(null);
    try {
      await api.createBacklogBatch({ games: [game] });
      setAdded(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nie udało się dodać gry do listy.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/releases" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Wróć do premier
      </Link>
      {loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Pobieranie szczegółów z RAWG…</p> : null}
      {error ? <p className="rounded-md bg-destructive/15 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
      {game ? (
        <Card className="overflow-hidden">
          <CardContent className="grid gap-5 p-4 md:grid-cols-[220px_minmax(0,1fr)] md:p-6">
            <GameCover src={game.cover_url} title={game.title} className="h-auto w-full self-start" />
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-primary">Szczegóły premiery</p>
                <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{game.title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">Premiera: {formatReleaseDate(game.release_date)}{game.release_date_tba ? " (termin orientacyjny)" : ""}</p>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <Metric label="Gatunki" value={game.genres.join(", ") || "Brak danych"} />
                <Metric label="Platformy" value={game.platforms.join(", ") || "Brak danych"} />
              </div>
              {game.platform_release_dates?.length ? (
                <div className="rounded-md bg-background/55 p-4">
                  <h2 className="font-semibold">Daty dla platform</h2>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {game.platform_release_dates.map((item) => (
                      <li key={`${item.platform}:${item.release_date ?? "unknown"}`}>{item.platform}: {formatReleaseDate(item.release_date)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {game.description ? <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{game.description}</p> : <p className="text-sm text-muted-foreground">Brak opisu w danych RAWG.</p>}
              <ExternalRatings ratings={game.external_ratings} updatedAt={game.external_ratings_updated_at} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void addToBacklog()} disabled={adding || added}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ListPlus className="h-4 w-4" aria-hidden="true" />}
                  {added ? "Dodano do ogrania" : "Dodaj do ogrania"}
                </Button>
                {game.external_url ? (
                  <a href={game.external_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 px-3 text-sm text-muted-foreground hover:text-foreground">
                    Otwórz w RAWG <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">Źródło: RAWG. Termin premiery może ulec zmianie.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/55 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
