"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { GameCard } from "@/components/games/GameCard";
import { BacklogDragDropList } from "@/components/games/BacklogDragDropList";
import { api } from "@/services/api";
import type { BacklogEntry } from "@/types";

export function BacklogList({
  entries,
  sortable,
  onChanged
}: {
  entries: BacklogEntry[];
  sortable: boolean;
  onChanged: (entries?: BacklogEntry[]) => void;
}) {
  if (!entries.length) {
    return <EmptyState title="Lista Do ogrania jest pusta" description="Wyszukaj grę albo dodaj ją ręcznie." />;
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
          onDelete={async (id) => {
            if (!window.confirm("Usunąć grę z listy Do ogrania?")) return;
            await api.deleteBacklog(id);
            onChanged();
          }}
        />
      ))}
    </div>
  );
}
