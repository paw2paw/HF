/**
 * Generate Constants Manifest
 *
 * Scans all .ts/.tsx files under apps/admin/ for @system-constant JSDoc
 * annotations and emits lib/constants-manifest.json.
 *
 * Annotation format:
 *   /** @system-constant <group> — <description> *​/
 *   export const NAME = value;
 *
 * Run: npm run generate:constants
 * Also runs automatically in prebuild.
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "lib", "constants-manifest.json");

// Directories to skip
const SKIP_DIRS = new Set(["node_modules", ".next", "_archived", "dist", ".git"]);

interface ConstantEntry {
  name: string;
  value: string;
  group: string;
  description: string;
  file: string;
  line: number;
}

/**
 * Recursively collect all .ts/.tsx files under a directory.
 */
function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Parse a single file for @system-constant annotations.
 */
function parseFile(filePath: string): ConstantEntry[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const entries: ConstantEntry[] = [];

  // Pattern: /** @system-constant <group> — <description> */
  // Supports both — (em dash) and -- (double hyphen) as separator
  const annotationRe = /\/\*\*\s*@system-constant\s+(\S+)\s+(?:—|--)\s+(.+?)\s*\*\//;

  // Pattern for the constant on the next non-empty line
  const constRe = /(?:export\s+)?(?:const|let)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(.+?)\s*;?\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const match = annotationRe.exec(lines[i]);
    if (!match) continue;

    const group = match[1];
    const description = match[2];

    // Look at the next non-empty line for the constant declaration
    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
      const trimmed = lines[j].trim();
      if (!trimmed) continue;

      const constMatch = constRe.exec(trimmed);
      if (constMatch) {
        entries.push({
          name: constMatch[1],
          value: constMatch[2],
          group,
          description,
          file: path.relative(ROOT, filePath),
          line: j + 1, // 1-indexed
        });
      }
      break; // Only check the first non-empty line after annotation
    }
  }

  return entries;
}

// ── Main ──────────────────────────────────────────────

const files = collectFiles(ROOT);
const constants: ConstantEntry[] = [];

for (const file of files) {
  constants.push(...parseFile(file));
}

// Sort by group then name
constants.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));

const manifest = {
  generated: new Date().toISOString(),
  count: constants.length,
  constants,
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + "\n");

console.log(`✅ Generated ${constants.length} constants in ${path.relative(process.cwd(), OUT)}`);

// Print summary by group
const groups = new Map<string, number>();
for (const c of constants) {
  groups.set(c.group, (groups.get(c.group) ?? 0) + 1);
}
for (const [group, count] of [...groups.entries()].sort()) {
  console.log(`   ${group}: ${count}`);
}
