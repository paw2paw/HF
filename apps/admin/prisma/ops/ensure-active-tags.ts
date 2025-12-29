import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const activeName = "Active";
  const activeSlug = "active";

  const existing = await prisma.tag.findFirst({
    where: { name: { equals: activeName, mode: "insensitive" } },
    select: { id: true, name: true },
  });

  const activeTag =
    existing ??
    (await prisma.tag.create({
      data: {
        id: randomUUID(),
        name: activeName,
        slug: activeSlug,
        tone: null,
      },
      select: { id: true, name: true },
    }));

  const alreadyLinked = await prisma.parameterTag.findMany({
    where: { tagId: activeTag.id },
    select: { parameterId: true },
  });

  const linkedSet = new Set(alreadyLinked.map((x) => x.parameterId));

  const allParams = await prisma.parameter.findMany({
    select: { parameterId: true },
  });

  const toCreate = allParams
    .filter((p) => !linkedSet.has(p.parameterId))
    .map((p) => ({
      id: randomUUID(),
      parameterId: p.parameterId,
      tagId: activeTag.id,
    }));

  if (toCreate.length) {
    await prisma.parameterTag.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        activeTag,
        parameters: allParams.length,
        alreadyLinked: alreadyLinked.length,
        created: toCreate.length,
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
