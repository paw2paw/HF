"use client";

import {
  Activity, Brain, Target, ShieldCheck, Sparkles,
  Gauge, Shield, Camera, Mail, Search, Phone, Building2,
} from "lucide-react";
import { type SettingDef } from "@/lib/system-settings";
import type { SettingsPanel } from "@/lib/settings-panels";
import { SettingInput } from "./SettingInput";
import { EmailPreviewPanel } from "./EmailPreviewPanel";

// ── Icon map ────────────────────────────────────────

const GROUP_ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Activity, Brain, Target, ShieldCheck, Sparkles, Gauge, Shield, Camera, Mail, Search, Phone, Building2,
};

// ── Props ───────────────────────────────────────────

interface SettingsGroupPanelProps {
  panel: SettingsPanel;
  values: Record<string, number | boolean | string>;
  loaded: boolean;
  updateSetting: (key: string, value: number | boolean | string) => void;
  highlightedKeys?: Set<string>;
}

// ── Component ───────────────────────────────────────

export function SettingsGroupPanel({
  panel,
  values,
  loaded,
  updateSetting,
  highlightedKeys,
}: SettingsGroupPanelProps) {
  if (panel.content.kind !== "auto") return null;

  const settings = panel.content.settings;
  const getVal = (s: SettingDef) => values[s.key] ?? s.default;
  const Icon = GROUP_ICONS[panel.icon];

  return (
    <>
      <div
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ color: "var(--text-muted)" }}>
            {Icon ? <Icon size={18} strokeWidth={1.5} /> : null}
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            {panel.label}
          </h2>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          {panel.description}
        </p>

        {!loaded ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading...</p>
        ) : (
          <div>
            {settings.map((s) => (
              <SettingInput
                key={s.key}
                setting={s}
                value={getVal(s)}
                onChange={(v) => updateSetting(s.key, v)}
                highlighted={highlightedKeys?.has(s.key)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Email section gets preview panel below */}
      {panel.id === "email" && loaded && (
        <EmailPreviewPanel values={values} />
      )}
    </>
  );
}
