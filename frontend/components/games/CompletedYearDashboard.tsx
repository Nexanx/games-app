import Link from "next/link";
import { CalendarDays, Clock3, Gamepad2, Star, Timer, Trophy } from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { polishMonthNames } from "@/lib/completed-games";
import { formatHours } from "@/lib/utils";
import type { CompletedGamesYearDashboard } from "@/types";

export function CompletedYearDashboard({ dashboard }: { dashboard: CompletedGamesYearDashboard }) {
  return (
    <section className="space-y-4" aria-labelledby="year-summary-heading">
      <div>
        <p className="text-sm font-semibold text-primary">Podsumowanie roczne</p>
        <h2 id="year-summary-heading" className="mt-1 text-xl font-bold">Statystyki {dashboard.year}</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Ukończone gry" value={dashboard.completed_games_count} helper="W tym roku" icon={Gamepad2} accent="text-emerald-300" />
        <StatCard label="Łączny czas" value={formatHours(dashboard.total_playtime_hours)} icon={Timer} accent="text-amber-300" />
        <StatCard label="Średni czas gry" value={dashboard.average_playtime_hours == null ? "Brak danych" : formatHours(dashboard.average_playtime_hours)} icon={Clock3} accent="text-cyan-300" />
        <StatCard label="Średnia ocena" value={dashboard.average_rating == null ? "Brak ocen" : `${formatNumber(dashboard.average_rating)}/10`} icon={Star} accent="text-yellow-300" />
        <StatCard label="Najlepiej oceniona" value={dashboard.best_rated_game?.title ?? "Brak ocen"} helper={dashboard.best_rated_game?.rating == null ? undefined : `${formatNumber(dashboard.best_rated_game.rating)}/10`} icon={Trophy} accent="text-violet-300" />
        <StatCard label="Aktywne miesiące" value={dashboard.active_months_count} helper="Z co najmniej jedną grą" icon={CalendarDays} accent="text-primary" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <HighlightCard title="Najdłuższa gra" game={dashboard.longest_game} metric={dashboard.longest_game ? formatHours(dashboard.longest_game.playtime_hours) : "Brak danych"} />
        <Card>
          <CardHeader>
            <CardTitle>Miesiąc po miesiącu</CardTitle>
            <CardDescription>Liczba ukończeń, czas gry i średnia ocena tylko dla miesięcy z wpisami.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {dashboard.monthly.length ? (
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr><th className="pb-2 font-medium">Miesiąc</th><th className="pb-2 font-medium">Gry</th><th className="pb-2 font-medium">Czas</th><th className="pb-2 font-medium">Średnia ocena</th></tr>
                </thead>
                <tbody>
                  {dashboard.monthly.map((month) => (
                    <tr key={month.month} className="border-b border-border/60 last:border-0">
                      <td className="py-3 font-medium">{polishMonthNames[month.month - 1]}</td>
                      <td className="py-3">{month.completed_games_count}</td>
                      <td className="py-3">{formatHours(month.total_playtime_hours)}</td>
                      <td className="py-3">{month.average_rating == null ? "Brak ocen" : `${formatNumber(month.average_rating)}/10`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-sm text-muted-foreground">Brak ukończonych gier w tym roku.</p>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function HighlightCard({ title, game, metric }: { title: string; game: CompletedGamesYearDashboard["longest_game"]; metric: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {game ? (
          <Link href={`/completed-games/entry/${game.id}`} className="block rounded-md border border-border bg-background/55 p-4 transition hover:border-accent/70">
            <p className="truncate text-lg font-semibold">{game.title}</p>
            <p className="mt-1 text-sm text-accent">{metric}</p>
          </Link>
        ) : <p className="text-sm text-muted-foreground">{metric}</p>}
      </CardContent>
    </Card>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value);
}
