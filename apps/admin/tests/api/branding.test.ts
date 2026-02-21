import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/institution/branding/route";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BRANDING } from "@/lib/branding";

vi.mock("@/lib/permissions", () => ({
  requireAuth: vi.fn(async () => ({
    session: { user: { id: "user-1", role: "TESTER" } },
  })),
  isAuthError: vi.fn(() => false),
}));

describe("GET /api/institution/branding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns institution branding when user has one", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institution: {
        name: "Greenwood Academy",
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#4f46e5",
        secondaryColor: "#3b82f6",
        welcomeMessage: "Welcome to Greenwood",
        type: { name: "School" },
      },
    });

    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.branding.name).toBe("Greenwood Academy");
    expect(body.branding.primaryColor).toBe("#4f46e5");
    expect(body.branding.logoUrl).toBe("https://example.com/logo.png");
    expect(body.branding.typeName).toBe("School");
  });

  it("returns typeName as null when institution has no type", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institution: {
        name: "Untyped Org",
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        welcomeMessage: null,
        type: null,
      },
    });

    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.branding.name).toBe("Untyped Org");
    expect(body.branding.typeName).toBeNull();
  });

  it("returns default branding when user has no institution", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      institution: null,
    });

    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.branding.name).toBe(DEFAULT_BRANDING.name);
    expect(body.branding.primaryColor).toBe(DEFAULT_BRANDING.primaryColor);
  });

  it("returns default branding when user not found", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.branding.name).toBe(DEFAULT_BRANDING.name);
  });
});
