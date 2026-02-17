/**
 * @api POST /api/student/goals
 * @auth STUDENT | OPERATOR+ (with callerId param)
 * @desc Create a custom learning goal for the student's caller
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentOrAdmin, isStudentAuthError } from "@/lib/student-access";

export async function POST(request: NextRequest) {
  const auth = await requireStudentOrAdmin(request);
  if (isStudentAuthError(auth)) return auth.error;

  const { callerId } = auth;

  const body = await request.json();
  const { name, description, type } = body;

  if (!name?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Goal name is required" },
      { status: 400 }
    );
  }

  const validTypes = ["LEARN", "ACHIEVE", "CHANGE", "CONNECT", "SUPPORT", "CREATE"];
  const goalType = validTypes.includes(type) ? type : "LEARN";

  const goal = await prisma.goal.create({
    data: {
      callerId,
      name: name.trim(),
      description: description?.trim() || null,
      type: goalType,
      status: "ACTIVE",
      progress: 0,
      priority: 5,
    },
    select: {
      id: true,
      name: true,
      type: true,
      progress: true,
      description: true,
    },
  });

  return NextResponse.json({ ok: true, goal });
}
