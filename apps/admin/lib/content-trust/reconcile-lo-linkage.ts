/**
 * reconcile-lo-linkage.ts
 *
 * Epic #131 A4 — populate `ContentAssertion.learningObjectiveId` by joining
 * the string `learningOutcomeRef` against `LearningObjective.ref` within the
 * curriculum scope.
 *
 * Two-pass reconciliation:
 *
 *   **Pass 1 — Structured ref matching** (original A4 logic, authoritative).
 *   Matches `learningOutcomeRef` strings against LO refs via `loRefsMatch`
 *   (word-boundary bidirectional). Handles "LO1"↔"R04-LO1" etc.
 *
 *   **Pass 2 — Semantic keyword matching** (#142).
 *   For assertions that still have no FK after pass 1 (null ref, free-text ref,
 *   or unmatched structured ref), scores assertion text against LO descriptions
 *   using Jaccard keyword overlap with category bonus. Best match above threshold
 *   gets the FK set. No AI calls — pure deterministic text similarity.
 *
 * Runs automatically from `syncModulesToDB` after every curriculum save, and
 * on-demand from the repair script (B2) and the extract route after first-pass
 * extraction (handles the temporal dependency where assertions are extracted
 * before LOs exist).
 *
 * The FK (`learningObjectiveId`) is the **single source of truth** for linkage.
 * The string `learningOutcomeRef` is preserved as write-time provenance — never
 * overwritten by semantic matching.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { loRefsMatch } from "@/lib/lesson-plan/lo-ref-match";
import { openAiEmbed, toVectorLiteral } from "@/lib/embeddings";

// ── Configuration ─────────────────────────────────────────

const SEMANTIC_LO_THRESHOLD = parseFloat(
  process.env.SEMANTIC_LO_THRESHOLD || "0.3",
);

// Pass 3 (vector / cosine similarity) threshold (issue #162).
const VECTOR_LO_THRESHOLD = parseFloat(
  process.env.VECTOR_LO_THRESHOLD || "0.6",
);

// ── Result types ──────────────────────────────────────────

export interface ReconcileResult {
  curriculumId: string;
  assertionsScanned: number;
  /** Pre-pass cleanup: stale refs/FKs cleared before matching */
  staleRefsCleared: number;
  staleFksCleared: number;
  /** Pass 1: FKs set via structured ref matching (linkConfidence = 1.0) */
  fkWritten: number;
  fkAlreadySet: number;
  noRefOnAssertion: number;
  refDidNotMatchAnyLo: number;
  /** Pass 2: FKs set via semantic keyword matching (linkConfidence = Jaccard score) */
  semanticFkWritten: number;
  semanticBelowThreshold: number;
  /** Pass 3: FKs set via vector cosine similarity (linkConfidence = cosine) — issue #162 */
  vectorFkWritten: number;
  vectorBelowThreshold: number;
  vectorNearMiss: number;
  avgVectorConfidence: number;
  assertionsByLoRef: Record<string, number>;
}

export interface ReconcileOptions {
  /** Set false to skip Pass 3. Default true. */
  runVectorPass?: boolean;
}

// ── Semantic scoring ──────────────────────────────────────

/** Stop words to exclude from keyword scoring */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "this", "that",
  "these", "those", "it", "its", "not", "no", "as", "if", "so", "than",
  "how", "what", "when", "where", "which", "who", "whom", "their",
  "they", "them", "we", "our", "you", "your", "he", "she", "his", "her",
]);

/**
 * Tokenise text into lowercase keyword set, stripping stop words and
 * short tokens. Designed for comparing assertion text against LO descriptions.
 */
