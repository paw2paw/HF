/**
 * Shared goal type and status constants.
 * Single source of truth — used by API routes, course detail, caller detail, etc.
 */

export type GoalTypeConfig = {
  label: string;
  icon: string;
  color: string;
  glow: string;
};

export type GoalStatusConfig = {
  label: string;
  icon: string;
  color: string;
};

export const GOAL_TYPE_CONFIG: Record<string, GoalTypeConfig> = {
  LEARN: { label: "Learn", icon: "\u{1F4DA}", color: "var(--status-success-text)", glow: "var(--status-success-text)" },
  ACHIEVE: { label: "Achieve", icon: "\u{1F3C6}", color: "var(--status-warning-text)", glow: "var(--status-warning-text)" },
  CHANGE: { label: "Change", icon: "\u{1F504}", color: "var(--accent-secondary, #8b5cf6)", glow: "var(--accent-secondary, #8b5cf6)" },
  CONNECT: { label: "Connect", icon: "\u{1F91D}", color: "var(--badge-cyan-text, #06b6d4)", glow: "var(--badge-cyan-text, #0891b2)" },
  SUPPORT: { label: "Support", icon: "\u{1F49A}", color: "var(--status-success-text)", glow: "var(--status-success-text)" },
  CREATE: { label: "Create", icon: "\u{1F3A8}", color: "var(--badge-pink-text, #ec4899)", glow: "var(--badge-pink-accent, #db2777)" },
};

export const GOAL_STATUS_CONFIG: Record<string, GoalStatusConfig> = {
  ACTIVE: { label: "Active", icon: "\u2705", color: "var(--status-success-text)" },
  COMPLETED: { label: "Completed", icon: "\u{1F389}", color: "var(--accent-primary)" },
  PAUSED: { label: "Paused", icon: "\u23F8\uFE0F", color: "var(--status-warning-text)" },
  ARCHIVED: { label: "Archived", icon: "\u{1F4E6}", color: "var(--text-muted)" },
};

/** For FancySelect dropdowns — includes "all" option */
export const GOAL_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  ...Object.entries(GOAL_TYPE_CONFIG).map(([value, c]) => ({
    value,
    label: `${c.icon} ${c.label}`,
    color: c.color,
  })),
];

/** For FancySelect dropdowns — includes "all" option */
export const GOAL_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  ...Object.entries(GOAL_STATUS_CONFIG).map(([value, c]) => ({
    value,
    label: `${c.icon} ${c.label}`,
    color: c.color,
  })),
];
