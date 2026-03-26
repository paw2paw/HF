/**
 * Tests for lesson-planner.ts extensions:
 * - topologicalSortAssertions (prerequisite ordering)
 * - computeSessionCountRecommendation
 * - runAdvisoryChecks (4 checks)
 */
import { describe, it, expect } from "vitest";
import {
  topologicalSortAssertions,
  computeSessionCountRecommendation,
  runAdvisoryChecks,
  type LessonSession,
} from "@/lib/content-trust/lesson-planner";

// ------------------------------------------------------------------
// Topological sort
// ------------------------------------------------------------------

describe("topologicalSortAssertions", () => {
  it("returns original order when no parentId links exist", () => {
    const assertions = [
      { id: "a", parentId: null, depth: 2 },
      { id: "b", parentId: null, depth: 0 },
      { id: "c", parentId: null, depth: 1 },
    ];
    const sorted = topologicalSortAssertions(assertions);
    expect(sorted.map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts parents before children in a linear chain", () => {
    const assertions = [
      { id: "c", parentId: "b", depth: 2 },
      { id: "a", parentId: null, depth: 0 },
      { id: "b", parentId: "a", depth: 1 },
    ];
    const sorted = topologicalSortAssertions(assertions);
    const ids = sorted.map((a) => a.id);

    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("c"));
  });

  it("handles diamond dependency (A → B, A → C, B → D, C → D)", () => {
    const assertions = [
      { id: "d", parentId: "b", depth: 2 },
      { id: "b", parentId: "a", depth: 1 },
      { id: "c", parentId: "a", depth: 1 },
      { id: "a", parentId: null, depth: 0 },
    ];
    // D also has a second parent C, but parentId is single-valued
    // so d.parentId = "b" only. Test that A comes before B and C.
    const sorted = topologicalSortAssertions(assertions);
    const ids = sorted.map((a) => a.id);

    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("c"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("d"));
  });

  it("throws on cycle detection", () => {
    const assertions = [
      { id: "a", parentId: "b", depth: 0 },
      { id: "b", parentId: "a", depth: 0 },
    ];
    expect(() => topologicalSortAssertions(assertions)).toThrow(/Cycle detected/);
  });

  it("ignores parentId references to assertions outside the set", () => {
    const assertions = [
      { id: "a", parentId: "external-id", depth: 0 },
      { id: "b", parentId: "a", depth: 1 },
    ];
    const sorted = topologicalSortAssertions(assertions);
    const ids = sorted.map((a) => a.id);
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
  });

  it("handles mixed: some with parentId, some without", () => {
    const assertions = [
      { id: "c", parentId: "a", depth: 1 },
      { id: "a", parentId: null, depth: 0 },
      { id: "b", parentId: null, depth: 0 },
      { id: "d", parentId: "c", depth: 2 },
    ];
    const sorted = topologicalSortAssertions(assertions);
    const ids = sorted.map((a) => a.id);

    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("c"));
    expect(ids.indexOf("c")).toBeLessThan(ids.indexOf("d"));
    // b has no dependencies, can be anywhere
    expect(ids).toContain("b");
  });
});

// ------------------------------------------------------------------
// Session count recommendation
// ------------------------------------------------------------------

describe("computeSessionCountRecommendation", () => {
  const defaultConfig = { maxTpsPerSession: 10, reviewFrequency: 3, assessmentStyle: "light" as const };

  it("recommends correct session count for standard course", () => {
    // 30 TPs, 5 modules, 15 min sessions
    // effectiveMaxTPs = 10 * (15/15) = 10
    // teaching = ceil(30/10) = 3
    // review = floor(5/3) = 1
    // assess = 1 (light)
    // total = 1 + 3 + 1 + 1 + 1 = 7
    const rec = computeSessionCountRecommendation(30, 5, defaultConfig, 15);
    expect(rec.recommended).toBe(7);
    expect(rec.breakdown.onboarding).toBe(1);
    expect(rec.breakdown.teaching).toBe(3);
    expect(rec.breakdown.review).toBe(1);
    expect(rec.breakdown.assess).toBe(1);
    expect(rec.breakdown.consolidation).toBe(1);
    expect(rec.effectiveMaxTPs).toBe(10);
  });

  it("scales effectiveMaxTPs with session duration", () => {
    // 30 min sessions → effectiveMaxTPs = 10 * (30/15) = 20
    const rec = computeSessionCountRecommendation(30, 5, defaultConfig, 30);
    expect(rec.effectiveMaxTPs).toBe(20);
    // teaching = ceil(30/20) = 2
    expect(rec.breakdown.teaching).toBe(2);
  });

  it("handles reviewFrequency=0 (no review sessions)", () => {
    const noReview = { ...defaultConfig, reviewFrequency: 0 };
    const rec = computeSessionCountRecommendation(20, 4, noReview, 15);
    expect(rec.breakdown.review).toBe(0);
  });

  it("handles assessmentStyle=none (no assess session)", () => {
    const noAssess = { ...defaultConfig, assessmentStyle: "none" as const };
    const rec = computeSessionCountRecommendation(20, 4, noAssess, 15);
    expect(rec.breakdown.assess).toBe(0);
  });

  it("min is always at least 2", () => {
    const rec = computeSessionCountRecommendation(1, 1, defaultConfig, 15);
    expect(rec.min).toBeGreaterThanOrEqual(2);
  });

  it("max is always >= recommended", () => {
    const rec = computeSessionCountRecommendation(50, 8, defaultConfig, 15);
    expect(rec.max).toBeGreaterThanOrEqual(rec.recommended);
  });

  it("returns totalTPs and totalModules in response", () => {
    const rec = computeSessionCountRecommendation(42, 7, defaultConfig, 20);
    expect(rec.totalTPs).toBe(42);
    expect(rec.totalModules).toBe(7);
  });
});

