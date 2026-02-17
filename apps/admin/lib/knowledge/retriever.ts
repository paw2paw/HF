/**
 * Knowledge Retriever for Prompt Enrichment
 *
 * Retrieves relevant knowledge chunks from the database to inject
 * into prompts, making the LLM "expert" in the ingested domain.
 *
 * Supports hybrid search: pgvector cosine similarity + keyword fallback.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { toVectorLiteral } from "@/lib/embeddings";

export interface KnowledgeChunkResult {
  id: string;
  title?: string;
  content: string;
  relevanceScore: number;
  sourcePath: string;
  chunkIndex: number;
}

export interface RetrievalParams {
  /** Text to match against (e.g., transcript excerpt) */
  queryText?: string;
  /** Pre-computed query embedding for vector search */
  queryEmbedding?: number[];
  /** Call ID to get transcript from */
  callId?: string;
  /** Caller ID for personalized retrieval */
  callerId?: string;
  /** Parameter ID for parameter-specific retrieval */
  parameterId?: string;
  /** Maximum chunks to return */
  limit?: number;
  /** Minimum relevance threshold (0-1) */
  minRelevance?: number;
}

/**
 * Retrieve knowledge chunks for prompt enrichment.
 *
 * Strategy priority:
 * 1. If parameterId provided, get pre-linked chunks first
 * 2. If queryEmbedding provided, use vector similarity search
 * 3. If queryText provided, use keyword matching (fallback)
 * 4. Fall back to recent/popular chunks
 */
export async function retrieveKnowledgeForPrompt(
  params: RetrievalParams
): Promise<KnowledgeChunkResult[]> {
  const limit = params.limit ?? 5;
  const minRelevance = params.minRelevance ?? 0.3;
  const results: KnowledgeChunkResult[] = [];

  // Strategy 1: Get pre-linked chunks for parameter
  if (params.parameterId) {
    const linked = await getLinkedChunksForParameter(params.parameterId, limit);
    results.push(...linked);
    if (results.length >= limit) {
      return results.slice(0, limit);
    }
  }

  // Strategy 2: Get queryText from call transcript if needed
  let queryText = params.queryText;
  if (!queryText && params.callId) {
    queryText = await getTranscriptText(params.callId);
  }

  // Strategy 3: Vector search (if embedding provided)
  if (params.queryEmbedding && results.length < limit) {
    const vectorResults = await searchByVectorSimilarity(
      params.queryEmbedding,
      limit - results.length,
      minRelevance,
    );
    results.push(...vectorResults);
  }

  // Strategy 4: Keyword search (fallback or supplement)
  if (queryText && results.length < limit) {
    const keywords = extractKeywords(queryText);
    if (keywords.length > 0) {
      const keywordResults = await searchByKeywords(keywords, limit - results.length);
      results.push(...keywordResults);
    }
  }

  // Strategy 5: Fall back to recent knowledge chunks
  if (results.length < limit) {
    const recent = await getRecentChunks(limit - results.length);
    results.push(...recent);
  }

  // Deduplicate and return
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return r.relevanceScore >= minRelevance;
  }).slice(0, limit);
}

/**
 * Get chunks that have been pre-linked to a parameter (via ParameterKnowledgeLink)
 */
async function getLinkedChunksForParameter(
  parameterId: string,
  limit: number
): Promise<KnowledgeChunkResult[]> {
  const links = await prisma.parameterKnowledgeLink.findMany({
    where: { parameterId },
    orderBy: { relevanceScore: "desc" },
    take: limit,
    include: {
      chunk: {
        include: {
          doc: { select: { title: true, sourcePath: true } },
        },
      },
    },
  });

  return links.map((link) => ({
    id: link.chunk.id,
    title: link.chunk.doc.title ?? undefined,
    content: link.chunk.content,
    relevanceScore: link.relevanceScore,
    sourcePath: link.chunk.doc.sourcePath,
    chunkIndex: link.chunk.chunkIndex,
  }));
}

