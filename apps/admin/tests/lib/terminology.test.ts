import { describe, it, expect } from "vitest";
import {
  resolveTerminology,
  pluralize,
  lc,
  DEFAULT_TERMINOLOGY,
  TERMINOLOGY_PRESETS,
  type TerminologyConfig,
} from "@/lib/terminology/types";

describe("resolveTerminology", () => {
  it("returns school defaults for null config", () => {
    expect(resolveTerminology(null)).toEqual(DEFAULT_TERMINOLOGY);
  });

  it("returns school defaults for undefined config", () => {
    expect(resolveTerminology(undefined)).toEqual(DEFAULT_TERMINOLOGY);
  });

  it("returns full corporate profile for preset only", () => {
    const config: TerminologyConfig = { preset: "corporate" };
    expect(resolveTerminology(config)).toEqual(TERMINOLOGY_PRESETS.corporate);
  });

  it("returns full coaching profile for preset only", () => {
    const config: TerminologyConfig = { preset: "coaching" };
    expect(resolveTerminology(config)).toEqual(TERMINOLOGY_PRESETS.coaching);
  });

  it("returns full healthcare profile for preset only", () => {
    const config: TerminologyConfig = { preset: "healthcare" };
    expect(resolveTerminology(config)).toEqual(TERMINOLOGY_PRESETS.healthcare);
  });

  it("merges overrides with preset base", () => {
    const config: TerminologyConfig = {
      preset: "school",
      overrides: { learner: "Pupil" },
    };
    const result = resolveTerminology(config);
    expect(result.learner).toBe("Pupil");
    expect(result.institution).toBe("School"); // unchanged
    expect(result.cohort).toBe("Classroom"); // unchanged
  });

  it("ignores empty string overrides", () => {
    const config: TerminologyConfig = {
      preset: "corporate",
      overrides: { cohort: "" },
    };
    const result = resolveTerminology(config);
    expect(result.cohort).toBe("Team"); // falls back to preset
  });

  it("ignores null overrides", () => {
    const config: TerminologyConfig = {
      preset: "corporate",
      overrides: { cohort: undefined },
    };
    const result = resolveTerminology(config);
    expect(result.cohort).toBe("Team");
  });

  it("falls back to default for unknown preset", () => {
    const config = { preset: "unknown" as any };
    const result = resolveTerminology(config);
    expect(result).toEqual(DEFAULT_TERMINOLOGY);
  });
});

describe("pluralize", () => {
  it("adds s to regular words", () => {
    expect(pluralize("Student")).toBe("Students");
    expect(pluralize("Team")).toBe("Teams");
    expect(pluralize("Group")).toBe("Groups");
  });

  it("handles words ending in y (consonant + y)", () => {
    expect(pluralize("Facility")).toBe("Facilities");
  });

  it("does not change y when preceded by vowel", () => {
    expect(pluralize("Key")).toBe("Keys");
  });

  it("handles words ending in ch/sh", () => {
    expect(pluralize("Coach")).toBe("Coaches");
  });

  it("handles words ending in s", () => {
    expect(pluralize("Class")).toBe("Classes");
  });
});

describe("lc", () => {
  it("lowercases first character only", () => {
    expect(lc("School")).toBe("school");
    expect(lc("My Teacher")).toBe("my Teacher");
    expect(lc("organization")).toBe("organization");
  });

  it("handles single character", () => {
    expect(lc("A")).toBe("a");
  });
});
