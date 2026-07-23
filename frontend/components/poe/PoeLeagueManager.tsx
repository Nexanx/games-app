"use client";

import { Pencil, Save, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api } from "@/services/api";
import type { PoeLeague } from "@/types";

export function PoeLeagueManager({ leagues, onChanged }: { leagues: PoeLeague[]; onChanged: () => Promise<PoeLeague[]> }) {
  const [editing, setEditing] = useState<PoeLeague | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function save() {
    if (!editing?.name.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.patchLeague(editing.id, {
        name: editing.name,
        game_version: editing.game_version,
        start_date: editing.start_date
      });
      await onChanged();
      setEditing(null);
      setMessage({ kind: "success", text: "Liga została zaktualizowana." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Nie udało się zaktualizować ligi" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(league: PoeLeague) {
    if (!window.confirm(`Usunąć ligę „${league.name}”? Postacie pozostaną zapisane, ale stracą przypisanie do tej ligi.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.deleteLeague(league.id);
      await onChanged();
      if (editing?.id === league.id) setEditing(null);
      setMessage({ kind: "success", text: "Liga została usunięta. Dane postaci i dropów pozostały zachowane." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Nie udało się usunąć ligi" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zarządzanie ligami</CardTitle>
        <CardDescription>Selektory przypisują ligi do postaci; tutaj można zmienić ich nazwę lub grę albo usunąć przypisanie.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {message ? (
          <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
            {message.text}
          </p>
        ) : null}
        {leagues.length ? leagues.map((league) => (
          <div key={league.id} className="rounded-lg border border-border bg-background/50 p-3">
            {editing?.id === league.id ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Field label="Nazwa" htmlFor={`league-name-${league.id}`}>
                    <Input id={`league-name-${league.id}`} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
                  </Field>
                  <Field label="Gra" htmlFor={`league-version-${league.id}`}>
                    <Select id={`league-version-${league.id}`} value={editing.game_version} onChange={(event) => setEditing({ ...editing, game_version: event.target.value as PoeLeague["game_version"] })}>
                      <option value="poe1">Path of Exile 1</option>
                      <option value="poe2">Path of Exile 2</option>
                    </Select>
                  </Field>
                  <Field label="Data startu" htmlFor={`league-start-date-${league.id}`}>
                    <Input id={`league-start-date-${league.id}`} type="date" value={editing.start_date ?? ""} onChange={(event) => setEditing({ ...editing, start_date: event.target.value })} required />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={save} disabled={busy || !editing.name.trim() || !editing.start_date}>
                    <Save className="h-4 w-4" aria-hidden="true" /> Zapisz
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                    <X className="h-4 w-4" aria-hidden="true" /> Anuluj
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{league.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {league.game_version === "poe1" ? "Path of Exile 1" : "Path of Exile 2"}
                    {league.start_date ? ` · start ${formatLeagueDate(league.start_date)}` : " · brak daty startu"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="secondary" onClick={() => setEditing({ ...league })} disabled={busy}>
                    <Pencil className="h-4 w-4" aria-hidden="true" /> Edytuj
                  </Button>
                  <Button type="button" variant="danger" onClick={() => remove(league)} disabled={busy} aria-label={`Usuń ligę ${league.name}`}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Usuń
                  </Button>
                </div>
              </div>
            )}
          </div>
        )) : <p className="text-sm text-muted-foreground">Nie zapisano jeszcze żadnej ligi.</p>}
      </CardContent>
    </Card>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

function formatLeagueDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}
