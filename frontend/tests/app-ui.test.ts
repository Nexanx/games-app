import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { navItems } from "../components/layout/nav-items";
import { APP_NAME } from "../lib/app-config";

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("application UI configuration", () => {
  it("uses the Games Tracker name in shared frontend configuration and PWA manifest", () => {
    const manifest = JSON.parse(readProjectFile("public/manifest.webmanifest"));

    expect(APP_NAME).toBe("Games Tracker");
    expect(manifest.name).toBe("Games Tracker");
    expect(manifest.short_name).toBe("Games");
  });

  it("does not expose the old application name or private backend text in shared chrome", () => {
    const sidebar = readProjectFile("components/layout/Sidebar.tsx");
    const layout = readProjectFile("app/layout.tsx");
    const manifest = readProjectFile("public/manifest.webmanifest");

    const combined = `${sidebar}\n${layout}\n${manifest}`;

    expect(combined).not.toContain("Games & PoE Private Tracker");
    expect(combined).not.toContain("Games & Path of Exile Tracker");
    expect(combined).not.toContain("Prywatna aplikacja bez kont, logowania i ról");
    expect(combined).not.toContain("Dane zapisuje lokalny backend FastAPI");
  });

  it("removes the settings tab from primary navigation", () => {
    expect(navItems.map((item) => item.href)).not.toContain("/settings");
    expect(navItems.map((item) => item.label)).not.toContain("Ustawienia");
    expect(navItems).toHaveLength(5);
  });
});
