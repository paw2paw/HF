/**
 * Course Setup Executor
 *
 * Spec-driven orchestrator for the Course Setup Wizard. Similar pattern to quick-launch.ts,
 * but adapted for interactive course creation (file upload already done, less AI generation).
 *
 * Loaded from COURSE-SETUP-001 ORCHESTRATE spec.
 */

import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { scaffoldDomain } from "@/lib/domain/scaffold";
import { generateContentSpec } from "@/lib/domain/generate-content-spec";
import { generateCurriculumFromGoals } from "@/lib/content-trust/extract-curriculum";
import { loadPersonaFlowPhases } from "@/lib/domain/quick-launch";
import { enrollCaller, enrollCallerInDomainPlaybooks } from "@/lib/enrollment";
import { updateTaskProgress, completeTask } from "@/lib/ai/task-guidance";
import type { SpecConfig } from "@/lib/types/json-fields";

// ── Types ──────────────────────────────────────────────

export interface CourseSetupInput {
  courseName: string;
  learningOutcomes: string[];
  teachingStyle: string; // "tutor" | "coach" | "mentor" | "socratic"
  sessionCount: number;
  durationMins: number;
  emphasis: string; // "breadth" | "balanced" | "depth"
  welcomeMessage: string;
  studentEmails: string[];
  domainId?: string; // if attaching to existing institution
  sourceId?: string; // if content step created a ContentSource already
}

export interface CourseSetupResult {
  domainId: string;
  domainName: string;
  domainSlug: string;
  playbookId: string;
  playbookName: string;
  contentSpecId?: string;
  curriculumId?: string;
  invitationCount: number;
  warnings: string[];
}

interface CourseSetupContext {
  input: CourseSetupInput;
  userId: string;
  results: Partial<CourseSetupResult> & { [key: string]: any };
  onProgress: ProgressCallback;
}

interface CourseSetupStep {
  id: string;
  name: string;
  operation: string;
  order: number;
  onError: "abort" | "continue";
  progressMessage: string;
  args?: Record<string, any>;
}

export interface ProgressEvent {
  phase: string;
  message: string;
  stepIndex?: number;
  totalSteps?: number;
  detail?: Record<string, any>;
  data?: Record<string, any>;
}

export type ProgressCallback = (event: ProgressEvent) => void;

// ── Spec Loader ────────────────────────────────────────

/**
 * Load course setup steps from COURSE-SETUP-001 spec.
 */
async function loadCourseSetupSteps(): Promise<CourseSetupStep[]> {
  const spec = await prisma.analysisSpec.findFirst({
    where: {
      slug: { contains: "course-setup-001", mode: "insensitive" },
      isActive: true,
    },
    select: { slug: true, config: true },
  });

  if (!spec) {
    throw new Error(
      'COURSE-SETUP-001 spec not found. Run "Import All" on /x/admin/spec-sync to import it.'
    );
  }

  const specConfig = spec.config as Record<string, any>;
  const params = specConfig?.parameters || [];
  const stepsParam = params.find((p: any) => p.id === "wizard_steps");
  const steps = stepsParam?.config?.steps;

  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error(
      `COURSE-SETUP-001 spec has no steps configured. Check config.parameters[id=wizard_steps].config.steps array.`
    );
  }

  // Convert wizard steps to executor steps (add operation, onError, progressMessage)
  return (steps as any[])
    .map((step: any) => ({
      id: step.id,
      name: step.label,
      operation: mapStepToOperation(step.id),
      order: step.order,
      onError: "continue", // course setup is forgiving
      progressMessage: step.activeLabel,
      args: step.args,
    }))
    .sort((a, b) => a.order - b.order);
}

function mapStepToOperation(stepId: string): string {
  const mapping: Record<string, string> = {
    intent: "noop", // intent step is UI-only, no server work
    content: "noop", // content upload happens in step itself
    "teaching-points": "noop", // extraction polling happens in UI
    "lesson-structure": "noop", // UI-only configuration
    students: "noop", // UI-only email collection
    "course-config": "noop", // UI-only welcome message
    done: "create_course", // final step runs the full course setup
  };
  return mapping[stepId] || "noop";
}

