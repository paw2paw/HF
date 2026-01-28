import { NextResponse } from "next/server";
import {
  selectPromptSlug,
  savePromptSlugSelection,
  getAllPromptSlugs,
  getSelectionHistory,
} from "@/lib/ops/prompt-slug-selector";
import { retrieveKnowledgeForPrompt } from "@/lib/knowledge/retriever";

export const runtime = "nodejs";

/**
 * POST /api/prompt-slug/select
 *
 * Select a prompt slug for a given caller/call based on personality profile
 *
 * Body:
 * {
 *   "callId": "uuid",           // Optional: call ID
 *   "callerId": "uuid",         // Optional: caller ID (one of callId or callerId required)
 *   "maxRecent": 3,             // Optional: number of recent slugs to avoid
 *   "saveToDb": true,           // Optional: whether to save selection to DB (default true)
 *   "includeKnowledge": true,   // Optional: retrieve relevant knowledge chunks (default true)
 *   "queryText": "...",         // Optional: text to find relevant knowledge for
 *   "knowledgeLimit": 5         // Optional: max knowledge chunks to return (default 5)
 * }
 *
 * Response:
 * {
 *   "ok": true,
 *   "promptSlug": "emotion.soothing",
 *   "confidence": 0.85,
 *   "reasoning": "High neuroticism detected",
 *   "personalitySnapshot": { ... },
 *   "recentSlugs": ["control.clarify", "engage.encourage"],
 *   "knowledgeContext": [{ id, title, content, relevanceScore }]  // If includeKnowledge=true
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      callId,
      callerId,
      maxRecent,
      saveToDb = true,
      includeKnowledge = true,
      queryText,
      knowledgeLimit = 5,
    } = body;

    if (!callId && !callerId) {
      return NextResponse.json(
        { ok: false, error: "Either callId or callerId is required" },
        { status: 400 }
      );
    }

    // Select prompt slug
    const selection = await selectPromptSlug({
      callId,
      callerId,
      maxRecent,
    });

    // Retrieve knowledge context if requested
    let knowledgeContext = null;
    if (includeKnowledge) {
      try {
        knowledgeContext = await retrieveKnowledgeForPrompt({
          queryText,
          callId,
          callerId,
          limit: knowledgeLimit,
        });
      } catch (kErr: any) {
        console.warn("[Knowledge Retrieval Warning]:", kErr?.message);
        // Non-fatal: continue without knowledge
      }
    }

    // Save to database if requested and we have a callId
    if (saveToDb && callId && (callerId || selection)) {
      const effectiveCallerId = callerId || (await getCallerIdFromCall(callId));
      if (effectiveCallerId) {
        await savePromptSlugSelection(callId, effectiveCallerId, selection);
      }
    }

    return NextResponse.json({
      ok: true,
      ...selection,
      ...(knowledgeContext ? { knowledgeContext } : {}),
    });
  } catch (err: any) {
    console.error("[Prompt Slug Selection Error]:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to select prompt slug" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prompt-slug/select?callerId=xxx
 *
 * Get selection history for a caller
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const callerId = url.searchParams.get("callerId");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const action = url.searchParams.get("action");

    // Action: Get all available prompt slugs
    if (action === "list-slugs") {
      const slugs = getAllPromptSlugs();
      return NextResponse.json({
        ok: true,
        slugs,
      });
    }

    // Action: Get selection history
    if (callerId) {
      const history = await getSelectionHistory(callerId, limit);
      return NextResponse.json({
        ok: true,
        history,
      });
    }

    return NextResponse.json(
      { ok: false, error: "callerId or action=list-slugs required" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[Prompt Slug History Error]:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to get history" },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get callerId from callId
 */
async function getCallerIdFromCall(callId: string): Promise<string | null> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { callerId: true },
    });
    return call?.callerId ?? null;
  } finally {
    await prisma.$disconnect();
  }
}
