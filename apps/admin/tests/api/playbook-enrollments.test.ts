/**
 * Tests for /api/playbooks/:playbookId/enrollments routes
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock auth
vi.mock("@/lib/permissions", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    session: { user: { id: "user-1", role: "ADMIN" } },
  }),
  isAuthError: vi.fn().mockReturnValue(false),
}));

// Mock enrollment helpers
const mockGetPlaybookRoster = vi.fn();
const mockEnrollCaller = vi.fn();

vi.mock("@/lib/enrollment", () => ({
  getPlaybookRoster: (...args: any[]) => mockGetPlaybookRoster(...args),
  enrollCaller: (...args: any[]) => mockEnrollCaller(...args),
}));

import { GET } from "@/app/api/playbooks/[playbookId]/enrollments/route";
import { POST } from "@/app/api/playbooks/[playbookId]/enrollments/bulk/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/playbooks/:playbookId/enrollments", () => {
  it("returns enrolled callers for a playbook", async () => {
    const roster = [
      { id: "enr-1", caller: { id: "c-1", name: "Alice" }, status: "ACTIVE" },
      { id: "enr-2", caller: { id: "c-2", name: "Bob" }, status: "ACTIVE" },
    ];
    mockGetPlaybookRoster.mockResolvedValue(roster);

    const req = new Request("http://localhost/api/playbooks/pb-1/enrollments");
    const res = await GET(req, { params: Promise.resolve({ playbookId: "pb-1" }) });
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.enrollments).toHaveLength(2);
    expect(mockGetPlaybookRoster).toHaveBeenCalledWith("pb-1", undefined);
  });

  it("filters by status when provided", async () => {
    mockGetPlaybookRoster.mockResolvedValue([]);

    const req = new Request("http://localhost/api/playbooks/pb-1/enrollments?status=COMPLETED");
    const res = await GET(req, { params: Promise.resolve({ playbookId: "pb-1" }) });

    expect(mockGetPlaybookRoster).toHaveBeenCalledWith("pb-1", "COMPLETED");
  });
});

describe("POST /api/playbooks/:playbookId/enrollments/bulk", () => {
  it("bulk enrolls multiple callers", async () => {
    mockEnrollCaller
      .mockResolvedValueOnce({ id: "enr-1" })
      .mockResolvedValueOnce({ id: "enr-2" });

    const req = new Request("http://localhost/api/playbooks/pb-1/enrollments/bulk", {
      method: "POST",
      body: JSON.stringify({ callerIds: ["c-1", "c-2"] }),
    });
    const res = await POST(req, { params: Promise.resolve({ playbookId: "pb-1" }) });
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.enrolled).toBe(2);
    expect(data.errors).toHaveLength(0);
  });

  it("returns 400 when callerIds is missing", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({ playbookId: "pb-1" }) });

    expect(res.status).toBe(400);
  });

  it("collects errors for individual enrollment failures", async () => {
    mockEnrollCaller
      .mockResolvedValueOnce({ id: "enr-1" })
      .mockRejectedValueOnce(new Error("Playbook not found"));

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ callerIds: ["c-1", "c-2"] }),
    });
    const res = await POST(req, { params: Promise.resolve({ playbookId: "pb-1" }) });
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.enrolled).toBe(1);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0]).toContain("c-2");
  });
});
