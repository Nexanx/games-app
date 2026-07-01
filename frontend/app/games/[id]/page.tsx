"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import Link from "next/link";

import { StatusBadge, statusLabels } from "@/components/games/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/services/api";
import type { BacklogGame, GameStat } from "@/types";
import { asDate, formatMinutes } from "@/lib/utils";

export default function GameDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const [entry, setEntry] = useState<BacklogGame | null>(null);
  const [stats, setStats] = useState<GameStat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.getBacklog(id), api.listGameStats(id)])
      .then(([backlog, gameStats]) => {
        setEntry(backlog);
        setStats(gameStats);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Nie udało się pobrać gry"))
      .finally(() => setLoading(false));
  }, [id]);

  async function save() {
    if (!entry) {
      return;
    }
    setSaving(true);
    try {
      setEntry(
        await api.patchBacklog(entry.id, {
          status: entry.status,
          rating: entry.rating ?? null,
          playtime_minutes: entry.playtime_minutes,
          completion_percent: entry.completion_percent,
          notes: entry.notes ?? null
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać zmian");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState label="Ładowanie szczegółów gry" />;
  }

  if (error || !entry) {
    return <ErrorState message={error ?? "Nie znaleziono gry"} />;
  }

  return (
    <div className="space-y-5">
      <Link href="/games" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Wróć do gier
      </Link>

      <section className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-glow">
          <div className="aspect-[3/4] bg-muted">
            {entry.game.cover_url ? (
              <img src={entry.game.cover_url} alt={entry.game.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Brak okładki</div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{entry.game.title}</h1>
              <StatusBadge status={entry.status} />
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.game.description ?? "Brak opisu."}</p>
          </header>

          <Card>
            <CardHeader>
              <CardTitle>Edycja wpisu</CardTitle>
              <CardDescription>Postęp, ocena, czas gry i notatki prywatne.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Status">
                  <Select value={entry.status} onChange={(event) => setEntry({ ...entry, status: event.target.value })}>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Ocena">
                  <Input type="number" min={0} max={10} step={0.5} value={entry.rating ?? ""} onChange={(event) => setEntry({ ...entry, rating: event.target.value ? Number(event.target.value) : null })} />
                </Field>
                <Field label="Czas w minutach">
                  <Input type="number" min={0} value={entry.playtime_minutes} onChange={(event) => setEntry({ ...entry, playtime_minutes: Number(event.target.value) })} />
                </Field>
                <Field label="Ukończenie %">
                  <Input type="number" min={0} max={100} value={entry.completion_percent} onChange={(event) => setEntry({ ...entry, completion_percent: Number(event.target.value) })} />
                </Field>
              </div>
              <Field label="Notatki">
                <Textarea value={entry.notes ?? ""} onChange={(event) => setEntry({ ...entry, notes: event.target.value })} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={save} disabled={saving}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Zapisz
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    await api.deleteBacklog(entry.id);
                    router.push("/games");
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Usuń
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Dane gry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Premiera: {asDate(entry.game.release_date)}</p>
            <p>Platformy: {entry.game.platforms.join(", ") || "Brak"}</p>
            <p>Gatunki: {entry.game.genres.join(", ") || "Brak"}</p>
            <p>Źródło: {entry.game.external_source}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Postęp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Czas gry: {formatMinutes(entry.playtime_minutes)}</p>
            <p>Rozpoczęto: {asDate(entry.started_at)}</p>
            <p>Ukończono: {asDate(entry.completed_at)}</p>
            <p>Pozycja: {entry.position + 1}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Własne statystyki</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {stats.length ? stats.map((stat) => (
              <div key={stat.id} className="flex justify-between rounded-md bg-muted px-3 py-2">
                <span>{stat.name}</span>
                <span className="text-accent">{stat.value} {stat.unit}</span>
              </div>
            )) : <p className="text-muted-foreground">Brak dodatkowych statystyk.</p>}
          </CardContent>
        </Card>
      </section>
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
