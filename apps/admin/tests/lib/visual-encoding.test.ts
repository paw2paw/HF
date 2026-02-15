import { describe, it, expect } from "vitest";
import {
  encodeCallerNode,
  encodeTaxonomyNode,
  type EncodableNode,
} from "@/lib/graph/visual-encoding";

describe("encodeCallerNode", () => {
  const base = { baseSize: 8, baseColor: "#abc123" };

  it("simple mode returns base values for any type", () => {
    const node: EncodableNode = { type: "memory", confidence: 0.9, decayFactor: 0.3 };
    const result = encodeCallerNode(node, "simple", base.baseSize, base.baseColor);
    expect(result).toEqual({ radius: 8, opacity: 1, color: "#abc123" });
  });

  describe("memory nodes (rich)", () => {
    it("scales size with confidence", () => {
      const low = encodeCallerNode({ type: "memory", confidence: 0, decayFactor: 1 }, "rich", 5, "#fff");
      const high = encodeCallerNode({ type: "memory", confidence: 1, decayFactor: 1 }, "rich", 5, "#fff");
      expect(low.radius).toBe(5);
      expect(high.radius).toBe(9);
    });

    it("scales opacity with decayFactor", () => {
      const fresh = encodeCallerNode({ type: "memory", confidence: 0.5, decayFactor: 1 }, "rich", 5, "#fff");
      const decayed = encodeCallerNode({ type: "memory", confidence: 0.5, decayFactor: 0 }, "rich", 5, "#fff");
      expect(fresh.opacity).toBe(1);
      expect(decayed.opacity).toBe(0.4);
    });

    it("adds category ring when category is set", () => {
      const node = encodeCallerNode({ type: "memory", confidence: 0.5, category: "FACT" }, "rich", 5, "#fff");
      expect(node.ring).toBeDefined();
      expect(node.ring!.color).toBe("#7c3aed");
    });

    it("no ring for unknown category", () => {
      const node = encodeCallerNode({ type: "memory", confidence: 0.5, category: "UNKNOWN" }, "rich", 5, "#fff");
      expect(node.ring).toBeUndefined();
    });

    it("defaults confidence to 0.5 and decayFactor to 1 when undefined", () => {
      const node = encodeCallerNode({ type: "memory" }, "rich", 5, "#fff");
      expect(node.radius).toBe(7); // 5 + 0.5 * 4
      expect(node.opacity).toBe(1); // 0.4 + 1 * 0.6
    });
  });

  describe("personality nodes (rich)", () => {
    it("extreme values produce larger size", () => {
      const neutral = encodeCallerNode({ type: "personality", value: 0.5 }, "rich", 7, "#fff");
      const extreme = encodeCallerNode({ type: "personality", value: 1.0 }, "rich", 7, "#fff");
      expect(neutral.radius).toBe(7); // 7 + 0 * 6
      expect(extreme.radius).toBe(10); // 7 + 0.5 * 6
    });

    it("maps value to opacity", () => {
      const low = encodeCallerNode({ type: "personality", value: 0 }, "rich", 7, "#fff");
      const high = encodeCallerNode({ type: "personality", value: 1 }, "rich", 7, "#fff");
      expect(low.opacity).toBe(0.3);
      expect(high.opacity).toBe(1);
    });
  });

  describe("goal nodes (rich)", () => {
    it("scales size with progress", () => {
      const start = encodeCallerNode({ type: "goal", progress: 0, status: "ACTIVE" }, "rich", 9, "#fff");
      const done = encodeCallerNode({ type: "goal", progress: 1, status: "ACTIVE" }, "rich", 9, "#fff");
      expect(start.radius).toBe(9);
      expect(done.radius).toBe(15);
    });

    it("maps status to opacity", () => {
      expect(encodeCallerNode({ type: "goal", status: "ACTIVE" }, "rich", 9, "#fff").opacity).toBe(1);
      expect(encodeCallerNode({ type: "goal", status: "PAUSED" }, "rich", 9, "#fff").opacity).toBe(0.5);
      expect(encodeCallerNode({ type: "goal", status: "ARCHIVED" }, "rich", 9, "#fff").opacity).toBe(0.3);
    });

    it("adds status ring for ACTIVE/COMPLETED/PAUSED", () => {
      const active = encodeCallerNode({ type: "goal", status: "ACTIVE" }, "rich", 9, "#fff");
      expect(active.ring?.color).toBe("#22c55e");
      const completed = encodeCallerNode({ type: "goal", status: "COMPLETED" }, "rich", 9, "#fff");
      expect(completed.ring?.color).toBe("#eab308");
    });

    it("no ring for ARCHIVED", () => {
      const archived = encodeCallerNode({ type: "goal", status: "ARCHIVED" }, "rich", 9, "#fff");
      expect(archived.ring).toBeUndefined();
    });
  });

  describe("target nodes (rich)", () => {
    it("scales size and opacity with confidence", () => {
      const low = encodeCallerNode({ type: "target", confidence: 0 }, "rich", 7, "#fff");
      const high = encodeCallerNode({ type: "target", confidence: 1 }, "rich", 7, "#fff");
      expect(low.radius).toBe(7);
      expect(high.radius).toBe(11);
      expect(low.opacity).toBe(0.5);
      expect(high.opacity).toBe(1);
    });
  });

  describe("call nodes (rich)", () => {
    it("scales size with scoreCount", () => {
      const none = encodeCallerNode({ type: "call", scoreCount: 0 }, "rich", 8, "#fff");
      const many = encodeCallerNode({ type: "call", scoreCount: 10 }, "rich", 8, "#fff");
      expect(none.radius).toBe(8);
      expect(many.radius).toBe(12);
    });

    it("caps scoreCount at 10", () => {
      const capped = encodeCallerNode({ type: "call", scoreCount: 100 }, "rich", 8, "#fff");
      expect(capped.radius).toBe(12);
    });

    it("fades older calls", () => {
      const newest = encodeCallerNode({ type: "call", age: 0 }, "rich", 8, "#fff");
      const oldest = encodeCallerNode({ type: "call", age: 1 }, "rich", 8, "#fff");
      expect(newest.opacity).toBe(1);
      expect(oldest.opacity).toBe(0.5);
    });
  });

  it("unknown types return base values in rich mode", () => {
    const result = encodeCallerNode({ type: "domain" }, "rich", 14, "#3b82f6");
    expect(result).toEqual({ radius: 14, opacity: 1, color: "#3b82f6" });
  });
});

