import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

/**
 * Seed initial domains for caller segmentation.
 *
 * Domains represent distinct learning programmes offered by professional institutions:
 * - Meridian Academy (default): K-12 adaptive tutoring
 * - Northbridge Business School: Professional development and leadership coaching
 * - Wellspring Institute: Mental health and wellness support
 * - Harbour Languages: Modern foreign language acquisition
 */
export async function main(externalPrisma?: PrismaClient) {
  prisma = externalPrisma || new PrismaClient();
  console.log("Seeding domains...");

  const domains = [
    {
      slug: "meridian-academy",
      name: "Meridian Academy",
      description: "K-12 adaptive tutoring across mathematics, science, and literacy. Personalised learning paths for every student.",
      isDefault: true,
      isActive: true,
    },
    {
      slug: "northbridge-business-school",
      name: "Northbridge Business School",
      description: "Professional development, leadership coaching, and executive communication skills for corporate learners.",
      isDefault: false,
      isActive: true,
    },
    {
      slug: "wellspring-institute",
      name: "Wellspring Institute",
      description: "Mental health awareness, resilience building, and wellness coaching programmes for individuals and organisations.",
      isDefault: false,
      isActive: true,
    },
    {
      slug: "harbour-languages",
      name: "Harbour Languages",
      description: "Modern foreign language acquisition through immersive conversational practice. French, Spanish, German, and Mandarin.",
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
    console.warn(`  Warning: Multiple default domains found. Setting only "meridian-academy" as default.`);
    await prisma.domain.updateMany({
      where: { isDefault: true, slug: { not: "meridian-academy" } },
      data: { isDefault: false },
    });
  }

  const count = await prisma.domain.count();
  console.log(`Done. ${count} domains in database.`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error("Error seeding domains:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
