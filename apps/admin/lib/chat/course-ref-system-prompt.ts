/**
 * Course Reference Builder — System Prompt
 *
 * Builds the system prompt for the COURSE_REF chat mode.
 * The AI acts as a curriculum design expert, interviewing the educator
 * to build a structured COURSE_REFERENCE document through conversation.
 *
 * The prompt adapts based on:
 * - Current completeness state (which sections are filled)
 * - Whether editing an existing reference or starting fresh
 * - Pre-filled data from an existing course (if courseId provided)
 */

import type { CourseRefData } from "@/lib/content-trust/course-ref-to-assertions";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CourseRefPromptContext {
  /** Current accumulated reference data */
  refData: CourseRefData;
  /** Whether editing an existing reference */
  isEditing: boolean;
  /** Pre-filled course name (from existing course or prior conversation) */
  courseName?: string;
  /** Pre-filled institution name */
  institutionName?: string;
  /** Existing courseId (for edit mode) */
  courseId?: string;
}

// ── Section Completeness ─────────────────────────────────────────────────────

interface SectionStatus {
  key: string;
  label: string;
  status: "complete" | "partial" | "empty";
  mandatory: boolean;
}

function evaluateSections(data: CourseRefData): SectionStatus[] {
  return [
    {
      key: "courseOverview",
      label: "Course Overview",
      status: data.courseOverview?.subject ? "complete" : data.courseOverview ? "partial" : "empty",
      mandatory: false,
    },
    {
      key: "learningOutcomes",
      label: "Learning Outcomes",
      status: data.learningOutcomes?.skillOutcomes?.length ? "complete" : "empty",
      mandatory: false,
    },
    {
      key: "skillsFramework",
      label: "Skills Framework",
      status: data.skillsFramework?.length
        ? data.skillsFramework.every((s) => s.tiers?.emerging)
          ? "complete"
          : "partial"
        : "empty",
      mandatory: true,
    },
    {
      key: "teachingApproach",
      label: "Teaching Approach",
      status: data.teachingApproach?.corePrinciples?.length
        ? data.teachingApproach.corePrinciples.length >= 2
          ? "complete"
          : "partial"
        : "empty",
      mandatory: true,
    },
    {
      key: "coursePhases",
      label: "Course Phases",
      status: data.coursePhases?.length ? "complete" : "empty",
      mandatory: false,
    },
    {
      key: "edgeCases",
      label: "Edge Cases",
      status: data.edgeCases?.length
        ? data.edgeCases.length >= 2
          ? "complete"
          : "partial"
        : "empty",
      mandatory: true,
    },
    {
      key: "communicationRules",
      label: "Communication Rules",
      status: data.communicationRules?.toStudent?.tone ? "complete" : "empty",
      mandatory: false,
    },
    {
      key: "assessmentBoundaries",
      label: "Assessment Boundaries",
      status: data.assessmentBoundaries?.length ? "complete" : "empty",
      mandatory: false,
    },
    {
      key: "metrics",
      label: "Quality Metrics",
      status: data.metrics?.length ? "complete" : "empty",
      mandatory: false,
    },
    {
      key: "moduleDescriptors",
      label: "Module Descriptors",
      status: data.moduleDescriptors?.length ? "complete" : "empty",
      mandatory: false,
    },
  ];
}

function buildCompletenessSection(sections: SectionStatus[]): string {
  const lines: string[] = ["## Current document state"];
  const complete = sections.filter((s) => s.status === "complete").length;
  lines.push(`Progress: ${complete}/${sections.length} sections complete`);
  lines.push("");
  for (const s of sections) {
    const icon = s.status === "complete" ? "✓" : s.status === "partial" ? "◎" : "·";
    const tag = s.mandatory ? " (MANDATORY)" : "";
    lines.push(`${icon} ${s.label}${tag}`);
  }

  const mandatoryMissing = sections.filter((s) => s.mandatory && s.status !== "complete");
  if (mandatoryMissing.length > 0) {
    lines.push("");
    lines.push(`⚠ ${mandatoryMissing.length} mandatory section(s) still needed: ${mandatoryMissing.map((s) => s.label).join(", ")}`);
  }

  return lines.join("\n");
}

