/**
 * Tests for lib/prompt/PromptTemplateCompiler.ts
 *
 * Tests the template compilation engine that renders Mustache-style
 * prompt templates with variable substitution, conditionals, loops,
 * and section blocks.
 *
 * Covers:
 * - renderTemplate(): the core template engine (pure function)
 * - compileTemplate(): convenience wrapper with typed context
 * - Variable substitution (simple, nested, missing)
 * - Conditionals ({{#if}}, {{#unless}})
 * - Loops ({{#each}})
 * - Section blocks ({{#sectionName}})
 * - Edge cases (empty templates, unmatched tags, whitespace cleanup)
 */

import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  compileTemplate,
  CallerMemory,
} from "@/lib/prompt/PromptTemplateCompiler";

// =====================================================
// HELPERS
// =====================================================

function makeMemory(
  category: string,
  key: string,
  value: string,
  confidence = 0.8
): CallerMemory {
  return { category, key, value, confidence };
}

// =====================================================
// renderTemplate — Variable Substitution
// =====================================================

describe("renderTemplate — variable substitution", () => {
  it("substitutes simple top-level variables", () => {
    const result = renderTemplate("Hello {{name}}, you scored {{score}}", {
      name: "Alice",
      score: 95,
    });
    expect(result).toBe("Hello Alice, you scored 95");
  });

  it("substitutes nested dot-notation variables", () => {
    const result = renderTemplate("Parameter: {{param.name}} ({{param.definition}})", {
      param: { name: "warmth", definition: "conversational warmth level" },
    });
    expect(result).toBe("Parameter: warmth (conversational warmth level)");
  });

  it("substitutes deeply nested variables", () => {
    const result = renderTemplate("{{a.b.c}}", {
      a: { b: { c: "deep value" } },
    });
    expect(result).toBe("deep value");
  });

  it("removes unresolved variables (graceful fallback)", () => {
    const result = renderTemplate("Value: {{missing}} end", {});
    expect(result).toBe("Value:  end");
  });

  it("removes partially resolved nested variables", () => {
    const result = renderTemplate("{{a.b.c}}", { a: { b: {} } });
    expect(result).toBe("");
  });

  it("serializes object values as JSON", () => {
    const result = renderTemplate("Data: {{data}}", {
      data: { key: "val" },
    });
    expect(result).toBe('Data: {"key":"val"}');
  });

  it("converts numbers to strings", () => {
    const result = renderTemplate("Score: {{value}}", { value: 42 });
    expect(result).toBe("Score: 42");
  });

  it("converts boolean to string", () => {
    const result = renderTemplate("Active: {{flag}}", { flag: true });
    expect(result).toBe("Active: true");
  });

  it("replaces null and undefined with empty string", () => {
    const result = renderTemplate("A:{{a}} B:{{b}}", { a: null, b: undefined });
    expect(result).toBe("A: B:");
  });
});

// =====================================================
// renderTemplate — Conditionals
// =====================================================

