import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * @api GET /api/institutions/[id]/classrooms
 * @auth ADMIN
 * @description List all cohort groups (classrooms) belonging to an institution.
 * @response 200 { ok: true, classrooms: Classroom[] }
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

  const cohorts = await prisma.cohortGroup.findMany({
    where: { institutionId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      maxMembers: true,
      createdAt: true,
      domain: { select: { id: true, name: true } },
      playbooks: {
        select: { playbook: { select: { id: true, name: true } } },
        take: 1,
      },
      _count: { select: { members: true } },
    },
  });

  const classrooms = cohorts.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    isActive: c.isActive,
    memberCount: c._count.members,
    maxMembers: c.maxMembers,
    domainId: c.domain.id,
    domainName: c.domain.name,
    primaryCourse: c.playbooks[0]?.playbook ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json({ ok: true, classrooms });
}
