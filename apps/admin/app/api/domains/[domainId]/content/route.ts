import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api DELETE /api/domains/:domainId/content
 * @visibility internal
 * @scope content:delete
 * @auth session (SUPERADMIN)
 * @tags content, domains
 * @description Bulk archive or permanently delete all content sources linked to a domain.
 *              Sources are found via SubjectSource → Subject → SubjectDomain chain.
 * @pathParam domainId string - The domain ID
 * @query permanent string - "true" to permanently delete (default: archive only)
 * @query dryRun string - "true" to preview what would be affected without making changes
 * @response 200 { ok: true, action, count, sources: [...] }
 * @response 404 { error: "Domain not found" }
 * @response 500 { error: "..." }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const authResult = await requireAuth("SUPERADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const { domainId } = await params;
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") === "true";
    const dryRun = searchParams.get("dryRun") === "true";

    // Verify domain exists
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { id: true, name: true },
    });
    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    // Find all ContentSources linked to this domain via Subject → SubjectDomain
    const sources = await prisma.contentSource.findMany({
      where: {
        subjects: {
          some: {
            subject: {
              domains: { some: { domainId } },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        _count: { select: { assertions: true, questions: true, vocabulary: true } },
      },
    });

    const summary = sources.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      isActive: s.isActive,
      assertions: s._count.assertions,
      questions: s._count.questions,
      vocabulary: s._count.vocabulary,
    }));

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        action: "dry_run",
        domain: { id: domain.id, name: domain.name },
        count: sources.length,
        sources: summary,
      });
    }

    const sourceIds = sources.map((s) => s.id);

    if (sourceIds.length === 0) {
      return NextResponse.json({
        ok: true,
        action: "none",
        message: "No content sources linked to this domain",
        count: 0,
        sources: [],
      });
    }

    if (permanent) {
      // Hard delete — Prisma cascade handles assertions/questions/vocabulary
      await prisma.contentSource.deleteMany({
        where: { id: { in: sourceIds } },
      });
    } else {
      // Soft archive
      await prisma.contentSource.updateMany({
        where: { id: { in: sourceIds } },
        data: { isActive: false, archivedAt: new Date() },
      });
    }

    return NextResponse.json({
      ok: true,
      action: permanent ? "permanent_delete" : "archive",
      domain: { id: domain.id, name: domain.name },
      count: sourceIds.length,
      sources: summary,
    });
  } catch (error: any) {
    console.error("[domains/content] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
