import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
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

  if (!activeParams.length) {
    throw new Error("No Active parameters found. Run analysis:ensure-active-tags first.");
  }

  const setId = randomUUID();
  const name = `Active parameters snapshot ${new Date().toISOString()}`;

  await prisma.parameterSet.create({
    data: {
      id: setId,
      name,
    },
    select: { id: true },
  });

  await prisma.parameterSetParameter.createMany({
    data: activeParams.map((p) => ({
      id: randomUUID(),
      parameterSetId: setId,
      parameterId: p.parameterId,
      definition: p.definition ?? null,
      scaleType: p.scaleType ?? null,
      directionality: p.directionality ?? null,
      interpretationLow: p.interpretationLow ?? null,
      interpretationHigh: p.interpretationHigh ?? null,
    })),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        parameterSetId: setId,
        name,
        activeCount: activeParams.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
