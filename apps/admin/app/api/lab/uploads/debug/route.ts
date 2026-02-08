import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/lab/uploads/debug
 *
 * Debug endpoint to show uploads
 */
export async function GET() {
  try {
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
