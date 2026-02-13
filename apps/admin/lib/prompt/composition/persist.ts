/**
 * Composed Prompt Persistence
 *
 * Stores a composed prompt and supersedes previous active prompts.
 * Shared by both the compose-prompt API route and the pipeline COMPOSE stage.
 */

import { prisma } from "@/lib/prisma";
import type { CompositionResult } from "./types";

export interface PersistOptions {
  callerId: string;
  triggerType?: string;
  triggerCallId?: string | null;
  composeSpecSlug?: string | null;
  specConfig?: Record<string, any>;
}

export interface PersistedPrompt {
  id: string;
  callerId: string;
  prompt: string;
  llmPrompt: any;
  status: string;
  composedAt: Date;
}

/**
 * Persist a composed prompt and supersede old active prompts for this caller.
 *
 * @param composition - The result from executeComposition()
 * @param promptSummary - The rendered prompt markdown from renderPromptSummary()
 * @param options - Persistence options (callerId, trigger info, etc.)
 * @returns The created ComposedPrompt record
 */
export async function persistComposedPrompt(
  composition: CompositionResult,
  promptSummary: string,
  options: PersistOptions,
): Promise<PersistedPrompt> {
  const {
    callerId,
    triggerType = "pipeline",
    triggerCallId,
    composeSpecSlug,
    specConfig,
  } = options;

  const { llmPrompt, callerContext, loadedData, resolvedSpecs, metadata } = composition;

  const composedPrompt = await prisma.composedPrompt.create({
    data: {
      callerId,
      prompt: promptSummary,
      llmPrompt,
      triggerType,
      triggerCallId: triggerCallId || null,
      model: "deterministic",
      status: "active",
      inputs: {
        callerContext,
        memoriesCount: loadedData.memories.length,
        personalityAvailable: !!loadedData.personality,
        recentCallsCount: loadedData.recentCalls.length,
        behaviorTargetsCount: metadata.mergedTargetCount,
        playbooksUsed: loadedData.playbooks.map((p: any) => p.name),
        playbooksCount: loadedData.playbooks.length,
        identitySpec: resolvedSpecs.identitySpec?.name || null,
        contentSpec: resolvedSpecs.contentSpec?.name || null,
        specUsed: composeSpecSlug || "(defaults)",
        specConfig: specConfig || {},
        composition: {
          sectionsActivated: metadata.sectionsActivated,
          sectionsSkipped: metadata.sectionsSkipped,
          loadTimeMs: metadata.loadTimeMs,
          transformTimeMs: metadata.transformTimeMs,
        },
      },
    },
  });

  // Supersede previous active prompts for this caller
  await prisma.composedPrompt.updateMany({
    where: {
      callerId,
      id: { not: composedPrompt.id },
      status: "active",
    },
    data: {
      status: "superseded",
    },
  });

  return composedPrompt as PersistedPrompt;
}
