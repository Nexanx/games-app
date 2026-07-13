"use client";

import { ArrowDown, ArrowUp, Gem, Pencil, Save, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { POE_STAT_CATEGORIES, poeCategoryLabel } from "@/lib/poe";
import type { PoeCurrencyStat } from "@/types";

export function PoeCurrencyStatItem({
  stat,
  onDelete,
  onUpdate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown
}: {
  stat: PoeCurrencyStat;
  onDelete: () => void;
  onUpdate: (payload: Partial<PoeCurrencyStat>) => Promise<void>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: stat.name, value: String(stat.value), category: stat.category, icon_url: stat.icon_url ?? "", notes: stat.notes ?? "" });

  async function save() {
    if (!draft.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate({
        name: draft.name.trim(),
        value: Number(draft.value || 0),
        category: draft.category,
        icon_url: draft.icon_url || null,
        notes: draft.notes || null
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać statystyki");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card/80 p-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_110px_160px]">
          <Field label="Nazwa" htmlFor={`stat-name-${stat.id}`}><Input id={`stat-name-${stat.id}`} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
          <Field label="Wartość" htmlFor={`stat-value-${stat.id}`}><Input id={`stat-value-${stat.id}`} type="number" value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} /></Field>
          <Field label="Kategoria" htmlFor={`stat-category-${stat.id}`}>
            <Select id={`stat-category-${stat.id}`} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
              {POE_STAT_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Ikona URL" htmlFor={`stat-icon-${stat.id}`}><Input id={`stat-icon-${stat.id}`} type="url" value={draft.icon_url} onChange={(event) => setDraft({ ...draft, icon_url: event.target.value })} /></Field>
        <Field label="Notatka" htmlFor={`stat-notes-${stat.id}`}><Textarea id={`stat-notes-${stat.id}`} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={saving || !draft.name.trim()}><Save className="h-4 w-4" aria-hidden="true" /> Zapisz</Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={saving}><X className="h-4 w-4" aria-hidden="true" /> Anuluj</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-16 min-w-0 flex-col gap-3 rounded-lg border border-border bg-card/80 p-3 sm:flex-row sm:items-center">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
        {stat.icon_url ? <img src={stat.icon_url} alt="" className="h-7 w-7 object-contain" /> : <Gem className="h-5 w-5 text-accent" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold">{stat.name}</p>
          <span className="shrink-0 text-sm font-bold text-accent">{stat.value}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{poeCategoryLabel(stat.category)}{stat.notes ? ` · ${stat.notes}` : ""}</p>
      </div>
      <div className="flex shrink-0 gap-1 self-end sm:self-auto">
        <Button type="button" variant="ghost" className="h-10 w-10 px-0" onClick={() => setEditing(true)} aria-label={`Edytuj statystykę ${stat.name}`}><Pencil className="h-4 w-4" aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" className="h-10 w-10 px-0" onClick={onMoveUp} disabled={!canMoveUp} aria-label={`Przesuń ${stat.name} wyżej`}><ArrowUp className="h-4 w-4" aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" className="h-10 w-10 px-0" onClick={onMoveDown} disabled={!canMoveDown} aria-label={`Przesuń ${stat.name} niżej`}><ArrowDown className="h-4 w-4" aria-hidden="true" /></Button>
        <Button type="button" variant="danger" className="h-10 w-10 px-0" onClick={onDelete} aria-label={`Usuń statystykę ${stat.name}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}
