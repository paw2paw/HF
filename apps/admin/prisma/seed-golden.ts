/**
 * Golden Path Seed
 *
 * Creates a clean, minimal dataset for golden path demos:
 *   1. Greenfield Academy (school) — 2 lesson plans, 2 classes, 8 students
 *   2. Apex Consulting (corporate) — 1 training plan, 1 team, 6 employees
 *   3. Bright Path Training (training) — 12 courses, 1 cohort, 8 participants
 *
 * Each institution gets an EDUCATOR login (hff2026) so terminology resolves correctly.
 * All entities tagged with "golden-" externalId prefix for idempotent cleanup.
 *
 * Non-PROD only — refuses to run when NEXT_PUBLIC_APP_ENV=LIVE.
 *
 * Usage:
 *   SEED_PROFILE=golden npx tsx prisma/seed-full.ts --reset
 *   npx tsx prisma/seed-golden.ts          # standalone
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const DEMO_PASSWORD = "hff2026";
const DEFAULT_ARCHETYPE = "TUT-001";
const TAG = "golden-";

// ══════════════════════════════════════════════════════════
// DATA DEFINITIONS
// ══════════════════════════════════════════════════════════

interface InstitutionDef {
  slug: string;
  name: string;
  typeSlug: string;
  primaryColor: string;
  secondaryColor: string;
  welcomeMessage: string;
  login: { email: string; name: string };
  domain: DomainDef;
}

interface DomainDef {
  slug: string;
  name: string;
  description: string;
  playbooks: PlaybookDef[];
  cohorts: CohortDef[];
}

interface PlaybookDef {
  slug: string;
  name: string;
  description: string;
}

interface CohortDef {
  name: string;
  teacher: { name: string; email: string };
  members: string[]; // learner names
}

const INSTITUTIONS: InstitutionDef[] = [
  // ── 1. School ──────────────────────────────────────────
  {
    slug: "greenfield-academy",
    name: "Greenfield Academy",
    typeSlug: "school",
    primaryColor: "#166534",
    secondaryColor: "#ca8a04",
    welcomeMessage: "Welcome to Greenfield Academy! Our AI tutors help every student build confidence and understanding.",
    login: { email: "school@hff.com", name: "Sarah Thompson" },
    domain: {
      slug: "greenfield-academy",
      name: "Greenfield Academy",
      description: "Primary school with focus on literacy and numeracy across Key Stage 2.",
      playbooks: [
        { slug: "golden-year5-english", name: "Year 5 English", description: "Comprehension, creative writing, and SPAG for Year 5 students." },
        { slug: "golden-year5-maths", name: "Year 5 Maths", description: "Number, fractions, geometry, and problem-solving for Year 5 students." },
      ],
      cohorts: [
        {
          name: "Class 5A",
          teacher: { name: "Mrs. Sarah Thompson", email: "s.thompson@greenfield.sch.uk" },
          members: ["Emma Wilson", "Oliver Patel", "Amira Hassan", "Jack Chen"],
        },
        {
          name: "Class 5B",
          teacher: { name: "Mr. David Clarke", email: "d.clarke@greenfield.sch.uk" },
          members: ["Sophie Brown", "Noah Martinez", "Zara Ali", "Liam O'Connor"],
        },
      ],
    },
  },

  // ── 2. Corporate ───────────────────────────────────────
  {
    slug: "apex-consulting",
    name: "Apex Consulting",
    typeSlug: "corporate",
    primaryColor: "#1e3a5f",
    secondaryColor: "#0d9488",
    welcomeMessage: "Welcome to Apex Consulting's learning platform. Develop your leadership skills with AI-powered coaching.",
    login: { email: "corporate@hff.com", name: "Rachel Foster" },
    domain: {
      slug: "apex-consulting",
      name: "Apex Consulting",
      description: "Professional development and leadership coaching for mid-level managers.",
      playbooks: [
        { slug: "golden-leadership", name: "Leadership Essentials", description: "Core leadership principles, vision setting, and team motivation for aspiring managers." },
      ],
      cohorts: [
        {
          name: "Engineering Team",
          teacher: { name: "Rachel Foster", email: "r.foster@apex.co.uk" },
          members: ["Sarah Mitchell", "David Kim", "James Okonkwo", "Lisa Chen", "Marcus Reid", "Tom Eriksson"],
        },
      ],
    },
  },

  // ── 3. Training Company ────────────────────────────────
  {
    slug: "bright-path-training",
    name: "Bright Path Training",
    typeSlug: "training",
    primaryColor: "#7c3aed",
    secondaryColor: "#f59e0b",
    welcomeMessage: "Welcome to Bright Path Training! Access our full catalogue of professional development courses.",
    login: { email: "training@hff.com", name: "Hannah Blake" },
    domain: {
      slug: "bright-path-training",
      name: "Bright Path Training",
      description: "Professional development provider offering 12+ courses across leadership, communication, and management skills.",
      playbooks: [
        { slug: "golden-leadership-fund", name: "Leadership Fundamentals", description: "Core leadership principles, vision setting, and team motivation for new and aspiring managers." },
        { slug: "golden-comms-mastery", name: "Communication Mastery", description: "Effective verbal and written communication, active listening, and persuasive presentation skills." },
        { slug: "golden-project-mgmt", name: "Project Management Essentials", description: "Planning, execution, and delivery of projects using agile and traditional methodologies." },
        { slug: "golden-sales-skills", name: "Sales Skills Bootcamp", description: "Consultative selling, objection handling, pipeline management, and closing techniques." },
        { slug: "golden-customer-svc", name: "Customer Service Excellence", description: "Building customer relationships, handling complaints, and delivering exceptional service experiences." },
        { slug: "golden-team-building", name: "Team Building & Collaboration", description: "Cross-functional collaboration, trust building, and high-performance team dynamics." },
        { slug: "golden-time-mgmt", name: "Time Management & Productivity", description: "Prioritisation frameworks, focus techniques, and personal productivity systems." },
        { slug: "golden-conflict-res", name: "Conflict Resolution", description: "Navigating workplace disagreements, mediation skills, and constructive feedback delivery." },
        { slug: "golden-presentations", name: "Presentation Skills", description: "Structuring compelling presentations, storytelling techniques, and confident public speaking." },
        { slug: "golden-coaching-ment", name: "Coaching & Mentoring", description: "Developing others through structured coaching conversations and mentoring relationships." },
        { slug: "golden-change-mgmt", name: "Change Management", description: "Leading organisational change, stakeholder engagement, and overcoming resistance to transformation." },
        { slug: "golden-emotional-int", name: "Emotional Intelligence at Work", description: "Self-awareness, empathy, social skills, and emotional regulation in professional settings." },
      ],
      cohorts: [
        {
          name: "Q1 2026 Cohort",
          teacher: { name: "Hannah Blake", email: "h.blake@brightpath.co.uk" },
          members: ["Tom Eriksson", "Priya Sharma", "Daniel Armstrong", "Fatima Noor", "Chris Palmer", "Yuki Tanaka", "Ben Crawford", "Olivia Hayes"],
        },
      ],
    },
  },
];

// ── Default onboarding flow phases (inlined from fallback-settings.ts) ──
const DEFAULT_FLOW_PHASES = [
  { phase: "greeting", label: "Greeting & welcome" },
  { phase: "rapport", label: "Build rapport" },
  { phase: "assessment", label: "Quick assessment" },
  { phase: "teaching", label: "Teaching interaction" },
  { phase: "summary", label: "Session summary" },
];

// ══════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════

export async function main(externalPrisma?: PrismaClient): Promise<void> {
  // PROD guard
  const env = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV;
  if (env === "LIVE" || env === "production") {
    console.log("  ⛔ Skipping golden seed — PROD environment detected");
    return;
  }

  const prisma = externalPrisma || new PrismaClient();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  console.log("\n  🌟 Seeding Golden Path data...\n");

  // ── 1. Cleanup existing golden data (FK-safe order) ────
  await cleanup(prisma);

  // ── 2. Create institutions, domains, playbooks, cohorts ─
  let totalPlaybooks = 0;
  let totalCohorts = 0;
  let totalTeachers = 0;
  let totalLearners = 0;

  for (const inst of INSTITUTIONS) {
    console.log(`  ── ${inst.name} (${inst.typeSlug}) ──`);

    // Find institution type
    const instType = await prisma.institutionType.findUnique({
      where: { slug: inst.typeSlug },
    });
    if (!instType) {
      console.warn(`  ⚠ Institution type "${inst.typeSlug}" not found — skipping`);
      continue;
    }

    // Create institution
    const institution = await prisma.institution.upsert({
      where: { slug: inst.slug },
      update: {
        name: inst.name,
        typeId: instType.id,
        primaryColor: inst.primaryColor,
        secondaryColor: inst.secondaryColor,
        welcomeMessage: inst.welcomeMessage,
      },
      create: {
        name: inst.name,
        slug: inst.slug,
        typeId: instType.id,
        primaryColor: inst.primaryColor,
        secondaryColor: inst.secondaryColor,
        welcomeMessage: inst.welcomeMessage,
      },
    });
    console.log(`    + Institution: ${institution.name}`);

    // Create domain
    const domain = await prisma.domain.upsert({
      where: { slug: inst.domain.slug },
      update: {
        name: inst.domain.name,
        description: inst.domain.description,
        institutionId: institution.id,
        isActive: true,
      },
      create: {
        slug: inst.domain.slug,
        name: inst.domain.name,
        description: inst.domain.description,
        isActive: true,
        institutionId: institution.id,
      },
    });
    console.log(`    + Domain: ${domain.name}`);

    // Create identity spec (overlay extending base archetype)
    const identitySlug = `${domain.slug}-identity`;
    const identitySpec = await prisma.analysisSpec.upsert({
      where: { slug: identitySlug },
      update: {
        name: `${domain.name} Identity`,
        isActive: true,
      },
      create: {
        slug: identitySlug,
        name: `${domain.name} Identity`,
        description: `Domain overlay for ${domain.name} — extends the base tutor archetype.`,
        outputType: "COMPOSE",
        specRole: "IDENTITY",
        specType: "DOMAIN",
        domain: "identity",
        scope: "DOMAIN",
        isActive: true,
        isDirty: false,
        isDeletable: true,
        extendsAgent: DEFAULT_ARCHETYPE,
        config: {
          parameters: [
            {
              id: "tutor_role",
              name: "Domain Role Override",
              section: "identity",
              config: {
                roleStatement: `You are a friendly, patient tutor specializing in ${domain.name}. You adapt to each learner's pace and style while maintaining high standards for understanding.`,
                primaryGoal: `Help learners build genuine understanding of ${domain.name}`,
              },
            },
          ],
        },
        triggers: {
          create: [
            {
              given: `A ${domain.name} teaching session`,
              when: "The system needs to establish agent identity and tone",
              then: "A consistent, domain-appropriate teaching personality is presented",
              name: "Identity establishment",
              sortOrder: 0,
            },
          ],
        },
      },
    });

    // Get all active system specs for playbook toggles
    const systemSpecs = await prisma.analysisSpec.findMany({
      where: { specType: "SYSTEM", isActive: true },
      select: { id: true },
    });
    const systemSpecToggles: Record<string, { isEnabled: boolean }> = {};
    for (const ss of systemSpecs) {
      systemSpecToggles[ss.id] = { isEnabled: true };
    }

    // Create playbooks
    const playbooks: Array<{ id: string; name: string }> = [];

    for (let i = 0; i < inst.domain.playbooks.length; i++) {
      const pbDef = inst.domain.playbooks[i];

      const playbook = await prisma.playbook.create({
        data: {
          name: pbDef.name,
          description: pbDef.description,
          domainId: domain.id,
          status: "PUBLISHED",
          version: "1.0",
          publishedAt: new Date(),
          validationPassed: true,
          measureSpecCount: 0,
          learnSpecCount: 0,
          adaptSpecCount: 0,
          parameterCount: 0,
          config: { systemSpecToggles },
        },
      });

      // Link identity spec to playbook
      await prisma.playbookItem.create({
        data: {
          playbookId: playbook.id,
          itemType: "SPEC",
          specId: identitySpec.id,
          sortOrder: 0,
          isEnabled: true,
        },
      });

      playbooks.push({ id: playbook.id, name: playbook.name });
      console.log(`    + Playbook: ${playbook.name}`);
    }
    totalPlaybooks += playbooks.length;

    // Configure onboarding on domain
    await prisma.domain.update({
      where: { id: domain.id },
      data: {
        onboardingIdentitySpecId: identitySpec.id,
        onboardingFlowPhases: DEFAULT_FLOW_PHASES,
      },
    });

    // Create cohorts, teachers, and learners
    for (const cohortDef of inst.domain.cohorts) {
      // Create teacher caller first (needed as cohort owner)
      const teacherCaller = await prisma.caller.create({
        data: {
          name: cohortDef.teacher.name,
          email: cohortDef.teacher.email,
          externalId: `${TAG}teacher-${inst.slug}-${slugify(cohortDef.name)}`,
          role: "TEACHER",
          domainId: domain.id,
        },
      });
      totalTeachers++;

      // Create cohort group
      const cohort = await prisma.cohortGroup.create({
        data: {
          name: cohortDef.name,
          domainId: domain.id,
          ownerId: teacherCaller.id,
          institutionId: institution.id,
          maxMembers: 50,
          isActive: true,
        },
      });
      console.log(`    + Cohort: ${cohort.name} (${cohortDef.members.length} members)`);
      totalCohorts++;

      // Create learner callers
      for (const memberName of cohortDef.members) {
        const learner = await prisma.caller.create({
          data: {
            name: memberName,
            externalId: `${TAG}learner-${inst.slug}-${slugify(memberName)}`,
            role: "LEARNER",
            domainId: domain.id,
            cohortGroupId: cohort.id,
          },
        });
        totalLearners++;

        // Enroll in all playbooks for this domain
        for (const pb of playbooks) {
          await prisma.callerPlaybook.create({
            data: {
              callerId: learner.id,
              playbookId: pb.id,
              status: "ACTIVE",
              enrolledBy: "golden-seed",
            },
          });
        }
      }

      // Link cohort to playbooks
      for (const pb of playbooks) {
        await prisma.cohortPlaybook.create({
          data: {
            cohortGroupId: cohort.id,
            playbookId: pb.id,
            assignedBy: "golden-seed",
          },
        });
      }
    }

    // Create EDUCATOR login for this institution
    await prisma.user.upsert({
      where: { email: inst.login.email },
      update: {
        name: inst.login.name,
        passwordHash,
        role: "EDUCATOR",
        isActive: true,
        institutionId: institution.id,
      },
      create: {
        email: inst.login.email,
        name: inst.login.name,
        passwordHash,
        role: "EDUCATOR",
        isActive: true,
        institutionId: institution.id,
      },
    });
    console.log(`    + Login: ${inst.login.email}`);
    console.log("");
  }

  // ── Summary ────────────────────────────────────────────
  console.log("  ─────────────────────────────────────────────");
  console.log(`  ✓ Golden Path seed complete`);
  console.log(`    Institutions:  ${INSTITUTIONS.length}`);
  console.log(`    Domains:       ${INSTITUTIONS.length}`);
  console.log(`    Playbooks:     ${totalPlaybooks}`);
  console.log(`    Cohorts:       ${totalCohorts}`);
  console.log(`    Teachers:      ${totalTeachers}`);
  console.log(`    Learners:      ${totalLearners}`);
  console.log(`    Logins:        ${INSTITUTIONS.length}`);
  console.log("");

  if (!externalPrisma) {
    await prisma.$disconnect();
  }
}

// ══════════════════════════════════════════════════════════
// CLEANUP
// ══════════════════════════════════════════════════════════

async function cleanup(prisma: PrismaClient): Promise<void> {
  // Nuclear cleanup: wipe ALL entity data that seed-clean's clearDatabase() misses.
  // seed-clean handles: specs, parameters, callers, calls, playbooks, domains, etc.
  // But it DOESN'T clear: institutions, users (non-admin), goals, cohorts, enrollments.
  // For golden profile we want a truly empty slate before creating the 3 institutions.

  // FK-safe order: leaf tables first, then parents
  const tables = [
    "callerPlaybook",
    "cohortPlaybook",
    "goal",
    "onboardingSession",
    "invite",
    "channelConfig",
    "subjectSource",
    "contentVocabulary",
    "contentQuestion",
    "contentAssertion",
    "contentSource",
    "subjectDomain",
    "subject",
    "mediaAsset",
    "userTask",
  ];

  for (const table of tables) {
    try {
      // @ts-ignore — dynamic table access
      const count = await prisma[table].count();
      if (count > 0) {
        // @ts-ignore
        await prisma[table].deleteMany();
      }
    } catch {
      // Table might not exist in this schema version
    }
  }

  // Disconnect callers from cohort groups before deleting cohorts
  await prisma.caller.updateMany({
    where: { cohortGroupId: { not: null } },
    data: { cohortGroupId: null },
  });

  // Delete all cohort groups
  await prisma.cohortGroup.deleteMany();

  // Delete all callers (seed-clean may have missed some)
  await prisma.caller.deleteMany();

  // Delete all playbook items, then playbooks
  await prisma.playbookItem.deleteMany();
  await prisma.playbook.deleteMany();

  // Delete domain-scoped identity specs (DOMAIN type)
  await prisma.analysisSpec.deleteMany({
    where: { specType: "DOMAIN" },
  });

  // Delete all domains
  await prisma.domain.deleteMany();

  // Delete all institutions
  await prisma.institution.deleteMany();

  // Delete non-admin users (keep SUPERADMIN accounts from seed-clean)
  await prisma.user.deleteMany({
    where: { role: { not: "SUPERADMIN" } },
  });

  console.log("  🧹 Cleaned all entity data (keeping specs + admin users)\n");
}

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Direct execution
if (require.main === module) {
  main().catch((e) => {
    console.error("Golden seed failed:", e);
    process.exit(1);
  });
}
