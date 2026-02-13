import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractText,
  extractAssertions,
  type ExtractedAssertion,
} from "@/lib/content-trust/extract-assertions";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * POST /api/subjects/:subjectId/upload
 * Drag-drop endpoint: upload a document, auto-create ContentSource, attach to subject, extract assertions.
 *
 * FormData:
 *   file: File (PDF, TXT, MD, JSON)
 *   mode: "preview" | "import" (default: preview)
 *   role: "syllabus" | "textbook" | "reference" | "supplementary" (default: reference)
 *   sourceName: optional display name (defaults to filename)
 *   trustLevel: optional override (defaults to subject's defaultTrustLevel)
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
    const mode = (formData.get("mode") as string) || "preview";
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

    // Extract text from document
    const { text, pages, fileType } = await extractText(file);
    if (!text.trim()) {
      return NextResponse.json(
        { ok: false, error: "Could not extract text from document" },
        { status: 422 }
      );
    }

    // Run AI extraction
    const result = await extractAssertions(text, {
      sourceSlug: subject.slug,
      qualificationRef: subject.qualificationRef || undefined,
      maxAssertions: 500,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, warnings: result.warnings },
        { status: 422 }
      );
    }

    // Preview mode — return assertions without saving anything
    if (mode === "preview") {
      return NextResponse.json({
        ok: true,
        mode: "preview",
        subjectSlug: subject.slug,
        fileName: file.name,
        fileType,
        pages: pages || null,
        textLength: text.length,
        assertions: result.assertions,
        total: result.assertions.length,
        warnings: result.warnings,
      });
    }

    // Import mode — create ContentSource, attach to subject, save assertions

    // Generate slug from filename
    const baseSlug = file.name
      .replace(/\.[^/.]+$/, "") // remove extension
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const sourceSlug = `${subject.slug}-${baseSlug}`;
    const displayName = sourceName || file.name.replace(/\.[^/.]+$/, "");

    // Create ContentSource
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
        // Slug conflict — append timestamp
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

    // Dedup and save assertions
    const existingHashes = new Set(
      (
        await prisma.contentAssertion.findMany({
          where: { sourceId: source.id },
          select: { contentHash: true },
        })
      )
        .map((a) => a.contentHash)
        .filter(Boolean)
    );

    const toCreate: ExtractedAssertion[] = [];
    let duplicatesSkipped = 0;

    for (const assertion of result.assertions) {
      if (existingHashes.has(assertion.contentHash)) {
        duplicatesSkipped++;
        continue;
      }
      toCreate.push(assertion);
    }

    if (toCreate.length > 0) {
      await prisma.contentAssertion.createMany({
        data: toCreate.map((a) => ({
          sourceId: source.id,
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

    return NextResponse.json({
      ok: true,
      mode: "import",
      subjectSlug: subject.slug,
      source: {
        id: source.id,
        slug: source.slug,
        name: source.name,
        trustLevel: source.trustLevel,
      },
      tags,
      fileName: file.name,
      created: toCreate.length,
      duplicatesSkipped,
      total: result.assertions.length,
      warnings: result.warnings,
    });
  } catch (error: any) {
    console.error("[subjects/:id/upload] POST error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
