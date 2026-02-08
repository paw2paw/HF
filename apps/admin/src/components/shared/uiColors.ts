export const uiColors = {
  // Core text
  text: "#111827", // main readable text
  textLabel: "#374151", // labels / headings
  textMuted: "#4b5563", // helper / secondary copy

  // Surfaces
  surface: "#ffffff",
  surfaceSubtle: "#f9fafb",

  // Borders
  border: "#d1d5db",
  borderSubtle: "#e5e7eb",

  // Status
  successText: "#065f46",
  successBg: "#ecfdf5",
  successBorder: "#a7f3d0",

  dangerText: "#991b1b",
  dangerBg: "#fff1f2",
  dangerBorder: "#fecaca",

  neutralText: "#374151",
  neutralBg: "#f3f4f6",
  neutralBorder: "#e5e7eb",

  // Brand colors
  brandText: "#4f46e5", // indigo-600
  brandBg: "#eef2ff", // indigo-50
  brandBorder: "#c7d2fe", // indigo-200
} as const;

// =============================================================================
// ENTITY COLORS - Each entity type has a distinct color family
// =============================================================================
export const entityColors = {
  // Domain - Blue (organizational container/territory)
  domain: {
    text: "#1e40af",    // blue-800
    bg: "#dbeafe",      // blue-100
    border: "#93c5fd",  // blue-300
    accent: "#3b82f6",  // blue-500
    icon: "🌐",
  },
  // Playbook - Amber (warm guidebook)
  playbook: {
    text: "#92400e",    // amber-800
    bg: "#fef3c7",      // amber-100
    border: "#fcd34d",  // amber-300
    accent: "#f59e0b",  // amber-500
    icon: "📒",
  },
  // Spec - Emerald (checklist/verify)
  spec: {
    text: "#065f46",    // emerald-800
    bg: "#d1fae5",      // emerald-100
    border: "#6ee7b7",  // emerald-300
    accent: "#10b981",  // emerald-500
    icon: "📋",
  },
  // Parameter - Purple (variables/math)
  parameter: {
    text: "#5b21b6",    // violet-800
    bg: "#ede9fe",      // violet-100
    border: "#c4b5fd",  // violet-300
    accent: "#8b5cf6",  // violet-500
    icon: "🔢",
  },
  // Caller - Pink (human/identity)
  caller: {
    text: "#9d174d",    // pink-800
    bg: "#fce7f3",      // pink-100
    border: "#f9a8d4",  // pink-300
    accent: "#ec4899",  // pink-500
    icon: "👤",
  },
  // Goal - Cyan (target/aim)
  goal: {
    text: "#155e75",    // cyan-800
    bg: "#cffafe",      // cyan-100
    border: "#67e8f9",  // cyan-300
    accent: "#06b6d4",  // cyan-500
    icon: "🎯",
  },
  // Call - Indigo (communication)
  call: {
    text: "#3730a3",    // indigo-800
    bg: "#e0e7ff",      // indigo-100
    border: "#a5b4fc",  // indigo-300
    accent: "#6366f1",  // indigo-500
    icon: "📞",
  },
  // Transcript - Slate (raw recording)
  transcript: {
    text: "#334155",    // slate-700
    bg: "#f1f5f9",      // slate-100
    border: "#cbd5e1",  // slate-300
    accent: "#64748b",  // slate-500
    icon: "🎙️",
  },
  // Prompt - Orange (writing/craft)
  prompt: {
    text: "#9a3412",    // orange-800
    bg: "#ffedd5",      // orange-100
    border: "#fdba74",  // orange-300
    accent: "#f97316",  // orange-500
    icon: "📝",
  },
  // Memory - Violet (mind/recall)
  memory: {
    text: "#5b21b6",    // violet-800
    bg: "#f5f3ff",      // violet-50
    border: "#c4b5fd",  // violet-300
    accent: "#7c3aed",  // violet-600
    icon: "🧠",
  },
  // Knowledge - Teal (library/source)
  knowledge: {
    text: "#115e59",    // teal-800
    bg: "#ccfbf1",      // teal-100
    border: "#5eead4",  // teal-300
    accent: "#14b8a6",  // teal-500
    icon: "📚",
  },
  // Run/Pipeline - Rose (process/action)
  run: {
    text: "#9f1239",    // rose-800
    bg: "#ffe4e6",      // rose-100
    border: "#fda4af",  // rose-300
    accent: "#f43f5e",  // rose-500
    icon: "⚙️",
  },
} as const;

