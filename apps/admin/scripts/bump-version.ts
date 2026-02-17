/**
 * Bump package.json version automatically.
 *
 * Usage:
 *   npx tsx scripts/bump-version.ts           # patch bump (0.5.0 → 0.5.1)
 *   npx tsx scripts/bump-version.ts --minor   # minor bump (0.5.0 → 0.6.0)
 *   npx tsx scripts/bump-version.ts --major   # major bump (0.5.0 → 1.0.0)
 */

import * as fs from "fs";
import * as path from "path";

const pkgPath = path.join(__dirname, "../package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const oldVersion = pkg.version;

const [major, minor, patch] = oldVersion.split(".").map(Number);
const args = process.argv.slice(2);

if (args.includes("--major")) {
  pkg.version = `${major + 1}.0.0`;
} else if (args.includes("--minor")) {
  pkg.version = `${major}.${minor + 1}.0`;
} else {
  pkg.version = `${major}.${minor}.${patch + 1}`;
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`Version: ${oldVersion} → ${pkg.version}`);
