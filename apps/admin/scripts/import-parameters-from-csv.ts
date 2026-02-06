import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import csv from "csv-parser";

const prisma = new PrismaClient();

type Row = Record<string, string | undefined>;

function clean(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeScaleType(vt: string): string {
  const v = vt.trim().toLowerCase();
  if (v === "percentage") return "Percentage";
  if (v === "number") return "Number";
  if (v === "categorical") return "Categorical";
  if (v === "boolean") return "Boolean";
  if (v === "json") return "Json";
  if (v === "list") return "List";
  if (v === "dual ratio") return "Dual Ratio";
  return vt ? vt : "Unknown";
}

async function readRows(filePath: string): Promise<Row[]> {
  const firstLine = fs.readFileSync(filePath, "utf8").split(/\r?\n/)[0] ?? "";
  const sep = firstLine.includes("\t") ? "\t" : ",";

  return await new Promise((resolve, reject) => {
    const out: Row[] = [];
    fs.createReadStream(filePath)
      .pipe(csv({ separator: sep }))
      .on("data", (data) => out.push(data))
      .on("end", () => resolve(out))
      .on("error", reject);
  });
}

async function main() {
  const DEFAULT_CSV = path.resolve(process.cwd(), "../../backlog/parameters.csv");
  const CSV_PATH = process.env.PARAMETERS_CSV || DEFAULT_CSV;

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`);
  }

  const rows = await readRows(CSV_PATH);
  if (rows.length === 0) {
    console.log("No rows found in:", CSV_PATH);
    return;
  }

  let upserted = 0;
  let skipped = 0;

  for (const r of rows) {
    const parameterId = clean(r["Parameter ID"]);
    if (!parameterId) {
      skipped++;
      continue;
    }

    const sectionId = clean(r["Section"]) || "Unknown";
    const domainGroup = clean(r["Model"]) || "Unknown";
    const name = clean(r["Parameter Name"]) || parameterId;
    const definition = clean(r["Explanation"]) || "";

    const measurement = clean(r["Measurement"]) || null;
    const interpretationLow = clean(r["Low Bias"]) || null;
    const interpretationHigh = clean(r["High Bias"]) || null;

    const scaleType = normalizeScaleType(clean(r["Value Type"]));
    const directionality = `Low: ${interpretationLow ?? ""} | High: ${interpretationHigh ?? ""}`.trim();
    const computedBy = "import";

    await prisma.parameter.upsert({
      where: { parameterId },
      create: {
        parameterId,
        sectionId,
        domainGroup,
        name,
        definition,
        measurementMvp: measurement,
        measurementVoiceOnly: null,
        interpretationHigh,
        interpretationLow,
        scaleType,
        directionality,
        computedBy,
      },
      update: {
        sectionId,
        domainGroup,
        name,
        definition,
        measurementMvp: measurement,
        interpretationHigh,
        interpretationLow,
        scaleType,
        directionality,
        computedBy,
      },
    });

    upserted++;
  }

  const total = await prisma.parameter.count();
  console.log("Imported file:", CSV_PATH);
  console.log("Rows read:", rows.length);
  console.log("Upserted:", upserted);
  console.log("Skipped (missing Parameter ID):", skipped);
  console.log("DB Parameter count:", total);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
