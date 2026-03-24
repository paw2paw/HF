import { describe, it, expect } from "vitest";
import { filterSpecsByToggles } from "@/lib/prompt/composition/SectionDataLoader";

const makeSpec = (id: string, slug: string) => ({ id, slug, name: slug, outputType: "IDENTITY" });

describe("filterSpecsByToggles", () => {
  const specs = [
    makeSpec("id-tut", "TUT-001"),
    makeSpec("id-guard", "GUARD-001"),
    makeSpec("id-voice", "VOICE-001"),
    makeSpec("id-init", "INIT-001"),
  ];

  it("returns all specs when no playbooks", () => {
    expect(filterSpecsByToggles(specs, [])).toEqual(specs);
  });

  it("returns all specs when playbook has no toggles", () => {
    expect(filterSpecsByToggles(specs, [{ config: {} }])).toEqual(specs);
  });

  it("returns all specs when playbook config is null", () => {
    expect(filterSpecsByToggles(specs, [{ config: null }])).toEqual(specs);
  });

  it("filters out specs disabled by slug", () => {
    const playbooks = [{
      config: {
        systemSpecToggles: {
          "GUARD-001": { isEnabled: false },
          "INIT-001": { isEnabled: false },
        },
      },
    }];
    const result = filterSpecsByToggles(specs, playbooks);
    expect(result.map((s) => s.slug)).toEqual(["TUT-001", "VOICE-001"]);
  });

  it("filters out specs disabled by id", () => {
    const playbooks = [{
      config: {
        systemSpecToggles: {
          "id-guard": { isEnabled: false },
        },
      },
    }];
    const result = filterSpecsByToggles(specs, playbooks);
    expect(result.map((s) => s.slug)).toEqual(["TUT-001", "VOICE-001", "INIT-001"]);
  });

  it("keeps specs explicitly enabled", () => {
    const playbooks = [{
      config: {
        systemSpecToggles: {
          "TUT-001": { isEnabled: true },
          "GUARD-001": { isEnabled: false },
        },
      },
    }];
    const result = filterSpecsByToggles(specs, playbooks);
    expect(result.map((s) => s.slug)).toEqual(["TUT-001", "VOICE-001", "INIT-001"]);
  });

  it("uses primary (first) playbook only", () => {
    const playbooks = [
      { config: { systemSpecToggles: { "GUARD-001": { isEnabled: false } } } },
      { config: { systemSpecToggles: { "TUT-001": { isEnabled: false } } } },
    ];
    const result = filterSpecsByToggles(specs, playbooks);
    // Only first playbook's toggles apply — TUT-001 should still be included
    expect(result.map((s) => s.slug)).toContain("TUT-001");
    expect(result.map((s) => s.slug)).not.toContain("GUARD-001");
  });
});
