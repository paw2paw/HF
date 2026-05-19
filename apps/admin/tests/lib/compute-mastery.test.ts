/**
 * Tests for `computeModuleMastery` — #494 E2 Slice 2.2.
 *
 * Pure EMA computation over CallScore rows for (callerId, moduleId). The
 * function takes a `PrismaClient`-shaped argument so tests can pass a
 * lightweight stub (no real DB). Time is injected via `now` for
 * deterministic decay math.
 *
 * Coverage:
 *  1. evidenceCount < 3 → mastery=0, shouldMarkCompleted=false.
 *  2. 3 recent scores at 0.9 → mastery ≈ 0.9, completed (threshold 0.7, minCalls 3).
 *  3. minCallsToFull=10 blocks completion even at high mastery.
 *  4. Old scores fade — EMA biased toward recent.
 *  5. Mixed scores below threshold → not completed.
 *  6. Clamping: scores > 1 (corrupted upstream) → mastery clamped to 1.0.
 */

import { describe, it, expect, vi } from "vitest";
import {
  computeModuleMastery,
  DEFAULT_EMA_HALF_LIFE_DAYS,
  DEFAULT_MASTERY_THRESHOLD,
  DEFAULT_MIN_CALLS_TO_FULL,
  MASTERY_EMA_WINDOW,
  MASTERY_MIN_EVIDENCE,
} from "@/lib/curriculum/compute-mastery";

// =====================================================
// FIXTURES
// =====================================================

const CALLER_ID = "caller-1";
const MODULE_ID = "mod-1";
// Fixed clock so the decay math is deterministic across test runs.
const NOW = new Date("2026-05-19T12:00:00.000Z");
const DAY = 86_400_000;

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

/**
 * Build a minimal Prisma stub matching the surface area used by
 * `computeModuleMastery`: only `callScore.count` + `callScore.findMany`.
 */
function makePrismaStub(scores: Array<{ score: number; createdAt: Date }>) {
  // Match the helper's "take=10, order=desc" contract: hand back the most
  // recent first so the stub mirrors what Prisma would return.
  const sorted = [...scores].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return {
    callScore: {
      count: vi.fn(async () => scores.length),
      findMany: vi.fn(async (args: any) => {
        const take = args?.take ?? scores.length;
        return sorted.slice(0, take);
      }),
    },
  } as any;
}

// =====================================================
// TESTS
// =====================================================

