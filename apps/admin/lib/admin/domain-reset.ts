/**
 * Domain Reset — purge all child data and optionally re-seed.
 *
 * Dev/admin tool for resetting a domain to seed state.
 * Reuses deleteCallerData() and deletePlaybookData() for cascade deletes.
 *
 * Used by:
 * - POST /api/domains/:domainId/reset
 */

import { prisma } from "@/lib/prisma";
import { deleteCallerData } from "@/lib/gdpr/delete-caller-data";
import { deletePlaybookData } from "@/lib/gdpr/delete-playbook-data";

// Domains that have seed data in seed-demo-domains.ts
const SEED_DOMAIN_SLUGS = [
  "meridian-academy",
  "northbridge-business-school",
  "wellspring-institute",
  "harbour-languages",
];

// ── Types ────────────────────────────────────────────

export interface DomainResetPreview {
  domainId: string;
  domainName: string;
  domainSlug: string;
  isSeedDomain: boolean;
  counts: {
    callers: number;
    playbooks: number;
    cohortGroups: number;
    onboardingSessions: number;
    invites: number;
    subjectLinks: number;
    channelConfigs: number;
    playbookGroups: number;
  };
  totalRecords: number;
}

export interface DomainResetResult {
  domainId: string;
  domainName: string;
  purged: {
    callers: number;
    playbooks: number;
    cohortGroups: number;
    onboardingSessions: number;
    invites: number;
    subjectLinks: number;
    channelConfigs: number;
    playbookGroups: number;
  };
  reseeded: boolean;
}

// ── Preview ──────────────────────────────────────────

export async function previewDomainReset(domainId: string): Promise<DomainResetPreview | null> {
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    include: {
      _count: {
        select: {
          callers: true,
          playbooks: true,
          cohortGroups: true,
          onboardingSessions: true,
          invites: true,
          subjects: true,
          channelConfigs: true,
          playbookGroups: true,
        },
      },
    },
  });

  if (!domain) return null;

  const counts = {
    callers: domain._count.callers,
    playbooks: domain._count.playbooks,
    cohortGroups: domain._count.cohortGroups,
    onboardingSessions: domain._count.onboardingSessions,
    invites: domain._count.invites,
    subjectLinks: domain._count.subjects,
    channelConfigs: domain._count.channelConfigs,
    playbookGroups: domain._count.playbookGroups,
  };

  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    domainId: domain.id,
    domainName: domain.name,
    domainSlug: domain.slug,
    isSeedDomain: SEED_DOMAIN_SLUGS.includes(domain.slug),
    counts,
    totalRecords,
  };
}

// ── Execute ──────────────────────────────────────────

export async function executeDomainReset(domainId: string): Promise<DomainResetResult | null> {
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    select: { id: true, name: true, slug: true },
  });

  if (!domain) return null;

  const purged = {
    callers: 0,
    playbooks: 0,
    cohortGroups: 0,
    onboardingSessions: 0,
    invites: 0,
    subjectLinks: 0,
    channelConfigs: 0,
    playbookGroups: 0,
  };

  // 1. Delete all callers (each cascade-deletes 23 tables)
  const callers = await prisma.caller.findMany({
    where: { domainId },
    select: { id: true },
  });
  for (const caller of callers) {
    await deleteCallerData(caller.id);
    purged.callers++;
  }

  // 2. Archive PUBLISHED playbooks so deletePlaybookData won't reject
  await prisma.playbook.updateMany({
    where: { domainId, status: "PUBLISHED" },
    data: { status: "ARCHIVED" },
  });

  // 3. Delete all playbooks (each cascade-deletes 10 tables)
  const playbooks = await prisma.playbook.findMany({
    where: { domainId },
    select: { id: true },
  });
  for (const playbook of playbooks) {
    await deletePlaybookData(playbook.id);
    purged.playbooks++;
  }

  // 4. Delete remaining domain children in a single transaction
  const [cohortGroups, onboardingSessions, invites, subjectLinks, channelConfigs, playbookGroups] =
    await prisma.$transaction([
      prisma.cohortGroup.deleteMany({ where: { domainId } }),
      prisma.onboardingSession.deleteMany({ where: { domainId } }),
      prisma.invite.deleteMany({ where: { domainId } }),
      prisma.subjectDomain.deleteMany({ where: { domainId } }),
      prisma.channelConfig.deleteMany({ where: { domainId } }),
      prisma.playbookGroup.deleteMany({ where: { domainId } }),
    ]);

  purged.cohortGroups = cohortGroups.count;
  purged.onboardingSessions = onboardingSessions.count;
  purged.invites = invites.count;
  purged.subjectLinks = subjectLinks.count;
  purged.channelConfigs = channelConfigs.count;
  purged.playbookGroups = playbookGroups.count;

  // 5. Re-seed if this is a known seed domain
  let reseeded = false;
  if (SEED_DOMAIN_SLUGS.includes(domain.slug)) {
    const { seedSingleDomain } = await import("@/prisma/seed-demo-domains");
    reseeded = await seedSingleDomain(domain.slug, prisma);
  }

  return {
    domainId: domain.id,
    domainName: domain.name,
    purged,
    reseeded,
  };
}