// ------------------------------------------------------------------
// Advisory checks
// ------------------------------------------------------------------

describe("runAdvisoryChecks", () => {
  function makeSession(
    num: number,
    assertionIds: string[],
    type: LessonSession["sessionType"] = "introduce",
  ): LessonSession {
    return {
      sessionNumber: num,
      title: `Session ${num}`,
      objectives: [],
      assertionIds,
      questionIds: [],
      vocabularyIds: [],
      estimatedMinutes: 15,
      sessionType: type,
    };
  }

  it("detects overloaded sessions", () => {
    const sessions = [
      makeSession(1, Array.from({ length: 15 }, (_, i) => `a${i}`)),
    ];
    const checks = runAdvisoryChecks(sessions, [], 10);

    const overloaded = checks.find((c) => c.id === "overloaded_session");
    expect(overloaded).toBeDefined();
    expect(overloaded!.severity).toBe("warning");
    expect(overloaded!.message).toContain("15 teaching points");
    expect(overloaded!.affectedSessions).toEqual([1]);
  });

  it("does not flag assess/review sessions as overloaded", () => {
    const sessions = [
      makeSession(1, Array.from({ length: 15 }, (_, i) => `a${i}`), "assess"),
    ];
    const checks = runAdvisoryChecks(sessions, [], 10);
    expect(checks.find((c) => c.id === "overloaded_session")).toBeUndefined();
  });

  it("detects thin sessions", () => {
    const sessions = [
      makeSession(1, ["a1", "a2"]),
    ];
    const checks = runAdvisoryChecks(sessions, [], 10);

    const thin = checks.find((c) => c.id === "thin_session");
    expect(thin).toBeDefined();
    expect(thin!.severity).toBe("info");
  });

  it("does not flag empty sessions as thin", () => {
    // Empty sessions (e.g., onboarding) shouldn't trigger thin check
    const sessions = [makeSession(1, [])];
    const checks = runAdvisoryChecks(sessions, [], 10);
    expect(checks.find((c) => c.id === "thin_session")).toBeUndefined();
  });

  it("detects unassigned TPs", () => {
    const sessions = [makeSession(1, ["a1", "a2"])];
    const assertions = [
      { id: "a1", parentId: null },
      { id: "a2", parentId: null },
      { id: "a3", parentId: null }, // not in any session
    ];
    const checks = runAdvisoryChecks(sessions, assertions, 10);

    const unassigned = checks.find((c) => c.id === "unassigned_tps");
    expect(unassigned).toBeDefined();
    expect(unassigned!.severity).toBe("warning");
    expect(unassigned!.message).toContain("1 teaching point");
  });

  it("detects prerequisite violations", () => {
    const sessions = [
      makeSession(1, ["child"]),  // child in session 1
      makeSession(2, ["parent"]), // parent in session 2 — violation!
    ];
    const assertions = [
      { id: "parent", parentId: null },
      { id: "child", parentId: "parent" },
    ];
    const checks = runAdvisoryChecks(sessions, assertions, 10);

    const violation = checks.find((c) => c.id === "prerequisite_violation");
    expect(violation).toBeDefined();
    expect(violation!.severity).toBe("error");
    expect(violation!.affectedSessions).toContain(1);
    expect(violation!.affectedSessions).toContain(2);
  });

  it("does not flag prerequisite when parent is in earlier session", () => {
    const sessions = [
      makeSession(1, ["parent"]), // parent first — correct
      makeSession(2, ["child"]),
    ];
    const assertions = [
      { id: "parent", parentId: null },
      { id: "child", parentId: "parent" },
    ];
    const checks = runAdvisoryChecks(sessions, assertions, 10);
    expect(checks.find((c) => c.id === "prerequisite_violation")).toBeUndefined();
  });

  it("returns empty array when everything is fine", () => {
    const sessions = [
      makeSession(1, ["a1", "a2", "a3", "a4", "a5"]),
      makeSession(2, ["a6", "a7", "a8", "a9", "a10"]),
    ];
    const assertions = sessions.flatMap((s) =>
      s.assertionIds.map((id) => ({ id, parentId: null })),
    );
    const checks = runAdvisoryChecks(sessions, assertions, 10);
    expect(checks).toEqual([]);
  });
});