describe("renderTemplate — conditionals ({{#if}})", () => {
  it("renders content when condition is truthy boolean", () => {
    const result = renderTemplate("{{#if high}}Be warm{{/if}}", { high: true });
    expect(result).toBe("Be warm");
  });

  it("removes content when condition is falsy boolean", () => {
    const result = renderTemplate("{{#if high}}Be warm{{/if}}", { high: false });
    expect(result).toBe("");
  });

  it("treats non-zero numbers as truthy", () => {
    const result = renderTemplate("{{#if count}}Has items{{/if}}", { count: 5 });
    expect(result).toBe("Has items");
  });

  it("treats zero as falsy", () => {
    const result = renderTemplate("{{#if count}}Has items{{/if}}", { count: 0 });
    expect(result).toBe("");
  });

  it("treats non-empty strings as truthy", () => {
    const result = renderTemplate("{{#if name}}Hello {{name}}{{/if}}", {
      name: "Alice",
    });
    expect(result).toBe("Hello Alice");
  });

  it("treats empty strings as falsy", () => {
    const result = renderTemplate("{{#if name}}Hello{{/if}}", { name: "" });
    expect(result).toBe("");
  });

  it("treats non-empty arrays as truthy", () => {
    const result = renderTemplate("{{#if items}}Has data{{/if}}", {
      items: [1, 2, 3],
    });
    expect(result).toBe("Has data");
  });

  it("treats empty arrays as falsy", () => {
    const result = renderTemplate("{{#if items}}Has data{{/if}}", {
      items: [],
    });
    expect(result).toBe("");
  });

  it("treats non-empty objects as truthy", () => {
    const result = renderTemplate("{{#if config}}Configured{{/if}}", {
      config: { a: 1 },
    });
    expect(result).toBe("Configured");
  });

  it("treats empty objects as falsy", () => {
    const result = renderTemplate("{{#if config}}Configured{{/if}}", {
      config: {},
    });
    expect(result).toBe("");
  });

  it("treats undefined conditions as falsy", () => {
    const result = renderTemplate("{{#if missing}}Content{{/if}}", {});
    expect(result).toBe("");
  });

  it("supports nested path conditions", () => {
    const result = renderTemplate("{{#if user.active}}Active{{/if}}", {
      user: { active: true },
    });
    expect(result).toBe("Active");
  });

  it("handles multiple conditionals in one template", () => {
    const template =
      "{{#if high}}HIGH{{/if}} {{#if medium}}MED{{/if}} {{#if low}}LOW{{/if}}";
    const result = renderTemplate(template, {
      high: false,
      medium: true,
      low: false,
    });
    // Leading space from first empty conditional gets trimmed
    expect(result).toBe("MED");
  });
});

// =====================================================
// renderTemplate — Inverse Conditionals
// =====================================================

describe("renderTemplate — inverse conditionals ({{#unless}})", () => {
  it("renders content when condition is falsy", () => {
    const result = renderTemplate("{{#unless active}}Inactive{{/unless}}", {
      active: false,
    });
    expect(result).toBe("Inactive");
  });

  it("removes content when condition is truthy", () => {
    const result = renderTemplate("{{#unless active}}Inactive{{/unless}}", {
      active: true,
    });
    expect(result).toBe("");
  });

  it("renders content when condition is undefined", () => {
    const result = renderTemplate("{{#unless missing}}Default{{/unless}}", {});
    expect(result).toBe("Default");
  });

  it("supports nested path conditions", () => {
    const result = renderTemplate(
      "{{#unless user.premium}}Free tier{{/unless}}",
      { user: { premium: false } }
    );
    expect(result).toBe("Free tier");
  });
});

// =====================================================
// renderTemplate — Loops
// =====================================================

describe("renderTemplate — loops ({{#each}})", () => {
  it("iterates over array of objects using this.property", () => {
    const result = renderTemplate(
      "{{#each items}}Item: {{this.name}}\n{{/each}}",
      { items: [{ name: "A" }, { name: "B" }, { name: "C" }] }
    );
    expect(result).toContain("Item: A");
    expect(result).toContain("Item: B");
    expect(result).toContain("Item: C");
  });

  it("iterates over array of primitives using {{this}}", () => {
    const result = renderTemplate(
      "{{#each tags}}{{this}}\n{{/each}}",
      { tags: ["red", "green", "blue"] }
    );
    expect(result).toContain("red");
    expect(result).toContain("green");
    expect(result).toContain("blue");
  });

  it("provides @index for each item", () => {
    const result = renderTemplate(
      "{{#each items}}{{@index}}: {{this.name}}\n{{/each}}",
      { items: [{ name: "First" }, { name: "Second" }] }
    );
    expect(result).toContain("0: First");
    expect(result).toContain("1: Second");
  });

  it("renders nothing for empty arrays", () => {
    const result = renderTemplate("{{#each items}}{{this}}{{/each}}", {
      items: [],
    });
    expect(result).toBe("");
  });

  it("renders nothing for non-array values", () => {
    const result = renderTemplate("{{#each items}}{{this}}{{/each}}", {
      items: "not-an-array",
    });
    expect(result).toBe("");
  });

  it("renders nothing for undefined paths", () => {
    const result = renderTemplate("{{#each missing}}{{this}}{{/each}}", {});
    expect(result).toBe("");
  });

  it("supports nested paths in {{#each}}", () => {
    const result = renderTemplate(
      "{{#each memories.facts}}{{this.key}}\n{{/each}}",
      { memories: { facts: [{ key: "name" }, { key: "age" }] } }
    );
    expect(result).toContain("name");
    expect(result).toContain("age");
  });
});

