/**
 * @api GET /api/goals/:goalId
 * @visibility public
 * @scope goals:read
 * @auth session
 * @tags goals
 * @description Fetch a single goal with related caller, playbook, and content spec data.
 * @pathParam goalId string - The goal ID
 * @response 200 { ok: true, goal: Goal }
 * @response 404 { ok: false, error: string }
 */

/**
 * @api PATCH /api/goals/:goalId
 * @visibility public
 * @scope goals:write
 * @auth session
 * @tags goals
 * @description Update a goal (name, description, type, status, priority, targetDate).
 * @pathParam goalId string - The goal ID
 * @body { name?, description?, type?, status?, priority?, targetDate? }
 * @response 200 { ok: true, goal: Goal }
 * @response 400 { ok: false, error: string }
 * @response 404 { ok: false, error: string }
 */

/**
 * @api DELETE /api/goals/:goalId
 * @visibility public
 * @scope goals:write
 * @auth session
 * @tags goals
 * @description Delete a goal.
 * @pathParam goalId string - The goal ID
 * @response 200 { ok: true }
 * @response 404 { ok: false, error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { GoalType, GoalStatus } from "@prisma/client";

const goalInclude = {
  caller: {
    select: {
      id: true,
      name: true,
      domain: { select: { id: true, slug: true, name: true } },
    },
  },
  playbook: {
    select: { id: true, name: true, version: true },
  },
  contentSpec: {
    select: { id: true, slug: true, name: true },
  },
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;

  const { goalId } = await params;

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: goalInclude,
  });

  if (!goal) {
    return NextResponse.json(
      { ok: false, error: "Goal not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, goal });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  const { goalId } = await params;

  const existing = await prisma.goal.findUnique({
    where: { id: goalId },
  });

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Goal not found" },
      { status: 404 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const update: any = {};

  if (body.name !== undefined) {
    if (!body.name?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Goal name cannot be empty" },
        { status: 400 }
      );
    }
    update.name = body.name.trim();
  }

  if (body.description !== undefined) {
    update.description = body.description?.trim() || null;
  }

  if (body.type !== undefined) {
    if (!Object.values(GoalType).includes(body.type)) {
      return NextResponse.json(
        { ok: false, error: `Invalid type. Must be one of: ${Object.values(GoalType).join(", ")}` },
        { status: 400 }
      );
    }
    update.type = body.type;
  }

  if (body.status !== undefined) {
    if (!Object.values(GoalStatus).includes(body.status)) {
      return NextResponse.json(
        { ok: false, error: `Invalid status. Must be one of: ${Object.values(GoalStatus).join(", ")}` },
        { status: 400 }
      );
    }
    update.status = body.status;
    if (body.status === "COMPLETED") {
      update.completedAt = new Date();
    }
    if (body.status === "ACTIVE" && existing.status !== "ACTIVE") {
      update.startedAt = update.startedAt ?? existing.startedAt ?? new Date();
      update.completedAt = null;
    }
  }

  if (body.priority !== undefined) {
    const p = Number(body.priority);
    if (isNaN(p) || p < 1 || p > 10) {
      return NextResponse.json(
        { ok: false, error: "Priority must be between 1 and 10" },
        { status: 400 }
      );
    }
    update.priority = p;
  }

  if (body.targetDate !== undefined) {
    update.targetDate = body.targetDate ? new Date(body.targetDate) : null;
  }

  const goal = await prisma.goal.update({
    where: { id: goalId },
    data: update,
    include: goalInclude,
  });

  return NextResponse.json({ ok: true, goal });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  const { goalId } = await params;

  const existing = await prisma.goal.findUnique({
    where: { id: goalId },
  });

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Goal not found" },
      { status: 404 }
    );
  }

  await prisma.goal.delete({ where: { id: goalId } });

  return NextResponse.json({ ok: true });
}
