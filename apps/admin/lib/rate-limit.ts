/**
 * Simple in-memory rate limiter for auth endpoints.
 *
 * Follows the requireAuth()/isAuthError() call pattern:
 *   const rl = checkRateLimit(getClientIP(request), "auth");
 *   if (!rl.ok) return rl.error;
 *
 * Limitations:
 * - In-memory: resets on container restart, not shared across instances
 * - Acceptable for market test (100 users). Upgrade path: Redis backend.
 */

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Configuration (env-overridable)
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || "5", 10);
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const attempts = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup to prevent memory leaks (every 60s)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of attempts) {
      if (val.resetAt < now) attempts.delete(key);
    }
  }, 60_000).unref?.();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

type RateLimitOk = { ok: true };
type RateLimitBlocked = { ok: false; error: NextResponse; retryAfter: number };

/**
 * Extract client IP from request headers.
 * Cloud Run reliably sets x-forwarded-for from its load balancer.
 */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Check rate limit for a given IP + key combination.
 * Returns { ok: true } or { ok: false, error: NextResponse } with 429 + Retry-After.
 */
export function checkRateLimit(
  ip: string,
  key = "default",
): RateLimitOk | RateLimitBlocked {
  const compositeKey = `${key}:${ip}`;
  const now = Date.now();
  const existing = attempts.get(compositeKey);

  if (!existing || existing.resetAt < now) {
    attempts.set(compositeKey, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  existing.count++;

  if (existing.count > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    return {
      ok: false,
      retryAfter,
      error: NextResponse.json(
        { ok: false, error: "Too many attempts. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      ),
    };
  }

  return { ok: true };
}

/**
 * Reset rate limit for an IP + key (call on successful auth).
 */
export function resetRateLimit(ip: string, key = "default"): void {
  attempts.delete(`${key}:${ip}`);
}

/** Visible for testing */
export function _clearAllForTesting(): void {
  attempts.clear();
}
