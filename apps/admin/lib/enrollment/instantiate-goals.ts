/**
 * Instantiate goals from a domain's published playbook config.
 * Called on caller creation and domain switch.
 */

import { prisma } from "@/lib/prisma";
import { GOAL_TYPE_VALUES, type GoalTypeLiteral, type PlaybookConfig } from "@/lib/types/json-fields";

const LEGACY_GOAL_TYPE_MAP: Record<string, GoalTypeLiteral> = {
  TOPIC_MASTERED: "LEARN",
  CONFIDENCE_GAIN: "CHANGE",
  KNOWLEDGE_GAIN: "LEARN",
  HABIT_CHANGE: "CHANGE",
};

function coerceGoalType(raw: unknown): GoalTypeLiteral {
  if (typeof raw === "string") {
    const upper = raw.toUpperCase();
    if ((GOAL_TYPE_VALUES as readonly string[]).includes(upper)) {
      return upper as GoalTypeLiteral;
    }
    if (LEGACY_GOAL_TYPE_MAP[upper]) {
      console.warn(`[instantiate-goals] Mapping legacy goal type "${upper}" → "${LEGACY_GOAL_TYPE_MAP[upper]}"`);
      return LEGACY_GOAL_TYPE_MAP[upper];
    }
  }
  console.warn(`[instantiate-goals] Unknown goal type ${JSON.stringify(raw)} — defaulting to LEARN`);
  return "LEARN";
}

/**
 * Derive fallback goals from the playbook's linked curriculum modules.
 * Used when the wizard failed to capture explicit learning outcomes — rather
 * than leaving the caller goal-less (no reward signal, adapt loop runs dry),
 * we create one LEARN goal per curriculum module using the module title.
 * Returns [] if no curriculum / no modules are linked.
 */
async function deriveGoalsFromCurriculum(playbookId: string): Promise<Array<{ type: GoalTypeLiteral; name: string; description?: string; priority: number }>> {
  const subjects = await prisma.playbookSubject.findMany({
    where: { playbookId },
    select: { subjectId: true },
  });
  if (subjects.length === 0) return [];

  const modules = await prisma.curriculumModule.findMany({
    where: {
      isActive: true,
      curriculum: { subjectId: { in: subjects.map((s) => s.subjectId) } },
    },
    select: { id: true, slug: true, title: true, description: true, sortOrder: true },
    orderBy: [{ curriculumId: "asc" }, { sortOrder: "asc" }],
  });

  return modules.map((m) => ({
    type: "LEARN" as GoalTypeLiteral,
    name: `Master ${m.title}`,
    description: m.description || undefined,
    priority: 5,
  }));
}

/**
 * Create Goal records for a caller from their domain's published playbook.
 * Reads `playbook.config.goals[]` and creates one Goal per entry.
 * If config.goals is empty, falls back to deriving goals from curriculum
 * modules so the adapt loop always has a reward signal to work against.
 * Safe to call multiple times — skips if goals already exist for the playbook.
 */
export async function instantiatePlaybookGoals(
  callerId: string,
  domainId: string,
): Promise<string[]> {
  const playbook = await prisma.playbook.findFirst({
    where: { domainId, status: "PUBLISHED" },
    select: { id: true, config: true },
  });

  if (!playbook) return [];

  const pbConfig = (playbook.config || {}) as PlaybookConfig;
  let goalConfigs: Array<{
    type: string;
    name: string;
    description?: string | null;
    contentSpecSlug?: string;
    isAssessmentTarget?: boolean;
    assessmentConfig?: unknown;
    priority?: number;
  }> = pbConfig.goals || [];

  // Fallback: if no explicit goals were captured (wizard miss), derive from
  // the curriculum modules so the caller gets some reward signal.
  if (goalConfigs.length === 0) {
    const derived = await deriveGoalsFromCurriculum(playbook.id);
    if (derived.length === 0) {
      console.warn(`[instantiate-goals] No goals in config and no curriculum modules for playbook ${playbook.id} — caller ${callerId} will have 0 goals`);
      return [];
    }
    console.log(`[instantiate-goals] Derived ${derived.length} fallback goal(s) from curriculum modules for playbook ${playbook.id}`);
    goalConfigs = derived;
  }

  // Skip if caller already has goals for this playbook (idempotent)
  const existing = await prisma.goal.count({
    where: { callerId, playbookId: playbook.id, status: { in: ["ACTIVE", "PAUSED"] } },
  });
  if (existing > 0) return [];

  const created: string[] = [];

  for (const goalConfig of goalConfigs) {
    let contentSpecId: string | null = null;
    if (goalConfig.type === "LEARN" && goalConfig.contentSpecSlug) {
      const contentSpec = await prisma.analysisSpec.findFirst({
        where: {
          slug: { contains: goalConfig.contentSpecSlug.toLowerCase().replace(/_/g, "-") },
          isActive: true,
        },
        select: { id: true },
      });
      contentSpecId = contentSpec?.id || null;
    }

    const goal = await prisma.goal.create({
      data: {
        callerId,
        playbookId: playbook.id,
        type: coerceGoalType(goalConfig.type),
        name: goalConfig.name,
        description: goalConfig.description || null,
        contentSpecId,
        isAssessmentTarget: goalConfig.isAssessmentTarget || false,
        assessmentConfig: goalConfig.assessmentConfig || undefined,
        status: "ACTIVE",
        priority: goalConfig.priority || 5,
        startedAt: new Date(),
      },
    });

    created.push(goal.name);
  }

  return created;
}
