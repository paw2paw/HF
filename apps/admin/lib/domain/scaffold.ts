/**
 * Domain Scaffold
 *
 * Auto-creates the minimum viable setup for a domain:
 * - Identity spec (IDENTITY / COMPOSE)
 * - Playbook with identity spec + system specs enabled
 * - Publishes the playbook
 * - Configures onboarding (identity spec + default flow phases)
 *
 * Idempotent: safe to run multiple times on the same domain.
 */

import { prisma } from "@/lib/prisma";

// ── Types ──────────────────────────────────────────────

export interface ScaffoldOptions {
  /** AI-generated identity config to populate the identity spec. If omitted, spec is created with generic defaults. */
  identityConfig?: Record<string, any>;
  /** Persona-specific onboarding flow phases (from INIT-001). If omitted, uses DEFAULT_FLOW_PHASES. */
  flowPhases?: any;
}

export interface ScaffoldResult {
  identitySpec: { id: string; slug: string; name: string } | null;
  playbook: { id: string; name: string } | null;
  published: boolean;
  onboardingConfigured: boolean;
  skipped: string[];
}

// ── Default onboarding flow phases ─────────────────────

const DEFAULT_FLOW_PHASES = {
  phases: [
    {
      phase: "welcome",
      duration: "2-3 minutes",
      goals: [
        "Greet the caller warmly",
        "Introduce yourself and your role",
        "Set expectations for the session",
      ],
    },
    {
      phase: "discovery",
      duration: "3-5 minutes",
      goals: [
        "Learn about the caller's background",
        "Understand their goals and motivations",
        "Assess existing knowledge level",
      ],
    },
    {
      phase: "first-topic",
      duration: "5-8 minutes",
      goals: [
        "Introduce the first core concept",
        "Check understanding with open questions",
        "Adapt pace to caller's responses",
      ],
    },
    {
      phase: "wrap-up",
      duration: "2-3 minutes",
      goals: [
        "Summarise what was covered",
        "Preview what comes next",
        "End on an encouraging note",
      ],
    },
  ],
};

// ── Main scaffold function ─────────────────────────────

export async function scaffoldDomain(domainId: string, options?: ScaffoldOptions): Promise<ScaffoldResult> {
  const skipped: string[] = [];

  // 1. Load domain
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    select: { id: true, slug: true, name: true, description: true },
  });

  if (!domain) {
    throw new Error(`Domain not found: ${domainId}`);
  }

  // 2. Check for existing published playbook — already scaffolded
  const existingPublished = await prisma.playbook.findFirst({
    where: { domainId, status: "PUBLISHED" },
    select: { id: true, name: true },
  });

  if (existingPublished) {
    return {
      identitySpec: null,
      playbook: { id: existingPublished.id, name: existingPublished.name },
      published: false,
      onboardingConfigured: false,
      skipped: ["Published playbook already exists — skipping scaffold"],
    };
  }

  // 3. Find or create Identity spec
  const identitySlug = `${domain.slug}-identity`;
  let identitySpec = await prisma.analysisSpec.findFirst({
    where: { slug: identitySlug },
    select: { id: true, slug: true, name: true },
  });

  if (!identitySpec) {
    identitySpec = await prisma.analysisSpec.create({
      data: {
        slug: identitySlug,
        name: `${domain.name} Identity`,
        description: options?.identityConfig
          ? `AI-generated identity for the ${domain.name} domain, tailored from source material analysis.`
          : `Identity and teaching personality for the ${domain.name} agent. Edit this spec to customise how the AI presents itself.`,
        outputType: "COMPOSE",
        specRole: "IDENTITY",
        specType: "DOMAIN",
        domain: "identity",
        scope: "DOMAIN",
        isActive: true,
        isDirty: false,
        isDeletable: true,
        config: options?.identityConfig
          ? JSON.parse(JSON.stringify(options.identityConfig))
          : undefined,
        triggers: {
          create: [
            {
              given: `A ${domain.name} teaching session`,
              when: "The system needs to establish agent identity and tone",
              then: "A consistent, domain-appropriate teaching personality is presented to the caller",
              name: "Identity establishment",
              sortOrder: 0,
            },
          ],
        },
      },
      select: { id: true, slug: true, name: true },
    });
  } else {
    skipped.push("Identity spec already exists");
  }

  // 4. Find or create Playbook
  let playbook = await prisma.playbook.findFirst({
    where: { domainId, status: "DRAFT" },
    select: { id: true, name: true },
  });

  if (!playbook) {
    playbook = await prisma.playbook.create({
      data: {
        name: `${domain.name} Playbook`,
        domainId,
        status: "DRAFT",
        version: "1.0",
      },
      select: { id: true, name: true },
    });
  } else {
    skipped.push("Reusing existing DRAFT playbook");
  }

  // 5. Add Identity spec to playbook (if not already linked)
  const existingItem = await prisma.playbookItem.findFirst({
    where: { playbookId: playbook.id, specId: identitySpec.id },
  });

  if (!existingItem) {
    await prisma.playbookItem.create({
      data: {
        playbookId: playbook.id,
        itemType: "SPEC",
        specId: identitySpec.id,
        sortOrder: 0,
        isEnabled: true,
      },
    });
  }

  // 6. Enable system specs via config.systemSpecToggles
  const systemSpecs = await prisma.analysisSpec.findMany({
    where: { specType: "SYSTEM", isActive: true },
    select: { id: true },
  });

  const toggles: Record<string, { isEnabled: boolean }> = {};
  for (const ss of systemSpecs) {
    toggles[ss.id] = { isEnabled: true };
  }

  // Merge with any existing config
  const currentPlaybook = await prisma.playbook.findUnique({
    where: { id: playbook.id },
    select: { config: true },
  });
  const currentConfig = (currentPlaybook?.config as Record<string, any>) || {};

  await prisma.playbook.update({
    where: { id: playbook.id },
    data: {
      config: {
        ...currentConfig,
        systemSpecToggles: {
          ...(currentConfig.systemSpecToggles || {}),
          ...toggles,
        },
      },
    },
  });

  // 7. Publish playbook (archive any other published, set status)
  await prisma.playbook.updateMany({
    where: {
      domainId,
      status: "PUBLISHED",
      id: { not: playbook.id },
    },
    data: { status: "ARCHIVED" },
  });

  await prisma.playbook.update({
    where: { id: playbook.id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      validationPassed: true,
      measureSpecCount: 0,
      learnSpecCount: 0,
      adaptSpecCount: 0,
      parameterCount: 0,
    },
  });

  // 8. Configure onboarding
  await prisma.domain.update({
    where: { id: domainId },
    data: {
      onboardingIdentitySpecId: identitySpec.id,
      onboardingFlowPhases: options?.flowPhases || DEFAULT_FLOW_PHASES,
    },
  });

  return {
    identitySpec: { id: identitySpec.id, slug: identitySpec.slug, name: identitySpec.name },
    playbook: { id: playbook.id, name: playbook.name },
    published: true,
    onboardingConfigured: true,
    skipped,
  };
}
