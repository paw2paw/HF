import fs from 'fs';
import path from 'path';

function getAllTestFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTestFiles(fullPath));
    } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = getAllTestFiles('tests');
let fixed = 0;
let skipped = 0;
const manual = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.match(/vi\.mock\(['"]@\/lib\/prisma['"]/)) continue;

  // Check if prisma mock block already has db:
  const prismaBlockMatch = content.match(/vi\.mock\(['"]@\/lib\/prisma['"][\s\S]*?\)\);/);
  if (prismaBlockMatch && prismaBlockMatch[0].match(/\bdb\s*:/)) {
    skipped++;
    continue;
  }

  let newContent = content;
  let matched = false;

  // Pattern 1: Single-line — vi.mock("@/lib/prisma", () => ({ prisma: varName }));
  const p1 = /vi\.mock\(['"]@\/lib\/prisma['"],\s*\(\)\s*=>\s*\(\{\s*prisma:\s*(\w+(?:\.\w+)?)\s*\}\)\);/;
  const m1 = newContent.match(p1);
  if (m1) {
    const v = m1[1];
    newContent = newContent.replace(p1,
      `vi.mock("@/lib/prisma", () => ({ prisma: ${v}, db: (tx) => tx ?? ${v} }));`);
    matched = true;
  }

  // Pattern 2: Multi-line with variable ref — prisma: mockPrisma,\n}));
  if (!matched) {
    const p2 = /(vi\.mock\(['"]@\/lib\/prisma['"],\s*\(\)\s*=>\s*\(\{[^}]*?prisma:\s*)(\w+(?:\.\w+)?)(,?\s*\n)(\s*\}\)\);)/;
    const m2 = newContent.match(p2);
    if (m2) {
      const v = m2[2];
      // Detect the indentation from the closing line
      const closingIndent = m2[4].match(/^(\s*)/)[1];
      newContent = newContent.replace(p2,
        `${m2[1]}${v},\n${closingIndent}  db: (tx) => tx ?? ${v},\n${m2[4]}`);
      matched = true;
    }
  }

  // Pattern 3: Inline prisma object — need to extract and wrap
  if (!matched) {
    // Match vi.mock('@/lib/prisma', () => ({ prisma: { ... }, }));
    // Strategy: wrap in a function that returns the mock + db helper
    const p3 = /(vi\.mock\(['"]@\/lib\/prisma['"],\s*\(\)\s*=>\s*)\(\{([\s\S]*?prisma:\s*\{[\s\S]*?)\}\)\);/;
    const m3 = newContent.match(p3);
    if (m3) {
      // Find the prisma value — it's an inline object.
      // Replace pattern: wrap in a function body
      const body = m3[2];
      // Extract the prisma property from the body to get variable name
      // Instead, use a different approach: create a const inside the factory
      newContent = newContent.replace(p3, (full, prefix, inner) => {
        // Change () => ({...}) to () => { const p = {...}; return { ...p, db: (tx) => tx ?? p.prisma }; }
        // Actually simpler: just add db that uses the inline prisma ref
        return `${prefix}{\n  const _p = {${inner}};\n  return { ..._p, db: (tx) => tx ?? _p.prisma };\n});`;
      });
      matched = true;
    }
  }

  if (matched) {
    fs.writeFileSync(file, newContent);
    fixed++;
    console.log(`  ✓ ${file}`);
  } else {
    manual.push(file);
  }
}

console.log(`\nFixed: ${fixed}`);
console.log(`Skipped (already has db): ${skipped}`);
console.log(`Manual fix needed: ${manual.length}`);
manual.forEach(e => console.log(`  ✗ ${e}`));
