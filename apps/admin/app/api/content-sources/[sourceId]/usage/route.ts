import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/content-sources/:sourceId/usage
 * @visibility internal
 * @scope content-sources:read
 * @auth session
 * @tags content-trust
 * @description Get usage/dependency info for a content source: linked subjects, domains
 * (with caller counts), curricula, and content stats.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { sourceId } = await params;

    const source = await prisma.contentSource.findUnique({
      where: { id: sourceId },
      include: {
        subjects: {
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                slug: true,
                domains: {
                  include: {
                    domain: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                        _count: { select: { callers: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        curricula: { select: { id: true, slug: true, name: true } },
        _count: { select: { assertions: true, questions: true, vocabulary: true, mediaAssets: true } },
      },
    });

    if (!source) {
      return NextResponse.json({ ok: false, error: "Source not found" }, { status: 404 });
    }

    // Flatten subjects
    const subjects = source.subjects.map((ss) => ({
      id: ss.subject.id,
      name: ss.subject.name,
      slug: ss.subject.slug,
    }));

    // Collect unique domains with caller counts
    const domainMap = new Map<string, { id: string; name: string; slug: string; callerCount: number }>();
    for (const ss of source.subjects) {
      for (const sd of ss.subject.domains) {
        if (!domainMap.has(sd.domain.id)) {
          domainMap.set(sd.domain.id, {
            id: sd.domain.id,
            name: sd.domain.name,
            slug: sd.domain.slug,
            callerCount: sd.domain._count.callers,
          });
        }
      }
    }
    const domains = [...domainMap.values()];

    const totalCallerReach = domains.reduce((sum, d) => sum + d.callerCount, 0);

    return NextResponse.json({
      ok: true,
      usage: {
        subjects,
        domains,
        curricula: source.curricula,
        totalCallerReach,
        contentStats: {
          assertions: source._count.assertions,
          questions: source._count.questions,
          vocabulary: source._count.vocabulary,
          mediaAssets: source._count.mediaAssets,
        },
      },
    });
  } catch (error: any) {
    console.error("[content-sources/:id/usage] GET error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
