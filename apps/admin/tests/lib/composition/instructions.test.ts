import { describe, it, expect } from "vitest";
import { narrativeFrame } from "@/lib/prompt/composition/transforms/instructions";

describe("narrativeFrame", () => {
  it("returns empty string for no memories", () => {
    expect(narrativeFrame([], {})).toBe("");
  });

  it("returns empty string for null-ish memories", () => {
    expect(narrativeFrame(null as any, {})).toBe("");
  });

  it("uses spec-provided templates for matching keys", () => {
    const memories = [
      { key: "location", value: "London", category: "FACT" },
      { key: "occupation", value: "teacher", category: "FACT" },
    ];
    const specConfig = {
      narrativeTemplates: {
        location: "They live in {value}",
        occupation: "They work as {value}",
      },
    };
    const result = narrativeFrame(memories, specConfig);
    expect(result).toBe("They live in London. They work as teacher.");
  });

  it("falls back to generic template for unknown keys", () => {
    const memories = [
      { key: "favorite_color", value: "blue", category: "PREFERENCE" },
    ];
    const specConfig = {
      narrativeTemplates: {}, // no matching template
    };
    const result = narrativeFrame(memories, specConfig);
    expect(result).toBe("Their favorite color is blue.");
  });

  it("uses custom generic template from spec", () => {
    const memories = [
      { key: "pet_name", value: "Rex", category: "FACT" },
    ];
    const specConfig = {
      narrativeTemplates: {},
      genericNarrativeTemplate: "Note: {key} = {value}",
    };
    const result = narrativeFrame(memories, specConfig);
    expect(result).toBe("Note: pet name = Rex.");
  });

  it("mixes spec templates and generic fallback", () => {
    const memories = [
      { key: "location", value: "Berlin", category: "FACT" },
      { key: "hobby", value: "cycling", category: "PREFERENCE" },
      { key: "children_count", value: "2", category: "FACT" },
      { key: "unknown_thing", value: "something", category: "CONTEXT" },
    ];
    const specConfig = {
      narrativeTemplates: {
        location: "They live in {value}",
        hobby: "They enjoy {value}",
        children_count: "They have {value} children",
      },
      genericNarrativeTemplate: "Their {key} is {value}",
    };
    const result = narrativeFrame(memories, specConfig);
    expect(result).toBe(
      "They live in Berlin. They enjoy cycling. They have 2 children. Their unknown thing is something."
    );
  });

  it("normalizes key casing and spaces", () => {
    const memories = [
      { key: "Favorite Food", value: "pizza", category: "PREFERENCE" },
    ];
    const specConfig = {
      narrativeTemplates: {
        favorite_food: "They love eating {value}",
      },
    };
    const result = narrativeFrame(memories, specConfig);
    expect(result).toBe("They love eating pizza.");
  });

  it("handles single memory", () => {
    const memories = [
      { key: "age", value: "34", category: "FACT" },
    ];
    const specConfig = {
      narrativeTemplates: {
        age: "They are {value} years old",
      },
    };
    const result = narrativeFrame(memories, specConfig);
    expect(result).toBe("They are 34 years old.");
  });

  it("works with no spec config at all", () => {
    const memories = [
      { key: "name", value: "Alice", category: "FACT" },
    ];
    const result = narrativeFrame(memories, {});
    expect(result).toBe("Their name is Alice.");
  });

  it("handles {value} appearing multiple times in template", () => {
    const memories = [
      { key: "language", value: "French", category: "FACT" },
    ];
    const specConfig = {
      narrativeTemplates: {
        language: "They speak {value} and prefer {value} content",
      },
    };
    const result = narrativeFrame(memories, specConfig);
    expect(result).toBe("They speak French and prefer French content.");
  });
});
