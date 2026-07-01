"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Gamepad2, Gem, PauseCircle, Skull, Timer, Trophy } from "lucide-react";
import Link from "next/link";

import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { api } from "@/services/api";
import type { DashboardSummary } from "@/types";
import { formatMinutes } from "@/lib/utils";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .dashboard()
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingState label="Ładowanie dashboardu" />;
  }

  if (error || !summary) {
    return <ErrorState message={error ?? "Nie udało się pobrać dashboardu"} />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary">Prywatny tracker</p>
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Dashboard</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Szybki obraz backlogu, czasu gry, postaci Path of Exile i najważniejszych dropów.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Do ogrania" value={summary.games.to_play} helper="Kolejka backlogu" icon={Gamepad2} />
        <StatCard label="W trakcie" value={summary.games.playing} helper="Aktualnie ruszone" icon={Clock3} accent="text-sky-300" />
        <StatCard label="Ukończone" value={summary.games.completed} helper="Zamknięte gry" icon={CheckCircle2} accent="text-emerald-300" />
        <StatCard label="Porzucone" value={summary.games.abandoned} helper={`Wstrzymane: ${summary.games.paused}`} icon={Skull} accent="text-rose-300" />
        <StatCard label="Łączny czas gier" value={formatMinutes(summary.total_game_playtime_minutes)} icon={Timer} accent="text-amber-300" />
        <StatCard label="Postacie PoE" value={summary.poe_character_count} helper="PoE 1 i PoE 2" icon={Gem} accent="text-orange-300" />
        <StatCard label="Czas PoE 1" value={formatMinutes(summary.poe_playtime_by_version.poe1 ?? 0)} icon={PauseCircle} accent="text-cyan-300" />
        <StatCard label="Czas PoE 2" value={formatMinutes(summary.poe_playtime_by_version.poe2 ?? 0)} icon={Trophy} accent="text-lime-300" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ostatnio dodane gry</CardTitle>
            <CardDescription>Najświeższe pozycje z backlogu.</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.recent_added_games.length ? (
              <div className="space-y-3">
                {summary.recent_added_games.map((entry) => (
                  <Link
                    href={`/games/${entry.id}`}
                    key={entry.id}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-md border border-border bg-background/55 p-3 transition hover:border-accent/70"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{entry.game.title}</span>
                      <span className="text-sm text-muted-foreground">{entry.status} · {formatMinutes(entry.playtime_minutes)}</span>
                    </span>
                    <span className="shrink-0 text-sm text-accent">{entry.completion_percent}%</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="Brak gier" description="Dodaj pierwszą grę w zakładce Gry." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ostatnia liga</CardTitle>
            <CardDescription>Krótki stan ostatnio zapisanej ligi PoE.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-background/55 p-4">
              <p className="text-lg font-semibold">{summary.latest_league.name ?? "Brak ligi"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {summary.latest_league.game_version ?? "PoE"} · {summary.latest_league.status ?? "brak statusu"}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Postacie</p>
                  <p className="text-xl font-bold">{summary.latest_league.characters}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Czas</p>
                  <p className="text-xl font-bold">{formatMinutes(summary.latest_league.playtime_minutes)}</p>
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Top waluty i dropy</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {summary.top_currency_drops.map((drop) => (
                  <div key={`${drop.name}-${drop.category}`} className="flex min-h-11 items-center justify-between rounded-md bg-muted px-3 text-sm">
                    <span className="truncate">{drop.name}</span>
                    <span className="font-semibold text-accent">{drop.value}</span>
                  </div>
                ))}
                {!summary.top_currency_drops.length ? <p className="text-sm text-muted-foreground">Brak zapisanych dropów.</p> : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ostatnio ukończone gry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.recent_completed_games.length ? summary.recent_completed_games.map((entry) => (
              <Link key={entry.id} href={`/games/${entry.id}`} className="block rounded-md bg-background/55 p-3 text-sm hover:bg-muted">
                {entry.game.title} · {entry.rating ? `${entry.rating}/10` : "bez oceny"}
              </Link>
            )) : <p className="text-sm text-muted-foreground">Jeszcze nic nie ukończono.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ostatnio dodane postacie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.recent_poe_characters.length ? summary.recent_poe_characters.map((character) => (
              <Link key={character.id} href={`/poe/characters/${character.id}`} className="block rounded-md bg-background/55 p-3 text-sm hover:bg-muted">
                {character.name} · lvl {character.level} · {character.game_version}
              </Link>
            )) : <p className="text-sm text-muted-foreground">Brak postaci PoE.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

