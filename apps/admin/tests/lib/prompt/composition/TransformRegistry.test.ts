/**
 * Tests for lib/prompt/composition/TransformRegistry.ts
 *
 * Tests the named transform function registry used by the composition
 * pipeline. Transforms are registered by name and looked up during
 * section processing.
 *
 * Covers:
 * - registerTransform(): adds a transform to the registry
 * - getTransform(): retrieves a registered transform by name
 * - hasTransform(): checks existence of a transform
 * - listTransforms(): returns all registered transform names
 * - Edge cases (missing transforms, overwriting, multiple registrations)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerTransform,
  getTransform,
  hasTransform,
  listTransforms,
} from "@/lib/prompt/composition/TransformRegistry";

// =====================================================
// HELPERS
// =====================================================

/**
 * Since the registry is a module-level singleton Map, we cannot reset it
 * between tests. We work around this by using unique transform names
 * per test to avoid cross-test pollution.
 */
let testCounter = 0;
function uniqueName(base: string): string {
  return `__test_${base}_${++testCounter}`;
}

// =====================================================
// registerTransform + getTransform
// =====================================================

describe("TransformRegistry — registerTransform + getTransform", () => {
  it("registers a transform and retrieves it by name", () => {
    const name = uniqueName("identity");
    const fn = (raw: any) => raw;

    registerTransform(name, fn);
    const retrieved = getTransform(name);

    expect(retrieved).toBe(fn);
  });

  it("returns undefined for an unregistered transform", () => {
    const result = getTransform("__nonexistent_transform_xyz__");
    expect(result).toBeUndefined();
  });

  it("overwrites a previous registration with the same name", () => {
    const name = uniqueName("overwrite");
    const fn1 = (raw: any) => "first";
    const fn2 = (raw: any) => "second";

    registerTransform(name, fn1);
    registerTransform(name, fn2);

    const retrieved = getTransform(name);
    expect(retrieved).toBe(fn2);
  });

  it("registers multiple distinct transforms", () => {
    const nameA = uniqueName("multi_a");
    const nameB = uniqueName("multi_b");
    const fnA = (raw: any) => "a";
    const fnB = (raw: any) => "b";

    registerTransform(nameA, fnA);
    registerTransform(nameB, fnB);

    expect(getTransform(nameA)).toBe(fnA);
    expect(getTransform(nameB)).toBe(fnB);
  });
});

// =====================================================
// hasTransform
// =====================================================

describe("TransformRegistry — hasTransform", () => {
  it("returns true for a registered transform", () => {
    const name = uniqueName("exists");
    registerTransform(name, (raw: any) => raw);

    expect(hasTransform(name)).toBe(true);
  });

  it("returns false for an unregistered transform", () => {
    expect(hasTransform("__nonexistent_has_check__")).toBe(false);
  });
});

// =====================================================
// listTransforms
// =====================================================

describe("TransformRegistry — listTransforms", () => {
  it("returns an array including registered transforms", () => {
    const name = uniqueName("listed");
    registerTransform(name, (raw: any) => raw);

    const list = listTransforms();
    expect(list).toContain(name);
  });

  it("returns an array of strings", () => {
    const list = listTransforms();
    expect(Array.isArray(list)).toBe(true);
    for (const item of list) {
      expect(typeof item).toBe("string");
    }
  });
});

// =====================================================
// Transform function invocation
// =====================================================

describe("TransformRegistry — transform function behavior", () => {
  it("retrieved transform can be called with correct arguments", () => {
    const name = uniqueName("callable");
    const fn = (raw: any, context: any, sectionDef: any) => ({
      transformed: true,
      rawInput: raw,
      contextExists: !!context,
      sectionId: sectionDef?.id,
    });

    registerTransform(name, fn);
    const retrieved = getTransform(name)!;

    const result = retrieved(
      { data: "test" },
      { sections: {} } as any,
      { id: "test_section" } as any,
    );

    expect(result.transformed).toBe(true);
    expect(result.rawInput).toEqual({ data: "test" });
    expect(result.contextExists).toBe(true);
    expect(result.sectionId).toBe("test_section");
  });
});
