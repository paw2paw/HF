/**
 * Tests for /api/admin/access-matrix endpoint
 *
 * @feature Entity Access Matrix API
 * @scenario Load the ENTITY_ACCESS_V1 contract for the access matrix viewer
 *
 * Gherkin:
 *   Feature: Access Matrix API
 *     As an administrator
 *     I want to load the entity access matrix
 *     So that I can view and verify role permissions
 *
 *     Scenario: Load access matrix (authenticated admin)
 *       Given I am authenticated as an ADMIN user
 *       When I GET /api/admin/access-matrix
 *       Then I receive the ENTITY_ACCESS_V1 contract
 *       And it contains roles, scopes, operations, and matrix
 *
 *     Scenario: Contract not seeded
 *       Given I am authenticated as an ADMIN user
 *       And the ENTITY_ACCESS_V1 contract has not been seeded
 *       When I GET /api/admin/access-matrix
 *       Then I receive a 404 error
 *
 *     Scenario: Insufficient role
 *       Given I am authenticated as a TESTER user
 *       When I GET /api/admin/access-matrix
 *       Then I receive a 403 Forbidden error
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock requireAuth
const mockRequireAuth = vi.fn();
vi.mock("@/lib/permissions", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
  isAuthError: (result: any) => "error" in result,
}));

// Mock ContractRegistry
const mockGetContract = vi.fn();
vi.mock("@/lib/contracts/registry", () => ({
  ContractRegistry: {
    getContract: (...args: any[]) => mockGetContract(...args),
  },
}));

const MOCK_CONTRACT = {
  contractId: "ENTITY_ACCESS_V1",
  version: "1.0",
  status: "active",
  description: "Entity Access Matrix",
  roles: ["SUPERADMIN", "ADMIN", "OPERATOR", "SUPER_TESTER", "TESTER", "DEMO"],
  scopes: {
    ALL: "Unrestricted access to all records",
    DOMAIN: "Access limited to records within user's assignedDomainId",
    OWN: "Access limited to records owned by/linked to the user",
    NONE: "No access",
  },
  operations: { C: "Create", R: "Read/View", U: "Update", D: "Delete" },
  matrix: {
    callers: { SUPERADMIN: "ALL:CRUD", ADMIN: "ALL:CRUD", OPERATOR: "ALL:CRU", SUPER_TESTER: "DOMAIN:CR", TESTER: "OWN:R", DEMO: "OWN:R" },
    users: { SUPERADMIN: "ALL:CRUD", ADMIN: "ALL:R", OPERATOR: "NONE", SUPER_TESTER: "NONE", TESTER: "NONE", DEMO: "NONE" },
  },
};

const mockSession = {
  user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
  expires: "2099-01-01",
};

describe("/api/admin/access-matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/admin/access-matrix", () => {
    it("should return the ENTITY_ACCESS_V1 contract for authenticated admin", async () => {
      // Given: Authenticated as ADMIN, contract exists
      mockRequireAuth.mockResolvedValue({ session: mockSession });
      mockGetContract.mockResolvedValue(MOCK_CONTRACT);

      // When
      const { GET } = await import("@/app/api/admin/access-matrix/route");
      const response = await GET();
      const data = await response.json();

      // Then
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.contract).toBeDefined();
      expect(data.contract.contractId).toBe("ENTITY_ACCESS_V1");
      expect(data.contract.roles).toEqual(expect.arrayContaining(["SUPERADMIN", "ADMIN", "DEMO"]));
      expect(data.contract.matrix).toBeDefined();
      expect(data.contract.matrix.callers).toBeDefined();
    });

    it("should call requireAuth with ADMIN role", async () => {
      // Given
      mockRequireAuth.mockResolvedValue({ session: mockSession });
      mockGetContract.mockResolvedValue(MOCK_CONTRACT);

      // When
      const { GET } = await import("@/app/api/admin/access-matrix/route");
      await GET();

      // Then
      expect(mockRequireAuth).toHaveBeenCalledWith("ADMIN");
    });

    it("should call ContractRegistry.getContract with correct ID", async () => {
      // Given
      mockRequireAuth.mockResolvedValue({ session: mockSession });
      mockGetContract.mockResolvedValue(MOCK_CONTRACT);

      // When
      const { GET } = await import("@/app/api/admin/access-matrix/route");
      await GET();

      // Then
      expect(mockGetContract).toHaveBeenCalledWith("ENTITY_ACCESS_V1");
    });

    it("should return 404 when contract is not seeded", async () => {
      // Given: Authenticated but contract not in DB
      mockRequireAuth.mockResolvedValue({ session: mockSession });
      mockGetContract.mockResolvedValue(null);

      // When
      const { GET } = await import("@/app/api/admin/access-matrix/route");
      const response = await GET();
      const data = await response.json();

      // Then
      expect(response.status).toBe(404);
      expect(data.ok).toBe(false);
      expect(data.error).toContain("ENTITY_ACCESS_V1");
    });

    it("should return auth error when not authenticated", async () => {
      // Given: Auth fails
      const errorResponse = new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
      mockRequireAuth.mockResolvedValue({ error: errorResponse });

      // When
      const { GET } = await import("@/app/api/admin/access-matrix/route");
      const response = await GET();

      // Then
      expect(response.status).toBe(401);
      // Should not have tried to load contract
      expect(mockGetContract).not.toHaveBeenCalled();
    });

    it("should return 403 for insufficient role", async () => {
      // Given: Auth returns forbidden
      const errorResponse = new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
      mockRequireAuth.mockResolvedValue({ error: errorResponse });

      // When
      const { GET } = await import("@/app/api/admin/access-matrix/route");
      const response = await GET();

      // Then
      expect(response.status).toBe(403);
      expect(mockGetContract).not.toHaveBeenCalled();
    });
  });
});
