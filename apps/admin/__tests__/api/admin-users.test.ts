/**
 * Tests for /api/admin/users endpoint
 *
 * @feature Admin User Management
 * @scenario Manage users, roles, and domain assignments
 *
 * Gherkin:
 *   Feature: Admin User Management
 *     As an administrator
 *     I want to manage users, their roles, and domain assignments
 *     So that I can control access to the system
 *
 *     Scenario: List users with domain assignments
 *       Given I am authenticated as an ADMIN user
 *       When I GET /api/admin/users
 *       Then I receive all users with domain data
 *
 *     Scenario: Update user role
 *       Given I am authenticated as ADMIN
 *       When I PATCH with { id, role: "TESTER" }
 *       Then the user's role is updated
 *
 *     Scenario: Assign domain to user
 *       Given I am authenticated as ADMIN
 *       When I PATCH with { id, assignedDomainId: "domain-1" }
 *       Then the user's domain assignment is updated
 *
 *     Scenario: Clear domain assignment
 *       Given I am authenticated as ADMIN
 *       When I PATCH with { id, assignedDomainId: "" }
 *       Then the user's domain assignment is set to null
 *
 *     Scenario: Cannot deactivate self
 *       Given I am authenticated as ADMIN
 *       When I PATCH with { id: myOwnId, isActive: false }
 *       Then I receive a 400 error
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock requireAuth
const mockRequireAuth = vi.fn();
vi.mock("@/lib/permissions", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
  isAuthError: (result: any) => "error" in result,
}));

// Mock Prisma
const mockPrisma = {
  user: {
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  account: { deleteMany: vi.fn() },
  session: { deleteMany: vi.fn() },
  userTask: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

const mockSession = {
  user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
  expires: "2099-01-01",
};

const createMockUser = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  email: "user@test.com",
  name: "Test User",
  displayName: "Testy",
  role: "OPERATOR",
  isActive: true,
  createdAt: new Date("2026-01-01"),
  assignedDomainId: null,
  assignedDomain: null,
  ...overrides,
});

describe("/api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ session: mockSession });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/admin/users", () => {
    it("should return all users with domain assignment data", async () => {
      // Given
      mockPrisma.user.findMany.mockResolvedValue([
        createMockUser(),
        createMockUser({
          id: "user-2",
          email: "tester@test.com",
          role: "TESTER",
          assignedDomainId: "domain-1",
          assignedDomain: { id: "domain-1", name: "Sales", slug: "sales" },
        }),
      ]);

      // When
      const { GET } = await import("@/app/api/admin/users/route");
      const response = await GET();
      const data = await response.json();

      // Then
      expect(data.users).toHaveLength(2);
      expect(data.users[0].assignedDomainId).toBeNull();
      expect(data.users[1].assignedDomainId).toBe("domain-1");
      expect(data.users[1].assignedDomain).toEqual({
        id: "domain-1",
        name: "Sales",
        slug: "sales",
      });
    });

    it("should select assignedDomain relation", async () => {
      // Given
      mockPrisma.user.findMany.mockResolvedValue([]);

      // When
      const { GET } = await import("@/app/api/admin/users/route");
      await GET();

      // Then: Verify Prisma was called with assignedDomain in select
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            assignedDomainId: true,
            assignedDomain: { select: { id: true, name: true, slug: true } },
          }),
        })
      );
    });

    it("should call requireAuth with ADMIN", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/admin/users/route");
      await GET();

      expect(mockRequireAuth).toHaveBeenCalledWith("ADMIN");
    });
  });

  describe("PATCH /api/admin/users", () => {
    it("should update user role", async () => {
      // Given
      mockPrisma.user.update.mockResolvedValue(
        createMockUser({ role: "TESTER" })
      );

      // When
      const { PATCH } = await import("@/app/api/admin/users/route");
      const request = new Request("http://localhost/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "user-1", role: "TESTER" }),
      });
      const response = await PATCH(request as any);
      const data = await response.json();

      // Then
      expect(data.user.role).toBe("TESTER");
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({ role: "TESTER" }),
        })
      );
    });

    it("should assign domain to user", async () => {
      // Given
      mockPrisma.user.update.mockResolvedValue(
        createMockUser({
          assignedDomainId: "domain-1",
          assignedDomain: { id: "domain-1", name: "Sales", slug: "sales" },
        })
      );

      // When
      const { PATCH } = await import("@/app/api/admin/users/route");
      const request = new Request("http://localhost/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "user-1", assignedDomainId: "domain-1" }),
      });
      const response = await PATCH(request as any);
      const data = await response.json();

      // Then
      expect(data.user.assignedDomainId).toBe("domain-1");
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assignedDomainId: "domain-1" }),
        })
      );
    });

    it("should clear domain assignment when empty string", async () => {
      // Given
      mockPrisma.user.update.mockResolvedValue(
        createMockUser({ assignedDomainId: null, assignedDomain: null })
      );

      // When
      const { PATCH } = await import("@/app/api/admin/users/route");
      const request = new Request("http://localhost/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "user-1", assignedDomainId: "" }),
      });
      const response = await PATCH(request as any);
      const data = await response.json();

      // Then: Empty string should be converted to null
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assignedDomainId: null }),
        })
      );
    });

    it("should reject missing user ID", async () => {
      // When
      const { PATCH } = await import("@/app/api/admin/users/route");
      const request = new Request("http://localhost/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "TESTER" }),
      });
      const response = await PATCH(request as any);
      const data = await response.json();

      // Then
      expect(response.status).toBe(400);
      expect(data.error).toContain("User ID");
    });

    it("should prevent deactivating own account", async () => {
      // When: Try to deactivate self
      const { PATCH } = await import("@/app/api/admin/users/route");
      const request = new Request("http://localhost/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "admin-1", isActive: false }),
      });
      const response = await PATCH(request as any);
      const data = await response.json();

      // Then
      expect(response.status).toBe(400);
      expect(data.error).toContain("Cannot deactivate");
    });

    it("should include assignedDomain in PATCH response", async () => {
      // Given
      mockPrisma.user.update.mockResolvedValue(
        createMockUser({
          assignedDomainId: "domain-1",
          assignedDomain: { id: "domain-1", name: "Sales", slug: "sales" },
        })
      );

      // When
      const { PATCH } = await import("@/app/api/admin/users/route");
      const request = new Request("http://localhost/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "user-1", assignedDomainId: "domain-1" }),
      });
      await PATCH(request as any);

      // Then: verify select includes domain relation
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            assignedDomainId: true,
            assignedDomain: { select: { id: true, name: true, slug: true } },
          }),
        })
      );
    });
  });

  describe("DELETE /api/admin/users", () => {
    it("should prevent deleting own account", async () => {
      // When
      const { DELETE } = await import("@/app/api/admin/users/route");
      const request = new NextRequest(
        "http://localhost/api/admin/users?id=admin-1",
        { method: "DELETE" }
      );
      const response = await DELETE(request);
      const data = await response.json();

      // Then
      expect(response.status).toBe(400);
      expect(data.error).toContain("Cannot delete");
    });

    it("should reject missing user ID", async () => {
      // When
      const { DELETE } = await import("@/app/api/admin/users/route");
      const request = new NextRequest("http://localhost/api/admin/users", {
        method: "DELETE",
      });
      const response = await DELETE(request);
      const data = await response.json();

      // Then
      expect(response.status).toBe(400);
      expect(data.error).toContain("User ID");
    });
  });
});