// =====================================================
// renderTemplate — Section Blocks
// =====================================================

describe("renderTemplate — section blocks ({{#sectionName}})", () => {
  it("scopes variables to an object section", () => {
    const result = renderTemplate(
      "{{#param}}Name: {{name}}, Def: {{definition}}{{/param}}",
      { param: { name: "warmth", definition: "how warm" } }
    );
    expect(result).toBe("Name: warmth, Def: how warm");
  });

  it("falls through to global data for unscoped variables", () => {
    const result = renderTemplate(
      "{{#param}}{{name}} (global: {{label}}){{/param}}",
      { param: { name: "warmth" }, label: "high" }
    );
    expect(result).toBe("warmth (global: high)");
  });

  it("removes section when data is falsy", () => {
    const result = renderTemplate("{{#param}}Content{{/param}}", {
      param: null,
    });
    expect(result).toBe("");
  });

  it("removes section when data is undefined", () => {
    const result = renderTemplate("{{#missing}}Content{{/missing}}", {});
    expect(result).toBe("");
  });

  it("iterates when section data is an array", () => {
    const result = renderTemplate(
      "{{#items}}{{name}}\n{{/items}}",
      { items: [{ name: "A" }, { name: "B" }] }
    );
    expect(result).toContain("A");
    expect(result).toContain("B");
  });

  it("renders content for truthy primitive sections", () => {
    const result = renderTemplate("{{#active}}Active!{{/active}}", {
      active: true,
    });
    expect(result).toBe("Active!");
  });

  it("supports nested dot-path sections", () => {
    const result = renderTemplate(
      "{{#a.b}}Value: {{c}}{{/a.b}}",
      { a: { b: { c: "nested" } } }
    );
    expect(result).toBe("Value: nested");
  });
});

// =====================================================
// renderTemplate — Edge Cases
// =====================================================

describe("renderTemplate — edge cases", () => {
  it("handles empty template", () => {
    const result = renderTemplate("", { value: "test" });
    expect(result).toBe("");
  });

  it("handles template with no variables", () => {
    const result = renderTemplate("Plain text with no variables.", {});
    expect(result).toBe("Plain text with no variables.");
  });

  it("cleans up remaining unmatched tags", () => {
    const result = renderTemplate("Before {{unknown.tag}} after", {});
    expect(result).toBe("Before  after");
  });

  it("collapses excessive newlines to double newlines", () => {
    const result = renderTemplate("Line1\n\n\n\n\nLine2", {});
    expect(result).toBe("Line1\n\nLine2");
  });

  it("trims leading and trailing whitespace", () => {
    const result = renderTemplate("  \n  Hello  \n  ", {});
    expect(result).toBe("Hello");
  });

  it("handles multiline templates with conditionals", () => {
    const template = `The caller scores {{value}} on {{param.name}}.
{{#if high}}Be warm and conversational.{{/if}}
{{#if low}}Be direct and efficient.{{/if}}`;

    const result = renderTemplate(template, {
      value: "0.80",
      param: { name: "warmth" },
      high: true,
      low: false,
    });

    expect(result).toContain("The caller scores 0.80 on warmth.");
    expect(result).toContain("Be warm and conversational.");
    expect(result).not.toContain("Be direct and efficient.");
  });

  it("handles combined conditionals, loops, and substitution", () => {
    const template = `Score: {{value}} ({{label}})
{{#if hasMemories}}Memories:
{{#each memories.all}}  - {{this.key}}: {{this.value}}
{{/each}}{{/if}}
{{#unless hasMemories}}No memories yet.{{/unless}}`;

    const result = renderTemplate(template, {
      value: "0.65",
      label: "medium",
      hasMemories: true,
      memories: {
        all: [
          { key: "name", value: "Alice" },
          { key: "goal", value: "learn French" },
        ],
      },
    });

    expect(result).toContain("Score: 0.65 (medium)");
    expect(result).toContain("- name: Alice");
    expect(result).toContain("- goal: learn French");
    expect(result).not.toContain("No memories yet");
  });
});

