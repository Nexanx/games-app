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
import { parsePoeItemText, type PoeItemModifier, type PoeItemModifierTag } from "@/lib/poe-item";
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

const CORE_SLOT_ORDER = [
  "Weapon 1",
  "Helmet",
  "Amulet",
  "Weapon 2",
  "Ring 1",
  "Body Armour",
  "Ring 2",
  "Gloves",
  "Belt",
  "Boots"
] as const;

const CORE_SLOT_PLACEMENT: Record<(typeof CORE_SLOT_ORDER)[number], string> = {
  "Weapon 1": "md:col-start-1 md:row-start-2 md:row-span-4",
  Helmet: "md:col-start-3 md:row-start-1",
  Amulet: "md:col-start-4 md:row-start-2",
  "Weapon 2": "md:col-start-5 md:row-start-2 md:row-span-4",
  "Ring 1": "md:col-start-2 md:row-start-3",
  "Body Armour": "md:col-start-3 md:row-start-2 md:row-span-4",
  "Ring 2": "md:col-start-4 md:row-start-3",
  Gloves: "md:col-start-2 md:row-start-5 md:row-span-2",
  Belt: "md:col-start-3 md:row-start-6",
  Boots: "md:col-start-4 md:row-start-5 md:row-span-2"
};

export function PoeEquipmentGrid({ equipment }: { equipment: PoeEquipmentItem[] }) {
  const bySlot = new Map(equipment.map((item) => [item.slot, item]));
  const coreItems = CORE_SLOT_ORDER.flatMap((slot) => {
    const item = bySlot.get(slot);
    return item ? [{ item, placement: CORE_SLOT_PLACEMENT[slot] }] : [];
  });
  const flaskItems = equipment.filter((item) => item.slot.startsWith("Flask "));
  const charmItems = equipment.filter((item) => item.slot.startsWith("Charm "));
  const knownSlots = new Set([...CORE_SLOT_ORDER, ...flaskItems.map((item) => item.slot), ...charmItems.map((item) => item.slot)]);
  const otherItems = equipment.filter((item) => !knownSlots.has(item.slot));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ekwipunek</CardTitle>
        <CardDescription>
          Sloty są ułożone jak na ekranie postaci. Najedź, użyj klawisza Tab albo dotknij przedmiotu, aby zobaczyć pełne statystyki.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {equipment.length ? (
          <div className="space-y-5">
            {coreItems.length ? (
              <div className="overflow-x-auto rounded-xl border border-border/70 bg-[radial-gradient(circle_at_center,rgba(100,116,139,0.12),transparent_64%)] p-3 md:p-5">
                <div className="grid grid-cols-2 gap-3 md:mx-auto md:w-fit md:grid-cols-[9rem_5.5rem_9rem_5.5rem_9rem] md:grid-rows-[repeat(6,4.5rem)] md:gap-2">
                  {coreItems.map(({ item, placement }) => (
                    <PoeEquipmentItemCard key={item.id} item={item} className={placement} paperDoll />
                  ))}
                </div>
              </div>
            ) : null}
            {flaskItems.length ? (
              <EquipmentGroup title="Flaszki" items={flaskItems} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" compact />
            ) : null}
            {charmItems.length ? (
              <EquipmentGroup title="Charmy" items={charmItems} columns="sm:grid-cols-3" />
            ) : null}
            {otherItems.length ? (
              <EquipmentGroup title="Pozostałe sloty" items={otherItems} columns="sm:grid-cols-2 lg:grid-cols-3" />
            ) : null}
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

function EquipmentGroup({ title, items, columns, compact = false }: { title: string; items: PoeEquipmentItem[]; columns: string; compact?: boolean }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
      <div className={`grid gap-3 ${compact ? "max-w-3xl" : ""} ${columns}`}>
        {items.map((item) => <PoeEquipmentItemCard key={item.id} item={item} compact={compact} />)}
      </div>
    </section>
  );
}

function PoeEquipmentItemCard({ item, className = "", paperDoll = false, compact = false }: { item: PoeEquipmentItem; className?: string; paperDoll?: boolean; compact?: boolean }) {
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
      className={`min-w-0 ${className}`}
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
        className={`flex min-h-20 w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg border bg-black/20 p-3 text-left transition hover:bg-black/35 focus-visible:ring-2 focus-visible:ring-ring ${paperDoll ? "md:h-full md:min-h-0 md:flex-col md:justify-center md:gap-1.5 md:p-2 md:text-center" : ""} ${compact ? "p-2" : ""} ${theme.border} ${theme.cardText}`}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={pinned}
        aria-label={`Pokaż statystyki przedmiotu ${item.name}`}
        onBlur={() => setFocused(false)}
        onClick={() => setPinned((current) => !current)}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
      >
        <span className={`flex shrink-0 items-center justify-center rounded-md border border-current/35 bg-black/30 ${paperDoll ? "h-10 w-10 md:h-7 md:w-7" : compact ? "h-10 w-10" : "h-12 w-12"}`}>
          <EquipmentIcon slot={item.slot} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block uppercase tracking-wide text-muted-foreground ${paperDoll ? "text-[0.65rem]" : "text-xs"}`}>{poeSlotLabel(item.slot)}</span>
          <span className={`block truncate font-semibold ${paperDoll ? "text-sm" : ""}`}>{item.name}</span>
          {item.base_type && item.base_type !== item.name ? <span className={`truncate text-xs text-muted-foreground ${paperDoll ? "block md:hidden" : "block"}`}>{item.base_type}</span> : null}
        </span>
        {!paperDoll ? <span className="hidden shrink-0 text-[0.65rem] uppercase tracking-wide text-muted-foreground sm:block">Najedź</span> : null}
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
  const details = parsePoeItemText(item);

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
        <PoeItemTextSection title="Właściwości" lines={details.properties} />
        <PoeItemTextSection title="Wymagania" lines={details.requirements} />
        <PoeItemModifierSection title="Modyfikatory implicit" modifiers={details.implicits} kind="implicit" />
        <PoeItemModifierSection title="Modyfikatory explicit" modifiers={details.explicits} kind="explicit" />
        <PoeItemTextSection title="Stan przedmiotu" lines={details.statuses} status />
      </div>
    </div>
  );
}

function PoeItemTextSection({ title, lines, status = false }: { title: string; lines: string[]; status?: boolean }) {
  if (!lines.length) return null;

  return (
    <section className="border-t border-[#77775b]/45 py-2 first:border-t-0 first:pt-0">
      <h4 className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#a7aa8b]">{title}</h4>
      {lines.map((line, index) => (
        <p key={`${title}-${index}-${line}`} className={`break-words ${status && normalizeItemLine(line) === "corrupted" ? "font-semibold text-[#d96d6d]" : "text-[#d7dde5]"}`}>
          {line}
        </p>
      ))}
    </section>
  );
}

function PoeItemModifierSection({
  title,
  modifiers,
  kind
}: {
  title: string;
  modifiers: PoeItemModifier[];
  kind: "implicit" | "explicit";
}) {
  if (!modifiers.length) return null;

  return (
    <section className="border-t border-[#77775b]/45 py-2 first:border-t-0 first:pt-0">
      <h4 className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#a7aa8b]">{title}</h4>
      <div className="space-y-1">
        {modifiers.map((modifier, index) => (
          <div key={`${index}-${modifier.text}`} className={`break-words leading-5 ${modifierTone(modifier, kind)}`}>
            <span>{modifier.text}</span>
            {modifier.tags.length ? (
              <span className="ml-1.5 inline-flex flex-wrap justify-center gap-1 align-middle">
                {modifier.tags.map((tag) => (
                  <span key={tag} className={`rounded-sm border px-1 py-0.5 text-[0.58rem] font-semibold uppercase leading-none tracking-wide ${modifierTagTone(tag)}`}>
                    {modifierTagLabel(tag)}
                  </span>
                ))}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function modifierTone(modifier: PoeItemModifier, kind: "implicit" | "explicit") {
  if (modifier.tags.includes("fractured")) return "text-[#d8b56d]";
  if (modifier.tags.includes("crafted")) return "text-[#b8daf1]";
  if (modifier.tags.includes("enchant")) return "text-[#b6a7e8]";
  return kind === "implicit" ? "text-[#9fc4ef]" : "text-[#d7dde5]";
}

function modifierTagLabel(tag: PoeItemModifierTag) {
  const labels: Record<PoeItemModifierTag, string> = {
    crafted: "Craftowany",
    fractured: "Fractured",
    enchant: "Enchant"
  };
  return labels[tag];
}

function modifierTagTone(tag: PoeItemModifierTag) {
  const tones: Record<PoeItemModifierTag, string> = {
    crafted: "border-[#7ca6c4]/60 bg-[#41657d]/25 text-[#b8daf1]",
    fractured: "border-[#b58b42]/65 bg-[#6b5123]/25 text-[#e4bd74]",
    enchant: "border-[#8072ad]/60 bg-[#5c4d83]/25 text-[#c2b5eb]"
  };
  return tones[tag];
}

function normalizeItemLine(line: string) {
  return line.trim().toLocaleLowerCase();
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
