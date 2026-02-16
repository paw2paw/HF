import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/institution/terminology/route";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TERMINOLOGY } from "@/lib/terminology/types";

vi.mock("@/lib/permissions", () => ({
  requireAuth: vi.fn(async () => ({
    session: { user: { id: "user-1", role: "VIEWER" } },
  })),
  isAuthError: vi.fn(() => false),
}));

describe("GET /api/institution/terminology", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default terminology when user has no institution", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institution: null,
    });

    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.terminology).toEqual(DEFAULT_TERMINOLOGY);
    expect(body.preset).toBe("school");
    expect(body.overrides).toBeNull();
  });

  it("returns default terminology when institution has no config", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institution: { terminology: null },
    });

    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.terminology).toEqual(DEFAULT_TERMINOLOGY);
    expect(body.preset).toBe("school");
  });

  it("returns resolved terminology for corporate preset", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institution: {
        terminology: { preset: "corporate" },
      },
    });

    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.terminology.institution).toBe("Organization");
    expect(body.terminology.cohort).toBe("Team");
    expect(body.terminology.learner).toBe("Employee");
    expect(body.terminology.instructor).toBe("Trainer");
    expect(body.terminology.supervisor).toBe("My Manager");
    expect(body.preset).toBe("corporate");
  });

  it("returns resolved terminology with overrides", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institution: {
        terminology: {
          preset: "corporate",
          overrides: { learner: "Associate" },
        },
      },
    });

    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.terminology.learner).toBe("Associate");
    expect(body.terminology.cohort).toBe("Team"); // from preset
    expect(body.overrides).toEqual({ learner: "Associate" });
  });
});
