#!/usr/bin/env npx tsx
/**
 * API Documentation Generator
 *
 * Reads @api JSDoc annotations from route.ts files and generates:
 *   - docs/API-INTERNAL.md  (all endpoints: public + internal)
 *   - docs/API-PUBLIC.md    (public endpoints only, versioned paths)
 *
 * Usage:
 *   npx tsx scripts/api-docs/generator.ts            # Generate docs
 *   npx tsx scripts/api-docs/generator.ts --validate  # Check coverage only
 *   npx tsx scripts/api-docs/generator.ts --check     # Diff against existing (CI)
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { parseAllRoutes } from "./parser";
import type { ApiEndpoint, ApiGroup, ApiParam, Visibility } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "../..");
const API_DIR = path.join(ROOT, "app", "api");
const DOCS_DIR = path.resolve(ROOT, "..", "..", "docs");
const TEMPLATES_DIR = path.join(__dirname, "templates");

const INTERNAL_OUT = path.join(DOCS_DIR, "API-INTERNAL.md");
const PUBLIC_OUT = path.join(DOCS_DIR, "API-PUBLIC.md");

// ---------------------------------------------------------------------------
// Template loader
// ---------------------------------------------------------------------------

/**
 * Load a template file from the templates directory.
 * Returns the file contents if it exists, otherwise returns the fallback.
 */
