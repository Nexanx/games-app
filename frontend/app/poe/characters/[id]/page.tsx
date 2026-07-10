"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Save, Trash2 } from "lucide-react";

import { PoeCurrencyGrid } from "@/components/poe/PoeCurrencyGrid";
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
import type { PoeCharacter, PoeCurrencyStat } from "@/types";
import { formatMinutes } from "@/lib/utils";

export default function PoeCharacterDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const [character, setCharacter] = useState<PoeCharacter | null>(null);
  const [stats, setStats] = useState<PoeCurrencyStat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [characterData, statsData] = await Promise.all([api.getCharacter(id), api.listPoeStats(id)]);
    setCharacter(characterData);
    setStats(statsData);
  }, [id]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Nie udało się pobrać postaci"))
      .finally(() => setLoading(false));
  }, [load]);

  async function save() {
    if (!character) {
      return;
    }
    setSaving(true);
    try {
      setCharacter(
        await api.patchCharacter(character.id, {
          name: character.name,
          character_class: character.character_class,
          ascendancy: character.ascendancy,
          level: character.level,
          build_name: character.build_name,
          main_skill: character.main_skill,
          mode: character.mode,
          status: character.status,
          playtime_minutes: character.playtime_minutes,
          notes: character.notes
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać postaci");
    } finally {
      setSaving(false);
    }
  }

  async function refreshStats(next?: PoeCurrencyStat[]) {
    if (next) {
      setStats(next);
      return;
    }
    setStats(await api.listPoeStats(id));
  }

  if (loading) {
    return <LoadingState label="Ładowanie postaci" />;
  }

  if (error || !character) {
    return <ErrorState message={error ?? "Nie znaleziono postaci"} />;
  }

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
              <div className="flex flex-wrap gap-2">
                {character.poe_ninja_url ? (
                  <a href={character.poe_ninja_url} target="_blank" rel="noreferrer">
                    <Button variant="secondary">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      poe.ninja
                    </Button>
                  </a>
                ) : null}
                {character.profile_url ? (
                  <a href={character.profile_url} target="_blank" rel="noreferrer">
                    <Button variant="secondary">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Profil
                    </Button>
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
              <Field label="Nazwa">
                <Input value={character.name} onChange={(event) => setCharacter({ ...character, name: event.target.value })} />
              </Field>
              <Field label="Status">
                <Select value={character.status} onChange={(event) => setCharacter({ ...character, status: event.target.value })}>
                  <option value="active">Aktywna</option>
                  <option value="ended">Zakończona</option>
                  <option value="rip">Rip</option>
                  <option value="test">Testowa</option>
                  <option value="deleted">Usunięta</option>
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Klasa">
                <Input value={character.character_class ?? ""} onChange={(event) => setCharacter({ ...character, character_class: event.target.value })} />
              </Field>
              <Field label="Ascendancy">
                <Input value={character.ascendancy ?? ""} onChange={(event) => setCharacter({ ...character, ascendancy: event.target.value })} />
              </Field>
              <Field label="Level">
                <Input type="number" min={1} max={100} value={character.level} onChange={(event) => setCharacter({ ...character, level: Number(event.target.value) })} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Build">
                <Input value={character.build_name ?? ""} onChange={(event) => setCharacter({ ...character, build_name: event.target.value })} />
              </Field>
              <Field label="Skill">
                <Input value={character.main_skill ?? ""} onChange={(event) => setCharacter({ ...character, main_skill: event.target.value })} />
              </Field>
              <Field label="Czas w minutach">
                <Input type="number" min={0} value={character.playtime_minutes} onChange={(event) => setCharacter({ ...character, playtime_minutes: Number(event.target.value) })} />
              </Field>
            </div>
            <Field label="Tryb">
              <Input value={character.mode ?? ""} onChange={(event) => setCharacter({ ...character, mode: event.target.value })} />
            </Field>
            <Field label="Notatki">
              <Textarea value={character.notes ?? ""} onChange={(event) => setCharacter({ ...character, notes: event.target.value })} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving}>
                <Save className="h-4 w-4" aria-hidden="true" />
                Zapisz
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await api.deleteCharacter(character.id);
                  router.push("/poe");
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Usuń
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <PoeCurrencyGrid characterId={character.id} stats={stats} onChanged={refreshStats} />
    </div>
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