// ── Step Executor Registry ─────────────────────────────

const stepExecutors: Record<string, (ctx: CourseSetupContext, step: CourseSetupStep) => Promise<void>> = {
  noop: async (ctx) => {
    // No-op for UI-only steps
  },

  create_course: async (ctx) => {
    // 1. Create or find Domain
    const domainSlug = (ctx.input.courseName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let domain;
    if (ctx.input.domainId) {
      // Use existing domain
      domain = await prisma.domain.findUnique({
        where: { id: ctx.input.domainId },
      });
      if (!domain) {
        throw new Error(`Domain not found: ${ctx.input.domainId}`);
      }
    } else {
      // Find or create domain
      domain = await prisma.domain.findFirst({ where: { slug: domainSlug } });
      if (!domain) {
        domain = await prisma.domain.create({
          data: {
            slug: domainSlug,
            name: ctx.input.courseName,
            description: `Course: ${ctx.input.courseName}`,
            isActive: true,
          },
        });
      }
    }

    ctx.results.domainId = domain.id;
    ctx.results.domainSlug = domain.slug;
    ctx.results.domainName = domain.name;

    // 2. Create or find Subject
    const subjectSlug = domainSlug;
    let subject = await prisma.subject.findFirst({ where: { slug: subjectSlug } });
    if (!subject) {
      subject = await prisma.subject.create({
        data: {
          slug: subjectSlug,
          name: ctx.input.courseName,
          isActive: true,
        },
      });
    }
    ctx.results.subjectId = subject.id;

    // 3. Link Subject to Domain
    const existing = await prisma.subjectDomain.findFirst({
      where: { subjectId: subject.id, domainId: domain.id },
    });
    if (!existing) {
      await prisma.subjectDomain.create({
        data: { subjectId: subject.id, domainId: domain.id },
      });
    }

    // 4. Scaffold domain (identity spec + playbook)
    const flowPhases = await loadPersonaFlowPhases(ctx.input.teachingStyle);
    const scaffoldResult = await scaffoldDomain(domain.id, {
      flowPhases: flowPhases || undefined,
      forceNewPlaybook: !!ctx.input.domainId,
      playbookName: ctx.input.courseName,
    });

    if (scaffoldResult.playbook) {
      ctx.results.playbookId = scaffoldResult.playbook.id;
      ctx.results.playbookName = scaffoldResult.playbook.name;
    }

    ctx.results.warnings = [...(ctx.results.warnings || []), ...scaffoldResult.skipped];
  },

  generate_curriculum: async (ctx) => {
    const domainId = ctx.results.domainId!;

    // Try assertion-based generation first (if sourceId provided)
    if (ctx.input.sourceId) {
      const result = await generateContentSpec(domainId);
      if (result.contentSpec) {
        ctx.results.contentSpecId = result.contentSpec.id;
        ctx.results.curriculumId = result.contentSpec.id;
        return;
      }
    }

    // Fall back to goals-based generation
    const curriculum = await generateCurriculumFromGoals(
      ctx.input.courseName,
      ctx.input.teachingStyle,
      ctx.input.learningOutcomes,
      null // no qualificationRef
    );

    if (!curriculum.ok || curriculum.modules.length === 0) {
      ctx.results.warnings!.push(curriculum.error || "Curriculum generation produced no modules");
      return;
    }

    // Create CONTENT spec from goals-based curriculum
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { slug: true, name: true },
    });

    const contentSlug = `${domain!.slug}-content`;

    // Check idempotency
    const existing = await prisma.analysisSpec.findFirst({
      where: { slug: contentSlug },
      select: { id: true },
    });

    if (existing) {
      ctx.results.contentSpecId = existing.id;
      ctx.results.curriculumId = existing.id;
      return;
    }

    const contentSpec = await prisma.analysisSpec.create({
      data: {
        slug: contentSlug,
        name: `${domain!.name} Curriculum`,
        description: curriculum.description || `AI-generated curriculum for ${domain!.name}`,
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
          sourceCount: 0,
          assertionCount: 0,
          generatedFrom: "goals",
          generatedAt: new Date().toISOString(),
        })),
        triggers: {
          create: [{
            given: `A ${domain!.name} teaching session with curriculum content`,
            when: "The system needs to deliver structured teaching material",
            then: "Content is presented following the curriculum module sequence",
            name: "Curriculum delivery",
            sortOrder: 0,
          }],
        },
      },
      select: { id: true },
    });

    ctx.results.contentSpecId = contentSpec.id;
    ctx.results.curriculumId = contentSpec.id;
  },

  configure_onboarding: async (ctx) => {
    const domainId = ctx.results.domainId!;

    // Load identity spec (created during scaffold)
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: {
        id: true,
        onboardingIdentitySpecId: true,
        playbooks: { where: { status: "PUBLISHED" }, take: 1, select: { id: true } },
      },
    });

    // Update onboarding config
    await prisma.domain.update({
      where: { id: domainId },
      data: {
        onboardingWelcome: ctx.input.welcomeMessage,
        onboardingFlowPhases: await loadPersonaFlowPhases(ctx.input.teachingStyle),
      },
    });
  },

  invite_students: async (ctx) => {
    const domainId = ctx.results.domainId!;

    if (!ctx.input.studentEmails || ctx.input.studentEmails.length === 0) {
      ctx.results.invitationCount = 0;
      return;
    }

    // Create invite records for each email
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { slug: true, name: true },
    });

    let invitationCount = 0;

    for (const email of ctx.input.studentEmails) {
      try {
        // Check if invite already exists
        const existing = await prisma.invite.findFirst({
          where: { email, domainId },
        });

        if (!existing) {
          await prisma.invite.create({
            data: {
              email,
              domainId,
              role: "LEARNER",
              invitedBy: ctx.userId,
              status: "PENDING",
            },
          });
          invitationCount++;
        }
      } catch (err) {
        ctx.results.warnings!.push(`Failed to invite ${email}: ${err}`);
      }
    }

    ctx.results.invitationCount = invitationCount;
  },
};

