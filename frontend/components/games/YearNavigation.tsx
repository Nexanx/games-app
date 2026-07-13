import React from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { getYearNavigation } from "../../lib/completed-games";
import { cn } from "../../lib/utils";
import type { CompletedGamesYear } from "../../types";

type Props = {
  year: number;
  years: CompletedGamesYear[];
  hrefForYear: (year: number) => string;
  ariaLabel: string;
  currentCalendarYear?: number;
};

const linkClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-muted px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring";

export function YearNavigation({ year, years, hrefForYear, ariaLabel, currentCalendarYear }: Props) {
  const availableYears = withEmptyCurrentYear(years, currentCalendarYear);
  const navigation = getYearNavigation(year, availableYears);
  const selected = availableYears.find((item) => item.year === year);

  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap items-center gap-2">
      {navigation.olderYear ? (
        <Link href={hrefForYear(navigation.olderYear)} className={linkClass} aria-label={`Przejdź do ${navigation.olderYear} roku`}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />{navigation.olderYear}
        </Link>
      ) : null}
      <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-primary/35 bg-primary/10 px-3 py-2 text-sm" aria-current="page">
        <strong>{year}</strong>
        <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs text-muted-foreground">{selected ? gameCountLabel(selected.completed_games_count) : "brak danych"}</span>
      </span>
      {navigation.newerYear ? (
        <Link href={hrefForYear(navigation.newerYear)} className={linkClass} aria-label={`Przejdź do ${navigation.newerYear} roku`}>
          {navigation.newerYear}<ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
      <details className="group relative">
        <summary className={cn(linkClass, "cursor-pointer list-none text-muted-foreground marker:hidden")}>
          Inne lata<ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="absolute left-0 z-30 mt-2 w-56 rounded-lg border border-border bg-card p-2 shadow-xl sm:left-auto sm:right-0">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dostępne lata</p>
          <ul className="space-y-1">
            {availableYears.map((item) => (
              <li key={item.year}>
                <Link
                  href={hrefForYear(item.year)}
                  aria-current={item.year === year ? "page" : undefined}
                  className={cn("flex min-h-10 items-center justify-between rounded-md px-2 text-sm transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring", item.year === year && "bg-primary/10 text-primary")}
                >
                  <strong>{item.year}</strong><span className="text-xs text-muted-foreground">{gameCountLabel(item.completed_games_count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </nav>
  );
}

function withEmptyCurrentYear(years: CompletedGamesYear[], currentCalendarYear?: number) {
  const unique = new Map(years.map((item) => [item.year, item]));
  if (currentCalendarYear && !unique.has(currentCalendarYear)) {
    unique.set(currentCalendarYear, { year: currentCalendarYear, completed_games_count: 0 });
  }
  return Array.from(unique.values()).sort((left, right) => right.year - left.year);
}

function gameCountLabel(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  const noun = count === 1 ? "gra" : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? "gry" : "gier";
  return `${count} ${noun}`;
}
