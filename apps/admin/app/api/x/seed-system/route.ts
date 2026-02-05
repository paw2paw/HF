import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { seedFromSpecs } from "../../../../prisma/seed-from-specs";
import * as fs from "fs";
import * as path from "path";

interface GoalConfig {
  type: "LEARN" | "ACHIEVE" | "CHANGE" | "CONNECT" | "SUPPORT" | "CREATE";
  name: string;
  description: string;
  contentSpecSlug?: string; // For LEARN goals
  isDefault?: boolean;
  priority?: number;
}

interface PlaybookConfig {
  id: string;
  name: string;
  description: string;
  domain: {
    slug: string;
    name: string;
    description: string;
  };
  status: "DRAFT" | "PUBLISHED";
  version: string;
  identitySpecs?: string[]; // Spec IDs for identity
  contentSpecs?: string[]; // Spec IDs for content
  goals?: GoalConfig[]; // Goals for this playbook
  includeSpecs: {
    required: string[]; // Required spec IDs
    optional: string[]; // Optional spec IDs
    systemDomains: string[]; // System domains to auto-include (e.g., "engagement", "memory")
  };
  behaviorTargets: Record<string, number>; // parameterId -> targetValue
}

interface PlaybooksManifest {
  version: string;
  playbooks: PlaybookConfig[];
}

/**
 * POST /api/x/seed-system
 *
 * Metadata-driven system initialization:
 * 1. Syncs all BDD specs from /bdd-specs directory
 * 2. Reads playbooks-config.json for domain/playbook definitions
 * 3. Creates domains and playbooks based on config
 * 4. Auto-links specs based on metadata
 */
export async function POST() {
  try {
    const results = {
      domainsCreated: [] as string[],
      playbooksCreated: [] as string[],
      specsCreated: 0,
      specsSynced: 0,
      parametersCreated: 0,
      errors: [] as string[],
    };

    // ============================================
    // STEP 1: SYNC BDD SPECS
    // ============================================
    try {
      console.log("STEP 1/3: Syncing BDD specs from /bdd-specs directory...");
      const specResults = await seedFromSpecs();
      results.specsSynced = specResults.length;
      const totalParams = specResults.reduce(
        (acc, r) => acc + r.parametersCreated + r.parametersUpdated,
        0
      );
      console.log(`   ✓ Synced ${specResults.length} specs (${totalParams} parameters)`);
    } catch (e: any) {
      console.error("Error syncing BDD specs:", e);
      results.errors.push(`BDD SPECS: ${e.message}`);
    }

    // ============================================
    // STEP 2: ENSURE BEHAVIOR PARAMETERS
    // ============================================
    try {
      console.log("STEP 2/3: Ensuring behavior parameters exist...");
      const createdCount = await ensureBehaviorParameters(prisma);
      results.parametersCreated += createdCount;
      console.log(`   ✓ Ensured ${createdCount} behavior parameters`);
    } catch (e: any) {
      console.error("Error creating behavior parameters:", e);
      results.errors.push(`BEHAVIOR PARAMS: ${e.message}`);
    }

    // ============================================
    // STEP 3: CREATE DOMAINS FROM CONFIG
    // ============================================
    try {
      console.log("STEP 3/3: Creating domains and playbooks from config...");

      // Load playbooks config
      const configPath = path.join(process.cwd(), "bdd-specs", "playbooks-config.json");
      if (!fs.existsSync(configPath)) {
        throw new Error(`Playbooks config not found at ${configPath}`);
      }

      const configContent = fs.readFileSync(configPath, "utf-8");
      const manifest: PlaybooksManifest = JSON.parse(configContent);

      console.log(`   Found ${manifest.playbooks.length} playbooks in config`);

      // Create each playbook from config
      for (const config of manifest.playbooks) {
        try {
          await createPlaybookFromConfig(prisma, config, results);
          results.domainsCreated.push(config.domain.slug);
          results.playbooksCreated.push(config.name);
        } catch (e: any) {
          console.error(`Error creating playbook ${config.id}:`, e);
          results.errors.push(`${config.id}: ${e.message}`);
        }
      }
    } catch (e: any) {
      console.error("Error creating playbooks from config:", e);
      results.errors.push(`PLAYBOOKS CONFIG: ${e.message}`);
    }

    const message =
      results.errors.length === 0
        ? `System initialized: ${results.specsSynced} specs synced, ${results.domainsCreated.length} domains created with ${results.playbooksCreated.length} playbooks, ${results.specsCreated} linked specs, ${results.parametersCreated} parameters`
        : `System initialization completed with ${results.errors.length} errors: ${results.specsSynced} specs synced, ${results.domainsCreated.length} domains created`;

    return NextResponse.json({
      ok: results.errors.length === 0,
      message,
      details: results,
    });
  } catch (error: any) {
    console.error("POST /api/x/seed-system error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to initialize system",
      },
      { status: 500 }
    );
  }
}

