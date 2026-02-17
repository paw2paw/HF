/**
 * AI Call Annotation Coverage Test
 *
 * Enforces CLAUDE.md principle #9: every AI call must have an @ai-call annotation.
 *
 * Scans all .ts files for:
 *   1. Every getConfiguredMeteredAICompletion(Stream) call has an @ai-call annotation within 5 lines above
 *   2. Every @ai-call annotation has a matching entry in AI_CALL_POINTS (ai-config route)
 *   3. Every AI_CALL_POINTS entry has at least one @ai-call annotation in source
 *   4. Annotation format: // @ai-call <callPoint> — <description> | config: /x/ai-config
 *
 * This prevents AI calls from slipping through without documentation,
 * similar to how route-auth-coverage.test.ts enforces auth on every route.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// =====================================================
// CONFIG
// =====================================================

const PROJECT_ROOT = process.cwd();
const SCAN_DIRS = [
  path.join(PROJECT_ROOT, "app"),
  path.join(PROJECT_ROOT, "lib"),
];

/** Files that define the metering wrapper itself — not call sites */
const WRAPPER_FILES = new Set([
  "lib/metering/instrumented-ai.ts",
  "lib/ai/client.ts",
]);

/** Annotation format: // @ai-call <callPoint> — <description> | config: /x/ai-config */
const ANNOTATION_PATTERN = /\/\/\s*@ai-call\s+([\w.\-{|}]+)\s*[—–-]\s*(.+?)\s*\|\s*config:\s*\/x\/ai-config/;

/** AI call function names */
const AI_CALL_FUNCTIONS = [
  "getConfiguredMeteredAICompletion(",
  "getConfiguredMeteredAICompletionStream(",
];

/** Max lines above call site to search for annotation (generous to allow prompt building between annotation and call) */
const ANNOTATION_SEARCH_WINDOW = 15;

// =====================================================
// HELPERS
// =====================================================

interface AICallSite {
  file: string;       // relative path
  line: number;       // 1-indexed
  functionName: string;
  annotationFound: boolean;
  annotationCallPoint?: string;
  annotationDescription?: string;
}

interface AICallAnnotation {
  file: string;       // relative path
  line: number;
  callPoint: string;
  description: string;
}

/**
 * Expand dynamic call point patterns like "chat.{chat|data|spec|call}"
 * into ["chat.chat", "chat.data", "chat.spec", "chat.call"]
 */
function expandDynamicCallPoint(callPoint: string): string[] {
  const match = callPoint.match(/^(.+?)\{(.+?)\}(.*)$/);
  if (!match) return [callPoint];

  const [, prefix, options, suffix] = match;
  return options.split("|").map((opt) => `${prefix}${opt}${suffix}`);
}

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        walk(fullPath);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        results.push(fullPath);
      }
    }
  }
  walk(dir);
  return results;
}

function scanFile(filePath: string): { callSites: AICallSite[]; annotations: AICallAnnotation[] } {
  const relative = path.relative(PROJECT_ROOT, filePath);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const callSites: AICallSite[] = [];
  const annotations: AICallAnnotation[] = [];

  // Skip wrapper definition files
  if (WRAPPER_FILES.has(relative)) return { callSites, annotations };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for annotations
    const annotationMatch = line.match(ANNOTATION_PATTERN);
    if (annotationMatch) {
      annotations.push({
        file: relative,
        line: lineNum,
        callPoint: annotationMatch[1],
        description: annotationMatch[2].trim(),
      });
    }

    // Check for AI call sites
    for (const fnName of AI_CALL_FUNCTIONS) {
      if (line.includes(fnName)) {
        // Search upward for annotation
        let foundAnnotation = false;
        let annotationCallPoint: string | undefined;
        let annotationDescription: string | undefined;

        for (let j = i - 1; j >= Math.max(0, i - ANNOTATION_SEARCH_WINDOW); j--) {
          const prevMatch = lines[j].match(ANNOTATION_PATTERN);
          if (prevMatch) {
            foundAnnotation = true;
            annotationCallPoint = prevMatch[1];
            annotationDescription = prevMatch[2].trim();
            break;
          }
        }

        callSites.push({
          file: relative,
          line: lineNum,
          functionName: fnName.replace("(", ""),
          annotationFound: foundAnnotation,
          annotationCallPoint,
          annotationDescription,
        });
      }
    }
  }

  return { callSites, annotations };
}

// =====================================================
// TESTS
// =====================================================