// =====================================================
// compileTemplate — Typed Context Wrapper
// =====================================================

describe("compileTemplate", () => {
  it("compiles a basic template with value and parameter", () => {
    const result = compileTemplate(
      "Score: {{value}} on {{param.name}} ({{label}})",
      { value: 0.85, parameterName: "warmth" }
    );
    expect(result).toContain("Score: 0.85");
    expect(result).toContain("on warmth");
    expect(result).toContain("(high)");
  });

  it("sets label to 'high' when value >= 0.7", () => {
    const result = compileTemplate("{{label}}", { value: 0.7 });
    expect(result).toBe("high");
  });

  it("sets label to 'medium' when 0.3 <= value < 0.7", () => {
    const result = compileTemplate("{{label}}", { value: 0.5 });
    expect(result).toBe("medium");
  });

  it("sets label to 'low' when value < 0.3", () => {
    const result = compileTemplate("{{label}}", { value: 0.1 });
    expect(result).toBe("low");
  });

  it("sets label to empty string when value is undefined", () => {
    const result = compileTemplate("Label:{{label}}:", {});
    expect(result).toBe("Label::");
  });

  it("sets high/medium/low boolean flags correctly for high value", () => {
    const template = "{{#if high}}H{{/if}}{{#if medium}}M{{/if}}{{#if low}}L{{/if}}";
    const result = compileTemplate(template, { value: 0.9 });
    expect(result).toBe("H");
  });

  it("sets high/medium/low boolean flags correctly for medium value", () => {
    const template = "{{#if high}}H{{/if}}{{#if medium}}M{{/if}}{{#if low}}L{{/if}}";
    const result = compileTemplate(template, { value: 0.5 });
    expect(result).toBe("M");
  });

  it("sets high/medium/low boolean flags correctly for low value", () => {
    const template = "{{#if high}}H{{/if}}{{#if medium}}M{{/if}}{{#if low}}L{{/if}}";
    const result = compileTemplate(template, { value: 0.1 });
    expect(result).toBe("L");
  });

  it("includes parameter definition and labels", () => {
    const result = compileTemplate(
      "{{param.definition}} — High: {{param.highLabel}}, Low: {{param.lowLabel}}",
      {
        value: 0.5,
        parameterName: "warmth",
        parameterDefinition: "Conversational warmth",
        highLabel: "Very warm",
        lowLabel: "Very cold",
      }
    );
    expect(result).toContain("Conversational warmth");
    expect(result).toContain("Very warm");
    expect(result).toContain("Very cold");
  });

  it("defaults highLabel and lowLabel to 'High' and 'Low'", () => {
    const result = compileTemplate(
      "{{param.highLabel}} / {{param.lowLabel}}",
      { value: 0.5 }
    );
    expect(result).toBe("High / Low");
  });

  it("includes memories grouped by category", () => {
    const memories: CallerMemory[] = [
      makeMemory("FACT", "name", "Alice"),
      makeMemory("PREFERENCE", "style", "visual"),
    ];

    const result = compileTemplate(
      "{{#if hasMemories}}Facts: {{#each memories.facts}}{{this.value}} {{/each}}Prefs: {{#each memories.preferences}}{{this.value}} {{/each}}{{/if}}",
      { value: 0.5, memories }
    );

    expect(result).toContain("Facts:");
    expect(result).toContain("Alice");
    expect(result).toContain("Prefs:");
    expect(result).toContain("visual");
  });

  it("sets hasMemories to false when no memories provided", () => {
    const result = compileTemplate(
      "{{#if hasMemories}}HAS{{/if}}{{#unless hasMemories}}NONE{{/unless}}",
      { value: 0.5 }
    );
    expect(result).toBe("NONE");
  });

  it("sets hasMemories to true when memories are provided", () => {
    const result = compileTemplate(
      "{{#if hasMemories}}HAS{{/if}}{{#unless hasMemories}}NONE{{/unless}}",
      { value: 0.5, memories: [makeMemory("FACT", "k", "v")] }
    );
    expect(result).toBe("HAS");
  });

  it("includes user name when provided", () => {
    const result = compileTemplate("Hello {{user.name}}", {
      value: 0.5,
      userName: "Bob",
    });
    expect(result).toBe("Hello Bob");
  });

  it("handles missing user name gracefully", () => {
    const result = compileTemplate("Hello {{user.name}}!", { value: 0.5 });
    expect(result).toBe("Hello !");
  });

  it("formats value to 2 decimal places", () => {
    const result = compileTemplate("{{value}}", { value: 0.8 });
    expect(result).toBe("0.80");
  });

  it("handles undefined value (no value context)", () => {
    const result = compileTemplate("Val:{{value}}:", {});
    expect(result).toBe("Val::");
  });
});

