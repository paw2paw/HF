/**
 * Course Reference → ContentAssertion Converter
 *
 * Deterministic conversion from COURSE_REFERENCE skeleton JSON sections
 * into ContentAssertion create-data rows. No AI re-interpretation —
 * each skeleton section maps to exactly one INSTRUCTION_CATEGORY.
 *
 * Used by the finalize endpoint to create assertions directly,
 * bypassing the normal extraction pipeline.
 */

import type { InstructionCategory } from "./resolve-config";

// ── Types ────────────────────────────────────────────────────────────────────

/** Shape matching COURSE_REFERENCE_SKELETON.blankTemplate */
export interface CourseRefData {
  courseOverview?: {
    subject?: string;
    examContext?: string;
    studentAge?: string;
    delivery?: string;
    courseLength?: string;
    prerequisite?: string;
    coreProposition?: string;
    /** EQF level 1-8 (Bologna framework) */
    eqfLevel?: number;
    /** ECTS credit value, e.g. 15 (1 ECTS ≈ 25-30 study hours) */
    ectsCredits?: number;
    /** Free-text qualification level, e.g. "BSc Year 2", "Masters" */
    qualificationLevel?: string;
  };
  learningOutcomes?: {
    skillOutcomes?: Array<{ id: string; description: string }>;
    readinessOutcomes?: Array<{ id: string; description: string }>;
    progressIndicators?: string;
    /** Bologna Dublin Descriptors — 5 categories of learning outcomes */
    dublinDescriptors?: {
      knowledgeAndUnderstanding?: string[];
      applyingKnowledge?: string[];
      makingJudgements?: string[];
      communicationSkills?: string[];
      learningSkills?: string[];
    };
  };
  skillsFramework?: Array<{
    id: string;
    name: string;
    description?: string;
    tiers?: {
      emerging?: string;
      developing?: string;
      secure?: string;
    };
  }>;
  skillDependencies?: string[];
  teachingApproach?: {
    corePrinciples?: string[];
    sessionStructure?: {
      phases?: Array<{
        name: string;
        duration?: string;
        description?: string;
      }>;
    };
    techniquesBySkill?: Array<{
      skillId?: string;
      technique?: string;
    }>;
  };
  coursePhases?: Array<{
    name: string;
    sessions?: string;
    goal?: string;
    tutorBehaviour?: string[];
    skillFocusPerSession?: string[];
    exitCriteria?: string[];
  }>;
  edgeCases?: Array<{
    scenario: string;
    response: string;
  }>;
  communicationRules?: {
    toStudent?: { tone?: string; frequency?: string };
    toParent?: { tone?: string; frequency?: string; contentFormula?: string };
  };
  assessmentBoundaries?: string[];
  metrics?: string[];
  /** Bologna-style module descriptors (optional, academic courses only) */
  moduleDescriptors?: Array<{
    id: string;
    title: string;
    ectsCredits?: number;
    learningOutcomes?: string[];
    assessmentMethod?: string;
    prerequisites?: string[];
  }>;
}

/** Row shape for Prisma ContentAssertion.create (without sourceId) */
export interface AssertionCreateData {
  assertion: string;
  category: InstructionCategory;
  chapter: string;
  section: string | null;
  tags: string[];
  orderIndex: number;
}

// ── Section → Category Mapping ───────────────────────────────────────────────

const SECTION_TO_CATEGORY: Record<string, InstructionCategory> = {
  skillsFramework: "skill_framework",
  skillDependencies: "skill_framework",
  "teachingApproach.corePrinciples": "teaching_rule",
  "teachingApproach.sessionStructure": "session_flow",
  "teachingApproach.techniquesBySkill": "scaffolding_technique",
  coursePhases: "session_flow",
  edgeCases: "edge_case",
  communicationRules: "communication_rule",
  assessmentBoundaries: "assessment_approach",
  metrics: "assessment_approach",
};

// ── Converter ────────────────────────────────────────────────────────────────

