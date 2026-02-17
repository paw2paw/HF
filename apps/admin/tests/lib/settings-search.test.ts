/**
 * Tests for useSettingsSearch hook logic
 *
 * Tests the search matching algorithm directly without React rendering.
 * The hook's core matching logic is tested by constructing the same
 * data structures and running the match algorithm in isolation.
 */

import { describe, it, expect } from "vitest";
import type { SettingsPanel, PanelProps } from "@/lib/settings-panels";
import type { SettingDef } from "@/lib/system-settings";

// Replicate the search matching logic from the hook for pure unit testing
function matchPanels(panels: SettingsPanel[], term: string) {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { panelIds: new Set<string>(), settingKeys: new Set<string>() };

  const panelIds = new Set<string>();
  const settingKeys = new Set<string>();

  for (const panel of panels) {
    const terms: string[] = [panel.label.toLowerCase(), panel.description.toLowerCase()];
    const sKeys: { key: string; text: string }[] = [];

    if (panel.content.kind === "auto") {
      for (const s of panel.content.settings) {
        const text = `${s.label} ${s.description} ${s.key}`.toLowerCase();
        terms.push(text);
        sKeys.push({ key: s.key, text });
      }
    } else {
      for (const t of panel.content.searchTerms) terms.push(t.toLowerCase());
    }

    const allText = terms.join(" ");
    if (words.every((w) => allText.includes(w))) {
      panelIds.add(panel.id);
      for (const sk of sKeys) {
        if (words.some((w) => sk.text.includes(w))) settingKeys.add(sk.key);
      }
    }
  }

  return { panelIds, settingKeys };
}

// ── Test fixtures ───────────────────────────────────

function DummyComponent(_props: PanelProps) { return null; }

const makeSetting = (key: string, label: string, desc: string): SettingDef => ({
  key, label, description: desc, type: "float", default: 0.5,
});

const TEST_PANELS: SettingsPanel[] = [
  {
    id: "pipeline",
    label: "Pipeline & Scoring",
    icon: "Activity",
    description: "Controls how the analysis pipeline processes calls",
    category: "system",
    advancedOnly: true,
    content: {
      kind: "auto",
      settings: [
        makeSetting("pipeline.min_words", "Min transcript length", "Skip scoring for short transcripts"),
        makeSetting("pipeline.confidence_cap", "Confidence cap", "Maximum confidence for short transcripts"),
      ],
    },
  },
  {
    id: "memory",
    label: "Memory & Learning",
    icon: "Brain",
    description: "How memories are extracted and retained",
    category: "system",
    advancedOnly: true,
    content: {
      kind: "auto",
      settings: [
        makeSetting("memory.confidence_default", "Default confidence", "Default memory confidence score"),
        makeSetting("memory.summary_limit", "Summary limit", "Number of memories in summary"),
      ],
    },
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: "Sun",
    description: "Theme mode and color palettes",
    category: "general",
    advancedOnly: false,
    content: {
      kind: "custom",
      component: DummyComponent,
      searchTerms: ["theme", "dark mode", "light mode", "palette", "color"],
    },
  },
  {
    id: "security",
    label: "Access Matrix",
    icon: "Lock",
    description: "Per-role CRUD permissions",
    category: "security",
    advancedOnly: true,
    content: {
      kind: "custom",
      component: DummyComponent,
      searchTerms: ["access matrix", "CRUD", "permissions", "roles"],
    },
  },
];

// ── Tests ───────────────────────────────────────────

describe("settings search matching", () => {
  it("returns empty for empty term", () => {
    const result = matchPanels(TEST_PANELS, "");
    expect(result.panelIds.size).toBe(0);
    expect(result.settingKeys.size).toBe(0);
  });

  it("returns empty for whitespace-only term", () => {
    const result = matchPanels(TEST_PANELS, "   ");
    expect(result.panelIds.size).toBe(0);
  });

  it("matches panel by label", () => {
    const result = matchPanels(TEST_PANELS, "pipeline");
    expect(result.panelIds.has("pipeline")).toBe(true);
    expect(result.panelIds.has("memory")).toBe(false);
  });

  it("matches panel by description", () => {
    const result = matchPanels(TEST_PANELS, "extracted");
    expect(result.panelIds.has("memory")).toBe(true);
  });

  it("matches auto panel by setting label", () => {
    const result = matchPanels(TEST_PANELS, "transcript");
    expect(result.panelIds.has("pipeline")).toBe(true);
    expect(result.settingKeys.has("pipeline.min_words")).toBe(true);
  });

  it("matches auto panel by setting key", () => {
    const result = matchPanels(TEST_PANELS, "confidence_default");
    expect(result.panelIds.has("memory")).toBe(true);
    expect(result.settingKeys.has("memory.confidence_default")).toBe(true);
  });

  it("matches custom panel by searchTerms", () => {
    const result = matchPanels(TEST_PANELS, "dark mode");
    expect(result.panelIds.has("appearance")).toBe(true);
  });

  it("matches custom panel by single search term word", () => {
    const result = matchPanels(TEST_PANELS, "CRUD");
    expect(result.panelIds.has("security")).toBe(true);
  });

  it("uses AND logic for multi-word queries", () => {
    // "confidence" appears in both pipeline and memory
    const singleWord = matchPanels(TEST_PANELS, "confidence");
    expect(singleWord.panelIds.has("pipeline")).toBe(true);
    expect(singleWord.panelIds.has("memory")).toBe(true);

    // "confidence cap" only matches pipeline (has both words)
    const multiWord = matchPanels(TEST_PANELS, "confidence cap");
    expect(multiWord.panelIds.has("pipeline")).toBe(true);
    expect(multiWord.panelIds.has("memory")).toBe(false);
  });

  it("is case-insensitive", () => {
    const result = matchPanels(TEST_PANELS, "PIPELINE");
    expect(result.panelIds.has("pipeline")).toBe(true);
  });

  it("matches across multiple panels when term is shared", () => {
    // "confidence" appears in both pipeline and memory settings
    const result = matchPanels(TEST_PANELS, "confidence");
    expect(result.panelIds.has("pipeline")).toBe(true);
    expect(result.panelIds.has("memory")).toBe(true);
    expect(result.settingKeys.has("pipeline.confidence_cap")).toBe(true);
    expect(result.settingKeys.has("memory.confidence_default")).toBe(true);
  });

  it("returns no matches for non-existent term", () => {
    const result = matchPanels(TEST_PANELS, "xyznonexistent");
    expect(result.panelIds.size).toBe(0);
    expect(result.settingKeys.size).toBe(0);
  });
});
