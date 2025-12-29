import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Default CSV location (change if yours differs)
const DEFAULT_CSV = path.resolve(process.cwd(), "../../backlog/parameters.csv");
// You can override: HF_PARAMETERS_CSV=/path/to/file.csv
const CSV_PATH = process.env.HF_PARAMETERS_CSV || DEFAULT_CSV;

// How many to seed (default 5). Override: HF_SEED_LIMIT=3
const SEED_LIMIT = Number(process.env.HF_SEED_LIMIT || "5");

function parseCsvLine(line: string): string[] {
  // Minimal CSV parser supporting quotes + commas inside quotes.
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // Handle escaped quote ""
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function asBool(v: unknown, fallback = false): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return fallback;
}

function normKey(k: string): string {
  return k
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function pick(obj: Record<string, string>, ...keys: string[]): string | null {
  for (const key of keys) {
    const direct = obj[key];
    if (direct != null) {
      const t = String(direct).trim();
      if (t.length) return t;
    }

    const nk = normKey(key);
    for (const k of Object.keys(obj)) {
      if (normKey(k) === nk) {
        const v = obj[k];
        const t = String(v ?? "").trim();
        if (t.length) return t;
      }
    }
  }
  return null;
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  // allow comma/semicolon separated
  return raw
    .split(/[;,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`);
  }

  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length && !l.startsWith("#"));

  if (lines.length < 2) throw new Error(`CSV has no data rows: ${CSV_PATH}`);

  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, ""));
  const rows = lines.slice(1, 1 + SEED_LIMIT);

  let upserted = 0;

  for (const line of rows) {
    const cols = parseCsvLine(line);
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => (rec[h] = cols[i] ?? ""));

    // Support both machine headers (parameterId) and human headers (Parameter ID)
    const parameterId = pick(rec, "parameterId", "Parameter ID", "ParameterID", "ID");
    if (!parameterId) throw new Error(`Missing parameterId in row: ${line}`);

    // Tags:
    // - If CSV has explicit isActive/isMvpCore, use them
    // - Otherwise default to Active (and NO MVP unless explicitly provided)
    const isActiveRaw = pick(rec, "isActive", "Active");
    const isMvpRaw = pick(rec, "isMvpCore", "MVP");
    const isActive = isActiveRaw == null ? true : asBool(isActiveRaw, true);
    const isMvpCore = isMvpRaw == null ? false : asBool(isMvpRaw, false);

    const csvTags = parseTags(pick(rec, "tags", "Tags", "Tag"));
    const baseTags = [isActive ? "Active" : "Inactive", isMvpCore ? "MVP" : "Non-MVP"].filter(Boolean);

    // De-dupe by slug but keep the first readable label for create.name
    const tagNames = uniq([...baseTags, ...csvTags]);
    const tags = tagNames
      .map((name) => ({ name, slug: slugify(name) }))
      .filter((t) => t.slug.length > 0);

    await prisma.parameter.upsert({
      where: { parameterId },
      create: {
        parameterId,
        sectionId: pick(rec, "sectionId", "Section") ?? "UNASSIGNED",
        // In your CSV, "Model" best maps to domainGroup
        domainGroup: pick(rec, "domainGroup", "Domain Group", "Model") ?? "UNASSIGNED",
        name: pick(rec, "name", "Parameter Name", "Name") ?? parameterId,
        // In your CSV, "Explanation" best maps to definition
        definition: pick(rec, "definition", "Explanation", "Definition") ?? "",
        // In your CSV, "Measurement" best maps to measurementMvp for now
        measurementMvp: pick(rec, "measurementMvp", "Measurement"),
        measurementVoiceOnly: pick(rec, "measurementVoiceOnly"),
        // In your CSV, "High Bias"/"Low Bias" best map to interpretation labels
        interpretationHigh: pick(rec, "interpretationHigh", "High Bias"),
        interpretationLow: pick(rec, "interpretationLow", "Low Bias"),
        // In your CSV, "Value Type" best maps to scaleType
        scaleType: pick(rec, "scaleType", "Value Type") ?? "UNKNOWN",
        directionality: pick(rec, "directionality") ?? "UNKNOWN",
        computedBy: pick(rec, "computedBy") ?? "UNKNOWN",
        tags: {
          create: tags.map((t) => ({
            id: randomUUID(),
            tag: {
              connectOrCreate: {
                where: { slug: t.slug },
                create: {
                  id: randomUUID(),
                  slug: t.slug,
                  name: t.name,
                },
              },
            },
          })),
        },
      },
      update: {
        sectionId: pick(rec, "sectionId", "Section") ?? "UNASSIGNED",
        domainGroup: pick(rec, "domainGroup", "Domain Group", "Model") ?? "UNASSIGNED",
        name: pick(rec, "name", "Parameter Name", "Name") ?? parameterId,
        definition: pick(rec, "definition", "Explanation", "Definition") ?? "",
        measurementMvp: pick(rec, "measurementMvp", "Measurement"),
        measurementVoiceOnly: pick(rec, "measurementVoiceOnly"),
        interpretationHigh: pick(rec, "interpretationHigh", "High Bias"),
        interpretationLow: pick(rec, "interpretationLow", "Low Bias"),
        scaleType: pick(rec, "scaleType", "Value Type") ?? "UNKNOWN",
        directionality: pick(rec, "directionality") ?? "UNKNOWN",
        computedBy: pick(rec, "computedBy") ?? "UNKNOWN",
        // Replace tags on every seed run so CSV is the source of truth.
        tags: {
          deleteMany: {},
          create: tags.map((t) => ({
            id: randomUUID(),
            tag: {
              connectOrCreate: {
                where: { slug: t.slug },
                create: {
                  id: randomUUID(),
                  slug: t.slug,
                  name: t.name,
                },
              },
            },
          })),
        },
      },
    });

    upserted++;
  }

  console.log(`Seeded ${upserted} Parameter rows from ${CSV_PATH}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
