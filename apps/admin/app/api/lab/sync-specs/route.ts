import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "../../../../lib/prisma";
import { seedFromSpecs } from "../../../../prisma/seed-from-specs";

/**
 * POST /api/lab/sync-specs
 *
 * RE-SEED FROM FILES: Reads all .spec.json files from bdd-specs/ folder
 * and creates/updates everything using the full seed-from-specs logic.
 *
 * This creates:
 * - BDDFeatureSet records (raw spec storage)
 * - AnalysisSpec records (compiled specs with promptTemplate)
 * - Parameter, ParameterScoringAnchor, PromptSlug records
 * - AnalysisTrigger and AnalysisAction records
 * - Curriculum records (for CONTENT specs)
 *
 * This is an ADMIN/DEV operation for re-seeding the database from filesystem.
 * In production, specs should already be in the database.
 */
export async function POST(_req: Request) {
  try {
    const specsFolder = path.join(process.cwd(), "bdd-specs");

    if (!fs.existsSync(specsFolder)) {
      return NextResponse.json({
        ok: false,
        error: `Specs folder not found: ${specsFolder}. This endpoint is for dev/admin re-seeding only.`,
      }, { status: 404 });
    }

    const files = fs.readdirSync(specsFolder).filter(f => f.endsWith(".spec.json"));

    if (files.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No .spec.json files found in bdd-specs/",
        results: [],
      });
    }

    // Use the full seed-from-specs logic for complete compilation
    const results = await seedFromSpecs();

    // Calculate totals
    const totals = results.reduce(
      (acc, r) => ({
        params: acc.params + r.parametersCreated + r.parametersUpdated,
        anchors: acc.anchors + r.anchorsCreated,
        slugs: acc.slugs + r.promptSlugsCreated,
        specs: acc.specs + r.specsCreated,
        agents: acc.agents + (r.agentCreated ? 1 : 0),
        curricula: acc.curricula + (r.curriculumCreated ? 1 : 0),
      }),
      { params: 0, anchors: 0, slugs: 0, specs: 0, agents: 0, curricula: 0 }
    );

    return NextResponse.json({
      ok: true,
      message: `Synced ${results.length} specs: ${totals.params} params, ${totals.anchors} anchors, ${totals.slugs} slugs, ${totals.specs} new specs, ${totals.curricula} curricula`,
      count: results.length,
      totals,
      results: results.map(r => ({
        ...r,
        status: "success",
      })),
    });

  } catch (error: any) {
    console.error("Error syncing specs:", error);
    return NextResponse.json({
      ok: false,
      error: error?.message || "Failed to sync specs",
    }, { status: 500 });
  }
}

/**
 * GET /api/lab/sync-specs
 *
 * Returns list of specs from the DATABASE (AnalysisSpec table).
 * Also includes filesystem info for admin re-seeding purposes.
 */
export async function GET() {
  try {
    // Get specs from database - include all specs (not just bdd- prefixed)
    const dbSpecs = await prisma.analysisSpec.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        version: true,
        outputType: true,
        specType: true,
        specRole: true,
        domain: true,
        isActive: true,
        compiledAt: true,
        promptTemplate: true,
        _count: {
          select: { triggers: true },
        },
      },
      orderBy: { slug: "asc" },
    });

    // Also check filesystem for admin info (how many files available for re-seeding)
    const specsFolder = path.join(process.cwd(), "bdd-specs");
    let filesystemCount = 0;
    let filesystemAvailable = false;

    if (fs.existsSync(specsFolder)) {
      filesystemAvailable = true;
      filesystemCount = fs.readdirSync(specsFolder).filter(f => f.endsWith(".spec.json")).length;
    }

    // Map DB specs to response format
    const specs = dbSpecs.map(spec => ({
      id: spec.slug,
      title: spec.name,
      outputType: spec.outputType,
      specType: spec.specType,
      specRole: spec.specRole,
      domain: spec.domain,
      version: spec.version,
      isActive: spec.isActive,
      compiledAt: spec.compiledAt,
      hasPromptTemplate: !!spec.promptTemplate,
      triggerCount: spec._count.triggers,
    }));

    return NextResponse.json({
      ok: true,
      source: "database",
      count: specs.length,
      specs,
      // Admin info for re-seeding
      filesystem: {
        available: filesystemAvailable,
        folder: specsFolder,
        fileCount: filesystemCount,
      },
    });

  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error?.message || "Failed to list specs",
    }, { status: 500 });
  }
}
