/**
 * profile.ts
 *
 * Generic learner profile management
 * Stores profile as CallerAttributes using contract-defined key patterns
 *
 * NO HARDCODED KEY PATTERNS - reads from LEARNER_PROFILE_V1 contract
 *
 * Key pattern defined by contract: learner_profile:{category}:{key}
 * Examples:
 *   - learner_profile:learning_style:primary
 *   - learner_profile:pace_preference
 *   - learner_profile:prior_knowledge:physics
 */

import { prisma } from "@/lib/prisma";
import { ContractRegistry } from "@/lib/contracts/registry";

export interface LearnerProfile {
  learningStyle: string | null;
  pacePreference: string | null;
  interactionStyle: string | null;
  priorKnowledge: Record<string, string>;
  preferredModality: string | null;
  questionFrequency: string | null;
  sessionLength: string | null;
  feedbackStyle: string | null;
  lastUpdated: string | null;
}

interface ProfileUpdate {
  learningStyle?: string;
  pacePreference?: string;
  interactionStyle?: string;
  priorKnowledge?: Record<string, string>;
  preferredModality?: string;
  questionFrequency?: string;
  sessionLength?: string;
  feedbackStyle?: string;
}

/**
 * Build storage key using contract-defined pattern
 * NO HARDCODING - reads pattern from LEARNER_PROFILE_V1 contract
 */
async function buildStorageKey(category: string, key: string, subdomain?: string): Promise<string> {
  const keyPattern = await ContractRegistry.getKeyPattern('LEARNER_PROFILE_V1');
  const storageKeys = await ContractRegistry.getStorageKeys('LEARNER_PROFILE_V1');

  if (!keyPattern || !storageKeys) {
    throw new Error('LEARNER_PROFILE_V1 contract not loaded or invalid');
  }

  // Get the key template from contract
  const keyTemplate = storageKeys[key as keyof typeof storageKeys];
  if (!keyTemplate) {
    throw new Error(`Unknown storage key: ${key}. Check LEARNER_PROFILE_V1 contract.`);
  }

  // Replace variables in pattern
  let storageKey = keyPattern
    .replace('{category}', category)
    .replace('{key}', keyTemplate);

  // Replace subdomain if present in template (e.g., prior_knowledge:{domain})
  if (subdomain && storageKey.includes('{domain}')) {
    storageKey = storageKey.replace('{domain}', subdomain);
  }

  return storageKey;
}

/**
 * Update learner profile for a caller
 * GENERIC - works using contract-defined storage keys
 */
export async function updateLearnerProfile(
  callerId: string,
  updates: ProfileUpdate,
  confidence: number = 0.7
): Promise<void> {
  const writes: Promise<any>[] = [];

  // Update learning style
  if (updates.learningStyle !== undefined) {
    const key = await buildStorageKey('learning_style', 'learningStyle');
    writes.push(
      prisma.callerAttribute.upsert({
        where: {
          callerId_key_scope: {
            callerId,
            key,
            scope: 'LEARNER_PROFILE',
          },
        },
        create: {
          callerId,
          key,
          scope: 'LEARNER_PROFILE',
          valueType: 'STRING',
          stringValue: updates.learningStyle,
          confidence,
        },
        update: {
          stringValue: updates.learningStyle,
          confidence,
        },
      })
    );
  }

  // Update pace preference
  if (updates.pacePreference !== undefined) {
    const key = await buildStorageKey('pace', 'pacePreference');
    writes.push(
      prisma.callerAttribute.upsert({
        where: {
          callerId_key_scope: {
            callerId,
            key,
            scope: 'LEARNER_PROFILE',
          },
        },
        create: {
          callerId,
          key,
          scope: 'LEARNER_PROFILE',
          valueType: 'STRING',
          stringValue: updates.pacePreference,
          confidence,
        },
        update: {
          stringValue: updates.pacePreference,
          confidence,
        },
      })
    );
  }

  // Update interaction style
  if (updates.interactionStyle !== undefined) {
    const key = await buildStorageKey('interaction', 'interactionStyle');
    writes.push(
      prisma.callerAttribute.upsert({
        where: {
          callerId_key_scope: {
            callerId,
            key,
            scope: 'LEARNER_PROFILE',
          },
        },
        create: {
          callerId,
          key,
          scope: 'LEARNER_PROFILE',
          valueType: 'STRING',
          stringValue: updates.interactionStyle,
          confidence,
        },
        update: {
          stringValue: updates.interactionStyle,
          confidence,
        },
      })
    );
  }

  // Update prior knowledge (domain-specific)
  if (updates.priorKnowledge) {
    for (const [domain, level] of Object.entries(updates.priorKnowledge)) {
      const key = await buildStorageKey('prior_knowledge', 'priorKnowledge', domain);
      writes.push(
        prisma.callerAttribute.upsert({
          where: {
            callerId_key_scope: {
              callerId,
              key,
              scope: 'LEARNER_PROFILE',
            },
          },
          create: {
            callerId,
            key,
            scope: 'LEARNER_PROFILE',
            valueType: 'STRING',
            stringValue: level,
            confidence,
          },
          update: {
            stringValue: level,
            confidence,
          },
        })
      );
    }
  }

  // Update other profile fields (modality, question frequency, etc.)
  const simpleUpdates: Array<{ field: keyof ProfileUpdate; category: string }> = [
    { field: 'preferredModality', category: 'modality' },
    { field: 'questionFrequency', category: 'engagement' },
    { field: 'sessionLength', category: 'session' },
    { field: 'feedbackStyle', category: 'feedback' },
  ];

  for (const { field, category } of simpleUpdates) {
    const value = updates[field];
    if (value !== undefined) {
      const key = await buildStorageKey(category, field);
      writes.push(
        prisma.callerAttribute.upsert({
          where: {
            callerId_key_scope: {
              callerId,
              key,
              scope: 'LEARNER_PROFILE',
            },
          },
          create: {
            callerId,
            key,
            scope: 'LEARNER_PROFILE',
            valueType: 'STRING',
            stringValue: typeof value === 'string' ? value : JSON.stringify(value),
            confidence,
          },
          update: {
            stringValue: typeof value === 'string' ? value : JSON.stringify(value),
            confidence,
          },
        })
      );
    }
  }

  // Update last updated timestamp
  const lastUpdatedKey = await buildStorageKey('metadata', 'lastUpdated');
  writes.push(
    prisma.callerAttribute.upsert({
      where: {
        callerId_key_scope: {
          callerId,
          key: lastUpdatedKey,
          scope: 'LEARNER_PROFILE',
        },
      },
      create: {
        callerId,
        key: lastUpdatedKey,
        scope: 'LEARNER_PROFILE',
        valueType: 'STRING',
        stringValue: new Date().toISOString(),
        confidence: 1.0,
      },
      update: {
        stringValue: new Date().toISOString(),
      },
    })
  );

  await Promise.all(writes);
}

