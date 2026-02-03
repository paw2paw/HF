import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compileBDDToFeatureSet } from "@/lib/bdd/compiler";

/**
 * POST /api/lab/uploads/compile
 *
 * Compile validated uploads into a Feature Set
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No IDs provided" },
        { status: 400 }
      );
    }

    // Fetch uploads (allow re-compilation of validated or already compiled)
    const uploads = await prisma.bDDUpload.findMany({
      where: {
        id: { in: ids },
        status: { in: ["VALIDATED", "COMPILED"] },
      },
    });

    if (uploads.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No validated uploads found to compile. Validate first." },
        { status: 400 }
      );
    }

    // Compile into a Feature Set
    const compiled = compileBDDToFeatureSet(uploads);

    // Check if feature set with this ID already exists
    const existing = await prisma.bDDFeatureSet.findUnique({
      where: { featureId: compiled.featureId },
    });

    let featureSet;

    if (existing) {
      // Update existing feature set with new version
      const newVersion = incrementVersion(existing.version);

      featureSet = await prisma.bDDFeatureSet.update({
        where: { id: existing.id },
        data: {
          name: compiled.name,
          description: compiled.description,
          version: newVersion,
          parameters: compiled.parameters,
          constraints: compiled.constraints,
          validations: compiled.validations,
          promptGuidance: compiled.promptGuidance,
          definitions: compiled.definitions,
          thresholds: compiled.thresholds,
          parameterCount: compiled.parameters.length,
          constraintCount: compiled.constraints.length,
          definitionCount: Object.keys(compiled.definitions).length,
          compiledAt: new Date(),
        },
      });
    } else {
      // Create new feature set
      featureSet = await prisma.bDDFeatureSet.create({
        data: {
          featureId: compiled.featureId,
          name: compiled.name,
          description: compiled.description,
          version: "1.0",
          parameters: compiled.parameters,
          constraints: compiled.constraints,
          validations: compiled.validations,
          promptGuidance: compiled.promptGuidance,
          definitions: compiled.definitions,
          thresholds: compiled.thresholds,
          parameterCount: compiled.parameters.length,
          constraintCount: compiled.constraints.length,
          definitionCount: Object.keys(compiled.definitions).length,
          compiledAt: new Date(),
        },
      });
    }

    // Update uploads to mark as compiled and link to feature set
    await prisma.bDDUpload.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "COMPILED",
        compiledAt: new Date(),
        featureSetId: featureSet.id,
      },
    });

    return NextResponse.json({
      ok: true,
      featureSet: {
        id: featureSet.id,
        featureId: featureSet.featureId,
        name: featureSet.name,
        version: featureSet.version,
        parameterCount: featureSet.parameterCount,
        constraintCount: featureSet.constraintCount,
        definitionCount: featureSet.definitionCount,
      },
    });
  } catch (error: any) {
    console.error("Error compiling BDD uploads:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Compilation failed" },
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
