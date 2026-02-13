export const runtime = "nodejs";

/**
 * @api GET /api/health
 * @visibility public
 * @scope system:health
 * @auth none
 * @tags system
 * @description Basic liveness check. Returns OK with timestamp. Used by infrastructure probes and load balancers.
 * @response 200 { ok: true, ts: "ISO8601" }
 */
export async function GET() {
  return Response.json({ ok: true, ts: new Date().toISOString() });
}
