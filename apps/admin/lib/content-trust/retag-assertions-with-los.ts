/**
 * retag-assertions-with-los.ts
 *
 * After a curriculum is generated from assertions, most assertions still have
 * `learningOutcomeRef = null` because the original extractor ran before any
 * LOs existed. This module closes the loop: given a curriculumId, it finds
 * every assertion linked to the curriculum's subjects with a null ref and
 * asks the AI to tag each one with the best-matching LO ref (or null if none
 * fits). The string write lets `reconcileAssertionLOs` bind FKs on the next
 * pass via its fast string-matching path.
 *
 * Structural guard per .claude/rules/ai-to-db-guard.md: the AI response is
 * validated against the known LO ref whitelist before any DB write. Unknown
 * refs are coerced to null, not fabricated into the DB.
 */

import { prisma } from "@/lib/prisma";
import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";

/** Minimal JSON parser — tolerates the AI wrapping the payload in prose. */
function parseJSON(content: string): unknown {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export interface RetagResult {
  assertionsScanned: number;
  aiCallMade: boolean;
  refsWritten: number;
  nullKept: number;
  skipped: number;
  error?: string;
}

const EMPTY: RetagResult = {
  assertionsScanned: 0,
  aiCallMade: false,
  refsWritten: 0,
  nullKept: 0,
  skipped: 0,
};

/**
 * Retag null-ref assertions linked to a curriculum with the best-matching
 * LO ref. Idempotent: assertions that already have a ref are left alone.
 */
export async function retagAssertionsWithLOs(curriculumId: string): Promise<RetagResult> {
  // 1. Load the curriculum + its LOs
  const curriculum = await prisma.curriculum.findUnique({
    where: { id: curriculumId },
    select: {
      subjectId: true,
      modules: {
        where: { isActive: true },
        select: {
          learningObjectives: { select: { ref: true, description: true } },
        },
      },
    },
  });

  if (!curriculum?.subjectId) return { ...EMPTY, error: "curriculum or subject missing" };

  const los = curriculum.modules.flatMap((m) => m.learningObjectives);
  if (los.length === 0) return { ...EMPTY, error: "no LOs on curriculum" };

  // 2. Find null-ref assertions linked to this subject
  const assertions = await prisma.contentAssertion.findMany({
    where: {
      learningOutcomeRef: null,
      subjectSource: { subjectId: curriculum.subjectId },
      // Exclude non-teaching assertion categories — they shouldn't be
      // tagged against student-facing learning outcomes.
      NOT: { category: { in: ["course_overview", "tutor_guidance", "session_metadata"] } },
    },
    select: { id: true, assertion: true, category: true },
  });

  if (assertions.length === 0) return EMPTY;

  // Cap to a reasonable batch. Beyond ~300 assertions the prompt gets large
  // and the AI starts dropping entries. Run in chunks if over the cap.
  const CHUNK = 200;
  const result: RetagResult = { ...EMPTY, assertionsScanned: assertions.length };
  const validRefs = new Set(los.map((lo) => lo.ref));

  for (let offset = 0; offset < assertions.length; offset += CHUNK) {
    const chunk = assertions.slice(offset, offset + CHUNK);

    const loList = los.map((lo) => `  ${lo.ref}: ${lo.description}`).join("\n");
    const assertionList = chunk
      .map((a, i) => `  [${i}] (${a.category || "fact"}) ${a.assertion}`)
      .join("\n");

    const systemPrompt = `You are a curriculum tagging specialist. Given a list of learning outcomes and a list of teaching assertions, your job is to tag each assertion with the single best-matching learning outcome ref, or null if no outcome fits.

Rules:
1. Match by topic relevance — which LO does this assertion most directly support?
2. Use only ref strings from the provided LO list. Never invent new refs.
3. If an assertion is generic, ambiguous, or doesn't clearly support any LO, return null.
4. Return a single assertion to exactly one LO — no multi-tagging.

Return valid JSON only with this shape:
{
  "tags": [
    { "i": 0, "ref": "LO1" },
    { "i": 1, "ref": null },
    { "i": 2, "ref": "LO4" }
  ]
}

Every assertion index from 0 to N-1 must appear exactly once in the tags array.`;

    const userPrompt = `LEARNING OUTCOMES:
${loList}

ASSERTIONS TO TAG (${chunk.length}):
${assertionList}

Tag each assertion with a matching LO ref or null.`;

    try {
      // @ai-call content-trust.retag-assertions — Tag null-ref assertions with best-matching LO ref | config: /x/ai-config
      const response = await getConfiguredMeteredAICompletion({
        callPoint: "content-trust.retag-assertions",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      result.aiCallMade = true;

      const parsed = parseJSON(response.content || "") as { tags?: Array<{ i: number; ref: string | null }> } | null;
      const tags = Array.isArray(parsed?.tags) ? parsed.tags : [];

      // Structural guard: validate each tag against the whitelist before
      // writing. Unknown refs get coerced to null rather than fabricated.
      const updatesByRef = new Map<string, string[]>(); // ref -> assertionIds
      for (const t of tags) {
        if (typeof t.i !== "number" || t.i < 0 || t.i >= chunk.length) continue;
        const assertionId = chunk[t.i].id;
        if (t.ref === null || t.ref === undefined) {
          result.nullKept++;
          continue;
        }
        if (!validRefs.has(t.ref)) {
          console.warn(`[retag-assertions] AI returned unknown ref "${t.ref}" — skipping assertion ${assertionId}`);
          result.skipped++;
          continue;
        }
        const list = updatesByRef.get(t.ref) || [];
        list.push(assertionId);
        updatesByRef.set(t.ref, list);
      }

      for (const [ref, ids] of updatesByRef) {
        await prisma.contentAssertion.updateMany({
          where: { id: { in: ids } },
          data: { learningOutcomeRef: ref },
        });
        result.refsWritten += ids.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[retag-assertions] AI call failed for curriculum ${curriculumId}:`, msg);
      result.error = msg;
      break;
    }
  }

  console.log(
    `[retag-assertions] curriculum=${curriculumId}: scanned=${result.assertionsScanned} ` +
      `refsWritten=${result.refsWritten} nullKept=${result.nullKept} skipped=${result.skipped}`,
  );

  return result;
}
