/**
 * Quick Launch — Spec-Driven Executor
 *
 * Loads QUICK-LAUNCH-001 ORCHESTRATE spec, iterates its declared steps,
 * and runs each via a step executor registry. Same pattern as PIPELINE-001
 * (stages) and DOMAIN-READY-001 (readiness checks).
 *
 * Adding/removing/reordering steps = edit the spec, zero code changes.
 * Tuning args (maxAssertions, maxSampleSize) = edit the spec, zero code changes.
 */

import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import {
  extractText,
  extractAssertions,
  type ExtractedAssertion,
} from "@/lib/content-trust/extract-assertions";
import { generateIdentityFromAssertions } from "@/lib/domain/generate-identity";
import { scaffoldDomain } from "@/lib/domain/scaffold";
import { generateContentSpec } from "@/lib/domain/generate-content-spec";

// ── Types ──────────────────────────────────────────────

export interface LaunchStep {
  id: string;
  name: string;
  operation: string;
  order: number;
  onError: "abort" | "continue";
  progressMessage: string;
  args?: Record<string, any>;
}

export interface QuickLaunchInput {
  subjectName: string;
  persona: string;
  learningGoals: string[];
  file: File;
  qualificationRef?: string;
}

export interface ProgressEvent {
  phase: string;
  message: string;
  stepIndex?: number;
  totalSteps?: number;
  detail?: Record<string, any>;
}

export type ProgressCallback = (event: ProgressEvent) => void;

export interface QuickLaunchResult {
  domainId: string;
  domainSlug: string;
  domainName: string;
  subjectId: string;
  callerId: string;
  callerName: string;
  identitySpecId?: string;
  contentSpecId?: string;
  playbookId?: string;
  assertionCount: number;
  moduleCount: number;
  goalCount: number;
  warnings: string[];
}

/** Shared context accumulating results across steps */
interface LaunchContext {
  input: QuickLaunchInput;
  results: Partial<QuickLaunchResult> & { [key: string]: any };
  onProgress: ProgressCallback;
}

type StepExecutor = (ctx: LaunchContext, step: LaunchStep) => Promise<void>;

// ── Spec Loader ────────────────────────────────────────

/**
 * Load launch steps from QUICK-LAUNCH-001 spec.
 * NO FALLBACKS — spec MUST exist in database.
 */
export async function loadLaunchSteps(): Promise<LaunchStep[]> {
  const spec = await prisma.analysisSpec.findFirst({
    where: {
      slug: { contains: "quick-launch-001", mode: "insensitive" },
      isActive: true,
    },
    select: { slug: true, config: true },
  });

  if (!spec) {
    throw new Error(
      'QUICK-LAUNCH-001 spec not found. Run "Import All" on /x/admin/spec-sync to import it.'
    );
  }

  const specConfig = spec.config as Record<string, any>;
  const params = specConfig?.parameters || [];
  const stepsParam = params.find((p: any) => p.id === "launch_steps");
  const steps = stepsParam?.config?.steps;

  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error(
      `QUICK-LAUNCH-001 spec "${spec.slug}" has no steps configured. ` +
      "Check config.parameters[id=launch_steps].config.steps array."
    );
  }

  // Sort by order and cast
  return (steps as LaunchStep[]).sort((a, b) => a.order - b.order);
}

// ── Step Executor Registry ─────────────────────────────

