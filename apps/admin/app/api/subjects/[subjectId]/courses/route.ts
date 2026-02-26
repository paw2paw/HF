import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

type Params = { params: Promise<{ subjectId: string }> };

/**
 * @api GET /api/subjects/:subjectId/courses
 * @visibility internal
 * @scope subjects:read
 * @auth session
 * @tags subjects
 * @description List courses (playbooks) that teach this subject via PlaybookSubject.
 * @param subjectId string - Subject ID (path)
 * @response 200 { ok: true, courses: [{id, name, status, domainId, domainName}] }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;

    const playbookSubjects = await prisma.playbookSubject.findMany({
      where: { subjectId },
      include: {
        playbook: {
          select: {
            id: true,
            name: true,
            status: true,
            domain: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const courses = playbookSubjects.map((ps) => ({
      id: ps.playbook.id,
      name: ps.playbook.name,
      status: ps.playbook.status,
      domainId: ps.playbook.domain?.id ?? null,
      domainName: ps.playbook.domain?.name ?? null,
    }));

    return NextResponse.json({ ok: true, courses });
  } catch (error: any) {
    console.error("[subjects/:id/courses] GET error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
