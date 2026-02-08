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

/**
 * Knowledge chunk retrieved for prompt context enrichment.
 * Makes the LLM "expert" in the ingested domain.
 */
export interface KnowledgeContext {
  id: ID;
  title?: string;
  content: string;
  relevanceScore: number;
  source: string;  // e.g., "vector", "keyword", "artifact"
}

// Deterministic IDs for tests (keeps BDD stable)
let _seq = 0;
function id(prefix: string): ID {
  _seq += 1;
  return `${prefix}_${String(_seq).padStart(3, "0")}`;
}

/**
 * Composes a PromptRun from templates, memory, and knowledge context.
 * Pure function. No side effects.
 *
 * Knowledge chunks are injected as a CONTEXT layer to make the LLM
 * "expert" in whatever domain was ingested into the knowledge base.
 */
export function composePromptRun(params: {
  user: HFUser;
  agent: HFAgent;
  templates: PromptTemplate[];
  memories: Memory[];
  /** Retrieved knowledge chunks for domain expertise */
  knowledgeContext?: KnowledgeContext[];
  /** Max chars for knowledge context (default: 4000) */
  maxKnowledgeChars?: number;
}): PromptRun {
  const { user, agent, templates, memories, knowledgeContext, maxKnowledgeChars } = params;

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

  // CONTEXT layer: inject retrieved knowledge to make LLM "expert" in the domain
  if (knowledgeContext && knowledgeContext.length > 0) {
    const maxChars = maxKnowledgeChars ?? 4000;
    let renderedText = "Expert Knowledge Context:\n\n";
    let charCount = renderedText.length;

    for (const chunk of knowledgeContext) {
      const prefix = chunk.title ? `[${chunk.title}] ` : "";
      const line = `${prefix}${chunk.content}\n\n`;

      if (charCount + line.length > maxChars) {
        // Truncate if over budget
        const remaining = maxChars - charCount - 20;
        if (remaining > 100) {
          renderedText += line.substring(0, remaining) + "...\n";
        }
        break;
      }

      renderedText += line;
      charCount += line.length;
    }

    layers.push({
      id: id("pls"),
      layerType: "CONTEXT",
      renderedText: renderedText.trim(),
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