import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
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
import {
  computeAssertionSummary,
  type AnalysisPreview,
} from "@/lib/domain/quick-launch";
import {
  generateIdentityFromAssertions,
} from "@/lib/domain/generate-identity";
import { startTaskTracking, updateTaskProgress, completeTask } from "@/lib/ai/task-guidance";
import { embedAssertionsForSource } from "@/lib/embeddings";

/**
 * @api POST /api/domains/quick-launch/analyze
 * @visibility internal
 * @auth OPERATOR
 * @tags domains, quick-launch
 * @description Non-blocking Quick Launch setup.
 *   Creates domain + subject synchronously (fast, <2s).
 *   mode=upload: creates content source + starts background extraction job.
 *   mode=generate: skips file, generates identity from fallback, returns immediately.
 *
 * @request multipart/form-data
 *   subjectName: string (required)
 *   persona: string (required)
 *   mode: "upload" | "generate" (required)
 *   file: File (required when mode=upload) — PDF, TXT, MD
 *   learningGoals: string (optional) — JSON-encoded string[]
 *   qualificationRef: string (optional)
 *
 * @response 202 { ok, domainId, subjectId, sourceId?, jobId?, taskId, mode }
 */

export async function POST(req: NextRequest) {
  // Auth
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

  // Parse form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const subjectName = formData.get("subjectName") as string | null;
  const brief = formData.get("brief") as string | null;
  const persona = formData.get("persona") as string | null;
  const mode = (formData.get("mode") as string | null) || "upload";
  const file = formData.get("file") as File | null;
  const goalsRaw = formData.get("learningGoals") as string | null;
  const qualificationRef = formData.get("qualificationRef") as string | null;
  const existingDomainId = formData.get("domainId") as string | null;

  // Validate required fields
  if (!subjectName?.trim()) {
    return NextResponse.json({ ok: false, error: "subjectName is required" }, { status: 400 });
  }
  if (!persona?.trim()) {
    return NextResponse.json({ ok: false, error: "persona is required" }, { status: 400 });
  }
  if (mode !== "upload" && mode !== "generate") {
    return NextResponse.json({ ok: false, error: "mode must be 'upload' or 'generate'" }, { status: 400 });
  }
  if (mode === "upload" && !file) {
    return NextResponse.json({ ok: false, error: "file is required when mode=upload" }, { status: 400 });
  }

  // Validate file type (only for upload mode)
  if (file) {
    const fileName = file.name.toLowerCase();
    const validExtensions = [".pdf", ".txt", ".md", ".markdown", ".json"];
    if (!validExtensions.some((ext) => fileName.endsWith(ext))) {
      return NextResponse.json(
        { ok: false, error: `Unsupported file type. Supported: ${validExtensions.join(", ")}` },
        { status: 400 }
      );
    }
  }

  // Parse learning goals
  let learningGoals: string[] = [];
  if (goalsRaw) {
    try {
      const parsed = JSON.parse(goalsRaw);
      if (Array.isArray(parsed)) {
        learningGoals = parsed.filter((g: any) => typeof g === "string" && g.trim());
      }
    } catch {
      if (goalsRaw.trim()) {
        learningGoals = [goalsRaw.trim()];
      }
    }
  }

  try {
    // ── Step 1: Resolve or create domain + subject (fast, sync) ──

    let domain;
    let slug: string;
    if (existingDomainId) {
      // Use existing domain (new class in existing school)
      domain = await prisma.domain.findUnique({ where: { id: existingDomainId } });
      if (!domain) {
        return NextResponse.json({ ok: false, error: "Domain not found" }, { status: 404 });
      }
      slug = domain.slug;
    } else {
      // Create or find domain from subject name
      slug = subjectName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      domain = await prisma.domain.findFirst({ where: { slug } });
      if (!domain) {
        domain = await prisma.domain.create({
          data: {
            slug,
            name: subjectName.trim(),
            description: brief?.trim() || `Quick-launched domain for ${subjectName.trim()}`,
            isActive: true,
          },
        });
      }
    }

    const subjectSlug = subjectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let subject = await prisma.subject.findFirst({ where: { slug: subjectSlug } });
    if (!subject) {
      subject = await prisma.subject.create({
        data: {
          slug: subjectSlug,
          name: subjectName.trim(),
          qualificationRef: qualificationRef?.trim() || null,
          isActive: true,
        },
      });
    }

    // Link subject to domain (idempotent)
    const existingLink = await prisma.subjectDomain.findFirst({
      where: { subjectId: subject.id, domainId: domain.id },
    });
    if (!existingLink) {
      await prisma.subjectDomain.create({
        data: { subjectId: subject.id, domainId: domain.id },
      });
    }

    // ── Generate mode: skip file processing, return immediately ──

    if (mode === "generate") {
      // Generate identity with fallback (no assertions)
      let identityConfig = null;
      try {
        const identityResult = await generateIdentityFromAssertions({
          subjectName: subjectName.trim(),
          persona: persona.trim(),
          learningGoals,
          assertions: [],
          maxSampleSize: 0,
        });
        if (identityResult.ok && identityResult.config) {
          identityConfig = identityResult.config;
        }
      } catch (err: any) {
        console.warn("[quick-launch:analyze] Identity fallback failed:", err.message);
      }

      // Create task for tracking
      let taskId: string | null = null;
      try {
        taskId = await startTaskTracking(session.user.id, "quick_launch", {
          phase: "review",
          mode: "generate",
          input: {
            subjectName: subjectName.trim(),
            brief: brief?.trim() || undefined,
            persona: persona.trim(),
            learningGoals,
            qualificationRef: qualificationRef?.trim() || undefined,
          },
          domainId: domain.id,
          subjectId: subject.id,
        });
      } catch (err) {
        console.warn("[quick-launch:analyze] Failed to create task:", err);
      }

      // Save preview to task
      if (taskId) {
        const preview: AnalysisPreview = {
          domainId: domain.id,
          domainSlug: domain.slug,
          domainName: domain.name,
          subjectId: subject.id,
          sourceId: null as any,
          assertionCount: 0,
          assertionSummary: {},
          identityConfig,
          warnings: [],
        };
        updateTaskProgress(taskId, {
          currentStep: 3,
          context: {
            phase: "review",
            preview,
            input: {
              subjectName: subjectName.trim(),
              brief: brief?.trim() || undefined,
              persona: persona.trim(),
              learningGoals,
            },
          },
        }).catch(() => {});
      }

      return NextResponse.json(
        {
          ok: true,
          mode: "generate",
          domainId: domain.id,
          domainSlug: domain.slug,
          domainName: domain.name,
          subjectId: subject.id,
          identityConfig,
          taskId,
        },
        { status: 202 }
      );
    }

    // ── Upload mode: create content source + background extraction ──

    const baseSlug = file!.name
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const sourceSlug = `${slug}-${baseSlug}`;
    const displayName = file!.name.replace(/\.[^/.]+$/, "");

    let source;
    try {
      source = await prisma.contentSource.create({
        data: { slug: sourceSlug, name: displayName, trustLevel: "UNVERIFIED" },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        source = await prisma.contentSource.create({
          data: { slug: `${sourceSlug}-${Date.now()}`, name: displayName, trustLevel: "UNVERIFIED" },
        });
      } else {
        throw err;
      }
    }

    // Attach source to subject
    const existingSourceLink = await prisma.subjectSource.findFirst({
      where: { subjectId: subject.id, sourceId: source.id },
    });
    if (!existingSourceLink) {
      await prisma.subjectSource.create({
        data: { subjectId: subject.id, sourceId: source.id, tags: ["content"] },
      });
    }

    // Extract text + start background job
    const { text } = await extractText(file!);
    if (!text.trim()) {
      return NextResponse.json(
        { ok: false, error: "Could not extract text from document" },
        { status: 422 }
      );
    }

    const chunks = chunkText(text);
    const job = await createJob(source.id, file!.name);
    await updateJob(job.id, { status: "extracting", totalChunks: chunks.length });

    // Create UserTask for tracking/resume
    let taskId: string | null = null;
    try {
      taskId = await startTaskTracking(session.user.id, "quick_launch", {
        phase: "building",
        mode: "upload",
        input: {
          subjectName: subjectName.trim(),
          brief: brief?.trim() || undefined,
          persona: persona.trim(),
          learningGoals,
          qualificationRef: qualificationRef?.trim() || undefined,
        },
        fileInfo: { name: file!.name, size: file!.size },
        domainId: domain.id,
        subjectId: subject.id,
        sourceId: source.id,
        jobId: job.id,
      });
    } catch (err) {
      console.warn("[quick-launch:analyze] Failed to create task:", err);
    }

    // Fire-and-forget background extraction + identity
    runQuickLaunchBackground(
      job.id,
      source.id,
      text,
      {
        sourceSlug: slug,
        qualificationRef: qualificationRef?.trim() || undefined,
        maxAssertions: 500,
      },
      {
        subjectName: subjectName.trim(),
        persona: persona.trim(),
        learningGoals,
      },
      {
        domainId: domain.id,
        domainSlug: domain.slug,
        domainName: domain.name,
        subjectId: subject.id,
      },
      taskId,
    ).catch(async (err) => {
      console.error(`[quick-launch:analyze] Background job ${job.id} unhandled error:`, err);
      await updateJob(job.id, { status: "error", error: err.message || "Unknown error" });
      // Mark task as completed so it doesn't stay in_progress forever
      if (taskId) {
        await updateTaskProgress(taskId, {
          context: { error: err.message || "Unknown error", phase: "failed" },
        }).catch(() => {});
        completeTask(taskId).catch(() => {});
      }
    });

    // Return immediately
    return NextResponse.json(
      {
        ok: true,
        mode: "upload",
        domainId: domain.id,
        domainSlug: domain.slug,
        domainName: domain.name,
        subjectId: subject.id,
        sourceId: source.id,
        jobId: job.id,
        totalChunks: chunks.length,
        taskId,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("[quick-launch:analyze] Setup error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Quick Launch setup failed" },
      { status: 500 }
    );
  }
}

// ── Background extraction + identity generation ──

async function runQuickLaunchBackground(
  jobId: string,
  sourceId: string,
  text: string,
  extractionOpts: {
    sourceSlug: string;
    qualificationRef?: string;
    maxAssertions: number;
  },
  identityInput: {
    subjectName: string;
    persona: string;
    learningGoals: string[];
  },
  domainInfo: {
    domainId: string;
    domainSlug: string;
    domainName: string;
    subjectId: string;
  },
  taskId: string | null,
) {
  // ── Extract assertions ──
  const result = await extractAssertions(text, {
    ...extractionOpts,
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
    // Mark task as completed so it doesn't stay in_progress forever
    if (taskId) {
      await updateTaskProgress(taskId, {
        context: { error: result.error || "Extraction failed", phase: "failed" },
      });
      completeTask(taskId).catch(() => {});
    }
    return;
  }

  // ── Save assertions to DB ──
  await updateJob(jobId, { status: "importing", extractedCount: result.assertions.length, warnings: result.warnings });

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

  // Embed new assertions in background (non-blocking)
  if (toCreate.length > 0) {
    embedAssertionsForSource(sourceId).catch((err) =>
      console.error(`[quick-launch:analyze] Embedding failed for source ${sourceId}:`, err)
    );
  }

  // ── Generate identity (optional, best-effort) ──
  let identityConfig = null;
  try {
    const identityResult = await generateIdentityFromAssertions({
      subjectName: identityInput.subjectName,
      persona: identityInput.persona,
      learningGoals: identityInput.learningGoals,
      assertions: result.assertions.slice(0, 60).map((a) => ({
        assertion: a.assertion,
        category: a.category,
        chapter: a.chapter || null,
        tags: a.tags,
      })),
      maxSampleSize: 60,
    });
    if (identityResult.ok && identityResult.config) {
      identityConfig = identityResult.config;
    }
  } catch (err: any) {
    console.warn("[quick-launch:analyze] Identity generation failed:", err.message);
  }

  // ── Mark job done ──
  await updateJob(jobId, {
    status: "done",
    importedCount: toCreate.length,
    duplicatesSkipped,
    extractedCount: result.assertions.length,
  });

  // ── Save full preview to UserTask for resume ──
  if (taskId) {
    const summary = computeAssertionSummary(result.assertions);
    const preview: AnalysisPreview = {
      domainId: domainInfo.domainId,
      domainSlug: domainInfo.domainSlug,
      domainName: domainInfo.domainName,
      subjectId: domainInfo.subjectId,
      sourceId,
      assertionCount: result.assertions.length,
      assertionSummary: summary,
      identityConfig,
      warnings: result.warnings,
    };

    updateTaskProgress(taskId, {
      currentStep: 3,
      context: {
        phase: "review",
        preview,
        input: identityInput,
      },
    }).catch(() => {});
  }
}
