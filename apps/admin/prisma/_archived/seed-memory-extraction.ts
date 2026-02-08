/**
 * Seed script for Memory Extraction analysis specs
 *
 * Run with: npx tsx prisma/seed-memory-extraction.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Memory extraction specs
const MEMORY_EXTRACTION_SPECS = [
  {
    slug: "memory-personal-facts",
    name: "Memory - Personal Facts",
    description:
      "Extracts factual information about the caller: location, job, company, and other stable facts that help personalize future interactions.",
    domain: "memory",
    outputType: "LEARN" as const,
    priority: 10,
    triggers: [
      {
        name: "Caller mentions location",
        given: "A caller is in conversation",
        when: "They mention where they live, work, or are located",
        then: "Extract location information as a FACT",
        actions: [
          {
            description: "Extract city, region, or country mentioned",
            learnCategory: "FACT" as const,
            learnKeyPrefix: "location",
            learnKeyHint: "Use specific keys like location_city, location_country",
          },
        ],
      },
      {
        name: "Caller mentions work/job",
        given: "A caller is in conversation",
        when: "They mention their job, role, company, or profession",
        then: "Extract work-related facts",
        actions: [
          {
            description: "Extract job title or role",
            learnCategory: "FACT" as const,
            learnKeyPrefix: "job",
            learnKeyHint: "e.g., job_title, job_company, job_industry",
          },
        ],
      },
    ],
  },
  {
    slug: "memory-relationships",
    name: "Memory - Relationships",
    description:
      "Extracts information about people the caller mentions: family members, colleagues, friends. Helps build context for personalized conversations.",
    domain: "memory",
    outputType: "LEARN" as const,
    priority: 9,
    triggers: [
      {
        name: "Caller mentions family",
        given: "A caller is in conversation",
        when: "They mention family members (spouse, children, parents, siblings)",
        then: "Extract relationship information",
        actions: [
          {
            description: "Extract family member names and relationships",
            learnCategory: "RELATIONSHIP" as const,
            learnKeyPrefix: "person_family",
            learnKeyHint: "e.g., person_family_spouse, person_family_child_1",
          },
        ],
      },
      {
        name: "Caller mentions colleagues",
        given: "A caller is in conversation",
        when: "They mention coworkers, managers, or business contacts",
        then: "Extract professional relationship information",
        actions: [
          {
            description: "Extract colleague names and roles",
            learnCategory: "RELATIONSHIP" as const,
            learnKeyPrefix: "person_work",
            learnKeyHint: "e.g., person_work_manager, person_work_colleague",
          },
        ],
      },
    ],
  },
  {
    slug: "memory-preferences",
    name: "Memory - Preferences",
    description:
      "Extracts stated preferences about communication style, contact methods, and interaction preferences.",
    domain: "memory",
    outputType: "LEARN" as const,
    priority: 8,
    triggers: [
      {
        name: "Caller expresses communication preference",
        given: "A caller is discussing how to proceed or follow up",
        when: "They express a preference for contact method or communication style",
        then: "Extract preference information",
        actions: [
          {
            description: "Extract contact method preferences (email, phone, etc.)",
            learnCategory: "PREFERENCE" as const,
            learnKeyPrefix: "prefers_contact",
            learnKeyHint: "e.g., prefers_contact_method, prefers_contact_time",
          },
          {
            description: "Extract communication style preferences",
            learnCategory: "PREFERENCE" as const,
            learnKeyPrefix: "prefers_style",
            learnKeyHint: "e.g., prefers_style_brief, prefers_style_detailed",
          },
        ],
      },
    ],
  },
  {
    slug: "memory-events",
    name: "Memory - Events & Context",
    description:
      "Extracts time-sensitive information: upcoming events, recent happenings, temporary situations.",
    domain: "memory",
    outputType: "LEARN" as const,
    priority: 7,
    triggers: [
      {
        name: "Caller mentions upcoming event",
        given: "A caller is in conversation",
        when: "They mention something happening soon (trip, meeting, deadline)",
        then: "Extract event information with temporal context",
        actions: [
          {
            description: "Extract upcoming events and their timing",
            learnCategory: "EVENT" as const,
            learnKeyPrefix: "event_upcoming",
            learnKeyHint: "Include approximate timing if mentioned",
          },
        ],
      },
      {
        name: "Caller mentions current situation",
        given: "A caller is in conversation",
        when: "They mention a temporary situation (traveling, busy period, illness)",
        then: "Extract situational context",
        actions: [
          {
            description: "Extract current situational context",
            learnCategory: "CONTEXT" as const,
            learnKeyPrefix: "context",
            learnKeyHint: "e.g., context_traveling, context_busy_period",
          },
        ],
      },
    ],
  },
  {
    slug: "memory-topics",
    name: "Memory - Topics & Interests",
    description:
      "Extracts topics the caller shows interest in, products discussed, or concerns raised.",
    domain: "memory",
    outputType: "LEARN" as const,
    priority: 6,
    triggers: [
      {
        name: "Caller expresses interest",
        given: "A caller is discussing products or services",
        when: "They express interest in or ask about specific topics",
        then: "Extract topic/interest information",
        actions: [
          {
            description: "Extract products or services of interest",
            learnCategory: "TOPIC" as const,
            learnKeyPrefix: "interest_product",
            learnKeyHint: "e.g., interest_product_premium_tier",
          },
          {
            description: "Extract general topics or concerns",
            learnCategory: "TOPIC" as const,
            learnKeyPrefix: "interest_topic",
            learnKeyHint: "e.g., interest_topic_pricing, interest_topic_features",
          },
        ],
      },
    ],
  },
  {
    slug: "memory-history",
    name: "Memory - Past Experiences",
    description:
      "Extracts things the caller has done in the past: previous jobs, places lived, travels, education, life experiences. Builds a richer profile for personalization.",
    domain: "memory",
    outputType: "LEARN" as const,
    priority: 5,
    triggers: [
      {
        name: "Caller mentions past work experience",
        given: "A caller is in conversation",
        when: "They mention a previous job, role, or company they worked at",
        then: "Extract work history as a FACT",
        actions: [
          {
            description: "Extract previous job titles, companies, or industries",
            learnCategory: "FACT" as const,
            learnKeyPrefix: "history_job",
            learnKeyHint: "e.g., history_job_previous_company, history_job_past_role",
          },
        ],
      },
      {
        name: "Caller mentions past travel or places lived",
        given: "A caller is in conversation",
        when: "They mention places they've traveled to or lived in the past",
        then: "Extract location history",
        actions: [
          {
            description: "Extract places visited or previously lived",
            learnCategory: "FACT" as const,
            learnKeyPrefix: "history_location",
            learnKeyHint: "e.g., history_location_lived_london, history_location_visited_japan",
          },
        ],
      },
      {
        name: "Caller mentions education or qualifications",
        given: "A caller is in conversation",
        when: "They mention schools attended, degrees earned, or certifications",
        then: "Extract education history",
        actions: [
          {
            description: "Extract education and qualifications",
            learnCategory: "FACT" as const,
            learnKeyPrefix: "history_education",
            learnKeyHint: "e.g., history_education_degree, history_education_school",
          },
        ],
      },
      {
        name: "Caller mentions life experiences",
        given: "A caller is in conversation",
        when: "They mention significant past experiences (military service, volunteering, hobbies pursued)",
        then: "Extract life experience information",
        actions: [
          {
            description: "Extract significant life experiences and achievements",
            learnCategory: "FACT" as const,
            learnKeyPrefix: "history_experience",
            learnKeyHint: "e.g., history_experience_military, history_experience_volunteer",
          },
        ],
      },
    ],
  },
];

async function main() {
  console.log("Seeding Memory Extraction analysis specs...\n");

  for (const specData of MEMORY_EXTRACTION_SPECS) {
    // Check if spec already exists
    const existing = await prisma.analysisSpec.findUnique({
      where: { slug: specData.slug },
    });

    if (existing) {
      // Delete and recreate
      await prisma.analysisSpec.delete({
        where: { slug: specData.slug },
      });
      console.log(`  ↻ Replacing existing spec: ${specData.slug}`);
    }

    // Create spec with triggers and actions
    const spec = await prisma.analysisSpec.create({
      data: {
        slug: specData.slug,
        name: specData.name,
        description: specData.description,
        domain: specData.domain,
        outputType: specData.outputType,
        priority: specData.priority,
        isActive: true,
        version: "1.0",
        triggers: {
          create: specData.triggers.map((t, tIdx) => ({
            name: t.name,
            given: t.given,
            when: t.when,
            then: t.then,
            sortOrder: tIdx,
            actions: {
              create: t.actions.map((a, aIdx) => ({
                description: a.description,
                learnCategory: a.learnCategory,
                learnKeyPrefix: a.learnKeyPrefix,
                learnKeyHint: a.learnKeyHint,
                sortOrder: aIdx,
              })),
            },
          })),
        },
      },
      include: {
        triggers: {
          include: { actions: true },
        },
      },
    });

    const actionCount = spec.triggers.reduce((sum, t) => sum + t.actions.length, 0);
    console.log(`  ✓ Created ${spec.name}: ${spec.triggers.length} triggers, ${actionCount} actions`);
  }

  // Summary
  const measureCount = await prisma.analysisSpec.count({
    where: { outputType: "MEASURE" },
  });
  const learnCount = await prisma.analysisSpec.count({
    where: { outputType: "LEARN" },
  });

  console.log("\n=== Summary ===");
  console.log(`MEASURE specs: ${measureCount}`);
  console.log(`LEARN specs: ${learnCount}`);
  console.log(`Total specs: ${measureCount + learnCount}`);
  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
