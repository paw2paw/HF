import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import {
  performSelectiveDelete,
  performDemoReset,
} from "@/lib/demo-reset/delete-runtime";

/**
 * @api POST /api/admin/demo-reset
 * @visibility internal
 * @scope admin:write
 * @auth session (ADMIN+)
 * @tags admin, data-management
 * @description Selective or full runtime data deletion. Optionally re-seeds metering data.
 * @body tables? string[] - Specific tables to delete (auto-resolves FK cascades). Omit for full reset.
 * @body reseedMetering? boolean - Whether to re-seed metering data after deletion (default: true for full reset)
 * @response 200 { ok: true, result: DemoResetResult }
 * @response 400 { ok: false, error: "..." }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    let body: { tables?: string[]; reseedMetering?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body = full reset
    }

    const { tables, reseedMetering } = body;

    let result;
    if (tables && tables.length > 0) {
      // Selective deletion
      result = await performSelectiveDelete(tables, {
        reseedMetering: reseedMetering ?? false,
      });
    } else {
      // Full demo reset
      result = await performDemoReset();
    }

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    console.error("Error during demo reset:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to perform reset" },
      { status: 500 }
    );
  }
}
