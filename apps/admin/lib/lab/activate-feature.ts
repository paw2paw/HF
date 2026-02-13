/**
 * Feature Set Activation
 *
 * Thin wrapper that calls the activate route's core logic directly,
 * avoiding HTTP self-calls from specs/create and specs/import.
 *
 * The full activation logic (900+ lines) lives in the route handler.
 * This module re-exports it as a callable function.
 */

import { prisma } from "@/lib/prisma";
import {
  AnalysisOutputType,
  SpecificationScope,
  MemoryCategory,
  SpecType,
  SpecRole,
} from "@prisma/client";
import { compileSpecToTemplate } from "@/lib/bdd/compile-specs";

export interface ActivationResult {
  ok: boolean;
  feature?: {
    id: string;
    featureId: string;
    name: string;
    isActive: boolean;
    activatedAt: Date | null;
  };
  spec?: {
    id: string;
    slug: string;
    name: string;
    specRole: string;
    outputType: string;
  };
  results?: {
    parametersCreated: number;
    parametersUpdated: number;
    anchorsCreated: number;
    specsCreated: number;
    triggersCreated: number;
    actionsCreated: number;
    promptSlugsCreated: number;
    curriculumCreated: boolean;
  };
  deactivated?: boolean;
  error?: string;
}

/**
 * Activate a feature set by ID.
 * Delegates to the same prisma logic as the /api/lab/features/[id]/activate route.
 */
export async function activateFeatureSet(featureSetId: string): Promise<ActivationResult> {
  // Dynamically import the route to avoid circular dependencies at module level.
  // The route exports the POST handler, but we need the internal logic.
  // For now, we directly replicate the minimal activate call via internal fetch-free path.

  // This is a forward reference — when the route is eventually refactored to export
  // its core logic as a function, this wrapper simplifies to a single function call.
  // Until then, we use the same prisma calls inline.

  const featureSet = await prisma.bDDFeatureSet.findUnique({
    where: { id: featureSetId },
  });

  if (!featureSet) {
    return { ok: false, error: "Feature set not found" };
  }

  // Use a local import to simulate calling the activate endpoint
  // The full 900-line activation logic is complex — for safety, we use
  // an internal URL-less approach by importing the route handler module
  // and invoking it with a synthetic Request.
  try {
    const { POST } = await import(
      "@/app/api/lab/features/[id]/activate/route"
    );

    // Create a minimal Request object (no HTTP involved)
    const syntheticRequest = new Request("http://internal/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activate: true }),
    });

    const response = await POST(syntheticRequest, {
      params: Promise.resolve({ id: featureSetId }),
    });

    const data = await response.json();
    return data as ActivationResult;
  } catch (error: any) {
    return { ok: false, error: error?.message || "Activation failed" };
  }
}

/**
 * Deactivate a feature set by ID.
 */
export async function deactivateFeatureSet(featureSetId: string): Promise<ActivationResult> {
  try {
    const feature = await prisma.bDDFeatureSet.update({
      where: { id: featureSetId },
      data: { isActive: false, activatedAt: null },
      select: {
        id: true,
        featureId: true,
        name: true,
        isActive: true,
        activatedAt: true,
      },
    });
    return { ok: true, feature, deactivated: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || "Deactivation failed" };
  }
}
