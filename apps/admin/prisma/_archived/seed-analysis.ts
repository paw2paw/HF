import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

function nowStamp() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
}

async function main() {
  // 1) Fetch parameters tagged as "Active"
  const activeParams = await prisma.parameter.findMany({
    where: {
      tags: {
        some: {
          tag: {
            name: { equals: "Active", mode: "insensitive" },
          },
        },
      },
    },
    select: {
      parameterId: true,
      definition: true,
      scaleType: true,
      directionality: true,
      interpretationLow: true,
      interpretationHigh: true,
    },
    orderBy: { parameterId: "asc" },
  });

  if (activeParams.length === 0) {
    throw new Error("No Active parameters found. Check Tag + ParameterTag data.");
  }

  // 2) Create snapshot AnalysisProfile
  const set = await prisma.analysisProfile.create({
    data: {
      id: randomUUID(),
      name: `Active snapshot ${nowStamp()}`,
    },
    select: { id: true, name: true },
  });

  // 3) Snapshot parameters into AnalysisProfileParameter
  await prisma.analysisProfileParameter.createMany({
    data: activeParams.map((p) => ({
      id: randomUUID(),
      analysisProfileId: set.id,
      parameterId: p.parameterId,
      definition: p.definition ?? null,
      scaleType: p.scaleType ?? null,
      directionality: p.directionality ?? null,
      interpretationLow: p.interpretationLow ?? null,
      interpretationHigh: p.interpretationHigh ?? null,
    })),
  });

  console.log("Created AnalysisProfile:", set.id, set.name);
  console.log("Snapshot rows:", activeParams.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
