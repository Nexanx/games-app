"use client";

import Link from "next/link";
import { Gem } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatMinutes } from "@/lib/utils";
import type { PoeCharacter } from "@/types";

export function PoeCharacterCard({ character }: { character: PoeCharacter }) {
  return (
    <Link
      href={`/poe/characters/${character.id}`}
      className="block min-w-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="min-w-0 transition hover:border-accent/70">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-semibold">{character.name}</h3>
                <Badge className="border-accent/40 bg-accent/10 text-accent">{character.game_version.toUpperCase()}</Badge>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {character.character_class ?? "Klasa"} {character.ascendancy ? `· ${character.ascendancy}` : ""}
              </p>
            </div>
            <Gem className="h-5 w-5 text-accent" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Metric label="Level" value={String(character.level)} />
            <Metric label="Czas" value={formatMinutes(character.playtime_minutes)} />
            <Metric label="Liga" value={character.league?.name ?? "Bez ligi"} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-muted p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate font-semibold">{value}</p>
    </div>
  );
}
