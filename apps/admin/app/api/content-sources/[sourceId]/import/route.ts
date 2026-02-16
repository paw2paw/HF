import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractText,
  extractAssertions,
  chunkText,
  type ExtractedAssertion,
} from "@/lib/content-trust/extract-assertions";
import type { DocumentType } from "@/lib/content-trust/resolve-config";
import { createJob, getJob, updateJob } from "@/lib/content-trust/extraction-jobs";
// Note: createJob/getJob/updateJob now delegate to UserTask DB storage
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api POST /api/content-sources/:sourceId/import
 * @visibility public
 * @scope content-sources:write
 * @auth session
 * @tags content-trust
 * @description Upload a document (PDF, text, markdown) and extract ContentAssertions linked to this source.
 *   - mode=preview: Extract and return assertions without saving (dry run)
 *   - mode=import: Extract and save assertions to database
 *   - mode=background: Start extraction + import in background, return job ID for polling
 * @body file File - The document to parse (multipart/form-data)
 * @body mode "preview" | "import" | "background" - Whether to preview, save, or run in background (default: preview)
 * @body focusChapters string - Comma-separated chapter names to focus on (optional)
 * @body maxAssertions number - Max assertions to extract (default: 500)
 * @response 200 { ok: true, assertions: ExtractedAssertion[], created: number, duplicatesSkipped: number, warnings: string[] }
 * @response 202 { ok: true, jobId: string } (background mode)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { sourceId } = await params;

    // Verify source exists
    const source = await prisma.contentSource.findUnique({
      where: { id: sourceId },
      select: { id: true, slug: true, name: true, trustLevel: true, qualificationRef: true, documentType: true },
    });

    if (!source) {
      return NextResponse.json({ ok: false, error: "Source not found" }, { status: 404 });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) || "preview";
    const focusChaptersRaw = formData.get("focusChapters") as string | null;
    const maxAssertionsRaw = formData.get("maxAssertions") as string | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const name = file.name.toLowerCase();
    const validExtensions = [".pdf", ".txt", ".md", ".markdown", ".json"];
    if (!validExtensions.some((ext) => name.endsWith(ext))) {
      return NextResponse.json(
        { ok: false, error: `Unsupported file type. Supported: ${validExtensions.join(", ")}` },
        { status: 400 }
      );
    }

    const focusChapters = focusChaptersRaw?.split(",").map((s) => s.trim()).filter(Boolean);
    const maxAssertions = maxAssertionsRaw ? parseInt(maxAssertionsRaw, 10) : 500;

    // ── Background mode: return immediately, extract in background ──
    if (mode === "background") {
      // Extract text synchronously (fast) so we can validate the file
      const { text, pages, fileType } = await extractText(file);
      if (!text.trim()) {
        return NextResponse.json(
          { ok: false, error: "Could not extract text from document" },
          { status: 422 }
        );
      }

      const chunks = chunkText(text);
      const job = await createJob(sourceId, file.name);
      await updateJob(job.id, { status: "extracting", totalChunks: chunks.length });

      // Fire-and-forget the extraction + import
      runBackgroundExtraction(job.id, source, text, file.name, fileType, pages, {
        sourceSlug: source.slug,
        sourceId: source.id,
        documentType: (source.documentType as DocumentType) || undefined,
        qualificationRef: source.qualificationRef || undefined,
        focusChapters,
        maxAssertions,
      }).catch(async (err) => {
        console.error(`[extraction-job] ${job.id} unhandled error:`, err);
        await updateJob(job.id, { status: "error", error: err.message || "Unknown error" });
      });

      return NextResponse.json(
        { ok: true, jobId: job.id, totalChunks: chunks.length },
        { status: 202 }
      );
    }

    // ── Synchronous modes (preview / import) ──
    const { text, pages, fileType } = await extractText(file);

    if (!text.trim()) {
      return NextResponse.json(
        { ok: false, error: "Could not extract text from document" },
        { status: 422 }
      );
    }

    const result = await extractAssertions(text, {
      sourceSlug: source.slug,
      sourceId: source.id,
      documentType: (source.documentType as DocumentType) || undefined,
      qualificationRef: source.qualificationRef || undefined,
      focusChapters,
      maxAssertions,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, warnings: result.warnings }, { status: 422 });
    }

    // Preview mode — return assertions without saving
    if (mode === "preview") {
      return NextResponse.json({
        ok: true,
        mode: "preview",
        sourceSlug: source.slug,
        fileName: file.name,
        fileType,
        pages: pages || null,
        textLength: text.length,
        assertions: result.assertions,
        total: result.assertions.length,
        warnings: result.warnings,
      });
    }

    // Import mode — save to database
    const { created, duplicatesSkipped } = await saveAssertions(source.id, result.assertions);

    return NextResponse.json({
      ok: true,
      mode: "import",
      sourceSlug: source.slug,
      fileName: file.name,
      created,
      duplicatesSkipped,
      total: result.assertions.length,
      warnings: result.warnings,
    });
  } catch (error: any) {
    console.error("[content-sources/:id/import] POST error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Import failed" },
      { status: 500 }
    );
  }
}

/**
 * @api GET /api/content-sources/:sourceId/import?jobId=xxx
 * @visibility public
 * @scope content-sources:read
 * @auth session
 * @tags content-trust
 * @description Poll the status of a background extraction job.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId query param required" }, { status: 400 });
  }

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found or expired" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, job });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function saveAssertions(
  sourceId: string,
  assertions: ExtractedAssertion[]
): Promise<{ created: number; duplicatesSkipped: number }> {
  const existingHashes = new Set(
    (
      await prisma.contentAssertion.findMany({
        where: { sourceId },
        select: { contentHash: true },
      })
    )
      .map((a) => a.contentHash)
      .filter(Boolean)
  );

  const toCreate: ExtractedAssertion[] = [];
  let duplicatesSkipped = 0;

  for (const assertion of assertions) {
    if (existingHashes.has(assertion.contentHash)) {
      duplicatesSkipped++;
      continue;
    }
    toCreate.push(assertion);
  }

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
        validFrom: null,
        validUntil: a.validUntil ? new Date(a.validUntil) : null,
        taxYear: a.taxYear || null,
        contentHash: a.contentHash,
      })),
    });
  }

  return { created: toCreate.length, duplicatesSkipped };
}

async function runBackgroundExtraction(
  jobId: string,
  source: { id: string; slug: string; qualificationRef: string | null },
  text: string,
  fileName: string,
  fileType: string,
  pages: number | undefined,
  options: { sourceSlug: string; sourceId?: string; documentType?: DocumentType; qualificationRef?: string; focusChapters?: string[]; maxAssertions?: number }
) {
  const result = await extractAssertions(text, {
    ...options,
    onChunkDone: (chunkIndex, totalChunks, extractedSoFar) => {
      updateJob(jobId, {
        currentChunk: chunkIndex + 1,
        totalChunks,
        extractedCount: extractedSoFar,
      });
    },
  });

  if (!result.ok) {
    await updateJob(jobId, {
      status: "error",
      error: result.error || "Extraction failed",
      warnings: result.warnings,
    });
    return;
  }

  // Now import to DB
  await updateJob(jobId, { status: "importing", extractedCount: result.assertions.length, warnings: result.warnings });

  const { created, duplicatesSkipped } = await saveAssertions(source.id, result.assertions);

  await updateJob(jobId, {
    status: "done",
    importedCount: created,
    duplicatesSkipped,
    extractedCount: result.assertions.length,
  });
}
