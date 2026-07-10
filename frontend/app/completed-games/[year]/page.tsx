"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { CompletedGameCard } from "@/components/games/CompletedGameCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/select";
import { getAvailableYearNavigation, groupCompletedGamesByMonth } from "@/lib/completed-games";
import { api } from "@/services/api";
import type { CompletedGameEntry, CompletedGamesYear } from "@/types";

export default function CompletedGamesYearPage() {
  const { year: yearParam } = useParams<{ year: string }>();
  const router = useRouter();
  const year = Number(yearParam);
  const [entries, setEntries] = useState<CompletedGameEntry[]>([]);
  const [years, setYears] = useState<CompletedGamesYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(year) || year < 1900 || year > 9998) {
      setError("Nieprawidłowy rok.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([api.listCompletedGames(year), api.listCompletedYears()])
      .then(([completedEntries, availableYears]) => { setEntries(completedEntries); setYears(availableYears); })
      .catch((err) => setError(err instanceof Error ? err.message : "Nie udało się pobrać historii"))
      .finally(() => setLoading(false));
  }, [year]);

  const monthGroups = useMemo(() => groupCompletedGamesByMonth(entries), [entries]);
  const navigation = useMemo(() => getAvailableYearNavigation(year, years), [year, years]);

  if (loading) return <LoadingState label={`Ładowanie ukończonych gier z ${year} roku`} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <Link href="/completed-games" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Wszystkie lata</Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-semibold text-primary">Historia roczna</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Ukończone gry — {year}</h1><p className="mt-2 text-sm text-muted-foreground">Łącznie ukończonych gier: {entries.length}</p></div>
          <Link href="/completed-games/new"><Button><Plus className="h-4 w-4" aria-hidden="true" />Dodaj grę</Button></Link>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex gap-2">
            {navigation.olderYear ? <Link href={`/completed-games/${navigation.olderYear}`}><Button variant="secondary"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Poprzedni rok ({navigation.olderYear})</Button></Link> : null}
            {navigation.newerYear ? <Link href={`/completed-games/${navigation.newerYear}`}><Button variant="secondary">Następny rok ({navigation.newerYear})<ChevronRight className="h-4 w-4" aria-hidden="true" /></Button></Link> : null}
          </div>
          <Select className="sm:w-52" value={years.some((item) => item.year === year) ? String(year) : ""} onChange={(event) => event.target.value && router.push(`/completed-games/${event.target.value}`)} aria-label="Wybierz inny rok">
            {!years.some((item) => item.year === year) ? <option value="">Wybierz rok</option> : null}
            {years.map((item) => <option key={item.year} value={item.year}>{item.year} ({item.completed_games_count})</option>)}
          </Select>
        </CardContent>
      </Card>

      {!entries.length ? <EmptyState title={`Brak ukończonych gier w ${year} roku`} description="Wybierz inny rok albo dodaj wpis z datą ukończenia w tym roku." /> : null}
      {monthGroups.map((group) => (
        <section key={group.month} className="space-y-3" aria-labelledby={`month-${group.month}`}>
          <div className="flex items-baseline justify-between border-b border-border pb-2"><h2 id={`month-${group.month}`} className="text-xl font-bold">{group.label}</h2><span className="text-sm text-muted-foreground">{group.entries.length} gier</span></div>
          <div className="space-y-3">{group.entries.map((entry) => <CompletedGameCard key={entry.id} entry={entry} />)}</div>
        </section>
      ))}
    </div>
  );
}
