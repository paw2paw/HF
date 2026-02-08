/**
 * track-progress.ts
 *
 * Generic curriculum progress tracking
 * Stores progress as CallerAttributes using contract-defined key patterns
 *
 * NO HARDCODED KEY PATTERNS - reads from CURRICULUM_PROGRESS_V1 contract
 *
 * Key pattern defined by contract: curriculum:{specSlug}:{progressKey}
 * Examples:
 *   - curriculum:QM-CONTENT-001:current_module
 *   - curriculum:QM-CONTENT-001:mastery:chapter1_blackbody
 *   - curriculum:QM-CONTENT-001:last_accessed
 */

import { prisma } from "@/lib/prisma";
import { ContractRegistry } from "@/lib/contracts/registry";

interface ProgressUpdate {
  currentModuleId?: string;
  moduleMastery?: Record<string, number>;
  lastAccessedAt?: Date;
}

/**
 * Build storage key using contract-defined pattern
 * NO HARDCODING - reads pattern from CURRICULUM_PROGRESS_V1 contract
 */
function buildStorageKey(specSlug: string, keyName: string, moduleId?: string): string {
  const keyPattern = ContractRegistry.getKeyPattern('CURRICULUM_PROGRESS_V1');
  const storageKeys = ContractRegistry.getStorageKeys('CURRICULUM_PROGRESS_V1');

  if (!keyPattern || !storageKeys) {
    throw new Error('CURRICULUM_PROGRESS_V1 contract not loaded or invalid');
  }

  // Get the key template from contract
  const keyTemplate = storageKeys[keyName as keyof typeof storageKeys];
  if (!keyTemplate) {
    throw new Error(`Unknown storage key: ${keyName}. Check CURRICULUM_PROGRESS_V1 contract.`);
  }

  // Replace variables in pattern
  let key = keyPattern
    .replace('{specSlug}', specSlug)
    .replace('{key}', keyTemplate);

  // Replace moduleId if present in template
  if (moduleId && key.includes('{moduleId}')) {
    key = key.replace('{moduleId}', moduleId);
  }

  return key;
}

/**
 * Update curriculum progress for a caller
 * GENERIC - works for any curriculum spec
 * Uses contract-defined storage keys
 */
export async function updateCurriculumProgress(
  callerId: string,
  specSlug: string,
  updates: ProgressUpdate
): Promise<void> {
  const writes: Promise<any>[] = [];

  // Update current module
  if (updates.currentModuleId !== undefined) {
    const key = buildStorageKey(specSlug, 'currentModule');
    writes.push(
      prisma.callerAttribute.upsert({
        where: {
          callerId_key_scope: {
            callerId,
            key,
            scope: 'CURRICULUM',
          },
        },
        create: {
          callerId,
          key,
          scope: 'CURRICULUM',
          valueType: 'STRING',
          stringValue: updates.currentModuleId,
        },
        update: {
          stringValue: updates.currentModuleId,
        },
      })
    );
  }

  // Update module mastery scores
  if (updates.moduleMastery) {
    for (const [moduleId, mastery] of Object.entries(updates.moduleMastery)) {
      const key = buildStorageKey(specSlug, 'mastery', moduleId);
      writes.push(
        prisma.callerAttribute.upsert({
          where: {
            callerId_key_scope: {
              callerId,
              key,
              scope: 'CURRICULUM',
            },
          },
          create: {
            callerId,
            key,
            scope: 'CURRICULUM',
            valueType: 'NUMBER',
            numberValue: mastery,
          },
          update: {
            numberValue: mastery,
          },
        })
      );
    }
  }

  // Update last accessed timestamp
  if (updates.lastAccessedAt !== undefined) {
    const key = buildStorageKey(specSlug, 'lastAccessed');
    writes.push(
      prisma.callerAttribute.upsert({
        where: {
          callerId_key_scope: {
            callerId,
            key,
            scope: 'CURRICULUM',
          },
        },
        create: {
          callerId,
          key,
          scope: 'CURRICULUM',
          valueType: 'STRING',
          stringValue: updates.lastAccessedAt.toISOString(),
        },
        update: {
          stringValue: updates.lastAccessedAt.toISOString(),
        },
      })
    );
  }

  await Promise.all(writes);
}

/**
 * Get curriculum progress for a caller
 * Returns structured progress data using contract-defined keys
 */
