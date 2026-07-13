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
import { POE_STAT_CATEGORIES } from "@/lib/poe";
import type { PoeCurrencyStat } from "@/types";

export function PoeCurrencyGrid({
  characterId,
  stats,
  onChanged
}: {
  characterId: number;
  stats: PoeCurrencyStat[];
  onChanged: (stats: PoeCurrencyStat[]) => void;
}) {
  const [form, setForm] = useState({ name: "", value: "0", category: "currency", icon_url: "", notes: "" });
  const [message, setMessage] = useState<string | null>(null);

  async function addStat() {
    if (!form.name.trim()) {
      return;
    }
    setMessage(null);
    try {
      const created = await api.createPoeStat(characterId, {
        name: form.name,
        value: Number(form.value || 0),
        category: form.category,
        icon_url: form.icon_url || null,
        display_order: stats.length,
        notes: form.notes || null
      });
      setForm({ name: "", value: "0", category: "currency", icon_url: "", notes: "" });
      onChanged([...stats, created]);
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
    try {
      onChanged(await api.reorderPoeStats(characterId, next.map((stat) => stat.id)));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nie udało się zmienić kolejności statystyk");
    }
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
            <Field label="Nazwa" htmlFor="poe-stat-name">
              <Input id="poe-stat-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Divine Orb" />
            </Field>
            <Field label="Wartość" htmlFor="poe-stat-value">
              <Input id="poe-stat-value" type="number" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
            </Field>
            <Field label="Kategoria" htmlFor="poe-stat-category">
              <Select id="poe-stat-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {POE_STAT_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Ikona URL" htmlFor="poe-stat-icon">
            <Input id="poe-stat-icon" type="url" value={form.icon_url} onChange={(event) => setForm({ ...form, icon_url: event.target.value })} placeholder="https://..." />
          </Field>
          <Field label="Notatka" htmlFor="poe-stat-notes">
            <Textarea id="poe-stat-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
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
              canMoveUp={index > 0}
              canMoveDown={index < stats.length - 1}
              onUpdate={async (payload) => {
                const updated = await api.patchPoeStat(stat.id, payload);
                onChanged(stats.map((item) => item.id === stat.id ? updated : item));
              }}
              onDelete={async () => {
                if (!window.confirm(`Usunąć statystykę „${stat.name}”?`)) return;
                try {
                  await api.deletePoeStat(stat.id);
                  onChanged(stats.filter((item) => item.id !== stat.id));
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : "Nie udało się usunąć statystyki");
                }
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

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
