"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { CalendarPlus, Plus, RefreshCw, UserPlus } from "lucide-react";

import { LeagueSelector } from "@/components/poe/LeagueSelector";
import { PoeLeagueManager } from "@/components/poe/PoeLeagueManager";
import { PoeCharacterCard } from "@/components/poe/PoeCharacterCard";
import { PoeCharacterForm } from "@/components/poe/PoeCharacterForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/select";
import { isAbortError } from "@/lib/poe";
import { api } from "@/services/api";
import type { PoeCharacter, PoeLeague } from "@/types";

export default function PoePage() {
  const [characters, setCharacters] = useState<PoeCharacter[]>([]);
  const [leagues, setLeagues] = useState<PoeLeague[]>([]);
  const [gameVersion, setGameVersion] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [sort, setSort] = useState("added");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [openPanel, setOpenPanel] = useState<"league" | "character" | null>(null);
  const [leagueMessage, setLeagueMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCharacters = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const characterData = await api.listCharacters(
        { game_version: gameVersion, league_id: leagueId, sort, search: appliedSearch },
        signal
      );
      setCharacters(characterData);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : "Nie udało się pobrać danych PoE");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [appliedSearch, gameVersion, leagueId, sort]);

  const refreshLeagues = useCallback(async (signal?: AbortSignal) => {
    const leagueData = await api.listLeagues(signal);
    setLeagues(leagueData);
    return leagueData;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refreshLeagues(controller.signal).catch((err) => {
      if (!isAbortError(err)) {
        setLeagueMessage(err instanceof Error ? err.message : "Nie udało się pobrać lig PoE");
      }
    });
    return () => controller.abort();
  }, [refreshLeagues]);

  useEffect(() => {
    const controller = new AbortController();
    void loadCharacters(controller.signal);
    return () => controller.abort();
  }, [loadCharacters]);

  function afterCharacterAdded() {
    setOpenPanel(null);
    void loadCharacters();
  }

  function afterLeagueAdded() {
    void refreshLeagues().catch((err) => {
      setLeagueMessage(err instanceof Error ? err.message : "Nie udało się odświeżyć listy lig");
    });
  }

  async function afterLeagueChanged() {
    const refreshed = await refreshLeagues();
    if (leagueId && !refreshed.some((league) => String(league.id) === leagueId)) {
      setLeagueId("");
    } else {
      await loadCharacters();
    }
    return refreshed;
  }

  function applySearch() {
    if (search === appliedSearch) {
      void loadCharacters();
      return;
    }
    setAppliedSearch(search);
  }

  const visibleLeagues = useMemo(
    () => leagues.filter((league) => !gameVersion || league.game_version === gameVersion),
    [gameVersion, leagues]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary">Path of Exile</p>
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Postacie, ligi i dropy</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Zarządzaj postaciami z PoE 1 i PoE 2 oraz statystykami w stylu prywatnego licznika dropów.
        </p>
      </header>

      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant={openPanel === "league" ? "primary" : "secondary"}
            className="min-h-12 justify-start"
            onClick={() => setOpenPanel(openPanel === "league" ? null : "league")}
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Dodaj ligę
          </Button>
          <Button
            type="button"
            variant={openPanel === "character" ? "primary" : "secondary"}
            className="min-h-12 justify-start"
            onClick={() => setOpenPanel(openPanel === "character" ? null : "character")}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Dodaj postać
          </Button>
        </div>
        {leagueMessage ? <p className="text-sm text-muted-foreground">{leagueMessage}</p> : null}
        {openPanel === "league" ? (
          <div className="space-y-3">
            <LeagueForm onAdded={afterLeagueAdded} />
            <PoeLeagueManager leagues={leagues} onChanged={afterLeagueChanged} />
          </div>
        ) : null}
        {openPanel === "character" ? (
          <PoeCharacterForm leagues={leagues} onAdded={afterCharacterAdded} />
        ) : null}
      </section>

      <Card>
        <CardContent className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[1fr_150px_180px_150px_auto]">
          <Input aria-label="Szukaj postaci" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj postaci" onKeyDown={(event) => event.key === "Enter" && applySearch()} />
          <Select
            aria-label="Wersja Path of Exile"
            value={gameVersion}
            onChange={(event) => {
              setGameVersion(event.target.value);
              setLeagueId("");
            }}
          >
            <option value="">PoE 1 i PoE 2</option>
            <option value="poe1">PoE 1</option>
            <option value="poe2">PoE 2</option>
          </Select>
          <LeagueSelector leagues={visibleLeagues} value={leagueId} onChange={setLeagueId} includeAll ariaLabel="Liga" />
          <Select aria-label="Sortowanie postaci" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="added">Data dodania</option>
            <option value="level">Level</option>
            <option value="playtime">Czas gry</option>
          </Select>
          <Button type="button" onClick={applySearch}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Odśwież
          </Button>
        </CardContent>
      </Card>

      {loading && !characters.length ? <LoadingState label="Ładowanie postaci PoE" /> : null}
      {loading && characters.length ? <p role="status" className="text-sm text-muted-foreground">Odświeżanie listy postaci…</p> : null}
      {error ? <ErrorState message={error} /> : null}
      {(!loading || characters.length > 0) && !error ? (
        characters.length ? (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {characters.map((character) => (
              <PoeCharacterCard key={character.id} character={character} />
            ))}
          </section>
        ) : (
          <EmptyState title="Brak postaci" description="Dodaj pierwszą postać albo zmień filtry." />
        )
      ) : null}
    </div>
  );
}

function LeagueForm({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState<{
    name: string;
    game_version: "poe1" | "poe2";
    start_date: string;
  }>({ name: "", game_version: "poe1", start_date: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.start_date) {
      setMessage("Podaj nazwę i datę startu ligi.");
      return;
    }
    setMessage(null);
    setSaving(true);
    try {
      await api.createLeague({ name: form.name.trim(), game_version: form.game_version, start_date: form.start_date });
      setForm({ name: "", game_version: form.game_version, start_date: "" });
      setMessage("Liga dodana.");
      onAdded();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nie udało się dodać ligi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dodaj ligę</CardTitle>
        <CardDescription>Data startu ustala kolejność lig i rok, do którego analizy doliczą czas postaci. Ta sama nazwa może wystąpić osobno w PoE 1 i PoE 2.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_200px]">
            <Field label="Nazwa ligi" htmlFor="poe-league-name">
              <Input id="poe-league-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nazwa ligi" />
            </Field>
            <Field label="Gra" htmlFor="poe-league-version">
              <Select id="poe-league-version" value={form.game_version} onChange={(event) => setForm({ ...form, game_version: event.target.value as "poe1" | "poe2" })}>
                <option value="poe1">Path of Exile 1</option>
                <option value="poe2">Path of Exile 2</option>
              </Select>
            </Field>
            <Field label="Data startu" htmlFor="poe-league-start-date">
              <Input id="poe-league-start-date" type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} required />
            </Field>
          </div>
          {message ? <p className="text-sm text-muted-foreground" role={message === "Liga dodana." ? "status" : "alert"}>{message}</p> : null}
          <Button type="submit" className="w-full sm:w-auto" disabled={saving || !form.name.trim() || !form.start_date}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {saving ? "Dodawanie…" : "Dodaj ligę"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