export function convertCourseRefToAssertions(data: CourseRefData): AssertionCreateData[] {
  const assertions: AssertionCreateData[] = [];
  let order = 0;

  // Skills Framework
  if (data.skillsFramework?.length) {
    for (const skill of data.skillsFramework) {
      const tierLines: string[] = [];
      if (skill.tiers?.emerging) tierLines.push(`Emerging: ${skill.tiers.emerging}`);
      if (skill.tiers?.developing) tierLines.push(`Developing: ${skill.tiers.developing}`);
      if (skill.tiers?.secure) tierLines.push(`Secure: ${skill.tiers.secure}`);

      const desc = skill.description ? ` — ${skill.description}` : "";
      const tiers = tierLines.length ? `\n${tierLines.join("\n")}` : "";
      assertions.push({
        assertion: `${skill.id}: ${skill.name}${desc}${tiers}`,
        category: "skill_framework",
        chapter: "Skills Framework",
        section: skill.id,
        tags: ["skill", skill.id.toLowerCase(), skill.name.toLowerCase()],
        orderIndex: order++,
      });
    }
  }

  // Skill Dependencies
  if (data.skillDependencies?.length) {
    for (const dep of data.skillDependencies) {
      assertions.push({
        assertion: dep,
        category: "skill_framework",
        chapter: "Skills Framework",
        section: "Dependencies",
        tags: ["skill-dependency"],
        orderIndex: order++,
      });
    }
  }

  // Teaching Approach — Core Principles
  if (data.teachingApproach?.corePrinciples?.length) {
    for (const principle of data.teachingApproach.corePrinciples) {
      assertions.push({
        assertion: principle,
        category: "teaching_rule",
        chapter: "Teaching Approach",
        section: "Core Principles",
        tags: ["teaching-rule", "core-principle"],
        orderIndex: order++,
      });
    }
  }

  // Teaching Approach — Session Structure
  if (data.teachingApproach?.sessionStructure?.phases?.length) {
    for (const phase of data.teachingApproach.sessionStructure.phases) {
      const dur = phase.duration ? ` (${phase.duration})` : "";
      const desc = phase.description ? `: ${phase.description}` : "";
      assertions.push({
        assertion: `${phase.name}${dur}${desc}`,
        category: "session_flow",
        chapter: "Teaching Approach",
        section: "Session Structure",
        tags: ["session-phase"],
        orderIndex: order++,
      });
    }
  }

  // Teaching Approach — Techniques by Skill
  if (data.teachingApproach?.techniquesBySkill?.length) {
    for (const tech of data.teachingApproach.techniquesBySkill) {
      if (!tech.technique) continue;
      const skillRef = tech.skillId ? `[${tech.skillId}] ` : "";
      assertions.push({
        assertion: `${skillRef}${tech.technique}`,
        category: "scaffolding_technique",
        chapter: "Teaching Approach",
        section: "Techniques by Skill",
        tags: ["scaffolding", ...(tech.skillId ? [tech.skillId.toLowerCase()] : [])],
        orderIndex: order++,
      });
    }
  }

  // Course Phases
  if (data.coursePhases?.length) {
    for (const phase of data.coursePhases) {
      const parts: string[] = [`Phase: ${phase.name}`];
      if (phase.sessions) parts.push(`Sessions: ${phase.sessions}`);
      if (phase.goal) parts.push(`Goal: ${phase.goal}`);
      if (phase.tutorBehaviour?.length) parts.push(`Tutor behaviour: ${phase.tutorBehaviour.join("; ")}`);
      if (phase.exitCriteria?.length) parts.push(`Exit criteria: ${phase.exitCriteria.join("; ")}`);
      assertions.push({
        assertion: parts.join(". "),
        category: "session_flow",
        chapter: "Course Phases",
        section: phase.name,
        tags: ["course-phase"],
        orderIndex: order++,
      });
    }
  }

  // Edge Cases
  if (data.edgeCases?.length) {
    for (const ec of data.edgeCases) {
      assertions.push({
        assertion: `${ec.scenario}: ${ec.response}`,
        category: "edge_case",
        chapter: "Edge Cases",
        section: null,
        tags: ["edge-case"],
        orderIndex: order++,
      });
    }
  }

  // Communication Rules
  if (data.communicationRules) {
    const { toStudent, toParent } = data.communicationRules;
    if (toStudent?.tone) {
      assertions.push({
        assertion: `Student communication tone: ${toStudent.tone}`,
        category: "communication_rule",
        chapter: "Communication Rules",
        section: "To Student",
        tags: ["communication", "student"],
        orderIndex: order++,
      });
    }
    if (toStudent?.frequency) {
      assertions.push({
        assertion: `Student communication frequency: ${toStudent.frequency}`,
        category: "communication_rule",
        chapter: "Communication Rules",
        section: "To Student",
        tags: ["communication", "student"],
        orderIndex: order++,
      });
    }
    if (toParent?.tone) {
      assertions.push({
        assertion: `Parent communication tone: ${toParent.tone}`,
        category: "communication_rule",
        chapter: "Communication Rules",
        section: "To Parent",
        tags: ["communication", "parent"],
        orderIndex: order++,
      });
    }
    if (toParent?.frequency) {
      assertions.push({
        assertion: `Parent communication frequency: ${toParent.frequency}`,
        category: "communication_rule",
        chapter: "Communication Rules",
        section: "To Parent",
        tags: ["communication", "parent"],
        orderIndex: order++,
      });
    }
    if (toParent?.contentFormula) {
      assertions.push({
        assertion: `Parent communication formula: ${toParent.contentFormula}`,
        category: "communication_rule",
        chapter: "Communication Rules",
        section: "To Parent",
        tags: ["communication", "parent"],
        orderIndex: order++,
      });
    }
  }

  // Assessment Boundaries
  if (data.assessmentBoundaries?.length) {
    for (const boundary of data.assessmentBoundaries) {
      assertions.push({
        assertion: boundary,
        category: "assessment_approach",
        chapter: "Assessment Boundaries",
        section: null,
        tags: ["assessment", "boundary"],
        orderIndex: order++,
      });
    }
  }

  // Metrics
  if (data.metrics?.length) {
    for (const metric of data.metrics) {
      assertions.push({
        assertion: metric,
        category: "assessment_approach",
        chapter: "Quality Metrics",
        section: null,
        tags: ["metric", "quality"],
        orderIndex: order++,
      });
    }
  }

  return assertions;
}

/** Exported for reference by other modules */
export { SECTION_TO_CATEGORY };
