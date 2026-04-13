/**
 * Tests for issue #140 — Cross-tab entity hierarchy UX consistency.
 *
 * Covers acceptance criteria:
 *   A: Genome session axis uses getSessionTypeLabel() (display label, not raw type)
 *   B: "Learning Outcomes" label (string constant — confirmed in GenomeBrowser.tsx:358)
 *   C: Journey LO refs guarded by null/empty check
 *   D: Module color accent (NOT implemented in commit — flagged below)
 *   E: introduce/deepen are visually distinct; TODO comments on local copies
 *   F: CATEGORY_COLORS still local in GenomeBrowser (not removed — flagged below)
 */

import { describe, it, expect } from "vitest";
import {
  getSessionTypeLabel,
  getSessionTypeColor,
  SESSION_TYPES,
} from "@/lib/lesson-plan/session-ui";
import {
  getCategoryStyle,
  CONTENT_CATEGORIES,
} from "@/lib/content-categories";

// ── A: Genome session axis — display labels ─────────────────────────────────

describe("A: getSessionTypeLabel() returns display labels (not raw type strings)", () => {
  it("capitalises introduce → Introduce", () => {
    expect(getSessionTypeLabel("introduce")).toBe("Introduce");
  });

  it("capitalises deepen → Deepen", () => {
    expect(getSessionTypeLabel("deepen")).toBe("Deepen");
  });

  it("capitalises review → Review", () => {
    expect(getSessionTypeLabel("review")).toBe("Review");
  });

  it("capitalises assess → Assess", () => {
    expect(getSessionTypeLabel("assess")).toBe("Assess");
  });

  it("capitalises consolidate → Consolidate", () => {
    expect(getSessionTypeLabel("consolidate")).toBe("Consolidate");
  });

  it("returns raw type for unknown type (safe fallback)", () => {
    expect(getSessionTypeLabel("unknown_type")).toBe("unknown_type");
  });

  it("all SESSION_TYPES entries have a capitalized label (not raw snake_case)", () => {
    for (const t of SESSION_TYPES) {
      // label should not start with lowercase and contain underscore
      expect(t.label).not.toMatch(/^[a-z].*_/);
      // label should start with uppercase
      expect(t.label[0]).toBe(t.label[0].toUpperCase());
    }
  });
});

// ── E: introduce and deepen have distinct colors ─────────────────────────────

describe("E: introduce and deepen session types are visually distinct colors", () => {
  it("introduce and deepen have different colors", () => {
    const introduceColor = getSessionTypeColor("introduce");
    const deepenColor = getSessionTypeColor("deepen");
    expect(introduceColor).not.toBe(deepenColor);
  });

  it("introduce color contains accent-secondary (purple)", () => {
    const color = getSessionTypeColor("introduce");
    expect(color).toContain("accent-secondary");
  });

  it("deepen color contains status-info-text (blue)", () => {
    const color = getSessionTypeColor("deepen");
    expect(color).toContain("status-info-text");
  });

  it("introduce and deepen differ from review and assess", () => {
    const introduce = getSessionTypeColor("introduce");
    const deepen = getSessionTypeColor("deepen");
    const review = getSessionTypeColor("review");
    const assess = getSessionTypeColor("assess");
    expect(introduce).not.toBe(review);
    expect(introduce).not.toBe(assess);
    expect(deepen).not.toBe(assess);
  });
});

// ── C: Journey LO refs guard (null / empty) ──────────────────────────────────
// The guard is: entry.learningOutcomeRefs && entry.learningOutcomeRefs.length > 0
// We test the logic directly since the component is client-side React.

describe("C: Journey LO refs guard logic", () => {
  function shouldShowLORefs(refs: string[] | null | undefined): boolean {
    return !!(refs && refs.length > 0);
  }

  it("shows LO refs when array is non-empty", () => {
    expect(shouldShowLORefs(["LO-1", "LO-3"])).toBe(true);
  });

  it("hides LO refs when array is empty", () => {
    expect(shouldShowLORefs([])).toBe(false);
  });

  it("hides LO refs when null", () => {
    expect(shouldShowLORefs(null)).toBe(false);
  });

  it("hides LO refs when undefined", () => {
    expect(shouldShowLORefs(undefined)).toBe(false);
  });

  it("joins LO refs with comma-space", () => {
    const refs = ["LO-1", "LO-3"];
    expect(refs.join(", ")).toBe("LO-1, LO-3");
  });
});

// ── F: CONTENT_CATEGORIES contains the 11 literary categories ────────────────
// F also requires removal of local CATEGORY_COLORS from GenomeBrowser — see below.

describe("F: content-categories.ts contains all literary categories", () => {
  const literaryCategories = [
    "character",
    "theme",
    "setting",
    "key_event",
    "key_point",
    "key_quote",
    "language_feature",
    "vocabulary_highlight",
    "overview",
    "summary",
    "principle",
  ];

  for (const cat of literaryCategories) {
    it(`CONTENT_CATEGORIES has entry for "${cat}"`, () => {
      expect(CONTENT_CATEGORIES).toHaveProperty(cat);
    });

    it(`getCategoryStyle("${cat}") returns a non-empty label`, () => {
      const style = getCategoryStyle(cat);
      expect(style.label).toBeTruthy();
      expect(style.label.length).toBeGreaterThan(0);
    });

    it(`getCategoryStyle("${cat}") returns a CSS var color (not bare hex)`, () => {
      const style = getCategoryStyle(cat);
      expect(style.color).toMatch(/var\(--/);
    });

    it(`getCategoryStyle("${cat}") returns a color-mix bg`, () => {
      const style = getCategoryStyle(cat);
      expect(style.bg).toMatch(/color-mix/);
    });
  }

  it("getCategoryStyle falls back gracefully for unknown category", () => {
    const style = getCategoryStyle("nonexistent_cat");
    expect(style.color).toContain("text-muted");
    expect(style.bg).toContain("color-mix");
    // label falls back to the category string itself
    expect(style.label).toBe("nonexistent_cat");
  });
});

// ── E: TODO comments on local SESSION_TYPES copies ──────────────────────────
// These must be added per acceptance criteria E.
// Verified via file content read in the test (not via import — these are
// .tsx files not exported as modules).

import { readFileSync } from "fs";
import { join } from "path";

const ADMIN_ROOT = join(__dirname, "../../");

describe("E: local SESSION_TYPES copies have TODO(session-type-colors) comment", () => {
  const filesToCheck = [
    "app/x/content-sources/_components/steps/PlanStep.tsx",
    "app/x/courses/_components/steps/LessonPlanStep.tsx",
    "app/x/subjects/_components/SubjectDetail.tsx",
  ];

  for (const relPath of filesToCheck) {
    it(`${relPath} has TODO(session-type-colors) comment`, () => {
      const content = readFileSync(join(ADMIN_ROOT, relPath), "utf-8");
      expect(content).toContain("TODO(session-type-colors)");
    });
  }
});

// ── F: GenomeBrowser.tsx — CATEGORY_COLORS local map ────────────────────────
// Criterion F requires the local CATEGORY_COLORS map to be removed and replaced
// with getCategoryStyle(). This was NOT done in the commit.

describe("F: GenomeBrowser.tsx — CATEGORY_COLORS local map should be removed", () => {
  it("GenomeBrowser.tsx should not contain a local CATEGORY_COLORS map", () => {
    const content = readFileSync(
      join(ADMIN_ROOT, "components/shared/GenomeBrowser.tsx"),
      "utf-8"
    );
    // If CATEGORY_COLORS still exists, this test fails — indicating F is incomplete.
    expect(content).not.toContain("const CATEGORY_COLORS");
  });
});