/**
 * Search chunks by keyword matching (LIKE query — fallback when no embeddings)
 */
async function searchByKeywords(
  keywords: string[],
  limit: number
): Promise<KnowledgeChunkResult[]> {
  if (keywords.length === 0) return [];

  // Build OR conditions for keyword matching
  const conditions = keywords.slice(0, 5).map((kw) => ({
    content: { contains: kw, mode: "insensitive" as const },
  }));

  const chunks = await prisma.knowledgeChunk.findMany({
    where: { OR: conditions },
    take: limit,
    include: {
      doc: { select: { title: true, sourcePath: true } },
    },
  });

  // Score by number of keyword matches
  return chunks.map((chunk) => {
    const lowerContent = chunk.content.toLowerCase();
    const matches = keywords.filter((kw) => lowerContent.includes(kw.toLowerCase())).length;
    const relevanceScore = Math.min(1, matches / keywords.length + 0.3);

    return {
      id: chunk.id,
      title: chunk.doc.title ?? undefined,
      content: chunk.content,
      relevanceScore,
      sourcePath: chunk.doc.sourcePath,
      chunkIndex: chunk.chunkIndex,
    };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Get recent chunks as fallback
 */
async function getRecentChunks(limit: number): Promise<KnowledgeChunkResult[]> {
  const chunks = await prisma.knowledgeChunk.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      doc: { select: { title: true, sourcePath: true } },
    },
  });

  return chunks.map((chunk) => ({
    id: chunk.id,
    title: chunk.doc.title ?? undefined,
    content: chunk.content,
    relevanceScore: 0.3, // Low default relevance for fallback
    sourcePath: chunk.doc.sourcePath,
    chunkIndex: chunk.chunkIndex,
  }));
}

/**
 * Get transcript text from a call
 */
async function getTranscriptText(callId: string): Promise<string | undefined> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: { transcript: true },
  });
  return call?.transcript ?? undefined;
}

/**
 * Extract keywords from text for search
 */
function extractKeywords(text: string, maxKeywords = 10): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can", "need",
    "that", "this", "these", "those", "it", "its", "i", "you", "he",
    "she", "we", "they", "what", "which", "who", "whom", "when", "where",
    "why", "how", "all", "each", "every", "both", "few", "more", "most",
    "other", "some", "such", "no", "nor", "not", "only", "own", "same",
    "so", "than", "too", "very", "just", "also", "now", "here", "there",
    "okay", "yeah", "yes", "no", "um", "uh", "like", "know", "think",
    "going", "want", "need", "got", "get", "say", "said", "tell", "told",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Count frequency
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  // Return top keywords by frequency
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * Vector similarity search using pgvector cosine distance.
 * Returns chunks ordered by semantic similarity to the query embedding.
 */
export async function searchByVectorSimilarity(
  queryEmbedding: number[],
  limit: number,
  minScore = 0.5
): Promise<KnowledgeChunkResult[]> {
  const vectorLiteral = toVectorLiteral(queryEmbedding);

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    content: string;
    chunkIndex: number;
    title: string | null;
    sourcePath: string;
    similarity: number;
  }>>(
    Prisma.sql`
      SELECT c.id, c.content, c."chunkIndex", d.title, d."sourcePath",
             1 - (v.embedding <=> ${vectorLiteral}::vector) as similarity
      FROM "KnowledgeChunk" c
      JOIN "VectorEmbedding" v ON c.id = v."chunkId"
      JOIN "KnowledgeDoc" d ON c."docId" = d.id
      WHERE v.embedding IS NOT NULL
      ORDER BY v.embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `
  );

  return rows
    .filter((r) => r.similarity >= minScore)
    .map((r) => ({
      id: r.id,
      title: r.title ?? undefined,
      content: r.content,
      relevanceScore: r.similarity,
      sourcePath: r.sourcePath,
      chunkIndex: r.chunkIndex,
    }));
}