// ── Main Executor ──────────────────────────────────────

/**
 * Execute Course Setup — spec-driven orchestration.
 */
export async function courseSetup(
  input: CourseSetupInput,
  userId: string,
  taskId: string,
  onProgress: ProgressCallback
): Promise<CourseSetupResult> {
  const steps = await loadCourseSetupSteps();

  const ctx: CourseSetupContext = {
    input,
    userId,
    results: { warnings: [] },
    onProgress,
  };

  onProgress({
    phase: "init",
    message: `Starting Course Setup (${steps.length} steps)...`,
    totalSteps: steps.length,
  });

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const executor = stepExecutors[step.operation];

    if (!executor) {
      const msg = `Unknown step operation: "${step.operation}"`;
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
      console.error(`[course-setup] Step "${step.id}" failed:`, err.message);

      if (step.onError === "abort") {
        onProgress({
          phase: step.id,
          message: `Failed: ${err.message}`,
          stepIndex: i,
          totalSteps: steps.length,
        });
        throw err;
      }

      ctx.results.warnings!.push(`${step.name}: ${err.message}`);
      onProgress({
        phase: step.id,
        message: `${step.name} — skipped (${err.message})`,
        stepIndex: i,
        totalSteps: steps.length,
      });
    }

    // Update task progress after each step
    await updateTaskProgress(taskId, {
      context: {
        step: step.id,
        message: step.progressMessage,
        stepIndex: i,
        totalSteps: steps.length,
      },
    });
  }

  onProgress({
    phase: "ready",
    message: "Course Setup complete!",
    totalSteps: steps.length,
  });

  // Complete the task
  await completeTask(taskId);

  return {
    domainId: ctx.results.domainId!,
    domainName: ctx.results.domainName!,
    domainSlug: ctx.results.domainSlug!,
    playbookId: ctx.results.playbookId!,
    playbookName: ctx.results.playbookName!,
    contentSpecId: ctx.results.contentSpecId,
    curriculumId: ctx.results.curriculumId,
    invitationCount: ctx.results.invitationCount || 0,
    warnings: ctx.results.warnings || [],
  };
}