describe("AI call annotation coverage", () => {
  // Scan all files
  const allFiles = SCAN_DIRS.flatMap((dir) => findTsFiles(dir));
  const allCallSites: AICallSite[] = [];
  const allAnnotations: AICallAnnotation[] = [];

  for (const file of allFiles) {
    const { callSites, annotations } = scanFile(file);
    allCallSites.push(...callSites);
    allAnnotations.push(...annotations);
  }

  it("finds at least 20 AI call sites (sanity check)", () => {
    expect(allCallSites.length).toBeGreaterThanOrEqual(20);
  });

  it("finds at least 20 @ai-call annotations (sanity check)", () => {
    expect(allAnnotations.length).toBeGreaterThanOrEqual(20);
  });

  it("every AI call site has an @ai-call annotation within 5 lines above", () => {
    const missing = allCallSites.filter((cs) => !cs.annotationFound);

    if (missing.length > 0) {
      const details = missing
        .map((cs) => `  ${cs.file}:${cs.line} — ${cs.functionName}`)
        .join("\n");
      expect.fail(
        `${missing.length} AI call site(s) missing @ai-call annotation:\n${details}\n\n` +
        `Add: // @ai-call <callPoint> — <description> | config: /x/ai-config`
      );
    }
  });

  it("every @ai-call annotation has a matching entry in AI_CALL_POINTS", async () => {
    // Dynamic import to get the live AI_CALL_POINTS array
    const { AI_CALL_POINTS } = await import("@/app/api/ai-config/route");
    const registeredCallPoints = new Set(AI_CALL_POINTS.map((cp: any) => cp.callPoint));

    // Expand dynamic annotations and check each expanded call point
    const unregistered: AICallAnnotation[] = [];

    for (const annotation of allAnnotations) {
      const expanded = expandDynamicCallPoint(annotation.callPoint);
      // If all expanded values are registered, annotation is covered
      const allRegistered = expanded.every((cp) => registeredCallPoints.has(cp));
      if (!allRegistered) {
        unregistered.push(annotation);
      }
    }

    if (unregistered.length > 0) {
      const details = unregistered
        .map((a) => `  ${a.file}:${a.line} — @ai-call ${a.callPoint}`)
        .join("\n");
      expect.fail(
        `${unregistered.length} @ai-call annotation(s) not in AI_CALL_POINTS:\n${details}\n\n` +
        `Add them to AI_CALL_POINTS in app/api/ai-config/route.ts`
      );
    }
  });

  it("every AI_CALL_POINTS entry has at least one @ai-call in source", async () => {
    const { AI_CALL_POINTS } = await import("@/app/api/ai-config/route");

    // Expand dynamic annotations like "chat.{chat|data|spec|call}" into concrete call points
    const annotatedCallPoints = new Set<string>();
    for (const annotation of allAnnotations) {
      for (const cp of expandDynamicCallPoint(annotation.callPoint)) {
        annotatedCallPoints.add(cp);
      }
    }

    // Call points that are config-only (no direct AI call in source) are excluded
    const CONFIG_ONLY_CALL_POINTS = new Set([
      "compose.prompt",       // COMPOSE stage uses template assembly, not AI
      "parameter.enrich",     // Parameter enrichment — not yet wired
      "chat.stream",          // Legacy fallback — chat uses chat.{chat|data|spec|call} modes
      "workflow.step",        // Per-step guidance — planned, not yet wired
    ]);

    const orphaned = AI_CALL_POINTS
      .filter((cp: any) => !CONFIG_ONLY_CALL_POINTS.has(cp.callPoint))
      .filter((cp: any) => !annotatedCallPoints.has(cp.callPoint));

    if (orphaned.length > 0) {
      const details = orphaned
        .map((cp: any) => `  ${cp.callPoint} — "${cp.label}"`)
        .join("\n");
      expect.fail(
        `${orphaned.length} AI_CALL_POINTS entry(s) with no @ai-call in source:\n${details}\n\n` +
        `Either add @ai-call to the source or remove from AI_CALL_POINTS`
      );
    }
  });

  it("@ai-call annotations follow the standard format", () => {
    // Check raw lines for @ai-call that DON'T match the full format
    const allFilesContent = allFiles.map((f) => ({
      file: path.relative(PROJECT_ROOT, f),
      lines: WRAPPER_FILES.has(path.relative(PROJECT_ROOT, f))
        ? []
        : fs.readFileSync(f, "utf-8").split("\n"),
    }));

    const malformed: string[] = [];
    const LOOSE_PATTERN = /@ai-call/;

    for (const { file, lines } of allFilesContent) {
      for (let i = 0; i < lines.length; i++) {
        if (LOOSE_PATTERN.test(lines[i]) && !ANNOTATION_PATTERN.test(lines[i])) {
          malformed.push(`  ${file}:${i + 1} — ${lines[i].trim()}`);
        }
      }
    }

    if (malformed.length > 0) {
      expect.fail(
        `${malformed.length} @ai-call annotation(s) with non-standard format:\n${malformed.join("\n")}\n\n` +
        `Expected: // @ai-call <callPoint> — <description> | config: /x/ai-config`
      );
    }
  });
});
