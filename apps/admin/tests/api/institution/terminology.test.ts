import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "@/app/api/institution/terminology/route";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TERMINOLOGY } from "@/lib/terminology/types";
import { requireAuth } from "@/lib/permissions";

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

function makePatchRequest(payload: Record<string, unknown>): Request {
  return new Request("http://localhost/api/institution/terminology", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("PATCH /api/institution/terminology", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "user-1", role: "ADMIN" } },
    } as any);
  });

  it("updates terminology with valid preset", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institutionId: "inst-1",
    });
    (prisma.institution.update as any).mockResolvedValue({});

    const res = await PATCH(makePatchRequest({ preset: "corporate" }) as any);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.preset).toBe("corporate");
    expect(body.terminology.institution).toBe("Organization");
    expect(prisma.institution.update).toHaveBeenCalledWith({
      where: { id: "inst-1" },
      data: { terminology: { preset: "corporate" } },
    });
  });

  it("updates terminology with preset and overrides", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institutionId: "inst-1",
    });
    (prisma.institution.update as any).mockResolvedValue({});

    const res = await PATCH(
      makePatchRequest({
        preset: "school",
        overrides: { learner: "Pupil" },
      }) as any
    );
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.terminology.learner).toBe("Pupil");
    expect(body.overrides).toEqual({ learner: "Pupil" });
  });

  it("rejects invalid preset", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institutionId: "inst-1",
    });

    const res = await PATCH(
      makePatchRequest({ preset: "invalid" }) as any
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing preset", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institutionId: "inst-1",
    });

    const res = await PATCH(
      makePatchRequest({ overrides: { learner: "Pupil" } }) as any
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when user has no institution", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institutionId: null,
    });

    const res = await PATCH(
      makePatchRequest({ preset: "corporate" }) as any
    );
    expect(res.status).toBe(400);
  });

  it("strips empty override values", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institutionId: "inst-1",
    });
    (prisma.institution.update as any).mockResolvedValue({});

    const res = await PATCH(
      makePatchRequest({
        preset: "school",
        overrides: { learner: "Pupil", cohort: "", instructor: "   " },
      }) as any
    );
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.overrides).toEqual({ learner: "Pupil" });
  });
});
