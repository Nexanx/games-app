"use client";

import { ArrowDown, ArrowUp, Gem, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PoeCurrencyStat } from "@/types";

export function PoeCurrencyStatItem({
  stat,
  onDelete,
  onMoveUp,
  onMoveDown
}: {
  stat: PoeCurrencyStat;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-card/80 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
        {stat.icon_url ? <img src={stat.icon_url} alt="" className="h-7 w-7 object-contain" /> : <Gem className="h-5 w-5 text-accent" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold">{stat.name}</p>
          <span className="shrink-0 text-sm font-bold text-accent">{stat.value}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{stat.category}{stat.notes ? ` · ${stat.notes}` : ""}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" className="h-10 w-10 px-0" onClick={onMoveUp} title="Przesuń wyżej">
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" className="h-10 w-10 px-0" onClick={onMoveDown} title="Przesuń niżej">
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button variant="danger" className="h-10 w-10 px-0" onClick={onDelete} title="Usuń statystykę">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

