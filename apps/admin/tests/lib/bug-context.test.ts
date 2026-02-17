import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs module before importing bug-context
vi.mock("fs/promises", () => ({
  default: {
    stat: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn(),
    readFile: vi.fn(),
  },
}));

import fs from "fs/promises";
import { isLikelyId, resolveSourceFiles, getClaudeMdContext } from "@/lib/chat/bug-context";

describe("bug-context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isLikelyId", () => {
    it("detects UUIDs", () => {
      expect(isLikelyId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(isLikelyId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(true);
    });

    it("detects CUIDs", () => {
      expect(isLikelyId("clh1234567890abcdefghijklmn")).toBe(true);
      expect(isLikelyId("cm1abcdefghijklmnopqrstuvwxyz")).toBe(true);
    });

    it("detects long alphanumeric IDs", () => {
      expect(isLikelyId("abc123def456ghi789jkl012mno")).toBe(true);
    });

    it("rejects route names", () => {
      expect(isLikelyId("callers")).toBe(false);
      expect(isLikelyId("specs")).toBe(false);
      expect(isLikelyId("domains")).toBe(false);
      expect(isLikelyId("settings")).toBe(false);
      expect(isLikelyId("educator")).toBe(false);
    });

    it("rejects short strings", () => {
      expect(isLikelyId("abc")).toBe(false);
      expect(isLikelyId("page")).toBe(false);
    });
  });

  describe("resolveSourceFiles", () => {
    it("returns null pageFile when path can't be resolved", async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.readdir).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

      const result = await resolveSourceFiles("/x/nonexistent");
      expect(result.pageFile).toBeNull();
      expect(result.apiRoutes).toEqual([]);
    });

    it("resolves a simple page path", async () => {
      // Mock: app/x/callers/ exists as a directory
      vi.mocked(fs.stat).mockResolvedValueOnce({ isDirectory: () => true } as any);
      // Mock: page.tsx exists
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      // Mock: read page content
      vi.mocked(fs.readFile).mockResolvedValueOnce("export default function Page() { return <div>Callers</div> }");
      // Mock: readdir for directory tree
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        { name: "page.tsx", isDirectory: () => false },
        { name: "[callerId]", isDirectory: () => true },
      ] as any);
      // Mock: check for API route existence
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);

      const result = await resolveSourceFiles("/x/callers");
      expect(result.pageFile).toContain("export default function Page()");
      expect(result.directoryTree).toContain("page.tsx");
    });

    it("resolves dynamic [param] routes for ID segments", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";

      // First segment 'callers' - exact match found
      vi.mocked(fs.stat).mockResolvedValueOnce({ isDirectory: () => true } as any);
      // Second segment (UUID) - exact match fails
      vi.mocked(fs.stat).mockRejectedValueOnce(new Error("ENOENT"));
      // readdir finds [callerId] directory
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        { name: "[callerId]", isDirectory: () => true },
        { name: "page.tsx", isDirectory: () => false },
      ] as any);
      // page.tsx exists in [callerId]
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      // Read the page file
      vi.mocked(fs.readFile).mockResolvedValueOnce("function CallerDetail() {}");
      // Directory tree
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        { name: "page.tsx", isDirectory: () => false },
      ] as any);
      // API route check - not found
      vi.mocked(fs.access).mockRejectedValueOnce(new Error("ENOENT"));

      const result = await resolveSourceFiles(`/x/callers/${uuid}`);
      expect(result.pageFile).toContain("CallerDetail");
    });

    it("handles graceful degradation when fs fails", async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error("Permission denied"));
      vi.mocked(fs.readdir).mockRejectedValue(new Error("Permission denied"));
      vi.mocked(fs.access).mockRejectedValue(new Error("Permission denied"));

      const result = await resolveSourceFiles("/x/specs");
      expect(result.pageFile).toBeNull();
      expect(result.directoryTree).toBe("");
      expect(result.apiRoutes).toEqual([]);
    });
  });

  describe("getClaudeMdContext", () => {
    it("returns trimmed CLAUDE.md content with relevant sections", async () => {
      const mockContent = `# CLAUDE.md

## Principles
1. Zero hardcoding
2. Auth on every route

## Architecture
Single Next.js app

## Commands
npm run dev
npm run build

## Key Patterns
import { config } from "@/lib/config";

## Bugs to Avoid
- TDZ shadowing

## Deployment
Docker stuff here
`;
      vi.mocked(fs.readFile).mockResolvedValueOnce(mockContent);

      const result = await getClaudeMdContext();
      expect(result).toContain("## Principles");
      expect(result).toContain("## Architecture");
      expect(result).toContain("## Key Patterns");
      expect(result).toContain("## Bugs to Avoid");
      expect(result).not.toContain("## Commands");
      expect(result).not.toContain("## Deployment");
    });

    it("returns empty string when CLAUDE.md not found", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      const result = await getClaudeMdContext();
      expect(result).toBe("");
    });
  });
});
