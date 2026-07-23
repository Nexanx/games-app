"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

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
import { isAbortError, poeSnapshotSourceLabel, safeHttpUrl } from "@/lib/poe";
import { formatMinutes } from "@/lib/utils";
import { api } from "@/services/api";
import type { PoeCharacter, PoeCurrencyStat, PoeEquipmentItem, PoeLeague } from "@/types";

export default function PoeCharacterDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const [character, setCharacter] = useState<PoeCharacter | null>(null);
  const [draft, setDraft] = useState<PoeCharacter | null>(null);
  const [stats, setStats] = useState<PoeCurrencyStat[]>([]);
  const [equipment, setEquipment] = useState<PoeEquipmentItem[]>([]);
  const [leagues, setLeagues] = useState<PoeLeague[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!Number.isInteger(id) || id <= 0) throw new Error("Nieprawidłowy identyfikator postaci");
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
        if (!isAbortError(err)) setLoadError(err instanceof Error ? err.message : "Nie udało się pobrać postaci");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load]);

  function startEditing() {
    if (!character) return;
    setDraft({ ...character });
    setActionMessage(null);
  }

  function cancelEditing() {
    setDraft(null);
    setActionMessage(null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setActionMessage(null);
    try {
      const updated = await api.patchCharacter(draft.id, {
        name: draft.name.trim(),
        game_version: draft.game_version,
        league_id: draft.league_id,
        character_class: nullableText(draft.character_class),
        ascendancy: nullableText(draft.ascendancy),
        level: draft.level,
        build_name: nullableText(draft.build_name),
        main_skill: nullableText(draft.main_skill),
        mode: nullableText(draft.mode),
        playtime_minutes: draft.playtime_minutes,
        poe_ninja_url: nullableText(draft.poe_ninja_url),
        profile_url: nullableText(draft.profile_url),
        notes: nullableText(draft.notes)
      });
      setCharacter(updated);
      setDraft(null);
      setActionMessage({ kind: "success", text: "Zmiany postaci zostały zapisane." });
    } catch (err) {
      setActionMessage({ kind: "error", text: err instanceof Error ? err.message : "Nie udało się zapisać postaci" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCharacter() {
    const selected = draft ?? character;
    if (!selected || !window.confirm(`Usunąć postać „${selected.name}” razem z ekwipunkiem i statystykami?`)) return;
    setDeleting(true);
    setActionMessage(null);
    try {
      await api.deleteCharacter(selected.id);
      router.push("/poe");
    } catch (err) {
      setActionMessage({ kind: "error", text: err instanceof Error ? err.message : "Nie udało się usunąć postaci" });
      setDeleting(false);
    }
  }

  if (loading) return <LoadingState label="Ładowanie postaci" />;
  if (loadError || !character) return <ErrorState message={loadError ?? "Nie znaleziono postaci"} />;

  const poeNinjaUrl = safeHttpUrl(character.poe_ninja_url);
  const profileUrl = safeHttpUrl(character.profile_url);
  const visibleLeagues = leagues.filter((league) => league.game_version === draft?.game_version);

  return (
    <div className="space-y-5">
      <Link href="/poe" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Wróć do Path of Exile
      </Link>

      <PoeTooltipCard character={character} />
      <PoeEquipmentGrid equipment={equipment} />

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Dane postaci</CardTitle>
            <CardDescription>Informacje dodatkowe i źródła zapisanego stanu postaci.</CardDescription>
          </div>
          {!draft ? (
            <Button type="button" variant="secondary" onClick={startEditing}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edytuj postać
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <ReadOnlyField label="Czas gry" value={formatMinutes(character.playtime_minutes)} />
            <ReadOnlyField label="Źródło" value={poeSnapshotSourceLabel(character.snapshot_source)} />
            <ReadOnlyField label="Build" value={character.build_name ?? "Brak"} />
            <ReadOnlyField label="Tryb" value={character.mode ?? "Brak"} />
          </dl>
          {character.notes ? <p className="whitespace-pre-wrap rounded-lg bg-muted/45 p-3 text-sm leading-6 text-muted-foreground">{character.notes}</p> : null}
          <div className="flex flex-wrap gap-2">
            {poeNinjaUrl ? <ExternalLinkButton href={poeNinjaUrl} label="poe.ninja" /> : null}
            {profileUrl ? <ExternalLinkButton href={profileUrl} label="Profil" /> : null}
          </div>
          {!draft && actionMessage ? <ActionMessage message={actionMessage} /> : null}
        </CardContent>
      </Card>

      {draft ? (
        <Card>
          <CardHeader>
            <CardTitle>Edytuj postać</CardTitle>
            <CardDescription>Formularz zawiera aktualnie zapisane dane. Anulowanie nie zmieni postaci.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nazwa" htmlFor="poe-detail-name">
                <Input id="poe-detail-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </Field>
              <Field label="Czas w minutach" htmlFor="poe-detail-playtime">
                <Input id="poe-detail-playtime" type="number" min={0} value={draft.playtime_minutes} onChange={(event) => setDraft({ ...draft, playtime_minutes: Number(event.target.value) })} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Klasa" htmlFor="poe-detail-class">
                <Input id="poe-detail-class" value={draft.character_class ?? ""} onChange={(event) => setDraft({ ...draft, character_class: event.target.value })} />
              </Field>
              <Field label="Ascendancy" htmlFor="poe-detail-ascendancy">
                <Input id="poe-detail-ascendancy" value={draft.ascendancy ?? ""} onChange={(event) => setDraft({ ...draft, ascendancy: event.target.value })} />
              </Field>
              <Field label="Poziom" htmlFor="poe-detail-level">
                <Input id="poe-detail-level" type="number" min={1} max={100} value={draft.level} onChange={(event) => setDraft({ ...draft, level: Number(event.target.value) })} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Gra" htmlFor="poe-detail-version">
                <Select id="poe-detail-version" value={draft.game_version} onChange={(event) => setDraft({ ...draft, game_version: event.target.value as PoeCharacter["game_version"], league_id: null, league: null })}>
                  <option value="poe1">Path of Exile 1</option>
                  <option value="poe2">Path of Exile 2</option>
                </Select>
              </Field>
              <Field label="Liga" htmlFor="poe-detail-league">
                <Select id="poe-detail-league" value={draft.league_id ?? ""} onChange={(event) => {
                  const nextId = event.target.value ? Number(event.target.value) : null;
                  setDraft({ ...draft, league_id: nextId, league: visibleLeagues.find((league) => league.id === nextId) ?? null });
                }}>
                  <option value="">Bez ligi</option>
                  {visibleLeagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Build" htmlFor="poe-detail-build"><Input id="poe-detail-build" value={draft.build_name ?? ""} onChange={(event) => setDraft({ ...draft, build_name: event.target.value })} /></Field>
              <Field label="Główna umiejętność" htmlFor="poe-detail-skill"><Input id="poe-detail-skill" value={draft.main_skill ?? ""} onChange={(event) => setDraft({ ...draft, main_skill: event.target.value })} /></Field>
              <Field label="Tryb" htmlFor="poe-detail-mode"><Input id="poe-detail-mode" value={draft.mode ?? ""} onChange={(event) => setDraft({ ...draft, mode: event.target.value })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Link poe.ninja" htmlFor="poe-detail-ninja"><Input id="poe-detail-ninja" type="url" value={draft.poe_ninja_url ?? ""} onChange={(event) => setDraft({ ...draft, poe_ninja_url: event.target.value })} /></Field>
              <Field label="Link profilu" htmlFor="poe-detail-profile"><Input id="poe-detail-profile" type="url" value={draft.profile_url ?? ""} onChange={(event) => setDraft({ ...draft, profile_url: event.target.value })} /></Field>
            </div>
            <Field label="Notatki" htmlFor="poe-detail-notes"><Textarea id="poe-detail-notes" value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>
            {actionMessage ? <ActionMessage message={actionMessage} /> : null}
            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="danger" onClick={deleteCharacter} disabled={saving || deleting}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {deleting ? "Usuwanie…" : "Usuń postać"}
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={cancelEditing} disabled={saving || deleting}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Anuluj
                </Button>
                <Button type="button" onClick={save} disabled={saving || deleting || !draft.name.trim()}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {saving ? "Zapisywanie…" : "Zapisz"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <PoeCurrencyGrid characterId={character.id} stats={stats} onChanged={setStats} />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/45 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 truncate font-semibold" title={value}>{value}</dd></div>;
}

function ExternalLinkButton({ href, label }: { href: string; label: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ExternalLink className="h-4 w-4" aria-hidden="true" />{label}</a>;
}

function ActionMessage({ message }: { message: { kind: "success" | "error"; text: string } }) {
  return <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>{message.text}</p>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

function nullableText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}
