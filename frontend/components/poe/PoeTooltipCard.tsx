import { Clock3, Crown, Gem, Map, Shield, Sparkles, Swords } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatMinutes } from "@/lib/utils";
import type { PoeCharacter } from "@/types";

export function PoeTooltipCard({ character }: { character: PoeCharacter }) {
  const gameLabel = character.game_version === "poe1" ? "Path of Exile 1" : "Path of Exile 2";

  return (
    <article className="overflow-hidden rounded-xl border border-[#91662e]/55 bg-[linear-gradient(135deg,rgba(47,30,18,0.82),rgba(14,18,25,0.96)_58%)] shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[#91662e]/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#d8a34b]/45 bg-black/30">
            <Sparkles className="h-5 w-5 text-[#e0b15f]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8a36a]">Postać</p>
            <h1 className="truncate text-xl font-bold text-[#ffe2a4] sm:text-2xl">{character.name}</h1>
            {character.build_name ? <p className="truncate text-sm text-[#c9b184]">{character.build_name}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="border-[#d8a34b]/40 bg-[#d8a34b]/10 text-[#f2cc83]">{gameLabel}</Badge>
          <Badge className="border-border bg-background/50 text-foreground">{character.league?.name ?? "Bez ligi"}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-[#91662e]/25 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <SummaryItem icon={Gem} label="Poziom" value={String(character.level)} />
        <SummaryItem icon={Shield} label="Klasa" value={character.character_class ?? "Brak"} />
        <SummaryItem icon={Crown} label="Ascendancy" value={character.ascendancy ?? "Brak"} />
        <SummaryItem icon={Map} label="Liga" value={character.league?.name ?? "Bez ligi"} />
        <SummaryItem icon={Swords} label="Główna umiejętność" value={character.main_skill ?? "Brak"} />
        <SummaryItem icon={Sparkles} label="Tryb" value={character.mode ?? "Brak"} />
        <SummaryItem icon={Clock3} label="Czas gry" value={formatMinutes(character.playtime_minutes)} />
      </div>
    </article>
  );
}

function SummaryItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 bg-background/90 px-3 py-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[#d8a34b]" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-foreground" title={value}>{value}</p>
    </div>
  );
}
