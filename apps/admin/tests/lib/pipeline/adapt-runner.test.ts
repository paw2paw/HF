import { describe, it, expect } from "vitest";
import { evaluateCondition, AdaptCondition } from "@/lib/pipeline/adapt-runner";

describe("evaluateCondition", () => {
  describe("eq operator (default)", () => {
    it("matches exact string value", () => {
      const condition: AdaptCondition = { profileKey: "style", value: "visual" };
      expect(evaluateCondition(condition, "visual")).toBe(true);
    });

    it("rejects non-matching string", () => {
      const condition: AdaptCondition = { profileKey: "style", value: "visual" };
      expect(evaluateCondition(condition, "reading")).toBe(false);
    });

    it("matches exact number value", () => {
      const condition: AdaptCondition = { profileKey: "score", value: 0.8 };
      expect(evaluateCondition(condition, 0.8)).toBe(true);
    });

    it("rejects non-matching number", () => {
      const condition: AdaptCondition = { profileKey: "score", value: 0.8 };
      expect(evaluateCondition(condition, 0.7)).toBe(false);
    });

    it("returns false for null", () => {
      const condition: AdaptCondition = { profileKey: "style", value: "visual" };
      expect(evaluateCondition(condition, null)).toBe(false);
    });

    it("uses explicit eq operator", () => {
      const condition: AdaptCondition = { profileKey: "style", operator: "eq", value: "fast" };
      expect(evaluateCondition(condition, "fast")).toBe(true);
      expect(evaluateCondition(condition, "slow")).toBe(false);
    });
  });

  describe("gt operator", () => {
    it("matches when value is greater", () => {
      const condition: AdaptCondition = { profileKey: "score", operator: "gt", threshold: 0.65 };
      expect(evaluateCondition(condition, 0.8)).toBe(true);
    });

    it("rejects equal value", () => {
      const condition: AdaptCondition = { profileKey: "score", operator: "gt", threshold: 0.65 };
      expect(evaluateCondition(condition, 0.65)).toBe(false);
    });

    it("rejects lesser value", () => {
      const condition: AdaptCondition = { profileKey: "score", operator: "gt", threshold: 0.65 };
      expect(evaluateCondition(condition, 0.3)).toBe(false);
    });

    it("rejects string values", () => {
      const condition: AdaptCondition = { profileKey: "score", operator: "gt", threshold: 0.65 };
      expect(evaluateCondition(condition, "high")).toBe(false);
    });
  });

  describe("gte operator", () => {
    it("matches when equal", () => {
      const condition: AdaptCondition = { profileKey: "score", operator: "gte", threshold: 0.65 };
      expect(evaluateCondition(condition, 0.65)).toBe(true);
    });

    it("matches when greater", () => {
      const condition: AdaptCondition = { profileKey: "score", operator: "gte", threshold: 0.65 };
      expect(evaluateCondition(condition, 0.9)).toBe(true);
    });

    it("rejects lesser", () => {
      const condition: AdaptCondition = { profileKey: "score", operator: "gte", threshold: 0.65 };
      expect(evaluateCondition(condition, 0.64)).toBe(false);
    });
  });

  describe("lt operator", () => {
    it("matches when lesser", () => {
      const condition: AdaptCondition = { profileKey: "score", operator: "lt", threshold: 0.35 };
      expect(evaluateCondition(condition, 0.2)).toBe(true);
    });

    it("rejects equal", () => {
      const condition: AdaptCondition = { profileKey: "score", operator: "lt", threshold: 0.35 };
      expect(evaluateCondition(condition, 0.35)).toBe(false);
    });
  });

  describe("lte operator", () => {
    it("matches when equal", () => {
      const condition: AdaptCondition = { profileKey: "score", operator: "lte", threshold: 0.35 };
      expect(evaluateCondition(condition, 0.35)).toBe(true);
    });

    it("matches when lesser", () => {
      const condition: AdaptCondition = { profileKey: "score", operator: "lte", threshold: 0.35 };
      expect(evaluateCondition(condition, 0.1)).toBe(true);
    });

    it("rejects greater", () => {
      const condition: AdaptCondition = { profileKey: "score", operator: "lte", threshold: 0.35 };
      expect(evaluateCondition(condition, 0.5)).toBe(false);
    });
  });

  describe("between operator", () => {
    it("matches value within range", () => {
      const condition: AdaptCondition = {
        profileKey: "score",
        operator: "between",
        range: { min: 0.3, max: 0.7 },
      };
      expect(evaluateCondition(condition, 0.5)).toBe(true);
    });

    it("matches at range boundaries (inclusive)", () => {
      const condition: AdaptCondition = {
        profileKey: "score",
        operator: "between",
        range: { min: 0.3, max: 0.7 },
      };
      expect(evaluateCondition(condition, 0.3)).toBe(true);
      expect(evaluateCondition(condition, 0.7)).toBe(true);
    });

    it("rejects outside range", () => {
      const condition: AdaptCondition = {
        profileKey: "score",
        operator: "between",
        range: { min: 0.3, max: 0.7 },
      };
      expect(evaluateCondition(condition, 0.1)).toBe(false);
      expect(evaluateCondition(condition, 0.9)).toBe(false);
    });

    it("returns false when range is missing", () => {
      const condition: AdaptCondition = { profileKey: "score", operator: "between" };
      expect(evaluateCondition(condition, 0.5)).toBe(false);
    });
  });

  describe("in operator", () => {
    it("matches value in string array", () => {
      const condition: AdaptCondition = {
        profileKey: "style",
        operator: "in",
        values: ["visual", "reading", "kinesthetic"],
      };
      expect(evaluateCondition(condition, "visual")).toBe(true);
      expect(evaluateCondition(condition, "reading")).toBe(true);
    });

    it("rejects value not in array", () => {
      const condition: AdaptCondition = {
        profileKey: "style",
        operator: "in",
        values: ["visual", "reading"],
      };
      expect(evaluateCondition(condition, "auditory")).toBe(false);
    });

    it("matches value in number array", () => {
      const condition: AdaptCondition = {
        profileKey: "level",
        operator: "in",
        values: [1, 2, 3],
      };
      expect(evaluateCondition(condition, 2)).toBe(true);
    });

    it("returns false when values is missing", () => {
      const condition: AdaptCondition = { profileKey: "style", operator: "in" };
      expect(evaluateCondition(condition, "visual")).toBe(false);
    });
  });

  describe("backward compatibility", () => {
    it("treats missing operator as eq", () => {
      const condition: AdaptCondition = { profileKey: "pace", value: "fast" };
      expect(evaluateCondition(condition, "fast")).toBe(true);
      expect(evaluateCondition(condition, "slow")).toBe(false);
    });

    it("handles unknown operator", () => {
      const condition = { profileKey: "x", operator: "unknown" as any, value: 1 };
      expect(evaluateCondition(condition, 1)).toBe(false);
    });
  });
});
