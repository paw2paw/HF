import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retrieveKnowledgeForPrompt } from "@/lib/knowledge/retriever";
import { verifyVapiRequest } from "@/lib/vapi/auth";

export const runtime = "nodejs";

/**
 * @api POST /api/vapi/knowledge
 * @visibility public
 * @scope vapi:knowledge
 * @auth webhook-secret
 * @tags vapi, knowledge, rag
 * @description VAPI Custom Knowledge Base endpoint. Called every conversation turn.
 *   Receives conversation history, returns relevant teaching assertions,
 *   knowledge chunks, and caller memories.
 *
 *   Target: <50ms response time.
 *
 *   VAPI Custom KB format:
 *   - Request: { type: "knowledge-base-request", messages: [...] }
 *   - Response: { results: [{ content, similarity }] } or { message: { content } }
 *
 *   Ref: https://docs.vapi.ai/knowledge-base/custom-knowledge-base
 */
export async function POST(request: NextRequest) {
  const startMs = Date.now();

  try {
    const rawBody = await request.text();
    const authError = verifyVapiRequest(request, rawBody);
    if (authError) return authError;

    const body = JSON.parse(rawBody);
    const messages = body.message?.messages || body.messages || [];
    const callId = body.message?.call?.id || body.call?.id;
    const customerPhone =
      body.message?.call?.customer?.number ||
      body.call?.customer?.number;

    // Extract last 2-3 user messages as query context
    const userMessages = messages
      .filter((m: any) => m.role === "user" && m.content)
      .slice(-3);

    const queryText = userMessages.map((m: any) => m.content).join(" ");

    if (!queryText) {
      return NextResponse.json({ results: [] });
    }

    // Find caller for personalized retrieval
    let callerId: string | null = null;
    if (customerPhone) {
      const caller = await prisma.caller.findFirst({
        where: { phone: customerPhone.replace(/\s+/g, "") },
        select: { id: true, domainId: true },
      });
      callerId = caller?.id || null;
    }

    // Run retrieval strategies in parallel
    const [knowledgeResults, assertionResults, memoryResults] = await Promise.all([
      // 1. Knowledge chunks (keyword search, vector search when available)
      retrieveKnowledgeForPrompt({
        queryText,
        callerId: callerId || undefined,
        limit: 5,
        minRelevance: 0.3,
      }),

      // 2. Teaching assertions (tag + keyword match)
      searchAssertions(queryText, 5),

      // 3. Caller memories relevant to current topic
      callerId ? searchCallerMemories(callerId, queryText, 3) : Promise.resolve([]),
    ]);

    // Merge and rank results
    const results: Array<{ content: string; similarity: number }> = [];

    // Add teaching assertions (highest value for tutoring)
    for (const a of assertionResults) {
      results.push({
        content: formatAssertion(a),
        similarity: a.relevanceScore,
      });
    }

    // Add knowledge chunks
    for (const k of knowledgeResults) {
      results.push({
        content: k.title ? `[${k.title}] ${k.content}` : k.content,
        similarity: k.relevanceScore,
      });
    }

    // Add caller memories
    for (const m of memoryResults) {
      results.push({
        content: `[Caller Memory] ${m.key}: ${m.value}`,
        similarity: m.relevanceScore,
      });
    }

    // Sort by similarity, take top 10
    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, 10);

    const elapsed = Date.now() - startMs;
    console.log(
      `[vapi/knowledge] ${topResults.length} results in ${elapsed}ms ` +
        `(assertions: ${assertionResults.length}, chunks: ${knowledgeResults.length}, memories: ${memoryResults.length})`,
    );

    return NextResponse.json({ results: topResults });
  } catch (error: any) {
    console.error("[vapi/knowledge] Error:", error);
    // Return empty results on error — don't break the call
    return NextResponse.json({ results: [] });
  }
}

/**
 * Search ContentAssertions by tag and keyword matching.
 */
async function searchAssertions(
  queryText: string,
  limit: number,
): Promise<Array<{
  assertion: string;
  category: string;
  chapter: string | null;
  tags: string[];
  trustLevel: string | null;
  examRelevance: number | null;
  sourceName: string;
  relevanceScore: number;
}>> {
  // Extract keywords for tag matching
  const words = queryText
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) return [];

  // Search by content and tags
  const assertions = await prisma.contentAssertion.findMany({
    where: {
      OR: [
        // Match assertion text
        ...words.slice(0, 5).map((w) => ({
          assertion: { contains: w, mode: "insensitive" as const },
        })),
        // Match tags
        { tags: { hasSome: words.slice(0, 10) } },
      ],
    },
    take: limit * 2, // Fetch extra for scoring
    include: {
      source: { select: { name: true, trustLevel: true } },
    },
  });

  // Score by keyword overlap
  return assertions
    .map((a) => {
      const lowerAssertion = a.assertion.toLowerCase();
      const tagSet = new Set(a.tags.map((t) => t.toLowerCase()));
      const contentMatches = words.filter((w) => lowerAssertion.includes(w)).length;
      const tagMatches = words.filter((w) => tagSet.has(w)).length;
      const relevanceScore = Math.min(
        1,
        (contentMatches + tagMatches * 1.5) / words.length * 0.7 +
          (a.examRelevance || 0.5) * 0.3,
      );

      return {
        assertion: a.assertion,
        category: a.category,
        chapter: a.chapter,
        tags: a.tags,
        trustLevel: a.trustLevel,
        examRelevance: a.examRelevance,
        sourceName: a.source.name,
        relevanceScore,
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

/**
 * Search caller memories relevant to the current conversation topic.
 */
async function searchCallerMemories(
  callerId: string,
  queryText: string,
  limit: number,
): Promise<Array<{ key: string; value: string; category: string; relevanceScore: number }>> {
  const words = queryText
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) return [];

  const memories = await prisma.callerMemory.findMany({
    where: {
      callerId,
      supersededById: null,
      OR: [
        ...words.slice(0, 5).map((w) => ({
          key: { contains: w, mode: "insensitive" as const },
        })),
        ...words.slice(0, 5).map((w) => ({
          value: { contains: w, mode: "insensitive" as const },
        })),
      ],
    },
    take: limit,
    orderBy: { confidence: "desc" },
  });

  return memories.map((m) => {
    const lowerKey = m.key.toLowerCase();
    const lowerValue = m.value.toLowerCase();
    const matches = words.filter(
      (w) => lowerKey.includes(w) || lowerValue.includes(w),
    ).length;

    return {
      key: m.key,
      value: m.value,
      category: m.category,
      relevanceScore: Math.min(1, matches / words.length + 0.3),
    };
  });
}

/**
 * Format a teaching assertion for voice AI consumption.
 */
function formatAssertion(a: {
  assertion: string;
  category: string;
  chapter: string | null;
  sourceName: string;
  trustLevel: string | null;
}): string {
  const parts = [`[${a.category.toUpperCase()}]`];
  if (a.chapter) parts.push(`(${a.chapter})`);
  parts.push(a.assertion);
  if (a.trustLevel) parts.push(`[Trust: ${a.trustLevel}]`);
  return parts.join(" ");
}
