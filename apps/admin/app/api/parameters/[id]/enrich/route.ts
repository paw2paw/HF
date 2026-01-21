import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * POST /api/parameters/[id]/enrich
 * Enriches a parameter's high/low interpretations by searching the KB
 * and using Claude to expand the definitions with deeper context.
 *
 * Body: {
 *   searchTerms?: string[],  // Optional additional terms to search
 *   model?: string,          // Claude model (default: claude-3-haiku-20240307)
 *   dryRun?: boolean,        // If true, returns enrichment without saving
 * }
 *
 * Returns:
 * - enrichedHigh: Expanded definition of high scores
 * - enrichedLow: Expanded definition of low scores
 * - chunksUsed: Array of chunk IDs used for enrichment
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      searchTerms = [],
      model = "claude-3-haiku-20240307",
      dryRun = false,
    } = body;

    // Find parameter (by ID or parameterId)
    const parameter = await prisma.parameter.findFirst({
      where: {
        OR: [{ id }, { parameterId: id }],
      },
      include: {
        scoringAnchors: {
          orderBy: { score: "asc" },
        },
      },
    });

    if (!parameter) {
      return NextResponse.json(
        { ok: false, error: "Parameter not found" },
        { status: 404 }
      );
    }

    // Build search terms from parameter
    const allSearchTerms = new Set<string>([
      parameter.name,
      parameter.parameterId,
      ...(parameter.interpretationHigh?.split(/[,;]/).map(s => s.trim()) || []),
      ...(parameter.interpretationLow?.split(/[,;]/).map(s => s.trim()) || []),
      ...searchTerms,
    ]);

    // Search KB chunks for relevant context
    const chunks = await searchKnowledgeChunks(Array.from(allSearchTerms));

    // Build enrichment prompt
    const enrichmentPrompt = buildEnrichmentPrompt(parameter, chunks);

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    // Call Claude to generate enriched definitions
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: enrichmentPrompt }],
    });

    const responseText = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse response
    const enrichment = parseEnrichmentResponse(responseText);

    if (!enrichment) {
      return NextResponse.json(
        { ok: false, error: "Failed to parse enrichment response" },
        { status: 500 }
      );
    }

    const chunkIds = chunks.map(c => c.id);

    // Save enrichment if not dry run
    if (!dryRun) {
      await prisma.parameter.update({
        where: { id: parameter.id },
        data: {
          enrichedHigh: enrichment.enrichedHigh,
          enrichedLow: enrichment.enrichedLow,
          enrichedAt: new Date(),
          enrichmentChunkIds: chunkIds,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      parameterId: parameter.parameterId,
      name: parameter.name,
      original: {
        interpretationHigh: parameter.interpretationHigh,
        interpretationLow: parameter.interpretationLow,
      },
      enriched: {
        enrichedHigh: enrichment.enrichedHigh,
        enrichedLow: enrichment.enrichedLow,
      },
      chunksUsed: chunks.map(c => ({
        id: c.id,
        title: c.title,
        relevance: c.relevance,
      })),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      saved: !dryRun,
    });
  } catch (error: any) {
    console.error("Enrichment error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to enrich parameter" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/parameters/[id]/enrich
 * Get current enrichment status for a parameter
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const parameter = await prisma.parameter.findFirst({
      where: {
        OR: [{ id }, { parameterId: id }],
      },
      select: {
        id: true,
        parameterId: true,
        name: true,
        interpretationHigh: true,
        interpretationLow: true,
        enrichedHigh: true,
        enrichedLow: true,
        enrichedAt: true,
        enrichmentChunkIds: true,
      },
    });

    if (!parameter) {
      return NextResponse.json(
        { ok: false, error: "Parameter not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      parameter,
      isEnriched: !!parameter.enrichedAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to get enrichment" },
      { status: 500 }
    );
  }
}

/**
 * Search KB chunks for terms relevant to a parameter
 */
async function searchKnowledgeChunks(terms: string[]): Promise<Array<{
  id: string;
  title: string;
  content: string;
  relevance: number;
}>> {
  // Search for chunks containing any of the terms
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      OR: terms.flatMap(term => [
        { content: { contains: term, mode: "insensitive" } },
        { title: { contains: term, mode: "insensitive" } },
      ]),
    },
    select: {
      id: true,
      title: true,
      content: true,
    },
    take: 10,
  });

  // Score relevance based on term matches
  return chunks.map(chunk => {
    const contentLower = chunk.content.toLowerCase();
    const titleLower = (chunk.title || "").toLowerCase();
    let relevance = 0;

    for (const term of terms) {
      const termLower = term.toLowerCase();
      if (titleLower.includes(termLower)) relevance += 2;
      if (contentLower.includes(termLower)) relevance += 1;
    }

    return {
      id: chunk.id,
      title: chunk.title || "Untitled",
      content: chunk.content,
      relevance,
    };
  }).sort((a, b) => b.relevance - a.relevance).slice(0, 5);
}

/**
 * Build the enrichment prompt for Claude
 */
function buildEnrichmentPrompt(
  parameter: any,
  chunks: Array<{ title: string; content: string }>
): string {
  const lines: string[] = [
    `You are enriching the definition of a behavioral parameter used in call analysis.`,
    ``,
    `# Parameter: ${parameter.name} (${parameter.parameterId})`,
    ``,
    `Definition: ${parameter.definition || "Not provided"}`,
    ``,
    `Current interpretations:`,
    `- HIGH (score near 1.0): ${parameter.interpretationHigh || "Not defined"}`,
    `- LOW (score near 0.0): ${parameter.interpretationLow || "Not defined"}`,
    ``,
  ];

  // Add scoring anchors if available
  if (parameter.scoringAnchors?.length > 0) {
    lines.push(`# Scoring Examples`);
    for (const anchor of parameter.scoringAnchors) {
      lines.push(`Score ${anchor.score}: "${anchor.example}"`);
      if (anchor.rationale) {
        lines.push(`  Rationale: ${anchor.rationale}`);
      }
    }
    lines.push(``);
  }

  // Add KB context if available
  if (chunks.length > 0) {
    lines.push(`# Knowledge Base Context`);
    lines.push(`The following relevant context was found in the knowledge base:`);
    lines.push(``);
    for (const chunk of chunks) {
      lines.push(`## ${chunk.title}`);
      lines.push(chunk.content.substring(0, 500));
      lines.push(``);
    }
  }

  lines.push(`# Task`);
  lines.push(`Expand the HIGH and LOW interpretations with deeper, more specific meanings.`);
  lines.push(`Include:`);
  lines.push(`- Specific behaviors, phrases, or patterns that indicate high/low scores`);
  lines.push(`- Conversational cues an analyst should look for`);
  lines.push(`- Context from the knowledge base if relevant`);
  lines.push(``);
  lines.push(`# Output Format`);
  lines.push(`Return JSON only:`);
  lines.push("```json");
  lines.push(`{`);
  lines.push(`  "enrichedHigh": "Detailed description of high-score behaviors...",`);
  lines.push(`  "enrichedLow": "Detailed description of low-score behaviors..."`);
  lines.push(`}`);
  lines.push("```");

  return lines.join("\n");
}

/**
 * Parse the enrichment response from Claude
 */
function parseEnrichmentResponse(response: string): {
  enrichedHigh: string;
  enrichedLow: string;
} | null {
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    const result = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(response);
    return {
      enrichedHigh: result.enrichedHigh || "",
      enrichedLow: result.enrichedLow || "",
    };
  } catch (e) {
    console.error("Failed to parse enrichment response:", e);
    return null;
  }
}
