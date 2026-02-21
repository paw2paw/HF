/**
 * Tests for /api/communities and /api/communities/[communityId] endpoints
 *
 * GET /api/communities: List all communities (Domains with kind=COMMUNITY)
 * GET /api/communities/[communityId]: Get a single community detail
 * PATCH /api/communities/[communityId]: Update community name, description, or welcome message
 * DELETE /api/communities/[communityId]: Archive a community (soft delete)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// =====================================================
// MOCK SETUP
// =====================================================

const { mockPrisma, mockRequireAuth } = vi.hoisted(() => ({
  mockPrisma: {
    domain: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockRequireAuth: vi.fn().mockResolvedValue({
    session: {
      user: { id: "test-user", email: "test@example.com", name: "Test User", role: "OPERATOR" },
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/permissions", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
  isAuthError: vi.fn().mockReturnValue(false),
}));

import { GET as getCommunitiesList } from "@/app/api/communities/route";
import { GET as getCommunity, PATCH as patchCommunity, DELETE as deleteCommunity } from "@/app/api/communities/[communityId]/route";

const mockCommunity = {
  id: "comm-1",
  slug: "language-partners",
  name: "Language Learning Partners",
  description: "A community for language learners",
  kind: "COMMUNITY",
  isActive: true,
  createdAt: new Date("2025-01-01"),
  onboardingWelcome: "Welcome to Language Learning Partners!",
  onboardingIdentitySpecId: "spec-123",
  onboardingIdentitySpec: {
    id: "spec-123",
    config: { personaName: "Language Coach" },
  },
  _count: {
    callers: 5,
    playbooks: 1,
  },
  callers: [
    { id: "caller-1", name: "Alice", createdAt: new Date("2025-01-05") },
    { id: "caller-2", name: "Bob", createdAt: new Date("2025-01-06") },
  ],
};

// =====================================================
// TESTS
// =====================================================

describe("/api/communities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: {
        user: { id: "test-user", email: "test@example.com", name: "Test User", role: "OPERATOR" },
      },
    });
  });

  describe("GET /api/communities", () => {
    it("lists all communities", async () => {
      mockPrisma.domain.findMany.mockResolvedValue([mockCommunity]);

      const req = new Request("http://localhost/api/communities");
      const res = await getCommunitiesList(req);
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(body.communities).toHaveLength(1);
      expect(body.communities[0].name).toBe("Language Learning Partners");
      expect(body.communities[0].memberCount).toBe(5);
    });

    it("filters by kind=COMMUNITY", async () => {
      await getCommunitiesList(new Request("http://localhost/api/communities"));

      expect(mockPrisma.domain.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ kind: "COMMUNITY" }),
        })
      );
    });

    it("requires OPERATOR role", async () => {
      mockRequireAuth.mockResolvedValue({
        error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, statusText: "Forbidden" }),
      });
      const { isAuthError } = await import("@/lib/permissions") as any;
      isAuthError.mockReturnValueOnce(true);

      const res = await getCommunitiesList(new Request("http://localhost/api/communities"));
      expect(res.status).toBe(403);
    });

    it("returns empty list when no communities exist", async () => {
      mockPrisma.domain.findMany.mockResolvedValue([]);

      const req = new Request("http://localhost/api/communities");
      const res = await getCommunitiesList(req);
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(body.communities).toEqual([]);
      expect(body.count).toBe(0);
    });
  });

  describe("GET /api/communities/[communityId]", () => {
    it("returns community details", async () => {
      mockPrisma.domain.findUnique.mockResolvedValue(mockCommunity);

      const req = new Request("http://localhost/api/communities/comm-1");
      const res = await getCommunity(req, { params: { communityId: "comm-1" } });
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(body.community.name).toBe("Language Learning Partners");
      expect(body.community.memberCount).toBe(5);
      expect(body.community.recentMembers).toHaveLength(2);
    });

    it("returns 404 if community not found", async () => {
      mockPrisma.domain.findUnique.mockResolvedValue(null);

      const req = new Request("http://localhost/api/communities/nonexistent");
      const res = await getCommunity(req, { params: { communityId: "nonexistent" } });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.ok).toBe(false);
      expect(body.error).toContain("not found");
    });

    it("returns 404 if domain kind is not COMMUNITY", async () => {
      mockPrisma.domain.findUnique.mockResolvedValue({
        ...mockCommunity,
        kind: "INSTITUTION",
      });

      const req = new Request("http://localhost/api/communities/comm-1");
      const res = await getCommunity(req, { params: { communityId: "comm-1" } });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.ok).toBe(false);
    });
  });

  describe("PATCH /api/communities/[communityId]", () => {
    it("updates community name", async () => {
      const updated = { ...mockCommunity, name: "New Name" };
      mockPrisma.domain.findUnique.mockResolvedValue(mockCommunity);
      mockPrisma.domain.update.mockResolvedValue(updated);

      const req = new Request("http://localhost/api/communities/comm-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });

      const res = await patchCommunity(req, { params: { communityId: "comm-1" } });
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(mockPrisma.domain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "comm-1" },
          data: { name: "New Name" },
        })
      );
    });

    it("updates welcome message", async () => {
      const updated = { ...mockCommunity, onboardingWelcome: "New Welcome" };
      mockPrisma.domain.findUnique.mockResolvedValue(mockCommunity);
      mockPrisma.domain.update.mockResolvedValue(updated);

      const req = new Request("http://localhost/api/communities/comm-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingWelcome: "New Welcome" }),
      });

      const res = await patchCommunity(req, { params: { communityId: "comm-1" } });
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(mockPrisma.domain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { onboardingWelcome: "New Welcome" },
        })
      );
    });

    it("returns 400 if no fields to update", async () => {
      mockPrisma.domain.findUnique.mockResolvedValue(mockCommunity);

      const req = new Request("http://localhost/api/communities/comm-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await patchCommunity(req, { params: { communityId: "comm-1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
    });

    it("returns 404 if community not found", async () => {
      mockPrisma.domain.findUnique.mockResolvedValue(null);

      const req = new Request("http://localhost/api/communities/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });

      const res = await patchCommunity(req, { params: { communityId: "nonexistent" } });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.ok).toBe(false);
    });
  });

  describe("DELETE /api/communities/[communityId]", () => {
    it("archives a community", async () => {
      mockPrisma.domain.findUnique.mockResolvedValue(mockCommunity);
      mockPrisma.domain.update.mockResolvedValue({
        ...mockCommunity,
        isActive: false,
      });

      const req = new Request("http://localhost/api/communities/comm-1", {
        method: "DELETE",
      });

      const res = await deleteCommunity(req, { params: { communityId: "comm-1" } });
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(mockPrisma.domain.update).toHaveBeenCalledWith({
        where: { id: "comm-1" },
        data: { isActive: false },
      });
    });

    it("returns 404 if community not found", async () => {
      mockPrisma.domain.findUnique.mockResolvedValue(null);

      const req = new Request("http://localhost/api/communities/nonexistent", {
        method: "DELETE",
      });

      const res = await deleteCommunity(req, { params: { communityId: "nonexistent" } });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.ok).toBe(false);
    });

    it("requires OPERATOR role", async () => {
      mockRequireAuth.mockResolvedValue({
        error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, statusText: "Forbidden" }),
      });
      const { isAuthError } = await import("@/lib/permissions") as any;
      isAuthError.mockReturnValueOnce(true);

      const res = await deleteCommunity(
        new Request("http://localhost/api/communities/comm-1", { method: "DELETE" }),
        { params: { communityId: "comm-1" } }
      );

      expect(res.status).toBe(403);
    });
  });
});
