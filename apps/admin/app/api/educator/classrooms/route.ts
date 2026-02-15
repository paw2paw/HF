import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEducator, isEducatorAuthError } from "@/lib/educator-access";
import { randomUUID } from "crypto";

/**
 * @api GET /api/educator/classrooms
 * @visibility internal
 * @scope educator:read
 * @auth bearer
 * @tags educator, classrooms
 * @description List all classrooms (cohort groups) owned by the educator, including domain info, member counts, and last activity timestamps.
 * @response 200 { ok: true, classrooms: [{ id, name, description, domain, memberCount, maxMembers, isActive, joinToken, lastActivity, createdAt }] }
 */
export async function GET() {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const classrooms = await prisma.cohortGroup.findMany({
    where: { ownerId: auth.callerId },
    include: {
      domain: { select: { id: true, name: true, slug: true } },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get last call date for each classroom
  const classroomIds = classrooms.map((c) => c.id);
  const lastCallByClassroom = await prisma.call.groupBy({
    by: ["callerId"],
    where: {
      caller: { cohortGroupId: { in: classroomIds } },
    },
    _max: { createdAt: true },
  });

  // Map caller IDs to classrooms for last activity
  const callerClassrooms = await prisma.caller.findMany({
    where: { cohortGroupId: { in: classroomIds } },
    select: { id: true, cohortGroupId: true },
  });

  const callerToClassroom = new Map(
    callerClassrooms.map((c) => [c.id, c.cohortGroupId])
  );

  const classroomLastActivity = new Map<string, Date>();
  for (const row of lastCallByClassroom) {
    if (!row.callerId) continue;
    const classroomId = callerToClassroom.get(row.callerId);
    if (classroomId && row._max?.createdAt) {
      const current = classroomLastActivity.get(classroomId);
      if (!current || row._max.createdAt > current) {
        classroomLastActivity.set(classroomId, row._max.createdAt);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    classrooms: classrooms.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      domain: c.domain,
      memberCount: c._count.members,
      maxMembers: c.maxMembers,
      isActive: c.isActive,
      joinToken: c.joinToken,
      lastActivity: classroomLastActivity.get(c.id) ?? null,
      createdAt: c.createdAt,
    })),
  });
}

/**
 * @api POST /api/educator/classrooms
 * @visibility internal
 * @scope educator:write
 * @auth bearer
 * @tags educator, classrooms
 * @description Create a new classroom (cohort group) for the educator. Generates a join token for magic invite links.
 * @body name string - Classroom name (required)
 * @body description string - Optional description
 * @body domainId string - Domain to associate (required)
 * @response 200 { ok: true, classroom: { id, name, description, domain, memberCount, joinToken, createdAt } }
 * @response 400 { ok: false, error: "Classroom name is required" }
 * @response 404 { ok: false, error: "Domain not found" }
 */
export async function POST(request: NextRequest) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const body = await request.json();
  const { name, description, domainId } = body;

  if (!name?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Classroom name is required" },
      { status: 400 }
    );
  }

  if (!domainId) {
    return NextResponse.json(
      { ok: false, error: "Domain is required" },
      { status: 400 }
    );
  }

  // Verify domain exists
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    select: { id: true, name: true },
  });

  if (!domain) {
    return NextResponse.json(
      { ok: false, error: "Domain not found" },
      { status: 404 }
    );
  }

  // Generate a join token for magic invite links
  const joinToken = randomUUID().replace(/-/g, "").slice(0, 12);

  const classroom = await prisma.cohortGroup.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      domainId,
      ownerId: auth.callerId,
      joinToken,
      institutionId: auth.institutionId,
    },
    include: {
      domain: { select: { id: true, name: true, slug: true } },
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    classroom: {
      id: classroom.id,
      name: classroom.name,
      description: classroom.description,
      domain: classroom.domain,
      memberCount: classroom._count.members,
      joinToken: classroom.joinToken,
      createdAt: classroom.createdAt,
    },
  });
}
