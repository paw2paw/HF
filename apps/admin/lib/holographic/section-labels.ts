/**
 * Holographic Page — Intent-Based Section Labels
 *
 * Labels adapt to role. Same data, different framing.
 * Educators see "Who is my tutor?" — admins see "Identity".
 */

import type { SectionId } from "./permissions";
import { ROLE_LEVEL } from "@/lib/roles";
import type { UserRole } from "@prisma/client";

export interface SectionMeta {
  label: string;
  icon: string; // Lucide icon name
  /** Short description for map card subtitle */
  tagline: string;
}

interface SectionLabels {
  admin: SectionMeta;
  educator: SectionMeta;
}

const SECTION_LABELS: Record<SectionId, SectionLabels> = {
  identity: {
    admin: {
      label: "Identity",
      icon: "Fingerprint",
      tagline: "Archetype, overlay, role, goals",
    },
    educator: {
      label: "Who is my tutor?",
      icon: "Fingerprint",
      tagline: "Personality, goals, approach",
    },
  },
  curriculum: {
    admin: {
      label: "Curriculum",
      icon: "BookOpen",
      tagline: "Subjects, sources, teaching points",
    },
    educator: {
      label: "What does it teach?",
      icon: "BookOpen",
      tagline: "Subjects and content",
    },
  },
  behavior: {
    admin: {
      label: "Behavior",
      icon: "Sliders",
      tagline: "Tone matrices, parameter tuning",
    },
    educator: {
      label: "How does it behave?",
      icon: "Sliders",
      tagline: "Warmth, pace, style",
    },
  },
  onboarding: {
    admin: {
      label: "Onboarding",
      icon: "Rocket",
      tagline: "Welcome, flow phases, targets",
    },
    educator: {
      label: "First call setup",
      icon: "Rocket",
      tagline: "What happens on the first call",
    },
  },
  channels: {
    admin: {
      label: "Channels",
      icon: "Phone",
      tagline: "Voice, SMS, web",
    },
    educator: {
      label: "Channels",
      icon: "Phone",
      tagline: "How students connect",
    },
  },
  readiness: {
    admin: {
      label: "Readiness",
      icon: "CheckCircle",
      tagline: "Pre-launch checks",
    },
    educator: {
      label: "Is everything ready?",
      icon: "CheckCircle",
      tagline: "Setup checklist",
    },
  },
  structure: {
    admin: {
      label: "Structure",
      icon: "Network",
      tagline: "Departments, year groups, wiring",
    },
    educator: {
      label: "My courses & classes",
      icon: "Network",
      tagline: "Departments and classrooms",
    },
  },
  "prompt-preview": {
    admin: {
      label: "Prompt Preview",
      icon: "Sparkles",
      tagline: "Live composed prompt",
    },
    educator: {
      label: "Prompt Preview",
      icon: "Sparkles",
      tagline: "How the AI sees its instructions",
    },
  },
};

/** Get the section label/icon/tagline for a given role. */
export function getSectionMeta(
  section: SectionId,
  role: UserRole,
): SectionMeta {
  const level = ROLE_LEVEL[role] ?? 0;
  const variant = level >= 4 ? "admin" : "educator";
  return SECTION_LABELS[section][variant];
}

/** Get all section labels for a role (for map rendering). */
export function getAllSectionMeta(
  role: UserRole,
): Record<SectionId, SectionMeta> {
  const result = {} as Record<SectionId, SectionMeta>;
  for (const [id, labels] of Object.entries(SECTION_LABELS)) {
    result[id as SectionId] = getSectionMeta(id as SectionId, role);
  }
  return result;
}