describe("encodeTaxonomyNode", () => {
  it("simple mode returns base values", () => {
    const result = encodeTaxonomyNode({ type: "parameter", anchorCount: 5 }, "simple", 8, "#fff");
    expect(result).toEqual({ radius: 8, opacity: 1, color: "#fff" });
  });

  describe("parameter nodes (rich)", () => {
    it("scales size with anchorCount", () => {
      const none = encodeTaxonomyNode({ type: "parameter", anchorCount: 0 }, "rich", 8, "#fff");
      const some = encodeTaxonomyNode({ type: "parameter", anchorCount: 5 }, "rich", 8, "#fff");
      expect(none.radius).toBe(8);
      expect(some.radius).toBe(11);
    });

    it("caps anchorCount at 5", () => {
      const capped = encodeTaxonomyNode({ type: "parameter", anchorCount: 20 }, "rich", 8, "#fff");
      expect(capped.radius).toBe(11);
    });
  });

  describe("behaviorTarget nodes (rich)", () => {
    it("scales with confidence", () => {
      const low = encodeTaxonomyNode({ type: "behaviorTarget", confidence: 0 }, "rich", 7, "#fff");
      const high = encodeTaxonomyNode({ type: "behaviorTarget", confidence: 1 }, "rich", 7, "#fff");
      expect(low.radius).toBe(7);
      expect(high.radius).toBe(11);
    });

    it("adds ring by source", () => {
      const seed = encodeTaxonomyNode({ type: "behaviorTarget", source: "SEED" }, "rich", 7, "#fff");
      expect(seed.ring?.color).toBe("#f59e0b");
      const learned = encodeTaxonomyNode({ type: "behaviorTarget", source: "LEARNED" }, "rich", 7, "#fff");
      expect(learned.ring?.color).toBe("#22c55e");
    });

    it("no ring for unknown source", () => {
      const unknown = encodeTaxonomyNode({ type: "behaviorTarget", source: "OTHER" }, "rich", 7, "#fff");
      expect(unknown.ring).toBeUndefined();
    });
  });

  describe("range nodes (rich)", () => {
    it("scales size with span", () => {
      const narrow = encodeTaxonomyNode({ type: "range", minValue: 0.4, maxValue: 0.6 }, "rich", 5, "#fff");
      const wide = encodeTaxonomyNode({ type: "range", minValue: 0, maxValue: 1 }, "rich", 5, "#fff");
      expect(narrow.radius).toBeCloseTo(5.6);
      expect(wide.radius).toBe(8);
    });

    it("defaults to 0-1 range when values undefined", () => {
      const result = encodeTaxonomyNode({ type: "range" }, "rich", 5, "#fff");
      expect(result.radius).toBe(8); // 5 + 1 * 3
    });
  });

  it("unknown types return base values in rich mode", () => {
    const result = encodeTaxonomyNode({ type: "spec" }, "rich", 10, "#10b981");
    expect(result).toEqual({ radius: 10, opacity: 1, color: "#10b981" });
  });
});
