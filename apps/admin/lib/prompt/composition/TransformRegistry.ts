/**
 * Transform Registry
 *
 * Named transform functions that process raw loaded data into
 * section-specific output. Each transform file registers its
 * functions here.
 */

import type { TransformFn } from "./types";

const registry = new Map<string, TransformFn>();

export function registerTransform(name: string, fn: TransformFn) {
  registry.set(name, fn);
}

export function getTransform(name: string): TransformFn | undefined {
  return registry.get(name);
}

export function hasTransform(name: string): boolean {
  return registry.has(name);
}

export function listTransforms(): string[] {
  return Array.from(registry.keys());
}
