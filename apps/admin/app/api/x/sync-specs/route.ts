import { NextResponse } from "next/server";
import { seedFromSpecs } from "../../../../prisma/seed-from-specs";
import { prisma } from "@/lib/prisma";
import * as fs from "fs";
import * as path from "path";

/**
 * GET /api/x/sync-specs
 *
 * Returns sync status: which spec files are synced vs unsynced.
 * Compares filesystem files to BDDFeatureSet records (the source of truth for file imports).
 */
export async function GET() {
  try {
    const specsDir = path.join(process.cwd(), "bdd-specs");
    const files = fs.readdirSync(specsDir).filter(f => f.endsWith(".spec.json"));
    const totalFiles = files.length;

    // Get all BDDFeatureSet records (one per file imported)
    const featureSets = await prisma.bDDFeatureSet.findMany({
      select: { filename: true },
    });

    const syncedFiles = new Set(featureSets.map(fs => fs.filename));

    // Check which files are unsynced
    const unsyncedFiles = files.filter(f => !syncedFiles.has(f));

    return NextResponse.json({
      ok: true,
      totalFiles,
      syncedFiles: syncedFiles.size,
      unsyncedFiles: unsyncedFiles.length,
      unsyncedList: unsyncedFiles,
    });
  } catch (error: any) {
    console.error("GET /api/x/sync-specs error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to check sync status",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/x/sync-specs
 *
 * Syncs all BDD specs from /bdd-specs/*.spec.json directory.
 * Creates/updates: Parameters, AnalysisSpecs, Anchors, PromptSlugs
 *
 * This is STEP 1 extracted from the old seed-system endpoint.
 */
export async function POST() {
  try {
    console.log("Syncing all BDD specs from /bdd-specs directory...");

    const specResults = await seedFromSpecs();

    const totalParams = specResults.reduce(
      (acc, r) => acc + r.parametersCreated + r.parametersUpdated,
      0
    );

    const totalSpecs = specResults.length;

    console.log(`✓ Synced ${totalSpecs} specs (${totalParams} parameters)`);

    return NextResponse.json({
      ok: true,
      message: `Successfully synced ${totalSpecs} specs with ${totalParams} parameters`,
      details: {
        specsProcessed: totalSpecs,
        parametersCreated: specResults.reduce((acc, r) => acc + r.parametersCreated, 0),
        parametersUpdated: specResults.reduce((acc, r) => acc + r.parametersUpdated, 0),
        results: specResults,
      },
    });
  } catch (error: any) {
    console.error("POST /api/x/sync-specs error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to sync specs",
      },
      { status: 500 }
    );
  }
}
