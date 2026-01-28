import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed initial domains for caller segmentation.
 *
 * Domains represent distinct use cases or personas:
 * - Tutor (default): Educational/tutoring conversations
 * - Support: Customer support interactions
 * - Sales: Sales and lead conversations
 * - Wellness: Mental health and wellness coaching
 */
async function main() {
  console.log("Seeding domains...");

  const domains = [
    {
      slug: "tutor",
      name: "Tutor",
      description: "Educational and tutoring conversations. Default domain for new callers.",
      isDefault: true,
      isActive: true,
    },
    {
      slug: "support",
      name: "Support",
      description: "Customer support interactions focused on issue resolution and satisfaction.",
      isDefault: false,
      isActive: true,
    },
    {
      slug: "sales",
      name: "Sales",
      description: "Sales and lead qualification conversations.",
      isDefault: false,
      isActive: true,
    },
    {
      slug: "wellness",
      name: "Wellness",
      description: "Mental health, wellness coaching, and supportive conversations.",
      isDefault: false,
      isActive: true,
    },
  ];

  for (const domain of domains) {
    const existing = await prisma.domain.findUnique({
      where: { slug: domain.slug },
    });

    if (existing) {
      console.log(`  Domain "${domain.slug}" already exists, updating...`);
      await prisma.domain.update({
        where: { slug: domain.slug },
        data: domain,
      });
    } else {
      console.log(`  Creating domain "${domain.slug}"...`);
      await prisma.domain.create({
        data: domain,
      });
    }
  }

  // Verify only one default domain
  const defaultDomains = await prisma.domain.findMany({
    where: { isDefault: true },
  });

  if (defaultDomains.length > 1) {
    console.warn(`  Warning: Multiple default domains found. Setting only "tutor" as default.`);
    await prisma.domain.updateMany({
      where: { isDefault: true, slug: { not: "tutor" } },
      data: { isDefault: false },
    });
  }

  const count = await prisma.domain.count();
  console.log(`Done. ${count} domains in database.`);
}

main()
  .catch((e) => {
    console.error("Error seeding domains:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
