import { NextRequest, NextResponse } from "next/server";
import { composePromptForCaller, previewPrompt, CallerContext, MemoryItem } from "@/lib/prompt/PromptStackComposer";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/prompt/generate
 *
 * Generate a complete "Next Prompt" for a user/caller.
 *
 * This endpoint combines:
 * 1. Static system prompts (from PromptBlocks)
 * 2. Dynamic personality-driven prompts (from PromptSlugs based on parameter scores)
 * 3. User memories (facts, preferences, etc.)
 *
 * Modes:
 * 1. For a specific user: { userId: "..." }
 *    - Looks up user's personality scores and memories
 *    - Uses default or assigned prompt stack
 *
 * 2. For a specific caller: { callerId: "..." }
 *    - Uses the caller's linked user data
 *
 * 3. Preview with custom values: { stackId: "...", parameterValues: {...}, memories: {...} }
 *    - Test prompt generation without a real user
 *
 * Returns:
 * - prompt: The complete generated prompt text
 * - sections: Breakdown of what was included
 * - debug: Match information (which slugs fired, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, callerId, stackId, parameterValues, memories } = body;

    // Mode 1: Generate for a user ID
    if (userId) {
      const result = await generatePromptForUser(userId, stackId);
      return NextResponse.json({ ok: true, ...result });
    }

    // Mode 2: Generate for a caller ID
    if (callerId) {
      const result = await composePromptForCaller(callerId, { stackId });
      return NextResponse.json({
        ok: true,
        prompt: result.text,
        stackId: result.stackId,
        stackName: result.stackName,
        matches: result.matches,
        composedAt: result.composedAt,
      });
    }

    // Mode 3: Preview with custom values
    if (stackId && parameterValues) {
      const memoryItems: Record<string, MemoryItem[]> = {};
      if (memories) {
        for (const [category, items] of Object.entries(memories)) {
          memoryItems[category] = (items as any[]).map((m) => ({
            key: m.key,
            value: m.value,
            confidence: m.confidence || 1.0,
            source: m.source || "manual",
          }));
        }
      }

      const result = await previewPrompt(stackId, parameterValues, memoryItems);
      return NextResponse.json({
        ok: true,
        prompt: result.text,
        stackId: result.stackId,
        stackName: result.stackName,
        matches: result.matches,
        composedAt: result.composedAt,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Must provide userId, callerId, or (stackId + parameterValues)" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Prompt generation error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to generate prompt" },
      { status: 500 }
    );
  }
}

/**
 * Generate prompt for a user by looking up their data
 */
async function generatePromptForUser(userId: string, overrideStackId?: string) {
  // Get user with personality and memories
  // Active memories are those not superseded (supersededById is null)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      personality: true,
      memories: {
        where: { supersededById: null },
        orderBy: [{ category: "asc" }, { confidence: "desc" }],
      },
    },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Build parameter values from personality
  const parameterValues: Record<string, number> = {};

  if (user.personality) {
    const p = user.personality;
    if (p.openness != null) parameterValues["B5-O"] = p.openness;
    if (p.conscientiousness != null) parameterValues["B5-C"] = p.conscientiousness;
    if (p.extraversion != null) parameterValues["B5-E"] = p.extraversion;
    if (p.agreeableness != null) parameterValues["B5-A"] = p.agreeableness;
    if (p.neuroticism != null) parameterValues["B5-N"] = p.neuroticism;
  }

  // Also check CallScores for this user's most recent call
  const latestCall = await prisma.call.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      scores: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (latestCall?.scores) {
    for (const score of latestCall.scores) {
      // Don't override personality scores, but add other parameters
      if (!parameterValues[score.parameterId]) {
        parameterValues[score.parameterId] = score.score;
      }
    }
  }

  // Build memories grouped by category
  const memories: Record<string, MemoryItem[]> = {};
  for (const mem of user.memories) {
    if (!memories[mem.category]) {
      memories[mem.category] = [];
    }
    memories[mem.category].push({
      key: mem.key,
      value: mem.value,
      confidence: mem.confidence,
      source: mem.source,
    });
  }

  // Get the stack to use
  let stackId = overrideStackId;
  if (!stackId) {
    // Find default published stack
    const defaultStack = await prisma.promptStack.findFirst({
      where: { isDefault: true, status: "PUBLISHED" },
    });
    if (!defaultStack) {
      throw new Error("No default published stack found");
    }
    stackId = defaultStack.id;
  }

  // Compose the prompt
  const result = await previewPrompt(stackId, parameterValues, memories);

  return {
    prompt: result.text,
    stackId: result.stackId,
    stackName: result.stackName,
    matches: result.matches,
    composedAt: result.composedAt,
    // Additional context
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    parameterValues,
    memoryCount: user.memories.length,
  };
}

/**
 * GET /api/prompt/generate
 *
 * Quick endpoint to show available stacks and a sample
 */
export async function GET() {
  try {
    // Get available stacks
    const stacks = await prisma.promptStack.findMany({
      where: { status: { in: ["DRAFT", "PUBLISHED"] } },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { items: true } },
      },
    });

    // Get sample users with data
    const usersWithData = await prisma.user.findMany({
      where: {
        OR: [
          { personality: { isNot: null } },
          { memories: { some: {} } },
        ],
      },
      include: {
        personality: true,
        _count: { select: { memories: true, calls: true } },
      },
      take: 10,
    });

    return NextResponse.json({
      ok: true,
      stacks: stacks.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        isDefault: s.isDefault,
        itemCount: s._count.items,
      })),
      users: usersWithData.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        hasPersonality: !!u.personality,
        memoryCount: u._count.memories,
        callCount: u._count.calls,
      })),
      usage: {
        forUser: "POST with { userId: '...' }",
        forCaller: "POST with { callerId: '...' }",
        preview: "POST with { stackId: '...', parameterValues: { 'B5-O': 0.8, ... }, memories: { FACT: [...] } }",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to get prompt info" },
      { status: 500 }
    );
  }
}
