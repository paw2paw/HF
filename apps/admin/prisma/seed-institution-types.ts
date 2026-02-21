/**
 * Seed Institution Types
 *
 * Creates the default institution types with terminology presets.
 * Each type defines how entity labels appear for non-admin users.
 *
 * Idempotent: uses upsert on slug.
 *
 * Usage: npx tsx prisma/seed-institution-types.ts
 */

import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

interface InstitutionTypeSeed {
  slug: string;
  name: string;
  description: string;
  terminology: {
    domain: string;
    playbook: string;
    spec: string;
    caller: string;
    cohort: string;
    instructor: string;
    session: string;
  };
  setupSpecSlug: string | null;
  defaultDomainKind: "INSTITUTION" | "COMMUNITY";
}

const TYPES: InstitutionTypeSeed[] = [
  {
    slug: "school",
    name: "School",
    description: "Primary/secondary schools and educational institutions",
    terminology: {
      domain: "School",
      playbook: "Lesson Plan",
      spec: "Content",
      caller: "Student",
      cohort: "Class",
      instructor: "Teacher",
      session: "Lesson",
    },
    setupSpecSlug: "COURSE-SETUP-001",
    defaultDomainKind: "INSTITUTION",
  },
  {
    slug: "corporate",
    name: "Corporate",
    description: "Businesses and corporate training environments",
    terminology: {
      domain: "Organization",
      playbook: "Training Plan",
      spec: "Content",
      caller: "Employee",
      cohort: "Team",
      instructor: "Trainer",
      session: "Training Session",
    },
    setupSpecSlug: "COURSE-SETUP-001",
    defaultDomainKind: "INSTITUTION",
  },
  {
    slug: "community",
    name: "Community",
    description: "Purpose-led communities, support groups, and member networks",
    terminology: {
      domain: "Hub",
      playbook: "Programme",
      spec: "Topic",
      caller: "Member",
      cohort: "Community",
      instructor: "Facilitator",
      session: "Call",
    },
    setupSpecSlug: "COMMUNITY-SETUP-001",
    defaultDomainKind: "COMMUNITY",
  },
  {
    slug: "coaching",
    name: "Coaching",
    description: "Coaching practices and mentoring programs",
    terminology: {
      domain: "Practice",
      playbook: "Coaching Plan",
      spec: "Content",
      caller: "Client",
      cohort: "Group",
      instructor: "Coach",
      session: "Coaching Session",
    },
    setupSpecSlug: "COURSE-SETUP-001",
    defaultDomainKind: "INSTITUTION",
  },
  {
    slug: "healthcare",
    name: "Healthcare",
    description: "Healthcare facilities and patient care programs",
    terminology: {
      domain: "Facility",
      playbook: "Care Plan",
      spec: "Content",
      caller: "Patient",
      cohort: "Team",
      instructor: "Provider",
      session: "Patient Session",
    },
    setupSpecSlug: "COURSE-SETUP-001",
    defaultDomainKind: "INSTITUTION",
  },
  {
    slug: "training",
    name: "Training",
    description: "Training companies and professional development providers",
    terminology: {
      domain: "Academy",
      playbook: "Course",
      spec: "Content",
      caller: "Participant",
      cohort: "Cohort",
      instructor: "Trainer",
      session: "Training Session",
    },
    setupSpecSlug: "COURSE-SETUP-001",
    defaultDomainKind: "INSTITUTION",
  },
];

export async function main(externalPrisma?: PrismaClient) {
  prisma = externalPrisma || new PrismaClient();

  console.log("Seeding institution types...");

  for (const typeDef of TYPES) {
    const result = await prisma.institutionType.upsert({
      where: { slug: typeDef.slug },
      update: {
        name: typeDef.name,
        description: typeDef.description,
        terminology: typeDef.terminology,
        setupSpecSlug: typeDef.setupSpecSlug,
        defaultDomainKind: typeDef.defaultDomainKind,
      },
      create: {
        slug: typeDef.slug,
        name: typeDef.name,
        description: typeDef.description,
        terminology: typeDef.terminology,
        setupSpecSlug: typeDef.setupSpecSlug,
        defaultDomainKind: typeDef.defaultDomainKind,
      },
    });

    console.log(`  ${result.name} (${result.slug}) → ${result.id}`);
  }

  console.log(`  Done: ${TYPES.length} institution types seeded`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error("Seed failed:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
