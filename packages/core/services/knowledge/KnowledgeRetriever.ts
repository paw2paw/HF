/**
 * KnowledgeRetriever service
 *
 * Retrieves relevant knowledge chunks for prompt enrichment.
 * This module is designed to be pure - actual DB/vector queries
 * are injected via the KnowledgeStore interface.
 */

type ID = string;

/**
 * A retrieved knowledge chunk with relevance scoring
 */
export interface RetrievedChunk {
  id: ID;
  docId: ID;
  sourcePath: string;
  title?: string;
  content: string;
  chunkIndex: number;
  relevanceScore: number;  // 0-1, higher = more relevant
  source: 'vector' | 'keyword' | 'artifact' | 'cached';
}

/**
 * Context for knowledge retrieval
 */
export interface RetrievalContext {
  /** The text to find relevant knowledge for (e.g., transcript excerpt) */
  queryText: string;
  /** Optional: specific parameter ID to focus retrieval on */
  parameterId?: ID;
  /** Optional: user ID for personalized retrieval */
  userId?: ID;
  /** Optional: call ID for call-specific context */
  callId?: ID;
  /** Maximum chunks to return */
  limit?: number;
  /** Minimum relevance score threshold (0-1) */
  minRelevance?: number;
}

/**
 * Interface for knowledge storage backends (DB, vector store, etc.)
 * Implement this to connect to actual storage.
 */
export interface KnowledgeStore {
  /**
   * Search for chunks by vector similarity
   */
  searchByVector(
    queryEmbedding: number[],
    limit: number,
    minScore?: number
  ): Promise<RetrievedChunk[]>;

  /**
   * Search for chunks by keyword/text match (fallback)
   */
  searchByKeyword(
    keywords: string[],
    limit: number
  ): Promise<RetrievedChunk[]>;

  /**
   * Get curated artifacts for a parameter
   */
  getArtifactsForParameter(
    parameterId: ID
  ): Promise<RetrievedChunk[]>;

  /**
   * Get cached/pre-linked chunks for a parameter
   */
  getLinkedChunks(
    parameterId: ID,
    limit: number
  ): Promise<RetrievedChunk[]>;
}

/**
 * Interface for embedding generation
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

/**
 * Result of knowledge retrieval
 */
export interface RetrievalResult {
  chunks: RetrievedChunk[];
  /** How retrieval was performed */
  method: 'vector' | 'keyword' | 'hybrid' | 'cached';
  /** Total time in ms */
  durationMs: number;
}

/**
 * KnowledgeRetriever - retrieves relevant knowledge for prompt enrichment
 */
export class KnowledgeRetriever {
  constructor(
    private store: KnowledgeStore,
    private embedder?: EmbeddingProvider
  ) {}

  /**
   * Retrieve relevant knowledge chunks for the given context.
   * Uses vector search if embedder available, falls back to keyword.
   */
  async retrieve(context: RetrievalContext): Promise<RetrievalResult> {
    const start = Date.now();
    const limit = context.limit ?? 10;
    const minRelevance = context.minRelevance ?? 0.5;

    let chunks: RetrievedChunk[] = [];
    let method: RetrievalResult['method'] = 'keyword';

    // Strategy 1: If we have a parameterId, check for pre-linked chunks first
    if (context.parameterId) {
      const linked = await this.store.getLinkedChunks(context.parameterId, limit);
      if (linked.length >= limit) {
        return {
          chunks: linked.slice(0, limit),
          method: 'cached',
          durationMs: Date.now() - start,
        };
      }
      chunks.push(...linked);
    }

    // Strategy 2: Vector search if embedder is available
    if (this.embedder && context.queryText) {
      try {
        const embedding = await this.embedder.embed(context.queryText);
        const vectorResults = await this.store.searchByVector(
          embedding,
          limit - chunks.length,
          minRelevance
        );
        chunks.push(...vectorResults);
        method = chunks.length > 0 ? 'vector' : 'keyword';
      } catch (e) {
        // Fall through to keyword search
        console.warn('Vector search failed, falling back to keyword:', e);
      }
    }

    // Strategy 3: Keyword fallback if we don't have enough chunks
    if (chunks.length < limit && context.queryText) {
      const keywords = extractKeywords(context.queryText);
      if (keywords.length > 0) {
        const keywordResults = await this.store.searchByKeyword(
          keywords,
          limit - chunks.length
        );
        chunks.push(...keywordResults);
        method = method === 'vector' ? 'hybrid' : 'keyword';
      }
    }

    // Strategy 4: Get artifacts if we have a parameterId
    if (context.parameterId && chunks.length < limit) {
      const artifacts = await this.store.getArtifactsForParameter(context.parameterId);
      chunks.push(...artifacts);
    }

    // Deduplicate by chunk ID and sort by relevance
    const seen = new Set<string>();
    const unique = chunks.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    unique.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      chunks: unique.slice(0, limit),
      method,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Extract keywords from text for fallback search.
 * Simple implementation - can be enhanced with NLP.
 */
function extractKeywords(text: string, maxKeywords = 10): string[] {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'that', 'this', 'these', 'those', 'it', 'its', 'i', 'you', 'he',
    'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'when', 'where',
    'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  // Count frequency
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  // Sort by frequency and return top keywords
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * Format retrieved chunks for inclusion in a prompt.
 * This is the standard way to convert chunks to prompt context.
 */
export function formatChunksForPrompt(
  chunks: RetrievedChunk[],
  options?: {
    maxChars?: number;
    includeSource?: boolean;
    header?: string;
  }
): string {
  if (chunks.length === 0) return '';

  const maxChars = options?.maxChars ?? 4000;
  const includeSource = options?.includeSource ?? true;
  const header = options?.header ?? 'Relevant Knowledge Context:';

  const lines: string[] = [header, ''];
  let totalChars = header.length + 2;

  for (const chunk of chunks) {
    const source = includeSource && chunk.title
      ? `[${chunk.title}] `
      : '';
    const line = `${source}${chunk.content}`;

    if (totalChars + line.length > maxChars) {
      // Truncate if we're over budget
      const remaining = maxChars - totalChars - 20;
      if (remaining > 100) {
        lines.push(line.substring(0, remaining) + '...');
      }
      break;
    }

    lines.push(line);
    lines.push(''); // blank line between chunks
    totalChars += line.length + 1;
  }

  return lines.join('\n').trim();
}
