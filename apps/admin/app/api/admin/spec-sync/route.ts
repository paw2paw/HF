import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { seedFromSpecs, loadSpecFiles } from "@/prisma/seed-from-specs";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/admin/spec-sync
 * @visibility internal
 * @auth session
 * @tags admin, specs
 * @description Compare docs-archive/bdd-specs/*.spec.json files with database AnalysisSpec records. Returns which specs are synced, unseeded, or orphaned.
 * @response 200 { ok: true, summary: { totalFiles, synced, unseeded, orphaned }, synced: Array, unseeded: Array, orphaned: Array }
 * @response 500 { ok: false, error: string }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    // Load all spec files from docs-archive/bdd-specs/
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
      // Normalize the same way slugs are generated in seed-from-specs.ts
      const normalizedId = specId.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      // Exact slug match only (no .includes() which causes false positives)
      const dbSpec = dbSpecs.find(s => s.slug === `spec-${normalizedId}`);

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
          specRole: file.rawJson.specRole || "EXTRACT",  // Default to EXTRACT (measurement/learning)
        });
      }
    }

    // Find orphaned DB specs (in DB but no matching file)
    const fileIds = new Set(specFiles.map(f => f.content.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")));
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
 * @api POST /api/admin/spec-sync
 * @visibility internal
 * @auth session
 * @tags admin, specs
 * @description Import all unseeded specs from docs-archive/bdd-specs/ folder into the database
 * @body specIds string[] - Optional list of specific spec IDs to seed (default: all unseeded)
 * @response 200 { ok: true, message: string, summary: { specsProcessed, parametersCreated, parametersUpdated, anchorsCreated, specsCreated }, results: Array }
 * @response 500 { ok: false, error: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const body = await request.json().catch(() => ({}));
    const { specIds } = body; // Optional: only seed specific spec IDs

    // Run the seeder (with optional filter to only seed selected specs)
    const results = await seedFromSpecs(specIds?.length ? { specIds } : undefined);

    const errors = results.filter(r => r.error);
    const succeeded = results.filter(r => !r.error);

    const summary = {
      specsProcessed: results.length,
      specsSucceeded: succeeded.length,
      specsFailed: errors.length,
      parametersCreated: succeeded.reduce((sum, r) => sum + r.parametersCreated, 0),
      parametersUpdated: succeeded.reduce((sum, r) => sum + r.parametersUpdated, 0),
      anchorsCreated: succeeded.reduce((sum, r) => sum + r.anchorsCreated, 0),
      specsCreated: succeeded.reduce((sum, r) => sum + r.specsCreated, 0),
    };

    const message = errors.length > 0
      ? `Imported ${succeeded.length} specs, ${errors.length} failed`
      : `Imported ${succeeded.length} specs`;

    return NextResponse.json({
      ok: errors.length === 0,
      message,
      summary,
      results,
    });
  } catch (error: any) {
    console.error("Error syncing specs:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to sync specs" },
      { status: 500 }
    );
  }
}
