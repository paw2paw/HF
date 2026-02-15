import { describe, it, expect } from "vitest";
import { computeLayerDiff, deriveBaseSlug } from "@/lib/layers/compute-diff";

describe("computeLayerDiff", () => {
  it("handles empty configs", () => {
    const result = computeLayerDiff({}, {});
    expect(result.parameters).toEqual([]);
    expect(result.constraints).toEqual([]);
    expect(result.stats).toEqual({
      inherited: 0,
      overridden: 0,
      new: 0,
      totalMerged: 0,
      baseConstraints: 0,
      overlayConstraints: 0,
    });
  });

  it("classifies all base params as INHERITED when overlay has none", () => {
    const base = {
      parameters: [
        { id: "core_identity", name: "Core Identity", section: "identity", config: { roleStatement: "Generic tutor" } },
        { id: "interaction_style", name: "Interaction Style", section: "personality", config: { warmth: "high" } },
      ],
    };
    const result = computeLayerDiff(base, {});

    expect(result.parameters).toHaveLength(2);
    expect(result.parameters[0].status).toBe("INHERITED");
    expect(result.parameters[1].status).toBe("INHERITED");
    expect(result.stats.inherited).toBe(2);
    expect(result.stats.overridden).toBe(0);
    expect(result.stats.new).toBe(0);
  });

  it("classifies all overlay params as NEW when base has none", () => {
    const overlay = {
      parameters: [
        { id: "domain_vocab", name: "Domain Vocabulary", section: "identity", config: { terms: ["qubit"] } },
        { id: "techniques", name: "Teaching Techniques", section: "pedagogy", config: { methods: ["demo"] } },
      ],
    };
    const result = computeLayerDiff({}, overlay);

    expect(result.parameters).toHaveLength(2);
    expect(result.parameters[0].status).toBe("NEW");
    expect(result.parameters[1].status).toBe("NEW");
    expect(result.stats.new).toBe(2);
    expect(result.stats.inherited).toBe(0);
    expect(result.stats.overridden).toBe(0);
  });

  it("classifies mixed: INHERITED, OVERRIDDEN, and NEW", () => {
    const base = {
      parameters: [
        { id: "A", name: "Param A", section: "s1", config: { v: 1 } },
        { id: "B", name: "Param B", section: "s2", config: { v: 2 } },
        { id: "C", name: "Param C", section: "s3", config: { v: 3 } },
      ],
    };
    const overlay = {
      parameters: [
        { id: "B", name: "Param B Override", section: "s2", config: { v: 20 } },
        { id: "D", name: "Param D", section: "s4", config: { v: 4 } },
      ],
    };

    const result = computeLayerDiff(base, overlay);

    expect(result.parameters).toHaveLength(4);

    const paramA = result.parameters.find(p => p.id === "A");
    const paramB = result.parameters.find(p => p.id === "B");
    const paramC = result.parameters.find(p => p.id === "C");
    const paramD = result.parameters.find(p => p.id === "D");

    expect(paramA?.status).toBe("INHERITED");
    expect(paramB?.status).toBe("OVERRIDDEN");
    expect(paramC?.status).toBe("INHERITED");
    expect(paramD?.status).toBe("NEW");

    expect(result.stats).toEqual({
      inherited: 2,
      overridden: 1,
      new: 1,
      totalMerged: 4,
      baseConstraints: 0,
      overlayConstraints: 0,
    });
  });

  it("stores both configs for OVERRIDDEN parameters", () => {
    const base = {
      parameters: [
        { id: "core", name: "Core", section: "identity", config: { role: "generic tutor" } },
      ],
    };
    const overlay = {
      parameters: [
        { id: "core", name: "Core Override", section: "identity", config: { role: "QM expert" } },
      ],
    };

    const result = computeLayerDiff(base, overlay);
    const core = result.parameters.find(p => p.id === "core");

    expect(core?.status).toBe("OVERRIDDEN");
    expect(core?.config).toEqual({ role: "QM expert" });
    expect(core?.baseConfig).toEqual({ role: "generic tutor" });
  });

  it("uses overlay name for OVERRIDDEN params", () => {
    const base = { parameters: [{ id: "x", name: "Base Name", section: "s", config: {} }] };
    const overlay = { parameters: [{ id: "x", name: "Overlay Name", section: "s", config: {} }] };

    const result = computeLayerDiff(base, overlay);
    expect(result.parameters[0].name).toBe("Overlay Name");
  });

  it("handles parameterId as fallback for id", () => {
    const base = { parameters: [{ parameterId: "pid1", name: "P1", section: "s", config: { a: 1 } }] };
    const overlay = { parameters: [{ parameterId: "pid1", name: "P1 Override", section: "s", config: { a: 2 } }] };

    const result = computeLayerDiff(base, overlay);
    expect(result.parameters).toHaveLength(1);
    expect(result.parameters[0].status).toBe("OVERRIDDEN");
    expect(result.parameters[0].id).toBe("pid1");
  });

  it("stacks constraints from both base and overlay", () => {
    const base = {
      constraints: [
        { id: "c1", rule: "Never give answers directly" },
        { id: "c2", rule: "Always encourage reflection" },
      ],
    };
    const overlay = {
      constraints: [
        { id: "c3", rule: "Always reference equations" },
      ],
    };

    const result = computeLayerDiff(base, overlay);

    expect(result.constraints).toHaveLength(3);
    expect(result.constraints[0]).toMatchObject({ id: "c1", source: "BASE" });
    expect(result.constraints[1]).toMatchObject({ id: "c2", source: "BASE" });
    expect(result.constraints[2]).toMatchObject({ id: "c3", source: "OVERLAY" });

    expect(result.stats.baseConstraints).toBe(2);
    expect(result.stats.overlayConstraints).toBe(1);
  });

  it("stats sum correctly: inherited + overridden + new = totalMerged", () => {
    const base = {
      parameters: [
        { id: "1", name: "A", section: "s", config: {} },
        { id: "2", name: "B", section: "s", config: {} },
        { id: "3", name: "C", section: "s", config: {} },
        { id: "4", name: "D", section: "s", config: {} },
      ],
    };
    const overlay = {
      parameters: [
        { id: "2", name: "B2", section: "s", config: {} },
        { id: "4", name: "D2", section: "s", config: {} },
        { id: "5", name: "E", section: "s", config: {} },
        { id: "6", name: "F", section: "s", config: {} },
        { id: "7", name: "G", section: "s", config: {} },
      ],
    };

    const { stats } = computeLayerDiff(base, overlay);
    expect(stats.inherited + stats.overridden + stats.new).toBe(stats.totalMerged);
    expect(stats.inherited).toBe(2);  // 1, 3
    expect(stats.overridden).toBe(2); // 2, 4
    expect(stats.new).toBe(3);        // 5, 6, 7
    expect(stats.totalMerged).toBe(7);
  });

  it("handles constraint without id gracefully", () => {
    const base = { constraints: [{ rule: "Be nice" }] };
    const overlay = { constraints: [{ description: "Domain rule" }] };

    const result = computeLayerDiff(base, overlay);
    expect(result.constraints).toHaveLength(2);
    expect(result.constraints[0].id).toBe("base-0");
    expect(result.constraints[1].id).toBe("overlay-0");
  });

  it("handles parameters with missing config gracefully", () => {
    const base = { parameters: [{ id: "x", name: "X", section: "s" }] };
    const overlay = { parameters: [{ id: "y", name: "Y", section: "s" }] };

    const result = computeLayerDiff(base, overlay);
    expect(result.parameters).toHaveLength(2);
    expect(result.parameters[0].config).toEqual({});
    expect(result.parameters[1].config).toEqual({});
  });
});

describe("deriveBaseSlug", () => {
  it("converts TUT-001 to spec-tut-001", () => {
    expect(deriveBaseSlug("TUT-001")).toBe("spec-tut-001");
  });

  it("converts COACH-001 to spec-coach-001", () => {
    expect(deriveBaseSlug("COACH-001")).toBe("spec-coach-001");
  });

  it("converts COMPANION-001 to spec-companion-001", () => {
    expect(deriveBaseSlug("COMPANION-001")).toBe("spec-companion-001");
  });

  it("handles complex IDs", () => {
    expect(deriveBaseSlug("MY_CUSTOM--SPEC.v2")).toBe("spec-my-custom-spec-v2");
  });
});
