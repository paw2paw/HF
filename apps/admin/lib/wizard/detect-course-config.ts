/**
 * detect-course-config.ts
 *
 * Scan course reference text for the structured "Course Configuration"
 * block added in template v3.0. Extracts machine-readable config fields
 * (teaching approach, emphasis, audience, coverage, course name, subject,
 * learning outcomes) using deterministic regex — zero AI calls.
 *
 * Sibling to detect-pedagogy.ts. Called from the same combinedText pass
 * in ConversationalWizard after course-ref extraction completes.
 *
 * Issue #179.
 */

import {
  type InteractionPattern,
  INTERACTION_PATTERN_ORDER,
  type TeachingMode,
} from "@/lib/content-trust/resolve-config";
import {
  type AudienceId,
  AUDIENCE_OPTIONS,
} from "@/lib/prompt/composition/transforms/audience";

// ── Types ──────────────────────────────────────────────────

export interface DetectedCourseConfig {
  courseName: string | null;
  subjectDiscipline: string | null;
  interactionPattern: InteractionPattern | null;
  teachingMode: TeachingMode | null;
  audience: AudienceId | null;
  planEmphasis: "breadth" | "balanced" | "depth" | null;
  learningOutcomes: string[] | null;
  /** Raw text snippets that triggered each detection. */
  detectedFrom: string[];
}

// ── Whitelists ─────────────────────────────────────────────

const VALID_INTERACTION_PATTERNS = new Set<string>(INTERACTION_PATTERN_ORDER);

const VALID_TEACHING_MODES = new Set<string>([
  "recall", "comprehension", "practice", "syllabus",
]);

const VALID_AUDIENCE_IDS = new Set<string>(AUDIENCE_OPTIONS.map((a) => a.id));

const VALID_PLAN_EMPHASIS = new Set<string>(["breadth", "balanced", "depth"]);

// ── Checkbox label → enum value mappings ───────────────────

const INTERACTION_LABEL_MAP: Record<string, InteractionPattern> = {
  socratic: "socratic",
  directive: "directive",
  advisory: "advisory",
  coaching: "coaching",
  companion: "companion",
  facilitation: "facilitation",
  reflective: "reflective",
  open: "open",
  "conversational guide": "conversational-guide",
};

const TEACHING_MODE_LABEL_MAP: Record<string, TeachingMode> = {
  recall: "recall",
  comprehension: "comprehension",
  practice: "practice",
  syllabus: "syllabus",
};

const AUDIENCE_LABEL_MAP: Record<string, AudienceId> = {
  primary: "primary",
  secondary: "secondary",
  "sixth form": "sixth-form",
  "higher education": "higher-ed",
  professional: "adult-professional",
  "adult learner": "adult-casual",
  mixed: "mixed",
};

const EMPHASIS_LABEL_MAP: Record<string, "breadth" | "balanced" | "depth"> = {
  breadth: "breadth",
  balanced: "balanced",
  depth: "depth",
};

// ── Helpers ────────────────────────────────────────────────

/** Match a checked checkbox: `[x]`, `[X]`, `[ x ]`, `[ X ]` followed by bold label. */
function findCheckedCheckbox(
  bodyText: string,
  labelMap: Record<string, string>,
): { value: string; match: string } | null {
  // Pattern: - [x] **Label** (with flexible spacing)
  const regex = /- \[\s*[xX]\s*\]\s*\*\*([^*]+)\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(bodyText)) !== null) {
    const label = m[1].trim().toLowerCase();
    const mapped = labelMap[label];
    if (mapped) {
      return { value: mapped, match: m[0] };
    }
  }
  return null;
}

/** Extract a **Key:** value field. */
function extractField(bodyText: string, key: string): string | null {
  const regex = new RegExp(`\\*\\*${key}:\\*\\*\\s*(.+)`, "i");
  const m = regex.exec(bodyText);
  if (!m) return null;
  const val = m[1].trim();
  // Skip template placeholders like [Full course name]
  if (/^\[.*\]$/.test(val)) return null;
  return val || null;
}

// ── Main detector ──────────────────────────────────────────

const MAX_LEARNING_OUTCOMES = 30;

