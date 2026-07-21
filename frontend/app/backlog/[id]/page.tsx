"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Save, Trash2 } from "lucide-react";

import { GameCover } from "@/components/games/GameCover";
import { ExternalRatings } from "@/components/games/ExternalRatings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/LoadingState";
import { Textarea } from "@/components/ui/textarea";
import { metacriticValueLabel } from "@/lib/external-ratings";
import { api } from "@/services/api";
import type { BacklogEntry } from "@/types";

export default function BacklogDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<BacklogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getBacklog(Number(id)).then(setEntry).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingState label="Ładowanie gry z listy" />;
  if (error || !entry) return <ErrorState message={error || "Nie znaleziono pozycji"} />;

  return (
    <div className="space-y-5">
      <Link href="/backlog" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Wróć do listy
      </Link>
      <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <GameCover src={entry.game.cover_url} title={entry.game.title} variant="detail" className="rounded-lg" />
        <Card>
          <CardHeader>
            <CardTitle>{entry.game.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Metacritic" value={metacriticValueLabel(entry.game.external_ratings)} />
              <div className="rounded-md bg-background/60 p-3">
                <ExternalRatings ratings={entry.game.external_ratings} updatedAt={entry.game.external_ratings_updated_at} sources={["RAWG"]} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferred-platform">Preferowana platforma</Label>
              <Input
                id="preferred-platform"
                value={entry.preferred_platform || ""}
                onChange={(event) => setEntry({ ...entry, preferred_platform: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="backlog-note">Notatka</Label>
              <Textarea id="backlog-note" value={entry.note || ""} onChange={(event) => setEntry({ ...entry, note: event.target.value })} />
            </div>
            {message ? <p className="text-sm text-emerald-300" role="status">{message}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setError(null);
                  try {
                    setEntry(await api.patchBacklog(entry.id, { preferred_platform: entry.preferred_platform, note: entry.note }));
                    setMessage("Zmiany zostały zapisane.");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Nie udało się zapisać zmian");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <Save className="h-4 w-4" aria-hidden="true" /> Zapisz
              </Button>
              <Link href={`/completed-games/new?backlog=${entry.id}`}>
                <Button variant="accent"><Check className="h-4 w-4" aria-hidden="true" /> Zapisz ukończenie</Button>
              </Link>
              <Button
                variant="danger"
                onClick={async () => {
                  if (!window.confirm("Usunąć grę z listy Do ogrania?")) return;
                  await api.deleteBacklog(entry.id);
                  router.push("/backlog");
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Usuń
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-background/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}
