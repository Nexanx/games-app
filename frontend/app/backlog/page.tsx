"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Filter, Plus, Search } from "lucide-react";

import { BacklogList } from "@/components/games/BacklogList";
import { GameForm } from "@/components/games/GameForm";
import { GameRecommendations } from "@/components/games/GameRecommendations";
import { GameSearch } from "@/components/games/GameSearch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/select";
import { api } from "@/services/api";
import type { BacklogEntry } from "@/types";

export default function BacklogPage() {
  const [entries, setEntries] = useState<BacklogEntry[]>([]);
  const [sort, setSort] = useState("position");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [openPanel, setOpenPanel] = useState<"search" | "manual" | null>(null);
  const [searchBacklogEntries, setSearchBacklogEntries] = useState<BacklogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextEntries?: BacklogEntry[]) {
    if (nextEntries) {
      setEntries(nextEntries);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setEntries(await api.listBacklog({ sort, direction, search }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd pobierania listy Do ogrania");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Search is applied explicitly with Enter or the filter button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, direction]);

  async function refreshSearchBacklog() {
    try {
      setSearchBacklogEntries(await api.listBacklog());
    } catch {
      // The server remains the final duplicate guard. Keep the currently
      // displayed entries as a local fallback if this secondary request fails.
      setSearchBacklogEntries(entries);
    }
  }

  function toggleSearchPanel() {
    if (openPanel === "search") {
      setOpenPanel(null);
      return;
    }

    setOpenPanel("search");
    setSearchBacklogEntries(entries);
    void refreshSearchBacklog();
  }

  function afterManualGameAdded() {
    setOpenPanel(null);
    void load();
    void refreshSearchBacklog();
  }

  function afterSearchGamesAdded() {
    void load();
    void refreshSearchBacklog();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-primary">Plan na przyszłość</p>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Do ogrania</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Wyszukuj gry, zapisuj krótkie notatki i ustawiaj kolejność. Ta lista jest niezależna od historii ukończeń.
          </p>
        </div>
        <Link href="/releases" className="shrink-0">
          <Button variant="secondary" className="w-full sm:w-auto">
            <CalendarDays className="h-4 w-4" aria-hidden="true" /> Premiery gier
          </Button>
        </Link>
      </header>

      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant={openPanel === "search" ? "primary" : "secondary"}
            className="min-h-12 justify-start"
            onClick={toggleSearchPanel}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Wyszukaj w RAWG
          </Button>
          <Button
            variant={openPanel === "manual" ? "primary" : "secondary"}
            className="min-h-12 justify-start"
            onClick={() => setOpenPanel(openPanel === "manual" ? null : "manual")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Dodaj ręcznie
          </Button>
        </div>
        {openPanel === "search" ? <GameSearch existingEntries={searchBacklogEntries} onAdded={afterSearchGamesAdded} /> : null}
        {openPanel === "manual" ? <GameForm onAdded={afterManualGameAdded} /> : null}
      </section>

      <Card>
        <CardContent className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-[1fr_200px_160px_auto]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Szukaj po nazwie"
            onKeyDown={(event) => event.key === "Enter" && void load()}
          />
          <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sortowanie">
            <option value="position">Własna kolejność</option>
            <option value="added">Data dodania</option>
            <option value="title">Tytuł</option>
          </Select>
          <Select value={direction} onChange={(event) => setDirection(event.target.value as "asc" | "desc")} aria-label="Kierunek sortowania" disabled={sort === "position"}>
            <option value="asc">Rosnąco</option>
            <option value="desc">Malejąco</option>
          </Select>
          <Button onClick={() => void load()}>
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filtruj
          </Button>
        </CardContent>
      </Card>

      {loading ? <LoadingState label="Ładowanie listy Do ogrania" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error ? (
        <BacklogList
          entries={entries}
          sortable={sort === "position" && !search}
          onChanged={(next) => {
            void load(next);
            void refreshSearchBacklog();
          }}
        />
      ) : null}

      <GameRecommendations onBacklogChanged={afterSearchGamesAdded} />
    </div>
  );
}
