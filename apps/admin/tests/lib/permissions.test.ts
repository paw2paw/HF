/**
 * Tests for lib/permissions.ts — Role-Based Access Control
 *
 * Tests the requireAuth() helper and isAuthError() type guard
 * that protect all 139 API route files (370 total calls).
 *
 * Role hierarchy: ADMIN(3) > OPERATOR(2) > VIEWER(1)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// =====================================================
// MOCK SETUP
// =====================================================

// Override global setup.ts mock — this test needs the REAL permissions module
vi.unmock("@/lib/permissions");

const mockAuth = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: (...args: any[]) => mockAuth(...args),
}));

// =====================================================
// HELPERS
// =====================================================

function makeSession(role: string) {
  return {
    expires: new Date(Date.now() + 86400000).toISOString(),
    user: {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      image: null,
      role,
    },
  };
}

// =====================================================
// TESTS
// =====================================================

describe("lib/permissions", () => {
  let requireAuth: typeof import("@/lib/permissions").requireAuth;
  let isAuthError: typeof import("@/lib/permissions").isAuthError;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamic import so mocks are applied
    const mod = await import("@/lib/permissions");
    requireAuth = mod.requireAuth;
    isAuthError = mod.isAuthError;
  });

  // -------------------------------------------------
  // requireAuth — unauthenticated
  // -------------------------------------------------

  describe("requireAuth — unauthenticated", () => {
    it("returns 401 when auth() returns null (no session)", async () => {
      mockAuth.mockResolvedValue(null);

      const result = await requireAuth("VIEWER");

      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        const body = await result.error.json();
        expect(body.error).toBe("Unauthorized");
      }
    });

    it("returns 401 when session has no user", async () => {
      mockAuth.mockResolvedValue({ user: null });

      const result = await requireAuth("VIEWER");

      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        const body = await result.error.json();
        expect(body.error).toBe("Unauthorized");
      }
    });

    it("returns 401 when auth() throws an error", async () => {
      mockAuth.mockRejectedValue(new Error("JWT expired"));

      const result = await requireAuth("VIEWER");

      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        const body = await result.error.json();
        expect(body.error).toBe("Unauthorized");
      }
    });
  });

  // -------------------------------------------------
  // requireAuth — role hierarchy
  // -------------------------------------------------

  describe("requireAuth — role hierarchy", () => {
    it("ADMIN can access ADMIN-protected routes", async () => {
      mockAuth.mockResolvedValue(makeSession("ADMIN"));

      const result = await requireAuth("ADMIN");

      expect(isAuthError(result)).toBe(false);
      if (!isAuthError(result)) {
        expect(result.session.user.role).toBe("ADMIN");
      }
    });

    it("ADMIN can access OPERATOR-protected routes", async () => {
      mockAuth.mockResolvedValue(makeSession("ADMIN"));

      const result = await requireAuth("OPERATOR");

      expect(isAuthError(result)).toBe(false);
    });

    it("ADMIN can access VIEWER-protected routes", async () => {
      mockAuth.mockResolvedValue(makeSession("ADMIN"));

      const result = await requireAuth("VIEWER");

      expect(isAuthError(result)).toBe(false);
    });

    it("OPERATOR can access OPERATOR-protected routes", async () => {
      mockAuth.mockResolvedValue(makeSession("OPERATOR"));

      const result = await requireAuth("OPERATOR");

      expect(isAuthError(result)).toBe(false);
    });

    it("OPERATOR can access VIEWER-protected routes", async () => {
      mockAuth.mockResolvedValue(makeSession("OPERATOR"));

      const result = await requireAuth("VIEWER");

      expect(isAuthError(result)).toBe(false);
    });

    it("OPERATOR cannot access ADMIN-protected routes", async () => {
      mockAuth.mockResolvedValue(makeSession("OPERATOR"));

      const result = await requireAuth("ADMIN");

      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        const body = await result.error.json();
        expect(body.error).toBe("Forbidden");
      }
    });

    it("VIEWER can access VIEWER-protected routes", async () => {
      mockAuth.mockResolvedValue(makeSession("VIEWER"));

      const result = await requireAuth("VIEWER");

      expect(isAuthError(result)).toBe(false);
    });

    it("VIEWER cannot access OPERATOR-protected routes", async () => {
      mockAuth.mockResolvedValue(makeSession("VIEWER"));

      const result = await requireAuth("OPERATOR");

      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        const body = await result.error.json();
        expect(body.error).toBe("Forbidden");
      }
    });

    it("VIEWER cannot access ADMIN-protected routes", async () => {
      mockAuth.mockResolvedValue(makeSession("VIEWER"));

      const result = await requireAuth("ADMIN");

      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        const body = await result.error.json();
        expect(body.error).toBe("Forbidden");
      }
    });
  });

  // -------------------------------------------------
  // requireAuth — defaults
  // -------------------------------------------------

  describe("requireAuth — default role", () => {
    it("defaults to VIEWER when no minRole specified", async () => {
      mockAuth.mockResolvedValue(makeSession("VIEWER"));

      const result = await requireAuth();

      expect(isAuthError(result)).toBe(false);
    });
  });

  // -------------------------------------------------
  // requireAuth — unknown roles
  // -------------------------------------------------

  describe("requireAuth — edge cases", () => {
    it("returns 403 for unknown user role (level defaults to 0)", async () => {
      mockAuth.mockResolvedValue(makeSession("UNKNOWN_ROLE"));

      const result = await requireAuth("VIEWER");

      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        const body = await result.error.json();
        expect(body.error).toBe("Forbidden");
      }
    });

    it("returns session data on success", async () => {
      mockAuth.mockResolvedValue(makeSession("ADMIN"));

      const result = await requireAuth("ADMIN");

      expect(isAuthError(result)).toBe(false);
      if (!isAuthError(result)) {
        expect(result.session.user.id).toBe("user-1");
        expect(result.session.user.email).toBe("test@example.com");
        expect(result.session.user.role).toBe("ADMIN");
      }
    });
  });

  // -------------------------------------------------
  // isAuthError type guard
  // -------------------------------------------------

  describe("isAuthError", () => {
    it("returns true for error results", () => {
      const failure = {
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
      expect(isAuthError(failure)).toBe(true);
    });

    it("returns false for success results", () => {
      const success = { session: makeSession("ADMIN") } as { session: any };
      expect(isAuthError(success as any)).toBe(false);
    });
  });
});
