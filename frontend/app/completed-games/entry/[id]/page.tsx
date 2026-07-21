"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

import { GameCover } from "@/components/games/GameCover";
import { ExternalRatings } from "@/components/games/ExternalRatings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { metacriticValueLabel } from "@/lib/external-ratings";
import { asDate, formatHours } from "@/lib/utils";
import { api } from "@/services/api";
import type { CompletedGameEntry } from "@/types";

export default function CompletedGameDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<CompletedGameEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.getCompletedGame(Number(id)).then(setEntry).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, [id]);
  if (loading) return <LoadingState label="Ładowanie ukończonej gry" />;
  if (error || !entry) return <ErrorState message={error || "Nie znaleziono wpisu"} />;

  const year = entry.completion_date.slice(0, 4);
  return (
    <div className="space-y-5">
      <Link href={`/completed-games/${year}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Wróć do {year} roku</Link>
      <section className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <GameCover src={entry.game.cover_url} title={entry.game.title} variant="detail" className="rounded-lg" />
        <div className="space-y-4">
          <header><h1 className="text-2xl font-bold sm:text-3xl">{entry.game.title}</h1><p className="mt-2 text-sm text-muted-foreground">Ukończono {asDate(entry.completion_date)}</p></header>
          <Card><CardContent className="space-y-4 p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Czas gry" value={formatHours(entry.playtime_hours)} /><Metric label="Moja ocena" value={entry.rating == null ? "Bez oceny" : `${entry.rating}/10`} /><Metric label="Platforma" value={entry.platform || "Brak"} /><Metric label="Metacritic" value={metacriticValueLabel(entry.game.external_ratings)} /></div><div className="border-t border-border pt-4"><ExternalRatings ratings={entry.game.external_ratings} updatedAt={entry.game.external_ratings_updated_at} sources={["RAWG"]} /></div></CardContent></Card>
          {entry.review ? <Card><CardHeader><CardTitle>Notatka lub recenzja</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{entry.review}</p></CardContent></Card> : null}
          <div className="flex flex-wrap gap-2">
            <Link href={`/completed-games/entry/${entry.id}/edit`}><Button><Pencil className="h-4 w-4" aria-hidden="true" />Edytuj</Button></Link>
            <Button variant="danger" onClick={async () => { if (!window.confirm("Usunąć ukończony wpis?")) return; await api.deleteCompletedGame(entry.id); router.push(`/completed-games/${year}`); }}><Trash2 className="h-4 w-4" aria-hidden="true" />Usuń</Button>
          </div>
        </div>
      </section>
      {entry.custom_statistics.length ? (
        <Card><CardHeader><CardTitle>Własne statystyki</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{entry.custom_statistics.map((statistic) => <div key={statistic.id} className="rounded-lg border border-border bg-background/55 p-4"><p className="text-xs text-muted-foreground">{statistic.name}</p><p className="mt-1 break-words font-semibold text-accent">{statistic.value_type === "boolean" ? (statistic.value === "true" ? "Tak" : "Nie") : statistic.value}</p></div>)}</CardContent></Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-background/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
