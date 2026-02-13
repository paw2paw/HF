import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * @api POST /api/sim/setup
 * @visibility internal
 * @auth session
 * @tags sim
 * @description Creates a Caller record linked to the authenticated user in the specified domain. Used on first sim access.
 * @body domainId string - Domain to create caller in (required)
 * @response 200 { ok: true, caller: { id, name, domainId } }
 * @response 400 { ok: false, error: "..." }
 * @response 401 { ok: false, error: "Unauthorized" }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

  const body = await request.json();
  const { domainId } = body;

  if (!domainId) {
    return NextResponse.json(
      { ok: false, error: "Domain ID is required" },
      { status: 400 }
    );
  }

  // Verify domain exists
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
  });

  if (!domain) {
    return NextResponse.json(
      { ok: false, error: "Invalid domain" },
      { status: 400 }
    );
  }

  // Check if caller already exists for this user
  const existingCaller = await prisma.caller.findFirst({
    where: { userId: session.user.id },
  });

  if (existingCaller) {
    // Already set up — return existing caller
    return NextResponse.json({
      ok: true,
      caller: {
        id: existingCaller.id,
        name: existingCaller.name,
        domainId: existingCaller.domainId,
      },
    });
  }

  // Create caller linked to user
  const caller = await prisma.caller.create({
    data: {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name || "Tester",
      domainId,
      externalId: `sim-${session.user.id}`,
    },
  });

  return NextResponse.json({
    ok: true,
    caller: {
      id: caller.id,
      name: caller.name,
      domainId: caller.domainId,
    },
  });
}
