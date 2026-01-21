import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Check PromptStacks (the container that assembles everything)
  const stacks = await prisma.promptStack.findMany({
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          block: { select: { slug: true, name: true } },
          slug: { select: { slug: true, name: true } },
        },
      },
    },
  });
  console.log("=== PROMPT STACKS ===");
  for (const stack of stacks) {
    console.log(`\n${stack.name} (${stack.status}) ${stack.isDefault ? "- DEFAULT" : ""}`);
    console.log(`  Items: ${stack.items.length}`);
    for (const item of stack.items) {
      const ref = item.block?.slug || item.slug?.slug || item.itemType;
      console.log(`    - ${item.itemType}: ${ref}`);
    }
  }

  // 2. Check PromptBlocks (static system prompts)
  const blocks = await prisma.promptBlock.findMany({ where: { isActive: true } });
  console.log("\n=== PROMPT BLOCKS (Static) ===");
  console.log(`  ${blocks.length} active blocks`);
  blocks.slice(0, 5).forEach((b) => console.log(`    - ${b.slug}: ${b.name}`));
  if (blocks.length > 5) console.log(`    ... and ${blocks.length - 5} more`);

  // 3. Check PromptSlugs with ranges that have content
  const slugs = await prisma.promptSlug.findMany({
    include: {
      ranges: true,
      parameters: { include: { parameter: { select: { parameterId: true, name: true } } } },
    },
  });
  console.log("\n=== PROMPT SLUGS (Dynamic) ===");
  for (const slug of slugs) {
    const filledRanges = slug.ranges.filter((r) => r.prompt && r.prompt.length > 0);
    const params = slug.parameters.map((p) => p.parameter?.parameterId).join(", ");
    console.log(`  ${slug.slug}: ${filledRanges.length}/${slug.ranges.length} ranges have content`);
    console.log(`    Parameters: ${params || "none"}`);
  }

  // 4. Check UserMemories
  const memories = await prisma.userMemory.findMany({ take: 10 });
  console.log("\n=== USER MEMORIES ===");
  console.log(`  ${memories.length} memories in DB`);

  // 5. Check if we have callers with scores
  const callersWithScores = await prisma.user.findMany({
    include: {
      calls: { include: { scores: true }, take: 1 },
      memories: { take: 3 },
    },
    take: 3,
  });
  console.log("\n=== CALLERS ===");
  for (const user of callersWithScores) {
    const scoreCount = user.calls.reduce((sum, c) => sum + c.scores.length, 0);
    console.log(`  ${user.name || user.email || user.id}: ${scoreCount} scores, ${user.memories.length} memories`);
  }
}

main().then(() => prisma.$disconnect());
