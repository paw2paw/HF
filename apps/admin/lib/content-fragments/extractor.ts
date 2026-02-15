/**
 * Content Fragment Extractor
 *
 * Walks AnalysisSpec.config JSON blobs and extracts every text fragment
 * into a flat, searchable catalog. Each fragment gets a path, category,
 * and isPromptConsumed flag.
 */

import { isPathConsumed, categorizeFragment } from "./consumed-paths";

export interface ContentFragment {
  /** Unique key: "spec-slug:json.path" */
  id: string;
  /** Spec slug e.g. "spec-tut-001" */
  specSlug: string;
  /** Spec display name */
  specName: string;
  /** Spec role e.g. "IDENTITY" */
  specRole: string | null;
  /** Dot-separated JSON path e.g. "techniques.0.description" */
  path: string;
  /** Human-readable label derived from path */
  label: string;
  /** The text content */
  value: string;
  /** Character count */
  length: number;
  /** Auto-derived category */
  category: string;
  /** Whether a prompt transform consumes this path */
  isPromptConsumed: boolean;
  /** JSON nesting depth */
  depth: number;
}

export interface ExtractionStats {
  totalFragments: number;
  promptConsumed: number;
  metadataOnly: number;
  byCategory: Record<string, number>;
  bySpec: Record<string, number>;
  totalChars: number;
}

/** Minimum string length to consider a "text fragment" (skip short keys/ids) */
const MIN_TEXT_LENGTH = 8;

/** Keys that are structural, not content text */
const SKIP_KEYS = new Set([
  "id", "parameterId", "slug", "version", "status", "date",
  "specType", "outputType", "specRole", "scope", "domain",
  "scaleType", "directionality", "computedBy", "sectionId",
  "domainGroup", "parameterType", "isAdjustable", "isActive",
  "section", "sortOrder", "masteryThreshold", "weight",
  "min", "max", "score", "isGold", "confidence",
  "minScore", "maxScore", "defaultConfidence",
]);

/**
 * Walk a JSON value recursively, extracting text fragments.
 */
function walkJson(
  value: unknown,
  path: string,
  depth: number,
  fragments: ContentFragment[],
  specSlug: string,
  specName: string,
  specRole: string | null,
): void {
  if (value === null || value === undefined) return;

  if (typeof value === "string") {
    // Skip short strings (likely IDs, slugs, enum values)
    if (value.length < MIN_TEXT_LENGTH) return;

    // Skip strings that look like identifiers
    if (/^[a-z_-]+$/i.test(value) && value.length < 30) return;

    const lastSegment = path.split(".").pop() || path;
    // Skip structural keys
    if (SKIP_KEYS.has(lastSegment)) return;

    fragments.push({
      id: `${specSlug}:${path}`,
      specSlug,
      specName,
      specRole,
      path,
      label: pathToLabel(path),
      value,
      length: value.length,
      category: categorizeFragment(specRole, path),
      isPromptConsumed: isPathConsumed(path, specRole || undefined),
      depth,
    });
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walkJson(value[i], `${path}.${i}`, depth + 1, fragments, specSlug, specName, specRole);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      // Skip the parameters array at root (it's a structural container, not content)
      if (key === "parameters" && depth === 0) {
        // But still walk parameter configs
        if (Array.isArray(val)) {
          for (let i = 0; i < val.length; i++) {
            const param = val[i] as Record<string, unknown>;
            const paramId = (param.id || param.parameterId || `param-${i}`) as string;
            // Walk the parameter's config (where the actual content lives)
            if (param.config && typeof param.config === "object") {
              walkJson(param.config, `parameters.${paramId}`, depth + 1, fragments, specSlug, specName, specRole);
            }
            // Walk parameter-level text fields too
            for (const [pk, pv] of Object.entries(param)) {
              if (pk === "config" || pk === "id" || pk === "parameterId") continue;
              if (typeof pv === "string" && pv.length >= MIN_TEXT_LENGTH) {
                walkJson(pv, `parameters.${paramId}.${pk}`, depth + 2, fragments, specSlug, specName, specRole);
              }
            }
          }
        }
        continue;
      }

      const childPath = path ? `${path}.${key}` : key;
      walkJson(val, childPath, depth + 1, fragments, specSlug, specName, specRole);
    }
  }
}

/**
 * Convert a JSON path to a human-readable label.
 * "techniques.0.description" → "Technique 1: Description"
 * "natural_speech.fillers.2" → "Natural Speech: Filler 3"
 */
function pathToLabel(path: string): string {
  const parts = path.split(".");
  const readable: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Array index → numbered
    if (/^\d+$/.test(part)) {
      const prev = readable[readable.length - 1];
      if (prev) {
        // Singularize parent: "techniques" → "Technique 2"
        const singular = prev.replace(/s$/, "");
        readable[readable.length - 1] = `${singular} ${parseInt(part) + 1}`;
      }
      continue;
    }

    // Named parameter ref
    if (parts[i - 1] === "parameters" && !/^\d+$/.test(part)) {
      readable.push(part.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
      continue;
    }

    // snake_case/camelCase → Title Case
    const titled = part
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, c => c.toUpperCase());

    readable.push(titled);
  }

  return readable.join(": ");
}

/**
 * Extract all text fragments from a single spec's config.
 */
export function extractFromSpec(
  specSlug: string,
  specName: string,
  specRole: string | null,
  config: unknown,
): ContentFragment[] {
  const fragments: ContentFragment[] = [];
  if (!config || typeof config !== "object") return fragments;

  walkJson(config, "", 0, fragments, specSlug, specName, specRole);
  return fragments;
}

/**
 * Compute summary stats from a set of fragments.
 */
export function computeStats(fragments: ContentFragment[]): ExtractionStats {
  const byCategory: Record<string, number> = {};
  const bySpec: Record<string, number> = {};
  let promptConsumed = 0;
  let totalChars = 0;

  for (const f of fragments) {
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    bySpec[f.specSlug] = (bySpec[f.specSlug] || 0) + 1;
    if (f.isPromptConsumed) promptConsumed++;
    totalChars += f.length;
  }

  return {
    totalFragments: fragments.length,
    promptConsumed,
    metadataOnly: fragments.length - promptConsumed,
    byCategory,
    bySpec,
    totalChars,
  };
}