// =====================================================
// compileTemplate — boundary values
// =====================================================

describe("compileTemplate — boundary values", () => {
  it("value exactly 0.7 is classified as high", () => {
    const result = compileTemplate("{{label}}", { value: 0.7 });
    expect(result).toBe("high");
  });

  it("value exactly 0.3 is classified as medium", () => {
    const result = compileTemplate("{{label}}", { value: 0.3 });
    expect(result).toBe("medium");
  });

  it("value just below 0.3 is classified as low", () => {
    const result = compileTemplate("{{label}}", { value: 0.29 });
    expect(result).toBe("low");
  });

  it("value just below 0.7 is classified as medium", () => {
    const result = compileTemplate("{{label}}", { value: 0.69 });
    expect(result).toBe("medium");
  });

  it("value of 0 is classified as low", () => {
    const result = compileTemplate("{{label}}", { value: 0 });
    expect(result).toBe("low");
  });

  it("value of 1.0 is classified as high", () => {
    const result = compileTemplate("{{label}}", { value: 1.0 });
    expect(result).toBe("high");
  });
});

// =====================================================
// compileTemplate — realistic prompt template
// =====================================================

describe("compileTemplate — realistic prompt scenarios", () => {
  it("renders a full tutor prompt template", () => {
    const template = `The caller scores {{value}} on {{param.name}} ({{label}}).
{{param.definition}}

{{#if high}}Adapt your style to be warm and conversational. The caller responds well to {{param.highLabel}}.{{/if}}
{{#if low}}Be more direct and structured. The caller prefers {{param.lowLabel}}.{{/if}}

{{#if hasMemories}}Known facts about the caller:
{{#each memories.facts}}- {{this.key}}: {{this.value}}
{{/each}}{{/if}}
{{#unless hasMemories}}No prior information about this caller.{{/unless}}`;

    const result = compileTemplate(template, {
      value: 0.85,
      parameterName: "Warmth",
      parameterDefinition: "How conversationally warm and friendly the caller prefers interaction",
      highLabel: "warm, friendly exchanges",
      lowLabel: "efficient, to-the-point responses",
      memories: [
        makeMemory("FACT", "name", "Alice"),
        makeMemory("FACT", "learning_goal", "French conversation"),
        makeMemory("PREFERENCE", "pace", "slow"),
      ],
    });

    expect(result).toContain("scores 0.85 on Warmth (high)");
    expect(result).toContain("warm and conversational");
    expect(result).toContain("warm, friendly exchanges");
    expect(result).not.toContain("direct and structured");
    expect(result).toContain("name: Alice");
    expect(result).toContain("learning_goal: French conversation");
    expect(result).not.toContain("No prior information");
  });

  it("renders a low-score prompt with no memories", () => {
    const template = `Score: {{value}} ({{label}})
{{#if high}}Engage warmly.{{/if}}
{{#if low}}Be concise.{{/if}}
{{#unless hasMemories}}First interaction.{{/unless}}`;

    const result = compileTemplate(template, {
      value: 0.15,
      parameterName: "Sociability",
    });

    expect(result).toContain("Score: 0.15 (low)");
    expect(result).not.toContain("Engage warmly");
    expect(result).toContain("Be concise");
    expect(result).toContain("First interaction");
  });
});
