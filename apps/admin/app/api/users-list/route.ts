import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/users-list
 * @visibility internal
 * @scope users:list
 * @auth session
 * @tags users
 * @description Returns active admin users for dropdown selection (assignee, recipient, etc.). Requires authenticated session.
 * @response 200 { ok: true, users: [{ id, name, email, image }], debug: { total, active } }
 * @response 401 { ok: false, error: "Unauthorized" }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;
    const { session } = authResult;

    console.log("[users-list] Fetching users for session:", session.user.email);

    // First, get ALL users to debug
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        isActive: true,
      },
    });

    console.log("[users-list] Total users in DB:", allUsers.length);
    console.log("[users-list] All users:", allUsers);

    // Then filter active ones
    const activeUsers = allUsers.filter(u => u.isActive);
    console.log("[users-list] Active users:", activeUsers.length);

    // Return without isActive field (not needed in response)
    const users = activeUsers.map(({ isActive, ...user }) => user);

    return NextResponse.json({
      ok: true,
      users,
      debug: {
        total: allUsers.length,
        active: activeUsers.length,
      }
    });
  } catch (error) {
    console.error("GET /api/users-list error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
