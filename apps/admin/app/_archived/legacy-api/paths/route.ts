import { NextResponse } from "next/server";
import {
  getKbRoot,
  getAllDataNodes,
  resolveDataNodePath,
  validateKbStructure,
  initializeKbStructure,
  clearManifestCache,
} from "@/lib/data-paths";

export const runtime = "nodejs";

/**
 * GET /api/paths
 *
 * Returns the current paths configuration and validation status.
 * Uses unified data-paths system (reads from agents.json manifest).
 */
export async function GET() {
  try {
    // Clear cache to always return fresh values
    clearManifestCache();

    const kbRoot = getKbRoot();
    const nodes = getAllDataNodes();

    // Build resolved paths from data nodes
    const resolved: Record<string, Record<string, string>> = {
      root: { path: kbRoot },
      sources: {},
      derived: {},
    };

    for (const node of nodes) {
      if (node.storageType === "path" && node.path) {
        const absPath = resolveDataNodePath(node.id);
        if (absPath) {
          if (node.role === "source") {
            resolved.sources[node.id.replace("data:", "")] = absPath;
          } else {
            resolved.derived[node.id.replace("data:", "")] = absPath;
          }
        }
      }
    }

    const validation = validateKbStructure();

    return NextResponse.json({
      ok: true,
      resolved,
      validation: {
        valid: validation.valid,
        root: validation.kbRoot,
        missing: validation.missing,
      },
      env: {
        HF_KB_PATH: process.env.HF_KB_PATH || null,
        NODE_ENV: process.env.NODE_ENV,
      },
    });
  } catch (err: any) {
    console.error("[Paths API Error]", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load paths" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/paths
 *
 * Actions:
 * - action: "validate" - Validate all paths exist
 * - action: "ensure" - Create missing derived directories
 * - action: "init" - Initialize a new KB directory structure
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "validate";

    if (action === "validate") {
      const validation = validateKbStructure();
      return NextResponse.json({
        ok: validation.valid,
        validation: {
          valid: validation.valid,
          root: validation.kbRoot,
          missing: validation.missing,
        },
      });
    }

    if (action === "ensure" || action === "init") {
      const result = initializeKbStructure(body.root);
      const validation = validateKbStructure(result.kbRoot);

      return NextResponse.json({
        ok: true,
        message: action === "init"
          ? `Initialized KB at: ${result.kbRoot}`
          : "Derived directories ensured",
        root: result.kbRoot,
        created: result.created,
        validation: {
          valid: validation.valid,
          root: validation.kbRoot,
          missing: validation.missing,
        },
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[Paths API Error]", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
