export const runtime = "nodejs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @api GET /api/ready
 * @visibility public
 * @scope system:readiness
 * @auth none
 * @tags system
 * @description Readiness probe that verifies database connectivity via a simple SELECT query.
 * @response 200 { ok: true, db: "ok", ts: "ISO8601" }
 * @response 503 { ok: false, db: "down", error: "..." }
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "ok", ts: new Date().toISOString() });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, db: "down", error: String(e?.message ?? e) }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }
}
