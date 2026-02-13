import { describe, it, expect } from "vitest";
import { recoverBrokenJson } from "@/lib/utils/json-recovery";

describe("recoverBrokenJson", () => {
  describe("valid JSON passthrough", () => {
    it("parses valid JSON without recovery", () => {
      const result = recoverBrokenJson('{"score": 0.75}');
      expect(result.parsed).toEqual({ score: 0.75 });
      expect(result.recovered).toBe(false);
      expect(result.fixesApplied).toEqual([]);
    });

    it("handles arrays", () => {
      const result = recoverBrokenJson('[1, 2, 3]');
      expect(result.parsed).toEqual([1, 2, 3]);
      expect(result.recovered).toBe(false);
    });

    it("handles nested objects", () => {
      const input = '{"targets": {"BEH-WARMTH": {"v": 0.8, "c": 0.9}}}';
      const result = recoverBrokenJson(input);
      expect(result.parsed.targets["BEH-WARMTH"].v).toBe(0.8);
      expect(result.recovered).toBe(false);
    });
  });

  describe("code fence stripping", () => {
    it("strips ```json fences", () => {
      const result = recoverBrokenJson('```json\n{"a": 1}\n```');
      expect(result.parsed).toEqual({ a: 1 });
      expect(result.recovered).toBe(true);
      expect(result.fixesApplied).toContain("stripped_code_fences");
    });

    it("strips plain ``` fences", () => {
      const result = recoverBrokenJson('```\n{"a": 1}\n```');
      expect(result.parsed).toEqual({ a: 1 });
      expect(result.fixesApplied).toContain("stripped_code_fences");
    });

    it("strips fences with no newline", () => {
      const result = recoverBrokenJson('```json{"a": 1}```');
      expect(result.parsed).toEqual({ a: 1 });
    });
  });

  describe("fractional number fix", () => {
    it("fixes trailing decimal point before comma", () => {
      const result = recoverBrokenJson('{"score": 0., "other": 1}');
      expect(result.parsed).toEqual({ score: 0.0, other: 1 });
      expect(result.fixesApplied).toContain("fixed_fractional_numbers");
    });

    it("fixes trailing decimal point before closing brace", () => {
      const result = recoverBrokenJson('{"score": 0.}');
      expect(result.parsed).toEqual({ score: 0.0 });
    });

    it("fixes trailing decimal point before bracket", () => {
      const result = recoverBrokenJson('[0., 1.]');
      expect(result.parsed).toEqual([0.0, 1.0]);
    });

    it("does not modify valid decimals", () => {
      const result = recoverBrokenJson('{"score": 0.75}');
      expect(result.parsed).toEqual({ score: 0.75 });
      expect(result.fixesApplied).not.toContain("fixed_fractional_numbers");
    });
  });

  describe("single-quote recovery", () => {
    it("replaces single-quoted keys with double-quoted", () => {
      const result = recoverBrokenJson("{'score': 0.75, 'name': \"test\"}");
      expect(result.parsed).toEqual({ score: 0.75, name: "test" });
      expect(result.fixesApplied).toContain("replaced_single_quotes");
    });

    it("replaces single-quoted values with double-quoted", () => {
      const result = recoverBrokenJson('{"category": \'FACT\', "key": \'name\'}');
      expect(result.parsed).toEqual({ category: "FACT", key: "name" });
      expect(result.fixesApplied).toContain("replaced_single_quotes");
    });

    it("handles mixed single and double quotes", () => {
      const result = recoverBrokenJson("{'a': 0.5, \"b\": 'hello'}");
      expect(result.parsed.a).toBe(0.5);
      expect(result.parsed.b).toBe("hello");
    });
  });

  describe("comment stripping", () => {
    it("strips single-line JS comments", () => {
      const result = recoverBrokenJson('{"a": 1, // comment\n"b": 2}');
      expect(result.parsed).toEqual({ a: 1, b: 2 });
      expect(result.fixesApplied).toContain("stripped_comments");
    });

    it("strips multi-line JS comments", () => {
      const result = recoverBrokenJson('{"a": 1, /* block */ "b": 2}');
      expect(result.parsed).toEqual({ a: 1, b: 2 });
      expect(result.fixesApplied).toContain("stripped_comments");
    });
  });

  describe("odd-quote recovery", () => {
    it("removes incomplete trailing entry with unterminated string", () => {
      const result = recoverBrokenJson('{"a": 0.5, "b": "trunca');
      expect(result.parsed).toEqual({ a: 0.5 });
      expect(result.fixesApplied).toContain("removed_incomplete_trailing_entry");
    });
  });

  describe("trailing comma removal", () => {
    it("removes trailing comma before closing brace", () => {
      const result = recoverBrokenJson('{"a": 1, "b": 2,}');
      expect(result.parsed).toEqual({ a: 1, b: 2 });
      expect(result.fixesApplied).toContain("removed_trailing_commas");
    });

    it("removes trailing comma before closing bracket", () => {
      const result = recoverBrokenJson('[1, 2, 3,]');
      expect(result.parsed).toEqual([1, 2, 3]);
    });
  });

  describe("incomplete key-value fix", () => {
    it("adds default value for key with no value at end", () => {
      const result = recoverBrokenJson('{"a": 0.5, "b":');
      expect(result.parsed.a).toBe(0.5);
      expect(result.parsed.b).toBe(0.5);
      expect(result.fixesApplied).toContain("fixed_incomplete_key_value");
    });
  });

  describe("nested incomplete fix", () => {
    it("fixes nested key-value truncation", () => {
      const result = recoverBrokenJson('{"scores": {"warmth": 0.8, "formality": {"sub"');
      expect(result.parsed.scores.warmth).toBe(0.8);
      expect(result.parsed.scores.formality.sub).toBe(0.5);
      expect(result.fixesApplied).toContain("fixed_nested_incomplete");
    });
  });

  describe("missing closers", () => {
    it("adds missing closing brace", () => {
      const result = recoverBrokenJson('{"a": 1');
      expect(result.parsed).toEqual({ a: 1 });
      expect(result.fixesApplied).toContain("added_missing_closers");
    });

    it("adds missing closing bracket", () => {
      const result = recoverBrokenJson('[1, 2, 3');
      expect(result.parsed).toEqual([1, 2, 3]);
      expect(result.fixesApplied).toContain("added_missing_closers");
    });

    it("adds multiple missing closers", () => {
      const result = recoverBrokenJson('{"targets": {"BEH-WARMTH": {"v": 0.8}');
      expect(result.parsed.targets["BEH-WARMTH"].v).toBe(0.8);
    });

    it("handles nested arrays and objects", () => {
      const result = recoverBrokenJson('{"data": [{"a": 1}, {"b": 2}');
      expect(result.parsed.data).toHaveLength(2);
    });
  });

  describe("combination of fixes", () => {
    it("handles code fence + fractional + missing closer", () => {
      const result = recoverBrokenJson('```json\n{"score": 0., "val": 1');
      expect(result.parsed).toEqual({ score: 0.0, val: 1 });
      expect(result.fixesApplied).toContain("stripped_code_fences");
      expect(result.fixesApplied).toContain("fixed_fractional_numbers");
      expect(result.fixesApplied).toContain("added_missing_closers");
    });

    it("handles trailing comma + missing closer", () => {
      // Trailing comma before missing closer — step 5 treats "2," as incomplete trailing
      // then step 7 adds the missing brace
      const result = recoverBrokenJson('{"a": 1, "b": 2, "c": 3,}');
      expect(result.parsed).toEqual({ a: 1, b: 2, c: 3 });
    });

    it("recovers typical truncated LLM output", () => {
      const truncated = '{"scores": {"openness": {"s": 0.82, "c": 0.9}, "conscientiousness": {"s": 0.65, "c": 0.';
      const result = recoverBrokenJson(truncated, "test");
      expect(result.parsed.scores.openness.s).toBe(0.82);
      expect(result.recovered).toBe(true);
    });
  });

  describe("unrecoverable input", () => {
    it("throws on complete garbage", () => {
      expect(() => recoverBrokenJson("not json at all")).toThrow();
    });

    it("throws on empty string", () => {
      expect(() => recoverBrokenJson("")).toThrow();
    });

    it("throws on partial non-JSON", () => {
      expect(() => recoverBrokenJson("The result is:")).toThrow();
    });
  });

  describe("generic typing", () => {
    it("supports typed results", () => {
      interface Scores { warmth: number }
      const result = recoverBrokenJson<Scores>('{"warmth": 0.8}');
      expect(result.parsed.warmth).toBe(0.8);
    });
  });
});
