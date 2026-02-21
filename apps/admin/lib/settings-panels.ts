/**
 * Unified Settings Panel Registry
 *
 * Combines auto-rendered panels (from SETTINGS_REGISTRY) with
 * custom panels (Appearance, Channels, Security, Fallbacks).
 *
 * Adding a new SettingGroup to SETTINGS_REGISTRY auto-registers
 * it here under the "system" category by default.
 */

import type { ComponentType } from "react";
import { type SettingGroup, type SettingDef, SETTINGS_REGISTRY } from "@/lib/system-settings";

// ── Categories ──────────────────────────────────────

export type SettingsCategory =
  | "general"
  | "system"
  | "ai"
  | "communications"
  | "security"
  | "developer";

export const CATEGORY_META: Record<SettingsCategory, { label: string; order: number }> = {
  general:        { label: "General",        order: 0 },
  system:         { label: "System",         order: 1 },
  ai:             { label: "AI",             order: 2 },
  communications: { label: "Communications", order: 3 },
  security:       { label: "Security",       order: 4 },
  developer:      { label: "Developer",      order: 5 },
};

// ── Panel types ─────────────────────────────────────

export interface PanelProps {
  values: Record<string, number | boolean | string>;
  fallbackValues: Record<string, unknown>;
  loaded: boolean;
  updateSetting: (key: string, value: number | boolean | string) => void;
  updateFallback: (key: string, value: unknown) => void;
}

interface AutoContent {
  kind: "auto";
  settings: SettingDef[];
}

interface CustomContent {
  kind: "custom";
  component: ComponentType<PanelProps>;
  searchTerms: string[];
}

export type PanelContent = AutoContent | CustomContent;

export interface SettingsPanel {
  id: string;
  label: string;
  icon: string;
  description: string;
  category: SettingsCategory;
  advancedOnly: boolean;
  content: PanelContent;
}

// ── Category mapping for auto panels ────────────────
// Exported so the UI can display and override these assignments.
// DB overrides stored as system setting `settings.panel_categories` (JSON object).

export const DEFAULT_CATEGORY_MAP: Record<string, SettingsCategory> = {
  pipeline: "system",
  memory: "system",
  goals: "system",
  cache: "system",
  trust: "ai",
  ai_learning: "ai",
  knowledge: "ai",
  email: "communications",
  demo: "developer",
  actions: "system",
  defaults: "system",
  agent_tuning: "ai",
};

// Non-advanced panels (shown in simple mode)
export const SIMPLE_PANEL_IDS = new Set(["appearance", "email"]);

// ── Build auto panels from SETTINGS_REGISTRY ────────

function buildAutoPanels(
  categoryOverrides?: Record<string, SettingsCategory>,
): SettingsPanel[] {
  const merged = { ...DEFAULT_CATEGORY_MAP, ...categoryOverrides };
  return SETTINGS_REGISTRY.map((group: SettingGroup) => ({
    id: group.id,
    label: group.label,
    icon: group.icon,
    description: group.description,
    category: merged[group.id] ?? "system",
    advancedOnly: !SIMPLE_PANEL_IDS.has(group.id),
    content: { kind: "auto" as const, settings: group.settings },
  }));
}

// ── Register custom panels ──────────────────────────

export function registerCustomPanel(
  id: string,
  label: string,
  icon: string,
  description: string,
  category: SettingsCategory,
  component: ComponentType<PanelProps>,
  searchTerms: string[],
  advancedOnly = true,
): SettingsPanel {
  return {
    id,
    label,
    icon,
    description,
    category,
    advancedOnly,
    content: { kind: "custom", component, searchTerms },
  };
}

// ── Build the complete registry ─────────────────────
// Custom panels are positioned by category + insertion order.
// Call this function from the consuming component, passing custom components.

export function buildPanelRegistry(
  customPanels: SettingsPanel[],
  categoryOverrides?: Record<string, SettingsCategory>,
): SettingsPanel[] {
  const autoPanels = buildAutoPanels(categoryOverrides);
  const all = [...customPanels, ...autoPanels];

  // Sort by category order, preserving insertion order within each category
  const categoryOrder = (p: SettingsPanel) => CATEGORY_META[p.category]?.order ?? 99;
  return all.sort((a, b) => categoryOrder(a) - categoryOrder(b));
}

// ── Icon map ────────────────────────────────────────
// Shared icon map used by SettingsGroupPanel and SettingsSidebar.
// Import the actual lucide components in the consuming file.

export const ICON_NAMES = [
  "Activity", "Brain", "Target", "ShieldCheck", "Sparkles",
  "Gauge", "Shield", "Camera", "Mail", "Search", "Phone",
  "Sun", "Lock", "Zap", "Sliders",
] as const;

// ── Helpers ─────────────────────────────────────────

/** Group panels by category (preserving order) */
export function groupByCategory(panels: SettingsPanel[]): Map<SettingsCategory, SettingsPanel[]> {
  const map = new Map<SettingsCategory, SettingsPanel[]>();
  for (const panel of panels) {
    const existing = map.get(panel.category) ?? [];
    existing.push(panel);
    map.set(panel.category, existing);
  }
  return map;
}
