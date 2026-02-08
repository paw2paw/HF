/**
 * Composition Pipeline
 *
 * Declarative, spec-driven prompt composition system.
 * COMP-001 spec sections drive data loading, transformation, and assembly.
 */

export { executeComposition, getDefaultSections } from "./CompositionExecutor";
export type { CompositionResult, CompositionSectionDef, AssembledContext } from "./types";
