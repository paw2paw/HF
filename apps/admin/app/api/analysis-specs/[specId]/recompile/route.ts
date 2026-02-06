import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJsonSpec } from "@/lib/bdd/ai-parser";
import { compileSpecToTemplate } from "@/lib/bdd/compile-specs";

export const runtime = "nodejs";

/**
 * POST /api/analysis-specs/[specId]/recompile
 * Recompile the spec from its source BDDFeatureSet.rawSpec
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;

    // Find the spec and its linked BDDFeatureSet
    const spec = await prisma.analysisSpec.findUnique({
      where: { id: specId },
    });

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }

    if (!spec.compiledSetId) {
      return NextResponse.json(
        { ok: false, error: "Spec has no linked BDDFeatureSet - cannot recompile" },
        { status: 400 }
      );
    }

    const featureSet = await prisma.bDDFeatureSet.findUnique({
      where: { id: spec.compiledSetId },
    });

    if (!featureSet) {
      return NextResponse.json(
        { ok: false, error: "Linked BDDFeatureSet not found" },
        { status: 404 }
      );
    }

    if (!featureSet.rawSpec) {
      return NextResponse.json(
        { ok: false, error: "BDDFeatureSet has no rawSpec - cannot recompile" },
        { status: 400 }
      );
    }

    // Parse the rawSpec
    const parseResult = parseJsonSpec(JSON.stringify(featureSet.rawSpec));
    if (!parseResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to parse rawSpec",
          parseErrors: parseResult.errors
        },
        { status: 400 }
      );
    }

    // Compile to promptTemplate
    const compiled = compileSpecToTemplate(parseResult.data);
    const parsedSpec = parseResult.data;

    // For IDENTITY/CONTENT specs, the rawSpec contains the config data
    // For MEASURE specs, the promptTemplate is the main output
    const rawSpecAny = featureSet.rawSpec as any;
    const config = (parsedSpec.specRole === "IDENTITY" || parsedSpec.specRole === "CONTENT")
      ? {
          role: rawSpecAny.role,
          roleStatement: rawSpecAny.roleStatement,
          personality: rawSpecAny.personality,
          curriculum: rawSpecAny.curriculum,
          sessionStructure: rawSpecAny.sessionStructure,
          voice: rawSpecAny.voice,
          techniques: rawSpecAny.techniques,
          boundaries: rawSpecAny.boundaries,
          ...(rawSpecAny.config || {}),
        }
      : null;

    // Update the AnalysisSpec with new compilation
    const updatedSpec = await prisma.analysisSpec.update({
      where: { id: spec.id },
      data: {
        promptTemplate: compiled.promptTemplate,
        ...(config && { config }),
        ...(parsedSpec.specRole && { specRole: parsedSpec.specRole }),
        compiledAt: new Date(),
        isDirty: false,
        dirtyReason: null,
      },
    });

    // Touch the feature set updatedAt timestamp
    await prisma.bDDFeatureSet.update({
      where: { id: featureSet.id },
      data: {
        // updatedAt is auto-managed by @updatedAt
        // Just touch the record to update the timestamp
        isActive: featureSet.isActive,
      },
    });

    return NextResponse.json({
      ok: true,
      spec: updatedSpec,
      recompiled: true,
      compiledAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Recompile error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to recompile spec" },
      { status: 500 }
    );
  }
}
