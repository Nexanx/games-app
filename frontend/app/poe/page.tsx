"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CalendarPlus, CloudDownload, Plus, RefreshCw, UserPlus } from "lucide-react";

import { LeagueSelector } from "@/components/poe/LeagueSelector";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/services/api";
import type { PoeCharacter, PoeLeague } from "@/types";

export default function PoePage() {
  const [characters, setCharacters] = useState<PoeCharacter[]>([]);
  const [leagues, setLeagues] = useState<PoeLeague[]>([]);
  const [gameVersion, setGameVersion] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("added");
  const [search, setSearch] = useState("");
  const [openPanel, setOpenPanel] = useState<"league" | "character" | null>(null);
  const [syncingLeagues, setSyncingLeagues] = useState(false);
  const [leagueMessage, setLeagueMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [leagueData, characterData] = await Promise.all([
        api.listLeagues(),
        api.listCharacters({ game_version: gameVersion, league_id: leagueId, status, sort, search })
      ]);
      setLeagues(leagueData);
      setCharacters(characterData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się pobrać danych PoE");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [gameVersion, leagueId, status, sort]);

  async function refreshLeagues() {
    const leagueData = await api.listLeagues();
    setLeagues(leagueData);
    return leagueData;
  }

  function afterPoeAdded() {
    setOpenPanel(null);
    void load();
  }

  async function syncPoeLeagues() {
    setSyncingLeagues(true);
    setLeagueMessage(null);
    try {
      const result = await api.syncLeagues();
      setLeagueMessage(`Zsynchronizowano ligi: ${result.created} nowych, ${result.updated} zaktualizowanych.`);
      await load();
    } catch (err) {
      setLeagueMessage(err instanceof Error ? err.message : "Nie udało się zsynchronizować lig");
    } finally {
      setSyncingLeagues(false);
    }
  }

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
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            variant="primary"
            className="min-h-12 justify-start"
            onClick={syncPoeLeagues}
            disabled={syncingLeagues}
          >
            <CloudDownload className="h-4 w-4" aria-hidden="true" />
            Synchronizuj ligi
          </Button>
          <Button
            variant={openPanel === "league" ? "primary" : "secondary"}
            className="min-h-12 justify-start"
            onClick={() => setOpenPanel(openPanel === "league" ? null : "league")}
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Dodaj ligę ręcznie
          </Button>
          <Button
            variant={openPanel === "character" ? "primary" : "secondary"}
            className="min-h-12 justify-start"
            onClick={() => setOpenPanel(openPanel === "character" ? null : "character")}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Dodaj postać
          </Button>
        </div>
        {leagueMessage ? <p className="text-sm text-muted-foreground">{leagueMessage}</p> : null}
        {openPanel === "league" ? <LeagueForm onAdded={afterPoeAdded} /> : null}
        {openPanel === "character" ? (
          <PoeCharacterForm leagues={leagues} onAdded={afterPoeAdded} onLeaguesChanged={refreshLeagues} />
        ) : null}
      </section>

      <Card>
        <CardContent className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[1fr_150px_180px_150px_150px_auto]">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj postaci" onKeyDown={(event) => event.key === "Enter" && load()} />
          <Select value={gameVersion} onChange={(event) => setGameVersion(event.target.value)}>
            <option value="">PoE 1 i PoE 2</option>
            <option value="poe1">PoE 1</option>
            <option value="poe2">PoE 2</option>
          </Select>
          <LeagueSelector leagues={leagues} value={leagueId} onChange={setLeagueId} includeAll />
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Wszystkie statusy</option>
            <option value="active">Aktywna</option>
            <option value="ended">Zakończona</option>
            <option value="rip">Rip</option>
            <option value="test">Testowa</option>
            <option value="deleted">Usunięta</option>
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="added">Data dodania</option>
            <option value="level">Level</option>
            <option value="playtime">Czas gry</option>
          </Select>
          <Button onClick={load}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Odśwież
          </Button>
        </CardContent>
      </Card>

      {loading ? <LoadingState label="Ładowanie postaci PoE" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error ? (
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
    end_date: string;
    status: string;
    notes: string;
  }>({ name: "", game_version: "poe1", start_date: "", end_date: "", status: "active", notes: "" });
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!form.name.trim()) {
      return;
    }
    setMessage(null);
    try {
      await api.createLeague({
        ...form,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null
      });
      setForm({ name: "", game_version: "poe1", start_date: "", end_date: "", status: "active", notes: "" });
      setMessage("Liga dodana.");
      onAdded();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nie udało się dodać ligi");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dodaj ligę</CardTitle>
        <CardDescription>Ligi są wspólne dla postaci i statystyk dropów.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label="Nazwa ligi">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nazwa ligi" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Gra">
            <Select value={form.game_version} onChange={(event) => setForm({ ...form, game_version: event.target.value as "poe1" | "poe2" })}>
              <option value="poe1">Path of Exile 1</option>
              <option value="poe2">Path of Exile 2</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="active">Aktywna</option>
              <option value="completed">Zakończona</option>
              <option value="planned">Planowana</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start">
            <Input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} />
          </Field>
          <Field label="Koniec">
            <Input type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} />
          </Field>
        </div>
        <Field label="Notatki">
          <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </Field>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <Button onClick={submit} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Dodaj ligę
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
