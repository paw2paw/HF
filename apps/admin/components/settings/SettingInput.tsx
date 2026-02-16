"use client";

import { type SettingDef } from "@/lib/system-settings";

interface SettingInputProps {
  setting: SettingDef;
  value: number | boolean | string;
  onChange: (value: number | boolean | string) => void;
  highlighted?: boolean;
}

export function SettingInput({ setting, value, onChange, highlighted }: SettingInputProps) {
  const highlightStyle = highlighted
    ? { background: "color-mix(in srgb, var(--accent-primary) 6%, transparent)", borderRadius: 8, margin: "0 -8px", padding: "12px 8px" }
    : { padding: "12px 0" };

  if (setting.type === "text") {
    return (
      <div style={{ ...highlightStyle, borderBottom: "1px solid var(--border-default)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
            {setting.label}
          </label>
          <input
            type="text"
            value={String(value ?? setting.default)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={setting.placeholder}
            style={{
              width: 200,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: "var(--surface-secondary)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          />
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          {setting.description}
          {setting.default ? (
            <span style={{ fontStyle: "italic", marginLeft: 6, opacity: 0.7 }}>
              (default: {String(setting.default)})
            </span>
          ) : null}
        </p>
      </div>
    );
  }

  if (setting.type === "textarea") {
    return (
      <div style={{ ...highlightStyle, borderBottom: "1px solid var(--border-default)" }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4, display: "block" }}>
          {setting.label}
        </label>
        <textarea
          value={String(value ?? setting.default)}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--border-default)",
            background: "var(--surface-secondary)",
            color: "var(--text-primary)",
            fontSize: 13,
            fontFamily: "inherit",
            resize: "vertical",
            lineHeight: 1.5,
          }}
        />
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
          {setting.description}
        </p>
      </div>
    );
  }

  if (setting.type === "bool") {
    return (
      <div style={{ ...highlightStyle, borderBottom: "1px solid var(--border-default)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{setting.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {setting.description}
              <span style={{ fontStyle: "italic", marginLeft: 6, opacity: 0.7 }}>
                (default: {String(setting.default)})
              </span>
            </div>
          </div>
          <button
            onClick={() => onChange(!value)}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: "none",
              background: value ? "var(--accent-primary)" : "var(--surface-tertiary)",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.15s ease",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "white",
                position: "absolute",
                top: 3,
                left: value ? 23 : 3,
                transition: "left 0.15s ease",
              }}
            />
          </button>
        </div>
      </div>
    );
  }

  // int / float
  return (
    <div style={{ ...highlightStyle, borderBottom: "1px solid var(--border-default)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
          {setting.label}
        </label>
        <input
          type="number"
          value={value as number}
          onChange={(e) => onChange(Number(e.target.value))}
          min={setting.min}
          max={setting.max}
          step={setting.step ?? 1}
          style={{
            width: 90,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--border-default)",
            background: "var(--surface-secondary)",
            color: "var(--text-primary)",
            fontSize: 13,
            textAlign: "right",
          }}
        />
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
        {setting.description}
        <span style={{ fontStyle: "italic", marginLeft: 6, opacity: 0.7 }}>
          (default: {setting.default})
        </span>
      </p>
    </div>
  );
}