function buildPhaseGuide(sections: SectionStatus[]): string {
  // Determine which phase the interview is in based on completeness
  const hasOverview = sections.find((s) => s.key === "courseOverview")?.status !== "empty";
  const hasSkills = sections.find((s) => s.key === "skillsFramework")?.status !== "empty";
  const hasApproach = sections.find((s) => s.key === "teachingApproach")?.status !== "empty";
  const hasEdgeCases = sections.find((s) => s.key === "edgeCases")?.status !== "empty";
  const allMandatory = sections.filter((s) => s.mandatory).every((s) => s.status === "complete");

  if (!hasOverview) {
    return `## Current phase: 1 — Ground Truth
Collect: institution name, course name, subject, delivery method, student profile, exam context.
Ask: "What should a student be able to DO after this course?"
Probe for measurable outcomes vs vague goals.
If they mention university, degree, or modules — probe for EQF level and ECTS credits.`;
  }
  if (!hasSkills) {
    return `## Current phase: 2 — Skills Framework
Ask: "What core skills are you developing? Let's define them one at a time."
For each skill: name, description, then proficiency tiers (emerging / developing / secure).
Probe: "What does 'just starting' look like?" and "What about when they're confident?"
Ask about dependencies: "Does any skill require another first?"
Play back each skill before moving on.`;
  }
  if (!hasApproach) {
    return `## Current phase: 3 — Teaching Approach
Ask: "Walk me through a typical session — what happens first, middle, end?"
Ask: "What should the AI tutor ALWAYS do? What should it NEVER do?"
Probe: "Are there specific techniques for each skill?"
Ask: "How does the course change across sessions? Any distinct phases?"
Extract: core principles, session structure with timings, techniques per skill, course phases.`;
  }
  if (!hasEdgeCases) {
    return `## Current phase: 4 — Boundaries & Safety
Ask: "What situations might go wrong? Student distressed, off-topic, uncommunicative?"
For each scenario: "What should the tutor DO?"
Ask: "How should the tutor talk to students? Any tone rules?"
Ask: "What is this course NOT? What should the tutor refuse to do?"
Also cover: communication rules, assessment boundaries.`;
  }
  if (!allMandatory) {
    return `## Current phase: 4b — Filling Gaps
Some mandatory sections still need completion. Focus on what's missing.`;
  }
  return `## Current phase: 5 — Quality & Finalize
Ask: "How will you know the course is working? What signals success?"
Show the full preview. Ask if anything needs changing.
When ready, call finalize_ref to create the course and reference document.`;
}

// ── Academic Context Detection (Bologna) ─────────────────────────────────────

/**
 * Detect whether the educator is building an academic/HE course.
 * Used to conditionally inject Bologna-aware interview guidance.
 * Exported for testing.
 */
