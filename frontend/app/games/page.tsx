"use client";

import { useEffect, useState } from "react";
import { Filter, Plus, RefreshCw, Search } from "lucide-react";

import { BacklogList } from "@/components/games/BacklogList";
import { GameForm } from "@/components/games/GameForm";
import { GameSearch } from "@/components/games/GameSearch";
import { statusLabels } from "@/components/games/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/select";
import { api } from "@/services/api";
import type { BacklogGame } from "@/types";

export default function GamesPage() {
  const [entries, setEntries] = useState<BacklogGame[]>([]);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("position");
  const [search, setSearch] = useState("");
  const [openPanel, setOpenPanel] = useState<"search" | "manual" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextEntries?: BacklogGame[]) {
    if (nextEntries) {
      setEntries(nextEntries);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setEntries(await api.listBacklog({ status, sort, search }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd pobierania backlogu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status, sort]);

  function afterGameAdded() {
    setOpenPanel(null);
    void load();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary">Backlog</p>
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Gry</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Wyszukuj gry, dodawaj je ręcznie, ustawiaj kolejność i zapisuj postęp.
        </p>
      </header>

      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant={openPanel === "search" ? "primary" : "secondary"}
            className="min-h-12 justify-start"
            onClick={() => setOpenPanel(openPanel === "search" ? null : "search")}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Wyszukaj w bazie
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
        {openPanel === "search" ? <GameSearch onAdded={afterGameAdded} /> : null}
        {openPanel === "manual" ? <GameForm onAdded={afterGameAdded} /> : null}
      </section>

      <Card>
        <CardContent className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[1fr_180px_180px_auto]">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj po nazwie" onKeyDown={(event) => event.key === "Enter" && load()} />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status">
            <option value="">Wszystkie statusy</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sortowanie">
            <option value="position">Własna kolejność</option>
            <option value="added">Data dodania</option>
            <option value="rating">Ocena</option>
            <option value="playtime">Czas gry</option>
            <option value="completed">Data ukończenia</option>
          </Select>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => load()}>
              <Filter className="h-4 w-4" aria-hidden="true" />
              Filtruj
            </Button>
            <Button variant="secondary" onClick={() => load()} title="Odśwież">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? <LoadingState label="Ładowanie backlogu" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error ? (
        <BacklogList entries={entries} sortable={sort === "position" && !status && !search} onChanged={(next) => load(next)} />
      ) : null}
    </div>
  );
}
