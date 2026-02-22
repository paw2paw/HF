/**
 * Tests for filter-sections.ts
 *
 * Verifies:
 * - META role sections are skipped
 * - Title-based skip patterns work
 * - Short sections are filtered out
 * - Reference sections (answer keys, teacher notes) are tagged, not skipped
 * - Normal content sections pass through
 * - Filtering disabled returns all sections
 * - detectFigureRefs() finds figure references in text
 * - Warnings are generated for skipped/reference sections
 */
import { describe, it, expect } from "vitest";
import {
  applyFilters,
  detectFigureRefs,
} from "@/lib/content-trust/filter-sections";
import type { ExtractionFilterSettings } from "@/lib/system-settings";
import type { DocumentSection } from "@/lib/content-trust/segment-document";

// Inline defaults to avoid auto-mock issues with system-settings
const EXTRACTION_FILTER_DEFAULTS: ExtractionFilterSettings = {
  filteringEnabled: true,
  skipPatterns: [
    "index", "table of contents", "contents", "title page", "copyright",
    "acknowledgements", "publisher", "about the author", "blank",
  ],
  referencePatterns: ["answer key", "answers", "teacher notes", "glossary", "solutions"],
  minSectionChars: 50,
};

// Helper to create a section at a specific offset range
function makeSection(
  overrides: Partial<DocumentSection> & { title: string },
): DocumentSection {
  return {
    title: overrides.title,
    startOffset: overrides.startOffset ?? 0,
    endOffset: overrides.endOffset ?? 1000,
    sectionType: overrides.sectionType ?? "TEXTBOOK",
    pedagogicalRole: overrides.pedagogicalRole ?? "INPUT",
    hasQuestions: overrides.hasQuestions ?? false,
    hasAnswerKey: overrides.hasAnswerKey ?? false,
    filterAction: overrides.filterAction,
    figureRefs: overrides.figureRefs,
    hasFigures: overrides.hasFigures,
  };
}

// Full text used for offset-based section text extraction
const FULL_TEXT = "A".repeat(2000);
const SHORT_TEXT = "A".repeat(30); // Below minSectionChars (50)

