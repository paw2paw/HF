import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getStorageAdapter, computeContentHash, isAllowedMimeType, isAllowedFileSize } from "@/lib/storage";
import { config } from "@/lib/config";

/**
 * @api POST /api/media/upload
 * @visibility internal
 * @scope media:upload
 * @auth session (OPERATOR+)
 * @tags media
 * @description Upload a media file (image, PDF, audio). Validates MIME type and file size, deduplicates by content hash, stores in configured backend (GCS/local), and creates a MediaAsset record. Optionally links to a subject.
 * @body file File - The file to upload (multipart/form-data)
 * @body title string - Optional display title
 * @body description string - Optional description
 * @body tags string - Optional comma-separated tags
 * @body subjectId string - Optional subject ID to link the media to
 * @body trustLevel string - Optional trust level (default: UNVERIFIED)
 * @response 200 { ok: true, media: { id, fileName, mimeType, fileSize, url } }
 * @response 400 { ok: false, error: "..." }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth("OPERATOR");
  if (isAuthError(auth)) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    // Validate MIME type
    if (!isAllowedMimeType(file.type)) {
      return NextResponse.json(
        { ok: false, error: `File type "${file.type}" not allowed. Allowed: ${config.storage.allowedMimeTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (!isAllowedFileSize(file.size)) {
      const maxMB = Math.round(config.storage.maxFileSize / 1048576);
      return NextResponse.json(
        { ok: false, error: `File too large (${Math.round(file.size / 1048576)}MB). Maximum: ${maxMB}MB` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentHash = computeContentHash(buffer);

    // Deduplication: check if this exact file already exists
    const existing = await prisma.mediaAsset.findUnique({ where: { contentHash } });
    if (existing) {
      // Optionally link to subject if not already linked
      const subjectId = formData.get("subjectId") as string | null;
      if (subjectId) {
        await prisma.subjectMedia.upsert({
          where: { subjectId_mediaId: { subjectId, mediaId: existing.id } },
          update: {},
          create: { subjectId, mediaId: existing.id },
        });
      }

      return NextResponse.json({
        ok: true,
        media: {
          id: existing.id,
          fileName: existing.fileName,
          mimeType: existing.mimeType,
          fileSize: existing.fileSize,
          title: existing.title,
          url: `/api/media/${existing.id}`,
        },
        deduplicated: true,
      });
    }

    // Upload to storage backend
    const storage = getStorageAdapter();
    const { storageKey } = await storage.upload(buffer, {
      fileName: file.name,
      mimeType: file.type,
      contentHash,
    });

    // Parse optional metadata
    const title = (formData.get("title") as string) || null;
    const description = (formData.get("description") as string) || null;
    const tagsRaw = (formData.get("tags") as string) || "";
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const subjectId = formData.get("subjectId") as string | null;
    const trustLevel = (formData.get("trustLevel") as string) || "UNVERIFIED";
    const sourceId = (formData.get("sourceId") as string) || null;

    // Create MediaAsset record
    const media = await prisma.mediaAsset.create({
      data: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        contentHash,
        storageKey,
        storageType: config.storage.backend,
        title,
        description,
        tags,
        uploadedBy: auth.session.user?.id || "unknown",
        sourceId,
        trustLevel: trustLevel as any,
      },
    });

    // Optionally link to subject
    if (subjectId) {
      await prisma.subjectMedia.create({
        data: { subjectId, mediaId: media.id },
      });
    }

    return NextResponse.json({
      ok: true,
      media: {
        id: media.id,
        fileName: media.fileName,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        title: media.title,
        url: `/api/media/${media.id}`,
      },
    });
  } catch (error) {
    console.error("Media upload error:", error);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}
