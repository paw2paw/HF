import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { getLayerDiff } from "@/lib/layers/compute-diff";

/**
 * @api GET /api/layers/diff
 * @visibility public
 * @scope layers:read
 * @auth session
 * @tags layers, specs
 * @description Compute the inheritance diff between a base archetype and an overlay identity spec
 * @query overlayId string - UUID of the overlay (domain) spec
 * @response 200 { ok: true, diff: LayerDiffResult }
 * @response 400 { ok: false, error: "overlayId required" }
 * @response 404 { ok: false, error: "Spec not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { searchParams } = new URL(req.url);
    const overlayId = searchParams.get("overlayId");

    if (!overlayId) {
      return NextResponse.json(
        { ok: false, error: "overlayId query parameter is required" },
        { status: 400 },
      );
    }

    const diff = await getLayerDiff(overlayId);

    return NextResponse.json({ ok: true, diff });
  } catch (error: any) {
    const message = error?.message || "Failed to compute layer diff";
    const isNotFound = message.includes("not found") || message.includes("inactive") || message.includes("not an overlay");
    return NextResponse.json(
      { ok: false, error: message },
      { status: isNotFound ? 404 : 500 },
    );
  }
}
