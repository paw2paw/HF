import fs from "fs/promises";
import path from "path";

const APP_ROOT = process.cwd(); // apps/admin/ in both dev and Docker

export interface SourceContext {
  pageFile: string | null;
  directoryTree: string;
  apiRoutes: string[];
}

export interface BugContext {
  url: string;
  errors: Array<{
    message: string;
    source?: string;
    timestamp: number;
    status?: number;
    stack?: string;
    url?: string;
  }>;
  browser: string;
  viewport: string;
  timestamp: number;
}

/**
 * Detect whether a URL segment is likely an ID rather than a route name.
 * Matches UUIDs, CUIDs (c + 24+ chars), and long alphanumeric strings.
 */
export function isLikelyId(segment: string): boolean {
  if (/^[0-9a-f]{8}-/.test(segment)) return true; // UUID
  if (/^c[a-z0-9]{24,}$/i.test(segment)) return true; // CUID
  if (segment.length > 20 && /^[a-zA-Z0-9_-]+$/.test(segment)) return true;
  return false;
}

/**
 * Walk the filesystem to resolve a URL pathname to the actual page.tsx path.
 * Handles [param] directories by scanning for bracket-prefixed dirs.
 */
async function resolvePagePath(pathname: string): Promise<string | null> {
  const cleaned = pathname.replace(/^\/x\//, "").replace(/^\//, "");
  const segments = cleaned.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  let currentDir = path.join(APP_ROOT, "app", "x");

  for (const segment of segments) {
    const exactPath = path.join(currentDir, segment);
    try {
      const stat = await fs.stat(exactPath);
      if (stat.isDirectory()) {
        currentDir = exactPath;
        continue;
      }
    } catch {
      // exact match not found
    }

    // If segment looks like an ID, find a [param] directory
    if (isLikelyId(segment)) {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        const paramDir = entries.find(
          (e) => e.isDirectory() && e.name.startsWith("[") && e.name.endsWith("]")
        );
        if (paramDir) {
          currentDir = path.join(currentDir, paramDir.name);
          continue;
        }
      } catch {
        // readdir failed
      }
    }

    // Can't resolve this segment
    return null;
  }

  // Look for page.tsx in the resolved directory
  const pagePath = path.join(currentDir, "page.tsx");
  try {
    await fs.access(pagePath);
    return pagePath;
  } catch {
    return null;
  }
}

/**
 * Get a directory tree listing (just filenames, not recursive).
 */
async function getDirectoryTree(dirPath: string): Promise<string> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort()
      .join("\n");
  } catch {
    return "";
  }
}

/**
 * Find related API routes based on the URL path.
 * /x/callers → app/api/callers/
 * /x/specs/[id] → app/api/specs/
 */
function guessApiRoutePaths(pathname: string): string[] {
  const cleaned = pathname.replace(/^\/x\//, "").replace(/^\//, "");
  const segments = cleaned.split("/").filter(Boolean);

  // Take the first 1-2 non-ID segments as the API path
  const routeSegments = segments.filter((s) => !isLikelyId(s)).slice(0, 2);
  if (routeSegments.length === 0) return [];

  const routes: string[] = [];
  // Try full path first, then just the first segment
  routes.push(`app/api/${routeSegments.join("/")}/route.ts`);
  if (routeSegments.length > 1) {
    routes.push(`app/api/${routeSegments[0]}/route.ts`);
  }
  return routes;
}

/**
 * Resolve source files for a given URL pathname.
 * Returns the page source (first 150 lines), directory tree, and related API route paths.
 */
export async function resolveSourceFiles(
  pathname: string
): Promise<SourceContext> {
  const result: SourceContext = {
    pageFile: null,
    directoryTree: "",
    apiRoutes: [],
  };

  const pagePath = await resolvePagePath(pathname);
  if (pagePath) {
    try {
      const content = await fs.readFile(pagePath, "utf-8");
      const lines = content.split("\n").slice(0, 150);
      const relativePath = path.relative(APP_ROOT, pagePath);
      result.pageFile = `// ${relativePath}\n${lines.join("\n")}`;
    } catch {
      // file read failed
    }

    // Directory tree of the page's parent
    const dir = path.dirname(pagePath);
    result.directoryTree = await getDirectoryTree(dir);
  }

  // Related API routes (just paths, not content — keeps token count low)
  const apiPaths = guessApiRoutePaths(pathname);
  for (const apiPath of apiPaths) {
    const fullPath = path.join(APP_ROOT, apiPath);
    try {
      await fs.access(fullPath);
      result.apiRoutes.push(apiPath);
    } catch {
      // route doesn't exist at this path
    }
  }

  return result;
}

/**
 * Read CLAUDE.md and return a trimmed version for the bug diagnosis prompt.
 * Includes: Principles, Architecture, Key Patterns, Bugs to Avoid.
 * Excludes: Commands, Deployment, Testing details (not relevant to bug diagnosis).
 */
export async function getClaudeMdContext(): Promise<string> {
  // Try repo root (two levels up from apps/admin/)
  const candidates = [
    path.resolve(APP_ROOT, "../../CLAUDE.md"),
    path.resolve(APP_ROOT, "CLAUDE.md"),
  ];

  for (const candidate of candidates) {
    try {
      const content = await fs.readFile(candidate, "utf-8");
      return trimClaudeMd(content);
    } catch {
      continue;
    }
  }

  return "";
}

/**
 * Extract the most relevant sections from CLAUDE.md for bug diagnosis.
 */
function trimClaudeMd(content: string): string {
  const sections: string[] = [];
  const lines = content.split("\n");
  let capturing = false;
  let currentSection: string[] = [];

  const includeSections = [
    "## Principles",
    "## Architecture",
    "## Key Patterns",
    "## Bugs to Avoid",
    "## The Adaptive Loop",
    "## Database Patterns",
    "## RBAC",
  ];
  const excludeSections = [
    "## Commands",
    "## Deployment",
    "## Testing",
    "## Prompt Composition",
    "## Seed Data",
  ];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      // Save previous section if we were capturing
      if (capturing && currentSection.length > 0) {
        sections.push(currentSection.join("\n"));
      }
      // Check if this new section should be captured
      capturing = includeSections.some((s) => line.startsWith(s));
      if (excludeSections.some((s) => line.startsWith(s))) {
        capturing = false;
      }
      currentSection = capturing ? [line] : [];
    } else if (capturing) {
      currentSection.push(line);
    }
  }

  // Don't forget the last section
  if (capturing && currentSection.length > 0) {
    sections.push(currentSection.join("\n"));
  }

  return sections.join("\n\n");
}
