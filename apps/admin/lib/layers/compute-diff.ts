/**
 * Layer Diff Computation
 *
 * Computes parameter-level classification between a base archetype and
 * a domain overlay. Mirrors the merge logic in identity.ts but classifies
 * instead of merging: INHERITED, OVERRIDDEN, or NEW.
 */

import { prisma } from "@/lib/prisma";

// ── Types ──────────────────────────────────────────────

export type ParameterStatus = "INHERITED" | "OVERRIDDEN" | "NEW";

export interface LayerParameter {
  id: string;
  name: string;
  section: string;
  status: ParameterStatus;
  config: Record<string, any>;
  baseConfig?: Record<string, any>;
}

export interface LayerConstraint {
  id: string;
  rule: string;
  source: "BASE" | "OVERLAY";
  severity?: string;
  type?: string;
}

export interface LayerDiffStats {
  inherited: number;
  overridden: number;
  new: number;
  totalMerged: number;
  baseConstraints: number;
  overlayConstraints: number;
}

export interface LayerSpecSummary {
  slug: string;
  name: string;
  description: string | null;
  parameterCount: number;
  constraintCount: number;
}

export interface LayerDiffResult {
  base: LayerSpecSummary;
  overlay: LayerSpecSummary & { extendsAgent: string };
  parameters: LayerParameter[];
  constraints: LayerConstraint[];
  stats: LayerDiffStats;
}

// ── Pure diff computation ──────────────────────────────

/**
 * Compute the parameter-level diff between a base config and an overlay config.
 * Pure function — no DB access.
 */
export function computeLayerDiff(
  baseConfig: Record<string, any>,
  overlayConfig: Record<string, any>,
): { parameters: LayerParameter[]; constraints: LayerConstraint[]; stats: LayerDiffStats } {
  const baseParams: any[] = baseConfig.parameters || [];
  const overlayParams: any[] = overlayConfig.parameters || [];

  // Build ID maps (matching identity.ts:155-160 pattern)
  const baseMap = new Map<string, any>();
  for (const param of baseParams) {
    const id = param.id || param.parameterId;
    if (id) baseMap.set(id, param);
  }

  const overlayMap = new Map<string, any>();
  for (const param of overlayParams) {
    const id = param.id || param.parameterId;
    if (id) overlayMap.set(id, param);
  }

  const parameters: LayerParameter[] = [];

  // Base parameters: INHERITED or OVERRIDDEN
  for (const [id, baseParam] of baseMap) {
    const overlayParam = overlayMap.get(id);
    if (overlayParam) {
      parameters.push({
        id,
        name: overlayParam.name || baseParam.name || id,
        section: overlayParam.section || baseParam.section || "general",
        status: "OVERRIDDEN",
        config: overlayParam.config || {},
        baseConfig: baseParam.config || {},
      });
    } else {
      parameters.push({
        id,
        name: baseParam.name || id,
        section: baseParam.section || "general",
        status: "INHERITED",
        config: baseParam.config || {},
      });
    }
  }

  // Overlay-only parameters: NEW
  for (const [id, overlayParam] of overlayMap) {
    if (!baseMap.has(id)) {
      parameters.push({
        id,
        name: overlayParam.name || id,
        section: overlayParam.section || "general",
        status: "NEW",
        config: overlayParam.config || {},
      });
    }
  }

  // Constraints: tag each with source
  const baseConstraints: any[] = baseConfig.constraints || [];
  const overlayConstraints: any[] = overlayConfig.constraints || [];

  const constraints: LayerConstraint[] = [
    ...baseConstraints.map((c: any, i: number) => ({
      id: c.id || `base-${i}`,
      rule: c.rule || c.description || JSON.stringify(c),
      source: "BASE" as const,
      severity: c.severity,
      type: c.type,
    })),
    ...overlayConstraints.map((c: any, i: number) => ({
      id: c.id || `overlay-${i}`,
      rule: c.rule || c.description || JSON.stringify(c),
      source: "OVERLAY" as const,
      severity: c.severity,
      type: c.type,
    })),
  ];

  const inherited = parameters.filter(p => p.status === "INHERITED").length;
  const overridden = parameters.filter(p => p.status === "OVERRIDDEN").length;
  const newCount = parameters.filter(p => p.status === "NEW").length;

  return {
    parameters,
    constraints,
    stats: {
      inherited,
      overridden,
      new: newCount,
      totalMerged: parameters.length,
      baseConstraints: baseConstraints.length,
      overlayConstraints: overlayConstraints.length,
    },
  };
}

// ── Base slug derivation (shared with identity.ts:123) ─

export function deriveBaseSlug(extendsAgent: string): string {
  return `spec-${extendsAgent.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

// ── DB resolution ──────────────────────────────────────

export interface LayerPair {
  overlay: { slug: string; name: string; description: string | null; config: Record<string, any>; extendsAgent: string };
  base: { slug: string; name: string; description: string | null; config: Record<string, any> };
}

/**
 * Resolve both the overlay spec and its base archetype from DB.
 * Throws if overlay not found or has no extendsAgent.
 */
export async function resolveLayerPair(overlaySpecId: string): Promise<LayerPair> {
  const overlay = await prisma.analysisSpec.findUnique({
    where: { id: overlaySpecId },
    select: { slug: true, name: true, description: true, config: true, extendsAgent: true },
  });

  if (!overlay) {
    throw new Error(`Overlay spec not found: ${overlaySpecId}`);
  }

  if (!overlay.extendsAgent) {
    throw new Error(`Spec "${overlay.slug}" has no extendsAgent — it is a base archetype, not an overlay`);
  }

  const baseSlug = deriveBaseSlug(overlay.extendsAgent);
  const base = await prisma.analysisSpec.findFirst({
    where: { slug: baseSlug, isActive: true },
    select: { slug: true, name: true, description: true, config: true },
  });

  if (!base) {
    throw new Error(`Base spec "${overlay.extendsAgent}" (slug: ${baseSlug}) not found or inactive`);
  }

  return {
    overlay: {
      slug: overlay.slug,
      name: overlay.name,
      description: overlay.description,
      config: (overlay.config as Record<string, any>) || {},
      extendsAgent: overlay.extendsAgent,
    },
    base: {
      slug: base.slug,
      name: base.name,
      description: base.description,
      config: (base.config as Record<string, any>) || {},
    },
  };
}

/**
 * Full layer diff: resolve specs from DB and compute diff.
 */
export async function getLayerDiff(overlaySpecId: string): Promise<LayerDiffResult> {
  const pair = await resolveLayerPair(overlaySpecId);
  const { parameters, constraints, stats } = computeLayerDiff(pair.base.config, pair.overlay.config);

  const baseParams: any[] = pair.base.config.parameters || [];
  const baseConstraints: any[] = pair.base.config.constraints || [];
  const overlayParams: any[] = pair.overlay.config.parameters || [];
  const overlayConstraints: any[] = pair.overlay.config.constraints || [];

  return {
    base: {
      slug: pair.base.slug,
      name: pair.base.name,
      description: pair.base.description,
      parameterCount: baseParams.length,
      constraintCount: baseConstraints.length,
    },
    overlay: {
      slug: pair.overlay.slug,
      name: pair.overlay.name,
      description: pair.overlay.description,
      extendsAgent: pair.overlay.extendsAgent,
      parameterCount: overlayParams.length,
      constraintCount: overlayConstraints.length,
    },
    parameters,
    constraints,
    stats,
  };
}
