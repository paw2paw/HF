/**
 * Shared Zod schemas for API input validation.
 * Used by public-facing routes (invite, join, auth) to validate request bodies.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Reusable atoms
// ---------------------------------------------------------------------------

export const emailSchema = z.string().email("Invalid email address").max(254).trim().toLowerCase();
export const nameSchema = z.string().min(1, "Name is required").max(100).trim();
export const tokenSchema = z.string().min(1, "Token is required").max(256);

// ---------------------------------------------------------------------------
// Route-specific schemas
// ---------------------------------------------------------------------------

/** POST /api/invite/accept */
export const inviteAcceptSchema = z.object({
  token: tokenSchema,
  firstName: nameSchema,
  lastName: nameSchema,
});

/** POST /api/join/[token] */
export const joinPostSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
});

/** POST /api/auth/login (superadmin token auth) */
export const authLoginSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

/** POST /api/auth/forgot-password */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/** POST /api/auth/reset-password */
export const resetPasswordSchema = z.object({
  token: tokenSchema,
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});
