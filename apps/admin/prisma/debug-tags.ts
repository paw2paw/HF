import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const parameters = await prisma.parameter.count();
  const tags = await prisma.tag.count();
  const parameterTags = await prisma.parameterTag.count();

  const topTags = await prisma.tag.findMany({
    select: { id: true, name: true, slug: true, _count: { select: { parameters: true } } },
    orderBy: { parameters: { _count: "desc" } },
    take: 30,
  });

  const activeTag = await prisma.tag.findFirst({
    where: { name: { equals: "Active", mode: "insensitive" } },
    select: { id: true, name: true, slug: true },
  });

  const activeLinks = activeTag
    ? await prisma.parameterTag.count({ where: { tagId: activeTag.id } })
    : 0;

  console.log({ parameters, tags, parameterTags, activeTag, activeLinks });
  console.log("Top tags:");
  for (const t of topTags) {
    console.log(`- ${t.name} (id=${t.id}, slug=${t.slug}) links=${t._count.parameters}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
