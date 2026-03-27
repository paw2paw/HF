import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * @api GET /api/playbook-groups/:id/subjects
 * @visibility internal
 * @scope groups:read
 * @auth bearer
 * @tags groups, departments, subjects
 * @description List subjects linked to a department/group, with course counts.
 * @response 200 { ok: true, subjects: [...] }
 * @response 404 { ok: false, error: "Group not found" }
 */
export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  const { id } = await context.params;

  const group = await prisma.playbookGroup.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!group) {
    return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });
  }

  const links = await prisma.playbookGroupSubject.findMany({
    where: { groupId: id },
    select: {
      subjectId: true,
      sortOrder: true,
      subject: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          qualificationBody: true,
          qualificationLevel: true,
          _count: {
            select: {
              playbooks: { where: { playbook: { groupId: id } } },
              curricula: true,
            },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    ok: true,
    subjects: links.map((l) => ({
      ...l.subject,
      sortOrder: l.sortOrder,
      courseCount: l.subject._count.playbooks,
      curriculumCount: l.subject._count.curricula,
    })),
  });
}

/**
 * @api POST /api/playbook-groups/:id/subjects
 * @visibility internal
 * @scope groups:write
 * @auth bearer
 * @tags groups, departments, subjects
 * @body subjectId string - Subject ID to link
 * @body sortOrder number? - Sort order (default 0)
 * @description Link a subject to a department/group.
 * @response 200 { ok: true, link: {...} }
 * @response 404 { ok: false, error: "Group not found" }
 * @response 409 { ok: false, error: "Subject already linked" }
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  const { id } = await context.params;
  const body = await request.json();
  const { subjectId, sortOrder = 0 } = body;

  if (!subjectId) {
    return NextResponse.json({ ok: false, error: "subjectId is required" }, { status: 400 });
  }

  const group = await prisma.playbookGroup.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!group) {
    return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });
  }

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, name: true },
  });
  if (!subject) {
    return NextResponse.json({ ok: false, error: "Subject not found" }, { status: 404 });
  }

  const existing = await prisma.playbookGroupSubject.findUnique({
    where: { groupId_subjectId: { groupId: id, subjectId } },
  });
  if (existing) {
    return NextResponse.json({ ok: false, error: "Subject already linked to this group" }, { status: 409 });
  }

  const link = await prisma.playbookGroupSubject.create({
    data: { groupId: id, subjectId, sortOrder },
  });

  return NextResponse.json({ ok: true, link });
}

/**
 * @api DELETE /api/playbook-groups/:id/subjects
 * @visibility internal
 * @scope groups:write
 * @auth bearer
 * @tags groups, departments, subjects
 * @body subjectId string - Subject ID to unlink
 * @description Remove a subject from a department/group.
 * @response 200 { ok: true, removed: true }
 * @response 404 { ok: false, error: "Link not found" }
 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  const { id } = await context.params;
  const body = await request.json();
  const { subjectId } = body;

  if (!subjectId) {
    return NextResponse.json({ ok: false, error: "subjectId is required" }, { status: 400 });
  }

  const existing = await prisma.playbookGroupSubject.findUnique({
    where: { groupId_subjectId: { groupId: id, subjectId } },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Link not found" }, { status: 404 });
  }

  await prisma.playbookGroupSubject.delete({
    where: { groupId_subjectId: { groupId: id, subjectId } },
  });

  return NextResponse.json({ ok: true, removed: true });
}
