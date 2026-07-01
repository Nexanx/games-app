"use client";

import { Select } from "@/components/ui/select";
import type { PoeLeague } from "@/types";

export function LeagueSelector({
  leagues,
  value,
  onChange,
  includeAll = false
}: {
  leagues: PoeLeague[];
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
}) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      {includeAll ? <option value="">Wszystkie ligi</option> : <option value="">Bez ligi</option>}
      {leagues.map((league) => (
        <option key={league.id} value={league.id}>
          {league.name} · {league.game_version}
        </option>
      ))}
    </Select>
  );
}

