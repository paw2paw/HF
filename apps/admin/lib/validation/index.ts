/**
 * Validation helpers for API route handlers.
 * Mirrors the requireAuth()/isAuthError() pattern.
 *
 * Usage:
 *   const v = validateBody(inviteAcceptSchema, body);
 *   if (!v.ok) return v.error;
 *   const { token, firstName, lastName } = v.data;
 */

import { NextResponse } from "next/server";
import { type ZodSchema, ZodError } from "zod";

type ValidationSuccess<T> = { ok: true; data: T };
type ValidationFailure = { ok: false; error: NextResponse };

export function validateBody<T>(
  schema: ZodSchema<T>,
  body: unknown,
): ValidationSuccess<T> | ValidationFailure {
  try {
    const data = schema.parse(body);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ok: false,
        error: NextResponse.json(
          {
            ok: false,
            error: "Invalid request",
            details: err.issues.map((e) => e.message),
          },
          { status: 400 },
        ),
      };
    }
    throw err;
  }
}

export function validateQuery<T>(
  schema: ZodSchema<T>,
  params: Record<string, string | null>,
): ValidationSuccess<T> | ValidationFailure {
  // Convert null values to undefined for Zod
  const cleaned: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    cleaned[key] = value ?? undefined;
  }
  return validateBody(schema, cleaned);
}

// Re-export schemas for convenience
export * from "./schemas";
