"use client";

/**
 * OptionPanel — Claude-style radio/checklist panel that appears above the chat input bar.
 *
 * Supports:
 *   - Radio mode (single-select) — user clicks an option → auto-submits
 *   - Checklist mode (multi-select) — user toggles options → confirms with button
 *   - Sliders mode — personality slider controls
 *   - Upload mode — delegates to PackUploadStep
 *   - Actions mode — primary/secondary action buttons
 *   - Tabbed layout — multiple panels grouped in tabs
 */

import { useState, useCallback, useEffect } from "react";
import { Check, ArrowRight, Rocket, Upload } from "lucide-react";
import type { SliderDef } from "./wizard-schema";

// ── Types ────────────────────────────────────────────────

export interface OptionDef {
  value: string;
  label: string;
  description: string;
  recommended?: boolean;
}

export interface OptionsPanel {
  type: "options";
  question: string;
  dataKey: string;
  mode: "radio" | "checklist";
  options: OptionDef[];
}

export interface SlidersPanel {
  type: "sliders";
  question: string;
  sliders: SliderDef[];
}

export interface UploadPanel {
  type: "upload";
  question: string;
}

export interface ActionsPanel {
  type: "actions";
  question: string;
  primary: { label: string; icon?: string };
  secondary: { label: string; icon?: string };
}

export type PanelConfig = OptionsPanel | SlidersPanel | UploadPanel | ActionsPanel;

export interface TabDef {
  id: string;
  label: string;
  panel: PanelConfig;
}

interface OptionPanelProps {
  /** Single panel or multiple tabs */
  panels: PanelConfig[] | TabDef[];
  /** Whether the panels are tabbed */
  tabbed?: boolean;
  /** Called when user selects an option / submits */
  onSubmit: (dataKey: string, value: unknown, displayText: string) => void;
  /** Called for action buttons */
  onAction?: (action: "primary" | "secondary") => void;
  /** Upload component to render (passed by parent to avoid circular deps) */
  uploadComponent?: React.ReactNode;
}

export function OptionPanel({ panels, tabbed, onSubmit, onAction, uploadComponent }: OptionPanelProps) {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = tabbed ? (panels as TabDef[]) : null;
  const activePanels = tabs ? [tabs[activeTab].panel] : (panels as PanelConfig[]);

  return (
    <div className="gs-option-panel">
      {/* Tab bar */}
      {tabs && tabs.length > 1 && (
        <div className="gs-option-tabs">
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              type="button"
              className={`gs-option-tab${i === activeTab ? " gs-option-tab--active" : ""}`}
              onClick={() => setActiveTab(i)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Panel content */}
      {activePanels.map((panel, i) => (
        <div key={i} className="gs-option-panel-content">
          {panel.type === "options" && (
            <OptionsContent panel={panel} onSubmit={onSubmit} />
          )}
          {panel.type === "sliders" && (
            <SlidersContent panel={panel} onSubmit={onSubmit} />
          )}
          {panel.type === "upload" && (
            <div className="gs-option-upload">
              <div className="gs-option-header">{panel.question}</div>
              {uploadComponent}
            </div>
          )}
          {panel.type === "actions" && (
            <ActionsContent panel={panel} onAction={onAction} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Options (radio / checklist) ─────────────────────────

function OptionsContent({ panel, onSubmit }: { panel: OptionsPanel; onSubmit: OptionPanelProps["onSubmit"] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const isRadio = panel.mode === "radio";

  const handleSelect = useCallback(
    (value: string, label: string) => {
      if (isRadio) {
        // Auto-submit on click for radio
        onSubmit(panel.dataKey, value, label);
      } else {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(value)) next.delete(value);
          else next.add(value);
          return next;
        });
      }
    },
    [isRadio, onSubmit, panel.dataKey],
  );

  const handleConfirm = useCallback(() => {
    const values = Array.from(selected);
    const labels = panel.options
      .filter((o) => selected.has(o.value))
      .map((o) => o.label)
      .join(", ");
    onSubmit(panel.dataKey, values, labels);
  }, [selected, onSubmit, panel.dataKey, panel.options]);

  return (
    <div className="gs-option-group">
      <div className="gs-option-header">{panel.question}</div>
      <div className="gs-option-list">
        {panel.options.map((opt) => {
          const isSelected = selected.has(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              className={`gs-option-item${isSelected ? " gs-option-item--selected" : ""}`}
              onClick={() => handleSelect(opt.value, opt.label)}
            >
              <div className="gs-option-radio">
                {isRadio ? (
                  <div className={`gs-option-radio-dot${isSelected ? " gs-option-radio-dot--active" : ""}`} />
                ) : (
                  <div className={`gs-option-check${isSelected ? " gs-option-check--active" : ""}`}>
                    {isSelected && <Check size={12} />}
                  </div>
                )}
              </div>
              <div className="gs-option-text">
                <div className="gs-option-label">
                  {opt.label}
                  {opt.recommended && <span className="gs-option-rec">(Recommended)</span>}
                </div>
                <div className="gs-option-desc">{opt.description}</div>
              </div>
            </button>
          );
        })}
      </div>
      {!isRadio && selected.size > 0 && (
        <button type="button" className="hf-btn hf-btn-primary gs-option-confirm" onClick={handleConfirm}>
          Confirm ({selected.size})
        </button>
      )}
    </div>
  );
}

// ── Sliders ─────────────────────────────────────────────

function SlidersContent({ panel, onSubmit }: { panel: SlidersPanel; onSubmit: OptionPanelProps["onSubmit"] }) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(panel.sliders.map((s) => [s.key, 50])),
  );

  const handleChange = useCallback((key: string, val: number) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleApply = useCallback(() => {
    onSubmit("behaviorTargets", values, "Personality configured");
  }, [values, onSubmit]);

  return (
    <div className="gs-option-group">
      <div className="gs-option-header">{panel.question}</div>
      <div className="gs-option-sliders">
        {panel.sliders.map((s) => (
          <div key={s.key} className="gs-option-slider-row">
            <div className="gs-option-slider-labels">
              <span className="gs-option-slider-end">{s.low}</span>
              <span className="gs-option-slider-center">{s.label}</span>
              <span className="gs-option-slider-end">{s.high}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={values[s.key] ?? 50}
              onChange={(e) => handleChange(s.key, Number(e.target.value))}
              className="gs-option-slider-input"
            />
          </div>
        ))}
      </div>
      <button type="button" className="hf-btn hf-btn-primary gs-option-confirm" onClick={handleApply}>
        Apply
      </button>
    </div>
  );
}

// ── Actions ─────────────────────────────────────────────

function ActionsContent({ panel, onAction }: { panel: ActionsPanel; onAction?: OptionPanelProps["onAction"] }) {
  const getIcon = (name?: string) => {
    switch (name) {
      case "Rocket": return <Rocket size={16} />;
      case "ArrowRight": return <ArrowRight size={16} />;
      case "Upload": return <Upload size={16} />;
      default: return null;
    }
  };

  return (
    <div className="gs-option-group">
      <div className="gs-option-header">{panel.question}</div>
      <div className="gs-option-actions">
        <button
          type="button"
          className="hf-btn hf-btn-primary gs-option-action"
          onClick={() => onAction?.("primary")}
        >
          {getIcon(panel.primary.icon)}
          {panel.primary.label}
        </button>
        <button
          type="button"
          className="hf-btn hf-btn-secondary gs-option-action"
          onClick={() => onAction?.("secondary")}
        >
          {getIcon(panel.secondary.icon)}
          {panel.secondary.label}
        </button>
      </div>
    </div>
  );
}
