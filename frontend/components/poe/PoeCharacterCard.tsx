"use client";

import Link from "next/link";
import { Gem, Skull, Swords } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatMinutes } from "@/lib/utils";
import type { PoeCharacter } from "@/types";

export function PoeCharacterCard({ character }: { character: PoeCharacter }) {
  return (
    <Link href={`/poe/characters/${character.id}`} className="block">
      <Card className="transition hover:border-accent/70">
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
            {character.status === "rip" ? <Skull className="h-5 w-5 text-rose-300" aria-hidden="true" /> : <Gem className="h-5 w-5 text-accent" aria-hidden="true" />}
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Metric label="Level" value={String(character.level)} />
            <Metric label="Czas" value={formatMinutes(character.playtime_minutes)} />
            <Metric label="Status" value={character.status} />
          </div>
          <div className="flex items-center gap-2 rounded-md bg-background/60 p-3 text-sm text-muted-foreground">
            <Swords className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{character.build_name || character.main_skill || "Build bez nazwy"}</span>
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

