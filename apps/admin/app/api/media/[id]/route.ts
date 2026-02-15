import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getStorageAdapter } from "@/lib/storage";

/**
 * @api GET /api/media/:id
 * @visibility internal
 * @scope media:read
 * @auth session (VIEWER+)
 * @tags media
 * @description Serve a media file by ID. Generates a signed URL from the storage backend and redirects to it. For local storage, streams the file directly.
 * @response 302 Redirect to signed URL
 * @response 404 { ok: false, error: "Media not found" }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("VIEWER");
  if (isAuthError(auth)) return auth.error;

  const { id } = await params;

  const media = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!media) {
    return NextResponse.json({ ok: false, error: "Media not found" }, { status: 404 });
  }

  const storage = getStorageAdapter();

  // For local storage, stream the file directly
  if (media.storageType === "local") {
    try {
      const { LocalStorageAdapter } = await import("@/lib/storage/local");
      const localAdapter = storage as InstanceType<typeof LocalStorageAdapter>;
      if ("read" in localAdapter) {
        const buffer = await localAdapter.read(media.storageKey);
        return new Response(buffer, {
          headers: {
            "Content-Type": media.mimeType,
            "Content-Disposition": `inline; filename="${media.fileName}"`,
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    } catch {
      // Fall through to signed URL approach
    }
  }

  // For GCS (and fallback), redirect to signed URL
  const signedUrl = await storage.getSignedUrl(media.storageKey, 3600);
  return NextResponse.redirect(signedUrl);
}

/**
 * @api DELETE /api/media/:id
 * @visibility internal
 * @scope media:delete
 * @auth session (ADMIN+)
 * @tags media
 * @description Delete a media file by ID. Removes from storage backend and database.
 * @response 200 { ok: true }
 * @response 404 { ok: false, error: "Media not found" }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const { id } = await params;

  const media = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!media) {
    return NextResponse.json({ ok: false, error: "Media not found" }, { status: 404 });
  }

  // Delete from storage backend
  const storage = getStorageAdapter();
  await storage.delete(media.storageKey);

  // Delete from database (cascades SubjectMedia links)
  await prisma.mediaAsset.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
