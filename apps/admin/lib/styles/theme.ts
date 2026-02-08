/**
 * Shared theme styles using CSS variables from globals.css
 * This provides consistent theming that works in both light and dark modes
 */

export const theme = {
  // Page container
  page: {
    padding: 24,
    maxWidth: 1200,
    margin: "0 auto",
    color: "var(--text-primary)",
  },

  // Headers
  h1: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    color: "var(--text-primary)",
  },

  h2: {
    fontSize: 20,
    fontWeight: 600,
    margin: 0,
    color: "var(--text-primary)",
  },

  h3: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
    color: "var(--text-primary)",
  },

  // Text
  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
    marginTop: 4,
  },

  muted: {
    fontSize: 13,
    color: "var(--text-muted)",
  },

  small: {
    fontSize: 11,
    color: "var(--text-muted)",
  },

  // Cards
  card: {
    background: "var(--surface-primary)",
    border: "1px solid var(--border-default)",
    borderRadius: 10,
    padding: 16,
  },

  cardHighlight: {
    background: "var(--surface-primary)",
    border: "2px solid var(--accent-primary)",
    borderRadius: 10,
    padding: 16,
  },

  // Form containers
  formContainer: {
    marginBottom: 24,
    padding: 20,
    background: "var(--surface-secondary)",
    borderRadius: 12,
    border: "1px solid var(--border-default)",
    color: "var(--text-primary)",
  },

  // Labels
  label: {
    display: "block" as const,
    fontSize: 12,
    fontWeight: 500,
    marginBottom: 4,
    color: "var(--text-secondary)",
  },

  // Inputs
  input: {
    width: "100%",
    padding: 8,
    border: "1px solid var(--border-default)",
    borderRadius: 6,
    color: "var(--text-primary)",
    background: "var(--surface-primary)",
  },

  inputMono: {
    width: "100%",
    padding: 8,
    border: "1px solid var(--border-default)",
    borderRadius: 6,
    fontFamily: "monospace",
    color: "var(--text-primary)",
    background: "var(--surface-primary)",
  },

  textarea: {
    width: "100%",
    padding: 8,
    border: "1px solid var(--border-default)",
    borderRadius: 6,
    fontFamily: "monospace",
    fontSize: 13,
    color: "var(--text-primary)",
    background: "var(--surface-primary)",
  },

  select: {
    width: "100%",
    padding: 8,
    border: "1px solid var(--border-default)",
    borderRadius: 6,
    color: "var(--text-primary)",
    background: "var(--surface-primary)",
  },

  // Buttons
  btnPrimary: {
    padding: "8px 16px",
    background: "var(--accent-primary)",
    color: "var(--accent-primary-text)",
    border: "none",
    borderRadius: 6,
    fontWeight: 500,
    cursor: "pointer",
  },

  btnSecondary: {
    padding: "8px 16px",
    background: "var(--surface-secondary)",
    color: "var(--text-primary)",
    border: "none",
    borderRadius: 6,
    fontWeight: 500,
    cursor: "pointer",
  },

  btnSmall: {
    padding: "4px 8px",
    background: "var(--surface-secondary)",
    border: "none",
    borderRadius: 4,
    fontSize: 11,
    cursor: "pointer",
    color: "var(--text-primary)",
  },

  btnDanger: {
    padding: "4px 8px",
    background: "var(--status-error-bg)",
    color: "var(--status-error-text)",
    border: "none",
    borderRadius: 4,
    fontSize: 11,
    cursor: "pointer",
  },

  btnSuccess: {
    padding: "4px 8px",
    background: "var(--status-success-bg)",
    color: "var(--status-success-text)",
    border: "none",
    borderRadius: 4,
    fontSize: 11,
    cursor: "pointer",
  },

  // Pills / filter buttons
  pillActive: {
    padding: "4px 12px",
    background: "var(--accent-primary)",
    color: "var(--accent-primary-text)",
    border: "none",
    borderRadius: 16,
    fontSize: 12,
    cursor: "pointer",
  },

  pillInactive: {
    padding: "4px 12px",
    background: "var(--surface-secondary)",
    color: "var(--text-primary)",
    border: "none",
    borderRadius: 16,
    fontSize: 12,
    cursor: "pointer",
  },

  // Status badges
  badge: {
    fontSize: 10,
    padding: "2px 8px",
    borderRadius: 4,
    fontWeight: 600,
    textTransform: "uppercase" as const,
  },

  // Code/content display
  codeBlock: {
    marginTop: 12,
    padding: 12,
    background: "var(--surface-secondary)",
    borderRadius: 6,
    fontFamily: "monospace",
    fontSize: 12,
    whiteSpace: "pre-wrap" as const,
    maxHeight: 300,
    overflow: "auto",
    color: "var(--text-primary)",
  },

  // Empty state
  emptyState: {
    padding: 40,
    textAlign: "center" as const,
    background: "var(--surface-secondary)",
    borderRadius: 12,
    border: "1px solid var(--border-default)",
  },

  // Error alert
  errorAlert: {
    padding: 12,
    background: "var(--status-error-bg)",
    color: "var(--status-error-text)",
    borderRadius: 8,
    marginBottom: 16,
  },

  // Info panel
  infoPanel: {
    padding: 12,
    background: "var(--status-info-bg)",
    color: "var(--status-info-text)",
    borderRadius: 8,
    fontSize: 13,
  },

  // Checkbox label
  checkboxLabel: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 8,
    fontSize: 14,
    color: "var(--text-secondary)",
  },
} as const;

// Status colors map
export const statusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)" },
  PUBLISHED: { bg: "var(--status-success-bg)", text: "var(--status-success-text)" },
  ARCHIVED: { bg: "var(--status-neutral-bg)", text: "var(--status-neutral-text)" },
  OK: { bg: "var(--status-success-bg)", text: "var(--status-success-text)" },
  ERROR: { bg: "var(--status-error-bg)", text: "var(--status-error-text)" },
  RUNNING: { bg: "var(--status-info-bg)", text: "var(--status-info-text)" },
  QUEUED: { bg: "var(--status-neutral-bg)", text: "var(--status-neutral-text)" },
};

// Category/type colors (these work in both modes)
export const categoryColors: Record<string, string> = {
  system: "#6366f1",
  safety: "#dc2626",
  persona: "#10b981",
  instruction: "#f59e0b",
  custom: "#8b5cf6",
  BLOCK: "#6366f1",
  SLUG: "#10b981",
  CALLER: "#f59e0b",
  AUTO_SLUGS: "#8b5cf6",
  PARAMETER: "#6366f1",
  COMPOSITE: "#f59e0b",
  ADAPT: "#8b5cf6",
  MEMORY: "#10b981",
};