/**
 * Creates a domain and playbook from config
 * Metadata-driven: reads spec IDs and domains from config instead of hardcoding
 */
async function createPlaybookFromConfig(
  prisma: PrismaClient,
  config: PlaybookConfig,
  results: { specsCreated: number; parametersCreated: number }
) {
  console.log(`   Creating ${config.domain.slug} domain...`);

  // Delete existing domain if it exists
  const existingDomain = await prisma.domain.findUnique({
    where: { slug: config.domain.slug },
  });

  if (existingDomain) {
    const playbooks = await prisma.playbook.findMany({
      where: { domainId: existingDomain.id },
    });
    for (const pb of playbooks) {
      await prisma.behaviorTarget.deleteMany({ where: { playbookId: pb.id } });
      await prisma.playbookItem.deleteMany({ where: { playbookId: pb.id } });
      await prisma.playbook.delete({ where: { id: pb.id } });
    }
    await prisma.domain.delete({ where: { id: existingDomain.id } });
    console.log(`   🗑️  Deleted existing ${config.domain.slug} domain`);
  }

  // Create domain
  const domain = await prisma.domain.create({
    data: {
      slug: config.domain.slug,
      name: config.domain.name,
      description: config.domain.description,
      isDefault: false,
      isActive: true,
    },
  });
  console.log(`   ✓ Created domain: ${domain.name}`);

  // Create playbook with goals in config
  const playbook = await prisma.playbook.create({
    data: {
      name: config.name,
      description: config.description,
      domainId: domain.id,
      status: config.status,
      version: config.version,
      config: {
        goals: config.goals || [], // Store goals from config
      },
    },
  });
  console.log(`   ✓ Created playbook: ${playbook.name}`);

  // Set behavior targets
  let targetCount = 0;
  for (const [parameterId, targetValue] of Object.entries(config.behaviorTargets)) {
    const param = await prisma.parameter.findUnique({
      where: { parameterId },
    });

    if (param) {
      await prisma.behaviorTarget.create({
        data: {
          parameterId,
          playbookId: playbook.id,
          scope: "PLAYBOOK",
          targetValue,
          confidence: 1.0,
          source: "SEED",
        },
      });
      targetCount++;
    }
  }
  console.log(`   ✓ Created ${targetCount} behavior targets`);

  // Link specs to playbook
  const specsToLink = await findSpecsForPlaybook(prisma, config);

  for (const spec of specsToLink) {
    await prisma.playbookItem.create({
      data: {
        playbookId: playbook.id,
        itemType: "SPEC",
        specId: spec.id,
        isEnabled: true,
        sortOrder: 0,
      },
    });
  }
  console.log(`   ✓ Linked ${specsToLink.length} specs to playbook`);

  results.specsCreated += specsToLink.length;
}

/**
 * Finds all specs that should be linked to a playbook based on config
 * Uses spec IDs and system domains from config
 */
async function findSpecsForPlaybook(
  prisma: PrismaClient,
  config: PlaybookConfig
) {
  const specIds = new Set<string>();

  // Collect all spec IDs from config
  const configSpecIds = [
    ...(config.identitySpecs || []),
    ...(config.contentSpecs || []),
    ...config.includeSpecs.required,
    ...config.includeSpecs.optional,
  ];

  // Find specs by their feature ID (from BDD spec files)
  for (const featureId of configSpecIds) {
    const spec = await prisma.analysisSpec.findFirst({
      where: {
        slug: {
          contains: featureId.toLowerCase().replace(/_/g, "-"),
        },
        isActive: true,
      },
      select: { id: true },
    });

    if (spec) {
      specIds.add(spec.id);
    }
  }

  // Auto-include system domain specs
  const systemSpecs = await prisma.analysisSpec.findMany({
    where: {
      domain: { in: config.includeSpecs.systemDomains },
      isActive: true,
      // Exclude domain-specific specs from other playbooks
      slug: { not: { contains: "companion" } },
    },
    select: { id: true },
  });

  for (const spec of systemSpecs) {
    specIds.add(spec.id);
  }

  // Fetch full spec objects
  return await prisma.analysisSpec.findMany({
    where: { id: { in: Array.from(specIds) } },
  });
}

