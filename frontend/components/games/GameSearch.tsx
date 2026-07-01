"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/services/api";
import type { GameSearchResult } from "@/types";

export function GameSearch({ onAdded }: { onAdded: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function search() {
    if (!query.trim()) {
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      setResults(await api.searchGames(query));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Błąd wyszukiwania");
    } finally {
      setLoading(false);
    }
  }

  async function addResult(result: GameSearchResult) {
    setMessage(null);
    try {
      const game = await api.createGame({
        title: result.title,
        description: result.description,
        cover_url: result.cover_url,
        release_date: result.release_date,
        genres: result.genres,
        platforms: result.platforms,
        external_id: result.external_id,
        external_source: result.external_source || result.source,
        external_url: result.external_url
      });
      await api.createBacklog({ game_id: game.id, status: "to_play", position: 0 });
      setMessage(`Dodano: ${game.title}`);
      onAdded();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nie udało się dodać gry");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wyszukaj grę</CardTitle>
        <CardDescription>RAWG z kluczem API, mock data bez klucza.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="np. Hades, Elden Ring" onKeyDown={(event) => event.key === "Enter" && search()} />
          <Button onClick={search} disabled={loading}>
            <Search className="h-4 w-4" aria-hidden="true" />
            Szukaj
          </Button>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <div className="space-y-2">
          {results.map((result) => (
            <div key={`${result.external_source}-${result.external_id}-${result.title}`} className="flex items-center gap-3 rounded-md border border-border bg-background/55 p-2">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {result.cover_url ? <img src={result.cover_url} alt={result.title} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{result.title}</p>
                <p className="truncate text-xs text-muted-foreground">{result.genres.join(", ") || result.source}</p>
              </div>
              <Button onClick={() => addResult(result)} title="Dodaj do backlogu">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

