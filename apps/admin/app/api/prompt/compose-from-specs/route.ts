import { NextRequest, NextResponse } from "next/server";
import {
  composePromptsFromSpecs,
  TemplateContext,
} from "@/lib/prompt/PromptTemplateCompiler";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * POST /api/prompt/compose-from-specs
 *
 * New spec-based prompt composition.
 * Gathers all active AnalysisSpecs with promptTemplates and renders them
 * with the provided context (parameter values, memories, etc.)
 *
 * Request body:
 * - userId?: string - Fetch user's parameter values and memories
 * - callerId?: string - Fetch caller's latest values
 * - parameterValues?: Record<string, number> - Override/provide parameter values
 * - includeMemories?: boolean - Include user memories in composition (default: true)
 * - domain?: string - Filter specs by domain
 * - outputType?: "MEASURE" | "LEARN" - Filter specs by output type
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      callerId,
      parameterValues: providedValues,
      includeMemories = true,
      domain,
      outputType,
    } = body;

    // Build the template context
    const context: TemplateContext = {
      userId,
      callerId,
      parameterValues: providedValues || {},
    };

    // If userId provided, fetch their latest parameter values
    if (userId && !providedValues) {
      const userProfile = await prisma.userPersonalityProfile.findUnique({
        where: { userId },
      });
      if (userProfile?.parameterValues) {
        context.parameterValues = userProfile.parameterValues as Record<string, number>;
      }
    }

    // If callerId provided, fetch caller's user and their values
    if (callerId && !userId) {
      const caller = await prisma.caller.findUnique({
        where: { id: callerId },
        include: {
          user: {
            include: {
              personalityProfile: true,
            },
          },
        },
      });
      if (caller?.user) {
        context.userId = caller.user.id;
        if (caller.user.personalityProfile?.parameterValues) {
          context.parameterValues = caller.user.personalityProfile.parameterValues as Record<
            string,
            number
          >;
        }
      }
    }

    // Fetch memories if needed
    if (includeMemories && context.userId) {
      const memories = await prisma.userMemory.findMany({
        where: {
          userId: context.userId,
          supersededById: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: [{ confidence: "desc" }, { extractedAt: "desc" }],
        take: 100,
      });

      context.memories = memories.map((m) => ({
        category: m.category,
        key: m.key,
        value: m.value,
        confidence: m.confidence,
        decayFactor: m.decayFactor,
      }));
    }

    // Compose prompts from specs
    const result = await composePromptsFromSpecs(context);

    // Optionally filter by domain or outputType
    let filteredPrompts = result.prompts;
    if (domain) {
      filteredPrompts = filteredPrompts.filter((p) => p.domain === domain);
    }
    if (outputType) {
      filteredPrompts = filteredPrompts.filter((p) => p.outputType === outputType);
    }

    // Build the combined prompt text
    const combinedPrompt = filteredPrompts.map((p) => p.renderedPrompt).join("\n\n");

    return NextResponse.json({
      ok: true,
      prompt: combinedPrompt,
      prompts: filteredPrompts,
      metadata: {
        totalSpecs: result.totalSpecs,
        specsWithTemplates: result.specsWithTemplates,
        promptsRendered: filteredPrompts.length,
        memoriesIncluded: result.memoriesIncluded,
        composedAt: result.composedAt,
        parameterValuesUsed: context.parameterValues,
      },
    });
  } catch (error: any) {
    console.error("Spec-based prompt compose error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to compose prompts" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prompt/compose-from-specs?userId=...
 *
 * Quick spec-based composition for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const callerId = searchParams.get("callerId");
    const domain = searchParams.get("domain");
    const outputType = searchParams.get("outputType") as "MEASURE" | "LEARN" | null;

    if (!userId && !callerId) {
      return NextResponse.json(
        { ok: false, error: "Must provide userId or callerId" },
        { status: 400 }
      );
    }

    // Build context
    const context: TemplateContext = {
      userId: userId || undefined,
      callerId: callerId || undefined,
      parameterValues: {},
    };

    // Fetch parameter values
    if (userId) {
      const userProfile = await prisma.userPersonalityProfile.findUnique({
        where: { userId },
      });
      if (userProfile?.parameterValues) {
        context.parameterValues = userProfile.parameterValues as Record<string, number>;
      }
    } else if (callerId) {
      const caller = await prisma.caller.findUnique({
        where: { id: callerId },
        include: {
          user: {
            include: {
              personalityProfile: true,
            },
          },
        },
      });
      if (caller?.user) {
        context.userId = caller.user.id;
        if (caller.user.personalityProfile?.parameterValues) {
          context.parameterValues = caller.user.personalityProfile.parameterValues as Record<
            string,
            number
          >;
        }
      }
    }

    // Fetch memories
    if (context.userId) {
      const memories = await prisma.userMemory.findMany({
        where: {
          userId: context.userId,
          supersededById: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: [{ confidence: "desc" }, { extractedAt: "desc" }],
        take: 50,
      });

      context.memories = memories.map((m) => ({
        category: m.category,
        key: m.key,
        value: m.value,
        confidence: m.confidence,
        decayFactor: m.decayFactor,
      }));
    }

    // Compose
    const result = await composePromptsFromSpecs(context);

    // Filter
    let filteredPrompts = result.prompts;
    if (domain) {
      filteredPrompts = filteredPrompts.filter((p) => p.domain === domain);
    }
    if (outputType) {
      filteredPrompts = filteredPrompts.filter((p) => p.outputType === outputType);
    }

    const combinedPrompt = filteredPrompts.map((p) => p.renderedPrompt).join("\n\n");

    return NextResponse.json({
      ok: true,
      prompt: combinedPrompt,
      promptCount: filteredPrompts.length,
      specCount: result.totalSpecs,
      memoryCount: result.memoriesIncluded,
    });
  } catch (error: any) {
    console.error("Spec-based prompt compose error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to compose prompts" },
      { status: 500 }
    );
  }
}
