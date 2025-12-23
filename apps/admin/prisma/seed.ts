import fs from "node:fs";
import path from "node:path";
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

function pick(obj: Record<string, string>, key: string): string | null {
  const v = obj[key];
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
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

  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, "").trim());
  const rows = lines.slice(1, 1 + SEED_LIMIT);

  let upserted = 0;

  for (const line of rows) {
    const cols = parseCsvLine(line);
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => (rec[h] = cols[i] ?? ""));

    // Expected header names (case-sensitive). If your CSV uses different headers,
    // rename the CSV headers to match these fields.
    const parameterId = pick(rec, "parameterId");
    if (!parameterId) throw new Error(`Missing parameterId in row: ${line}`);

    await prisma.parameter.upsert({
      where: { parameterId },
      create: {
        parameterId,
        sectionId: pick(rec, "sectionId") ?? "UNASSIGNED",
        domainGroup: pick(rec, "domainGroup") ?? "UNASSIGNED",
        name: pick(rec, "name") ?? parameterId,
        definition: pick(rec, "definition") ?? "",
        measurementMvp: pick(rec, "measurementMvp"),
        measurementVoiceOnly: pick(rec, "measurementVoiceOnly"),
        interpretationHigh: pick(rec, "interpretationHigh"),
        interpretationLow: pick(rec, "interpretationLow"),
        scaleType: pick(rec, "scaleType") ?? "UNKNOWN",
        directionality: pick(rec, "directionality") ?? "UNKNOWN",
        computedBy: pick(rec, "computedBy") ?? "UNKNOWN",
        isActive: asBool(pick(rec, "isActive"), true),
        isMvpCore: asBool(pick(rec, "isMvpCore"), false),
      },
      update: {
        sectionId: pick(rec, "sectionId") ?? "UNASSIGNED",
        domainGroup: pick(rec, "domainGroup") ?? "UNASSIGNED",
        name: pick(rec, "name") ?? parameterId,
        definition: pick(rec, "definition") ?? "",
        measurementMvp: pick(rec, "measurementMvp"),
        measurementVoiceOnly: pick(rec, "measurementVoiceOnly"),
        interpretationHigh: pick(rec, "interpretationHigh"),
        interpretationLow: pick(rec, "interpretationLow"),
        scaleType: pick(rec, "scaleType") ?? "UNKNOWN",
        directionality: pick(rec, "directionality") ?? "UNKNOWN",
        computedBy: pick(rec, "computedBy") ?? "UNKNOWN",
        isActive: asBool(pick(rec, "isActive"), true),
        isMvpCore: asBool(pick(rec, "isMvpCore"), false),
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
