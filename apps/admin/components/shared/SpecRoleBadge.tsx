/**
 * SpecRoleBadge Component
 *
 * Displays a visual badge for spec roles with appropriate styling and icons.
 * Used in spec lists, detail pages, and anywhere spec classification is shown.
 */

import React from "react";

type SpecRole =
  | "ORCHESTRATE"
  | "EXTRACT"
  | "SYNTHESISE"
  | "CONSTRAIN"
  | "IDENTITY"
  | "CONTENT"
  | "VOICE"
  | "MEASURE"      // Deprecated
  | "ADAPT"        // Deprecated
  | "REWARD"       // Deprecated
  | "GUARDRAIL"    // Deprecated
  | "BOOTSTRAP";   // Deprecated

interface SpecRoleBadgeProps {
  role: SpecRole | string | null;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showTooltip?: boolean;
  className?: string;
}

const ROLE_CONFIG: Record<
  string,
  {
    label: string;
    icon: string;
    bg: string;
    text: string;
    description: string;
    uiEditor?: string;
  }
> = {
  ORCHESTRATE: {
    label: "Orchestrate",
    icon: "🎯",
    bg: "#dbeafe",
    text: "#1e40af",
    description: "Flow/sequence control → Flow Builder UI",
    uiEditor: "Flow Builder",
  },
  EXTRACT: {
    label: "Extract",
    icon: "🔍",
    bg: "#dcfce7",
    text: "#166534",
    description: "Measurement/learning → Standard spec editor",
    uiEditor: "Standard Editor",
  },
  SYNTHESISE: {
    label: "Synthesise",
    icon: "🧮",
    bg: "#fef3c7",
    text: "#92400e",
    description: "Combine/transform → Formula Builder UI",
    uiEditor: "Formula Builder",
  },
  CONSTRAIN: {
    label: "Constrain",
    icon: "📏",
    bg: "#fee2e2",
    text: "#991b1b",
    description: "Bounds/guards → Rule Editor UI",
    uiEditor: "Rule Editor",
  },
  IDENTITY: {
    label: "Identity",
    icon: "👤",
    bg: "#e0e7ff",
    text: "#4338ca",
    description: "Agent personas → Standard spec editor",
    uiEditor: "Standard Editor",
  },
  CONTENT: {
    label: "Content",
    icon: "📚",
    bg: "#fce7f3",
    text: "#be185d",
    description: "Curriculum → Standard spec editor",
    uiEditor: "Standard Editor",
  },
  VOICE: {
    label: "Voice",
    icon: "🎙️",
    bg: "#e0e7ff",
    text: "#4338ca",
    description: "Voice guidance → Standard spec editor",
    uiEditor: "Standard Editor",
  },
  // Deprecated roles (legacy support)
  MEASURE: {
    label: "Measure (deprecated)",
    icon: "📊",
    bg: "#f3f4f6",
    text: "#6b7280",
    description: "DEPRECATED: Use EXTRACT instead",
    uiEditor: "Standard Editor",
  },
  ADAPT: {
    label: "Adapt (deprecated)",
    icon: "🔄",
    bg: "#f3f4f6",
    text: "#6b7280",
    description: "DEPRECATED: Use SYNTHESISE instead",
    uiEditor: "Standard Editor",
  },
  REWARD: {
    label: "Reward (deprecated)",
    icon: "⭐",
    bg: "#f3f4f6",
    text: "#6b7280",
    description: "DEPRECATED: Use SYNTHESISE instead",
    uiEditor: "Standard Editor",
  },
  GUARDRAIL: {
    label: "Guardrail (deprecated)",
    icon: "🛡️",
    bg: "#f3f4f6",
    text: "#6b7280",
    description: "DEPRECATED: Use CONSTRAIN instead",
    uiEditor: "Standard Editor",
  },
  BOOTSTRAP: {
    label: "Bootstrap (deprecated)",
    icon: "🔄",
    bg: "#f3f4f6",
    text: "#6b7280",
    description: "DEPRECATED: Use ORCHESTRATE instead",
    uiEditor: "Standard Editor",
  },
};

export function SpecRoleBadge({
  role,
  size = "md",
  showIcon = true,
  showTooltip = true,
  className = "",
}: SpecRoleBadgeProps) {
  if (!role) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 ${className}`}
        title="No role assigned"
      >
        <span>—</span>
      </span>
    );
  }

  const config = ROLE_CONFIG[role] || {
    label: role,
    icon: "❓",
    bg: "#f3f4f6",
    text: "#6b7280",
    description: "Unknown role",
  };

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-0.5",
    lg: "text-sm px-2.5 py-1",
  };

  const isDeprecated = role.includes("DEPRECATED") ||
    ["MEASURE", "ADAPT", "REWARD", "GUARDRAIL", "BOOTSTRAP"].includes(role);

  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeClasses[size]} rounded font-medium ${className}`}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        opacity: isDeprecated ? 0.6 : 1,
      }}
      title={showTooltip ? `${config.description}${config.uiEditor ? `\nEditor: ${config.uiEditor}` : ""}` : undefined}
    >
      {showIcon && <span>{config.icon}</span>}
      <span>{config.label}</span>
    </span>
  );
}

/**
 * Helper function to get spec role config
 * Useful for conditional rendering based on role
 */
export function getSpecRoleConfig(role: string | null) {
  if (!role) return null;
  return ROLE_CONFIG[role] || null;
}

/**
 * Check if a spec role requires a special editor
 * NOTE: Disabled for now until special editors are implemented
 */
export function requiresSpecialEditor(role: string | null): boolean {
  if (!role) return false;
  // TODO: Re-enable when special editors exist
  // const specialRoles = ["ORCHESTRATE", "SYNTHESISE", "CONSTRAIN"];
  // return specialRoles.includes(role);
  return false; // Temporarily disabled
}

/**
 * Get the editor route for a spec based on its role
 * NOTE: Returns path-based routes for now. Special editors (flow, formula, rules) are TODO.
 */
export function getSpecEditorRoute(specSlug: string, role: string | null): string {
  // Special routes that exist
  if (specSlug === "PIPELINE-001") return "/x/supervisor";

  // TODO: Implement special editors for these roles:
  // - ORCHESTRATE: /x/specs/${specSlug}/flow (flow builder)
  // - SYNTHESISE: /x/specs/${specSlug}/formula (formula builder)
  // - CONSTRAIN: /x/specs/${specSlug}/rules (rule editor)

  // For now, all specs use the path-based route
  return `/x/specs/${specSlug}`;
}
