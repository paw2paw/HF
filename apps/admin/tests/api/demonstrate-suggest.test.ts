/**
 * Tests for Demonstrate Suggest API:
 *   GET /api/demonstrate/suggest
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/permissions", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    session: { user: { id: "u1", email: "admin@test.com", role: "ADMIN" } },
  }),
  isAuthError: vi.fn((result: Record<string, unknown>) => "error" in result),
}));

vi.mock("@/lib/demonstrate/suggest-goals", () => ({
  suggestGoals: vi.fn(),
}));

vi.mock("@/lib/system-settings", () => ({
  getSuggestSettings: vi.fn().mockResolvedValue({
    timeoutMs: 10000,
    maxInputLength: 500,
  }),
}));

describe("GET /api/demonstrate/suggest", () => {
  let GET: any;
  let mockSuggestGoals: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const suggestModule = await import("@/lib/demonstrate/suggest-goals");
    mockSuggestGoals = suggestModule.suggestGoals;

    const mod = await import("@/app/api/demonstrate/suggest/route");
    GET = mod.GET;
  });

  it("returns suggestions for valid params", async () => {
    mockSuggestGoals.mockResolvedValue([
      "Practice multiplication tables",
      "Work on word problems",
      "Review fractions",
    ]);

    const url = "http://localhost/api/demonstrate/suggest?domainId=dom-1&callerId=cal-1";
    const request = new Request(url);

    const response = await GET(request);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.suggestions).toHaveLength(3);
    expect(data.suggestions[0]).toBe("Practice multiplication tables");
    expect(mockSuggestGoals).toHaveBeenCalledWith({
      domainId: "dom-1",
      callerId: "cal-1",
      currentGoal: undefined,
      timeoutMs: 10000,
    });
  });

  it("passes currentGoal when provided", async () => {
    mockSuggestGoals.mockResolvedValue(["Refined goal 1"]);

    const url = "http://localhost/api/demonstrate/suggest?domainId=dom-1&callerId=cal-1&currentGoal=Teach%20math";
    const request = new Request(url);

    await GET(request);

    expect(mockSuggestGoals).toHaveBeenCalledWith({
      domainId: "dom-1",
      callerId: "cal-1",
      currentGoal: "Teach math",
      timeoutMs: 10000,
    });
  });

  it("returns 400 when domainId is missing", async () => {
    const url = "http://localhost/api/demonstrate/suggest?callerId=cal-1";
    const request = new Request(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("domainId");
  });

  it("succeeds when callerId is omitted (optional param)", async () => {
    mockSuggestGoals.mockResolvedValue(["Goal A"]);

    const url = "http://localhost/api/demonstrate/suggest?domainId=dom-1";
    const request = new Request(url);

    const response = await GET(request);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.suggestions).toEqual(["Goal A"]);
    expect(mockSuggestGoals).toHaveBeenCalledWith({
      domainId: "dom-1",
      callerId: undefined,
      currentGoal: undefined,
      timeoutMs: 10000,
    });
  });

  it("returns empty array when no suggestions generated", async () => {
    mockSuggestGoals.mockResolvedValue([]);

    const url = "http://localhost/api/demonstrate/suggest?domainId=dom-1&callerId=cal-1";
    const request = new Request(url);

    const response = await GET(request);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.suggestions).toEqual([]);
  });

  it("requires OPERATOR auth", async () => {
    mockSuggestGoals.mockResolvedValue([]);
    const url = "http://localhost/api/demonstrate/suggest?domainId=dom-1&callerId=cal-1";
    await GET(new Request(url));

    const { requireAuth } = await import("@/lib/permissions");
    expect(requireAuth).toHaveBeenCalledWith("OPERATOR");
  });
});
