"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Save, Trash2 } from "lucide-react";

import { PoeCurrencyGrid } from "@/components/poe/PoeCurrencyGrid";
import { PoeEquipmentGrid } from "@/components/poe/PoeEquipmentGrid";
import { PoeTooltipCard } from "@/components/poe/PoeTooltipCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/services/api";
import type { PoeCharacter, PoeCurrencyStat, PoeEquipmentItem, PoeLeague } from "@/types";
import { formatMinutes } from "@/lib/utils";
import { isAbortError, poeSnapshotSourceLabel, safeHttpUrl } from "@/lib/poe";

export default function PoeCharacterDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const [character, setCharacter] = useState<PoeCharacter | null>(null);
  const [stats, setStats] = useState<PoeCurrencyStat[]>([]);
  const [equipment, setEquipment] = useState<PoeEquipmentItem[]>([]);
  const [leagues, setLeagues] = useState<PoeLeague[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Nieprawidłowy identyfikator postaci");
    }
    setLoadError(null);
    const [characterData, statsData, equipmentData, leagueData] = await Promise.all([
      api.getCharacter(id, signal),
      api.listPoeStats(id, signal),
      api.listPoeEquipment(id, signal),
      api.listLeagues(signal)
    ]);
    setCharacter(characterData);
    setStats(statsData);
    setEquipment(equipmentData);
    setLeagues(leagueData);
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .catch((err) => {
        if (!isAbortError(err)) {
          setLoadError(err instanceof Error ? err.message : "Nie udało się pobrać postaci");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load]);

  async function save() {
    if (!character) {
      return;
    }
    setSaving(true);
    setActionMessage(null);
    try {
      setCharacter(
        await api.patchCharacter(character.id, {
          name: character.name,
          game_version: character.game_version,
          league_id: character.league_id,
          character_class: nullableText(character.character_class),
          ascendancy: nullableText(character.ascendancy),
          level: character.level,
          build_name: nullableText(character.build_name),
          main_skill: nullableText(character.main_skill),
          mode: nullableText(character.mode),
          status: character.status,
          playtime_minutes: character.playtime_minutes,
          poe_ninja_url: nullableText(character.poe_ninja_url),
          profile_url: nullableText(character.profile_url),
          notes: nullableText(character.notes)
        })
      );
      setActionMessage({ kind: "success", text: "Zmiany postaci zostały zapisane." });
    } catch (err) {
      setActionMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Nie udało się zapisać postaci"
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCharacter() {
    if (!character || !window.confirm(`Usunąć postać „${character.name}” i jej statystyki?`)) {
      return;
    }
    setDeleting(true);
    setActionMessage(null);
    try {
      await api.deleteCharacter(character.id);
      router.push("/poe");
    } catch (err) {
      setActionMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Nie udało się usunąć postaci"
      });
      setDeleting(false);
    }
  }

  if (loading) {
    return <LoadingState label="Ładowanie postaci" />;
  }

  if (loadError || !character) {
    return <ErrorState message={loadError ?? "Nie znaleziono postaci"} />;
  }

  const poeNinjaUrl = safeHttpUrl(character.poe_ninja_url);
  const profileUrl = safeHttpUrl(character.profile_url);
  const visibleLeagues = leagues.filter((league) => league.game_version === character.game_version);

  return (
    <div className="space-y-5">
      <Link href="/poe" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Wróć do Path of Exile
      </Link>

      <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <PoeTooltipCard character={character} stats={stats} />
          <Card>
            <CardHeader>
              <CardTitle>Linki i czas</CardTitle>
              <CardDescription>Praktyczne dane do szybkiego sprawdzenia.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Czas gry: {formatMinutes(character.playtime_minutes)}</p>
              <p>Liga: {character.league?.name ?? "Brak"}</p>
              <p>Tryb: {character.mode ?? "Brak"}</p>
              <p>Źródło snapshotu: {poeSnapshotSourceLabel(character.snapshot_source)}</p>
              <div className="flex flex-wrap gap-2">
                {poeNinjaUrl ? (
                  <a
                    href={poeNinjaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    poe.ninja
                  </a>
                ) : null}
                {profileUrl ? (
                  <a
                    href={profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Profil
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Edycja postaci</CardTitle>
            <CardDescription>Podstawowe dane buildu, status i notatki.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nazwa" htmlFor="poe-detail-name">
                <Input id="poe-detail-name" value={character.name} onChange={(event) => setCharacter({ ...character, name: event.target.value })} />
              </Field>
              <Field label="Status" htmlFor="poe-detail-status">
                <Select id="poe-detail-status" value={character.status} onChange={(event) => setCharacter({ ...character, status: event.target.value })}>
                  <option value="active">Aktywna</option>
                  <option value="ended">Zakończona</option>
                  <option value="rip">Rip</option>
                  <option value="test">Testowa</option>
                  <option value="deleted">Usunięta</option>
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Klasa" htmlFor="poe-detail-class">
                <Input id="poe-detail-class" value={character.character_class ?? ""} onChange={(event) => setCharacter({ ...character, character_class: event.target.value })} />
              </Field>
              <Field label="Ascendancy" htmlFor="poe-detail-ascendancy">
                <Input id="poe-detail-ascendancy" value={character.ascendancy ?? ""} onChange={(event) => setCharacter({ ...character, ascendancy: event.target.value })} />
              </Field>
              <Field label="Level" htmlFor="poe-detail-level">
                <Input id="poe-detail-level" type="number" min={1} max={100} value={character.level} onChange={(event) => setCharacter({ ...character, level: Number(event.target.value) })} />
              </Field>
            </div>
            <Field label="Czas w minutach" htmlFor="poe-detail-playtime">
              <Input id="poe-detail-playtime" type="number" min={0} value={character.playtime_minutes} onChange={(event) => setCharacter({ ...character, playtime_minutes: Number(event.target.value) })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Gra" htmlFor="poe-detail-version">
                <Select
                  id="poe-detail-version"
                  value={character.game_version}
                  onChange={(event) => setCharacter({ ...character, game_version: event.target.value as PoeCharacter["game_version"], league_id: null, league: null })}
                >
                  <option value="poe1">Path of Exile 1</option>
                  <option value="poe2">Path of Exile 2</option>
                </Select>
              </Field>
              <Field label="Liga" htmlFor="poe-detail-league">
                <Select
                  id="poe-detail-league"
                  value={character.league_id ?? ""}
                  onChange={(event) => {
                    const nextId = event.target.value ? Number(event.target.value) : null;
                    setCharacter({ ...character, league_id: nextId, league: visibleLeagues.find((league) => league.id === nextId) ?? null });
                  }}
                >
                  <option value="">Bez ligi</option>
                  {visibleLeagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                </Select>
              </Field>
            </div>
            <details className="rounded-lg border border-border bg-muted/30 p-3">
              <summary className="cursor-pointer font-medium">Dodatkowe dane starszego wpisu</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Build" htmlFor="poe-detail-build">
                  <Input id="poe-detail-build" value={character.build_name ?? ""} onChange={(event) => setCharacter({ ...character, build_name: event.target.value })} />
                </Field>
                <Field label="Skill" htmlFor="poe-detail-skill">
                  <Input id="poe-detail-skill" value={character.main_skill ?? ""} onChange={(event) => setCharacter({ ...character, main_skill: event.target.value })} />
                </Field>
                <Field label="Tryb" htmlFor="poe-detail-mode">
                  <Input id="poe-detail-mode" value={character.mode ?? ""} onChange={(event) => setCharacter({ ...character, mode: event.target.value })} />
                </Field>
              </div>
            </details>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Link poe.ninja" htmlFor="poe-detail-ninja">
                <Input id="poe-detail-ninja" type="url" value={character.poe_ninja_url ?? ""} onChange={(event) => setCharacter({ ...character, poe_ninja_url: event.target.value })} />
              </Field>
              <Field label="Link profilu" htmlFor="poe-detail-profile">
                <Input id="poe-detail-profile" type="url" value={character.profile_url ?? ""} onChange={(event) => setCharacter({ ...character, profile_url: event.target.value })} />
              </Field>
            </div>
            <Field label="Notatki" htmlFor="poe-detail-notes">
              <Textarea id="poe-detail-notes" value={character.notes ?? ""} onChange={(event) => setCharacter({ ...character, notes: event.target.value })} />
            </Field>
            {actionMessage ? (
              <p
                role={actionMessage.kind === "error" ? "alert" : "status"}
                className={actionMessage.kind === "error" ? "text-sm text-destructive" : "text-sm text-primary"}
              >
                {actionMessage.text}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={save} disabled={saving || deleting}>
                <Save className="h-4 w-4" aria-hidden="true" />
                Zapisz
              </Button>
              <Button type="button" variant="danger" onClick={deleteCharacter} disabled={saving || deleting}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Usuń
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <PoeEquipmentGrid equipment={equipment} />
      <PoeCurrencyGrid characterId={character.id} stats={stats} onChanged={setStats} />
    </div>
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

function nullableText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}
