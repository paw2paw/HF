import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { seedFromSpecs, loadSpecFiles } from "@/prisma/seed-from-specs";

/**
 * GET /api/admin/spec-sync
 * Compare bdd-specs/*.spec.json files with database AnalysisSpec records
 * Returns which specs are: synced, unseeded (in file but not DB), orphaned (in DB but no file)
 */
export async function GET() {
  try {
    // Load all spec files from bdd-specs/
    const specFiles = loadSpecFiles();
    const fileSpecIds = new Set(specFiles.map(f => f.content.id));

    // Load all specs from database
    const dbSpecs = await prisma.analysisSpec.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        scope: true,
        specType: true,
        specRole: true,
        outputType: true,
        updatedAt: true,
        isActive: true,
      },
      orderBy: { slug: "asc" },
    });

    // Create lookup by slug (spec-{id} pattern)
    const dbSpecsBySourceId = new Map<string, typeof dbSpecs[0]>();
    for (const spec of dbSpecs) {
      // Extract source ID from slug (e.g., "spec-init-001" -> "INIT-001")
      const match = spec.slug.match(/^spec-(.+)$/);
      if (match) {
        const sourceId = match[1].toUpperCase().replace(/-/g, "-");
        dbSpecsBySourceId.set(sourceId, spec);
      }
    }

    // Categorize specs
    const synced: Array<{
      id: string;
      filename: string;
      dbSlug: string;
      dbUpdatedAt: Date;
      specType: string;
      specRole: string | null;
    }> = [];

    const unseeded: Array<{
      id: string;
      filename: string;
      title: string;
      specType: string;
      specRole: string;
    }> = [];

    for (const file of specFiles) {
      const specId = file.content.id;
      const normalizedId = specId.toLowerCase().replace(/_/g, "-");

      // Try to find matching DB spec
      const dbSpec = dbSpecs.find(s =>
        s.slug === `spec-${normalizedId}` ||
        s.slug.includes(normalizedId)
      );

      if (dbSpec) {
        synced.push({
          id: specId,
          filename: file.filename,
          dbSlug: dbSpec.slug,
          dbUpdatedAt: dbSpec.updatedAt,
          specType: dbSpec.specType || "DOMAIN",
          specRole: dbSpec.specRole,
        });
      } else {
        unseeded.push({
          id: specId,
          filename: file.filename,
          title: file.content.title || specId,
          specType: file.rawJson.specType || "DOMAIN",
          specRole: file.rawJson.specRole || "META",
        });
      }
    }

    // Find orphaned DB specs (in DB but no matching file)
    const fileIds = new Set(specFiles.map(f => f.content.id.toLowerCase().replace(/_/g, "-")));
    const orphaned = dbSpecs.filter(spec => {
      const match = spec.slug.match(/^spec-(.+)$/);
      if (!match) return false;
      const sourceId = match[1];
      return !fileIds.has(sourceId);
    }).map(spec => ({
      dbId: spec.id,
      slug: spec.slug,
      name: spec.name,
      specType: spec.specType,
      isActive: spec.isActive,
    }));

    return NextResponse.json({
      ok: true,
      summary: {
        totalFiles: specFiles.length,
        synced: synced.length,
        unseeded: unseeded.length,
        orphaned: orphaned.length,
      },
      synced,
      unseeded,
      orphaned,
    });
  } catch (error: any) {
    console.error("Error checking spec sync:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to check spec sync" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/spec-sync
 * Seed all unseeded specs from bdd-specs/ folder
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { specIds } = body; // Optional: only seed specific spec IDs

    // Run the seeder
    const results = await seedFromSpecs();

    // Filter results if specific IDs were requested
    const filtered = specIds?.length
      ? results.filter(r => specIds.includes(r.specId))
      : results;

    const summary = {
      specsProcessed: filtered.length,
      parametersCreated: filtered.reduce((sum, r) => sum + r.parametersCreated, 0),
      parametersUpdated: filtered.reduce((sum, r) => sum + r.parametersUpdated, 0),
      anchorsCreated: filtered.reduce((sum, r) => sum + r.anchorsCreated, 0),
      specsCreated: filtered.reduce((sum, r) => sum + r.specsCreated, 0),
    };

    return NextResponse.json({
      ok: true,
      message: `Synced ${filtered.length} specs`,
      summary,
      results: filtered,
    });
  } catch (error: any) {
    console.error("Error syncing specs:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to sync specs" },
      { status: 500 }
    );
  }
}
