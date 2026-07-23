import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { poeCategoryLabel, safeHttpUrl } from "../lib/poe";

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Path of Exile UI", () => {
  it("uses Polish labels and keyboard focus in the character list", () => {
    const card = readProjectFile("components/poe/PoeCharacterCard.tsx");

    expect(card).toContain('label="Liga"');
    expect(card).toContain("block min-w-0 rounded-lg");
    expect(card).toContain("focus-visible:ring-2");
    expect(card).toContain("`/poe/characters/${character.id}`");
    expect(card).not.toContain("Build bez nazwy");
  });

  it("keeps the themed summary readable and exposes the same data as text", () => {
    const tooltip = readProjectFile("components/poe/PoeTooltipCard.tsx");

    expect(tooltip).toContain("character.name");
    expect(tooltip).toContain("character.league?.name");
    expect(tooltip).toContain("character.main_skill");
    expect(tooltip).toContain("character.ascendancy");
    expect(tooltip).not.toContain("character.status");
  });

  it("disables unavailable reorder actions and gives icon buttons accessible names", () => {
    const item = readProjectFile("components/poe/PoeCurrencyStatItem.tsx");

    expect(item).toContain("disabled={!canMoveUp}");
    expect(item).toContain("disabled={!canMoveDown}");
    expect(item).toContain("aria-label={`Przesuń ${stat.name} wyżej`}");
    expect(item).toContain("aria-label={`Usuń statystykę ${stat.name}`}");
  });

  it("keeps stable stored values while translating known labels", () => {
    expect(poeCategoryLabel("league mechanic")).toBe("Mechanika ligowa");
    expect(safeHttpUrl("https://poe.ninja/builds/test")).toBe("https://poe.ninja/builds/test");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
  });

  it("loads league options independently from filtered characters and aborts stale requests", () => {
    const page = readProjectFile("app/poe/page.tsx");
    const characterLoader = page.slice(page.indexOf("const loadCharacters"), page.indexOf("const refreshLeagues"));

    expect(characterLoader).toContain("api.listCharacters");
    expect(characterLoader).not.toContain("api.listLeagues");
    expect(page).not.toContain("syncPoeLeagues");
    expect(page).not.toContain("Status postaci");
    expect(page).toContain('id="poe-league-start-date"');
    expect(page).toContain("start_date: form.start_date");
    expect(page).toContain("new AbortController()");
  });

  it("keeps edit errors inside the detail view instead of replacing the whole page", () => {
    const details = readProjectFile("app/poe/characters/[id]/page.tsx");

    expect(details).toContain("setActionMessage");
    expect(details).toContain("Zmiany postaci zostały zapisane");
    expect(details).toContain("Edytuj postać");
    expect(details).toContain("setDraft({ ...character })");
    expect(details).toContain("setDraft(null)");
    expect(details).toContain("window.confirm");
    expect(details).not.toContain("setError(");
  });

  it("imports a final snapshot from a user-provided PoB code without scraping poe.ninja", () => {
    const form = readProjectFile("components/poe/PoeCharacterForm.tsx");
    const api = readProjectFile("services/api.ts");

    expect(form).toContain("Copy PoB code");
    expect(form).toContain("api.previewPob(pobCode)");
    expect(form).toContain("api.importPobCharacter");
    expect(form).toContain('type="button"');
    expect(api).toContain('"/poe/pob/preview"');
    expect(api).toContain('"/poe/characters/import-pob"');
    expect(api).not.toContain("import-from-ninja");
  });

  it("shows responsive final equipment details on hover, focus and tap", () => {
    const equipment = readProjectFile("components/poe/PoeEquipmentGrid.tsx");
    const itemParser = readProjectFile("lib/poe-item.ts");
    const details = readProjectFile("app/poe/characters/[id]/page.tsx");

    expect(equipment).toContain("CORE_SLOT_PLACEMENT");
    expect(equipment).toContain("md:grid-cols-[9rem_5.5rem_9rem_5.5rem_9rem]");
    expect(equipment).toContain('key={`${title}-${index}-${line}`}');
    expect(equipment).toContain("createPortal");
    expect(equipment).toContain('role="tooltip"');
    expect(equipment).toContain("onMouseEnter={() => setHovered(true)}");
    expect(equipment).toContain('event.pointerType !== "touch"');
    expect(equipment).toContain("onFocus={() => setFocused(true)}");
    expect(equipment).toContain("onClick={() => setPinned");
    expect(equipment).toContain('type="button"');
    expect(equipment).toContain('event.key !== "Escape"');
    expect(equipment).toContain("parsePoeItemText(item)");
    expect(equipment).toContain('title="Modyfikatory implicit"');
    expect(equipment).toContain('title="Modyfikatory explicit"');
    expect(equipment).toContain('crafted: "Craftowany"');
    expect(equipment).toContain('fractured: "Fractured"');
    expect(itemParser).toContain('normalizedRawLine.startsWith("unique id:")');
    expect(itemParser).toContain("implicitModifiersRemaining");
    expect(equipment).toContain("overflow-x-hidden");
    expect(details).toContain("api.listPoeEquipment(id, signal)");
    expect(details).toContain("<PoeEquipmentGrid equipment={equipment} />");
  });

  it("exposes league and drop editing without deleting related character data", () => {
    const leagueManager = readProjectFile("components/poe/PoeLeagueManager.tsx");
    const statItem = readProjectFile("components/poe/PoeCurrencyStatItem.tsx");

    expect(leagueManager).toContain("api.patchLeague");
    expect(leagueManager).toContain("api.deleteLeague");
    expect(leagueManager).toContain("Postacie pozostaną zapisane");
    expect(statItem).toContain("onUpdate");
    expect(statItem).toContain("Edytuj statystykę");
    expect(readProjectFile("app/poe/page.tsx")).toContain("onChanged={afterLeagueChanged}");
  });

  it("uses the upgraded supported frontend platform and CSS pipeline", () => {
    const packageJson = JSON.parse(readProjectFile("package.json"));
    const styles = readProjectFile("app/globals.css");
    const postcss = readProjectFile("postcss.config.mjs");

    expect(packageJson.dependencies.next).toMatch(/^\^16\./);
    expect(packageJson.dependencies.react).toMatch(/^\^19\./);
    expect(packageJson.dependencies["react-dom"]).toMatch(/^\^19\./);
    expect(packageJson.dependencies.zod).toMatch(/^\^4\./);
    expect(packageJson.devDependencies.typescript).toMatch(/^\^6\./);
    expect(packageJson.devDependencies["@types/node"]).toMatch(/^\^24\./);
    expect(packageJson.devDependencies.tailwindcss).toMatch(/^\^4\./);
    expect(packageJson.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^4\./);
    expect(packageJson.devDependencies.autoprefixer).toBeUndefined();
    expect(packageJson.dependencies["tailwindcss-animate"]).toBeUndefined();
    expect(postcss).toContain('"@tailwindcss/postcss": {}');
    expect(styles).toContain('@import "tailwindcss";');
    expect(styles).toContain("@theme {");
    expect(packageJson.scripts.lint).toBe("eslint .");
  });
});
