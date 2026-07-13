"use client";

import {
  FlaskConical,
  Gem,
  PackageOpen,
  Shield,
  Swords
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject
} from "react";
import { createPortal } from "react-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { poeSlotLabel } from "@/lib/poe";
import type { PoeEquipmentItem } from "@/types";

type RarityTheme = {
  border: string;
  cardText: string;
  header: string;
  label: string;
  title: string;
};

const RARITY_THEMES: Record<string, RarityTheme> = {
  unique: {
    border: "border-[#af6025]/75",
    cardText: "text-[#df8c4b]",
    header: "border-[#af6025] bg-[#4a2b19]",
    label: "Unikatowy",
    title: "text-[#f0a15e]"
  },
  rare: {
    border: "border-[#a38d23]/75",
    cardText: "text-[#e6d56e]",
    header: "border-[#c8b745] bg-[#48462d]",
    label: "Rzadki",
    title: "text-[#ffff77]"
  },
  magic: {
    border: "border-[#5050eb]/70",
    cardText: "text-[#9c9cff]",
    header: "border-[#6969ff] bg-[#272742]",
    label: "Magiczny",
    title: "text-[#aaaaff]"
  },
  relic: {
    border: "border-[#60c9c9]/70",
    cardText: "text-[#8be1e1]",
    header: "border-[#60c9c9] bg-[#244141]",
    label: "Reliktowy",
    title: "text-[#8be1e1]"
  },
  normal: {
    border: "border-border",
    cardText: "text-foreground",
    header: "border-[#b8b8b8] bg-[#353a42]",
    label: "Zwykły",
    title: "text-[#e8e8e8]"
  }
};

type TooltipPosition = CSSProperties & { visibility: "hidden" | "visible" };

export function PoeEquipmentGrid({ equipment }: { equipment: PoeEquipmentItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Końcowe wyposażenie</CardTitle>
        <CardDescription>
          Najedź na przedmiot, wybierz go klawiszem Tab albo dotknij na telefonie, aby zobaczyć pełne statystyki. Snapshot nie zawiera drzewka, atlasu ani przedmiotów zapasowych.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {equipment.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {equipment.map((item) => (
              <PoeEquipmentItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-5 text-center text-muted-foreground">
            <PackageOpen className="h-6 w-6" aria-hidden="true" />
            <p className="font-medium text-foreground">Brak zapisanego wyposażenia</p>
            <p className="max-w-xl text-sm">To starszy albo ręczny wpis. Wyposażenie pojawia się przy imporcie kodu PoB.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PoeEquipmentItemCard({ item }: { item: PoeEquipmentItem }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ left: 12, top: 12, visibility: "hidden", width: 0 });
  const open = hovered || focused || pinned;
  const theme = RARITY_THEMES[item.rarity ?? ""] ?? RARITY_THEMES.normal;

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const gap = 12;
    const width = Math.min(480, Math.max(0, viewportWidth - margin * 2));
    tooltip.style.width = `${width}px`;

    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let left: number;
    let top: number;

    if (anchorRect.right + gap + width <= viewportWidth - margin) {
      left = anchorRect.right + gap;
      top = anchorRect.top;
    } else if (anchorRect.left - gap - width >= margin) {
      left = anchorRect.left - gap - width;
      top = anchorRect.top;
    } else {
      left = anchorRect.left + anchorRect.width / 2 - width / 2;
      top = anchorRect.bottom + gap;
      if (top + tooltipRect.height > viewportHeight - margin) {
        top = anchorRect.top - tooltipRect.height - gap;
      }
    }

    const maxLeft = Math.max(margin, viewportWidth - width - margin);
    const maxTop = Math.max(margin, viewportHeight - tooltipRect.height - margin);
    setPosition({
      left: Math.min(Math.max(left, margin), maxLeft),
      top: Math.min(Math.max(top, margin), maxTop),
      visibility: "visible",
      width
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!pinned) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !tooltipRef.current?.contains(target)) {
        setPinned(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [pinned]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Escape") return;
    setPinned(false);
    setHovered(false);
    setFocused(false);
    event.currentTarget.blur();
  }

  return (
    <div
      className="min-w-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") setHovered(false);
      }}
    >
      <button
        ref={anchorRef}
        type="button"
        className={`flex min-h-20 w-full min-w-0 items-center gap-3 rounded-lg border bg-black/20 p-3 text-left transition hover:bg-black/35 focus-visible:ring-2 focus-visible:ring-ring ${theme.border} ${theme.cardText}`}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={pinned}
        aria-label={`Pokaż statystyki przedmiotu ${item.name}`}
        onBlur={() => setFocused(false)}
        onClick={() => setPinned((current) => !current)}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-current/35 bg-black/30">
          <EquipmentIcon slot={item.slot} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs uppercase tracking-wide text-muted-foreground">{poeSlotLabel(item.slot)}</span>
          <span className="block truncate font-semibold">{item.name}</span>
          {item.base_type && item.base_type !== item.name ? <span className="block truncate text-xs text-muted-foreground">{item.base_type}</span> : null}
        </span>
        <span className="hidden shrink-0 text-[0.65rem] uppercase tracking-wide text-muted-foreground sm:block">Najedź</span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <PoeItemTooltip tooltipRef={tooltipRef} id={tooltipId} item={item} position={position} theme={theme} />,
            document.body
          )
        : null}
    </div>
  );
}

