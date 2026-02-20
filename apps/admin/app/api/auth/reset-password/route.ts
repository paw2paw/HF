import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { validateBody, resetPasswordSchema } from "@/lib/validation";
import { hash } from "bcrypt";

/**
 * @api POST /api/auth/reset-password
 * @visibility public
 * @auth none
 * @tags auth
 * @description Reset a user's password using a valid reset token. Hashes the new password with bcrypt.
 * @body token string - Valid password reset token (required)
 * @body password string - New password, min 8 chars (required)
 * @response 200 { ok: true }
 * @response 400 { ok: false, error: "Invalid or expired reset link" | "Password is required" }
 * @response 429 { ok: false, error: "Too many requests" }
 * @response 500 { ok: false, error: "An error occurred" }
 */
export async function POST(request: NextRequest) {
  // Rate limit: 5 attempts per 15 minutes
  const rl = checkRateLimit(getClientIP(request), "reset-password");
  if (!rl.ok) return rl.error;

  const body = await request.json();
  const v = validateBody(resetPasswordSchema, body);
  if (!v.ok) return v.error;

  const { token, password } = v.data;

  try {
    // Find user by reset token
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
      select: { id: true, passwordResetExpires: true },
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

    // Hash the new password
    const hashedPassword = await hash(password, 12);

    // Update user with new password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("[Reset Password] Error:", error);
    return NextResponse.json(
      { ok: false, error: "An error occurred" },
      { status: 500 }
    );
  }
}
