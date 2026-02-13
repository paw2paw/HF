/**
 * Role-Based Access Control
 *
 * Provides requireAuth() helper for API route handlers.
 * Role hierarchy: ADMIN > OPERATOR > VIEWER
 *
 * Usage:
 *   const authResult = await requireAuth("OPERATOR");
 *   if (isAuthError(authResult)) return authResult.error;
 *   const { session } = authResult;
 */

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import type { Session } from "next-auth";

// Role hierarchy: higher number = more access
const ROLE_LEVEL: Record<UserRole, number> = {
  ADMIN: 3,
  OPERATOR: 2,
  VIEWER: 1,
};

type AuthSuccess = { session: Session };
type AuthFailure = { error: NextResponse };
type AuthResult = AuthSuccess | AuthFailure;

/**
 * Require authentication with minimum role.
 * Returns session on success, or a NextResponse error on failure.
 */
export async function requireAuth(minRole: UserRole = "VIEWER"): Promise<AuthResult> {
  let session;
  try {
    session = await auth();
  } catch (e) {
    console.error("[requireAuth] auth() threw:", (e as Error).message);
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const userLevel = ROLE_LEVEL[session.user.role] ?? 0;
  const requiredLevel = ROLE_LEVEL[minRole] ?? 0;

  if (userLevel < requiredLevel) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { session };
}

/**
 * Type guard: check if result is an auth error response.
 */
export function isAuthError(result: AuthResult): result is AuthFailure {
  return "error" in result;
}
