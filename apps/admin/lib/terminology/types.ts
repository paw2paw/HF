/**
 * Terminology Profiles — Client-safe types, presets, and resolution logic.
 *
 * Per-institution configurable labels that replace hardcoded school-centric
 * terminology throughout the app. No Prisma dependency — safe for client import.
 */

// ── Types ──────────────────────────────────────────────────

/** The canonical term keys used across the app */
export type TermKey =
  | "institution"
  | "cohort"
  | "learner"
  | "instructor"
  | "supervisor"
  | "session";

/** A complete terminology profile — all keys present, all strings */
export type TerminologyProfile = Record<TermKey, string>;

/** Partial overrides stored in DB (null keys fall back to preset) */
export type TerminologyOverrides = Partial<TerminologyProfile>;

/** Preset identifier */
export type TerminologyPresetId =
  | "school"
  | "corporate"
  | "coaching"
  | "healthcare";

/** What gets stored on Institution.terminology JSON column */
export interface TerminologyConfig {
  preset: TerminologyPresetId;
  overrides?: TerminologyOverrides;
}

// ── Presets ─────────────────────────────────────────────────

export const TERMINOLOGY_PRESETS: Record<
  TerminologyPresetId,
  TerminologyProfile
> = {
  school: {
    institution: "School",
    cohort: "Classroom",
    learner: "Student",
    instructor: "Teacher",
    supervisor: "My Teacher",
    session: "Lesson",
  },
  corporate: {
    institution: "Organization",
    cohort: "Team",
    learner: "Employee",
    instructor: "Trainer",
    supervisor: "My Manager",
    session: "Training Session",
  },
  coaching: {
    institution: "Practice",
    cohort: "Group",
    learner: "Client",
    instructor: "Coach",
    supervisor: "My Coach",
    session: "Coaching Session",
  },
  healthcare: {
    institution: "Facility",
    cohort: "Team",
    learner: "Patient",
    instructor: "Provider",
    supervisor: "My Provider",
    session: "Patient Session",
  },
};

export const DEFAULT_PRESET: TerminologyPresetId = "corporate";
export const DEFAULT_TERMINOLOGY: TerminologyProfile =
  TERMINOLOGY_PRESETS[DEFAULT_PRESET];

// ── Resolution ──────────────────────────────────────────────

/**
 * Resolve a TerminologyConfig (from DB) into a complete TerminologyProfile.
 * Merges preset base with any per-term overrides.
 */
export function resolveTerminology(
  config: TerminologyConfig | null | undefined
): TerminologyProfile {
  if (!config) return DEFAULT_TERMINOLOGY;

  const base =
    TERMINOLOGY_PRESETS[config.preset] ?? DEFAULT_TERMINOLOGY;
  if (!config.overrides) return base;

  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(config.overrides).filter(
        ([, v]) => v != null && v.trim() !== ""
      )
    ),
  } as TerminologyProfile;
}

// ── String helpers ──────────────────────────────────────────

/**
 * Simple English pluralization for terminology terms.
 * Handles common cases: Student→Students, Facility→Facilities, Coach→Coaches.
 */
export function pluralize(term: string): string {
  if (
    term.endsWith("y") &&
    !/[aeiou]y$/i.test(term)
  ) {
    return term.slice(0, -1) + "ies";
  }
  if (
    term.endsWith("s") ||
    term.endsWith("x") ||
    term.endsWith("ch") ||
    term.endsWith("sh")
  ) {
    return term + "es";
  }
  return term + "s";
}

/** Lowercase the first character (for mid-sentence use). */
export function lc(term: string): string {
  return term.charAt(0).toLowerCase() + term.slice(1);
}

// ── Preset metadata (for UI picker) ────────────────────────

export const PRESET_OPTIONS: {
  id: TerminologyPresetId;
  label: string;
  description: string;
}[] = [
  {
    id: "school",
    label: "School",
    description: "School, Classroom, Student, Teacher",
  },
  {
    id: "corporate",
    label: "Corporate",
    description: "Organization, Team, Employee, Trainer",
  },
  {
    id: "coaching",
    label: "Coaching",
    description: "Practice, Group, Client, Coach",
  },
  {
    id: "healthcare",
    label: "Healthcare",
    description: "Facility, Team, Patient, Provider",
  },
];