export function tokenise(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Score how well an assertion matches an LO description.
 * Returns 0–1 where 1 = perfect overlap.
 *
 * Base: Jaccard-style overlap weighted toward the LO side
 * (how much of the LO description is covered by the assertion text).
 *
 * Category bonus: +0.1 when the assertion category semantically aligns
 * with the LO description (e.g. category "character" + LO mentioning
 * "character motivations").
 */
export function scoreMatch(
  assertionText: string,
  assertionCategory: string,
  loDescription: string,
): number {
  const aTokens = tokenise(assertionText);
  const loTokens = tokenise(loDescription);

  if (loTokens.size === 0 || aTokens.size === 0) return 0;

  let overlap = 0;
  for (const t of loTokens) {
    if (aTokens.has(t)) overlap++;
  }

  // Base score: fraction of LO keywords found in assertion
  const base = overlap / loTokens.size;

  // Category bonus: if the assertion category appears as a keyword in the LO
  const catTokens = tokenise(assertionCategory.replace(/_/g, " "));
  let catBonus = 0;
  for (const ct of catTokens) {
    if (loTokens.has(ct)) {
      catBonus = 0.1;
      break;
    }
  }

  return Math.min(1, base + catBonus);
}

// ── Main reconciler ───────────────────────────────────────

/**
 * For every ContentAssertion reachable from this curriculum's sources that
 * has a non-null `learningOutcomeRef`, try to set `learningObjectiveId` by
 * matching against the curriculum's `LearningObjective` rows.
 *
 * Pass 1: Structured ref matching (original logic).
 * Pass 2: Semantic keyword matching for assertions still without FK.
 *
 * Idempotent — assertions that already have the FK set are left alone.
 * Safe to call on every curriculum save.
 */
export async function reconcileAssertionLOs(
  curriculumId: string,
  options: ReconcileOptions = {},
): Promise<ReconcileResult> {
  const runVectorPass = options.runVectorPass !== false;
  const curriculum = await prisma.curriculum.findUnique({
    where: { id: curriculumId },
    select: {
      id: true,
      subjectId: true,
      modules: {
        where: { isActive: true },
        select: {
          id: true,
          learningObjectives: {
            select: { id: true, ref: true, description: true },
          },
        },
      },
    },
  });

  const empty: ReconcileResult = {
    curriculumId,
    assertionsScanned: 0,
    staleRefsCleared: 0,
    staleFksCleared: 0,
    fkWritten: 0,
    fkAlreadySet: 0,
    noRefOnAssertion: 0,
    refDidNotMatchAnyLo: 0,
    semanticFkWritten: 0,
    semanticBelowThreshold: 0,
    vectorFkWritten: 0,
    vectorBelowThreshold: 0,
    vectorNearMiss: 0,
    avgVectorConfidence: 0,
    assertionsByLoRef: {},
  };

  if (!curriculum) return empty;

  // Flatten LOs to (ref, id, description) — first occurrence wins per ref
  const loByRef = new Map<string, { id: string; ref: string; description: string }>();
  const loArray: { id: string; ref: string; description: string }[] = [];
  for (const mod of curriculum.modules) {
    for (const lo of mod.learningObjectives) {
      if (!loByRef.has(lo.ref)) {
        const entry = { id: lo.id, ref: lo.ref, description: lo.description };
        loByRef.set(lo.ref, entry);
        loArray.push(entry);
      }
    }
  }

  if (loArray.length === 0) return empty;

  // Resolve source IDs via the subject link chain
  const subjectSources = await prisma.subjectSource.findMany({
    where: { subjectId: curriculum.subjectId ?? undefined },
    select: { sourceId: true },
  });
  const sourceIds = [...new Set(subjectSources.map((s) => s.sourceId))];
  if (sourceIds.length === 0) return empty;

  // ── Pre-pass: clear stale state ──────────────────────────
  // Two failure modes accumulate refs/FKs that point to nothing:
  //
  //   1. Per-source AI extractor wrote `learningOutcomeRef = "LO13"` using the
  //      OLD curriculum's LO list; a subsequent regenerate produced a smaller
  //      curriculum (LO1-LO12) and "LO13" no longer exists.
  //
  //   2. A previous reconcile run set `learningObjectiveId` to an LO that has
  //      since been deactivated (mode: "replace" in syncModulesToDB), so the
  //      FK now points at an inactive row. The current reconciler treats any
  //      non-null FK as "already set" and skips it — so stale FKs persist
  //      forever and block re-binding to the new active LO.
  //
  // Both cases: null out the stale field before pass 1 so the assertion
  // re-enters the matching pipeline cleanly. Idempotent — assertions with
  // valid refs/FKs are not touched.
  const validRefs = new Set(loArray.map((lo) => lo.ref));
  const validLoIds = new Set(loArray.map((lo) => lo.id));

  const staleRefs = await prisma.contentAssertion.updateMany({
    where: {
      sourceId: { in: sourceIds },
      learningOutcomeRef: { not: null },
      NOT: { learningOutcomeRef: { in: [...validRefs] } },
    },
    data: { learningOutcomeRef: null },
  });

  const staleFks = await prisma.contentAssertion.updateMany({
    where: {
      sourceId: { in: sourceIds },
      learningObjectiveId: { not: null },
      NOT: { learningObjectiveId: { in: [...validLoIds] } },
    },
    data: { learningObjectiveId: null },
  });

  const assertions = await prisma.contentAssertion.findMany({
    where: { sourceId: { in: sourceIds } },
    select: {
      id: true,
      assertion: true,
      category: true,
      learningOutcomeRef: true,
      learningObjectiveId: true,
    },
  });

  const result: ReconcileResult = {
    ...empty,
    assertionsScanned: assertions.length,
    staleRefsCleared: staleRefs.count,
    staleFksCleared: staleFks.count,
  };

  // ── Pass 1: Structured ref matching ─────────────────────
  // Collect assertions that need pass 2 (no FK after pass 1)
  const needsSemantic: typeof assertions = [];

  for (const a of assertions) {
    if (a.learningObjectiveId) {
      result.fkAlreadySet++;
      continue;
    }
    if (!a.learningOutcomeRef) {
      // No string ref — can't do structured match, try semantic
      needsSemantic.push(a);
      result.noRefOnAssertion++;
      continue;
    }

    const match = loArray.find((lo) => loRefsMatch(a.learningOutcomeRef, lo.ref));
    if (match) {
      // Collect for batch update instead of N+1
      if (!result.assertionsByLoRef[match.ref]) {
        result.assertionsByLoRef[match.ref] = 0;
      }
      result.assertionsByLoRef[match.ref]++;
      result.fkWritten++;
      // Stage for batch: tag with the matched LO id
      (a as any)._matchedLoId = match.id;
    } else {
      result.refDidNotMatchAnyLo++;
      needsSemantic.push(a);
    }
  }

  // Batch update pass 1 results
  const pass1ByLoId = new Map<string, string[]>();
  for (const a of assertions) {
    const matchedId = (a as any)._matchedLoId;
    if (matchedId) {
      const list = pass1ByLoId.get(matchedId) || [];
      list.push(a.id);
      pass1ByLoId.set(matchedId, list);
    }
  }
  for (const [loId, assertionIds] of pass1ByLoId) {
    // Pass 1 writes linkConfidence = 1.0 (exact ref match is ground truth).
    // Idempotency rule: we only touch rows that had no FK at the start of
    // this run, so we cannot overwrite a higher-confidence manual edit.
    await prisma.contentAssertion.updateMany({
      where: { id: { in: assertionIds } },
      data: { learningObjectiveId: loId, linkConfidence: 1.0 },
    });
  }

  // ── Pass 2: Semantic keyword matching ───────────────────
  // Pre-tokenise LO descriptions once
  const loTokensCache = new Map<string, Set<string>>();
  for (const lo of loArray) {
    loTokensCache.set(lo.id, tokenise(lo.description));
  }

  // Track which assertions Pass 2 matched so Pass 3 can skip them. Pass 3
  // runs per-row (score is the confidence), so we update one row at a time
  // rather than batching — still cheap, ~100 rows per course.
  const pass2Matched = new Set<string>();

  // Pass 2 writes per-row so we can persist the individual Jaccard score as
  // linkConfidence. Each write also sets `learningOutcomeRef` (back-filled)
  // so the next reconcile run can short-circuit in Pass 1.
  for (const a of needsSemantic) {
    let bestScore = 0;
    let bestLo: { id: string; ref: string } | null = null;

    for (const lo of loArray) {
      const score = scoreMatch(a.assertion, a.category, lo.description);
      if (score > bestScore) {
        bestScore = score;
        bestLo = lo;
      }
    }

    if (bestLo && bestScore >= SEMANTIC_LO_THRESHOLD) {
      await prisma.contentAssertion.update({
        where: { id: a.id },
        data: {
          learningObjectiveId: bestLo.id,
          learningOutcomeRef: bestLo.ref,
          linkConfidence: bestScore,
        },
      });
      pass2Matched.add(a.id);
      result.semanticFkWritten++;
      result.assertionsByLoRef[bestLo.ref] = (result.assertionsByLoRef[bestLo.ref] ?? 0) + 1;
    } else {
      result.semanticBelowThreshold++;
    }
  }

  // ── Pass 3: Vector cosine similarity ────────────────────
  // Issue #162. For assertions still orphaned after Pass 2, embed their text
  // (reusing the pgvector column when already populated) and the LO
  // descriptions, compute cosine similarity, and link when score >=
  // VECTOR_LO_THRESHOLD. In-memory only — LOs do not persist embeddings.
  if (runVectorPass) {
    const stillOrphan = needsSemantic.filter((a) => !pass2Matched.has(a.id));
    if (stillOrphan.length > 0) {
      const { matched, nearMiss, belowThreshold, avgConfidence } =
        await runVectorReconcile(stillOrphan, loArray);
      result.vectorFkWritten = matched;
      result.vectorBelowThreshold = belowThreshold;
      result.vectorNearMiss = nearMiss;
      result.avgVectorConfidence = avgConfidence;
    }
  }

  console.log(
    `[reconcile-lo-linkage] curriculum=${curriculumId}: scanned=${result.assertionsScanned} ` +
      `cleared-stale-refs=${result.staleRefsCleared} cleared-stale-fks=${result.staleFksCleared} ` +
      `pass1=${result.fkWritten} pass2-jaccard=${result.semanticFkWritten} ` +
      `pass3-vector=${result.vectorFkWritten} (avg=${result.avgVectorConfidence.toFixed(2)} ` +
      `near-miss=${result.vectorNearMiss} below=${result.vectorBelowThreshold}) ` +
      `alreadySet=${result.fkAlreadySet} noRef=${result.noRefOnAssertion} ` +
      `unmatched-ref=${result.refDidNotMatchAnyLo} jaccard-below=${result.semanticBelowThreshold} ` +
      `(jaccardThreshold=${SEMANTIC_LO_THRESHOLD} vectorThreshold=${VECTOR_LO_THRESHOLD})`,
  );

  return result;
}

// ── Pass 3: Vector cosine similarity ──────────────────────────

type OrphanAssertion = {
  id: string;
  assertion: string;
  category: string;
  learningOutcomeRef: string | null;
  learningObjectiveId: string | null;
};

type LoRow = { id: string; ref: string; description: string };

/**
 * Reconcile orphan assertions against LO descriptions via pgvector cosine
 * similarity. Reuses the existing `ContentAssertion.embedding` column when
 * populated; embeds missing rows on-demand via `openAiEmbed`. LO descriptions
 * are embedded in-memory per call — no schema change for LearningObjective.
 */
async function runVectorReconcile(
  orphans: OrphanAssertion[],
  los: LoRow[],
): Promise<{
  matched: number;
  nearMiss: number;
  belowThreshold: number;
  avgConfidence: number;
}> {
  // 1. Fetch existing embeddings for these orphan IDs (may be null)
  const orphanIds = orphans.map((o) => o.id);
  const existingRows = await prisma.$queryRaw<
    Array<{ id: string; embedding: number[] | null }>
  >(
    Prisma.sql`SELECT id, embedding::real[] AS embedding FROM "ContentAssertion" WHERE id = ANY(${orphanIds})`,
  );
  const existingMap = new Map<string, number[] | null>();
  for (const row of existingRows) {
    existingMap.set(row.id, row.embedding ?? null);
  }

  // 2. Embed the assertions that don't yet have one
  const needsEmbedding = orphans.filter((o) => {
    const emb = existingMap.get(o.id);
    return !emb || emb.length === 0;
  });
  if (needsEmbedding.length > 0) {
    const freshEmbeddings = await openAiEmbed(needsEmbedding.map((o) => o.assertion));
    for (let i = 0; i < needsEmbedding.length; i++) {
      const o = needsEmbedding[i];
      const emb = freshEmbeddings[i];
      if (!emb || emb.length === 0) continue;
      existingMap.set(o.id, emb);
      // Persist so future runs skip this (cheap write, amortises)
      await prisma.$executeRaw(
        Prisma.sql`UPDATE "ContentAssertion" SET embedding = ${toVectorLiteral(emb)}::vector WHERE id = ${o.id}`,
      );
    }
  }

  // 3. Embed all LO descriptions in one batch (in-memory only)
  const loTexts = los.map((lo) => lo.description).filter((d) => d && d.trim().length > 0);
  if (loTexts.length === 0) {
    return { matched: 0, nearMiss: 0, belowThreshold: orphans.length, avgConfidence: 0 };
  }
  const loEmbeddings = await openAiEmbed(los.map((lo) => lo.description || " "));

  // 4. For each orphan, compute cosine against every LO and pick the best
  let matched = 0;
  let nearMiss = 0;
  let belowThreshold = 0;
  const confidences: number[] = [];

  for (const o of orphans) {
    const orphanEmb = existingMap.get(o.id);
    if (!orphanEmb || orphanEmb.length === 0) {
      belowThreshold++;
      continue;
    }
    let bestScore = 0;
    let bestLo: LoRow | null = null;
    for (let i = 0; i < los.length; i++) {
      const loEmb = loEmbeddings[i];
      if (!loEmb) continue;
      const score = cosineSimilarity(orphanEmb, loEmb);
      if (score > bestScore) {
        bestScore = score;
        bestLo = los[i];
      }
    }
    if (!bestLo) {
      belowThreshold++;
      continue;
    }
    if (bestScore >= 0.4 && bestScore < VECTOR_LO_THRESHOLD) {
      nearMiss++;
      console.debug(
        `[pass3 near-miss] assertion=${o.id} lo=${bestLo.id} score=${bestScore.toFixed(3)}`,
      );
    }
    if (bestScore >= VECTOR_LO_THRESHOLD) {
      await prisma.contentAssertion.update({
        where: { id: o.id },
        data: {
          learningObjectiveId: bestLo.id,
          learningOutcomeRef: bestLo.ref,
          linkConfidence: bestScore,
        },
      });
      matched++;
      confidences.push(bestScore);
    } else {
      belowThreshold++;
    }
  }

  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

  return { matched, nearMiss, belowThreshold, avgConfidence };
}

/** Cosine similarity of two equal-length numeric vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
