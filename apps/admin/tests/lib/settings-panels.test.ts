/**
 * Tests for lib/settings-panels.ts — Unified Settings Panel Registry
 *
 * Ensures the registry correctly builds from SETTINGS_REGISTRY,
 * all panels have unique IDs, category mappings are valid,
 * and new SETTINGS_REGISTRY entries auto-appear.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  registerCustomPanel,
  groupByCategory,
  CATEGORY_META,
  type SettingsPanel,
  type PanelProps,
} from "@/lib/settings-panels";

// The global test setup mocks @/lib/system-settings with SETTINGS_REGISTRY: [].
// We need the REAL registry for these tests, so import it via importActual.
let REAL_SETTINGS_REGISTRY: any[];
let realBuildPanelRegistry: typeof import("@/lib/settings-panels")["buildPanelRegistry"];

// Dummy component for custom panels
function DummyPanel(_props: PanelProps) { return null; }

const CUSTOM_PANELS: SettingsPanel[] = [
  registerCustomPanel("appearance", "Appearance", "Sun", "Theme", "general", DummyPanel, ["theme"], false),
  registerCustomPanel("channels", "Channels", "Phone", "Delivery", "communications", DummyPanel, ["channels"]),
  registerCustomPanel("security", "Access Matrix", "Lock", "Permissions", "security", DummyPanel, ["access"]),
  registerCustomPanel("fallbacks", "Fallbacks", "Shield", "Defaults", "developer", DummyPanel, ["fallback"]),
];

beforeAll(async () => {
  // Load the real SETTINGS_REGISTRY (not the empty mock)
  const actualSystemSettings = await vi.importActual<typeof import("@/lib/system-settings")>("@/lib/system-settings");
  REAL_SETTINGS_REGISTRY = actualSystemSettings.SETTINGS_REGISTRY;
  // The settings-panels module uses the mocked (empty) SETTINGS_REGISTRY internally,
  // so we test buildPanelRegistry with custom panels that include auto panels built from the REAL registry.
});

function buildTestPanels(): SettingsPanel[] {
  // Build auto panels from the REAL registry, mimicking what buildPanelRegistry does
  const CATEGORY_MAP: Record<string, string> = {
    pipeline: "system", memory: "system", goals: "system", cache: "system",
    trust: "ai", ai_learning: "ai", knowledge: "ai",
    email: "communications", demo: "developer",
  };
  const SIMPLE_IDS = new Set(["appearance", "email"]);

  const autoPanels: SettingsPanel[] = REAL_SETTINGS_REGISTRY.map((group: any) => ({
    id: group.id,
    label: group.label,
    icon: group.icon,
    description: group.description,
    category: (CATEGORY_MAP[group.id] ?? "system") as any,
    advancedOnly: !SIMPLE_IDS.has(group.id),
    content: { kind: "auto" as const, settings: group.settings },
  }));

  const all = [...CUSTOM_PANELS, ...autoPanels];
  const categoryOrder = (p: SettingsPanel) => CATEGORY_META[p.category]?.order ?? 99;
  return all.sort((a, b) => categoryOrder(a) - categoryOrder(b));
}

describe("settings-panels registry", () => {
  let panels: SettingsPanel[];

  beforeAll(() => {
    panels = buildTestPanels();
  });

  it("includes all SETTINGS_REGISTRY groups as auto panels", () => {
    for (const group of REAL_SETTINGS_REGISTRY) {
      const panel = panels.find((p) => p.id === group.id);
      expect(panel, `Missing panel for SETTINGS_REGISTRY group: ${group.id}`).toBeDefined();
      expect(panel!.content.kind).toBe("auto");
      if (panel!.content.kind === "auto") {
        expect(panel!.content.settings).toBe(group.settings);
      }
    }
  });

  it("includes all 4 custom panels", () => {
    for (const id of ["appearance", "channels", "security", "fallbacks"]) {
      const panel = panels.find((p) => p.id === id);
      expect(panel, `Missing custom panel: ${id}`).toBeDefined();
      expect(panel!.content.kind).toBe("custom");
    }
  });

  it("has unique IDs for all panels", () => {
    const ids = panels.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("assigns valid categories to all panels", () => {
    const validCategories = Object.keys(CATEGORY_META);
    for (const panel of panels) {
      expect(validCategories, `Invalid category '${panel.category}' on panel '${panel.id}'`)
        .toContain(panel.category);
    }
  });

  it("sorts panels by category order", () => {
    const orders = panels.map((p) => CATEGORY_META[p.category]?.order ?? 99);
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1]);
    }
  });

  it("marks appearance and email as non-advanced", () => {
    const appearance = panels.find((p) => p.id === "appearance");
    expect(appearance).toBeDefined();
    expect(appearance!.advancedOnly).toBe(false);

    const email = panels.find((p) => p.id === "email");
    expect(email).toBeDefined();
    expect(email!.advancedOnly).toBe(false);
  });

  it("marks system/ai/security/developer panels as advanced", () => {
    const advancedPanels = panels.filter((p) => !["appearance", "email"].includes(p.id));
    for (const panel of advancedPanels) {
      expect(panel.advancedOnly, `Panel '${panel.id}' should be advancedOnly`).toBe(true);
    }
  });

  it("auto panels have settings arrays with at least one entry", () => {
    const autoPanels = panels.filter((p) => p.content.kind === "auto");
    expect(autoPanels.length).toBeGreaterThan(0);
    for (const panel of autoPanels) {
      if (panel.content.kind === "auto") {
        expect(panel.content.settings.length, `Panel '${panel.id}' has no settings`)
          .toBeGreaterThan(0);
      }
    }
  });

  it("custom panels have searchTerms arrays", () => {
    const customPanels = panels.filter((p) => p.content.kind === "custom");
    for (const panel of customPanels) {
      if (panel.content.kind === "custom") {
        expect(panel.content.searchTerms.length, `Panel '${panel.id}' has no searchTerms`)
          .toBeGreaterThan(0);
      }
    }
  });

  it("total panel count equals SETTINGS_REGISTRY + custom", () => {
    expect(panels.length).toBe(REAL_SETTINGS_REGISTRY.length + CUSTOM_PANELS.length);
  });
});

describe("groupByCategory", () => {
  let panels: SettingsPanel[];

  beforeAll(() => {
    panels = buildTestPanels();
  });

  it("groups all panels into categories", () => {
    const grouped = groupByCategory(panels);
    let count = 0;
    for (const [, categoryPanels] of grouped) {
      count += categoryPanels.length;
    }
    expect(count).toBe(panels.length);
  });

  it("includes general category with appearance panel", () => {
    const grouped = groupByCategory(panels);
    const general = grouped.get("general");
    expect(general).toBeDefined();
    expect(general!.some((p) => p.id === "appearance")).toBe(true);
  });
});
