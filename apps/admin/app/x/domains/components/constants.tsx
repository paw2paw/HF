// Constants and helper components for domains page

export const STATUSES = ["active", "inactive"] as const;

export const statusColors: Record<string, { bg: string; text: string; icon: string; desc: string }> = {
  active: { bg: "#dcfce7", text: "#166534", icon: "✅", desc: "Currently active domains" },
  inactive: { bg: "#fee2e2", text: "#991b1b", icon: "⏸️", desc: "Inactive domains" },
};

export const playbookStatusMap: Record<string, "draft" | "active" | "archived"> = {
  DRAFT: "draft",
  PUBLISHED: "active",
  ARCHIVED: "archived",
};

export const TRUST_LEVELS = [
  { value: "REGULATORY_STANDARD", label: "L5 Regulatory", color: "var(--trust-l5-text)", bg: "var(--trust-l5-bg)" },
  { value: "ACCREDITED_MATERIAL", label: "L4 Accredited", color: "var(--trust-l4-text)", bg: "var(--trust-l4-bg)" },
  { value: "PUBLISHED_REFERENCE", label: "L3 Published", color: "var(--trust-l3-text)", bg: "var(--trust-l3-bg)" },
  { value: "EXPERT_CURATED", label: "L2 Expert", color: "var(--trust-l2-text)", bg: "var(--trust-l2-bg)" },
  { value: "AI_ASSISTED", label: "L1 AI", color: "var(--trust-l1-text)", bg: "var(--trust-l1-bg)" },
  { value: "UNVERIFIED", label: "L0 Unverified", color: "var(--trust-l0-text)", bg: "var(--trust-l0-bg)" },
];

export function TrustBadge({ level }: { level: string }) {
  const config = TRUST_LEVELS.find((t) => t.value === level) || TRUST_LEVELS[5];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        color: config.color,
        backgroundColor: config.bg,
        border: `1px solid color-mix(in srgb, ${config.color} 20%, transparent)`,
      }}
    >
      {config.label}
    </span>
  );
}

export const DOC_TYPES: Record<string, { label: string; color: string }> = {
  CURRICULUM: { label: "Curriculum", color: "#4338CA" },
  TEXTBOOK: { label: "Textbook", color: "#059669" },
  WORKSHEET: { label: "Worksheet", color: "#D97706" },
  EXAMPLE: { label: "Example", color: "#7C3AED" },
  ASSESSMENT: { label: "Assessment", color: "#DC2626" },
  REFERENCE: { label: "Reference", color: "#6B7280" },
};

export function DocTypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const cfg = DOC_TYPES[type] || { label: type, color: "#6B7280" };
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: 3,
      fontSize: 10,
      fontWeight: 600,
      color: cfg.color,
      backgroundColor: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
    }}>
      {cfg.label}
    </span>
  );
}
