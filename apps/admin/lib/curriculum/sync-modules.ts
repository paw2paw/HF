/**
 * sync-modules.ts
 *
 * Shared utility for dual-writing curriculum modules to both JSON (notableInfo)
 * and first-class CurriculumModule + LearningObjective records.
 *
 * Used by:
 * - POST /api/subjects/:subjectId/curriculum (save mode)
 * - POST /api/courses/generate-plan
 * - PATCH /api/subjects/:subjectId/curriculum
 */

import { prisma } from "@/lib/prisma";
import type { LegacyCurriculumModuleJSON } from "@/lib/types/json-fields";
import { parseLoLine } from "@/lib/content-trust/validate-lo-linkage";
import { reconcileAssertionLOs, type ReconcileResult } from "@/lib/content-trust/reconcile-lo-linkage";

// ---------------------------------------------------------------------------
// syncModulesToDB — upserts CurriculumModule + LO records from JSON modules
// ---------------------------------------------------------------------------

/**
 * Upsert CurriculumModule and LearningObjective records from legacy JSON modules.
 * Runs in a transaction. Idempotent — safe to call on every save.
 *
 * @param curriculumId - The curriculum these modules belong to
 * @param modules - Legacy JSON module array (from AI generation or user edits)
 * @returns Count of modules synced
 */
export async function syncModulesToDB(
  curriculumId: string,
  modules: LegacyCurriculumModuleJSON[],
): Promise<{ count: number; reconcile: ReconcileResult | null }> {
  if (!modules || modules.length === 0) return { count: 0, reconcile: null };

  const result = await prisma.$transaction(async (tx) => {
    const synced: string[] = [];

    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      const slug = mod.id || `MOD-${i + 1}`;

      const upserted = await tx.curriculumModule.upsert({
        where: { curriculumId_slug: { curriculumId, slug } },
        create: {
          curriculumId,
          slug,
          title: mod.title || slug,
          description: mod.description || null,
          sortOrder: mod.sortOrder ?? i,
          estimatedDurationMinutes: mod.estimatedDurationMinutes || null,
          keyTerms: mod.keyTerms || [],
          assessmentCriteria: mod.assessmentCriteria || [],
        },
        update: {
          title: mod.title || slug,
          description: mod.description || null,
          sortOrder: mod.sortOrder ?? i,
          estimatedDurationMinutes: mod.estimatedDurationMinutes || null,
          keyTerms: mod.keyTerms || [],
          assessmentCriteria: mod.assessmentCriteria || [],
        },
      });

      // Sync learning objectives if provided.
      //
      // GUARD (epic #131 A1): reject malformed lines rather than fabricating
      // synthetic `LO-${index+1}` refs with garbage descriptions. parseLoLine
      // returns null when the AI failed to produce a `LOn: description` pair,
      // and we skip + log so the caller can surface a data-quality warning.
      // This is the structural fix per .claude/rules/ai-to-db-guard.md.
      if (mod.learningOutcomes && mod.learningOutcomes.length > 0) {
        const parsed: { ref: string; description: string; sortOrder: number }[] = [];
        const skipped: { raw: string; reason: string }[] = [];
        const seenRefs = new Set<string>();

        for (let j = 0; j < mod.learningOutcomes.length; j++) {
          const raw = mod.learningOutcomes[j];
          const line = parseLoLine(raw);
          if (!line) {
            skipped.push({ raw, reason: "not a valid `LOn: description` pair" });
            continue;
          }
          if (seenRefs.has(line.ref)) {
            skipped.push({ raw, reason: `duplicate ref within module: ${line.ref}` });
            continue;
          }
          seenRefs.add(line.ref);
          parsed.push({ ref: line.ref, description: line.description, sortOrder: j });
        }

        if (skipped.length > 0) {
          console.warn(
            `[sync-modules] Module ${upserted.slug}: skipped ${skipped.length}/${mod.learningOutcomes.length} LOs — ` +
              skipped.map((s) => `"${s.raw}" (${s.reason})`).join("; "),
          );
        }

        await tx.learningObjective.deleteMany({ where: { moduleId: upserted.id } });

        for (const lo of parsed) {
          await tx.learningObjective.create({
            data: {
              moduleId: upserted.id,
              ref: lo.ref,
              description: lo.description,
              sortOrder: lo.sortOrder,
            },
          });
        }
      }

      synced.push(upserted.id);
    }

    // Deactivate modules that no longer exist in the JSON
    const currentSlugs = modules.map((m, i) => m.id || `MOD-${i + 1}`);
    await tx.curriculumModule.updateMany({
      where: {
        curriculumId,
        slug: { notIn: currentSlugs },
        isActive: true,
      },
      data: { isActive: false },
    });

    return synced;
  });

  // Epic #131 A4 — after LOs are written, reconcile existing assertions'
  // learningObjectiveId FK by matching learningOutcomeRef strings against the
  // newly-persisted LO rows. This closes the temporal dependency: assertions
  // extracted before the curriculum existed (and tagged with string refs by
  // the curriculum-aware extractor A2) now get their FK populated without a
  // manual backfill. Idempotent — already-linked assertions are skipped.
  let reconcile: ReconcileResult | null = null;
  try {
    reconcile = await reconcileAssertionLOs(curriculumId);
  } catch (err) {
    console.error(`[sync-modules] reconcileAssertionLOs failed for curriculum ${curriculumId}:`, err);
    // Non-fatal — curriculum save itself succeeded.
  }

  return { count: result.length, reconcile };
}