/**
 * Ensures essential behavior parameters exist
 */
async function ensureBehaviorParameters(prisma: PrismaClient): Promise<number> {
  const essentialBehaviorParams = [
    {
      parameterId: "BEH-WARMTH",
      name: "Warmth Level",
      definition: "Overall warmth and friendliness in agent tone",
      sectionId: "behavior",
      domainGroup: "empathy",
      interpretationHigh: "Agent is warm, friendly, and approachable",
      interpretationLow: "Agent is neutral or distant in tone",
    },
    {
      parameterId: "BEH-EMPATHY-RATE",
      name: "Empathy Expression Rate",
      definition: "Frequency of empathetic statements, acknowledgments, and emotional validation",
      sectionId: "behavior",
      domainGroup: "empathy",
      interpretationHigh: "Agent frequently expresses empathy and validates emotions",
      interpretationLow: "Agent maintains neutral, task-focused communication",
    },
    {
      parameterId: "BEH-FORMALITY",
      name: "Formality Level",
      definition: "Degree of formal vs casual language in agent responses",
      sectionId: "behavior",
      domainGroup: "communication",
      interpretationHigh: "Agent uses formal, professional language",
      interpretationLow: "Agent uses casual, conversational language",
    },
    {
      parameterId: "BEH-DIRECTNESS",
      name: "Directness Level",
      definition: "How direct vs indirect the agent is in communication",
      sectionId: "behavior",
      domainGroup: "communication",
      interpretationHigh: "Agent is direct and to-the-point",
      interpretationLow: "Agent is indirect and nuanced",
    },
    {
      parameterId: "BEH-PROACTIVE",
      name: "Proactivity Level",
      definition: "How proactively the agent offers information, suggestions, or guidance",
      sectionId: "behavior",
      domainGroup: "engagement",
      interpretationHigh: "Agent proactively offers help and suggestions",
      interpretationLow: "Agent waits for caller to ask or lead",
    },
    {
      parameterId: "BEH-QUESTION-RATE",
      name: "Question Asking Rate",
      definition: "Frequency of questions asked by the agent to engage the caller",
      sectionId: "behavior",
      domainGroup: "engagement",
      interpretationHigh: "Agent asks many questions to engage caller",
      interpretationLow: "Agent primarily provides information without questions",
    },
    {
      parameterId: "BEH-PACE-MATCH",
      name: "Pace Matching",
      definition: "How well the agent matches the caller's conversational pace and energy",
      sectionId: "behavior",
      domainGroup: "adaptation",
      interpretationHigh: "Agent closely matches caller's pace and energy",
      interpretationLow: "Agent maintains own pace regardless of caller",
    },
  ];

  let createdCount = 0;

  for (const param of essentialBehaviorParams) {
    const existing = await prisma.parameter.findUnique({
      where: { parameterId: param.parameterId },
    });

    if (existing) {
      // Update existing parameter to ensure correct type and adjustable flag
      await prisma.parameter.update({
        where: { parameterId: param.parameterId },
        data: {
          parameterType: "BEHAVIOR",
          isAdjustable: true,
          // Also update other fields to ensure consistency
          name: param.name,
          definition: param.definition,
          sectionId: param.sectionId,
          domainGroup: param.domainGroup,
          interpretationHigh: param.interpretationHigh,
          interpretationLow: param.interpretationLow,
          scaleType: "0-1",
          directionality: "neutral",
          computedBy: "measure_agent",
        },
      });
    } else {
      // Create new parameter
      await prisma.parameter.create({
        data: {
          parameterId: param.parameterId,
          name: param.name,
          definition: param.definition,
          sectionId: param.sectionId,
          domainGroup: param.domainGroup,
          interpretationHigh: param.interpretationHigh,
          interpretationLow: param.interpretationLow,
          scaleType: "0-1",
          directionality: "neutral",
          computedBy: "measure_agent",
          parameterType: "BEHAVIOR",
          isAdjustable: true,
        },
      });
      createdCount++;
    }
  }

  return createdCount;
}
