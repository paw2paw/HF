/**
 * @api GET /api/student/module-progress
 * @visibility internal
 * @scope student:read
 * @auth STUDENT (own caller) | OPERATOR+ (with ?callerId=)
 * @description Returns the resolved caller's `CallerModuleProgress` rows joined
 *   with `CurriculumModule` (id, slug, title). Used by the learner module
 *   picker (#242 Slice 3) to derive `completedModuleIds` and
 *   `inProgressModuleIds` for the authenticated learner without a path param.
 *
 *   Mirror of `/api/callers/[callerId]/module-progress` for the student-scoped
 *   path family — STUDENT users have no path callerId, so they fetch via the
 *   session-resolving helper.
 *
 * @response 200 { ok, progress: [{ moduleId, status, completedAt, module: { id, slug, title, sortOrder } }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentOrAdmin, isStudentAuthError } from "@/lib/student-access";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireStudentOrAdmin(request);
  if (isStudentAuthError(auth)) return auth.error;

  const { callerId } = auth;

  const progress = await prisma.callerModuleProgress.findMany({
    where: { callerId },
    include: {
      module: {
        select: {
          id: true,
          slug: true,
          title: true,
          sortOrder: true,
        },
      },
    },
    orderBy: { module: { sortOrder: "asc" } },
  });

  return NextResponse.json({ ok: true, progress });
}
