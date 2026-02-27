/**
 * Holographic Page — Permission Model
 *
 * Determines which sections a user can view and edit based on role level.
 * Hidden sections don't appear in the map at all.
 * Read-only sections render values as styled text.
 */

import { ROLE_LEVEL } from "@/lib/roles";
import type { UserRole } from "@prisma/client";

export type SectionId =
  | "identity"
  | "curriculum"
  | "behavior"
  | "onboarding"
  | "channels"
  | "readiness"
  | "structure"
  | "prompt-preview";

export const ALL_SECTIONS: SectionId[] = [
  "identity",
  "curriculum",
  "behavior",
  "onboarding",
  "channels",
  "readiness",
  "structure",
  "prompt-preview",
];

interface SectionPermission {
  /** Minimum role level to see this section */
  view: number;
  /** Minimum role level to edit (5 = nobody edits) */
  edit: number;
}

const SECTION_PERMISSIONS: Record<SectionId, SectionPermission> = {
  identity: { view: 1, edit: 3 },
  curriculum: { view: 1, edit: 3 },
  behavior: { view: 1, edit: 3 },
  onboarding: { view: 1, edit: 3 },
  channels: { view: 3, edit: 4 },
  readiness: { view: 1, edit: 5 },
  structure: { view: 1, edit: 3 },
  "prompt-preview": { view: 3, edit: 5 },
};

/** Can the user see this section at all? */
export function canView(section: SectionId, role: UserRole): boolean {
  const level = ROLE_LEVEL[role] ?? 0;
  return level >= SECTION_PERMISSIONS[section].view;
}

/** Can the user edit fields in this section? */
export function canEdit(section: SectionId, role: UserRole): boolean {
  const level = ROLE_LEVEL[role] ?? 0;
  return level >= SECTION_PERMISSIONS[section].edit;
}

/** Get all sections visible to this role, in display order. */
export function visibleSections(role: UserRole): SectionId[] {
  return ALL_SECTIONS.filter((s) => canView(s, role));
}

/** Get the first visible section for initial load. */
export function defaultSection(role: UserRole): SectionId {
  return visibleSections(role)[0] ?? "identity";
}
