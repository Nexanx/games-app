import Link from "next/link";
import { CalendarDays, Clock3, Star } from "lucide-react";

import { GameCover } from "@/components/games/GameCover";
import { Card, CardContent } from "@/components/ui/card";
import { asDate, formatHours } from "@/lib/utils";
import type { CompletedGameEntry } from "@/types";

export function CompletedGameCard({ entry }: { entry: CompletedGameEntry }) {
  return (
    <Link href={`/completed-games/entry/${entry.id}`} className="block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full overflow-hidden transition hover:border-accent/70 hover:shadow-glow">
        <CardContent className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[88px_1fr] sm:gap-4 sm:p-4">
          <GameCover src={entry.game.cover_url} title={entry.game.title} className="w-full self-start" />
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold">{entry.game.title}</h3>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
              <Metric icon={CalendarDays} label="Data ukończenia" value={asDate(entry.completion_date)} />
              <Metric icon={Clock3} label="Czas gry" value={formatHours(entry.playtime_hours)} />
              <Metric icon={Star} label="Ocena" value={entry.rating == null ? "Bez oceny" : `${entry.rating}/10`} />
            </div>
            <p className="mt-3 truncate text-sm text-muted-foreground">
              {entry.platform || "Brak platformy"}
              {entry.game.genres.length ? ` · ${entry.game.genres.join(", ")}` : ""}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/60 p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}</span>
      <span className="mt-1 block truncate font-semibold">{value}</span>
    </div>
  );
}
