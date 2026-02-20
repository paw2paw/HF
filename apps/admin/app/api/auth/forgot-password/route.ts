import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { config } from "@/lib/config";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { validateBody, forgotPasswordSchema } from "@/lib/validation";
import { randomBytes } from "crypto";

/**
 * @api POST /api/auth/forgot-password
 * @visibility public
 * @auth none
 * @tags auth
 * @description Request a password reset link. Always returns 200 to prevent email enumeration. Only sends email if user exists and is active.
 * @body email string - User email address (required)
 * @response 200 { ok: true, message: "If an account exists, a reset link has been sent." }
 * @response 400 { ok: false, error: "Email is required" }
 * @response 429 { ok: false, error: "Too many requests" }
 */
export async function POST(request: NextRequest) {
  // Rate limit: 5 attempts per 15 minutes
  const rl = checkRateLimit(getClientIP(request), "forgot-password");
  if (!rl.ok) return rl.error;

  const body = await request.json();
  const v = validateBody(forgotPasswordSchema, body);
  if (!v.ok) return v.error;

  const { email } = v.data;

  try {
    // Find user by email (silently fail if not found to prevent enumeration)
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Only send email if user exists and is active
    if (user && user.isActive) {
      // Generate reset token
      const resetToken = randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store token in database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        },
      });

      // Send email
      const resetUrl = `${config.app.url}/reset-password?token=${resetToken}`;
      try {
        await sendPasswordResetEmail({
          to: user.email,
          resetUrl,
        });
      } catch (emailError) {
        console.error("[Forgot Password] Failed to send reset email:", emailError);
        // Don't fail the request if email fails
      }
    }

    // Always return success (prevent enumeration)
    return NextResponse.json({
      ok: true,
      message: "If an account exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("[Forgot Password] Error:", error);
    return NextResponse.json(
      { ok: false, error: "An error occurred" },
      { status: 500 }
    );
  }
}
