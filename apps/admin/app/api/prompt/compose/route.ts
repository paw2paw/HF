import { NextRequest, NextResponse } from "next/server";
import {
  composePromptForCaller,
  composePromptWithStack,
  previewPrompt,
} from "@/lib/prompt/PromptStackComposer";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/prompt/compose
 *
 * Compose a prompt using the PromptStack system.
 *
 * Modes:
 * 1. For a specific caller: { callerId: "..." }
 * 2. Preview with custom values: { stackId: "...", parameterValues: {...}, memories?: {...} }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callerId, stackId, parameterValues, memories } = body;

    // Mode 1: Compose for a specific caller
    if (callerId) {
      const result = await composePromptForCaller(callerId, {
        stackId: stackId || undefined,
        debug: true,
      });

      return NextResponse.json({
        ok: true,
        prompt: result.text,
        debug: {
          stackId: result.stackId,
          stackName: result.stackName,
          matches: result.matches,
          composedAt: result.composedAt,
        },
      });
    }

    // Mode 2: Preview with custom values
    if (stackId && parameterValues) {
      const result = await previewPrompt(stackId, parameterValues, memories);

      return NextResponse.json({
        ok: true,
        prompt: result.text,
        debug: {
          stackId: result.stackId,
          stackName: result.stackName,
          matches: result.matches,
          composedAt: result.composedAt,
        },
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Must provide either 'callerId' or 'stackId' with 'parameterValues'",
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Prompt compose error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to compose prompt" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prompt/compose?callerId=...
 *
 * Quick compose for a caller
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callerId = searchParams.get("callerId");

    if (!callerId) {
      return NextResponse.json(
        { ok: false, error: "Missing callerId parameter" },
        { status: 400 }
      );
    }

    const result = await composePromptForCaller(callerId);

    return NextResponse.json({
      ok: true,
      prompt: result.text,
      stackId: result.stackId,
      stackName: result.stackName,
      matchCount: result.matches.length,
    });
  } catch (error: any) {
    console.error("Prompt compose error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to compose prompt" },
      { status: 500 }
    );
  }
}