export function detectAcademicContext(data: CourseRefData): boolean {
  const text = [
    data.courseOverview?.studentAge,
    data.courseOverview?.examContext,
    data.courseOverview?.qualificationLevel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const hasExplicitFields =
    data.courseOverview?.eqfLevel != null ||
    data.courseOverview?.ectsCredits != null ||
    (data.moduleDescriptors?.length ?? 0) > 0 ||
    data.learningOutcomes?.dublinDescriptors != null;

  const academicPattern =
    /universit|degree|module|ects|bachelor|master|postgrad|higher.ed|undergraduate|doctoral|phd|diploma/;

  return hasExplicitFields || academicPattern.test(text);
}

function buildAcademicBlock(data: CourseRefData): string {
  if (!detectAcademicContext(data)) return "";

  return `
## Academic course structure (detected)

This appears to be a higher-education or professional qualification course. Adapt your interview:

- **EQF level**: Infer from context. UG year 1-2 → EQF 5-6, Honours/final year → EQF 6, Masters → EQF 7, Doctoral → EQF 8. Confirm with the educator.
- **ECTS credits**: Ask "How many credits is this module worth?" (1 ECTS ≈ 25-30 study hours)
- **Dublin Descriptors**: Organise learning outcomes into 5 categories:
  Knowledge & Understanding, Applying Knowledge, Making Judgements, Communication Skills, Learning Skills.
  Ask: "Let's organise your learning outcomes — what should students KNOW? What should they be able to DO? What judgements should they make?"
- **Module descriptors**: If the course has multiple modules, capture title, credits, LOs, assessment method, prerequisites per module via update_ref with section "moduleDescriptors".
- **Prerequisites**: "Does this module formally require completion of another?"

Use these terms naturally — academic educators know them. Do NOT explain what Dublin Descriptors or EQF levels are.
If the educator uses informal terms ("it's a second-year module"), infer EQF 5-6 and confirm.`;
}

// ── Main Prompt Builder ──────────────────────────────────────────────────────

export function buildCourseRefSystemPrompt(ctx: CourseRefPromptContext): string {
  const sections = evaluateSections(ctx.refData);
  const completeness = buildCompletenessSection(sections);
  const phaseGuide = buildPhaseGuide(sections);

  const editingNote = ctx.isEditing
    ? `You are EDITING an existing course reference for "${ctx.courseName || "this course"}". The current document state is shown below. Ask what the educator wants to change.`
    : ctx.courseName
      ? `The educator is building a reference for "${ctx.courseName}" at "${ctx.institutionName || "their institution"}".`
      : "The educator is starting fresh. Begin by learning about their course.";

  return `You are a curriculum design expert helping an educator build a Course Reference — a document that tells the AI tutor HOW to teach their course.

${editingNote}

## What you are building

A structured document with 9 sections:
1. Course Overview — subject, students, delivery, proposition
2. Learning Outcomes — what students should be able to DO after the course
3. Skills Framework — core skills with proficiency tiers (emerging/developing/secure) ★ MANDATORY
4. Teaching Approach — core principles, session structure, techniques ★ MANDATORY
5. Course Phases — how the course progresses across sessions
6. Edge Cases — what to do when things go wrong ★ MANDATORY
7. Communication Rules — tone, frequency, parent vs student
8. Assessment Boundaries — what this course is NOT
9. Quality Metrics — how to know the course is working

★ = Must be complete before finalize. The other 6 sections improve quality but aren't blocking.

## Your interview approach

- You are a curriculum design expert having a professional conversation
- Ask open questions, then probe for specifics
- After each answer, synthesize and play back for confirmation
- When you have enough for a section, call update_ref to save it, then show_ref_preview
- Follow the phase order but ADAPT — if the educator volunteers later info, capture it immediately
- Use the educator's language — do not impose academic jargon
- When the educator describes something vaguely, ask for a concrete example
- For skills: always probe for all three tiers (emerging, developing, secure)
- For edge cases: always probe for the tutor's RESPONSE, not just the scenario

## Tools — when to call them

- **update_ref**: After EVERY meaningful exchange. Do not batch. Save immediately.
- **show_ref_preview**: After every update_ref, to refresh the preview panel.
- **check_completeness**: Before suggesting finalization.
- **finalize_ref**: Only when all 3 mandatory sections are complete AND the educator confirms.
- **show_suggestions**: For confirmation chips only ("Looks right", "Let me correct that", "Next section").

${completeness}

${phaseGuide}
${buildAcademicBlock(ctx.refData)}

## Rules

1. Call update_ref after EVERY meaningful exchange — do not batch
2. Always call show_ref_preview after update_ref so the preview updates
3. Play back each section before moving on — educator must confirm
4. When the educator describes something vaguely, ask for a concrete example
5. For skills: ALWAYS get all three proficiency tiers (emerging / developing / secure)
6. NEVER expose section keys, JSON structure, or technical details
7. NEVER skip ahead to finalize before mandatory sections are complete
8. Keep responses concise — 2-4 sentences per turn, plus tool calls
9. If the educator wants to go back and edit a section, let them — call update_ref with the corrected data
10. At finalize: collect institution name and course name if not already known`;
}

/** Export for use by completeness checker tool */
export { evaluateSections };
export type { SectionStatus };
