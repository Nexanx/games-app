import * as React from "react";
import Link from "next/link";
import { BarChart3, CalendarCheck2, Clock3, Gamepad2, ListPlus, Plus, Star } from "lucide-react";

import { GameCover } from "../games/GameCover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { StatCard } from "./StatCard";
import { metacriticValueLabel } from "../../lib/external-ratings";
import { asDate, formatHours, formatMinutes } from "../../lib/utils";
import type { DashboardCurrentYearSummary, DashboardSummary } from "../../types";

const monthNames = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const monthLocative = ["styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu", "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"];

export function DashboardContent({ summary }: { summary: DashboardSummary }) {
  const games = summary.games;
  const current = games.current_year;
  const insight = getDashboardInsight(current);
  const showPoe = Boolean(summary.poe?.character_count || summary.poe?.latest_league.name);

  return <>
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-sm font-semibold text-primary">Ekran startowy · {current.year}</p><h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">Dashboard</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Najważniejsze informacje o ukończeniach i najbliższych grach z listy.</p></div>
      <nav aria-label="Szybkie akcje Dashboardu" className="flex flex-wrap gap-2">
        <ActionLink href="/completed-games/new" icon={Plus}>Dodaj ukończoną grę</ActionLink>
        <ActionLink href="/backlog" icon={ListPlus} variant="secondary">Dodaj grę do listy</ActionLink>
        <ActionLink href={`/analytics/${current.year}`} icon={BarChart3} variant="secondary">Otwórz analizę</ActionLink>
      </nav>
    </header>

    <section aria-labelledby="dashboard-stats-heading" className="space-y-3">
      <h2 id="dashboard-stats-heading" className="sr-only">Najważniejsze statystyki {current.year} roku</h2>
      <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <StatCard href={`/completed-games/${current.year}`} label="Ukończone gry" value={current.completed_games_count} helper={`W ${current.year} roku`} icon={CalendarCheck2} accent="text-emerald-300" />
        <StatCard href={`/analytics/${current.year}`} label="Łączny czas gry" value={current.games_with_playtime_count ? formatHours(current.total_playtime_hours) : "Brak danych"} helper={current.games_with_playtime_count ? `${current.games_with_playtime_count} wpisów z czasem` : "Nie podano czasu gry"} icon={Clock3} accent="text-amber-300" />
        <StatCard href={`/analytics/${current.year}`} label="Średnia ocena" value={current.average_rating == null ? "Brak ocen" : `${formatNumber(current.average_rating)}/10`} helper={current.rated_games_count ? `${current.rated_games_count} ocenionych wpisów` : "Dodaj ocenę przy ukończeniu"} icon={Star} accent="text-yellow-300" />
        <StatCard href="/backlog" label="Do ogrania" value={games.backlog_count} helper="Pozycje w kolejce" icon={Gamepad2} />
      </div>
    </section>

    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <GameSection title="Ostatnio ukończone" description="Pięć najnowszych wpisów z całej historii." actionHref="/completed-games/years" actionLabel="Wszystkie ukończenia">
        {games.recent_completed_games.length ? <div className="space-y-3">{games.recent_completed_games.map((entry) => <Link key={entry.id} href={`/completed-games/entry/${entry.id}`} className="grid min-h-24 grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-md border border-border bg-background/55 p-3 transition hover:border-accent/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"><GameCover src={entry.cover_url} title={entry.title} className="w-14" /><span className="min-w-0"><span className="block truncate font-semibold">{entry.title}</span><span className="mt-1 block text-sm text-muted-foreground">{asDate(entry.completion_date)}</span><span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{entry.playtime_hours > 0 ? formatHours(entry.playtime_hours) : "Brak czasu"}</span><span>{entry.rating == null ? "Bez oceny" : `${formatNumber(entry.rating)}/10`}</span><span>Metacritic: {metacriticValueLabel(entry.external_ratings)}</span></span></span></Link>)}</div> : <DashboardEmpty title={`Brak ukończonych gier w ${current.year} roku`} description="Po dodaniu pierwszego ukończenia pojawi się ono w tym miejscu." href="/completed-games/new" action="Dodaj pierwszą grę" />}
      </GameSection>

      <GameSection title="Następne do ogrania" description="Pierwsze pozycje zgodnie z Twoją kolejnością." actionHref="/backlog" actionLabel="Otwórz listę">
        {games.next_backlog_entries.length ? <div className="space-y-3">{games.next_backlog_entries.map((entry) => <div key={entry.id} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-md border border-border bg-background/55 p-3 sm:grid-cols-[56px_minmax(0,1fr)_auto]"><GameCover src={entry.cover_url} title={entry.title} className="w-12 sm:w-14" /><div className="min-w-0"><Link href={`/backlog/${entry.id}`} className="font-semibold hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">#{entry.position + 1} · {entry.title}</Link><p className="mt-1 truncate text-sm text-muted-foreground">{entry.preferred_platform || "Bez wybranej platformy"}</p><p className="mt-1 text-xs text-muted-foreground">Metacritic: {metacriticValueLabel(entry.external_ratings)}</p>{entry.note ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{entry.note}</p> : null}</div><Link href={`/completed-games/new?backlog=${entry.id}`} className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-md bg-muted px-3 text-sm font-semibold transition hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-1 sm:self-center">Dodaj ukończenie</Link></div>)}</div> : <DashboardEmpty title="Lista Do ogrania jest pusta" description="Dodaj grę, aby zaplanować kolejne ukończenie." href="/backlog" action="Dodaj grę do listy" />}
      </GameSection>
    </div>

    <section className="grid min-w-0 gap-4 lg:grid-cols-[1.3fr_0.7fr]" aria-labelledby="dashboard-analysis-heading">
      <Card className="min-w-0"><CardHeader><p className="text-sm font-semibold text-primary">Skrót do Analizy</p><CardTitle id="dashboard-analysis-heading">Aktywność w {current.year} roku</CardTitle><CardDescription>Krótki trend bez rozbudowanych filtrów i raportów.</CardDescription></CardHeader><CardContent className="space-y-5">{insight ? <p className="rounded-md border border-primary/25 bg-primary/10 p-3 text-sm">{insight}</p> : null}<MiniTrend current={current} /><Link href={`/analytics/${current.year}?section=trends`} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">Zobacz pełną analizę</Link></CardContent></Card>
      <Card><CardHeader><CardTitle>Szybki wybór</CardTitle><CardDescription>Najczęstsze miejsca bez powielania ich pełnej zawartości.</CardDescription></CardHeader><CardContent className="grid gap-2"><Shortcut href={`/completed-games/${current.year}`} icon={CalendarCheck2} label={`Ukończone ${current.year}`} /><Shortcut href="/backlog" icon={Gamepad2} label="Lista Do ogrania" /><Shortcut href={`/analytics/${current.year}?section=report`} icon={BarChart3} label="Raport roczny" /></CardContent></Card>
    </section>

    {summary.poe_error ? <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">{summary.poe_error}</div> : null}
    {showPoe && summary.poe ? <section aria-labelledby="dashboard-poe-heading"><Card><CardHeader className="sm:flex sm:flex-row sm:items-center sm:justify-between sm:space-y-0"><div><p className="text-sm font-semibold text-primary">Moduł dodatkowy</p><CardTitle id="dashboard-poe-heading" className="mt-1">Path of Exile</CardTitle></div><Link href="/poe" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">Otwórz moduł PoE</Link></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><CompactMetric label="Postacie" value={String(summary.poe.character_count)} /><CompactMetric label="Łączny czas PoE" value={formatMinutes(Object.values(summary.poe.playtime_by_version).reduce((sum, value) => sum + value, 0))} /><CompactMetric label="Ostatnia liga" value={summary.poe.latest_league.name || "Brak ligi"} /></CardContent></Card></section> : null}
  </>;
}

function ActionLink({ href, icon: Icon, children, variant = "primary" }: { href: string; icon: typeof Plus; children: React.ReactNode; variant?: "primary" | "secondary" }) { return <Link href={href} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-foreground hover:bg-muted/80"}`}><Icon className="h-4 w-4" aria-hidden="true" />{children}</Link>; }
function GameSection({ title, description, actionHref, actionLabel, children }: { title: string; description: string; actionHref: string; actionLabel: string; children: React.ReactNode }) { return <section><Card className="h-full"><CardHeader className="flex-row items-start justify-between gap-3 space-y-0"><div><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></div><Link href={actionHref} className="shrink-0 text-sm font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">{actionLabel}</Link></CardHeader><CardContent>{children}</CardContent></Card></section>; }
function DashboardEmpty({ title, description, href, action }: { title: string; description: string; href: string; action: string }) { return <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border p-5 text-center"><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><Link href={href} className="inline-flex min-h-11 items-center rounded-md bg-muted px-4 text-sm font-semibold hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">{action}</Link></div>; }
function MiniTrend({ current }: { current: DashboardCurrentYearSummary }) { const maximum = Math.max(1, ...current.trend.map((item) => item.completed_games_count)); const total = current.trend.reduce((sum, item) => sum + item.completed_games_count, 0); const description = current.trend.length ? `W pokazanych miesiącach ukończono łącznie ${total} gier.` : "Brak miesięcy do pokazania."; return <div className="space-y-3"><p className="text-sm text-muted-foreground">{description}</p>{current.trend.length ? <div role="img" aria-label={`Liczba ukończonych gier w ostatnich miesiącach ${current.year} roku. ${description}`} className="grid h-36 grid-flow-col auto-cols-fr items-end gap-2 overflow-hidden rounded-md border border-border bg-background/45 p-3">{current.trend.map((item) => <div key={item.month} className="flex h-full min-w-0 flex-col items-center justify-end gap-1"><span className="text-xs font-semibold tabular-nums">{item.completed_games_count}</span><span aria-hidden="true" className="w-full max-w-10 rounded-t bg-primary/75" style={{ height: `${Math.max(item.completed_games_count ? 12 : 2, item.completed_games_count / maximum * 80)}%` }} /><span className="text-[10px] uppercase text-muted-foreground">{monthNames[item.month - 1]}</span></div>)}</div> : <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Trend pojawi się po dodaniu pierwszego ukończenia.</p>}</div>; }
function Shortcut({ href, icon: Icon, label }: { href: string; icon: typeof Gamepad2; label: string }) { return <Link href={href} className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-background/45 px-3 text-sm font-semibold transition hover:border-accent/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon className="h-4 w-4 text-accent" aria-hidden="true" />{label}</Link>; }
function CompactMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-background/55 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate font-semibold">{value}</p></div>; }
function getDashboardInsight(current: DashboardCurrentYearSummary) { if (current.most_active_month) return `Najwięcej gier ukończono w ${monthLocative[current.most_active_month.month - 1]} — ${current.most_active_month.completed_games_count}.`; if (current.top_platform) return `Najczęściej wybieraną platformą w tym roku jest ${current.top_platform}.`; return null; }
function formatNumber(value: number) { return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value); }
