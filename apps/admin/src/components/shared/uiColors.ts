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
  // Caller - Blue (primary entity, users interact with callers most)
  caller: {
    text: "#1e40af",    // blue-800
    bg: "#dbeafe",      // blue-100
    border: "#93c5fd",  // blue-300
    accent: "#3b82f6",  // blue-500
  },
  // Domain - Emerald/Green (organizational container)
  domain: {
    text: "#065f46",    // emerald-800
    bg: "#d1fae5",      // emerald-100
    border: "#6ee7b7",  // emerald-300
    accent: "#10b981",  // emerald-500
  },
  // Playbook - Purple (configuration/rules)
  playbook: {
    text: "#5b21b6",    // violet-800
    bg: "#ede9fe",      // violet-100
    border: "#c4b5fd",  // violet-300
    accent: "#8b5cf6",  // violet-500
  },
  // Spec - Amber/Orange (specifications/definitions)
  spec: {
    text: "#92400e",    // amber-800
    bg: "#fef3c7",      // amber-100
    border: "#fcd34d",  // amber-300
    accent: "#f59e0b",  // amber-500
  },
  // Call - Cyan/Teal (conversations/interactions)
  call: {
    text: "#155e75",    // cyan-800
    bg: "#cffafe",      // cyan-100
    border: "#67e8f9",  // cyan-300
    accent: "#06b6d4",  // cyan-500
  },
  // Parameter - Slate (data/configuration values)
  parameter: {
    text: "#334155",    // slate-700
    bg: "#f1f5f9",      // slate-100
    border: "#cbd5e1",  // slate-300
    accent: "#64748b",  // slate-500
  },
} as const;

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