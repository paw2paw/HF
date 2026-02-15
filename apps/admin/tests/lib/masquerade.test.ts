/**
 * Tests for lib/masquerade.ts — server-side masquerade helpers
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Use vi.hoisted so the mock fn is available inside vi.mock factory
const { mockCookieGet } = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookieGet,
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}));

import {
  getMasqueradeState,
  canMasquerade,
  isRoleEscalation,
  getMasqueradeAuditMeta,
  MASQUERADE_COOKIE,
} from "@/lib/masquerade";

describe("masquerade helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("canMasquerade", () => {
    it("returns true for SUPERADMIN", () => {
      expect(canMasquerade("SUPERADMIN")).toBe(true);
    });

    it("returns true for ADMIN", () => {
      expect(canMasquerade("ADMIN")).toBe(true);
    });

    it("returns false for OPERATOR", () => {
      expect(canMasquerade("OPERATOR")).toBe(false);
    });

    it("returns false for EDUCATOR", () => {
      expect(canMasquerade("EDUCATOR")).toBe(false);
    });

    it("returns false for TESTER", () => {
      expect(canMasquerade("TESTER")).toBe(false);
    });

    it("returns false for DEMO", () => {
      expect(canMasquerade("DEMO")).toBe(false);
    });
  });

  describe("isRoleEscalation", () => {
    it("ADMIN → EDUCATOR is not escalation", () => {
      expect(isRoleEscalation("ADMIN", "EDUCATOR")).toBe(false);
    });

    it("ADMIN → OPERATOR is not escalation", () => {
      expect(isRoleEscalation("ADMIN", "OPERATOR")).toBe(false);
    });

    it("ADMIN → SUPERADMIN is escalation", () => {
      expect(isRoleEscalation("ADMIN", "SUPERADMIN")).toBe(true);
    });

    it("SUPERADMIN → ADMIN is not escalation", () => {
      expect(isRoleEscalation("SUPERADMIN", "ADMIN")).toBe(false);
    });

    it("ADMIN → ADMIN is not escalation (equal level)", () => {
      expect(isRoleEscalation("ADMIN", "ADMIN")).toBe(false);
    });

    it("ADMIN → TESTER is not escalation", () => {
      expect(isRoleEscalation("ADMIN", "TESTER")).toBe(false);
    });
  });

  describe("getMasqueradeState", () => {
    it("returns null when no cookie", async () => {
      mockCookieGet.mockReturnValue(undefined);
      const state = await getMasqueradeState();
      expect(state).toBeNull();
    });

    it("returns null for invalid JSON", async () => {
      mockCookieGet.mockReturnValue({ value: "not-json" });
      const state = await getMasqueradeState();
      expect(state).toBeNull();
    });

    it("returns null for missing required fields", async () => {
      mockCookieGet.mockReturnValue({
        value: JSON.stringify({ userId: "abc" }),
      });
      const state = await getMasqueradeState();
      expect(state).toBeNull();
    });

    it("returns valid state from cookie", async () => {
      const expected = {
        userId: "edu-1",
        email: "teacher@school.com",
        name: "Jane Teacher",
        role: "EDUCATOR",
        assignedDomainId: "domain-1",
        startedAt: "2026-02-15T10:00:00Z",
        startedBy: "admin-1",
      };
      mockCookieGet.mockReturnValue({ value: JSON.stringify(expected) });

      const state = await getMasqueradeState();
      expect(state).toEqual(expected);
    });
  });

  describe("getMasqueradeAuditMeta", () => {
    it("returns undefined when not masquerading", async () => {
      mockCookieGet.mockReturnValue(undefined);
      const meta = await getMasqueradeAuditMeta();
      expect(meta).toBeUndefined();
    });

    it("returns audit metadata when masquerading", async () => {
      const state = {
        userId: "edu-1",
        email: "teacher@school.com",
        name: "Jane",
        role: "EDUCATOR",
        assignedDomainId: null,
        startedAt: "2026-02-15T10:00:00Z",
        startedBy: "admin-1",
      };
      mockCookieGet.mockReturnValue({ value: JSON.stringify(state) });

      const meta = await getMasqueradeAuditMeta();
      expect(meta).toEqual({
        masqueradeUserId: "edu-1",
        masqueradeUserEmail: "teacher@school.com",
        masqueradedBy: "admin-1",
      });
    });
  });

  describe("MASQUERADE_COOKIE", () => {
    it("has the expected cookie name", () => {
      expect(MASQUERADE_COOKIE).toBe("hf.masquerade");
    });
  });
});
