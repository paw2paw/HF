import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractAssertions,
  extractAssertionsSegmented,
  extractTextFromBuffer,
  chunkText,
} from "@/lib/content-trust/extract-assertions";
import { segmentDocument } from "@/lib/content-trust/segment-document";
import { saveAssertions } from "@/lib/content-trust/save-assertions";
import {
  createExtractionTask,
  updateJob,
} from "@/lib/content-trust/extraction-jobs";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { checkAutoTriggerCurriculum } from "@/lib/jobs/auto-trigger";
import { embedAssertionsForSource } from "@/lib/embeddings";
import { getStorageAdapter } from "@/lib/storage";
import type { DocumentType } from "@/lib/content-trust/resolve-config";

/**
 * @api POST /api/content-sources/:sourceId/extract
 * @visibility public
 * @scope content-sources:write
 * @auth OPERATOR
 * @tags content-trust, extraction, classification
 * @description Trigger extraction for a classified content source.
 *   Called after user confirms the document type classification.
 *   Reads documentType from the source record and uses type-specific extraction config.
 *
 * @pathParam sourceId string - ContentSource UUID
 * @body subjectId string - Optional Subject UUID (for auto-trigger curriculum check; omit for orphan sources)
 * @body text string - Optional pre-extracted text (if not provided, downloads from linked media asset)
 *
 * @response 202 { ok, jobId, totalChunks }
 * @response 400 { ok: false, error }
 * @response 404 { ok: false, error }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;
    const userId = authResult.session.user.id;

    const { sourceId } = await params;

    // Load source
    const source = await prisma.contentSource.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        slug: true,
        name: true,
        documentType: true,
        subjects: {
          select: {
            subjectId: true,
            subject: {
              select: {
                slug: true,
                name: true,
                qualificationRef: true,
              },
            },
          },
          take: 1,
        },
        mediaAssets: {
          select: { id: true, storageKey: true, mimeType: true, fileName: true },
          take: 1,
        },
        _count: { select: { assertions: true } },
      },
    });

    if (!source) {
      return NextResponse.json({ ok: false, error: "Content source not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const subjectId = body.subjectId || source.subjects[0]?.subjectId || undefined;
    const subjectSlug = source.subjects[0]?.subject?.slug || source.slug;
    const subjectName = source.subjects[0]?.subject?.name || source.name;
    const qualificationRef = source.subjects[0]?.subject?.qualificationRef || undefined;

    // Get text — either from body or from linked media asset
    let text = body.text as string | undefined;

    if (!text) {
      // Download from linked media asset
      const media = source.mediaAssets[0];
      if (!media) {
        return NextResponse.json(
          { ok: false, error: "No linked media asset found. Upload a file first." },
          { status: 400 },
        );
      }

      const storage = getStorageAdapter();
      const buffer = await storage.download(media.storageKey);
      const extracted = await extractTextFromBuffer(buffer, media.fileName);
      text = extracted.text;

      if (!text?.trim()) {
        return NextResponse.json(
          { ok: false, error: "Could not extract text from stored file." },
          { status: 422 },
        );
      }
    }

    // Create extraction task and start background job
    const chunks = chunkText(text);
    const job = await createExtractionTask(userId, sourceId, source.name, subjectId, subjectName);
    await updateJob(job.id, { status: "extracting", totalChunks: chunks.length });

    // Fire-and-forget background extraction with document type
    const fileName = source.mediaAssets[0]?.fileName || source.name;
    runBackgroundExtraction(
      job.id,
      sourceId,
      subjectId,
      userId,
      text,
      fileName,
      {
        sourceSlug: subjectSlug,
        sourceId,
        documentType: source.documentType as DocumentType,
        qualificationRef,
        maxAssertions: 500,
      },
    ).catch(async (err) => {
      console.error(`[content-sources/:id/extract] Background job ${job.id} error:`, err);
      await updateJob(job.id, { status: "error", error: err.message || "Extraction failed" });
    });

    return NextResponse.json(
      {
        ok: true,
        jobId: job.id,
        totalChunks: chunks.length,
        documentType: source.documentType,
      },
      { status: 202 },
    );
  } catch (error: any) {
    console.error("[content-sources/:id/extract] POST error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Extraction failed" },
      { status: 500 },
    );
  }
}

// ── Background extraction + save ──

async function runBackgroundExtraction(
  jobId: string,
  sourceId: string,
  subjectId: string | undefined,
  userId: string,
  text: string,
  fileName: string,
  opts: {
    sourceSlug: string;
    sourceId: string;
    documentType: DocumentType;
    qualificationRef?: string;
    maxAssertions: number;
  },
) {
  // Try section segmentation for composite documents
  const segmentation = await segmentDocument(text, fileName);

  let result;
  if (segmentation.isComposite && segmentation.sections.length > 1) {
    console.log(`[extract] Composite document detected: ${segmentation.sections.length} sections`);
    result = await extractAssertionsSegmented(text, segmentation.sections, {
      ...opts,
      onChunkDone: (chunkIndex, totalChunks, extractedSoFar) => {
        updateJob(jobId, {
          currentChunk: chunkIndex + 1,
          totalChunks,
          extractedCount: extractedSoFar,
        });
      },
    });
  } else {
    result = await extractAssertions(text, {
      ...opts,
      onChunkDone: (chunkIndex, totalChunks, extractedSoFar) => {
        updateJob(jobId, {
          currentChunk: chunkIndex + 1,
          totalChunks,
          extractedCount: extractedSoFar,
        });
      },
    });
  }

  if (!result.ok) {
    updateJob(jobId, {
      status: "error",
      error: result.error || "Extraction failed",
      warnings: result.warnings,
    });
    return;
  }

  // Save to DB using shared helper
  updateJob(jobId, { status: "importing", extractedCount: result.assertions.length, warnings: result.warnings });

  const { created, duplicatesSkipped } = await saveAssertions(sourceId, result.assertions);

  await updateJob(jobId, {
    status: "done",
    importedCount: created,
    duplicatesSkipped,
    extractedCount: result.assertions.length,
  });

  // Embed new assertions in background (non-blocking)
  if (created > 0) {
    embedAssertionsForSource(sourceId).catch((err) =>
      console.error(`[extract] Embedding failed for source ${sourceId}:`, err)
    );
  }

  // Auto-trigger curriculum generation if all extractions for this subject are done
  if (subjectId) {
    try {
      await checkAutoTriggerCurriculum(subjectId, userId);
    } catch (err) {
      console.error(`[content-sources/:id/extract] Auto-trigger error for subject ${subjectId}:`, err);
    }
  }
}
