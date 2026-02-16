/**
 * Tests for ViewMode preference resolution
 *
 * Covers:
 * - Storage key and valid values
 * - Role-based auto resolution
 * - Explicit overrides (simple/advanced)
 * - Invalid stored values fallback
 */

import { describe, it, expect, beforeEach } from "vitest";

// ─── Inline the resolution logic to test without React ───

type ViewModePreference = "auto" | "simple" | "advanced";

const STORAGE_KEY = "hf.viewMode";
const ADVANCED_ROLES = new Set(["SUPERADMIN", "ADMIN", "OPERATOR", "EDUCATOR"]);

function getStoredPreference(): ViewModePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "simple" || stored === "advanced" || stored === "auto") {
    return stored;
  }
  return "auto";
}

function resolveAdvanced(preference: ViewModePreference, role: string | undefined): boolean {
  if (preference === "simple") return false;
  if (preference === "advanced") return true;
  return ADVANCED_ROLES.has(role ?? "");
}

// ─── Tests ───

describe("ViewMode Storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses correct storage key", () => {
    expect(STORAGE_KEY).toBe("hf.viewMode");
  });

  it("returns 'auto' when nothing stored", () => {
    expect(getStoredPreference()).toBe("auto");
  });

  it("returns stored 'simple'", () => {
    localStorage.setItem(STORAGE_KEY, "simple");
    expect(getStoredPreference()).toBe("simple");
  });

  it("returns stored 'advanced'", () => {
    localStorage.setItem(STORAGE_KEY, "advanced");
    expect(getStoredPreference()).toBe("advanced");
  });

  it("returns stored 'auto'", () => {
    localStorage.setItem(STORAGE_KEY, "auto");
    expect(getStoredPreference()).toBe("auto");
  });

  it("falls back to 'auto' for invalid stored value", () => {
    localStorage.setItem(STORAGE_KEY, "bogus");
    expect(getStoredPreference()).toBe("auto");
  });

  it("falls back to 'auto' for empty string", () => {
    localStorage.setItem(STORAGE_KEY, "");
    expect(getStoredPreference()).toBe("auto");
  });
});

describe("ViewMode Resolution", () => {
  describe("explicit overrides ignore role", () => {
    it("'simple' resolves to not-advanced regardless of role", () => {
      expect(resolveAdvanced("simple", "SUPERADMIN")).toBe(false);
      expect(resolveAdvanced("simple", "ADMIN")).toBe(false);
      expect(resolveAdvanced("simple", "VIEWER")).toBe(false);
    });

    it("'advanced' resolves to advanced regardless of role", () => {
      expect(resolveAdvanced("advanced", "VIEWER")).toBe(true);
      expect(resolveAdvanced("advanced", "DEMO")).toBe(true);
      expect(resolveAdvanced("advanced", "TESTER")).toBe(true);
    });
  });

  describe("auto mode resolves from role", () => {
    it("SUPERADMIN defaults to advanced", () => {
      expect(resolveAdvanced("auto", "SUPERADMIN")).toBe(true);
    });

    it("ADMIN defaults to advanced", () => {
      expect(resolveAdvanced("auto", "ADMIN")).toBe(true);
    });

    it("OPERATOR defaults to advanced", () => {
      expect(resolveAdvanced("auto", "OPERATOR")).toBe(true);
    });

    it("EDUCATOR defaults to advanced", () => {
      expect(resolveAdvanced("auto", "EDUCATOR")).toBe(true);
    });

    it("SUPER_TESTER defaults to simple", () => {
      expect(resolveAdvanced("auto", "SUPER_TESTER")).toBe(false);
    });

    it("TESTER defaults to simple", () => {
      expect(resolveAdvanced("auto", "TESTER")).toBe(false);
    });

    it("VIEWER defaults to simple", () => {
      expect(resolveAdvanced("auto", "VIEWER")).toBe(false);
    });

    it("DEMO defaults to simple", () => {
      expect(resolveAdvanced("auto", "DEMO")).toBe(false);
    });

    it("undefined role defaults to simple", () => {
      expect(resolveAdvanced("auto", undefined)).toBe(false);
    });
  });
});

// ─── Sidebar advancedOnly filtering (mirrors useSidebarLayout logic) ───

type NavItem = { id: string; label: string; advancedOnly?: boolean };
type NavSection = { id: string; items: NavItem[]; advancedOnly?: boolean };

function filterSidebarByViewMode(sections: NavSection[], isAdv: boolean): NavSection[] {
  return sections
    .filter((s) => !(s.advancedOnly && !isAdv))
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => !(item.advancedOnly && !isAdv)),
    }));
}

describe("Sidebar advancedOnly filtering", () => {
  const sections: NavSection[] = [
    { id: "home", items: [{ id: "quick-launch", label: "Quick Launch" }] },
    {
      id: "calls",
      items: [
        { id: "callers", label: "Callers" },
        { id: "analytics", label: "Analytics", advancedOnly: true },
      ],
    },
    {
      id: "config",
      advancedOnly: true,
      items: [
        { id: "domains", label: "Domains" },
        { id: "specs", label: "Specs" },
      ],
    },
  ];

  it("advanced mode keeps all sections and items", () => {
    const result = filterSidebarByViewMode(sections, true);
    expect(result.map((s) => s.id)).toEqual(["home", "calls", "config"]);
    expect(result.find((s) => s.id === "calls")!.items).toHaveLength(2);
    expect(result.find((s) => s.id === "config")!.items).toHaveLength(2);
  });

  it("simple mode removes advancedOnly sections", () => {
    const result = filterSidebarByViewMode(sections, false);
    expect(result.map((s) => s.id)).toEqual(["home", "calls"]);
  });

  it("simple mode removes advancedOnly items within visible sections", () => {
    const result = filterSidebarByViewMode(sections, false);
    const calls = result.find((s) => s.id === "calls")!;
    expect(calls.items.map((i) => i.id)).toEqual(["callers"]);
  });

  it("sections without advancedOnly are always visible", () => {
    const result = filterSidebarByViewMode(sections, false);
    expect(result.find((s) => s.id === "home")).toBeDefined();
    expect(result.find((s) => s.id === "home")!.items).toHaveLength(1);
  });

  it("empty sections after item filtering are still present", () => {
    const allAdvancedItems: NavSection[] = [
      { id: "mixed", items: [{ id: "a", label: "A", advancedOnly: true }] },
    ];
    const result = filterSidebarByViewMode(allAdvancedItems, false);
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(0);
  });
});
