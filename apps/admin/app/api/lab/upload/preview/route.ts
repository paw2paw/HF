import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJsonSpec } from "@/lib/bdd/ai-parser";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api POST /api/lab/upload/preview
 * @visibility internal
 * @scope lab:read
 * @auth session
 * @tags lab
 * @description Preview what artifacts would be created/updated by uploading a spec (dry-run, no changes made)
 * @body spec object - The JSON spec definition to preview
 * @response 200 { ok: true, preview: { spec, story, artifacts: { featureSet, analysisSpec, parameters }, warnings } }
 * @response 400 { ok: false, error: "No spec provided..." }
 * @response 400 { ok: false, error: "Validation failed", validationErrors: string[] }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const body = await req.json();
    const { spec } = body;

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "No spec provided. Send { spec: {...} }" },
        { status: 400 }
      );
    }

    // Parse and validate the spec
    const parseResult = parseJsonSpec(JSON.stringify(spec));
    if (!parseResult.success) {
      return NextResponse.json({
        ok: false,
        error: "Validation failed",
        validationErrors: parseResult.errors,
      }, { status: 400 });
    }

    const parsedSpec = parseResult.data;
    const parameters = parsedSpec.parameters || [];

    // Check if BDDFeatureSet already exists
    const existingFeatureSet = await prisma.bDDFeatureSet.findFirst({
      where: { featureId: parsedSpec.id },
    });

    // Check if AnalysisSpec already exists
    const specSlug = `spec-${parsedSpec.id.toLowerCase()}`;
    const existingSpec = await prisma.analysisSpec.findUnique({
      where: { slug: specSlug },
    });

    // Check which parameters already exist
    const paramIds = parameters.map((p: any) => p.id || p.parameterId).filter(Boolean);
    const existingParams = await prisma.parameter.findMany({
      where: { parameterId: { in: paramIds } },
      select: { id: true, parameterId: true, name: true },
    });
    const existingParamMap = new Map(existingParams.map(p => [p.parameterId, p]));

    // Categorize parameters
    const parameterChanges = parameters.map((p: any) => {
      const paramId = p.id || p.parameterId;
      const existing = existingParamMap.get(paramId);
      return {
        id: paramId,
        name: p.name,
        description: p.description,
        dataType: p.dataType || "string",
        status: existing ? "UPDATE" : "NEW",
        existingData: existing || null,
      };
    });

    // Build preview response
    const preview = {
      spec: {
        id: parsedSpec.id,
        title: parsedSpec.title,
        version: parsedSpec.version,
        domain: parsedSpec.domain,
        specType: parsedSpec.specType || "DOMAIN",
        specRole: parsedSpec.specRole,
        outputType: parsedSpec.outputType || "MEASURE",
        agentScope: parsedSpec.agentScope,
      },
      story: parsedSpec.story,
      artifacts: {
        featureSet: {
          status: existingFeatureSet ? "UPDATE" : "NEW",
          id: parsedSpec.id,
          name: parsedSpec.title,
          currentVersion: existingFeatureSet?.version || null,
          newVersion: existingFeatureSet
            ? incrementVersion(existingFeatureSet.version)
            : "1.0",
        },
        analysisSpec: {
          status: existingSpec ? "UPDATE" : "NEW",
          slug: specSlug,
          name: parsedSpec.title,
          scope: parsedSpec.specType === "SYSTEM" ? "SYSTEM" : "DOMAIN",
          outputType: parsedSpec.outputType || "MEASURE",
          specRole: parsedSpec.specRole || null,
          currentVersion: existingSpec?.version || null,
        },
        parameters: {
          total: parameters.length,
          new: parameterChanges.filter((p: any) => p.status === "NEW").length,
          updated: parameterChanges.filter((p: any) => p.status === "UPDATE").length,
          items: parameterChanges,
        },
      },
      warnings: [] as string[],
    };

    // Add warnings for potential issues
    if (existingSpec && existingSpec.isActive) {
      preview.warnings.push("This spec is currently active. Updating will affect live behavior.");
    }

    if (parsedSpec.specType === "SYSTEM") {
      preview.warnings.push("SYSTEM specs are auto-included in all playbooks.");
    }

    return NextResponse.json({ ok: true, preview });
  } catch (error: any) {
    console.error("Error in preview:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Preview failed" },
      { status: 500 }
    );
  }
}

function incrementVersion(version: string): string {
  const parts = version.split(".");
  if (parts.length === 2) {
    const minor = parseInt(parts[1]) + 1;
    return `${parts[0]}.${minor}`;
  }
  return version + ".1";
}
