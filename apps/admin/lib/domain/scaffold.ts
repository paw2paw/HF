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
import { config } from "@/lib/config";
import { getFlowPhasesFallback } from "@/lib/fallback-settings";

// ── Types ──────────────────────────────────────────────

export interface ScaffoldOptions {
  /** AI-generated identity config to populate the identity spec. If omitted, spec is created with generic defaults. */
  identityConfig?: Record<string, any>;
  /** Persona-specific onboarding flow phases (from INIT-001). If omitted, uses DEFAULT_FLOW_PHASES. */
  flowPhases?: any;
  /** When true, always create a new playbook even if one already exists (new class in existing school). */
  forceNewPlaybook?: boolean;
  /** Custom playbook name (used when forceNewPlaybook=true). Falls back to "{domain.name} Playbook". */
  playbookName?: string;
}

export interface ScaffoldResult {
  identitySpec: { id: string; slug: string; name: string } | null;
  playbook: { id: string; name: string } | null;
  published: boolean;
  onboardingConfigured: boolean;
  skipped: string[];
}

// ── Default onboarding flow phases ─────────────────────

// Loaded from SystemSettings at runtime (see fallback-settings.ts for hardcoded last-resort)

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
  //    Skip this check when forceNewPlaybook=true (new class in existing school)
  if (!options?.forceNewPlaybook) {
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
  }

  // 3. Find or create Identity spec
  const identitySlug = `${domain.slug}-identity`;
  let identitySpec = await prisma.analysisSpec.findFirst({
    where: { slug: identitySlug },
    select: { id: true, slug: true, name: true },
  });

  if (!identitySpec) {
    // Build overlay config: only domain-specific parameters, not a full standalone spec.
    // At prompt composition time, mergeIdentitySpec() merges this overlay with the base archetype.
    const overlayConfig = options?.identityConfig
      ? JSON.parse(JSON.stringify(options.identityConfig))
      : {
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
        };

    identitySpec = await prisma.analysisSpec.create({
      data: {
        slug: identitySlug,
        name: `${domain.name} Identity`,
        description: `Domain overlay for ${domain.name} — extends the base tutor archetype with domain-specific adaptations.`,
        outputType: "COMPOSE",
        specRole: "IDENTITY",
        specType: "DOMAIN",
        domain: "identity",
        scope: "DOMAIN",
        isActive: true,
        isDirty: false,
        isDeletable: true,
        extendsAgent: config.specs.defaultArchetype,
        config: overlayConfig,
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
  //    When forceNewPlaybook=true, always create a new playbook (new class)
  const pbName = options?.playbookName || `${domain.name} Playbook`;
  let playbook: { id: string; name: string } | null = null;

  if (!options?.forceNewPlaybook) {
    playbook = await prisma.playbook.findFirst({
      where: { domainId, status: "DRAFT" },
      select: { id: true, name: true },
    });
    if (playbook) {
      skipped.push("Reusing existing DRAFT playbook");
    }
  }

  if (!playbook) {
    playbook = await prisma.playbook.create({
      data: {
        name: pbName,
        domainId,
        status: "DRAFT",
        version: "1.0",
      },
      select: { id: true, name: true },
    });
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

  // 7. Publish playbook
  //    When forceNewPlaybook=true, keep existing published playbooks (multiple classes coexist).
  //    Otherwise archive them (original behavior — one published playbook per domain).
  if (!options?.forceNewPlaybook) {
    await prisma.playbook.updateMany({
      where: {
        domainId,
        status: "PUBLISHED",
        id: { not: playbook.id },
      },
      data: { status: "ARCHIVED" },
    });
  }

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
      onboardingFlowPhases: options?.flowPhases || await getFlowPhasesFallback(),
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
