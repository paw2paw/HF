import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError, ROLE_LEVEL } from "@/lib/permissions";
import { requireEducator, isEducatorAuthError } from "@/lib/educator-access";

/**
 * @api GET /api/educator/dashboard
 * @visibility internal
 * @scope educator:read
 * @auth bearer
 * @tags educator, dashboard
 * @query institutionId - Optional institution ID for ADMIN+ users to view a specific school
 * @description Educator dashboard overview with classroom list, aggregate stats (total students, active this week), recent calls, and students needing attention (no calls in 7+ days). ADMIN+ users can pass ?institutionId= to view any school.
 * @response 200 { ok: true, classrooms: [...], stats: { classroomCount, totalStudents, activeThisWeek }, recentCalls: [...], needsAttention: [...] }
 */
export async function GET(request: NextRequest) {
  try {
    const institutionId = request.nextUrl.searchParams.get("institutionId");

    // ADMIN+ with institutionId: view any school's dashboard (all cohorts in that institution)
    if (institutionId) {
      const authResult = await requireAuth("ADMIN");
      if (isAuthError(authResult)) return authResult.error;
      return buildDashboardForInstitution(institutionId);
    }

    // Educator path: scoped to own cohorts (or institution for ADMIN+)
    const auth = await requireEducator();
    if (isEducatorAuthError(auth)) return auth.error;

    // ADMIN+ with educator profile: show all cohorts in their institution
    const role = auth.session.user.role;
    if (ROLE_LEVEL[role] >= ROLE_LEVEL.ADMIN && auth.institutionId) {
      return buildDashboardForInstitution(auth.institutionId);
    }

    return buildDashboardForEducator(auth.callerId);
  } catch (error: any) {
    console.error("[educator/dashboard] GET error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// ── Shared dashboard builder ────────────────────────────────────

function buildCohortFilter(mode: { educatorCallerId: string } | { institutionId: string }) {
  if ("educatorCallerId" in mode) {
    return { ownerId: mode.educatorCallerId, isActive: true };
  }
  return { institutionId: mode.institutionId, isActive: true };
}

async function buildDashboard(cohortWhere: ReturnType<typeof buildCohortFilter>) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [classrooms, totalStudents, activeStudents, recentCalls, needsAttention, cohortPlaybooks] =
    await Promise.all([
      prisma.cohortGroup.findMany({
        where: cohortWhere,
        include: {
          domain: { select: { id: true, name: true, slug: true } },
          owner: { select: { id: true, name: true } },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
      }),

      prisma.caller.count({
        where: {
          cohortGroup: cohortWhere,
          role: "LEARNER",
        },
      }),

      prisma.caller.count({
        where: {
          cohortGroup: cohortWhere,
          role: "LEARNER",
          calls: { some: { createdAt: { gte: sevenDaysAgo } } },
        },
      }),

      prisma.call.findMany({
        where: {
          caller: {
            cohortGroup: cohortWhere,
            role: "LEARNER",
          },
        },
        include: {
          caller: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      prisma.caller.findMany({
        where: {
          cohortGroup: cohortWhere,
          role: "LEARNER",
          OR: [
            { calls: { none: {} } },
            { calls: { every: { createdAt: { lt: sevenDaysAgo } } } },
          ],
        },
        include: {
          cohortGroup: { select: { name: true } },
        },
        take: 10,
      }),

      // Courses: playbooks assigned to educator's cohorts
      prisma.cohortPlaybook.findMany({
        where: { cohortGroup: cohortWhere },
        include: {
          playbook: {
            select: {
              id: true,
              name: true,
              status: true,
              group: { select: { id: true, name: true } },
              subjects: {
                include: { subject: { select: { name: true } } },
              },
              _count: { select: { enrollments: true } },
            },
          },
        },
      }),
    ]);

  // Assessment query is non-critical — degrade gracefully if Goal schema not yet migrated
  let assessmentGoals: { id: string; progress: number; status: string; assessmentConfig: any }[] = [];
  try {
    assessmentGoals = await prisma.goal.findMany({
      where: {
        isAssessmentTarget: true,
        status: { in: ["ACTIVE", "COMPLETED"] },
        caller: {
          cohortGroup: cohortWhere,
          role: "LEARNER",
        },
      },
      select: {
        id: true,
        progress: true,
        status: true,
        assessmentConfig: true,
      },
    });
  } catch (err) {
    console.warn("[educator/dashboard] Assessment goals query failed (migration pending?):", (err as Error).message);
  }

  // Deduplicate playbooks across cohorts, aggregate counts.
  // First pass: group by playbook ID (same playbook in multiple cohorts).
  // Second pass: merge by name (handles duplicate Playbook records with same name).
  const courseById = new Map<string, {
    id: string;
    name: string;
    status: string;
    subjects: string[];
    groupName: string | null;
    groupId: string | null;
    cohortCount: number;
    studentCount: number;
  }>();
  for (const cp of cohortPlaybooks) {
    const pb = cp.playbook;
    const existing = courseById.get(pb.id);
    if (existing) {
      existing.cohortCount++;
    } else {
      courseById.set(pb.id, {
        id: pb.id,
        name: pb.name,
        status: pb.status,
        subjects: pb.subjects.map((s) => s.subject.name),
        groupName: pb.group?.name ?? null,
        groupId: pb.group?.id ?? null,
        cohortCount: 1,
        studentCount: pb._count.enrollments,
      });
    }
  }

  // Merge duplicates by name (keeps the first ID, sums cohort/student counts)
  const courseMap = new Map<string, typeof courseById extends Map<string, infer V> ? V : never>();
  for (const course of courseById.values()) {
    const existing = courseMap.get(course.name);
    if (existing) {
      existing.cohortCount += course.cohortCount;
      existing.studentCount += course.studentCount;
    } else {
      courseMap.set(course.name, { ...course });
    }
  }

  // Count departments and institution branding from first classroom's domain
  const domainId = classrooms[0]?.domain?.id;
  let departmentCount = 0;
  let institution: { name: string; logoUrl: string | null; welcomeMessage: string | null; primaryColor: string | null } | null = null;
  if (domainId) {
    departmentCount = await prisma.playbookGroup.count({
      where: { domainId, isActive: true },
    });
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: {
        institution: {
          select: { name: true, logoUrl: true, welcomeMessage: true, primaryColor: true },
        },
      },
    });
    institution = domain?.institution ?? null;
  }

  return NextResponse.json({
    ok: true,
    institution,
    classrooms: classrooms.map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      owner: c.owner,
      memberCount: c._count.members,
      createdAt: c.createdAt,
    })),
    stats: {
      departmentCount,
      courseCount: courseMap.size,
      classroomCount: classrooms.length,
      totalStudents,
      activeThisWeek: activeStudents,
    },
    courses: Array.from(courseMap.values()),
    recentCalls: recentCalls.map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      studentName: c.caller?.name ?? null,
      studentId: c.caller?.id,
    })),
    needsAttention: needsAttention.map((s) => ({
      id: s.id,
      name: s.name ?? null,
      classroom: s.cohortGroup?.name ?? null,
    })),
    assessmentSummary: (() => {
      if (assessmentGoals.length === 0) return null;
      const thresholdDefault = 0.8;
      let ready = 0;
      const distribution = { low: 0, mid: 0, high: 0, ready: 0 };
      for (const g of assessmentGoals) {
        const threshold = (g.assessmentConfig as any)?.threshold ?? thresholdDefault;
        if (g.status === "COMPLETED" || g.progress >= threshold) {
          ready++;
          distribution.ready++;
        } else if (g.progress >= 0.6) {
          distribution.high++;
        } else if (g.progress >= 0.3) {
          distribution.mid++;
        } else {
          distribution.low++;
        }
      }
      return {
        totalWithTargets: assessmentGoals.length,
        readyCount: ready,
        distribution,
      };
    })(),
  });
}

async function buildDashboardForEducator(callerId: string) {
  return buildDashboard({ ownerId: callerId, isActive: true });
}

async function buildDashboardForInstitution(institutionId: string) {
  return buildDashboard({ institutionId, isActive: true });
}