function PoeItemTooltip({
  id,
  item,
  position,
  tooltipRef,
  theme
}: {
  id: string;
  item: PoeEquipmentItem;
  position: TooltipPosition;
  tooltipRef: RefObject<HTMLDivElement | null>;
  theme: RarityTheme;
}) {
  const lines = itemDetails(item);

  return (
    <div
      ref={tooltipRef}
      id={id}
      role="tooltip"
      className={`poe-item-tooltip pointer-events-none fixed z-[100] max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-sm border bg-[#10151d] text-center shadow-2xl ${theme.border}`}
      style={position}
    >
      <div className={`border-b px-4 py-3 ${theme.header}`}>
        <p className={`text-lg font-semibold leading-tight ${theme.title}`}>{item.name}</p>
        {item.base_type && item.base_type !== item.name ? <p className={`mt-0.5 text-base ${theme.title}`}>{item.base_type}</p> : null}
        <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-white/55">{theme.label}</p>
      </div>
      <div className="max-h-[calc(100vh-8rem)] overflow-x-hidden overflow-y-auto px-5 py-3 text-sm leading-6 text-[#c8c8c8]">
        {lines.map((line, index) =>
          isDivider(line) ? (
            <div key={`${index}-${line}`} className="my-2 h-px bg-gradient-to-r from-transparent via-[#77775b]/75 to-transparent" />
          ) : (
            <p key={`${index}-${line}`} className={`break-words ${itemLineTone(line)}`}>
              {line || "\u00a0"}
            </p>
          )
        )}
      </div>
    </div>
  );
}

function itemDetails(item: PoeEquipmentItem) {
  const lines = item.item_text.split(/\r?\n/).map((line) => line.trim());
  const selectedVariant = lines
    .map((line) => line.match(/^Selected Variant:\s*(\d+)/i)?.[1])
    .find(Boolean);

  return lines.flatMap((line) => {
    const normalized = line.toLocaleLowerCase();
    const variant = line.match(/\{variant:(\d+)\}/i)?.[1];
    const isIdentity = [item.name, item.base_type]
      .filter(Boolean)
      .some((identity) => line.localeCompare(identity!, undefined, { sensitivity: "accent" }) === 0);
    const isInternal =
      !line ||
      normalized.startsWith("rarity:") ||
      normalized.startsWith("unique id:") ||
      normalized === "new item" ||
      isIdentity ||
      /^(crafted|prefix|suffix):/i.test(line) ||
      /^variant:/i.test(line) ||
      /^selected variant:/i.test(line) ||
      /basepercentile:/i.test(line);

    if (isInternal || (variant && selectedVariant && variant !== selectedVariant)) return [];
    if (/^implicits:\s*\d+/i.test(line)) return ["--------"];

    const cleaned = line
      .replace(/\{[^}]*\}/g, "")
      .replace(/^LevelReq:\s*/i, "Wymagany poziom: ")
      .trim();
    return cleaned ? [cleaned] : [];
  });
}

function isDivider(line: string) {
  return /^-{3,}$/.test(line);
}

function itemLineTone(line: string) {
  const normalized = line.toLocaleLowerCase();
  if (normalized === "corrupted") return "font-semibold text-[#d96d6d]";
  if (normalized.includes("{crafted}")) return "text-[#b8daf1]";
  if (normalized.endsWith(":")) return "mt-1 font-medium text-[#9aa6b2]";
  return "text-[#d7dde5]";
}

function EquipmentIcon({ slot }: { slot: string }) {
  const className = "h-6 w-6";
  if (slot.startsWith("Weapon")) return <Swords className={className} aria-hidden="true" />;
  if (slot.startsWith("Flask")) return <FlaskConical className={className} aria-hidden="true" />;
  if (slot.startsWith("Ring") || slot === "Amulet" || slot.startsWith("Charm")) {
    return <Gem className={className} aria-hidden="true" />;
  }
  return <Shield className={className} aria-hidden="true" />;
}
