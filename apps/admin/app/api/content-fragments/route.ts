import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { extractFromSpec, computeStats } from "@/lib/content-fragments/extractor";
import type { ContentFragment } from "@/lib/content-fragments/extractor";

/**
 * @api GET /api/content-fragments
 * @visibility internal
 * @scope content:read
 * @auth session
 * @tags content
 * @description Returns text fragments extracted from AnalysisSpec configs with category, prompt-consumed flag, and search/filter support.
 * @query category string - Filter by category (identity, voice, content, etc.)
 * @query specSlug string - Filter by spec slug
 * @query promptOnly string - "true" to show only prompt-consumed fragments
 * @query search string - Full-text search across fragment values and labels
 * @response 200 { fragments: [...], stats: {...}, filters: {...} }
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth("ADMIN");
  if (isAuthError(authResult)) return authResult.error;

  const { searchParams } = req.nextUrl;
  const categoryFilter = searchParams.get("category");
  const specSlugFilter = searchParams.get("specSlug");
  const promptOnly = searchParams.get("promptOnly") === "true";
  const search = searchParams.get("search")?.toLowerCase();

  // Load all active specs with their configs
  const specs = await prisma.analysisSpec.findMany({
    where: { isActive: true },
    select: {
      slug: true,
      name: true,
      specRole: true,
      config: true,
    },
    orderBy: { slug: "asc" },
  });

  // Extract fragments from all specs (single pass)
  const allFragments: ContentFragment[] = [];

  for (const spec of specs) {
    if (!spec.config) continue;
    allFragments.push(
      ...extractFromSpec(spec.slug, spec.name, spec.specRole, spec.config),
    );
  }

  // Compute stats from full unfiltered set
  const stats = computeStats(allFragments);

  // Apply filters
  let filtered = allFragments;
  if (categoryFilter) {
    filtered = filtered.filter(f => f.category === categoryFilter);
  }
  if (specSlugFilter) {
    filtered = filtered.filter(f => f.specSlug === specSlugFilter);
  }
  if (promptOnly) {
    filtered = filtered.filter(f => f.isPromptConsumed);
  }
  if (search) {
    filtered = filtered.filter(f =>
      f.value.toLowerCase().includes(search) ||
      f.label.toLowerCase().includes(search) ||
      f.path.toLowerCase().includes(search)
    );
  }

  return NextResponse.json({
    fragments: filtered,
    stats,
    filters: {
      category: categoryFilter,
      specSlug: specSlugFilter,
      promptOnly,
      search,
    },
  });
}
