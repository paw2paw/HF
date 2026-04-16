import { describe, it, expect } from "vitest";
import { computeInformationNeed, deriveQuestionCount } from "@/lib/assessment/information-need";

describe("computeInformationNeed", () => {
  it("returns 1.0 for a brand new student (no mastery data)", () => {
    expect(computeInformationNeed({}, 10)).toBe(1.0);
  });

  it("returns 0.0 when all LOs have mastery data", () => {
    const map: Record<string, number> = {};
    for (let i = 0; i < 10; i++) map[`lo${i}`] = 0.5;
    expect(computeInformationNeed(map, 10)).toBe(0.0);
  });

  it("returns 0.5 when half of LOs are uncharacterized", () => {
    expect(computeInformationNeed({ lo1: 0.3, lo2: 0.7 }, 4)).toBe(0.5);
  });

  it("returns 1.0 when totalLOs is 0 (defensive)", () => {
    expect(computeInformationNeed({}, 0)).toBe(1.0);
  });

  it("clamps to [0, 1] even with more entries than totalLOs", () => {
    // Edge case: more mastery entries than LOs (stale data, duplicate keys)
    expect(computeInformationNeed({ a: 0.5, b: 0.5, c: 0.5 }, 2)).toBe(0);
  });

  it("handles single-LO course", () => {
    expect(computeInformationNeed({}, 1)).toBe(1.0);
    expect(computeInformationNeed({ lo1: 0.8 }, 1)).toBe(0.0);
  });
});

describe("deriveQuestionCount", () => {
  it("returns max questions when informationNeed is 1.0", () => {
    expect(deriveQuestionCount(1.0, 3)).toBe(3);
  });

  it("returns min questions when informationNeed is near 0", () => {
    expect(deriveQuestionCount(0.05, 3, 1)).toBe(1);
  });

  it("returns min when informationNeed is 0", () => {
    expect(deriveQuestionCount(0, 3, 1)).toBe(1);
  });

  it("scales linearly between min and max", () => {
    // 0.5 * 3 = 1.5 → ceil = 2
    expect(deriveQuestionCount(0.5, 3, 1)).toBe(2);
  });

  it("respects custom min", () => {
    expect(deriveQuestionCount(0, 5, 2)).toBe(2);
  });

  it("never exceeds max", () => {
    expect(deriveQuestionCount(1.5, 3, 1)).toBe(3);
  });
});
