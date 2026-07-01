"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { GameCard } from "@/components/games/GameCard";
import { BacklogDragDropList } from "@/components/games/BacklogDragDropList";
import { api } from "@/services/api";
import type { BacklogGame } from "@/types";

export function BacklogList({
  entries,
  sortable,
  onChanged
}: {
  entries: BacklogGame[];
  sortable: boolean;
  onChanged: (entries?: BacklogGame[]) => void;
}) {
  if (!entries.length) {
    return <EmptyState title="Brak gier w tym widoku" description="Zmień filtr albo dodaj nową grę." />;
  }

  if (sortable) {
    return <BacklogDragDropList entries={entries} onChanged={onChanged} />;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <GameCard
          key={entry.id}
          entry={entry}
          onMark={async (id, action) => {
            await api.markBacklog(id, action);
            onChanged();
          }}
          onDelete={async (id) => {
            await api.deleteBacklog(id);
            onChanged();
          }}
        />
      ))}
    </div>
  );
}

