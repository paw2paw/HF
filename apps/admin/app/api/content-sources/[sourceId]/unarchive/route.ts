import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api POST /api/content-sources/:sourceId/unarchive
 * @visibility internal
 * @scope content-sources:write
 * @auth session
 * @tags content-trust
 * @description Restore an archived content source (set active, clear archivedAt).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const { sourceId } = await params;

    const source = await prisma.contentSource.findUnique({
      where: { id: sourceId },
      select: { id: true, isActive: true, archivedAt: true, name: true },
    });

    if (!source) {
      return NextResponse.json({ ok: false, error: "Source not found" }, { status: 404 });
    }

    if (source.isActive && !source.archivedAt) {
      return NextResponse.json({ ok: false, error: "Source is already active" }, { status: 400 });
    }

    const updated = await prisma.contentSource.update({
      where: { id: sourceId },
      data: { isActive: true, archivedAt: null },
    });

    return NextResponse.json({ ok: true, message: "Content source restored", source: updated });
  } catch (error: any) {
    console.error("[content-sources/:id/unarchive] POST error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
