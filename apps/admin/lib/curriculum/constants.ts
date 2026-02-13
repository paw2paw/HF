/**
 * Shared constants for the curriculum system.
 *
 * Single source of truth — used by:
 *   - compose-content-section.ts (validation)
 *   - readiness.ts (content_spec_curriculum executor)
 *   - specs/new/page.tsx (wizard validation)
 *
 * Matches CURRICULUM_PROGRESS_V1 contract metadata.curriculum required fields.
 */

/**
 * Required fields in a CONTENT spec's metadata.curriculum section.
 * Any CONTENT spec missing these will fail validation and readiness checks.
 */
export const CURRICULUM_REQUIRED_FIELDS = [
  "type",
  "trackingMode",
  "moduleSelector",
  "moduleOrder",
  "progressKey",
  "masteryThreshold",
] as const;

export type CurriculumRequiredField = (typeof CURRICULUM_REQUIRED_FIELDS)[number];

/**
 * Exam readiness level display config.
 * Maps level keys (from exam-readiness.ts) to UI labels and colors.
 */
export const EXAM_LEVEL_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  not_ready: { label: "Not Ready", color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
  borderline: { label: "Borderline", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  ready: { label: "Ready", color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0" },
  strong: { label: "Strong", color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
};
