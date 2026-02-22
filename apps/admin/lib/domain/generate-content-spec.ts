/**
 * Generate Content Spec from Domain's Content Sources
 *
 * Loads assertions from the domain's subject sources, uses AI to generate
 * a structured curriculum, then creates a CONTENT spec and adds it to
 * the domain's playbook.
 *
 * Reuses extractCurriculumFromAssertions() from content-trust pipeline.
 * Idempotent: skips if content spec already exists.
 */

import { prisma } from "@/lib/prisma";
import { extractCurriculumFromAssertions } from "@/lib/content-trust/extract-curriculum";

// ── Types ──────────────────────────────────────────────

export interface ContentSpecResult {
  contentSpec: { id: string; slug: string; name: string } | null;
  moduleCount: number;
  assertionCount: number;
  addedToPlaybook: boolean;
  skipped: string[];
  error?: string;
}

// ── Main function ──────────────────────────────────────

export async function generateContentSpec(domainId: string): Promise<ContentSpecResult> {
  const skipped: string[] = [];

  // 1. Load domain
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    select: { id: true, slug: true, name: true },
  });

  if (!domain) {
    throw new Error(`Domain not found: ${domainId}`);
  }

  // 2. Check if content spec already exists
  const contentSlug = `${domain.slug}-content`;
  const existing = await prisma.analysisSpec.findFirst({
    where: { slug: contentSlug },
    select: { id: true, slug: true, name: true },
  });

  if (existing) {
    return {
      contentSpec: existing,
      moduleCount: 0,
      assertionCount: 0,
      addedToPlaybook: false,
      skipped: ["Content spec already exists"],
    };
  }

  // 3. Load assertions from domain's subject sources
  const subjectSources = await prisma.subjectSource.findMany({
    where: {
      subject: {
        domains: { some: { domainId } },
      },
    },
    select: {
      sourceId: true,
      tags: true,
      subject: {
        select: {
          name: true,
          qualificationRef: true,
        },
      },
    },
  });

  if (subjectSources.length === 0) {
    return {
      contentSpec: null,
      moduleCount: 0,
      assertionCount: 0,
      addedToPlaybook: false,
      skipped: ["No content sources linked to domain subjects"],
    };
  }

  const sourceIds = subjectSources.map((ss) => ss.sourceId);
  const assertions = await prisma.contentAssertion.findMany({
    where: { sourceId: { in: sourceIds } },
    select: {
      assertion: true,
      category: true,
      chapter: true,
      section: true,
      tags: true,
    },
    orderBy: [{ chapter: "asc" }, { section: "asc" }, { createdAt: "asc" }],
  });

  if (assertions.length === 0) {
    return {
      contentSpec: null,
      moduleCount: 0,
      assertionCount: 0,
      addedToPlaybook: false,
      skipped: ["No assertions extracted from content sources yet"],
    };
  }

  // 4. Get subject metadata for AI context
  const subjectName = subjectSources[0]?.subject?.name || domain.name;
  const qualificationRef = subjectSources[0]?.subject?.qualificationRef || undefined;

  // 5. Call existing AI curriculum extraction
  const curriculum = await extractCurriculumFromAssertions(
    assertions.map((a) => ({
      assertion: a.assertion,
      category: a.category || "fact",
      chapter: a.chapter,
      section: a.section,
      tags: a.tags,
    })),
    subjectName,
    qualificationRef,
  );

  if (!curriculum.ok || curriculum.modules.length === 0) {
    return {
      contentSpec: null,
      moduleCount: 0,
      assertionCount: assertions.length,
      addedToPlaybook: false,
      skipped: [],
      error: curriculum.error || "AI curriculum extraction produced no modules",
    };
  }

  // 6. Create Content spec
  const contentSpec = await prisma.analysisSpec.create({
    data: {
      slug: contentSlug,
      name: `${domain.name} Curriculum`,
      description: curriculum.description || `Structured curriculum for ${domain.name}, auto-generated from ${assertions.length} teaching points across ${subjectSources.length} source(s).`,
      outputType: "COMPOSE",
      specRole: "CONTENT",
      specType: "DOMAIN",
      domain: "content",
      scope: "DOMAIN",
      isActive: true,
      isDirty: false,
      isDeletable: true,
      config: JSON.parse(JSON.stringify({
        modules: curriculum.modules,
        deliveryConfig: curriculum.deliveryConfig,
        sourceCount: subjectSources.length,
        assertionCount: assertions.length,
        generatedAt: new Date().toISOString(),
      })),
      triggers: {
        create: [
          {
            given: `A ${domain.name} teaching session with curriculum content`,
            when: "The system needs to deliver structured teaching material",
            then: "Content is presented following the curriculum module sequence with appropriate learning outcomes",
            name: "Curriculum delivery",
            sortOrder: 0,
          },
        ],
      },
    },
    select: { id: true, slug: true, name: true },
  });

  // 7. Add to published playbook
  let addedToPlaybook = false;
  const playbook = await prisma.playbook.findFirst({
    where: { domainId, status: "PUBLISHED" },
    select: { id: true },
  });

  if (playbook) {
    const existingItem = await prisma.playbookItem.findFirst({
      where: { playbookId: playbook.id, specId: contentSpec.id },
    });

    if (!existingItem) {
      // Find max sort order to append at end
      const maxItem = await prisma.playbookItem.findFirst({
        where: { playbookId: playbook.id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });

      await prisma.playbookItem.create({
        data: {
          playbookId: playbook.id,
          itemType: "SPEC",
          specId: contentSpec.id,
          sortOrder: (maxItem?.sortOrder ?? 0) + 1,
          isEnabled: true,
        },
      });

      // Re-publish to update stats
      await prisma.playbook.update({
        where: { id: playbook.id },
        data: { publishedAt: new Date() },
      });

      addedToPlaybook = true;
    }
  }

  return {
    contentSpec,
    moduleCount: curriculum.modules.length,
    assertionCount: assertions.length,
    addedToPlaybook,
    skipped,
  };
}

