import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reseedSingleSpec } from "@/prisma/seed-from-specs";
import { requireAuth, isAuthError } from "@/lib/permissions";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

function getSpecsFolder(): string {
  const cwdPath = path.join(process.cwd(), "docs-archive", "bdd-specs");
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }
  return path.join(__dirname, "../docs-archive/bdd-specs");
}

/**
 * @api POST /api/analysis-specs/:specId/export-to-source
 * @visibility internal
 * @scope analysis-specs:write
 * @auth session
 * @tags analysis-specs
 * @description "Send to Source" -- merges config.parameters back into the source .spec.json file on disk, then re-seeds the spec through the full pipeline (BDDFeatureSet -> Parameters -> AnalysisSpec -> etc.)
 * @pathParam specId string - Spec UUID
 * @response 200 { ok: true, filePath: string, message: string, seedResult: object }
 * @response 400 { ok: false, error: "Spec has no linked BDDFeatureSet..." }
 * @response 400 { ok: false, error: "Spec config is empty or has no parameters to export" }
 * @response 404 { ok: false, error: "Spec not found" }
 * @response 423 { ok: false, error: "Spec is locked and cannot be exported", locked: true }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { specId } = await params;

    // 1. Fetch the AnalysisSpec
    const spec = await prisma.analysisSpec.findUnique({
      where: { id: specId },
    });

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }

    if (spec.isLocked) {
      return NextResponse.json(
        { ok: false, error: "Spec is locked and cannot be exported", locked: true },
        { status: 423 }
      );
    }

    if (!spec.compiledSetId) {
      return NextResponse.json(
        { ok: false, error: "Spec has no linked BDDFeatureSet — nothing to export to" },
        { status: 400 }
      );
    }

    const config = spec.config as Record<string, any> | null;
    if (!config || !Array.isArray(config.parameters)) {
      return NextResponse.json(
        { ok: false, error: "Spec config is empty or has no parameters to export" },
        { status: 400 }
      );
    }

    // 2. Get the BDDFeatureSet to find the featureId
    const featureSet = await prisma.bDDFeatureSet.findUnique({
      where: { id: spec.compiledSetId },
    });

    if (!featureSet) {
      return NextResponse.json(
        { ok: false, error: "Linked BDDFeatureSet not found" },
        { status: 404 }
      );
    }

    // 3. Find the source file on disk
    const specsFolder = getSpecsFolder();
    const files = fs.readdirSync(specsFolder).filter(
      (f) => f.startsWith(featureSet.featureId) && f.endsWith(".spec.json")
    );

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, error: `No source file found for ${featureSet.featureId} in docs-archive/bdd-specs/` },
        { status: 404 }
      );
    }

    const filename = files[0];
    const filePath = path.join(specsFolder, filename);

    // 4. Read and parse the source file
    const sourceContent = fs.readFileSync(filePath, "utf-8");
    const sourceJson = JSON.parse(sourceContent);

    // 5. Merge: replace parameters, optionally merge metadata
    sourceJson.parameters = config.parameters;
    if (config.metadata) {
      sourceJson.metadata = config.metadata;
    }

    // 6. Write back to disk
    const merged = JSON.stringify(sourceJson, null, 2) + "\n";
    fs.writeFileSync(filePath, merged, "utf-8");

    // 7. Re-seed this single spec through the full pipeline
    //    This re-reads the file we just wrote, parses it, upserts BDDFeatureSet,
    //    and activates all derived records (Parameters, Anchors, Slugs, Triggers, etc.)
    const seedResult = await reseedSingleSpec(featureSet.featureId);

    return NextResponse.json({
      ok: true,
      filePath: `docs-archive/bdd-specs/${filename}`,
      message: `Exported to ${filename} and re-seeded`,
      seedResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to export to source" },
      { status: 500 }
    );
  }
}
