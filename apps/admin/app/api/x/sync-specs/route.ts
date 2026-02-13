import { NextResponse } from "next/server";
import { seedFromSpecs } from "../../../../prisma/seed-from-specs";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { clearAIConfigCache } from "@/lib/ai/config-loader";
import { clearSystemSettingsCache } from "@/lib/system-settings";
import * as fs from "fs";
import * as path from "path";

/**
 * @api GET /api/x/sync-specs
 * @visibility internal
 * @scope dev:read
 * @auth bearer
 * @tags dev-tools
 * @deprecated Use GET /api/admin/spec-sync instead — it checks AnalysisSpec records (not just BDDFeatureSet) and provides more accurate import status.
 * @description Returns sync status comparing filesystem .spec.json files to BDDFeatureSet database records. Shows which specs are synced vs unsynced.
 * @response 200 { ok: true, totalFiles: number, syncedFiles: number, unsyncedFiles: number, unsyncedList: [...] }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const specsDir = path.join(process.cwd(), "docs-archive", "bdd-specs");
    const files = fs.readdirSync(specsDir).filter(f => f.endsWith(".spec.json"));
    const totalFiles = files.length;

    // Get all BDDFeatureSet records (one per file imported)
    const featureSets = await prisma.bDDFeatureSet.findMany({
      select: { featureId: true },
    });

    const syncedFeatureIds = new Set(featureSets.map(fs => fs.featureId));

    // Extract featureId from JSON content (most reliable method)
    const fileFeatureIds = files.map(f => {
      try {
        const filePath = path.join(specsDir, f);
        const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return content.id || null;
      } catch {
        return null;
      }
    });

    // Check which files are unsynced (no matching BDDFeatureSet record)
    const unsyncedFiles = files.filter((f, i) => {
      const featureId = fileFeatureIds[i];
      return featureId && !syncedFeatureIds.has(featureId);
    });

    return NextResponse.json({
      ok: true,
      totalFiles,
      syncedFiles: totalFiles - unsyncedFiles.length, // Fixed: count of synced files, not DB records
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
 * @api POST /api/x/sync-specs
 * @visibility internal
 * @scope dev:seed
 * @auth bearer
 * @tags dev-tools
 * @deprecated Use POST /api/admin/spec-sync instead — it surfaces seeding errors and supports selective spec import.
 * @description Syncs all BDD specs from docs-archive/bdd-specs/*.spec.json directory into the database. Creates/updates Parameters, AnalysisSpecs, Anchors, and PromptSlugs. Extracted as STEP 1 from the seed-system endpoint.
 * @response 200 { ok: true, message: "...", details: { specsProcessed: number, parametersCreated: number, parametersUpdated: number, results: [...] } }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST() {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    console.log("Syncing all BDD specs from docs-archive/bdd-specs/ directory...");

    const specResults = await seedFromSpecs();

    const totalParams = specResults.reduce(
      (acc, r) => acc + r.parametersCreated + r.parametersUpdated,
      0
    );

    const totalSpecs = specResults.length;

    console.log(`✓ Synced ${totalSpecs} specs (${totalParams} parameters)`);

    // Invalidate all caches after sync
    clearAIConfigCache();
    clearSystemSettingsCache();

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
