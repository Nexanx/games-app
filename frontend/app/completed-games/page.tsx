"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { api } from "@/services/api";
import type { CompletedGamesYear } from "@/types";

export default function CompletedGamesYearsPage() {
  const [years, setYears] = useState<CompletedGamesYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listCompletedYears().then(setYears).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Historia</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">Ukończone gry</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Wybierz rok, aby zobaczyć ukończone gry pogrupowane według miesięcy.</p>
        </div>
        <Link href="/completed-games/new"><Button><Plus className="h-4 w-4" aria-hidden="true" />Dodaj ukończoną grę</Button></Link>
      </header>

      {loading ? <LoadingState label="Ładowanie lat" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && !years.length ? (
        <EmptyState title="Brak ukończonych gier" description="Dodaj pierwszy wpis, aby rozpocząć historię." />
      ) : null}
      {!loading && !error && years.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Dostępne lata">
          {years.map((item) => (
            <Link key={item.year} href={`/completed-games/${item.year}`} className="group focus:outline-none focus:ring-2 focus:ring-ring">
              <Card className="h-full transition group-hover:border-accent/70">
                <CardContent className="flex items-center gap-4 p-5">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15 text-primary"><CalendarRange className="h-6 w-6" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><strong className="block text-2xl">{item.year}</strong><span className="text-sm text-muted-foreground">{item.completed_games_count} ukończonych gier</span></span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-accent" aria-hidden="true" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}
