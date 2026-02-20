import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * @api GET /api/auth/verify-reset-token
 * @visibility public
 * @auth none
 * @tags auth
 * @description Verify that a password reset token is valid and not expired. Used by reset-password page to show form or error state.
 * @query token string - Reset token (required)
 * @response 200 { ok: true, email: "user@example.com" }
 * @response 400 { ok: false, error: "Invalid or expired reset link" }
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Reset token is required" },
      { status: 400 }
    );
  }

  try {
    // Find user by reset token and check expiry
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
      select: { id: true, email: true, passwordResetExpires: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      email: user.email,
    });
  } catch (error) {
    console.error("[Verify Reset Token] Error:", error);
    return NextResponse.json(
      { ok: false, error: "An error occurred" },
      { status: 500 }
    );
  }
}
