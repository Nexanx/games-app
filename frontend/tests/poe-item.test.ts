import { describe, expect, it } from "vitest";

import { parsePoeItemText } from "../lib/poe-item";

describe("Path of Exile item text parser", () => {
  it("separates properties, requirements, implicits and explicits without losing crafted tags", () => {
    const details = parsePoeItemText({
      name: "Blight Pace",
      base_type: "Harpyskin Boots",
      item_text: `Rarity: RARE
Blight Pace
Harpyskin Boots
Evasion: 600
EvasionBasePercentile: 1
Unique ID: example
Item Level: 85
Quality: 20
Sockets: G-R-R-B
LevelReq: 78
Implicits: 2
28% chance to Avoid Elemental Ailments
4% increased Action Speed
+14% chance to Suppress Spell Damage
+147 to Evasion Rating
+128 to maximum Life
+45% to Fire Resistance
+34% to Lightning Resistance
{crafted}20% increased Movement Speed
{crafted}12% chance to gain Onslaught for 4 seconds on Kill`
    });

    expect(details.properties).toEqual(["Evasion: 600", "Item Level: 85", "Quality: 20", "Sockets: G-R-R-B"]);
    expect(details.requirements).toEqual(["Wymagany poziom: 78"]);
    expect(details.implicits).toEqual([
      { text: "28% chance to Avoid Elemental Ailments", tags: [] },
      { text: "4% increased Action Speed", tags: [] }
    ]);
    expect(details.explicits).toHaveLength(7);
    expect(details.explicits.at(-2)).toEqual({ text: "20% increased Movement Speed", tags: ["crafted"] });
    expect(details.explicits.at(-1)).toEqual({ text: "12% chance to gain Onslaught for 4 seconds on Kill", tags: ["crafted"] });
  });

  it("keeps fractured metadata on the exact modifier", () => {
    const details = parsePoeItemText({
      name: "Dire Cloak",
      base_type: "Conquest Lamellar",
      item_text: `Rarity: RARE
Dire Cloak
Conquest Lamellar
Armour: 3062
LevelReq: 84
Implicits: 1
Gain an Endurance Charge every 14 seconds
{fractured}+22% chance to Suppress Spell Damage
{crafted}+20% to Cold and Lightning Resistances
Corrupted`
    });

    expect(details.implicits).toEqual([{ text: "Gain an Endurance Charge every 14 seconds", tags: [] }]);
    expect(details.explicits).toEqual([
      { text: "+22% chance to Suppress Spell Damage", tags: ["fractured"] },
      { text: "+20% to Cold and Lightning Resistances", tags: ["crafted"] }
    ]);
    expect(details.statuses).toEqual(["Corrupted"]);
  });

  it("only includes modifiers belonging to the selected unique variant", () => {
    const details = parsePoeItemText({
      name: "Variant Item",
      base_type: "Test Base",
      item_text: `Rarity: UNIQUE
Variant Item
Test Base
Selected Variant: 2
Variant: 1
Variant: 2
LevelReq: 70
Implicits: 0
{variant:1}+10 to maximum Life
{variant:2}+20 to maximum Life`
    });

    expect(details.explicits).toEqual([{ text: "+20 to maximum Life", tags: [] }]);
  });
});
