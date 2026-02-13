import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/lab/uploads/debug
 * @visibility internal
 * @scope lab:read
 * @auth session
 * @tags lab
 * @description Debug endpoint to list recent BDD uploads with metadata (last 20)
 * @response 200 { ok: true, uploadCount: number, uploads: UploadSummary[] }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const uploads = await prisma.bDDUpload.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      ok: true,
      uploadCount: uploads.length,
      uploads: uploads.map((u) => ({
        id: u.id,
        filename: u.filename,
        status: u.status,
        contentLength: u.content?.length || 0,
        createdAt: u.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Debug failed" },
      { status: 500 }
    );
  }
}
