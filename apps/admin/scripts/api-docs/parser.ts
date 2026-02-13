/**
 * API Annotation Parser
 *
 * Parses @api JSDoc blocks from route.ts files and returns structured
 * ApiEndpoint objects. Used by the generator to build documentation.
 *
 * Usage:
 *   import { parseRouteFile, parseAllRoutes } from './parser';
 *   const endpoints = await parseAllRoutes('apps/admin/app/api');
 */

import * as fs from "fs";
import * as path from "path";
import type { ApiEndpoint, ApiParam, ApiResponse, AuthType, HttpMethod, Visibility } from "./types";

// ---------------------------------------------------------------------------
// JSDoc block extraction
// ---------------------------------------------------------------------------

/**
 * Extract all JSDoc comment blocks from a file's content.
 * Returns array of { comment, followedBy } where followedBy is
 * the first non-empty line after the comment block.
 */
function extractJSDocBlocks(content: string): Array<{ comment: string; followedBy: string }> {
  const blocks: Array<{ comment: string; followedBy: string }> = [];
  const lines = content.split("\n");

  let inBlock = false;
  let blockLines: string[] = [];
  let blockEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith("/**")) {
      inBlock = true;
      blockLines = [trimmed];
      continue;
    }

    if (inBlock) {
      blockLines.push(trimmed);
      if (trimmed.includes("*/")) {
        inBlock = false;
        blockEnd = i;
        // Find first non-empty line after block
        let followedBy = "";
        for (let j = i + 1; j < lines.length && j < i + 5; j++) {
          const next = lines[j].trim();
          if (next.length > 0) {
            followedBy = next;
            break;
          }
        }
        blocks.push({
          comment: blockLines.join("\n"),
          followedBy,
        });
        blockLines = [];
      }
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// @api tag parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single @api JSDoc block into an ApiEndpoint.
 * Returns null if the block doesn't contain @api tags.
 */
function parseApiBlock(comment: string, followedBy: string, sourceFile: string): ApiEndpoint | null {
  // Clean comment lines: remove /**, */, and leading *
  const lines = comment
    .split("\n")
    .map((l) => l.trim())
    .map((l) => {
      if (l.startsWith("/**")) l = l.slice(3);
      if (l.endsWith("*/")) l = l.slice(0, -2);
      if (l.startsWith("*")) l = l.slice(1);
      return l.trim();
    })
    .filter((l) => l.length > 0);

  // Check if this block has @api
  const apiLine = lines.find((l) => l.startsWith("@api "));
  if (!apiLine) return null;

  // Parse @api METHOD /path
  const apiMatch = apiLine.match(/^@api\s+(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/);
  if (!apiMatch) {
    console.warn(`  Warning: Invalid @api format in ${sourceFile}: "${apiLine}"`);
    return null;
  }

  const method = apiMatch[1] as HttpMethod;
  const apiPath = apiMatch[2].trim();

  // Defaults
  let visibility: Visibility = "internal";
  let scope: string | undefined;
  let auth: AuthType = "session";
  let tags: string[] = [];
  let description = "";
  const query: ApiParam[] = [];
  const pathParams: ApiParam[] = [];
  const body: ApiParam[] = [];
  const responses: ApiResponse[] = [];

  for (const line of lines) {
    if (line.startsWith("@visibility ")) {
      visibility = line.slice("@visibility ".length).trim() as Visibility;
    } else if (line.startsWith("@scope ")) {
      scope = line.slice("@scope ".length).trim();
    } else if (line.startsWith("@auth ")) {
      auth = line.slice("@auth ".length).trim() as AuthType;
    } else if (line.startsWith("@tags ")) {
      tags = line
        .slice("@tags ".length)
        .split(",")
        .map((t) => t.trim());
    } else if (line.startsWith("@description ")) {
      description = line.slice("@description ".length).trim();
    } else if (line.startsWith("@query ")) {
      const param = parseParam(line.slice("@query ".length));
      if (param) query.push(param);
    } else if (line.startsWith("@pathParam ")) {
      const param = parseParam(line.slice("@pathParam ".length));
      if (param) pathParams.push(param);
    } else if (line.startsWith("@body ")) {
      const param = parseParam(line.slice("@body ".length));
      if (param) body.push(param);
    } else if (line.startsWith("@response ")) {
      const resp = parseResponse(line.slice("@response ".length));
      if (resp) responses.push(resp);
    }
  }

  return {
    method,
    path: apiPath,
    visibility,
    scope,
    auth,
    tags,
    description,
    query: query.length > 0 ? query : undefined,
    pathParams: pathParams.length > 0 ? pathParams : undefined,
    body: body.length > 0 ? body : undefined,
    responses: responses.length > 0 ? responses : undefined,
    sourceFile,
  };
}

/**
 * Parse a parameter string: "name type - description"
 * Or with required/default: "name type required - description"
 */
function parseParam(raw: string): ApiParam | null {
  // Format: name type [required] [default:value] - description
  const match = raw.match(/^(\w+)\s+(\w+)\s*(?:(required)\s*)?(?:default:(\S+)\s*)?(?:-\s*(.+))?$/);
  if (!match) {
    // Simpler format: name type - description
    const simple = raw.match(/^(\w+)\s+(\w+)\s*-\s*(.+)$/);
    if (simple) {
      return {
        name: simple[1],
        type: simple[2],
        description: simple[3].trim(),
      };
    }
    // Even simpler: name type
    const minimal = raw.match(/^(\w+)\s+(\w+)$/);
    if (minimal) {
      return {
        name: minimal[1],
        type: minimal[2],
        description: "",
      };
    }
    return null;
  }

  return {
    name: match[1],
    type: match[2],
    description: match[5]?.trim() || "",
    required: match[3] === "required",
    default: match[4],
  };
}

/**
 * Parse a response string: "status { shape }"
 */
function parseResponse(raw: string): ApiResponse | null {
  const match = raw.match(/^(\d{3})\s+(.+)$/);
  if (!match) return null;
  return {
    status: parseInt(match[1], 10),
    shape: match[2].trim(),
  };
}

// ---------------------------------------------------------------------------
// File-level parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single route.ts file and return all ApiEndpoint definitions found.
 */
export function parseRouteFile(filePath: string): ApiEndpoint[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const blocks = extractJSDocBlocks(content);

  const endpoints: ApiEndpoint[] = [];
  for (const block of blocks) {
    const endpoint = parseApiBlock(block.comment, block.followedBy, filePath);
    if (endpoint) {
      endpoints.push(endpoint);
    }
  }

  return endpoints;
}

/**
 * Derive the API path from a route.ts file path.
 * e.g., apps/admin/app/api/callers/[callerId]/route.ts → /api/callers/:callerId
 */
export function derivePathFromFile(filePath: string): string {
  // Extract the path between /api/ and /route.ts
  const match = filePath.match(/app\/api\/(.+)\/route\.ts$/);
  if (!match) return filePath;

  const segments = match[1].split("/");
  const apiPath =
    "/api/" +
    segments
      .map((s) => {
        // Convert [param] to :param
        const paramMatch = s.match(/^\[(.+)\]$/);
        if (paramMatch) return `:${paramMatch[1]}`;
        return s;
      })
      .join("/");

  return apiPath;
}

// ---------------------------------------------------------------------------
// Bulk parsing
// ---------------------------------------------------------------------------

/**
 * Find all route.ts files under a directory.
 */
function findRouteFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === "route.ts") {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results.sort();
}

/**
 * Parse all route.ts files under a directory.
 * Returns all endpoints found, plus a list of files missing annotations.
 */
export function parseAllRoutes(apiDir: string): {
  endpoints: ApiEndpoint[];
  annotated: string[];
  missing: string[];
  total: number;
} {
  const files = findRouteFiles(apiDir);
  const endpoints: ApiEndpoint[] = [];
  const annotated: string[] = [];
  const missing: string[] = [];

  for (const file of files) {
    const fileEndpoints = parseRouteFile(file);
    if (fileEndpoints.length > 0) {
      endpoints.push(...fileEndpoints);
      annotated.push(file);
    } else {
      // Check if file exports HTTP methods (it's a real route, not just a helper)
      const content = fs.readFileSync(file, "utf-8");
      const hasHandlers = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/g.test(content);
      if (hasHandlers) {
        missing.push(file);
      }
    }
  }

  return { endpoints, annotated, missing, total: files.length };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that all route.ts files have @api annotations.
 * Returns a report with warnings and errors.
 */
export function validateAnnotations(apiDir: string): {
  ok: boolean;
  annotated: number;
  missing: string[];
  warnings: string[];
} {
  const { annotated, missing, endpoints } = parseAllRoutes(apiDir);
  const warnings: string[] = [];

  // Check for endpoints missing descriptions
  for (const ep of endpoints) {
    if (!ep.description) {
      warnings.push(`${ep.method} ${ep.path}: missing @description`);
    }
    if (!ep.responses || ep.responses.length === 0) {
      warnings.push(`${ep.method} ${ep.path}: missing @response`);
    }
  }

  return {
    ok: missing.length === 0,
    annotated: annotated.length,
    missing,
    warnings,
  };
}
