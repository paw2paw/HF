/**
 * Setup Food Safety domain and playbook
 * Run: npx tsx scripts/setup-food-safety-playbook.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Create or find the Food Safety domain
  let domain = await prisma.domain.findFirst({
    where: { slug: "food-safety" },
  });

  if (!domain) {
    domain = await prisma.domain.create({
      data: {
        name: "Food Safety Level 2",
        slug: "food-safety",
        description:
          "Highfield Level 2 Award in Food Safety for Catering (RQF)",
      },
    });
    console.log("✓ Created domain:", domain.name);
  } else {
    console.log("✓ Found existing domain:", domain.name);
  }

  // 2. Get the CONTENT spec
  const contentSpec = await prisma.analysisSpec.findFirst({
    where: { slug: "spec-curr-fs-l2-001" },
  });

  if (!contentSpec) {
    console.error("✗ Content spec not found: spec-curr-fs-l2-001");
    console.error("  Run: npm run db:seed first");
    return;
  }
  console.log("✓ Found content spec:", contentSpec.name);

  // 3. Get the TUT-001 identity spec (for tutor persona)
  const identitySpec = await prisma.analysisSpec.findFirst({
    where: { slug: "spec-tut-001" },
  });
  console.log("✓ Found identity spec:", identitySpec?.name || "not found");

  // 4. Create or update the playbook
  let playbook = await prisma.playbook.findFirst({
    where: {
      domainId: domain.id,
    },
  });

  if (!playbook) {
    playbook = await prisma.playbook.create({
      data: {
        name: "Food Safety L2 Tutor",
        description:
          "Playbook for Level 2 Food Hygiene and Safety Certificate tutoring",
        domainId: domain.id,
        status: "PUBLISHED",
        sortOrder: 1,
      },
    });
    console.log("✓ Created playbook:", playbook.name);
  } else {
    // Update to PUBLISHED if not already
    if (playbook.status !== "PUBLISHED") {
      await prisma.playbook.update({
        where: { id: playbook.id },
        data: { status: "PUBLISHED" },
      });
      console.log("✓ Published existing playbook:", playbook.name);
    } else {
      console.log("✓ Found existing published playbook:", playbook.name);
    }
  }

  // 5. Add specs to playbook (if not already)
  const existingItems = await prisma.playbookItem.findMany({
    where: { playbookId: playbook.id },
  });

  // Add content spec
  if (!existingItems.find((i) => i.specId === contentSpec.id)) {
    await prisma.playbookItem.create({
      data: {
        playbookId: playbook.id,
        itemType: "SPEC",
        specId: contentSpec.id,
        isEnabled: true,
        sortOrder: 10,
      },
    });
    console.log("✓ Added content spec to playbook");
  } else {
    console.log("✓ Content spec already in playbook");
  }

  // Add identity spec if found
  if (identitySpec && !existingItems.find((i) => i.specId === identitySpec.id)) {
    await prisma.playbookItem.create({
      data: {
        playbookId: playbook.id,
        itemType: "SPEC",
        specId: identitySpec.id,
        isEnabled: true,
        sortOrder: 1,
      },
    });
    console.log("✓ Added identity spec to playbook");
  }

  // 6. Summary
  const finalItems = await prisma.playbookItem.findMany({
    where: { playbookId: playbook.id },
    include: { spec: { select: { slug: true, name: true, specRole: true } } },
  });

  console.log("");
  console.log("═══════════════════════════════════════════");
  console.log("  FOOD SAFETY PLAYBOOK READY");
  console.log("═══════════════════════════════════════════");
  console.log("  Domain:", domain.name, "(" + domain.slug + ")");
  console.log("  Domain ID:", domain.id);
  console.log("  Playbook:", playbook.name, "[" + playbook.status + "]");
  console.log("  Specs:");
  finalItems.forEach((item) => {
    console.log("    -", item.spec?.specRole, ":", item.spec?.name);
  });
  console.log("");
  console.log("  Next steps:");
  console.log("  1. Assign a caller to domain:", domain.id);
  console.log("  2. Call: GET /api/prompt/compose?callerId=<caller-id>");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