/**
 * Get learner profile for a caller
 * Returns structured profile data using contract-defined keys
 */
export async function getLearnerProfile(
  callerId: string
): Promise<LearnerProfile> {
  // Get contract keys
  const storageKeys = await ContractRegistry.getStorageKeys('LEARNER_PROFILE_V1');
  const keyPattern = await ContractRegistry.getKeyPattern('LEARNER_PROFILE_V1');

  if (!storageKeys || !keyPattern) {
    throw new Error('LEARNER_PROFILE_V1 contract not loaded');
  }

  const prefix = keyPattern.split(':')[0] + ':'; // e.g., "learner_profile:"

  const attributes = await prisma.callerAttribute.findMany({
    where: {
      callerId,
      scope: 'LEARNER_PROFILE',
      key: {
        startsWith: prefix,
      },
    },
  });

  const profile: LearnerProfile = {
    learningStyle: null,
    pacePreference: null,
    interactionStyle: null,
    priorKnowledge: {},
    preferredModality: null,
    questionFrequency: null,
    sessionLength: null,
    feedbackStyle: null,
    lastUpdated: null,
  };

  for (const attr of attributes) {
    const key = attr.key.replace(prefix, '');

    // Parse the key to determine which profile field to update
    if (key.includes('learning_style')) {
      profile.learningStyle = attr.stringValue;
    } else if (key.includes('pace_preference')) {
      profile.pacePreference = attr.stringValue;
    } else if (key.includes('interaction_style')) {
      profile.interactionStyle = attr.stringValue;
    } else if (key.startsWith('prior_knowledge:')) {
      const domain = key.split(':')[1];
      if (domain && attr.stringValue) {
        profile.priorKnowledge[domain] = attr.stringValue;
      }
    } else if (key.includes('preferred_modality')) {
      profile.preferredModality = attr.stringValue;
    } else if (key.includes('question_frequency')) {
      profile.questionFrequency = attr.stringValue;
    } else if (key.includes('session_length')) {
      profile.sessionLength = attr.stringValue;
    } else if (key.includes('feedback_style')) {
      profile.feedbackStyle = attr.stringValue;
    } else if (key.includes('last_updated')) {
      profile.lastUpdated = attr.stringValue;
    }
  }

  return profile;
}

/**
 * Reset learner profile for a caller
 * Useful for debugging or when learner preferences change dramatically
 */
export async function resetLearnerProfile(callerId: string): Promise<void> {
  const keyPattern = await ContractRegistry.getKeyPattern('LEARNER_PROFILE_V1');
  if (!keyPattern) {
    throw new Error('LEARNER_PROFILE_V1 contract not loaded');
  }

  const prefix = keyPattern.split(':')[0] + ':';

  await prisma.callerAttribute.deleteMany({
    where: {
      callerId,
      scope: 'LEARNER_PROFILE',
      key: {
        startsWith: prefix,
      },
    },
  });
}
