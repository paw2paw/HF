/**
 * PromptComposer service (in-memory, pure).
 * Intentionally has no dependency on Prisma/Supabase.
 *
 * Note: This module defines its own structural types so callers can pass compatible objects
 * from BDD or future domain packages without tight coupling.
 */

type ID = string;

export type PromptLayerType = "SYSTEM" | "CONTEXT" | "PERSONALITY" | "RULE" | "OPTIMISATION";

export interface PromptTemplate {
  id: ID;
  name: string;
  layerType: PromptLayerType;
  content: string;
  version: number;
  isActive: boolean;
}

export interface PromptLayerSnapshot {
  id: ID;
  templateId?: ID;
  layerType: PromptLayerType;
  renderedText: string;
}

export interface PromptRun {
  id: ID;
  userId: ID;
  agentId: ID;
  layers: PromptLayerSnapshot[];
  createdAt: Date;
}

export interface HFUser {
  id: ID;
  email?: string;
  name?: string;
}

export interface HFAgent {
  id: ID;
  name?: string;
  isActive: boolean;
}

export type MemoryType = "FACT" | "PREFERENCE" | "TRAIT" | "EVENT";

export interface Memory {
  id: ID;
  userId: ID;
  callId?: ID;
  type: MemoryType;
  content: string;
  weight: number;
  confidence?: number;
  sourceAnalysisId?: ID;
}

// Deterministic IDs for tests (keeps BDD stable)
let _seq = 0;
function id(prefix: string): ID {
  _seq += 1;
  return `${prefix}_${String(_seq).padStart(3, "0")}`;
}

/**
 * Composes a PromptRun from templates and memory.
 * Pure function. No side effects.
 */
export function composePromptRun(params: {
  user: HFUser;
  agent: HFAgent;
  templates: PromptTemplate[];
  memories: Memory[];
}): PromptRun {
  const { user, agent, templates, memories } = params;

  const layers: PromptLayerSnapshot[] = [];

  // Always include active SYSTEM layer(s)
  for (const t of templates.filter((x) => x.isActive && x.layerType === "SYSTEM")) {
    layers.push({
      id: id("pls"),
      templateId: t.id,
      layerType: "SYSTEM",
      renderedText: t.content,
    });
  }

  // If we have TRAIT memories, include a PERSONALITY layer derived from them.
  const traits = memories.filter((m) => m.type === "TRAIT");
  if (traits.length > 0) {
    const renderedText =
      "Personality traits:\n" +
      traits
        .map(
          (t) =>
            `- ${t.content} (w=${t.weight.toFixed(2)}${
              t.confidence != null ? `, c=${t.confidence.toFixed(2)}` : ""
            })`
        )
        .join("\n");

    layers.push({
      id: id("pls"),
      layerType: "PERSONALITY",
      renderedText,
    });
  }

  return {
    id: id("pr"),
    userId: user.id,
    agentId: agent.id,
    layers,
    createdAt: new Date(),
  };
}