describe("computeModuleMastery (#494 E2 Slice 2.2)", () => {
  it("returns mastery=0 when evidenceCount < MASTERY_MIN_EVIDENCE", async () => {
    const prisma = makePrismaStub([
      { score: 0.95, createdAt: daysAgo(0) },
      { score: 0.95, createdAt: daysAgo(1) },
    ]);

    const result = await computeModuleMastery(prisma, {
      callerId: CALLER_ID,
      moduleId: MODULE_ID,
      now: NOW,
    });

    expect(result.evidenceCount).toBe(2);
    expect(result.mastery).toBe(0);
    expect(result.shouldMarkCompleted).toBe(false);
    // findMany must not be called when we already know we're below the
    // evidence floor — saves a round-trip on every NOT_STARTED module.
    expect(prisma.callScore.findMany).not.toHaveBeenCalled();
    expect(MASTERY_MIN_EVIDENCE).toBe(3);
  });

  it("marks completed when 3 recent 0.9 scores clear threshold + minCalls", async () => {
    const prisma = makePrismaStub([
      { score: 0.9, createdAt: daysAgo(0) },
      { score: 0.9, createdAt: daysAgo(1) },
      { score: 0.9, createdAt: daysAgo(2) },
    ]);

    const result = await computeModuleMastery(prisma, {
      callerId: CALLER_ID,
      moduleId: MODULE_ID,
      masteryThreshold: 0.7,
      minCallsToFull: 3,
      now: NOW,
    });

    expect(result.evidenceCount).toBe(3);
    // All scores identical → weighted mean equals the score itself.
    expect(result.mastery).toBeCloseTo(0.9, 6);
    expect(result.shouldMarkCompleted).toBe(true);
  });

  it("blocks completion when minCallsToFull > evidenceCount even at high mastery", async () => {
    const prisma = makePrismaStub([
      { score: 0.95, createdAt: daysAgo(0) },
      { score: 0.95, createdAt: daysAgo(1) },
      { score: 0.95, createdAt: daysAgo(2) },
    ]);

    const result = await computeModuleMastery(prisma, {
      callerId: CALLER_ID,
      moduleId: MODULE_ID,
      masteryThreshold: 0.7,
      minCallsToFull: 10,
      now: NOW,
    });

    expect(result.evidenceCount).toBe(3);
    expect(result.mastery).toBeGreaterThan(0.9);
    expect(result.shouldMarkCompleted).toBe(false);
  });

  it("biases EMA toward recent scores when older entries are very old", async () => {
    // One fresh 0.9 + four near-zero scores from 60 days ago. The recent
    // score gets weight ~1.0; the old ones at 60 days with 14-day half-life
    // weigh exp(-ln2 * 60/14) ≈ 0.05. Weighted mean should sit close to 0.9.
    const prisma = makePrismaStub([
      { score: 0.9, createdAt: daysAgo(0) },
      { score: 0.1, createdAt: daysAgo(60) },
      { score: 0.1, createdAt: daysAgo(60) },
      { score: 0.1, createdAt: daysAgo(60) },
      { score: 0.1, createdAt: daysAgo(60) },
    ]);

    const result = await computeModuleMastery(prisma, {
      callerId: CALLER_ID,
      moduleId: MODULE_ID,
      emaHalfLifeDays: 14,
      now: NOW,
    });

    expect(result.mastery).toBeGreaterThan(0.7);
    // Sanity: a plain unweighted average of these 5 scores is 0.26, so the
    // EMA's bias toward recent has to be doing real work.
    const unweightedMean = (0.9 + 0.1 + 0.1 + 0.1 + 0.1) / 5;
    expect(unweightedMean).toBeCloseTo(0.26, 6);
    expect(result.mastery).toBeGreaterThan(unweightedMean + 0.3);
  });

  it("returns mastery below threshold for mixed 0.5/0.6/0.7 → not completed", async () => {
    const prisma = makePrismaStub([
      { score: 0.7, createdAt: daysAgo(0) },
      { score: 0.6, createdAt: daysAgo(1) },
      { score: 0.5, createdAt: daysAgo(2) },
    ]);

    const result = await computeModuleMastery(prisma, {
      callerId: CALLER_ID,
      moduleId: MODULE_ID,
      masteryThreshold: 0.7,
      minCallsToFull: 3,
      now: NOW,
    });

    expect(result.evidenceCount).toBe(3);
    // EMA biased toward recent (0.7) but the older lower scores still pull
    // the mean below 0.7 → no completion.
    expect(result.mastery).toBeLessThan(0.7);
    expect(result.mastery).toBeGreaterThan(0.5);
    expect(result.shouldMarkCompleted).toBe(false);
  });

  it("clamps mastery to [0, 1] when upstream scores overflow", async () => {
    // A bug elsewhere could write a CallScore.score > 1 (e.g. percent vs
    // ratio mix-up). Mastery must never propagate that.
    const prisma = makePrismaStub([
      { score: 1.4, createdAt: daysAgo(0) },
      { score: 1.4, createdAt: daysAgo(1) },
      { score: 1.4, createdAt: daysAgo(2) },
    ]);

    const result = await computeModuleMastery(prisma, {
      callerId: CALLER_ID,
      moduleId: MODULE_ID,
      now: NOW,
    });

    expect(result.evidenceCount).toBe(3);
    expect(result.mastery).toBe(1);
  });

  it("clamps negative weighted averages to 0", async () => {
    const prisma = makePrismaStub([
      { score: -0.5, createdAt: daysAgo(0) },
      { score: -0.5, createdAt: daysAgo(1) },
      { score: -0.5, createdAt: daysAgo(2) },
    ]);

    const result = await computeModuleMastery(prisma, {
      callerId: CALLER_ID,
      moduleId: MODULE_ID,
      now: NOW,
    });

    expect(result.mastery).toBe(0);
    expect(result.shouldMarkCompleted).toBe(false);
  });

  it("uses default threshold + minCalls + halfLife when overrides omitted", async () => {
    // 4 fresh 0.85 scores — should clear the 0.7 default threshold and the
    // default 4-call minimum, marking completed.
    const prisma = makePrismaStub([
      { score: 0.85, createdAt: daysAgo(0) },
      { score: 0.85, createdAt: daysAgo(0.5) },
      { score: 0.85, createdAt: daysAgo(1) },
      { score: 0.85, createdAt: daysAgo(1.5) },
    ]);

    const result = await computeModuleMastery(prisma, {
      callerId: CALLER_ID,
      moduleId: MODULE_ID,
      now: NOW,
    });

    expect(DEFAULT_MASTERY_THRESHOLD).toBe(0.7);
    expect(DEFAULT_MIN_CALLS_TO_FULL).toBe(4);
    expect(DEFAULT_EMA_HALF_LIFE_DAYS).toBe(14);
    expect(result.evidenceCount).toBe(4);
    expect(result.mastery).toBeCloseTo(0.85, 2);
    expect(result.shouldMarkCompleted).toBe(true);
  });

  it("caps the EMA window at MASTERY_EMA_WINDOW most-recent rows", async () => {
    // 15 rows; the helper must request only the most recent 10. Older rows
    // shouldn't poison the average even when the count column says otherwise.
    const rows = Array.from({ length: 15 }, (_, i) => ({
      score: i < 10 ? 0.9 : 0.1,
      createdAt: daysAgo(i),
    }));
    const prisma = makePrismaStub(rows);

    const result = await computeModuleMastery(prisma, {
      callerId: CALLER_ID,
      moduleId: MODULE_ID,
      now: NOW,
    });

    expect(result.evidenceCount).toBe(15);
    expect(MASTERY_EMA_WINDOW).toBe(10);
    // findMany should have been called with take=10.
    const findManyArgs = prisma.callScore.findMany.mock.calls[0][0];
    expect(findManyArgs.take).toBe(10);
    // The 10 most-recent rows are all 0.9 (oldest=9 days), so mastery is
    // very close to 0.9 — the 0.1 rows from days 10-14 aren't included.
    expect(result.mastery).toBeGreaterThan(0.85);
  });
});
