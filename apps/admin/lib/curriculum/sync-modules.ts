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

// ---------------------------------------------------------------------------
// LO ref parsing — extract short ref from text like "LO1: Identify..."
// ---------------------------------------------------------------------------

const LO_REF_PATTERN = /^(LO\d+|AC[\d.]+|R\d+-LO\d+(?:-AC[\d.]+)?)\s*[:\-–]\s*/i;

function parseLORef(text: string, index: number): { ref: string; description: string } {
  const match = text.match(LO_REF_PATTERN);
  if (match) {
    return { ref: match[1].toUpperCase(), description: text.slice(match[0].length).trim() || text };
  }
  return { ref: `LO-${index + 1}`, description: text };
}

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
): Promise<{ count: number }> {
  if (!modules || modules.length === 0) return { count: 0 };

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

      // Sync learning objectives if provided
      if (mod.learningOutcomes && mod.learningOutcomes.length > 0) {
        await tx.learningObjective.deleteMany({ where: { moduleId: upserted.id } });

        for (let j = 0; j < mod.learningOutcomes.length; j++) {
          const { ref, description } = parseLORef(mod.learningOutcomes[j], j);
          await tx.learningObjective.create({
            data: {
              moduleId: upserted.id,
              ref,
              description,
              sortOrder: j,
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

  return { count: result.length };
}
