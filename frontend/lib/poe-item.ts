export type PoeItemModifierTag = "crafted" | "fractured" | "enchant";

export type PoeItemModifier = {
  text: string;
  tags: PoeItemModifierTag[];
};

export type PoeItemDetails = {
  properties: string[];
  requirements: string[];
  implicits: PoeItemModifier[];
  explicits: PoeItemModifier[];
  statuses: string[];
};

type PoeItemTextSource = {
  name: string;
  base_type?: string | null;
  item_text: string;
};

const REQUIREMENT_LABELS: Record<string, string> = {
  levelreq: "Wymagany poziom",
  strreq: "Wymagana siła",
  dexreq: "Wymagana zręczność",
  intreq: "Wymagana inteligencja"
};

const STATUS_LINES = new Set([
  "corrupted",
  "mirrored",
  "unidentified",
  "split",
  "synthesised item"
]);

const MODIFIER_TAGS = new Set<PoeItemModifierTag>(["crafted", "fractured", "enchant"]);

export function parsePoeItemText(item: PoeItemTextSource): PoeItemDetails {
  const details: PoeItemDetails = {
    properties: [],
    requirements: [],
    implicits: [],
    explicits: [],
    statuses: []
  };
  const lines = item.item_text.split(/\r?\n/).map((line) => line.trim());
  const selectedVariant = lines
    .map((line) => line.match(/^Selected Variant:\s*(\d+)/i)?.[1])
    .find(Boolean);
  const identities = [item.name, item.base_type]
    .filter((identity): identity is string => Boolean(identity))
    .map(normalize);
  let implicitModifiersRemaining: number | null = null;

  for (const rawLine of lines) {
    if (!rawLine || /^-{3,}$/.test(rawLine)) continue;

    const variant = rawLine.match(/\{variant:(\d+)\}/i)?.[1];
    if (variant && selectedVariant && variant !== selectedVariant) continue;

    const normalizedRawLine = normalize(rawLine);
    if (
      normalizedRawLine.startsWith("rarity:") ||
      normalizedRawLine.startsWith("unique id:") ||
      normalizedRawLine === "new item" ||
      identities.includes(normalizedRawLine) ||
      /^(crafted|prefix|suffix):/i.test(rawLine) ||
      /^variant:/i.test(rawLine) ||
      /^selected variant:/i.test(rawLine) ||
      /basepercentile:/i.test(rawLine)
    ) {
      continue;
    }

    const implicitMarker = rawLine.match(/^Implicits:\s*(\d+)/i);
    if (implicitMarker) {
      implicitModifiersRemaining = Number.parseInt(implicitMarker[1], 10);
      continue;
    }

    const tags = modifierTags(rawLine);
    const cleaned = rawLine.replace(/\{[^}]*\}/g, "").trim();
    if (!cleaned) continue;

    const requirement = cleaned.match(/^(LevelReq|StrReq|DexReq|IntReq):\s*(.+)$/i);
    if (requirement) {
      details.requirements.push(`${REQUIREMENT_LABELS[normalize(requirement[1])]}: ${requirement[2]}`);
      continue;
    }

    if (STATUS_LINES.has(normalize(cleaned))) {
      details.statuses.push(statusLabel(cleaned));
      continue;
    }

    if (implicitModifiersRemaining === null) {
      details.properties.push(cleaned);
      continue;
    }

    const modifier = { text: cleaned, tags };
    if (implicitModifiersRemaining > 0) {
      details.implicits.push(modifier);
      implicitModifiersRemaining -= 1;
    } else {
      details.explicits.push(modifier);
    }
  }

  return details;
}

function modifierTags(line: string): PoeItemModifierTag[] {
  const tags = Array.from(line.matchAll(/\{([^}:]+)(?::[^}]*)?\}/g), (match) => normalize(match[1]));
  return Array.from(new Set(tags.filter((tag): tag is PoeItemModifierTag => MODIFIER_TAGS.has(tag as PoeItemModifierTag))));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    corrupted: "Corrupted",
    mirrored: "Mirrored",
    unidentified: "Niezidentyfikowany",
    split: "Split",
    "synthesised item": "Synthesised Item"
  };
  return labels[normalize(status)] ?? status;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}
