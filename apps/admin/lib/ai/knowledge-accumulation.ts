/**
 * AI Knowledge Accumulation
 *
 * Tracks what the AI learns from user interactions to build up system knowledge over time.
 * This creates a feedback loop where the AI gets smarter as users work with it.
 *
 * Examples:
 * - User creates a new spec → AI learns about common spec patterns
 * - User asks about a domain → AI learns domain relationships
 * - User makes corrections → AI learns what works/doesn't work
 */

import { prisma } from "@/lib/prisma";

// ============================================================================
// TYPES
// ============================================================================

export interface AIInteraction {
  callPoint: string;
  userMessage: string;
  aiResponse: string;
  outcome: "success" | "correction" | "failure";
  metadata?: {
    entityType?: string;    // 'spec', 'parameter', 'goal', etc.
    entityId?: string;      // ID of created/modified entity
    action?: string;        // 'create', 'edit', 'suggest', etc.
    corrections?: string;   // What user corrected
    userFeedback?: string;  // Explicit feedback
    model?: string;         // AI model used (e.g., "claude-sonnet-4.5", "gpt-4", etc.)
    provider?: string;      // AI provider (e.g., "anthropic", "openai")
  };
}

export interface LearnedPattern {
  pattern: string;          // What pattern was learned
  confidence: number;       // 0-1 confidence score
  occurrences: number;      // How many times seen
  examples: string[];       // Example interactions
  domain?: string;          // Related domain
  callPoint: string;        // Where this applies
}

export interface AIInsight {
  type: "pattern" | "preference" | "correction" | "relationship";
  domain?: string;
  insight: string;
  confidence: number;
  supportingData: string[];
}

// ============================================================================
// INTERACTION LOGGING
// ============================================================================

/**
 * Log an AI interaction for learning.
 * Call this after every AI interaction to build knowledge.
 */
export async function logAIInteraction(interaction: AIInteraction): Promise<void> {
  try {
    await prisma.aIInteractionLog.create({
      data: {
        callPoint: interaction.callPoint,
        userMessage: interaction.userMessage,
        aiResponse: interaction.aiResponse,
        outcome: interaction.outcome,
        metadata: interaction.metadata as any,
        createdAt: new Date(),
      },
    });

    // Trigger pattern learning in background (don't await)
    if (interaction.outcome === "success") {
      analyzeForPatterns(interaction).catch(console.error);
    }
  } catch (error) {
    console.error("[AI Learning] Failed to log interaction:", error);
  }
}

// ============================================================================
// PATTERN LEARNING
// ============================================================================

/**
 * Analyze interactions to extract learned patterns.
 * This runs in background and updates the learned patterns table.
 */
