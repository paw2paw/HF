import { NextResponse } from "next/server";
import {
  loadManifest,
  validateManifest,
  saveManifest,
  clearManifestCache,
  getManifestPath,
} from "@/lib/manifest";
import fs from "node:fs";

export const runtime = "nodejs";

function assertLocalOnly() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Manifest API is disabled in production");
  }
  if (process.env.HF_OPS_ENABLED !== "true") {
    throw new Error("Manifest API is disabled (set HF_OPS_ENABLED=true)");
  }
}

/**
 * GET /api/manifest
 *
 * Returns the full manifest with validation status
 */
export async function GET() {
  try {
    assertLocalOnly();

    const manifest = loadManifest(true);
    const validation = validateManifest(manifest);
    const manifestPath = getManifestPath();
    const stat = fs.statSync(manifestPath);

    return NextResponse.json({
      ok: true,
      manifest,
      validation,
      meta: {
        path: manifestPath,
        lastModified: stat.mtime.toISOString(),
        size: stat.size,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load manifest" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/manifest
 *
 * Actions:
 * - action: "validate" - Validate manifest structure
 * - action: "reload" - Force reload from disk (clear cache)
 * - action: "backup" - Create a timestamped backup
 * - action: "restore" - Restore from backup
 */
export async function POST(req: Request) {
  try {
    assertLocalOnly();

    const body = await req.json().catch(() => ({}));
    const action = body.action || "validate";

    if (action === "validate") {
      const manifest = loadManifest(true);
      const validation = validateManifest(manifest);
      return NextResponse.json({
        ok: validation.valid,
        validation,
      });
    }

    if (action === "reload") {
      clearManifestCache();
      const manifest = loadManifest(true);
      const validation = validateManifest(manifest);
      return NextResponse.json({
        ok: true,
        message: "Manifest reloaded from disk",
        validation,
      });
    }

    if (action === "backup") {
      const manifestPath = getManifestPath();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = manifestPath.replace(".json", `.backup-${timestamp}.json`);

      fs.copyFileSync(manifestPath, backupPath);

      return NextResponse.json({
        ok: true,
        message: "Backup created",
        backupPath,
      });
    }

    if (action === "restore") {
      const backupPath = body.backupPath;
      if (!backupPath) {
        return NextResponse.json(
          { ok: false, error: "backupPath required for restore" },
          { status: 400 }
        );
      }

      if (!fs.existsSync(backupPath)) {
        return NextResponse.json(
          { ok: false, error: `Backup not found: ${backupPath}` },
          { status: 404 }
        );
      }

      const manifestPath = getManifestPath();
      const content = fs.readFileSync(backupPath, "utf-8");
      const manifest = JSON.parse(content);

      // Validate before restoring
      const validation = validateManifest(manifest);
      if (!validation.valid) {
        return NextResponse.json(
          {
            ok: false,
            error: "Backup validation failed",
            validation,
          },
          { status: 400 }
        );
      }

      saveManifest(manifest);
      return NextResponse.json({
        ok: true,
        message: "Manifest restored from backup",
        validation,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to process request" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/manifest
 *
 * Replace the entire manifest (with validation)
 */
export async function PUT(req: Request) {
  try {
    assertLocalOnly();

    const body = await req.json();
    const { manifest, skipValidation } = body;

    if (!manifest) {
      return NextResponse.json(
        { ok: false, error: "manifest object required" },
        { status: 400 }
      );
    }

    // Validate unless explicitly skipped
    if (!skipValidation) {
      const validation = validateManifest(manifest);
      if (!validation.valid) {
        return NextResponse.json(
          {
            ok: false,
            error: "Manifest validation failed",
            validation,
          },
          { status: 400 }
        );
      }
    }

    saveManifest(manifest);
    const validation = validateManifest(manifest);

    return NextResponse.json({
      ok: true,
      message: "Manifest saved",
      validation,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to save manifest" },
      { status: 500 }
    );
  }
}