function loadTemplate(filename: string, fallback: string): string {
  const templatePath = path.join(TEMPLATES_DIR, filename);
  if (fs.existsSync(templatePath)) {
    return fs.readFileSync(templatePath, "utf-8").trim();
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Grouping and sorting
// ---------------------------------------------------------------------------

/**
 * Group endpoints by their first tag. Endpoints without tags go into "other".
 */
function groupByTag(endpoints: ApiEndpoint[]): ApiGroup[] {
  const map = new Map<string, ApiEndpoint[]>();

  for (const ep of endpoints) {
    const tag = ep.tags.length > 0 ? ep.tags[0] : "other";
    if (!map.has(tag)) {
      map.set(tag, []);
    }
    map.get(tag)!.push(ep);
  }

  // Sort groups alphabetically, sort endpoints within each group by path
  const groups: ApiGroup[] = [];
  const sortedTags = Array.from(map.keys()).sort();

  for (const tag of sortedTags) {
    const eps = map.get(tag)!;
    eps.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

    groups.push({
      name: formatTagName(tag),
      description: "",
      tag,
      endpoints: eps,
    });
  }

  return groups;
}

/**
 * Format a tag slug into a human-readable section name.
 * e.g., "callers" -> "Callers", "ai-knowledge" -> "AI Knowledge"
 */
function formatTagName(tag: string): string {
  return tag
    .split(/[-_]/)
    .map((word) => {
      if (word.toLowerCase() === "ai") return "AI";
      if (word.toLowerCase() === "api") return "API";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Create a markdown-safe anchor from a string.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ---------------------------------------------------------------------------
// Auth label formatting
// ---------------------------------------------------------------------------

function formatAuth(ep: ApiEndpoint): string {
  const authLabels: Record<string, string> = {
    session: "Session",
    bearer: "Bearer token",
    internal: "Internal secret",
    none: "None",
    "api-key": "API key",
  };

  const parts: string[] = [];
  parts.push(authLabels[ep.auth] || ep.auth);

  if (ep.scope) {
    parts.push(`**Scope**: \`${ep.scope}\``);
  }

  return parts.join(" \u00b7 ");
}

// ---------------------------------------------------------------------------
// Method badge
// ---------------------------------------------------------------------------

const METHOD_ORDER: Record<string, number> = {
  GET: 0,
  POST: 1,
  PUT: 2,
  PATCH: 3,
  DELETE: 4,
};

// ---------------------------------------------------------------------------
// Endpoint rendering
// ---------------------------------------------------------------------------

/**
 * Render a single endpoint as markdown.
 */
function renderEndpoint(ep: ApiEndpoint, versionedPath?: string): string {
  const displayPath = versionedPath || ep.path;
  const lines: string[] = [];

  // Heading
  lines.push(`### \`${ep.method}\` ${displayPath}`);
  lines.push("");

  // Description
  if (ep.description) {
    lines.push(ep.description);
    lines.push("");
  }

  // Auth line
  lines.push(`**Auth**: ${formatAuth(ep)}`);
  lines.push("");

  // Parameters table (merge path params, query params, and body params)
  const allParams: Array<ApiParam & { location: string }> = [];

  if (ep.pathParams) {
    for (const p of ep.pathParams) {
      allParams.push({ ...p, location: "path", required: true });
    }
  }
  if (ep.query) {
    for (const p of ep.query) {
      allParams.push({ ...p, location: "query" });
    }
  }
  if (ep.body) {
    for (const p of ep.body) {
      allParams.push({ ...p, location: "body" });
    }
  }

  if (allParams.length > 0) {
    lines.push("| Parameter | In | Type | Required | Description |");
    lines.push("|-----------|-----|------|----------|-------------|");

    for (const p of allParams) {
      const required = p.required ? "Yes" : "No";
      let desc = p.description || "";
      if (p.default) {
        desc += ` (default: ${p.default})`;
      }
      lines.push(`| ${p.name} | ${p.location} | ${p.type} | ${required} | ${desc} |`);
    }
    lines.push("");
  }

  // Responses
  if (ep.responses && ep.responses.length > 0) {
    for (const resp of ep.responses) {
      lines.push(`**Response** \`${resp.status}\``);
      lines.push("```json");
      lines.push(resp.shape);
      lines.push("```");
      lines.push("");
    }
  }

  // Source file reference (internal only, added by caller)
  lines.push("---");
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Internal doc generation
// ---------------------------------------------------------------------------

function generateInternalDoc(
  groups: ApiGroup[],
  stats: { annotated: number; missing: string[]; total: number }
): string {
  const now = new Date().toISOString().split("T")[0];
  const lines: string[] = [];

  // Header
  lines.push("# HF Internal API Reference");
  lines.push("");
  lines.push("> Auto-generated from `@api` JSDoc annotations in route.ts files.");
  lines.push(">");
  lines.push(`> **Last generated**: ${now}`);
  lines.push("");

  // Warning
  lines.push("<!-- DO NOT EDIT DIRECTLY -->");
  lines.push("<!-- This file is auto-generated by scripts/api-docs/generator.ts -->");
  lines.push("<!-- To update: modify @api annotations in route.ts files, then run: -->");
  lines.push("<!--   npx tsx scripts/api-docs/generator.ts -->");
  lines.push("");

  lines.push("> **Do not edit this file directly.** Update the `@api` JSDoc annotations");
  lines.push("> in the corresponding `route.ts` files, then regenerate:");
  lines.push("> ```bash");
  lines.push("> npx tsx scripts/api-docs/generator.ts");
  lines.push("> ```");
  lines.push("");

  lines.push("---");
  lines.push("");

  // Table of contents
  lines.push("## Table of Contents");
  lines.push("");
  lines.push("- [Endpoints](#endpoints)");

  for (const group of groups) {
    const anchor = slugify(group.name);
    lines.push(`  - [${group.name}](#${anchor})`);
  }

  lines.push("- [Architecture Notes](#architecture-notes)");
  lines.push("- [Environment Variables](#environment-variables)");
  lines.push("- [Coverage](#coverage)");
  lines.push("");
  lines.push("---");
  lines.push("");

  // Endpoints
  lines.push("## Endpoints");
  lines.push("");

  for (const group of groups) {
    lines.push(`## ${group.name}`);
    lines.push("");

    for (const ep of group.endpoints) {
      lines.push(renderEndpoint(ep));
    }
  }

  // Architecture notes
  const archNotes = loadTemplate(
    "internal-architecture.md",
    "## Architecture Notes\n\n_No architecture template found. Create `scripts/api-docs/templates/internal-architecture.md` to populate this section._"
  );
  lines.push(archNotes);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Environment variables
  const envVars = loadTemplate(
    "internal-env-vars.md",
    "## Environment Variables\n\n_No environment variable template found. Create `scripts/api-docs/templates/internal-env-vars.md` to populate this section._"
  );
  lines.push(envVars);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Coverage statistics
  lines.push("## Coverage");
  lines.push("");

  const coveragePct =
    stats.total > 0 ? ((stats.annotated / stats.total) * 100).toFixed(1) : "0.0";

  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Route files found | ${stats.total} |`);
  lines.push(`| Files with annotations | ${stats.annotated} |`);
  lines.push(`| Files missing annotations | ${stats.missing.length} |`);
  lines.push(`| Coverage | ${coveragePct}% |`);
  lines.push("");

  if (stats.missing.length > 0) {
    lines.push("### Files missing `@api` annotations");
    lines.push("");
    for (const file of stats.missing) {
      // Show path relative to admin root
      const relPath = path.relative(ROOT, file);
      lines.push(`- \`${relPath}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public doc generation
// ---------------------------------------------------------------------------

/**
 * Convert an internal path to a versioned public path.
 * /api/callers -> /api/v1/callers
 */
function toVersionedPath(apiPath: string): string {
  if (apiPath.startsWith("/api/")) {
    return "/api/v1/" + apiPath.slice("/api/".length);
  }
  return apiPath;
}

function generatePublicDoc(groups: ApiGroup[]): string {
  const now = new Date().toISOString().split("T")[0];
  const lines: string[] = [];

  // Header
  lines.push("# HF Platform API Guide");
  lines.push("");
  lines.push("> The official API reference for integrating with HF \u2014 a behaviour-driven,");
  lines.push("> memory-adaptive conversational AI platform.");
  lines.push(">");
  lines.push("> **Version**: 1.0");
  lines.push(`> **Last generated**: ${now}`);
  lines.push("");

  // Warning
  lines.push("<!-- DO NOT EDIT DIRECTLY -->");
  lines.push("<!-- This file is auto-generated by scripts/api-docs/generator.ts -->");
  lines.push("<!-- To update: modify @api annotations in route.ts files, then run: -->");
  lines.push("<!--   npx tsx scripts/api-docs/generator.ts -->");
  lines.push("");

  lines.push("> **Do not edit this file directly.** Update the `@api` JSDoc annotations");
  lines.push("> in the corresponding `route.ts` files, or edit the template files in");
  lines.push("> `apps/admin/scripts/api-docs/templates/`, then regenerate:");
  lines.push("> ```bash");
  lines.push("> npx tsx scripts/api-docs/generator.ts");
  lines.push("> ```");
  lines.push("");

  lines.push("---");
  lines.push("");

  // Table of contents
  lines.push("## Table of Contents");
  lines.push("");
  lines.push("- [Introduction](#introduction)");
  lines.push("- [Quick Start](#quick-start)");
  lines.push("- [Authentication](#authentication)");
  lines.push("- [Rate Limits](#rate-limits)");
  lines.push("- [Common Patterns](#common-patterns)");
  lines.push("- [API Reference](#api-reference)");

  for (const group of groups) {
    const anchor = slugify(group.name);
    lines.push(`  - [${group.name}](#${anchor})`);
  }

  lines.push("- [Voice Integration](#voice-integration)");
  lines.push("- [Deployment](#deployment)");
  lines.push("- [Versioning](#versioning)");
  lines.push("- [Security](#security)");
  lines.push("");
  lines.push("---");
  lines.push("");

  // Introduction
  const intro = loadTemplate(
    "public-intro.md",
    "## Introduction\n\n_Create `scripts/api-docs/templates/public-intro.md` to populate this section._"
  );
  lines.push(intro);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Quick Start
  const quickstart = loadTemplate(
    "public-quickstart.md",
    "## Quick Start\n\n_Create `scripts/api-docs/templates/public-quickstart.md` to populate this section._"
  );
  lines.push(quickstart);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Authentication
  const auth = loadTemplate(
    "public-auth.md",
    "## Authentication\n\n_Create `scripts/api-docs/templates/public-auth.md` to populate this section._"
  );
  lines.push(auth);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Rate Limits
  const rateLimits = loadTemplate(
    "public-rate-limits.md",
    "## Rate Limits\n\n_Create `scripts/api-docs/templates/public-rate-limits.md` to populate this section._"
  );
  lines.push(rateLimits);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Common Patterns
  const commonPatterns = loadTemplate(
    "public-common-patterns.md",
    "## Common Patterns\n\n_Create `scripts/api-docs/templates/public-common-patterns.md` to populate this section._"
  );
  lines.push(commonPatterns);
  lines.push("");
  lines.push("---");
  lines.push("");

  // API Reference
  lines.push("## API Reference");
  lines.push("");

  for (const group of groups) {
    lines.push(`## ${group.name}`);
    lines.push("");

    for (const ep of group.endpoints) {
      const versionedPath = toVersionedPath(ep.path);
      lines.push(renderEndpoint(ep, versionedPath));
    }
  }

  // Voice Integration
  const voice = loadTemplate(
    "public-voice-integration.md",
    "## Voice Integration\n\n_Create `scripts/api-docs/templates/public-voice-integration.md` to populate this section._"
  );
  lines.push(voice);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Deployment
  const deployment = loadTemplate(
    "public-deployment.md",
    "## Deployment\n\n_Create `scripts/api-docs/templates/public-deployment.md` to populate this section._"
  );
  lines.push(deployment);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Versioning
  const versioning = loadTemplate(
    "public-versioning.md",
    "## Versioning\n\n_Create `scripts/api-docs/templates/public-versioning.md` to populate this section._"
  );
  lines.push(versioning);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Security
  const security = loadTemplate(
    "public-security.md",
    "## Security\n\n_Create `scripts/api-docs/templates/public-security.md` to populate this section._"
  );
  lines.push(security);
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Validation mode
// ---------------------------------------------------------------------------

function runValidation(): void {
  console.log("Validating API annotation coverage...\n");

  const { endpoints, annotated, missing, total } = parseAllRoutes(API_DIR);
  const coveragePct = total > 0 ? ((annotated.length / total) * 100).toFixed(1) : "0.0";

  const publicCount = endpoints.filter((e) => e.visibility === "public").length;
  const internalCount = endpoints.length - publicCount;

  console.log(`  Route files found:       ${total}`);
  console.log(`  Files with annotations:  ${annotated.length}`);
  console.log(`  Files missing:           ${missing.length}`);
  console.log(`  Coverage:                ${coveragePct}%`);
  console.log("");
  console.log(`  Total endpoints:         ${endpoints.length}`);
  console.log(`  Public:                  ${publicCount}`);
  console.log(`  Internal:                ${internalCount}`);
  console.log("");

  if (missing.length > 0) {
    console.log("  Missing annotations:");
    for (const file of missing) {
      const relPath = path.relative(ROOT, file);
      console.log(`    - ${relPath}`);
    }
    console.log("");
  }

  // Check for common issues
  const warnings: string[] = [];
  for (const ep of endpoints) {
    if (!ep.description) {
      warnings.push(`${ep.method} ${ep.path}: missing @description`);
    }
    if (!ep.responses || ep.responses.length === 0) {
      warnings.push(`${ep.method} ${ep.path}: missing @response`);
    }
    if (ep.tags.length === 0) {
      warnings.push(`${ep.method} ${ep.path}: missing @tags`);
    }
  }

  if (warnings.length > 0) {
    console.log("  Warnings:");
    for (const w of warnings) {
      console.log(`    - ${w}`);
    }
    console.log("");
  }

  if (missing.length > 0) {
    console.log("FAIL: Some route files are missing @api annotations.");
    process.exit(1);
  } else {
    console.log("OK: All route files have @api annotations.");
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------
// Check mode (CI diff)
// ---------------------------------------------------------------------------

function runCheck(): void {
  console.log("Checking if generated docs are up to date...\n");

  const { endpoints, annotated, missing, total } = parseAllRoutes(API_DIR);

  const allGroups = groupByTag(endpoints);
  const publicEndpoints = endpoints.filter((e) => e.visibility === "public");
  const publicGroups = groupByTag(publicEndpoints);

  const internalContent = generateInternalDoc(allGroups, {
    annotated: annotated.length,
    missing,
    total,
  });
  const publicContent = generatePublicDoc(publicGroups);

  // Write to temp files
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-api-docs-"));
  const tmpInternal = path.join(tmpDir, "API-INTERNAL.md");
  const tmpPublic = path.join(tmpDir, "API-PUBLIC.md");

  fs.writeFileSync(tmpInternal, internalContent, "utf-8");
  fs.writeFileSync(tmpPublic, publicContent, "utf-8");

  let hasChanges = false;

  // Diff internal
  if (fs.existsSync(INTERNAL_OUT)) {
    try {
      execSync(`diff -u "${INTERNAL_OUT}" "${tmpInternal}"`, { stdio: "pipe" });
      console.log("  API-INTERNAL.md: up to date");
    } catch (err: any) {
      console.log("  API-INTERNAL.md: OUT OF DATE");
      console.log(err.stdout?.toString() || "");
      hasChanges = true;
    }
  } else {
    console.log("  API-INTERNAL.md: MISSING (will be created)");
    hasChanges = true;
  }

  // Diff public
  if (fs.existsSync(PUBLIC_OUT)) {
    try {
      execSync(`diff -u "${PUBLIC_OUT}" "${tmpPublic}"`, { stdio: "pipe" });
      console.log("  API-PUBLIC.md: up to date");
    } catch (err: any) {
      console.log("  API-PUBLIC.md: OUT OF DATE");
      console.log(err.stdout?.toString() || "");
      hasChanges = true;
    }
  } else {
    console.log("  API-PUBLIC.md: MISSING (will be created)");
    hasChanges = true;
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log("");

  if (hasChanges) {
    console.log("FAIL: Generated docs are out of date. Run:");
    console.log("  npx tsx scripts/api-docs/generator.ts");
    process.exit(1);
  } else {
    console.log("OK: Generated docs are up to date.");
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------
// Main generation
// ---------------------------------------------------------------------------

function generate(): void {
  console.log("Generating API documentation...\n");

  // Parse all routes
  const { endpoints, annotated, missing, total } = parseAllRoutes(API_DIR);

  const publicEndpoints = endpoints.filter((e) => e.visibility === "public");
  const internalCount = endpoints.length - publicEndpoints.length;

  // Group endpoints
  const allGroups = groupByTag(endpoints);
  const publicGroups = groupByTag(publicEndpoints);

  // Generate docs
  const internalContent = generateInternalDoc(allGroups, {
    annotated: annotated.length,
    missing,
    total,
  });
  const publicContent = generatePublicDoc(publicGroups);

  // Ensure output directory exists
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  // Write files
  fs.writeFileSync(INTERNAL_OUT, internalContent, "utf-8");
  fs.writeFileSync(PUBLIC_OUT, publicContent, "utf-8");

  // Summary
  const coveragePct = total > 0 ? ((annotated.length / total) * 100).toFixed(1) : "0.0";

  console.log("  Summary");
  console.log("  -------");
  console.log(`  Route files parsed:      ${total}`);
  console.log(`  Endpoints found:         ${endpoints.length}`);
  console.log(`    Public:                ${publicEndpoints.length}`);
  console.log(`    Internal:              ${internalCount}`);
  console.log(`  Groups:                  ${allGroups.length}`);
  console.log(`  Coverage:                ${coveragePct}% (${annotated.length}/${total} files)`);
  console.log("");
  console.log(`  Written:`);
  console.log(`    ${path.relative(process.cwd(), INTERNAL_OUT)}`);
  console.log(`    ${path.relative(process.cwd(), PUBLIC_OUT)}`);
  console.log("");

  if (missing.length > 0) {
    console.log(`  Missing annotations (${missing.length} files):`);
    for (const file of missing) {
      const relPath = path.relative(ROOT, file);
      console.log(`    - ${relPath}`);
    }
    console.log("");
  }

  console.log("Done.");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes("--validate")) {
  runValidation();
} else if (args.includes("--check")) {
  runCheck();
} else {
  generate();
}
