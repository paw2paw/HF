#!/usr/bin/env tsx
/**
 * Living Documentation Health Scanner
 *
 * Validates that all documentation stays in sync with the codebase.
 * Checks:
 *   1. @doc-source markers in markdown files resolve to real artifacts
 *   2. File path references in docs point to existing files
 *   3. Environment variables in docs match config.ts
 *   4. Prisma model references match schema.prisma
 *   5. API route references match actual route.ts files
 *   6. BDD feature files reference valid behavior
 *   7. @api annotation coverage on route.ts files
 *
 * Usage:
 *   npx tsx scripts/doc-health.ts           # Full report
 *   npx tsx scripts/doc-health.ts --ci      # Exit code 1 on failures (for CI)
 *   npx tsx scripts/doc-health.ts --fix     # Auto-add missing @doc-source markers
 *   npx tsx scripts/doc-health.ts --json    # Output as JSON
 *
 * @doc-source markers in markdown:
 *   <!-- @doc-source file:path/to/file.ts -->
 *   <!-- @doc-source env:VAR_NAME,OTHER_VAR -->
 *   <!-- @doc-source model:Caller,Call,Domain -->
 *   <!-- @doc-source route:/api/callers,/api/calls -->
 *   <!-- @doc-source feature:bdd/features/something.feature -->
 *   <!-- @doc-source config:section.key -->
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "../../.."); // HF repo root
const ADMIN = path.resolve(ROOT, "apps/admin");
const DOC_DIRS = [
  path.join(ROOT, "docs"),
  path.join(ADMIN, "docs"),
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocSourceMarker {
  type: "file" | "env" | "model" | "route" | "feature" | "config";
  values: string[];
  file: string;
  line: number;
}

interface ValidationResult {
  marker: DocSourceMarker;
  valid: string[];
  broken: string[];
}

interface FileRefCheck {
  docFile: string;
  referencedPath: string;
  exists: boolean;
  line: number;
}

interface EnvVarCheck {
  varName: string;
  inConfig: boolean;
  inDocs: string[];
  inEnvExample: boolean;
}

interface ApiCoverageCheck {
  totalRouteFiles: number;
  annotatedFiles: number;
  missingFiles: string[];
  coveragePercent: number;
}

interface HealthReport {
  timestamp: string;
  docSourceMarkers: {
    total: number;
    valid: number;
    broken: ValidationResult[];
  };
  fileReferences: {
    total: number;
    valid: number;
    broken: FileRefCheck[];
  };
  envVars: {
    inConfigNotDocs: string[];
    inDocsNotConfig: string[];
    inConfigNotEnvExample: string[];
  };
  prismaModels: {
    referencedNotFound: string[];
  };
  apiCoverage: ApiCoverageCheck;
  bddFeatures: {
    total: number;
    valid: number;
    broken: string[];
  };
  summary: {
    passed: number;
    warnings: number;
    failures: number;
    overallStatus: "healthy" | "warning" | "failing";
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findMarkdownFiles(dirs: string[]): string[] {
  const files: string[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    walkDir(dir, files);
  }
  return files.sort();
}

function walkDir(dir: string, results: string[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      walkDir(full, results);
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
}

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.ts") results.push(full);
    }
  }
  walk(dir);
  return results.sort();
}

function relativePath(absPath: string): string {
  return path.relative(ROOT, absPath);
}

// ---------------------------------------------------------------------------
// 1. Parse @doc-source markers
// ---------------------------------------------------------------------------

function parseDocSourceMarkers(files: string[]): DocSourceMarker[] {
  const markers: DocSourceMarker[] = [];
  const pattern = /<!--\s*@doc-source\s+(\w+):(.+?)\s*-->/g;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(lines[i])) !== null) {
        const type = match[1] as DocSourceMarker["type"];
        const values = match[2].split(",").map((v) => v.trim());
        markers.push({ type, values, file, line: i + 1 });
      }
    }
  }

  return markers;
}

function validateDocSourceMarkers(markers: DocSourceMarker[]): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const marker of markers) {
    const valid: string[] = [];
    const broken: string[] = [];

    for (const value of marker.values) {
      switch (marker.type) {
        case "file": {
          const absPath = path.resolve(ROOT, value);
          if (fs.existsSync(absPath)) valid.push(value);
          else broken.push(value);
          break;
        }
        case "env": {
          // Check if env var exists in config.ts
          const configContent = fs.readFileSync(path.join(ADMIN, "lib/config.ts"), "utf-8");
          if (configContent.includes(value)) valid.push(value);
          else broken.push(value);
          break;
        }
        case "model": {
          const schemaContent = fs.readFileSync(path.join(ADMIN, "prisma/schema.prisma"), "utf-8");
          const modelPattern = new RegExp(`model\\s+${value}\\s*\\{`);
          if (modelPattern.test(schemaContent)) valid.push(value);
          else broken.push(value);
          break;
        }
        case "route": {
          // Check if a route.ts file exists for this API path
          const routePath = value
            .replace(/^\/api\//, "")
            .replace(/:(\w+)/g, "[$1]");
          const routeFile = path.join(ADMIN, "app/api", routePath, "route.ts");
          if (fs.existsSync(routeFile)) valid.push(value);
          else broken.push(value);
          break;
        }
        case "feature": {
          const featurePath = path.resolve(ROOT, value);
          if (fs.existsSync(featurePath)) valid.push(value);
          else broken.push(value);
          break;
        }
        case "config": {
          const configContent2 = fs.readFileSync(path.join(ADMIN, "lib/config.ts"), "utf-8");
          if (configContent2.includes(value)) valid.push(value);
          else broken.push(value);
          break;
        }
      }
    }

    if (broken.length > 0) {
      results.push({ marker, valid, broken });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 2. Check file path references in markdown
// ---------------------------------------------------------------------------

function checkFileReferences(files: string[]): FileRefCheck[] {
  const results: FileRefCheck[] = [];
  // Match markdown links and backtick code references to file paths
  const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;
  const codeRefPattern = /`((?:apps|docs|bdd|knowledge|scripts)\/[^`]+)`/g;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");
    const fileDir = path.dirname(file);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check markdown links
      let match;
      linkPattern.lastIndex = 0;
      while ((match = linkPattern.exec(line)) !== null) {
        const ref = match[2];
        // Skip URLs, anchors, and mailto
        if (ref.startsWith("http") || ref.startsWith("#") || ref.startsWith("mailto:")) continue;
        // Remove anchor from path
        const cleanRef = ref.split("#")[0];
        if (!cleanRef) continue;

        const absPath = path.resolve(fileDir, cleanRef);
        const exists = fs.existsSync(absPath);
        if (!exists) {
          results.push({ docFile: relativePath(file), referencedPath: cleanRef, exists, line: i + 1 });
        }
      }

      // Check backtick code references
      codeRefPattern.lastIndex = 0;
      while ((match = codeRefPattern.exec(line)) !== null) {
        const ref = match[1];
        const absPath = path.resolve(ROOT, ref);
        const exists = fs.existsSync(absPath);
        if (!exists) {
          results.push({ docFile: relativePath(file), referencedPath: ref, exists, line: i + 1 });
        }
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 3. Check environment variables
// ---------------------------------------------------------------------------

function checkEnvVars(): EnvVarCheck[] {
  const configPath = path.join(ADMIN, "lib/config.ts");
  const envExamplePath = path.join(ADMIN, ".env.example");

  const configContent = fs.readFileSync(configPath, "utf-8");
  const envExampleContent = fs.existsSync(envExamplePath)
    ? fs.readFileSync(envExamplePath, "utf-8")
    : "";

  // Extract env vars from config.ts (process.env.XXX patterns)
  const configVars = new Set<string>();
  const envPattern = /process\.env\.(\w+)/g;
  let match;
  while ((match = envPattern.exec(configContent)) !== null) {
    configVars.add(match[1]);
  }

  // Extract env vars from .env.example
  const envExampleVars = new Set<string>();
  for (const line of envExampleContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        envExampleVars.add(trimmed.slice(0, eqIdx).trim());
      }
    }
  }

  // Extract env vars mentioned in docs
  const docFiles = findMarkdownFiles(DOC_DIRS);
  const docVarMentions = new Map<string, string[]>();

  for (const file of docFiles) {
    const content = fs.readFileSync(file, "utf-8");
    for (const v of configVars) {
      if (content.includes(v)) {
        const existing = docVarMentions.get(v) || [];
        existing.push(relativePath(file));
        docVarMentions.set(v, existing);
      }
    }
  }

  // Build results
  const results: EnvVarCheck[] = [];
  for (const v of configVars) {
    results.push({
      varName: v,
      inConfig: true,
      inDocs: docVarMentions.get(v) || [],
      inEnvExample: envExampleVars.has(v),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 4. Check Prisma model references
// ---------------------------------------------------------------------------

function checkPrismaModels(docFiles: string[]): string[] {
  const schemaPath = path.join(ADMIN, "prisma/schema.prisma");
  if (!fs.existsSync(schemaPath)) return [];

  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  const modelPattern = /model\s+(\w+)\s*\{/g;
  const models = new Set<string>();
  let match;
  while ((match = modelPattern.exec(schemaContent)) !== null) {
    models.add(match[1]);
  }

  // Find model names referenced in docs that don't exist in schema
  const referencedNotFound: string[] = [];
  const modelRefPattern = /`(\w+)`/g;

  for (const file of docFiles) {
    const content = fs.readFileSync(file, "utf-8");
    // Only check for @doc-source model: markers
    const markerPattern = /<!--\s*@doc-source\s+model:(.+?)\s*-->/g;
    while ((match = markerPattern.exec(content)) !== null) {
      const refs = match[1].split(",").map((r) => r.trim());
      for (const ref of refs) {
        if (!models.has(ref) && !referencedNotFound.includes(ref)) {
          referencedNotFound.push(ref);
        }
      }
    }
  }

  return referencedNotFound;
}

// ---------------------------------------------------------------------------
// 5. Check API annotation coverage
// ---------------------------------------------------------------------------

function checkApiCoverage(): ApiCoverageCheck {
  const apiDir = path.join(ADMIN, "app/api");
  const routeFiles = findRouteFiles(apiDir);

  let annotated = 0;
  const missing: string[] = [];

  for (const file of routeFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const hasApi = content.includes("@api ");
    const hasHandlers = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/g.test(content);

    if (hasHandlers) {
      if (hasApi) annotated++;
      else missing.push(relativePath(file));
    }
  }

  const total = annotated + missing.length;

  return {
    totalRouteFiles: routeFiles.length,
    annotatedFiles: annotated,
    missingFiles: missing,
    coveragePercent: total > 0 ? Math.round((annotated / total) * 100) : 100,
  };
}

// ---------------------------------------------------------------------------
// 6. Check BDD feature files
// ---------------------------------------------------------------------------

function checkBddFeatures(): { total: number; valid: number; broken: string[] } {
  const featuresDir = path.join(ROOT, "bdd/features");
  if (!fs.existsSync(featuresDir)) {
    return { total: 0, valid: 0, broken: [] };
  }

  const featureFiles: string[] = [];
  walkDir(featuresDir, featureFiles);
  const features = featureFiles.filter((f) => f.endsWith(".feature"));

  // Basic validation: check features are parseable (have Feature: and Scenario:)
  const broken: string[] = [];
  for (const file of features) {
    const content = fs.readFileSync(file, "utf-8");
    if (!content.includes("Feature:") || !content.includes("Scenario")) {
      broken.push(relativePath(file));
    }
  }

  return { total: features.length, valid: features.length - broken.length, broken };
}

// ---------------------------------------------------------------------------
// Main: Generate health report
// ---------------------------------------------------------------------------

function generateReport(): HealthReport {
  const docFiles = findMarkdownFiles(DOC_DIRS);

  // 1. @doc-source markers
  const markers = parseDocSourceMarkers(docFiles);
  const brokenMarkers = validateDocSourceMarkers(markers);

  // 2. File references
  const brokenFileRefs = checkFileReferences(docFiles);

  // 3. Environment variables
  const envVars = checkEnvVars();
  const inConfigNotDocs = envVars.filter((v) => v.inDocs.length === 0).map((v) => v.varName);
  const inConfigNotEnvExample = envVars.filter((v) => !v.inEnvExample).map((v) => v.varName);

  // 4. Prisma models
  const referencedNotFound = checkPrismaModels(docFiles);

  // 5. API coverage
  const apiCoverage = checkApiCoverage();

  // 6. BDD features
  const bddFeatures = checkBddFeatures();

  // Summary
  let failures = 0;
  let warnings = 0;
  let passed = 0;

  // Broken @doc-source markers = failure
  if (brokenMarkers.length > 0) failures++;
  else passed++;

  // Broken file references = warning (some may be intentional)
  if (brokenFileRefs.length > 0) warnings++;
  else passed++;

  // Undocumented env vars = warning
  if (inConfigNotDocs.length > 0) warnings++;
  else passed++;

  // Missing env example entries = warning
  if (inConfigNotEnvExample.length > 0) warnings++;
  else passed++;

  // Prisma model references = failure
  if (referencedNotFound.length > 0) failures++;
  else passed++;

  // API coverage < 100% = warning, < 50% = failure
  if (apiCoverage.coveragePercent < 50) failures++;
  else if (apiCoverage.coveragePercent < 100) warnings++;
  else passed++;

  // BDD features broken = failure
  if (bddFeatures.broken.length > 0) failures++;
  else passed++;

  const overallStatus: HealthReport["summary"]["overallStatus"] =
    failures > 0 ? "failing" : warnings > 0 ? "warning" : "healthy";

  return {
    timestamp: new Date().toISOString(),
    docSourceMarkers: {
      total: markers.length,
      valid: markers.length - brokenMarkers.length,
      broken: brokenMarkers,
    },
    fileReferences: {
      total: brokenFileRefs.length, // We only collected broken ones
      valid: 0, // Not tracked for perf
      broken: brokenFileRefs,
    },
    envVars: {
      inConfigNotDocs,
      inDocsNotConfig: [], // Not checked (docs may reference external vars)
      inConfigNotEnvExample,
    },
    prismaModels: {
      referencedNotFound,
    },
    apiCoverage,
    bddFeatures,
    summary: {
      passed,
      warnings,
      failures,
      overallStatus,
    },
  };
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function formatReport(report: HealthReport): string {
  const lines: string[] = [];
  const { summary } = report;

  const statusIcon =
    summary.overallStatus === "healthy"
      ? "HEALTHY"
      : summary.overallStatus === "warning"
        ? "WARNING"
        : "FAILING";

  lines.push("");
  lines.push("  Doc Health Report");
  lines.push("  =".repeat(50));
  lines.push("");

  // API annotation coverage
  const apiPct = report.apiCoverage.coveragePercent;
  const apiIcon = apiPct === 100 ? "pass" : apiPct >= 50 ? "warn" : "FAIL";
  lines.push(
    `  API annotations:  ${report.apiCoverage.annotatedFiles}/${report.apiCoverage.annotatedFiles + report.apiCoverage.missingFiles.length} routes annotated (${apiPct}%)  [${apiIcon}]`
  );

  // @doc-source markers
  const markerIcon = report.docSourceMarkers.broken.length === 0 ? "pass" : "FAIL";
  lines.push(
    `  @doc-source:      ${report.docSourceMarkers.valid}/${report.docSourceMarkers.total} markers valid  [${markerIcon}]`
  );

  // File references
  const fileRefIcon = report.fileReferences.broken.length === 0 ? "pass" : "warn";
  lines.push(
    `  File references:  ${report.fileReferences.broken.length} broken links  [${fileRefIcon}]`
  );

  // Env vars
  const envIcon = report.envVars.inConfigNotDocs.length === 0 ? "pass" : "warn";
  lines.push(
    `  Env vars:         ${report.envVars.inConfigNotDocs.length} undocumented  [${envIcon}]`
  );

  // Prisma models
  const modelIcon = report.prismaModels.referencedNotFound.length === 0 ? "pass" : "FAIL";
  lines.push(
    `  Prisma models:    ${report.prismaModels.referencedNotFound.length} stale references  [${modelIcon}]`
  );

  // BDD features
  const bddIcon = report.bddFeatures.broken.length === 0 ? "pass" : "FAIL";
  lines.push(
    `  BDD features:     ${report.bddFeatures.valid}/${report.bddFeatures.total} valid  [${bddIcon}]`
  );

  lines.push("");
  lines.push(`  =`.repeat(50));
  lines.push(`  Overall: ${statusIcon}  (${summary.passed} passed, ${summary.warnings} warnings, ${summary.failures} failures)`);
  lines.push("");

  // Details for failures/warnings
  if (report.apiCoverage.missingFiles.length > 0) {
    lines.push("  Routes missing @api annotations:");
    for (const f of report.apiCoverage.missingFiles.slice(0, 20)) {
      lines.push(`    - ${f}`);
    }
    if (report.apiCoverage.missingFiles.length > 20) {
      lines.push(`    ... and ${report.apiCoverage.missingFiles.length - 20} more`);
    }
    lines.push("");
  }

  if (report.docSourceMarkers.broken.length > 0) {
    lines.push("  Broken @doc-source markers:");
    for (const r of report.docSourceMarkers.broken) {
      const loc = `${relativePath(r.marker.file)}:${r.marker.line}`;
      lines.push(`    ${loc}: ${r.marker.type}:${r.broken.join(",")}`);
    }
    lines.push("");
  }

  if (report.fileReferences.broken.length > 0) {
    lines.push("  Broken file references in docs:");
    for (const r of report.fileReferences.broken.slice(0, 15)) {
      lines.push(`    ${r.docFile}:${r.line} -> ${r.referencedPath}`);
    }
    if (report.fileReferences.broken.length > 15) {
      lines.push(`    ... and ${report.fileReferences.broken.length - 15} more`);
    }
    lines.push("");
  }

  if (report.envVars.inConfigNotDocs.length > 0) {
    lines.push("  Env vars in config.ts but not in any doc:");
    for (const v of report.envVars.inConfigNotDocs) {
      lines.push(`    - ${v}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const isCI = args.includes("--ci");
const isJSON = args.includes("--json");

const report = generateReport();

if (isJSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(formatReport(report));
}

if (isCI && report.summary.overallStatus === "failing") {
  process.exit(1);
}
