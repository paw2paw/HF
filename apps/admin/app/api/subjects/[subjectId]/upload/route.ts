import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractText,
  extractAssertions,
  chunkText,
  type ExtractedAssertion,
} from "@/lib/content-trust/extract-assertions";
import {
  createJob,
  updateJob,
} from "@/lib/content-trust/extraction-jobs";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api POST /api/subjects/:subjectId/upload
 * @visibility public
 * @scope subjects:write
 * @auth OPERATOR
 * @tags subjects, content-trust
 * @description Drag-drop endpoint: upload a document, auto-create ContentSource,
 *   attach to subject, and start background extraction.
 *   Returns immediately with source + jobId for progress polling.
 *
 * @body file File (PDF, TXT, MD, JSON)
 * @body tags string — comma-separated tags (default: "content")
 * @body sourceName string — optional display name (defaults to filename)
 * @body trustLevel string — optional override (defaults to subject's defaultTrustLevel)
 *
 * @response 202 { ok, source, jobId, totalChunks }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;

    // Verify subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject) {
      return NextResponse.json({ ok: false, error: "Subject not found" }, { status: 404 });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tagsRaw = (formData.get("tags") as string) || "content";
    const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
    const sourceName = (formData.get("sourceName") as string) || null;
    const trustLevelOverride = (formData.get("trustLevel") as string) || null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    const validExtensions = [".pdf", ".txt", ".md", ".markdown", ".json"];
    if (!validExtensions.some((ext) => fileName.endsWith(ext))) {
      return NextResponse.json(
        { ok: false, error: `Unsupported file type. Supported: ${validExtensions.join(", ")}` },
        { status: 400 }
      );
    }

    // ── Extract text (fast, no AI) ──

    const { text } = await extractText(file);
    if (!text.trim()) {
      return NextResponse.json(
        { ok: false, error: "Could not extract text from document" },
        { status: 422 }
      );
    }

    // ── Create ContentSource (sync, fast) ──

    const baseSlug = file.name
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const sourceSlug = `${subject.slug}-${baseSlug}`;
    const displayName = sourceName || file.name.replace(/\.[^/.]+$/, "");

    const trustLevel = trustLevelOverride || subject.defaultTrustLevel;
    let source;
    try {
      source = await prisma.contentSource.create({
        data: {
          slug: sourceSlug,
          name: displayName,
          trustLevel: trustLevel as any,
        },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        source = await prisma.contentSource.create({
          data: {
            slug: `${sourceSlug}-${Date.now()}`,
            name: displayName,
            trustLevel: trustLevel as any,
          },
        });
      } else {
        throw err;
      }
    }

    // Attach to subject
    await prisma.subjectSource.create({
      data: {
        subjectId,
        sourceId: source.id,
        tags,
        trustLevelOverride: trustLevelOverride ? (trustLevelOverride as any) : null,
      },
    });

    // ── Start background extraction ──

    const chunks = chunkText(text);
    const job = createJob(source.id, file.name);
    updateJob(job.id, { status: "extracting", totalChunks: chunks.length });

    // Fire-and-forget background extraction
    runBackgroundExtraction(
      job.id,
      source.id,
      text,
      {
        sourceSlug: subject.slug,
        qualificationRef: subject.qualificationRef || undefined,
        maxAssertions: 500,
      }
    ).catch((err) => {
      console.error(`[subjects/:id/upload] Background job ${job.id} error:`, err);
      updateJob(job.id, { status: "error", error: err.message || "Extraction failed" });
    });

    // ── Return immediately ──

    return NextResponse.json(
      {
        ok: true,
        source: {
          id: source.id,
          slug: source.slug,
          name: source.name,
          trustLevel: source.trustLevel,
        },
        tags,
        fileName: file.name,
        jobId: job.id,
        totalChunks: chunks.length,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("[subjects/:id/upload] POST error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}

// ── Background extraction + save ──

async function runBackgroundExtraction(
  jobId: string,
  sourceId: string,
  text: string,
  opts: { sourceSlug: string; qualificationRef?: string; maxAssertions: number },
) {
  const result = await extractAssertions(text, {
    ...opts,
    onChunkDone: (chunkIndex, totalChunks, extractedSoFar) => {
      updateJob(jobId, {
        currentChunk: chunkIndex + 1,
        totalChunks,
        extractedCount: extractedSoFar,
      });
    },
  });

  if (!result.ok) {
    updateJob(jobId, {
      status: "error",
      error: result.error || "Extraction failed",
      warnings: result.warnings,
    });
    return;
  }

  // Save to DB
  updateJob(jobId, { status: "importing", extractedCount: result.assertions.length, warnings: result.warnings });

  const existingHashes = new Set(
    (await prisma.contentAssertion.findMany({
      where: { sourceId },
      select: { contentHash: true },
    }))
      .map((a) => a.contentHash)
      .filter(Boolean)
  );

  const toCreate = result.assertions.filter((a) => !existingHashes.has(a.contentHash));
  const duplicatesSkipped = result.assertions.length - toCreate.length;

  if (toCreate.length > 0) {
    await prisma.contentAssertion.createMany({
      data: toCreate.map((a) => ({
        sourceId,
        assertion: a.assertion,
        category: a.category,
        chapter: a.chapter || null,
        section: a.section || null,
        tags: a.tags,
        examRelevance: a.examRelevance ?? null,
        learningOutcomeRef: a.learningOutcomeRef || null,
        validUntil: a.validUntil ? new Date(a.validUntil) : null,
        taxYear: a.taxYear || null,
        contentHash: a.contentHash,
      })),
    });
  }

  updateJob(jobId, {
    status: "done",
    importedCount: toCreate.length,
    duplicatesSkipped,
    extractedCount: result.assertions.length,
  });
}
