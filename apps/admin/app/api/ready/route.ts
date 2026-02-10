export const runtime = "nodejs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
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
