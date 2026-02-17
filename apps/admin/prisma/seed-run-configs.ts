import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

export async function main(externalPrisma?: PrismaClient) {
  prisma = externalPrisma || new PrismaClient();
  console.log("Creating test run configs...\n");

  // Get all compiled specs
  const specs = await prisma.analysisSpec.findMany({
    where: { isActive: true, compiledAt: { not: null }, isDirty: false },
    select: { id: true, slug: true, name: true, outputType: true, domain: true },
  });

  const measureSpecs = specs.filter((s) => s.outputType === "MEASURE");
  const learnSpecs = specs.filter((s) => s.outputType === "LEARN");
  const personalitySpecs = specs.filter((s) => s.domain === "personality");
  const memorySpecs = specs.filter((s) => s.domain === "memory");
  const engagementSpecs = specs.filter((s) => s.domain === "engagement");

  console.log(`Found ${measureSpecs.length} MEASURE specs, ${learnSpecs.length} LEARN specs\n`);

  // Config definitions
  const configs = [
    {
      name: "Full Analysis Suite",
      description: "Complete analysis with all personality measures and memory learning",
      specIds: specs.map((s) => s.id),
    },
    {
      name: "Personality Only",
      description: "Big Five personality traits measurement without memory learning",
      specIds: personalitySpecs.map((s) => s.id),
    },
    {
      name: "Memory Learning Only",
      description: "Extract and learn user facts, preferences, and context without scoring",
      specIds: memorySpecs.map((s) => s.id),
    },
    {
      name: "Quick Personality Check",
      description: "Fast personality assessment - Extraversion and Agreeableness only",
      specIds: personalitySpecs.filter((s) =>
        s.slug === "personality-extraversion" || s.slug === "personality-agreeableness"
      ).map((s) => s.id),
    },
    {
      name: "Core Personality + Facts",
      description: "Big Five traits plus personal facts extraction",
      specIds: [
        ...personalitySpecs.map((s) => s.id),
        ...memorySpecs.filter((s) => s.slug === "memory-personal-facts").map((s) => s.id),
      ],
    },
    {
      name: "Engagement & Context",
      description: "Session engagement tracking and contextual memory",
      specIds: [
        ...engagementSpecs.map((s) => s.id),
        ...memorySpecs.filter((s) =>
          s.slug === "memory-events" || s.slug === "memory-contextual-retrieval"
        ).map((s) => s.id),
      ],
    },
    {
      name: "Relationship Builder",
      description: "Focus on learning relationships, preferences, and building rapport",
      specIds: memorySpecs.filter((s) =>
        s.slug.includes("relationship") ||
        s.slug.includes("preference") ||
        s.slug === "memory-strengthens-connection"
      ).map((s) => s.id),
    },
    {
      name: "Lightweight Quick Scan",
      description: "Minimal analysis - just conscientiousness and basic facts",
      specIds: [
        ...personalitySpecs.filter((s) => s.slug === "personality-conscientiousness").map((s) => s.id),
        ...memorySpecs.filter((s) => s.slug === "memory-personal-facts").map((s) => s.id),
      ],
    },
  ];

  // Create run configs
  for (const config of configs) {
    if (config.specIds.length === 0) {
      console.log(`Skipping "${config.name}" - no matching specs`);
      continue;
    }

    // Check if exists
    const existing = await prisma.compiledAnalysisSet.findFirst({
      where: { name: config.name },
    });

    if (existing) {
      console.log(`Skipping "${config.name}" - already exists`);
      continue;
    }

    // Count specs by type
    const configMeasureCount = config.specIds.filter((id) =>
      measureSpecs.some((s) => s.id === id)
    ).length;
    const configLearnCount = config.specIds.filter((id) =>
      learnSpecs.some((s) => s.id === id)
    ).length;

    // Create auto-generated profile
    const profile = await prisma.analysisProfile.create({
      data: {
        name: `${config.name} Profile`,
        description: config.description,
      },
    });

    // Create compiled set in READY status
    const compiledSet = await prisma.compiledAnalysisSet.create({
      data: {
        name: config.name,
        description: config.description,
        analysisProfileId: profile.id,
        specIds: config.specIds,
        status: "READY",
        compiledAt: new Date(),
        validationPassed: true,
        measureSpecCount: configMeasureCount,
        learnSpecCount: configLearnCount,
        parameterCount: configMeasureCount, // Approximate
      },
    });

    console.log(
      `Created: "${config.name}" (${configMeasureCount}M / ${configLearnCount}L)`
    );
  }

  console.log("\nDone!");
}

if (require.main === module) {
  main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
