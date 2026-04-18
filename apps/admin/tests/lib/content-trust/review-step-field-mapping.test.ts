/**
 * Tests for ReviewStep field alignment with assertions API.
 *
 * The ReviewStep component consumes `/api/content-sources/:id/assertions`
 * and expects specific field names. This test validates that the API response
 * shape matches the component's expectations — preventing the assertionText vs
 * assertion mismatch bug from recurring.
 *
 * Also validates that the GET route returns the required fields for
 * rendering, filtering, and review actions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────

const mockRequireAuth = vi.fn();
vi.mock("@/lib/permissions", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
  isAuthError: (result: any) => !!result.error,
}));

const mockPrisma = {
  contentAssertion: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma, db: (tx: any) => tx ?? mockPrisma }));

// ── Helpers ──────────────────────────────────────────────

function mockAuth() {
  mockRequireAuth.mockResolvedValue({
    session: { user: { id: "user-1", role: "OPERATOR" } },
  });
}

const SOURCE_ID = "src-1";

function makeGetRequest(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `http://localhost/api/content-sources/${SOURCE_ID}/assertions${qs ? `?${qs}` : ""}`;
  return new NextRequest(url, { method: "GET" });
}

/** Simulates a Prisma ContentAssertion record */
function makePrismaAssertion(overrides: Record<string, any> = {}) {
  return {
    id: "a-1",
    assertion: "The annual ISA allowance is £20,000", // Prisma field name
    category: "fact",
    tags: ["isa"],
    chapter: "Ch 3",
    section: "3.2",
    pageRef: null,
    reviewedAt: null,
    reviewedBy: null,
    contentHash: "abc123",
    _count: { children: 0 },
    ...overrides,
  };
}

// ── Fields the ReviewStep component expects ──────────────

const REVIEW_STEP_REQUIRED_FIELDS = [
  "id",
  "assertion",   // NOT "assertionText" — that was the bug
  "category",
  "tags",
  "chapter",     // NOT "chapterRef"
  "section",     // NOT "sectionRef"
  "reviewedAt",
] as const;

// ── Tests ────────────────────────────────────────────────

describe("Assertions GET response → ReviewStep field alignment", () => {
  let GET: any;
  const PARAMS = Promise.resolve({ sourceId: SOURCE_ID });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuth();
    const mod = await import("@/app/api/content-sources/[sourceId]/assertions/route");
    GET = mod.GET;
  });

  it("returns all fields required by ReviewStep component", async () => {
    const prismaRecord = makePrismaAssertion();
    mockPrisma.contentAssertion.findMany.mockResolvedValue([prismaRecord]);
    mockPrisma.contentAssertion.count.mockResolvedValue(1);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await GET(makeGetRequest(), { params: PARAMS });
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.assertions).toHaveLength(1);

    const assertion = body.assertions[0];
    for (const field of REVIEW_STEP_REQUIRED_FIELDS) {
      expect(assertion).toHaveProperty(field);
    }
  });

  it("uses 'assertion' field name, NOT 'assertionText'", async () => {
    const prismaRecord = makePrismaAssertion({
      assertion: "Capital gains tax is 20%",
    });
    mockPrisma.contentAssertion.findMany.mockResolvedValue([prismaRecord]);
    mockPrisma.contentAssertion.count.mockResolvedValue(1);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await GET(makeGetRequest(), { params: PARAMS });
    const body = await res.json();
    const a = body.assertions[0];

    expect(a.assertion).toBe("Capital gains tax is 20%");
    expect(a).not.toHaveProperty("assertionText");
  });

  it("uses 'chapter' and 'section' field names, NOT 'chapterRef'/'sectionRef'", async () => {
    const prismaRecord = makePrismaAssertion({
      chapter: "Ch 5",
      section: "5.1",
    });
    mockPrisma.contentAssertion.findMany.mockResolvedValue([prismaRecord]);
    mockPrisma.contentAssertion.count.mockResolvedValue(1);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await GET(makeGetRequest(), { params: PARAMS });
    const body = await res.json();
    const a = body.assertions[0];

    expect(a.chapter).toBe("Ch 5");
    expect(a.section).toBe("5.1");
    expect(a).not.toHaveProperty("chapterRef");
    expect(a).not.toHaveProperty("sectionRef");
  });

  it("returns reviewedCount and total for progress bar", async () => {
    mockPrisma.contentAssertion.findMany.mockResolvedValue([]);
    mockPrisma.contentAssertion.count
      .mockResolvedValueOnce(10) // total (filtered)
      .mockResolvedValueOnce(3)  // reviewedCount
      .mockResolvedValueOnce(10); // totalForSource
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await GET(makeGetRequest(), { params: PARAMS });
    const body = await res.json();

    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("reviewed");
    expect(body).toHaveProperty("reviewProgress");
  });
});
