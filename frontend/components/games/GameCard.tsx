"use client";

import Link from "next/link";
import { Check, Clock, ExternalLink, GripVertical, Pencil, Play, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/games/StatusBadge";
import { formatMinutes } from "@/lib/utils";
import type { BacklogGame } from "@/types";

export function GameCard({
  entry,
  dragHandleProps,
  onMark,
  onDelete
}: {
  entry: BacklogGame;
  dragHandleProps?: Record<string, unknown>;
  onMark?: (id: number, action: "mark-playing" | "mark-completed" | "mark-abandoned") => void;
  onDelete?: (id: number) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-4 p-3 sm:grid-cols-[112px_1fr] sm:p-4">
        <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted sm:aspect-[3/4]">
          {entry.game.cover_url ? (
            <img src={entry.game.cover_url} alt={entry.game.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 via-emerald-950 to-amber-950 text-xs text-muted-foreground">
              Brak okładki
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-2">
            {dragHandleProps ? (
              <button
                className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted sm:flex"
                aria-label="Przeciągnij grę"
                {...dragHandleProps}
              >
                <GripVertical className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/games/${entry.id}`} className="truncate text-lg font-semibold hover:text-accent">
                  {entry.game.title}
                </Link>
                <StatusBadge status={entry.status} />
              </div>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{entry.game.description ?? "Brak opisu."}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Metric label="Czas" value={formatMinutes(entry.playtime_minutes)} />
            <Metric label="Ukończenie" value={`${entry.completion_percent}%`} />
            <Metric label="Ocena" value={entry.rating ? `${entry.rating}/10` : "-"} />
            <Metric label="Źródło" value={entry.game.external_source} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onMark?.(entry.id, "mark-playing")} title="Oznacz jako w trakcie">
              <Play className="h-4 w-4" aria-hidden="true" />
              W trakcie
            </Button>
            <Button variant="accent" onClick={() => onMark?.(entry.id, "mark-completed")} title="Oznacz jako ograna">
              <Check className="h-4 w-4" aria-hidden="true" />
              Ograna
            </Button>
            <Button variant="secondary" onClick={() => onMark?.(entry.id, "mark-abandoned")} title="Oznacz jako porzucona">
              <X className="h-4 w-4" aria-hidden="true" />
              Porzucona
            </Button>
            <Link href={`/games/${entry.id}`}>
              <Button variant="ghost" title="Edytuj">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edytuj
              </Button>
            </Link>
            {entry.game.external_url ? (
              <a href={entry.game.external_url} target="_blank" rel="noreferrer">
                <Button variant="ghost" title="Otwórz link zewnętrzny">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </Button>
              </a>
            ) : null}
            <Button variant="danger" onClick={() => onDelete?.(entry.id)} title="Usuń z backlogu">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold">{value}</p>
    </div>
  );
}

