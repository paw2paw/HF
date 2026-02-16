import { describe, it, expect } from "vitest";
import { TOUR_DEFINITIONS } from "@/lib/tours/tour-definitions";
import { resolveManifestItem, getAllManifestItemIds } from "@/lib/tours/manifest-resolver";

describe("tour-manifest binding", () => {
  it("every tour manifestItem resolves to a valid manifest entry", () => {
    const errors: string[] = [];

    for (const tour of TOUR_DEFINITIONS) {
      for (const step of tour.steps) {
        if (step.manifestItem) {
          const resolved = resolveManifestItem(step.manifestItem, tour.role);
          if (!resolved) {
            errors.push(
              `Tour "${tour.id}" step "${step.id}" → manifestItem "${step.manifestItem}" not found`,
            );
          }
        }
      }
    }

    expect(errors).toEqual([]);
  });

  it("resolved hrefs are non-empty and start with /", () => {
    for (const tour of TOUR_DEFINITIONS) {
      for (const step of tour.steps) {
        if (step.manifestItem) {
          const resolved = resolveManifestItem(step.manifestItem, tour.role);
          expect(resolved?.href).toBeTruthy();
          expect(resolved!.href.startsWith("/")).toBe(true);
        }
      }
    }
  });

  it("educator tour classrooms step resolves to role-variant href", () => {
    const resolved = resolveManifestItem("edu-classrooms", "EDUCATOR");
    expect(resolved).not.toBeNull();
    expect(resolved!.href).toBe("/x/educator/classrooms");
    expect(resolved!.label).toBe("Classrooms");
  });

  it("every manifest item has a unique id", () => {
    const ids = getAllManifestItemIds();
    expect(ids.length).toBe(new Set(ids).size);
  });
});
