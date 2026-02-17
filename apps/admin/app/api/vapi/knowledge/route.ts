import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retrieveKnowledgeForPrompt } from "@/lib/knowledge/retriever";
import { verifyVapiRequest } from "@/lib/vapi/auth";
import { embedText } from "@/lib/embeddings";
import { getKnowledgeRetrievalSettings } from "@/lib/system-settings";
import {
  searchAssertionsHybrid,
  searchAssertions,
  searchCallerMemories,
  formatAssertion,
} from "@/lib/knowledge/assertions";

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
 *   Uses hybrid search: pgvector cosine similarity + keyword fallback.
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

    // Load retrieval settings (30s cache)
    const ks = await getKnowledgeRetrievalSettings();

    // Extract last N user messages as query context
    const userMessages = messages
      .filter((m: any) => m.role === "user" && m.content)
      .slice(-ks.queryMessageCount);

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

    // Embed query text for vector search (runs in parallel with DB lookups below)
    let queryEmbedding: number[] | undefined;
    try {
      queryEmbedding = await embedText(queryText);
    } catch (err) {
      console.warn("[vapi/knowledge] Embedding failed, falling back to keyword search:", err);
    }

    // Run retrieval strategies in parallel
    const [knowledgeResults, assertionResults, memoryResults] = await Promise.all([
      // 1. Knowledge chunks (vector + keyword hybrid)
      retrieveKnowledgeForPrompt({
        queryText,
        queryEmbedding,
        callerId: callerId || undefined,
        limit: ks.chunkLimit,
        minRelevance: ks.minRelevance,
      }),

      // 2. Teaching assertions (vector + tag/keyword hybrid)
      queryEmbedding
        ? searchAssertionsHybrid(queryText, queryEmbedding, ks.assertionLimit, ks.minRelevance)
        : searchAssertions(queryText, ks.assertionLimit),

      // 3. Caller memories relevant to current topic
      callerId ? searchCallerMemories(callerId, queryText, ks.memoryLimit) : Promise.resolve([]),
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

    // Sort by similarity, take top N
    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, ks.topResults);

    const elapsed = Date.now() - startMs;
    console.log(
      `[vapi/knowledge] ${topResults.length} results in ${elapsed}ms ` +
        `(assertions: ${assertionResults.length}, chunks: ${knowledgeResults.length}, memories: ${memoryResults.length}, vector: ${!!queryEmbedding})`,
    );

    return NextResponse.json({ results: topResults });
  } catch (error: any) {
    console.error("[vapi/knowledge] Error:", error);
    // Return empty results on error — don't break the call
    return NextResponse.json({ results: [] });
  }
}
