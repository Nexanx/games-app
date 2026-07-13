export const POE_CHARACTER_STATUS_LABELS: Record<string, string> = {
  active: "Aktywna",
  ended: "Zakończona",
  rip: "Rip",
  test: "Testowa",
  deleted: "Usunięta"
};

export const POE_STAT_CATEGORIES = [
  { value: "currency", label: "Waluta" },
  { value: "maps", label: "Mapy" },
  { value: "fragments", label: "Fragmenty" },
  { value: "scarabs", label: "Skarabeusze" },
  { value: "crafting", label: "Crafting" },
  { value: "league mechanic", label: "Mechanika ligowa" },
  { value: "cards", label: "Karty" },
  { value: "uniques", label: "Unikaty" },
  { value: "custom", label: "Własna" }
] as const;

export function poeCharacterStatusLabel(status: string) {
  return POE_CHARACTER_STATUS_LABELS[status] ?? status;
}

export function poeCategoryLabel(category: string) {
  return POE_STAT_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

export function isAbortError(reason: unknown) {
  return reason instanceof DOMException && reason.name === "AbortError";
}

export function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol) ? value : null;
  } catch {
    return null;
  }
}

const POE_SLOT_LABELS: Record<string, string> = {
  "Weapon 1": "Broń 1",
  "Weapon 2": "Broń 2",
  Helmet: "Hełm",
  "Body Armour": "Pancerz",
  Gloves: "Rękawice",
  Boots: "Buty",
  Amulet: "Amulet",
  "Ring 1": "Pierścień 1",
  "Ring 2": "Pierścień 2",
  Belt: "Pas",
  "Flask 1": "Flaska 1",
  "Flask 2": "Flaska 2",
  "Flask 3": "Flaska 3",
  "Flask 4": "Flaska 4",
  "Flask 5": "Flaska 5",
  "Charm 1": "Charm 1",
  "Charm 2": "Charm 2",
  "Charm 3": "Charm 3"
};

export function poeSlotLabel(slot: string) {
  return POE_SLOT_LABELS[slot] ?? slot;
}

export function poeSnapshotSourceLabel(source: string) {
  if (source === "poe_ninja_pob") return "Kod PoB z poe.ninja";
  if (source === "pob") return "Kod PoB";
  return "Wpis ręczny";
}
