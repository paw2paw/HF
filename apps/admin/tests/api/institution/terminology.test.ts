import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "@/app/api/institution/terminology/route";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { TECHNICAL_TERMS } from "@/lib/terminology";

// ── Mock resolveTerminology (the unified resolver) ──

const mockResolveTerminology = vi.fn();
vi.mock("@/lib/terminology", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    resolveTerminology: (...args: any[]) => mockResolveTerminology(...args),
  };
});

vi.mock("@/lib/permissions", () => ({
  requireAuth: vi.fn(async () => ({
    session: { user: { id: "user-1", role: "VIEWER", institutionId: null } },
  })),
  isAuthError: vi.fn(() => false),
}));

describe("GET /api/institution/terminology", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns technical terms for admin users (via resolveTerminology)", async () => {
    // Route calls resolveTerminology(role, institutionId) which returns technical terms for VIEWER with no institution
    mockResolveTerminology.mockResolvedValue(TECHNICAL_TERMS);

    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    // Route maps unified terms to legacy shape
    expect(body.terminology.institution).toBe("Domain");
    expect(body.terminology.learner).toBe("Caller");
    expect(body.preset).toBeNull(); // presets are now DB-driven
    expect(body.overrides).toBeNull();
  });

  it("returns unified terms alongside legacy shape", async () => {
    mockResolveTerminology.mockResolvedValue(TECHNICAL_TERMS);

    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.terms).toEqual(TECHNICAL_TERMS); // unified 7-key TermMap
  });

  it("returns resolved terminology when institution type is configured", async () => {
    mockResolveTerminology.mockResolvedValue({
      domain: "Organization",
      playbook: "Course",
      spec: "Content",
      caller: "Employee",
      cohort: "Team",
      instructor: "Trainer",
      session: "Training Session",
    });

    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.terminology.institution).toBe("Organization");
    expect(body.terminology.cohort).toBe("Team");
    expect(body.terminology.learner).toBe("Employee");
    expect(body.terminology.instructor).toBe("Trainer");
  });

  it("maps supervisor to instructor in legacy shape", async () => {
    mockResolveTerminology.mockResolvedValue({
      ...TECHNICAL_TERMS,
      instructor: "Coach",
    });

    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.terminology.supervisor).toBe("Coach"); // supervisor maps to instructor
    expect(body.terminology.instructor).toBe("Coach");
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
      session: { user: { id: "user-1", role: "ADMIN", institutionId: "inst-1" } },
    } as any);
  });

  it("updates terminology with valid preset", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institutionId: "inst-1",
    });
    (prisma.institution.update as any).mockResolvedValue({});
    mockResolveTerminology.mockResolvedValue({
      domain: "Organization",
      playbook: "Course",
      spec: "Content",
      caller: "Employee",
      cohort: "Team",
      instructor: "Trainer",
      session: "Training Session",
    });

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
    mockResolveTerminology.mockResolvedValue({
      domain: "School",
      playbook: "Curriculum",
      spec: "Material",
      caller: "Pupil",
      cohort: "Classroom",
      instructor: "Teacher",
      session: "Lesson",
    });

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
    mockResolveTerminology.mockResolvedValue({
      domain: "School",
      playbook: "Curriculum",
      spec: "Material",
      caller: "Pupil",
      cohort: "Classroom",
      instructor: "Teacher",
      session: "Lesson",
    });

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
