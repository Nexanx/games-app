"use client";

import { useEffect, useState } from "react";
import { closestCenter, DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { GameCard } from "@/components/games/GameCard";
import { api } from "@/services/api";
import type { BacklogEntry } from "@/types";

export function BacklogDragDropList({
  entries,
  onChanged
}: {
  entries: BacklogEntry[];
  onChanged: (entries?: BacklogEntry[]) => void;
}) {
  const [items, setItems] = useState(entries);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

  useEffect(() => setItems(entries), [entries]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    const reordered = await api.reorderBacklog(next.map((item) => item.id));
    onChanged(reordered);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {items.map((entry) => (
            <SortableGame
              key={entry.id}
              entry={entry}
              index={items.indexOf(entry)}
              count={items.length}
              onMove={async (direction) => {
                const oldIndex = items.indexOf(entry);
                const newIndex = direction === "up" ? oldIndex - 1 : oldIndex + 1;
                if (newIndex < 0 || newIndex >= items.length) return;
                const next = arrayMove(items, oldIndex, newIndex);
                setItems(next);
                onChanged(await api.reorderBacklog(next.map((item) => item.id)));
              }}
              onChanged={onChanged}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableGame({
  entry,
  index,
  count,
  onMove,
  onChanged
}: {
  entry: BacklogEntry;
  index: number;
  count: number;
  onMove: (direction: "up" | "down") => void;
  onChanged: (entries?: BacklogEntry[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-80" : undefined}>
      <GameCard
        entry={entry}
        dragHandleProps={{ ...attributes, ...listeners }}
        onMove={onMove}
        disableMoveUp={index === 0}
        disableMoveDown={index === count - 1}
        onDelete={async (id) => {
          if (!window.confirm("Usunąć grę z listy Do ogrania?")) return;
          await api.deleteBacklog(id);
          onChanged();
        }}
      />
    </div>
  );
}
