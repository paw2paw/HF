/**
 * Tests for GET /api/agent-tuning/settings
 *
 * Verifies:
 *   - Returns AgentTuningSettings with matrices and derivedConfidence
 *   - Requires VIEWER auth
 *   - Returns 401 without session
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock system-settings to avoid DB access
vi.mock("@/lib/system-settings", () => ({
  getAgentTuningSettings: vi.fn().mockResolvedValue({
    matrices: [
      {
        id: "communication-style",
        name: "Communication Style",
        description: "How the agent communicates",
        xAxis: { label: "Warmth", lowLabel: "Cool", highLabel: "Warm", primaryParam: "BEH-WARMTH" },
        yAxis: { label: "Formality", lowLabel: "Casual", highLabel: "Formal", primaryParam: "BEH-FORMALITY" },
        derivedParams: [],
        presets: [],
      },
    ],
    derivedConfidence: 0.5,
  }),
}));

const mockRequireAuth = vi.fn();
const mockIsAuthError = vi.fn((r: Record<string, unknown>) => "error" in r);

vi.mock("@/lib/permissions", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  isAuthError: (r: Record<string, unknown>) => mockIsAuthError(r),
}));

describe("GET /api/agent-tuning/settings", () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "user-1", role: "VIEWER" } },
    });
    const mod = await import("@/app/api/agent-tuning/settings/route");
    GET = mod.GET;
  });

  it("returns settings with matrices and derivedConfidence", async () => {
    const req = new NextRequest(
      new URL("http://localhost:3000/api/agent-tuning/settings")
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.settings).toBeDefined();
    expect(body.settings.matrices).toBeInstanceOf(Array);
    expect(body.settings.matrices.length).toBeGreaterThan(0);
    expect(body.settings.derivedConfidence).toBe(0.5);
  });

  it("returns matrix with correct structure", async () => {
    const req = new NextRequest(
      new URL("http://localhost:3000/api/agent-tuning/settings")
    );
    const res = await GET(req);
    const body = await res.json();

    const matrix = body.settings.matrices[0];
    expect(matrix.id).toBe("communication-style");
    expect(matrix.xAxis.primaryParam).toBe("BEH-WARMTH");
    expect(matrix.yAxis.primaryParam).toBe("BEH-FORMALITY");
  });

  it("requires authentication", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const req = new NextRequest(
      new URL("http://localhost:3000/api/agent-tuning/settings")
    );
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("calls requireAuth with VIEWER role", async () => {
    const req = new NextRequest(
      new URL("http://localhost:3000/api/agent-tuning/settings")
    );
    await GET(req);

    expect(mockRequireAuth).toHaveBeenCalledWith("VIEWER");
  });
});
