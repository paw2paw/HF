import { requireAuth, isAuthError } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ courseId: string }> };

type LearnerEntry =
  | {
      type: 'enrolled';
      callerId: string;
      name: string | null;
      email: string | null;
      joinedAt: Date;
      callCount: number;
      lastCallAt: Date | null;
      status: 'active' | 'joined';
    }
  | {
      type: 'invited';
      inviteId: string;
      email: string;
      invitedAt: Date;
      status: 'invited';
    };

/**
 * @api GET /api/courses/[courseId]/learners
 * @desc Learner roster for a course — enrolled callers + pending invites + summary stats
 * @auth OPERATOR+
 * @returns {object} { ok, cohortId, joinToken, learners, summary }
 */
export async function GET(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  const auth = await requireAuth('OPERATOR');
  if (isAuthError(auth)) return auth.error;

  const { courseId } = await params;

  try {
    // Find the course's default cohort (earliest created)
    const cohort = await prisma.cohortGroup.findFirst({
      where: { playbooks: { some: { playbookId: courseId } } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, joinToken: true },
    });

    if (!cohort) {
      return NextResponse.json({
        ok: true,
        cohortId: null,
        joinToken: null,
        learners: [],
        summary: { enrolled: 0, active: 0, totalCalls: 0, goalRate: 0 },
      });
    }

    // Fetch enrolled callers + pending invites in parallel
    const [members, invites] = await Promise.all([
      prisma.callerCohortMembership.findMany({
        where: { cohortGroupId: cohort.id },
        include: {
          caller: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
              _count: { select: { calls: true } },
              calls: {
                select: { createdAt: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.invite.findMany({
        where: {
          cohortGroupId: cohort.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, email: true, createdAt: true },
      }),
    ]);

    // Build unified learners array
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const enrolledLearners: LearnerEntry[] = members.map((m) => {
      const callCount = m.caller._count.calls;
      const lastCallAt = m.caller.calls[0]?.createdAt ?? null;
      return {
        type: 'enrolled' as const,
        callerId: m.caller.id,
        name: m.caller.name,
        email: m.caller.email,
        joinedAt: m.joinedAt,
        callCount,
        lastCallAt,
        status: callCount > 0 ? ('active' as const) : ('joined' as const),
      };
    });

    const invitedLearners: LearnerEntry[] = invites.map((inv) => ({
      type: 'invited' as const,
      inviteId: inv.id,
      email: inv.email,
      invitedAt: inv.createdAt,
      status: 'invited' as const,
    }));

    // Sort: active first, then joined, then invited
    const statusOrder: Record<string, number> = { active: 0, joined: 1, invited: 2 };
    const learners = [...enrolledLearners, ...invitedLearners].sort(
      (a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    );

    // Compute summary
    const activeCount = enrolledLearners.filter(
      (l) => l.type === 'enrolled' && l.lastCallAt && l.lastCallAt > sevenDaysAgo
    ).length;
    const totalCalls = enrolledLearners.reduce(
      (sum, l) => sum + (l.type === 'enrolled' ? l.callCount : 0),
      0
    );

    return NextResponse.json({
      ok: true,
      cohortId: cohort.id,
      joinToken: cohort.joinToken,
      learners,
      summary: {
        enrolled: members.length,
        active: activeCount,
        totalCalls,
        goalRate: 0, // Enrich later with Goal progress query
      },
    });
  } catch (err) {
    console.error('[GET /api/courses/[courseId]/learners]', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch learners' },
      { status: 500 }
    );
  }
}
