#!/usr/bin/env tsx
/**
 * Assign default domain to callers with null domainId
 *
 * This script finds all callers without a domain assignment and assigns them
 * to the "default" domain for consistent onboarding experience.
 *
 * Run with: npx tsx scripts/assign-default-domain.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Assigning default domain to legacy callers...\n");

  // 1. Find the default domain
  const defaultDomain = await prisma.domain.findFirst({
    where: { isDefault: true },
  });

  if (!defaultDomain) {
    console.error("❌ Error: No default domain found!");
    console.log("   Run 'npx tsx scripts/migrate-personas-to-domains.ts' first to create the default domain.");
    process.exit(1);
  }

  console.log(`✅ Found default domain: ${defaultDomain.name} (${defaultDomain.slug})\n`);

  // 2. Find callers without domain
  const callersWithoutDomain = await prisma.caller.findMany({
    where: { domainId: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      externalId: true,
      createdAt: true,
    },
  });

  console.log(`📊 Found ${callersWithoutDomain.length} caller(s) without domain assignment\n`);

  if (callersWithoutDomain.length === 0) {
    console.log("✨ All callers already have domains assigned. Nothing to do!");
    return;
  }

  // 3. Show preview of callers to be updated
  console.log("Preview of callers to be assigned to default domain:");
  callersWithoutDomain.slice(0, 5).forEach((caller) => {
    const label = caller.name || caller.email || caller.phone || caller.externalId || "Unnamed";
    const createdDate = new Date(caller.createdAt).toLocaleDateString();
    console.log(`   - ${label} (created ${createdDate})`);
  });
  if (callersWithoutDomain.length > 5) {
    console.log(`   ... and ${callersWithoutDomain.length - 5} more`);
  }
  console.log();

  // 4. Assign default domain to all callers without domain
  const result = await prisma.caller.updateMany({
    where: { domainId: null },
    data: { domainId: defaultDomain.id },
  });

  console.log(`✅ Assigned ${result.count} caller(s) to default domain\n`);

  // 5. Verify no callers left without domain
  const remainingNullCallers = await prisma.caller.count({
    where: { domainId: null },
  });

  if (remainingNullCallers > 0) {
    console.warn(`⚠️  Warning: ${remainingNullCallers} caller(s) still have null domainId`);
  } else {
    console.log("✨ Success! All callers now have domain assignments.\n");
  }

  // 6. Display updated stats
  const domainStats = await prisma.domain.findMany({
    select: {
      slug: true,
      name: true,
      isDefault: true,
      _count: {
        select: { callers: true },
      },
    },
    orderBy: {
      callers: {
        _count: "desc",
      },
    },
  });

  console.log("📋 Domain assignments summary:");
  domainStats.forEach((domain) => {
    const label = domain.isDefault ? `${domain.name} (default)` : domain.name;
    console.log(`   - ${label}: ${domain._count.callers} caller(s)`);
  });
}

main()
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