// ── Contract Patching ─────────────────────────────────

/**
 * Patch a CONTENT spec to be CURRICULUM_PROGRESS_V1 compliant.
 *
 * AI-generated content specs (from quick-launch or enrichment) have
 * config.modules[] but miss the required metadata.curriculum section
 * and the parameters[] format that the curriculum system expects.
 *
 * This patch adds both without touching the existing modules[] (legacy compat).
 */
export async function patchContentSpecForContract(specId: string): Promise<void> {
  const spec = await prisma.analysisSpec.findUnique({
    where: { id: specId },
    select: { config: true },
  });

  if (!spec?.config) return;

  const cfg = spec.config as Record<string, any>;

  // Skip if already has metadata.curriculum (idempotent)
  if (cfg.metadata?.curriculum) return;

  // Add metadata.curriculum for contract compliance
  cfg.metadata = {
    ...cfg.metadata,
    curriculum: {
      type: "sequential",
      trackingMode: "module-based",
      moduleSelector: "section=content",
      moduleOrder: "sortBySequence",
      progressKey: "current_module",
      masteryThreshold: 0.7,
    },
  };

  // Convert modules to parameters[] format for contract-driven extraction
  if (Array.isArray(cfg.modules) && !cfg.parameters) {
    cfg.parameters = cfg.modules.map((m: any, i: number) => ({
      id: m.id,
      name: m.title || m.name,
      description: m.description || "",
      section: "content",
      sequence: m.sortOrder ?? i,
      config: {
        ...m,
        learningOutcomes: m.learningOutcomes || [],
        assessmentCriteria: m.assessmentCriteria || [],
        keyTerms: m.keyTerms || [],
      },
    }));
  }

  await prisma.analysisSpec.update({
    where: { id: specId },
    data: { config: cfg },
  });
}
