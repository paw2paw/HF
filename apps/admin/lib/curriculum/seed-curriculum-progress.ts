/**
 * seed-curriculum-progress.ts
 *
 * Utility for seeding curriculum progress data for test callers
 * Uses the generic progress tracking system
 */

import { prisma } from "@/lib/prisma";
import { updateCurriculumProgress } from "./track-progress";
import type { SpecConfig } from "@/lib/types/json-fields";

/**
 * Seed curriculum progress for a test caller
 * Useful for testing and demos
 *
 * Example:
 *   await seedCurriculumProgress(callerId, "QM-CONTENT-001", {
 *     currentModuleId: "chapter3_waveparticle",
 *     moduleMastery: {
 *       "chapter1_blackbody": 0.85,
 *       "chapter2_photons": 0.90,
 *       "chapter3_waveparticle": 0.45, // in progress
 *     }
 *   });
 */
export async function seedCurriculumProgress(
  callerId: string,
  contentSpecSlug: string,
  options: {
    currentModuleId?: string;
    moduleMastery?: Record<string, number>;
    startFromBeginning?: boolean;
  } = {}
): Promise<void> {
  const { currentModuleId, moduleMastery, startFromBeginning } = options;

  // If starting from beginning, just set current module to first module
  if (startFromBeginning) {
    // Find the content spec to get first module
    const contentSpec = await prisma.analysisSpec.findFirst({
      where: {
        slug: contentSpecSlug,
        specRole: "CONTENT",
        isActive: true,
      },
    });

    if (contentSpec) {
      const config = contentSpec.config as SpecConfig;
      const params = config?.parameters || [];
      const moduleParams = params.filter((p: any) => p.section === "content");

      if (moduleParams.length > 0) {
        // Sort by sequence and get first
        const sorted = moduleParams.sort((a: any, b: any) =>
          (a.sequence ?? 0) - (b.sequence ?? 0)
        );
        const firstModule = sorted[0];

        await updateCurriculumProgress(callerId, contentSpecSlug, {
          currentModuleId: firstModule.id,
          moduleMastery: {},
          lastAccessedAt: new Date(),
        });

        console.log(`✓ Seeded curriculum progress for ${callerId}: starting with ${firstModule.id}`);
      }
    }
    return;
  }

  // Otherwise, use provided data
  await updateCurriculumProgress(callerId, contentSpecSlug, {
    currentModuleId,
    moduleMastery,
    lastAccessedAt: new Date(),
  });

  console.log(`✓ Seeded curriculum progress for ${callerId}`);
  if (currentModuleId) {
    console.log(`  - Current module: ${currentModuleId}`);
  }
  if (moduleMastery) {
    console.log(`  - Mastery data: ${Object.keys(moduleMastery).length} modules`);
  }
}

/**
 * Seed curriculum progress for multiple callers at once
 * Useful for creating varied test data
 */
export async function seedMultipleCallersProgress(
  callerIds: string[],
  contentSpecSlug: string,
  progressVariants: Array<{
    currentModuleId?: string;
    moduleMastery?: Record<string, number>;
  }>
): Promise<void> {
  for (let i = 0; i < callerIds.length; i++) {
    const callerId = callerIds[i];
    const progress = progressVariants[i % progressVariants.length];

    await seedCurriculumProgress(callerId, contentSpecSlug, progress);
  }

  console.log(`✓ Seeded curriculum progress for ${callerIds.length} callers`);
}

/**
 * Example usage in a seed file:
 *
 * // Caller just starting
 * await seedCurriculumProgress(caller1Id, "QM-CONTENT-001", {
 *   startFromBeginning: true
 * });
 *
 * // Caller mid-way through
 * await seedCurriculumProgress(caller2Id, "QM-CONTENT-001", {
 *   currentModuleId: "chapter3_waveparticle",
 *   moduleMastery: {
 *     "chapter1_blackbody": 0.85,
 *     "chapter2_photons": 0.90,
 *     "chapter3_waveparticle": 0.45,
 *   }
 * });
 *
 * // Caller almost done
 * await seedCurriculumProgress(caller3Id, "QM-CONTENT-001", {
 *   currentModuleId: "chapter7_entanglement",
 *   moduleMastery: {
 *     "chapter1_blackbody": 0.95,
 *     "chapter2_photons": 0.88,
 *     "chapter3_waveparticle": 0.92,
 *     "chapter4_schrodinger": 0.85,
 *     "chapter5_measurement": 0.80,
 *     "chapter6_spin": 0.87,
 *     "chapter7_entanglement": 0.55,
 *   }
 * });
 */
