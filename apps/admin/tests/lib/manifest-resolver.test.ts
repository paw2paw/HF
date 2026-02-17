import { describe, it, expect } from "vitest";
import { resolveManifestItem, getAllManifestItemIds } from "@/lib/tours/manifest-resolver";

describe("resolveManifestItem", () => {
  it("returns href/label/icon for a known item", () => {
    const result = resolveManifestItem("callers");
    expect(result).toEqual({
      href: "/x/callers",
      label: "Callers",
      icon: "User",
      sectionId: "calls",
    });
  });

  it("returns null for an unknown item", () => {
    expect(resolveManifestItem("nonexistent")).toBeNull();
  });

  it("applies role variant when role matches", () => {
    const base = resolveManifestItem("edu-classrooms");
    expect(base?.href).toBe("/x/cohorts");
    expect(base?.label).toBe("Cohorts");

    const withRole = resolveManifestItem("edu-classrooms", "EDUCATOR");
    expect(withRole?.href).toBe("/x/educator/classrooms");
    expect(withRole?.label).toBe("Classrooms");
    expect(withRole?.icon).toBe("School");
  });

  it("returns base values when role has no variant", () => {
    const result = resolveManifestItem("callers", "ADMIN");
    expect(result?.href).toBe("/x/callers");
    expect(result?.label).toBe("Callers");
  });
});

describe("getAllManifestItemIds", () => {
  it("returns all manifest items", () => {
    const ids = getAllManifestItemIds();
    expect(ids.length).toBeGreaterThan(30);
    expect(ids).toContain("callers");
    expect(ids).toContain("domains");
    expect(ids).toContain("stu-progress");
    expect(ids).toContain("ai-config");
  });

  it("all IDs are unique", () => {
    const ids = getAllManifestItemIds();
    expect(ids.length).toBe(new Set(ids).size);
  });
});