export function detectCourseConfig(bodyText: string): DetectedCourseConfig {
  const result: DetectedCourseConfig = {
    courseName: null,
    subjectDiscipline: null,
    interactionPattern: null,
    teachingMode: null,
    audience: null,
    planEmphasis: null,
    learningOutcomes: null,
    detectedFrom: [],
  };

  // ── Course name: explicit field first, then H1 title fallback
  const nameField = extractField(bodyText, "Course name");
  if (nameField) {
    result.courseName = nameField;
    result.detectedFrom.push(`courseName: "${nameField}"`);
  } else {
    const h1Match = bodyText.match(/^#\s+(.+?)\s*[—–-]\s*Course Reference/m);
    if (h1Match) {
      const title = h1Match[1].trim();
      if (title && !title.startsWith("[")) {
        result.courseName = title;
        result.detectedFrom.push(`courseName (H1): "${title}"`);
      }
    }
  }

  // ── Subject / qualification
  const subjectField =
    extractField(bodyText, "Subject / qualification") ||
    extractField(bodyText, "Subject");
  if (subjectField) {
    result.subjectDiscipline = subjectField;
    result.detectedFrom.push(`subject: "${subjectField}"`);
  }

  // ── Interaction pattern (teaching approach checkbox)
  const ipResult = findCheckedCheckbox(bodyText, INTERACTION_LABEL_MAP);
  if (ipResult) {
    if (VALID_INTERACTION_PATTERNS.has(ipResult.value)) {
      result.interactionPattern = ipResult.value as InteractionPattern;
      result.detectedFrom.push(`interactionPattern: "${ipResult.value}"`);
    } else {
      result.detectedFrom.push(
        `interactionPattern REJECTED (invalid): "${ipResult.value}"`,
      );
    }
  }

  // ── Teaching mode (teaching emphasis checkbox)
  const tmResult = findCheckedCheckbox(bodyText, TEACHING_MODE_LABEL_MAP);
  if (tmResult) {
    if (VALID_TEACHING_MODES.has(tmResult.value)) {
      result.teachingMode = tmResult.value as TeachingMode;
      result.detectedFrom.push(`teachingMode: "${tmResult.value}"`);
    } else {
      result.detectedFrom.push(
        `teachingMode REJECTED (invalid): "${tmResult.value}"`,
      );
    }
  }

  // ── Audience (student audience checkbox)
  const audResult = findCheckedCheckbox(bodyText, AUDIENCE_LABEL_MAP);
  if (audResult) {
    if (VALID_AUDIENCE_IDS.has(audResult.value)) {
      result.audience = audResult.value as AudienceId;
      result.detectedFrom.push(`audience: "${audResult.value}"`);
    } else {
      result.detectedFrom.push(
        `audience REJECTED (invalid): "${audResult.value}"`,
      );
    }
  }

  // ── Plan emphasis (coverage emphasis checkbox)
  const empResult = findCheckedCheckbox(bodyText, EMPHASIS_LABEL_MAP);
  if (empResult) {
    if (VALID_PLAN_EMPHASIS.has(empResult.value)) {
      result.planEmphasis = empResult.value as "breadth" | "balanced" | "depth";
      result.detectedFrom.push(`planEmphasis: "${empResult.value}"`);
    } else {
      result.detectedFrom.push(
        `planEmphasis REJECTED (invalid): "${empResult.value}"`,
      );
    }
  }

  // ── Learning outcomes: OUT-XX lines with "The learner can:" statements
  const outcomeRegex =
    /\*\*OUT-\d+:\s*(.+?)\*\*[\s\S]*?\*The learner can:\*\s*(.+)/g;
  const outcomes: string[] = [];
  let om: RegExpExecArray | null;
  while ((om = outcomeRegex.exec(bodyText)) !== null) {
    if (outcomes.length >= MAX_LEARNING_OUTCOMES) break;
    const statement = om[2].trim();
    // Skip template placeholders
    if (statement.startsWith("[") && statement.endsWith("]")) continue;
    if (statement) outcomes.push(statement);
  }
  if (outcomes.length > 0) {
    result.learningOutcomes = outcomes;
    result.detectedFrom.push(`learningOutcomes: ${outcomes.length} found`);
  }

  return result;
}

/**
 * Return true if at least one config field was detected.
 */
export function hasCourseConfig(c: DetectedCourseConfig): boolean {
  return (
    c.courseName !== null ||
    c.subjectDiscipline !== null ||
    c.interactionPattern !== null ||
    c.teachingMode !== null ||
    c.audience !== null ||
    c.planEmphasis !== null ||
    c.learningOutcomes !== null
  );
}