export type EntityType = keyof typeof entityColors;

// =============================================================================
// STATUS COLORS - Entity lifecycle states
// =============================================================================
export const statusColors = {
  draft: {
    text: "#854d0e",    // yellow-800
    bg: "#fef9c3",      // yellow-100
    border: "#fde047",  // yellow-300
    accent: "#eab308",  // yellow-500
  },
  active: {
    text: "#166534",    // green-800
    bg: "#dcfce7",      // green-100
    border: "#86efac",  // green-300
    accent: "#22c55e",  // green-500
  },
  compiled: {
    text: "#1e40af",    // blue-800
    bg: "#dbeafe",      // blue-100
    border: "#93c5fd",  // blue-300
    accent: "#3b82f6",  // blue-500
  },
  validated: {
    text: "#065f46",    // emerald-800
    bg: "#d1fae5",      // emerald-100
    border: "#6ee7b7",  // emerald-300
    accent: "#10b981",  // emerald-500
  },
  pending: {
    text: "#92400e",    // amber-800
    bg: "#fef3c7",      // amber-100
    border: "#fcd34d",  // amber-300
    accent: "#f59e0b",  // amber-500
  },
  error: {
    text: "#991b1b",    // red-800
    bg: "#fee2e2",      // red-100
    border: "#fca5a5",  // red-300
    accent: "#ef4444",  // red-500
  },
  archived: {
    text: "#374151",    // gray-700
    bg: "#f3f4f6",      // gray-100
    border: "#d1d5db",  // gray-300
    accent: "#6b7280",  // gray-500
  },
  deprecated: {
    text: "#475569",    // slate-600
    bg: "#f1f5f9",      // slate-100
    border: "#cbd5e1",  // slate-300
    accent: "#94a3b8",  // slate-400
  },
} as const;

export type StatusType = keyof typeof statusColors;

// =============================================================================
// SPEC TYPE COLORS - For spec roles (IDENTITY, CONTENT, VOICE, etc.)
// =============================================================================
export const specTypeColors = {
  // Role-based specs (what the spec defines)
  IDENTITY: { text: "#1e40af", bg: "#dbeafe", border: "#93c5fd" },  // Blue - WHO the agent is
  CONTENT:  { text: "#065f46", bg: "#d1fae5", border: "#6ee7b7" },  // Emerald - WHAT it knows
  VOICE:    { text: "#be185d", bg: "#fce7f3", border: "#f9a8d4" },  // Pink - HOW it speaks
  CONTEXT:  { text: "#0e7490", bg: "#cffafe", border: "#67e8f9" },  // Cyan - Caller context
  META:     { text: "#4b5563", bg: "#f3f4f6", border: "#d1d5db" },  // Gray - Legacy/system
} as const;

// =============================================================================
// PIPELINE COLORS - For pipeline operations (LEARN, MEASURE, ADAPT, COMPOSE)
// =============================================================================
export const pipelineColors = {
  LEARN:   { text: "#5b21b6", bg: "#ede9fe", border: "#c4b5fd" },  // Violet - Extract data
  MEASURE: { text: "#0f766e", bg: "#ccfbf1", border: "#5eead4" },  // Teal - Score behavior
  ADAPT:   { text: "#c2410c", bg: "#ffedd5", border: "#fdba74" },  // Orange - Compute targets
  COMPOSE: { text: "#be185d", bg: "#fce7f3", border: "#f9a8d4" },  // Pink - Build prompt
} as const;

// =============================================================================
// COMPARE MODE COLORS - For A/B comparison
// =============================================================================
export const compareColors = {
  configA: {
    text: "#1e40af",    // blue-800
    bg: "#eff6ff",      // blue-50
    border: "#3b82f6",  // blue-500
    headerBg: "#dbeafe", // blue-100
  },
  configB: {
    text: "#5b21b6",    // violet-800
    bg: "#f5f3ff",      // violet-50
    border: "#8b5cf6",  // violet-500
    headerBg: "#ede9fe", // violet-100
  },
} as const;

// =============================================================================
// DIFF COLORS - For showing changes
// =============================================================================
export const diffColors = {
  added:   { text: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },  // Green
  removed: { text: "#dc2626", bg: "#fef2f2", border: "#fecaca" },  // Red
  changed: { text: "#d97706", bg: "#fffbeb", border: "#fde68a" },  // Amber
} as const;