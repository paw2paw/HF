/**
 * Spec-Driven Prompt Loader
 *
 * Loads AI system prompts from AnalysisSpec records (specRole: PROMPT).
 * Each prompt is a first-class spec: seedable, env-overridable, editable in /x/specs.
 *
 * Cascade: AnalysisSpec.promptTemplate (DB) → hardcoded fallback (during migration only)
 * Cache: 30s TTL, same as system settings.
 */

import { prisma } from "@/lib/prisma";

// ── Cache ──────────────────────────────────────────────

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: string; expiry: number }>();

export function clearPromptSpecCache(): void {
  cache.clear();
}

// ── Loader ─────────────────────────────────────────────

/**
 * Load a prompt template from an AnalysisSpec by slug.
 * Returns the promptTemplate field. Throws if spec not found or has no template.
 *
 * @param slug - The spec slug (e.g. "PROMPT-CHAT-DATA-001")
 * @param fallback - Optional hardcoded fallback (used during migration while specs are being seeded)
 */
export async function getPromptSpec(slug: string, fallback?: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(slug);
  if (cached && cached.expiry > now) return cached.value;

  try {
    const spec = await prisma.analysisSpec.findFirst({
      where: { slug, isActive: true },
      select: { promptTemplate: true },
    });

    if (spec?.promptTemplate) {
      cache.set(slug, { value: spec.promptTemplate, expiry: now + CACHE_TTL_MS });
      return spec.promptTemplate;
    }

    // Spec exists but has no promptTemplate, or spec not found
    if (fallback) {
      cache.set(slug, { value: fallback, expiry: now + CACHE_TTL_MS });
      return fallback;
    }

    throw new Error(`Prompt spec "${slug}" not found or has no promptTemplate`);
  } catch (err) {
    if (fallback) {
      console.warn(`[spec-prompts] Failed to load "${slug}", using fallback`, err);
      cache.set(slug, { value: fallback, expiry: now + CACHE_TTL_MS });
      return fallback;
    }
    throw err;
  }
}

/**
 * Load multiple prompt specs in parallel.
 * Returns a map of slug → promptTemplate.
 */
export async function getPromptSpecs(
  slugs: string[],
  fallbacks?: Record<string, string>,
): Promise<Record<string, string>> {
  const results = await Promise.all(
    slugs.map((slug) => getPromptSpec(slug, fallbacks?.[slug])),
  );
  return Object.fromEntries(slugs.map((slug, i) => [slug, results[i]]));
}
