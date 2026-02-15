import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted for mock variables referenced inside vi.mock factories
const { mockAuditLog } = vi.hoisted(() => ({
  mockAuditLog: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  auditLog: mockAuditLog,
  AuditAction: {
    EXPORTED_CALLER_DATA: "exported_caller_data",
  },
}));

// Import mocked prisma from setup
import { prisma } from "@/lib/prisma";
const mockPrisma = prisma as any;

// Add/extend mock methods needed for export (setup.ts only has a subset)
mockPrisma.callerTarget = { findMany: vi.fn() };
mockPrisma.goal = { findMany: vi.fn() };
mockPrisma.composedPrompt = { findMany: vi.fn() };
mockPrisma.callerAttribute = { findMany: vi.fn() };
mockPrisma.onboardingSession = { findMany: vi.fn() };
mockPrisma.callerPersonalityProfile = { ...mockPrisma.callerPersonalityProfile, findUnique: vi.fn() };
mockPrisma.personalityObservation = { ...mockPrisma.personalityObservation, findMany: vi.fn() };
mockPrisma.callerMemorySummary = { ...mockPrisma.callerMemorySummary, findUnique: vi.fn() };

import { GET } from "@/app/api/callers/[callerId]/export/route";

describe("GET /api/callers/:callerId/export", () => {
  const callerId = "caller-export-test";

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all return empty
    mockPrisma.caller.findUnique.mockResolvedValue(null);
    mockPrisma.call.findMany.mockResolvedValue([]);
    mockPrisma.callerMemory.findMany.mockResolvedValue([]);
    mockPrisma.callerMemorySummary.findUnique.mockResolvedValue(null);
    mockPrisma.callerPersonalityProfile.findUnique.mockResolvedValue(null);
    mockPrisma.personalityObservation.findMany.mockResolvedValue([]);
    mockPrisma.callerTarget.findMany.mockResolvedValue([]);
    mockPrisma.goal.findMany.mockResolvedValue([]);
    mockPrisma.conversationArtifact.findMany.mockResolvedValue([]);
    mockPrisma.inboundMessage.findMany.mockResolvedValue([]);
    mockPrisma.callerIdentity.findMany.mockResolvedValue([]);
    mockPrisma.composedPrompt.findMany.mockResolvedValue([]);
    mockPrisma.callerAttribute.findMany.mockResolvedValue([]);
    mockPrisma.onboardingSession.findMany.mockResolvedValue([]);
  });

  it("returns 404 for non-existent caller", async () => {
    mockPrisma.caller.findUnique.mockResolvedValue(null);
    const req = new Request("http://localhost/api/callers/nonexistent/export");
    const res = await GET(req, { params: Promise.resolve({ callerId: "nonexistent" }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Caller not found");
  });

  it("returns structured export with all sections", async () => {
    const mockCaller = {
      id: callerId,
      name: "Jane Test",
      email: "jane@test.com",
      phone: "+1234567890",
      externalId: null,
      createdAt: new Date("2026-01-01"),
      domain: { id: "dom-1", name: "Test Domain" },
    };

    const mockCalls = [
      {
        id: "call-1",
        transcript: "Hello, I need help...",
        source: "vapi",
        externalId: "ext-1",
        createdAt: new Date("2026-01-10"),
        callSequence: 1,
        scores: [],
      },
    ];

    const mockMemories = [
      {
        category: "FACT",
        key: "location",
        value: "London",
        confidence: 0.9,
        evidence: "I live in London",
        extractedAt: new Date("2026-01-10"),
        expiresAt: null,
        supersededById: null,
      },
    ];

    mockPrisma.caller.findUnique.mockResolvedValue(mockCaller);
    mockPrisma.call.findMany.mockResolvedValue(mockCalls);
    mockPrisma.callerMemory.findMany.mockResolvedValue(mockMemories);

    const req = new Request(`http://localhost/api/callers/${callerId}/export`);
    const res = await GET(req, { params: Promise.resolve({ callerId }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.export).toBeDefined();
    expect(body.export.exportedAt).toBeDefined();
    expect(body.export.dataSubject.name).toBe("Jane Test");
    expect(body.export.calls).toHaveLength(1);
    expect(body.export.memories).toHaveLength(1);

    // All sections present
    expect(body.export).toHaveProperty("dataSubject");
    expect(body.export).toHaveProperty("calls");
    expect(body.export).toHaveProperty("memories");
    expect(body.export).toHaveProperty("memorySummary");
    expect(body.export).toHaveProperty("personalityProfile");
    expect(body.export).toHaveProperty("personalityObservations");
    expect(body.export).toHaveProperty("goals");
    expect(body.export).toHaveProperty("targets");
    expect(body.export).toHaveProperty("artifacts");
    expect(body.export).toHaveProperty("messages");
    expect(body.export).toHaveProperty("identities");
    expect(body.export).toHaveProperty("composedPrompts");
    expect(body.export).toHaveProperty("attributes");
    expect(body.export).toHaveProperty("onboardingSessions");
  });

  it("audit logs the export", async () => {
    mockPrisma.caller.findUnique.mockResolvedValue({
      id: callerId,
      name: "Jane",
      email: null,
      phone: null,
      externalId: null,
      createdAt: new Date(),
      domain: null,
    });

    const req = new Request(`http://localhost/api/callers/${callerId}/export`);
    await GET(req, { params: Promise.resolve({ callerId }) });

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "exported_caller_data",
        entityType: "Caller",
        entityId: callerId,
      })
    );
  });

  it("handles empty data gracefully", async () => {
    mockPrisma.caller.findUnique.mockResolvedValue({
      id: callerId,
      name: null,
      email: null,
      phone: null,
      externalId: null,
      createdAt: new Date(),
      domain: null,
    });

    const req = new Request(`http://localhost/api/callers/${callerId}/export`);
    const res = await GET(req, { params: Promise.resolve({ callerId }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.export.calls).toEqual([]);
    expect(body.export.memories).toEqual([]);
    expect(body.export.goals).toEqual([]);
  });
});
