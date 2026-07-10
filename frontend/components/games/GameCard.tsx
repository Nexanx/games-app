"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Check, ExternalLink, GripVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BacklogEntry } from "@/types";

export function GameCard({
  entry,
  dragHandleProps,
  onDelete,
  onMove,
  disableMoveUp,
  disableMoveDown
}: {
  entry: BacklogEntry;
  dragHandleProps?: Record<string, unknown>;
  onDelete?: (id: number) => void;
  onMove?: (direction: "up" | "down") => void;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
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
                className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label={`Przeciągnij pozycję ${entry.game.title}`}
                {...dragHandleProps}
              >
                <GripVertical className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <Link href={`/backlog/${entry.id}`} className="truncate text-lg font-semibold hover:text-accent">
                {entry.game.title}
              </Link>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {entry.note || entry.game.description || "Brak notatki."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <Metric label="Kolejność" value={String(entry.position + 1)} />
            <Metric label="Platforma" value={entry.preferred_platform || entry.game.platforms[0] || "-"} />
            <Metric label="Gatunek" value={entry.game.genres.join(", ") || "-"} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/completed-games/new?backlog=${entry.id}`}>
              <Button variant="accent" title="Utwórz wpis ukończenia">
                <Check className="h-4 w-4" aria-hidden="true" />
                Zapisz ukończenie
              </Button>
            </Link>
            <Link href={`/backlog/${entry.id}`}>
              <Button variant="ghost" title="Szczegóły i edycja">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Szczegóły
              </Button>
            </Link>
            {onMove ? (
              <>
                <Button variant="ghost" onClick={() => onMove("up")} disabled={disableMoveUp} aria-label="Przesuń w górę">
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="ghost" onClick={() => onMove("down")} disabled={disableMoveDown} aria-label="Przesuń w dół">
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </>
            ) : null}
            {entry.game.external_url ? (
              <a href={entry.game.external_url} target="_blank" rel="noreferrer">
                <Button variant="ghost" title="Otwórz link zewnętrzny">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </Button>
              </a>
            ) : null}
            <Button variant="danger" onClick={() => onDelete?.(entry.id)} title="Usuń z listy Do ogrania">
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
