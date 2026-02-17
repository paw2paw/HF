/**
 * Tests for GET /api/system/ini route handler
 *
 * Tests auth enforcement and response structure.
 * The check logic itself is tested in tests/api/system-ini.test.ts.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// =====================================================
// MOCK SETUP — vi.hoisted ensures these are available to vi.mock factories
// =====================================================

const { mockRunIniChecks, mockRequireAuth, mockIsAuthError } = vi.hoisted(() => ({
  mockRunIniChecks: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockIsAuthError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/permissions", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
  isAuthError: (...args: any[]) => mockIsAuthError(...args),
}));

vi.mock("@/lib/system-ini", () => ({
  runIniChecks: () => mockRunIniChecks(),
}));

import { GET } from "@/app/api/system/ini/route";

// =====================================================
// Test Data
// =====================================================

const mockHealthyResult = {
  ok: true,
  status: "green",
  summary: { pass: 10, warn: 0, fail: 0, total: 10 },
  checks: {
    env_vars: { status: "pass", label: "Environment Variables", message: "All required set", severity: "critical" },
    database: { status: "pass", label: "Database", message: "Connected", severity: "critical" },
    canonical_specs: { status: "pass", label: "Canonical Specs", message: "All active", severity: "critical" },
    domains: { status: "pass", label: "Domains", message: "2 active", severity: "recommended" },
    contracts: { status: "pass", label: "Contracts", message: "3/3 loaded", severity: "recommended" },
    admin_user: { status: "pass", label: "Admin User", message: "1 admin(s)", severity: "critical" },
    parameters: { status: "pass", label: "Parameters", message: "200 parameters", severity: "critical" },
    ai_services: { status: "pass", label: "AI Services", message: "OpenAI configured", severity: "recommended" },
    vapi: { status: "pass", label: "VAPI", message: "Configured", severity: "optional" },
    storage: { status: "pass", label: "Storage", message: "Local storage", severity: "optional" },
  },
  timestamp: new Date().toISOString(),
};

// =====================================================
// TESTS
// =====================================================

describe("GET /api/system/ini", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: SUPERADMIN session
    mockRequireAuth.mockResolvedValue({
      session: {
        user: { id: "sa-1", email: "sa@test.com", name: "Super Admin", role: "SUPERADMIN", image: null },
        expires: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    mockIsAuthError.mockReturnValue(false);
    mockRunIniChecks.mockResolvedValue(mockHealthyResult);
  });

  it("requires SUPERADMIN auth", async () => {
    await GET();

    expect(mockRequireAuth).toHaveBeenCalledWith("SUPERADMIN");
  });

  it("returns 401 for non-SUPERADMIN", async () => {
    const authError = Response.json({ error: "Unauthorized" }, { status: 401 });
    mockRequireAuth.mockResolvedValue({ error: authError });
    mockIsAuthError.mockReturnValue(true);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockRunIniChecks).not.toHaveBeenCalled();
  });

  it("returns structured check results for SUPERADMIN", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("green");
    expect(body.summary.total).toBe(10);
    expect(Object.keys(body.checks)).toHaveLength(10);
  });

  it("returns all 10 check keys", async () => {
    const res = await GET();
    const body = await res.json();

    const expectedKeys = [
      "env_vars", "database", "canonical_specs", "domains",
      "contracts", "admin_user", "parameters", "ai_services",
      "vapi", "storage",
    ];
    expect(Object.keys(body.checks).sort()).toEqual(expectedKeys.sort());
  });

  it("each check includes required fields", async () => {
    const res = await GET();
    const body = await res.json();

    for (const [key, check] of Object.entries(body.checks) as [string, any][]) {
      expect(check.status).toBeDefined();
      expect(check.label).toBeDefined();
      expect(check.message).toBeDefined();
      expect(check.severity).toBeDefined();
      expect(["pass", "warn", "fail"]).toContain(check.status);
      expect(["critical", "recommended", "optional"]).toContain(check.severity);
    }
  });

  it("includes timestamp in response", async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it("propagates red status from checks", async () => {
    mockRunIniChecks.mockResolvedValue({
      ...mockHealthyResult,
      status: "red",
      summary: { pass: 8, warn: 0, fail: 2, total: 10 },
    });

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe("red");
    expect(body.summary.fail).toBe(2);
  });

  it("propagates amber status from checks", async () => {
    mockRunIniChecks.mockResolvedValue({
      ...mockHealthyResult,
      status: "amber",
      summary: { pass: 8, warn: 2, fail: 0, total: 10 },
    });

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe("amber");
    expect(body.summary.warn).toBe(2);
  });
});