export async function getCurriculumProgress(
  callerId: string,
  specSlug: string
): Promise<{
  currentModuleId: string | null;
  modulesMastery: Record<string, number>;
  lastAccessedAt: string | null;
}> {
  // Get contract keys
  const storageKeys = ContractRegistry.getStorageKeys('CURRICULUM_PROGRESS_V1');
  const keyPattern = ContractRegistry.getKeyPattern('CURRICULUM_PROGRESS_V1');

  if (!storageKeys || !keyPattern) {
    throw new Error('CURRICULUM_PROGRESS_V1 contract not loaded');
  }

  const prefix = keyPattern
    .replace('{specSlug}', specSlug)
    .replace(':{key}', ':');

  const attributes = await prisma.callerAttribute.findMany({
    where: {
      callerId,
      scope: 'CURRICULUM',
      key: {
        startsWith: prefix,
      },
    },
  });

  const progress = {
    currentModuleId: null as string | null,
    modulesMastery: {} as Record<string, number>,
    lastAccessedAt: null as string | null,
  };

  for (const attr of attributes) {
    const key = attr.key.replace(prefix, '');

    if (key === storageKeys.currentModule) {
      progress.currentModuleId = attr.stringValue;
    } else if (key.startsWith(storageKeys.mastery.replace(':{moduleId}', ':'))) {
      const moduleId = key.replace(storageKeys.mastery.replace(':{moduleId}', ':'), '');
      progress.modulesMastery[moduleId] = attr.numberValue || 0;
    } else if (key === storageKeys.lastAccessed) {
      progress.lastAccessedAt = attr.stringValue;
    }
  }

  return progress;
}

/**
 * Mark a module as completed
 * Sets mastery to 1.0 and advances to next module if sequential
 */
export async function completeModule(
  callerId: string,
  specSlug: string,
  moduleId: string,
  nextModuleId?: string
): Promise<void> {
  const updates: ProgressUpdate = {
    moduleMastery: {
      [moduleId]: 1.0,
    },
    lastAccessedAt: new Date(),
  };

  if (nextModuleId) {
    updates.currentModuleId = nextModuleId;
  }

  await updateCurriculumProgress(callerId, specSlug, updates);
}

/**
 * Reset curriculum progress for a caller
 * Useful for retaking a curriculum or debugging
 * Uses contract-defined key pattern
 */
export async function resetCurriculumProgress(
  callerId: string,
  specSlug: string
): Promise<void> {
  const keyPattern = ContractRegistry.getKeyPattern('CURRICULUM_PROGRESS_V1');
  if (!keyPattern) {
    throw new Error('CURRICULUM_PROGRESS_V1 contract not loaded');
  }

  const prefix = keyPattern
    .replace('{specSlug}', specSlug)
    .replace(':{key}', ':');

  await prisma.callerAttribute.deleteMany({
    where: {
      callerId,
      scope: 'CURRICULUM',
      key: {
        startsWith: prefix,
      },
    },
  });
}

/**
 * Get all curricula a caller has progress in
 * Uses contract-defined key pattern to identify curriculum data
 */
export async function getActiveCurricula(
  callerId: string
): Promise<string[]> {
  const keyPattern = ContractRegistry.getKeyPattern('CURRICULUM_PROGRESS_V1');
  if (!keyPattern) {
    throw new Error('CURRICULUM_PROGRESS_V1 contract not loaded');
  }

  // Extract the prefix before {specSlug}
  const patternParts = keyPattern.split('{specSlug}');
  const prefix = patternParts[0];  // e.g., "curriculum:"

  const attributes = await prisma.callerAttribute.findMany({
    where: {
      callerId,
      scope: 'CURRICULUM',
      key: {
        startsWith: prefix,
      },
    },
    select: {
      key: true,
    },
  });

  // Extract unique spec slugs from keys like "curriculum:QM-CONTENT-001:current_module"
  const specSlugs = new Set<string>();
  for (const attr of attributes) {
    // Parse using the contract pattern
    const withoutPrefix = attr.key.substring(prefix.length);
    const nextColon = withoutPrefix.indexOf(':');
    if (nextColon > 0) {
      const specSlug = withoutPrefix.substring(0, nextColon);
      specSlugs.add(specSlug);
    }
  }

  return Array.from(specSlugs);
}
