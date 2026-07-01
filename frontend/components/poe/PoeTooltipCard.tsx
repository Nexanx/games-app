import { CircleDollarSign, Clock3, Gem, ScrollText, Shield, Sparkles, Swords } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatMinutes } from "@/lib/utils";
import type { PoeCharacter, PoeCurrencyStat } from "@/types";

export function PoeTooltipCard({ character, stats }: { character: PoeCharacter; stats: PoeCurrencyStat[] }) {
  const primaryStats = stats.slice(0, 12);

  return (
    <article className="poe-tooltip-frame w-full overflow-hidden rounded-lg p-4 text-[#f4dfb3] sm:p-5">
      <div className="text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-[#d8a34b]/60 bg-black/40">
          <Sparkles className="h-5 w-5 text-[#e0b15f]" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold leading-tight text-[#ffe2a4] sm:text-2xl">{character.name}</h2>
        <p className="mt-1 text-sm text-[#c8a36a]">
          {character.league?.name ?? "Brak ligi"} · {character.game_version === "poe1" ? "Path of Exile 1" : "Path of Exile 2"}
        </p>
      </div>

      <div className="poe-divider my-4" />

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Rune icon={Shield} label="Klasa" value={`${character.character_class ?? "-"} ${character.ascendancy ?? ""}`.trim()} />
        <Rune icon={Gem} label="Level" value={String(character.level)} />
        <Rune icon={Clock3} label="Czas" value={formatMinutes(character.playtime_minutes)} />
        <Rune icon={Swords} label="Status" value={character.status} />
      </div>

      <div className="poe-divider my-4" />

      <div>
        <div className="mb-3 flex items-center justify-center gap-2 text-sm uppercase tracking-[0.18em] text-[#d8a34b]">
          <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
          Statystyki dropów
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {primaryStats.map((stat) => (
            <div key={stat.id} className="flex min-h-12 items-center gap-3 rounded-md border border-[#91662e]/45 bg-black/28 px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#d8a34b]/35 bg-[#21160e]">
                {stat.icon_url ? <img src={stat.icon_url} alt="" className="h-6 w-6 object-contain" /> : <Gem className="h-4 w-4 text-[#e0b15f]" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[#f4dfb3]">{stat.name}</p>
                <p className="truncate text-xs text-[#a88655]">{stat.category}</p>
              </div>
              <span className="font-semibold text-[#ffd37a]">{stat.value}</span>
            </div>
          ))}
          {!primaryStats.length ? <p className="rounded-md bg-black/25 p-3 text-center text-sm text-[#a88655]">Brak statystyk dropów.</p> : null}
        </div>
      </div>

      {character.notes ? (
        <>
          <div className="poe-divider my-4" />
          <div className="flex gap-3 text-sm leading-6 text-[#d9c292]">
            <ScrollText className="mt-1 h-4 w-4 shrink-0 text-[#d8a34b]" aria-hidden="true" />
            <p>{character.notes}</p>
          </div>
        </>
      ) : null}
    </article>
  );
}

function Rune({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#91662e]/45 bg-black/24 p-3">
      <div className="flex items-center gap-2 text-xs text-[#a88655]">
        <Icon className="h-4 w-4 text-[#d8a34b]" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 truncate font-semibold text-[#f4dfb3]">{value || "-"}</p>
    </div>
  );
}