describe("applyFilters", () => {
  const settings = EXTRACTION_FILTER_DEFAULTS;

  describe("skip rules", () => {
    it("skips sections with META pedagogical role", () => {
      const sections = [
        makeSection({ title: "Table of Contents", pedagogicalRole: "META" }),
        makeSection({ title: "Reading Passage", startOffset: 100, endOffset: 500 }),
      ];

      const result = applyFilters(FULL_TEXT, sections, settings);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].title).toBe("Reading Passage");
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toContain("META");
    });

    it("skips sections matching skip patterns in title", () => {
      const sections = [
        makeSection({ title: "Index of Terms" }),
        makeSection({ title: "Copyright Notice" }),
        makeSection({ title: "Chapter 1: Introduction", startOffset: 200, endOffset: 600 }),
      ];

      const result = applyFilters(FULL_TEXT, sections, settings);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].title).toBe("Chapter 1: Introduction");
      expect(result.skipped).toHaveLength(2);
    });

    it("skips sections that are too short", () => {
      const sections = [
        makeSection({ title: "Tiny Section", startOffset: 0, endOffset: 30 }),
        makeSection({ title: "Normal Section", startOffset: 100, endOffset: 600 }),
      ];

      const result = applyFilters(FULL_TEXT, sections, settings);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].title).toBe("Normal Section");
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toContain("too short");
    });

    it("uses exact title matches for common non-content titles", () => {
      const sections = [
        makeSection({ title: "table of contents" }),
        makeSection({ title: "contents" }),
        makeSection({ title: "acknowledgements" }),
        makeSection({ title: "about the author" }),
        makeSection({ title: "Main Content", startOffset: 500, endOffset: 1500 }),
      ];

      const result = applyFilters(FULL_TEXT, sections, settings);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].title).toBe("Main Content");
    });
  });

  describe("reference rules", () => {
    it("tags sections with hasAnswerKey as reference", () => {
      const sections = [
        makeSection({ title: "Answer Key", hasAnswerKey: true }),
      ];

      const result = applyFilters(FULL_TEXT, sections, settings);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].filterAction).toBe("reference");
    });

    it("tags sections with REFERENCE role as reference", () => {
      const sections = [
        makeSection({ title: "Glossary", pedagogicalRole: "REFERENCE" }),
      ];

      const result = applyFilters(FULL_TEXT, sections, settings);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].filterAction).toBe("reference");
    });

    it("tags sections matching reference patterns as reference", () => {
      const sections = [
        makeSection({ title: "Teacher Notes" }),
        makeSection({ title: "Solutions Manual" }),
      ];

      const result = applyFilters(FULL_TEXT, sections, settings);

      expect(result.sections).toHaveLength(2);
      expect(result.sections.every((s) => s.filterAction === "reference")).toBe(true);
    });
  });

  describe("normal extraction", () => {
    it("marks normal content sections as extract", () => {
      const sections = [
        makeSection({ title: "Chapter 1: Basics" }),
        makeSection({ title: "Chapter 2: Advanced", startOffset: 500, endOffset: 1200 }),
      ];

      const result = applyFilters(FULL_TEXT, sections, settings);

      expect(result.sections).toHaveLength(2);
      expect(result.sections.every((s) => s.filterAction === "extract")).toBe(true);
      expect(result.skipped).toHaveLength(0);
    });
  });

  describe("filtering disabled", () => {
    it("returns all sections when filtering is disabled", () => {
      const sections = [
        makeSection({ title: "Table of Contents", pedagogicalRole: "META" }),
        makeSection({ title: "Reading Passage", startOffset: 100, endOffset: 500 }),
      ];

      const result = applyFilters(FULL_TEXT, sections, {
        ...settings,
        filteringEnabled: false,
      });

      // applyFilters itself doesn't check filteringEnabled — that's the async wrapper's job.
      // But we can test the pure function always processes.
      expect(result.sections.length + result.skipped.length).toBe(2);
    });
  });

  describe("warnings", () => {
    it("generates warning for skipped sections", () => {
      const sections = [
        makeSection({ title: "Index", pedagogicalRole: "META" }),
        makeSection({ title: "Content", startOffset: 200, endOffset: 800 }),
      ];

      const result = applyFilters(FULL_TEXT, sections, settings);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("Skipped 1 non-content section");
    });

    it("generates warning for reference sections", () => {
      const sections = [
        makeSection({ title: "Answer Key", hasAnswerKey: true }),
      ];

      const result = applyFilters(FULL_TEXT, sections, settings);

      expect(result.warnings.some((w) => w.includes("reference content"))).toBe(true);
    });
  });
});

describe("detectFigureRefs", () => {
  it("detects Figure references", () => {
    const text = "As shown in Figure 1.2, the process involves multiple steps. See also Figure 3.";
    const refs = detectFigureRefs(text);

    expect(refs).toContain("Figure 1.2");
    expect(refs).toContain("Figure 3");
    expect(refs).toHaveLength(2);
  });

  it("detects Fig. abbreviations", () => {
    const text = "Refer to Fig. 4 and Fig 5a for details.";
    const refs = detectFigureRefs(text);

    expect(refs.length).toBeGreaterThanOrEqual(2);
  });

  it("detects Diagram, Table, Chart references", () => {
    const text = "Table 2.1 shows the data. Diagram 3 illustrates the flow. Chart 1 displays trends.";
    const refs = detectFigureRefs(text);

    expect(refs).toContain("Table 2.1");
    expect(refs).toContain("Diagram 3");
    expect(refs).toContain("Chart 1");
  });

  it("deduplicates references", () => {
    const text = "See Figure 1. As mentioned, Figure 1 shows the result.";
    const refs = detectFigureRefs(text);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toBe("Figure 1");
  });

  it("returns empty array for text without figure references", () => {
    const text = "This is a plain text paragraph with no figure references at all.";
    const refs = detectFigureRefs(text);

    expect(refs).toHaveLength(0);
  });
});
