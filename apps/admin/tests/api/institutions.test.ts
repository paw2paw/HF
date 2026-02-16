import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/institutions/route";
import { GET as GET_DETAIL, PATCH, DELETE } from "@/app/api/institutions/[id]/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/permissions", () => ({
  requireAuth: vi.fn(async () => ({
    session: { user: { id: "admin-1", role: "SUPERADMIN" } },
  })),
  isAuthError: vi.fn(() => false),
}));

describe("Institution CRUD API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /api/institutions ──

  describe("GET /api/institutions", () => {
    it("returns all institutions with counts", async () => {
      (prisma.institution.findMany as any).mockResolvedValue([
        {
          id: "inst-1",
          name: "Greenwood Academy",
          slug: "greenwood",
          logoUrl: null,
          primaryColor: "#4f46e5",
          secondaryColor: null,
          welcomeMessage: null,
          isActive: true,
          createdAt: new Date("2026-01-01"),
          _count: { users: 10, cohortGroups: 3 },
        },
      ]);

      const res = await GET();
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(body.institutions).toHaveLength(1);
      expect(body.institutions[0].name).toBe("Greenwood Academy");
      expect(body.institutions[0].userCount).toBe(10);
      expect(body.institutions[0].cohortCount).toBe(3);
    });
  });

  // ── POST /api/institutions ──

  describe("POST /api/institutions", () => {
    it("creates a new institution", async () => {
      (prisma.institution.findUnique as any).mockResolvedValue(null);
      (prisma.institution.create as any).mockResolvedValue({
        id: "inst-new",
        name: "New School",
        slug: "new-school",
        logoUrl: null,
        primaryColor: "#3b82f6",
        secondaryColor: null,
        welcomeMessage: "Welcome!",
        isActive: true,
      });

      const request = new Request("http://localhost/api/institutions", {
        method: "POST",
        body: JSON.stringify({ name: "New School", slug: "new-school", primaryColor: "#3b82f6", welcomeMessage: "Welcome!" }),
      });

      const res = await POST(request as any);
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(body.institution.name).toBe("New School");
      expect(body.institution.slug).toBe("new-school");
    });

    it("rejects missing name", async () => {
      const request = new Request("http://localhost/api/institutions", {
        method: "POST",
        body: JSON.stringify({ slug: "test" }),
      });

      const res = await POST(request as any);
      expect(res.status).toBe(400);
    });

    it("rejects invalid slug format", async () => {
      const request = new Request("http://localhost/api/institutions", {
        method: "POST",
        body: JSON.stringify({ name: "Test", slug: "INVALID SLUG!" }),
      });

      const res = await POST(request as any);
      expect(res.status).toBe(400);
    });

    it("rejects duplicate slug", async () => {
      (prisma.institution.findUnique as any).mockResolvedValue({ id: "existing" });

      const request = new Request("http://localhost/api/institutions", {
        method: "POST",
        body: JSON.stringify({ name: "Test", slug: "existing" }),
      });

      const res = await POST(request as any);
      expect(res.status).toBe(409);
    });
  });

  // ── GET /api/institutions/[id] ──

  describe("GET /api/institutions/[id]", () => {
    it("returns institution by ID", async () => {
      (prisma.institution.findUnique as any).mockResolvedValue({
        id: "inst-1",
        name: "Greenwood",
        slug: "greenwood",
        logoUrl: null,
        primaryColor: "#4f46e5",
        secondaryColor: null,
        welcomeMessage: null,
        isActive: true,
        createdAt: new Date("2026-01-01"),
        _count: { users: 5, cohortGroups: 2 },
      });

      const res = await GET_DETAIL(
        new Request("http://localhost") as any,
        { params: Promise.resolve({ id: "inst-1" }) }
      );
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(body.institution.name).toBe("Greenwood");
    });

    it("returns 404 for missing institution", async () => {
      (prisma.institution.findUnique as any).mockResolvedValue(null);

      const res = await GET_DETAIL(
        new Request("http://localhost") as any,
        { params: Promise.resolve({ id: "nonexistent" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/institutions/[id] ──

  describe("PATCH /api/institutions/[id]", () => {
    it("updates institution fields", async () => {
      (prisma.institution.update as any).mockResolvedValue({
        id: "inst-1",
        name: "Updated Name",
        slug: "greenwood",
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#ff0000",
        secondaryColor: null,
        welcomeMessage: null,
        isActive: true,
      });

      const request = new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Name", primaryColor: "#ff0000", logoUrl: "https://example.com/logo.png" }),
      });

      const res = await PATCH(request as any, { params: Promise.resolve({ id: "inst-1" }) });
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(body.institution.name).toBe("Updated Name");
      expect(body.institution.primaryColor).toBe("#ff0000");
    });

    it("rejects empty update", async () => {
      const request = new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({}),
      });

      const res = await PATCH(request as any, { params: Promise.resolve({ id: "inst-1" }) });
      expect(res.status).toBe(400);
    });

    it("returns 404 for missing institution (P2025)", async () => {
      const p2025 = Object.assign(new Error("Record not found"), { code: "P2025" });
      (prisma.institution.update as any).mockRejectedValue(p2025);

      const request = new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "Test" }),
      });

      const res = await PATCH(request as any, { params: Promise.resolve({ id: "missing" }) });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Institution not found");
    });

    it("returns 500 for unexpected errors", async () => {
      (prisma.institution.update as any).mockRejectedValue(new Error("Connection refused"));

      const request = new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "Test" }),
      });

      const res = await PATCH(request as any, { params: Promise.resolve({ id: "inst-1" }) });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Connection refused");
    });
  });

  // ── DELETE /api/institutions/[id] ──

  describe("DELETE /api/institutions/[id]", () => {
    it("soft-deletes by setting isActive to false", async () => {
      (prisma.institution.update as any).mockResolvedValue({});

      const res = await DELETE(
        new Request("http://localhost") as any,
        { params: Promise.resolve({ id: "inst-1" }) }
      );
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(prisma.institution.update).toHaveBeenCalledWith({
        where: { id: "inst-1" },
        data: { isActive: false },
      });
    });
  });
});
