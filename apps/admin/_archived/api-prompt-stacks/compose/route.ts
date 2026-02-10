import { NextRequest, NextResponse } from "next/server";
import {
  composePromptForCaller,
  previewComposition,
  ParameterValues,
  ParameterDeltas,
} from "@/lib/prompt/PromptComposer";

export const runtime = "nodejs";

/**
 * POST /api/prompt-stacks/compose
 *
 * Compose a prompt using either:
 * 1. A caller ID (uses their assigned stack and fetches their parameter values)
 * 2. A stack ID + parameter values (for preview/testing)
 *
 * Body:
 * {
 *   // Option 1: Compose for a specific caller
 *   callerId?: string,
 *   parameterValues?: { parameterId: value, ... },
 *   parameterDeltas?: { parameterId: delta, ... },
 *
 *   // Option 2: Preview a stack with test values
 *   stackId?: string,
 *   parameterValues: { parameterId: value, ... },
 *   parameterDeltas?: { parameterId: delta, ... },
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { callerId, stackId, parameterValues, parameterDeltas } = body;

    // Validate input
    if (!callerId && !stackId) {
      return NextResponse.json(
        { ok: false, error: "Either callerId or stackId is required" },
        { status: 400 }
      );
    }

    if (stackId && !parameterValues) {
      return NextResponse.json(
        { ok: false, error: "parameterValues required when using stackId" },
        { status: 400 }
      );
    }

    let result;

    if (callerId) {
      // Compose for a specific caller
      // If parameterValues provided, use them; otherwise the service will fetch from caller context
      result = await composePromptForCaller(
        callerId,
        parameterValues || {},
        parameterDeltas
      );
    } else {
      // Preview mode: use stackId + provided parameter values
      result = await previewComposition(
        stackId,
        parameterValues as ParameterValues,
        parameterDeltas as ParameterDeltas | undefined
      );
    }

    return NextResponse.json({
      ok: true,
      composition: result,
    });
  } catch (error: any) {
    console.error("POST /api/prompt-stacks/compose error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to compose prompt" },
      { status: 500 }
    );
  }
}