async function analyzeForPatterns(interaction: AIInteraction): Promise<void> {
  // Extract patterns from successful interactions
  const patterns = extractPatterns(interaction);

  for (const pattern of patterns) {
    // Check if we've seen this pattern before
    const existing = await prisma.aILearnedPattern.findFirst({
      where: {
        pattern: pattern.pattern,
        callPoint: interaction.callPoint,
      },
    });

    if (existing) {
      // Increment occurrences and update confidence
      await prisma.aILearnedPattern.update({
        where: { id: existing.id },
        data: {
          occurrences: existing.occurrences + 1,
          confidence: Math.min(1, existing.confidence + 0.05), // Slowly increase confidence
          examples: {
            push: pattern.example.substring(0, 200),
          },
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new learned pattern
      await prisma.aILearnedPattern.create({
        data: {
          pattern: pattern.pattern,
          callPoint: interaction.callPoint,
          domain: pattern.domain,
          confidence: 0.3, // Start with low confidence
          occurrences: 1,
          examples: [pattern.example.substring(0, 200)],
        },
      });
    }
  }
}

/**
 * Extract patterns from a successful interaction.
 */
function extractPatterns(interaction: AIInteraction): Array<{
  pattern: string;
  domain?: string;
  example: string;
}> {
  const patterns: Array<{ pattern: string; domain?: string; example: string }> = [];

  // Pattern: User asks for spec in domain X → AI creates spec with certain structure
  if (
    interaction.callPoint === "spec.assistant" &&
    interaction.metadata?.action === "create" &&
    interaction.metadata?.entityType === "spec"
  ) {
    const domainMatch = interaction.userMessage.match(
      /(?:measure|track|assess)\s+(\w+)/i
    );
    if (domainMatch) {
      patterns.push({
        pattern: `create_spec_for_${domainMatch[1].toLowerCase()}`,
        domain: interaction.metadata.entityId?.split("-")[0].toLowerCase(),
        example: interaction.userMessage,
      });
    }
  }

  // Pattern: Common parameter requests
  if (interaction.callPoint === "spec.assistant") {
    const paramMatch = interaction.userMessage.match(
      /(?:parameter|measure|track)\s+(\w+)/gi
    );
    if (paramMatch) {
      paramMatch.forEach((match) => {
        patterns.push({
          pattern: `requested_parameter_${match.toLowerCase()}`,
          example: interaction.userMessage,
        });
      });
    }
  }

  // Pattern: Domain relationships (user asks about X in context of Y)
  const domainWords = ["personality", "memory", "engagement", "learning", "behavior"];
  const mentionedDomains = domainWords.filter((d) =>
    interaction.userMessage.toLowerCase().includes(d)
  );
  if (mentionedDomains.length > 1) {
    patterns.push({
      pattern: `domain_relationship_${mentionedDomains.sort().join("_")}`,
      example: interaction.userMessage,
    });
  }

  return patterns;
}

// ============================================================================
// KNOWLEDGE RETRIEVAL
// ============================================================================

/**
 * Get learned patterns for a call point to enhance AI context.
 * Use this to inject learned knowledge into AI prompts.
 */
export async function getLearnedKnowledge(
  callPoint: string,
  domain?: string
): Promise<LearnedPattern[]> {
  const patterns = await prisma.aILearnedPattern.findMany({
    where: {
      callPoint,
      ...(domain && { domain }),
      confidence: { gte: 0.5 }, // Only use patterns we're confident about
      occurrences: { gte: 3 }, // Must have seen it multiple times
    },
    orderBy: [
      { confidence: "desc" },
      { occurrences: "desc" },
    ],
    take: 20,
  });

  return patterns.map((p) => ({
    pattern: p.pattern,
    confidence: p.confidence,
    occurrences: p.occurrences,
    examples: p.examples as string[],
    domain: p.domain || undefined,
    callPoint: p.callPoint,
  }));
}

/**
 * Generate AI insights from accumulated knowledge.
 * Returns high-level insights about what the AI has learned.
 */
export async function generateInsights(options?: {
  domain?: string;
  callPoint?: string;
  minConfidence?: number;
}): Promise<AIInsight[]> {
  const { domain, callPoint, minConfidence = 0.7 } = options || {};

  const patterns = await prisma.aILearnedPattern.findMany({
    where: {
      ...(domain && { domain }),
      ...(callPoint && { callPoint }),
      confidence: { gte: minConfidence },
      occurrences: { gte: 5 },
    },
    orderBy: { confidence: "desc" },
    take: 50,
  });

  const insights: AIInsight[] = [];

  // Group patterns by type
  const patternsByType = new Map<string, typeof patterns>();
  patterns.forEach((p) => {
    const type = p.pattern.split("_")[0];
    const list = patternsByType.get(type) || [];
    list.push(p);
    patternsByType.set(type, list);
  });

  // Generate insights from patterns
  patternsByType.forEach((patternsOfType, type) => {
    if (patternsOfType.length >= 3) {
      insights.push({
        type: "pattern",
        domain: patternsOfType[0].domain || undefined,
        insight: `Frequent ${type} pattern observed (${patternsOfType.length} variations)`,
        confidence: patternsOfType.reduce((sum, p) => sum + p.confidence, 0) / patternsOfType.length,
        supportingData: patternsOfType.map((p) => p.pattern),
      });
    }
  });

  return insights;
}

/**
 * Format learned knowledge for injection into AI context.
 */
export function formatLearnedKnowledge(patterns: LearnedPattern[]): string {
  if (patterns.length === 0) return "";

  let text = "\n## Learned Knowledge (from past interactions)\n\n";

  // Group by domain
  const byDomain = new Map<string, LearnedPattern[]>();
  patterns.forEach((p) => {
    const domain = p.domain || "general";
    const list = byDomain.get(domain) || [];
    list.push(p);
    byDomain.set(domain, list);
  });

  byDomain.forEach((domainPatterns, domain) => {
    text += `### ${domain.charAt(0).toUpperCase() + domain.slice(1)}\n`;
    domainPatterns.forEach((p) => {
      text += `- ${p.pattern.replace(/_/g, " ")} `;
      text += `(confidence: ${Math.round(p.confidence * 100)}%, seen ${p.occurrences}x)\n`;
    });
    text += "\n";
  });

  return text;
}

// ============================================================================
// CORRECTION LEARNING
// ============================================================================

/**
 * Log when a user corrects AI output.
 * This is critical for learning what works and what doesn't.
 */
export async function logCorrection(
  callPoint: string,
  original: string,
  corrected: string,
  context?: Record<string, any>
): Promise<void> {
  await logAIInteraction({
    callPoint,
    userMessage: `Correction: ${corrected}`,
    aiResponse: original,
    outcome: "correction",
    metadata: {
      corrections: corrected,
      ...context,
    },
  });
}

// ============================================================================
// KNOWLEDGE EXPORT
// ============================================================================

/**
 * Export accumulated knowledge for analysis or backup.
 */
export async function exportKnowledge(): Promise<{
  patterns: LearnedPattern[];
  insights: AIInsight[];
  stats: {
    totalInteractions: number;
    successRate: number;
    topCallPoints: Array<{ callPoint: string; count: number }>;
    modelsUsed?: string;
  };
}> {
  const [patterns, interactions] = await Promise.all([
    prisma.aILearnedPattern.findMany({
      where: { confidence: { gte: 0.3 } },
      orderBy: { confidence: "desc" },
    }),
    prisma.aIInteractionLog.findMany({
      select: {
        callPoint: true,
        outcome: true,
        metadata: true,
      },
    }),
  ]);

  const totalInteractions = interactions.length;
  const successCount = interactions.filter((i) => i.outcome === "success").length;
  const successRate = totalInteractions > 0 ? successCount / totalInteractions : 0;

  const callPointCounts = new Map<string, number>();
  interactions.forEach((i) => {
    callPointCounts.set(i.callPoint, (callPointCounts.get(i.callPoint) || 0) + 1);
  });

  const topCallPoints = Array.from(callPointCounts.entries())
    .map(([callPoint, count]) => ({ callPoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Extract unique models used
  const modelsSet = new Set<string>();
  interactions.forEach((i) => {
    const metadata = i.metadata as any;
    if (metadata?.model) {
      modelsSet.add(metadata.model);
    }
  });
  const modelsUsed = modelsSet.size > 0 ? Array.from(modelsSet).join(", ") : undefined;

  const insights = await generateInsights({ minConfidence: 0.6 });

  return {
    patterns: patterns.map((p) => ({
      pattern: p.pattern,
      confidence: p.confidence,
      occurrences: p.occurrences,
      examples: p.examples as string[],
      domain: p.domain || undefined,
      callPoint: p.callPoint,
    })),
    insights,
    stats: {
      totalInteractions,
      successRate,
      topCallPoints,
      modelsUsed,
    },
  };
}
