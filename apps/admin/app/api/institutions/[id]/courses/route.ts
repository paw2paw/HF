import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * @api GET /api/institutions/[id]/courses
 * @auth ADMIN
 * @description List all courses (playbooks) belonging to an institution's domains.
 * @response 200 { ok: true, courses: Course[] }
 * @response 404 { ok: false, error: "Institution not found" }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const { id } = await params;

  const institution = await prisma.institution.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!institution) {
    return NextResponse.json({ ok: false, error: "Institution not found" }, { status: 404 });
  }

  const playbooks = await prisma.playbook.findMany({
    where: { domain: { institutionId: id, kind: "INSTITUTION" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      version: true,
      createdAt: true,
      domain: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      _count: { select: { subjects: true, enrollments: true } },
    },
  });

  const courses = playbooks.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    version: p.version,
    domainId: p.domain.id,
    domainName: p.domain.name,
    groupName: p.group?.name ?? null,
    subjectCount: p._count.subjects,
    studentCount: p._count.enrollments,
    createdAt: p.createdAt.toISOString(),
  }));

  return NextResponse.json({ ok: true, courses });
}
