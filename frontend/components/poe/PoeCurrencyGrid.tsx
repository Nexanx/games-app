"use client";

import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { PoeCurrencyStatItem } from "@/components/poe/PoeCurrencyStatItem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/services/api";
import type { PoeCurrencyStat } from "@/types";

const categories = [
  "currency",
  "maps",
  "fragments",
  "scarabs",
  "crafting",
  "league mechanic",
  "cards",
  "uniques",
  "custom"
];

export function PoeCurrencyGrid({
  characterId,
  stats,
  onChanged
}: {
  characterId: number;
  stats: PoeCurrencyStat[];
  onChanged: (stats?: PoeCurrencyStat[]) => void;
}) {
  const [form, setForm] = useState({ name: "", value: "0", category: "currency", icon_url: "", notes: "" });
  const [message, setMessage] = useState<string | null>(null);

  async function addStat() {
    if (!form.name.trim()) {
      return;
    }
    setMessage(null);
    try {
      await api.createPoeStat(characterId, {
        name: form.name,
        value: Number(form.value || 0),
        category: form.category,
        icon_url: form.icon_url || null,
        display_order: stats.length,
        notes: form.notes || null
      });
      setForm({ name: "", value: "0", category: "currency", icon_url: "", notes: "" });
      onChanged();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nie udało się dodać statystyki");
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stats.length) {
      return;
    }
    const next = [...stats];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChanged(await api.reorderPoeStats(characterId, next.map((stat) => stat.id)));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Dodaj statystykę</CardTitle>
          <CardDescription>Waluty, mapy, scaraby, karty, unikaty lub dowolny własny typ.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_120px_180px]">
            <Field label="Nazwa">
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Divine Orb" />
            </Field>
            <Field label="Wartość">
              <Input type="number" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
            </Field>
            <Field label="Kategoria">
              <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Ikona URL">
            <Input value={form.icon_url} onChange={(event) => setForm({ ...form, icon_url: event.target.value })} placeholder="https://..." />
          </Field>
          <Field label="Notatka">
            <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Field>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button onClick={addStat} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Dodaj statystykę
          </Button>
        </CardContent>
      </Card>

      {stats.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {stats.map((stat, index) => (
            <PoeCurrencyStatItem
              key={stat.id}
              stat={stat}
              onMoveUp={() => move(index, -1)}
              onMoveDown={() => move(index, 1)}
              onDelete={async () => {
                await api.deletePoeStat(stat.id);
                onChanged();
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="Brak statystyk PoE" description="Dodaj pierwszą walutę, drop albo własną metrykę." />
      )}
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