const stepExecutors: Record<string, StepExecutor> = {
  /**
   * Step 1: Create Domain + Subject + link them
   */
  create_domain: async (ctx) => {
    const { subjectName, qualificationRef } = ctx.input;

    // Generate slug from subject name
    const slug = subjectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Create or find domain
    let domain = await prisma.domain.findFirst({ where: { slug } });
    if (!domain) {
      domain = await prisma.domain.create({
        data: {
          slug,
          name: subjectName,
          description: `Quick-launched domain for ${subjectName}`,
          isActive: true,
        },
      });
    }

    // Create or find subject
    let subject = await prisma.subject.findFirst({ where: { slug } });
    if (!subject) {
      subject = await prisma.subject.create({
        data: {
          slug,
          name: subjectName,
          qualificationRef: qualificationRef || null,
          isActive: true,
        },
      });
    }

    // Link subject to domain (idempotent)
    const existing = await prisma.subjectDomain.findFirst({
      where: { subjectId: subject.id, domainId: domain.id },
    });
    if (!existing) {
      await prisma.subjectDomain.create({
        data: { subjectId: subject.id, domainId: domain.id },
      });
    }

    ctx.results.domainId = domain.id;
    ctx.results.domainSlug = domain.slug;
    ctx.results.domainName = domain.name;
    ctx.results.subjectId = subject.id;
    ctx.results.subjectSlug = subject.slug;
    ctx.results.warnings = [];
  },

  /**
   * Step 2: Extract teaching points from uploaded file
   */
  extract_content: async (ctx, step) => {
    const { file } = ctx.input;
    const maxAssertions = step.args?.maxAssertions ?? 500;

    // Extract text from document
    const { text, pages, fileType } = await extractText(file);
    if (!text.trim()) {
      throw new Error("Could not extract text from document — file may be empty or corrupted");
    }

    ctx.onProgress({
      phase: step.id,
      message: `Extracted ${text.length.toLocaleString()} characters from ${fileType}${pages ? ` (${pages} pages)` : ""}`,
    });

    // Run AI extraction with progress updates
    const result = await extractAssertions(text, {
      sourceSlug: ctx.results.subjectSlug || "quick-launch",
      qualificationRef: ctx.input.qualificationRef,
      maxAssertions,
      onChunkDone: (chunkIndex, totalChunks, extractedSoFar) => {
        ctx.onProgress({
          phase: step.id,
          message: `Extracting... chunk ${chunkIndex + 1}/${totalChunks} (${extractedSoFar} points so far)`,
        });
      },
    });

    if (!result.ok) {
      throw new Error(result.error || "Assertion extraction failed");
    }

    ctx.results.assertions = result.assertions;
    ctx.results.assertionCount = result.assertions.length;
    ctx.results.warnings!.push(...result.warnings);

    ctx.onProgress({
      phase: step.id,
      message: `Extracted ${result.assertions.length} teaching points`,
    });
  },

  /**
   * Step 3: Save assertions to DB (ContentSource + SubjectSource + assertions)
   */
  save_assertions: async (ctx) => {
    const assertions: ExtractedAssertion[] = ctx.results.assertions || [];
    if (assertions.length === 0) {
      ctx.results.warnings!.push("No assertions to save");
      return;
    }

    const { file } = ctx.input;
    const subjectId = ctx.results.subjectId!;
    const subjectSlug = ctx.results.subjectSlug || "quick-launch";

    // Generate source slug from filename
    const baseSlug = file.name
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const sourceSlug = `${subjectSlug}-${baseSlug}`;
    const displayName = file.name.replace(/\.[^/.]+$/, "");

    // Create ContentSource (handle slug conflict)
    let source;
    try {
      source = await prisma.contentSource.create({
        data: { slug: sourceSlug, name: displayName, trustLevel: "UNVERIFIED" },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        source = await prisma.contentSource.create({
          data: { slug: `${sourceSlug}-${Date.now()}`, name: displayName, trustLevel: "UNVERIFIED" },
        });
      } else {
        throw err;
      }
    }

    // Attach to subject
    const existingLink = await prisma.subjectSource.findFirst({
      where: { subjectId, sourceId: source.id },
    });
    if (!existingLink) {
      await prisma.subjectSource.create({
        data: { subjectId, sourceId: source.id, tags: ["content"] },
      });
    }

    // Save assertions
    if (assertions.length > 0) {
      await prisma.contentAssertion.createMany({
        data: assertions.map((a) => ({
          sourceId: source.id,
          assertion: a.assertion,
          category: a.category,
          chapter: a.chapter || null,
          section: a.section || null,
          tags: a.tags,
          examRelevance: a.examRelevance ?? null,
          learningOutcomeRef: a.learningOutcomeRef || null,
          validUntil: a.validUntil ? new Date(a.validUntil) : null,
          taxYear: a.taxYear || null,
          contentHash: a.contentHash,
        })),
      });
    }

    ctx.results.sourceId = source.id;
  },

  /**
   * Step 4: Generate AI-tailored identity from assertions + persona + goals
   */
  generate_identity: async (ctx, step) => {
    const assertions: ExtractedAssertion[] = ctx.results.assertions || [];
    const maxSampleSize = step.args?.maxSampleSize ?? 60;

    const result = await generateIdentityFromAssertions({
      subjectName: ctx.input.subjectName,
      persona: ctx.input.persona,
      learningGoals: ctx.input.learningGoals,
      assertions: assertions.map((a) => ({
        assertion: a.assertion,
        category: a.category,
        chapter: a.chapter || null,
        tags: a.tags,
      })),
      maxSampleSize,
    });

    if (result.ok && result.config) {
      ctx.results.identityConfig = result.config;
    } else {
      ctx.results.warnings!.push(
        `Identity generation failed (${result.error || "unknown"}), using defaults`
      );
    }
  },

  /**
   * Step 5: Scaffold domain (identity spec, playbook, onboarding)
   */
  scaffold_domain: async (ctx) => {
    const domainId = ctx.results.domainId!;

    // Load persona flow phases from INIT-001 spec
    const flowPhases = await loadPersonaFlowPhases(ctx.input.persona);

    const scaffoldResult = await scaffoldDomain(domainId, {
      identityConfig: ctx.results.identityConfig || undefined,
      flowPhases: flowPhases || undefined,
    });

    if (scaffoldResult.identitySpec) {
      ctx.results.identitySpecId = scaffoldResult.identitySpec.id;
    }
    if (scaffoldResult.playbook) {
      ctx.results.playbookId = scaffoldResult.playbook.id;
    }
    ctx.results.warnings!.push(...scaffoldResult.skipped);
  },

  /**
   * Step 6: Generate structured curriculum from assertions
   * + patch the CONTENT spec for CURRICULUM_PROGRESS_V1 contract compliance
   */
  generate_curriculum: async (ctx) => {
    const domainId = ctx.results.domainId!;

    const result = await generateContentSpec(domainId);

    if (result.error) {
      ctx.results.warnings!.push(`Curriculum: ${result.error}`);
    }

    if (result.contentSpec) {
      ctx.results.contentSpecId = result.contentSpec.id;
      ctx.results.moduleCount = result.moduleCount;

      // Patch spec for contract compliance (compose-content-section.ts needs this)
      await patchContentSpecForContract(result.contentSpec.id);
    } else {
      ctx.results.moduleCount = 0;
      ctx.results.warnings!.push(...result.skipped);
    }
  },

  /**
   * Step 7: Create test caller + Goals
   */
  create_caller: async (ctx) => {
    const domainId = ctx.results.domainId!;
    const { subjectName, learningGoals } = ctx.input;

    // Create test caller
    const caller = await prisma.caller.create({
      data: {
        name: `Test Caller — ${subjectName}`,
        domainId,
      },
    });

    ctx.results.callerId = caller.id;
    ctx.results.callerName = caller.name || "Test Caller";

    // Create Goal records for each learning goal
    if (learningGoals.length > 0 && ctx.results.contentSpecId) {
      for (const goalName of learningGoals) {
        await prisma.goal.create({
          data: {
            callerId: caller.id,
            type: "LEARN",
            name: goalName,
            contentSpecId: ctx.results.contentSpecId,
            priority: 5,
          },
        });
      }
    } else if (learningGoals.length > 0) {
      // No content spec — create goals without link
      for (const goalName of learningGoals) {
        await prisma.goal.create({
          data: {
            callerId: caller.id,
            type: "LEARN",
            name: goalName,
            priority: 5,
          },
        });
      }
    }

    ctx.results.goalCount = learningGoals.length;
  },
};

// ── Helpers ────────────────────────────────────────────

/**
 * Load persona-specific flow phases from INIT-001 spec.
 * Returns null if persona or spec not found (scaffold uses its own defaults).
 */
async function loadPersonaFlowPhases(persona: string): Promise<any | null> {
  const onboardingSlug = config.specs.onboarding.toLowerCase();

  const spec = await prisma.analysisSpec.findFirst({
    where: {
      OR: [
        { slug: { contains: onboardingSlug, mode: "insensitive" } },
        { slug: { contains: "onboarding" } },
        { domain: "onboarding" },
      ],
      isActive: true,
    },
    select: { config: true },
  });

  if (!spec?.config) return null;

  const specConfig = spec.config as any;
  const personaConfig = specConfig.personas?.[persona];
  return personaConfig?.firstCallFlow?.phases ? { phases: personaConfig.firstCallFlow.phases } : null;
}

/**
 * Patch a CONTENT spec to be CURRICULUM_PROGRESS_V1 contract-compliant.
 *
 * generateContentSpec() creates specs with config.modules[] (flat array).
 * compose-content-section.ts and track-progress.ts need:
 *   - config.metadata.curriculum (type, trackingMode, etc.)
 *   - config.parameters[] (contract-driven module extraction format)
 *
 * This patch adds both without touching the existing modules[] (legacy compat).
 */
async function patchContentSpecForContract(specId: string): Promise<void> {
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

// ── Main Executor ──────────────────────────────────────

/**
 * Execute Quick Launch — spec-driven orchestration.
 *
 * Loads steps from QUICK-LAUNCH-001, runs each via the executor registry,
 * respects per-step onError policy (abort vs continue).
 */
export async function quickLaunch(
  input: QuickLaunchInput,
  onProgress: ProgressCallback,
): Promise<QuickLaunchResult> {
  const steps = await loadLaunchSteps();

  const ctx: LaunchContext = {
    input,
    results: { warnings: [] },
    onProgress,
  };

  onProgress({
    phase: "init",
    message: `Starting Quick Launch (${steps.length} steps)...`,
    totalSteps: steps.length,
  });

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const executor = stepExecutors[step.operation];

    if (!executor) {
      const msg = `Unknown step operation: "${step.operation}" — check QUICK-LAUNCH-001 spec`;
      if (step.onError === "abort") throw new Error(msg);
      ctx.results.warnings!.push(msg);
      continue;
    }

    onProgress({
      phase: step.id,
      message: step.progressMessage,
      stepIndex: i,
      totalSteps: steps.length,
    });

    try {
      await executor(ctx, step);

      onProgress({
        phase: step.id,
        message: `${step.name} ✓`,
        stepIndex: i,
        totalSteps: steps.length,
      });
    } catch (err: any) {
      console.error(`[quick-launch] Step "${step.id}" failed:`, err.message);

      if (step.onError === "abort") {
        onProgress({
          phase: step.id,
          message: `Failed: ${err.message}`,
          stepIndex: i,
          totalSteps: steps.length,
        });
        throw err;
      }

      // "continue" — log warning and proceed
      ctx.results.warnings!.push(`${step.name}: ${err.message}`);
      onProgress({
        phase: step.id,
        message: `${step.name} — skipped (${err.message})`,
        stepIndex: i,
        totalSteps: steps.length,
      });
    }
  }

  onProgress({
    phase: "ready",
    message: "Quick Launch complete!",
    totalSteps: steps.length,
    detail: {
      domainId: ctx.results.domainId,
      callerId: ctx.results.callerId,
    },
  });

  return {
    domainId: ctx.results.domainId!,
    domainSlug: ctx.results.domainSlug!,
    domainName: ctx.results.domainName!,
    subjectId: ctx.results.subjectId!,
    callerId: ctx.results.callerId!,
    callerName: ctx.results.callerName!,
    identitySpecId: ctx.results.identitySpecId,
    contentSpecId: ctx.results.contentSpecId,
    playbookId: ctx.results.playbookId,
    assertionCount: ctx.results.assertionCount || 0,
    moduleCount: ctx.results.moduleCount || 0,
    goalCount: ctx.results.goalCount || 0,
    warnings: ctx.results.warnings || [],
  };
}
