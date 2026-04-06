import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { z } from "zod";
import pLimit from "p-limit";

const bodySchema = z.object({
  sourceIds: z.array(z.string().uuid()).min(1, "At least one source required"),
});

/**
 * @api POST /api/courses/:courseId/re-extract
 * @visibility public
 * @scope courses:write
 * @auth OPERATOR
 * @tags content-trust, extraction, courses
 * @description Trigger re-extraction with replace mode for selected sources
 *   in a course. Returns job IDs for tracking. After all extractions complete,
 *   the client should call /re-extract/recompose to refresh active caller prompts.
 *
 * @pathParam courseId string - Playbook UUID
 * @body sourceIds string[] - Content source IDs to re-extract
 * @response 202 { ok, sources: [{ sourceId, name, documentType, assertionCount, jobId?, error? }], triggered, total, activeCallerCount }
 * @response 400 { ok: false, error }
 * @response 404 { ok: false, error }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const user = await requireAuth("OPERATOR");
    if (isAuthError(user)) return user;

    const { courseId } = await params;
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.errors[0]?.message || "Invalid request" },
        { status: 400 },
      );
    }

    const { sourceIds } = parsed.data;

    // Verify course exists and get all valid source IDs for this course
    const playbookSubjects = await prisma.playbookSubject.findMany({
      where: { playbookId: courseId },
      select: {
        subject: {
          select: {
            id: true,
            sources: {
              select: {
                sourceId: true,
                source: {
                  select: {
                    id: true,
                    name: true,
                    documentType: true,
                    _count: { select: { assertions: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (playbookSubjects.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Course not found or has no subjects" },
        { status: 404 },
      );
    }

    // Build map of valid sources for this course (deduped)
    const validSources = new Map<string, {
      sourceId: string;
      subjectId: string;
      name: string;
      documentType: string;
      assertionCount: number;
    }>();

    for (const ps of playbookSubjects) {
      for (const ss of ps.subject.sources) {
        if (!validSources.has(ss.sourceId)) {
          validSources.set(ss.sourceId, {
            sourceId: ss.sourceId,
            subjectId: ps.subject.id,
            name: ss.source.name,
            documentType: ss.source.documentType,
            assertionCount: ss.source._count.assertions,
          });
        }
      }
    }

    // Filter to only requested + valid source IDs
    const toExtract = sourceIds
      .filter((id) => validSources.has(id))
      .map((id) => validSources.get(id)!);

    if (toExtract.length === 0) {
      return NextResponse.json(
        { ok: false, error: "None of the requested sources belong to this course" },
        { status: 400 },
      );
    }

    // Count active callers for impact warning
    const activeCallerCount = await prisma.caller.count({
      where: {
        enrollments: { some: { playbookId: courseId } },
        archivedAt: null,
      },
    });

    // Fire extractions with concurrency limit
    const limit = pLimit(2);
    const baseUrl = req.nextUrl.origin;
    const cookie = req.headers.get("cookie") || "";

    const results = await Promise.all(
      toExtract.map((src) =>
        limit(async () => {
          try {
            const res = await fetch(
              `${baseUrl}/api/content-sources/${src.sourceId}/extract`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  cookie,
                },
                body: JSON.stringify({
                  subjectId: src.subjectId,
                  replace: true,
                }),
              },
            );
            const data = await res.json();
            return {
              sourceId: src.sourceId,
              name: src.name,
              documentType: src.documentType,
              assertionCount: src.assertionCount,
              jobId: data.ok ? data.jobId : null,
              error: data.ok ? undefined : (data.error as string),
            };
          } catch (err: any) {
            return {
              sourceId: src.sourceId,
              name: src.name,
              documentType: src.documentType,
              assertionCount: src.assertionCount,
              jobId: null,
              error: err.message || "Failed to trigger extraction",
            };
          }
        }),
      ),
    );

    return NextResponse.json(
      {
        ok: true,
        sources: results,
        triggered: results.filter((r) => r.jobId).length,
        total: toExtract.length,
        activeCallerCount,
      },
      { status: 202 },
    );
  } catch (err) {
    console.error("[re-extract] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to trigger re-extraction" },
      { status: 500 },
    );
  }
}
