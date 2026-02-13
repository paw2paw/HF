"use client";

import { useCallback } from "react";

interface NumberSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberSlider({
  label,
  value,
  onChange,
  disabled,
  min = 0,
  max = 1,
  step = 0.01,
}: NumberSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange],
  );

  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>
          {max === 1 ? `${Math.round(value * 100)}%` : value.toFixed(2)}
        </span>
      </div>
      <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 2,
            background: "var(--border-default, #e5e7eb)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            width: `${pct}%`,
            height: 4,
            borderRadius: 2,
            background: "var(--accent-primary, #4f46e5)",
            transition: "width 0.1s",
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            width: "100%",
            height: 20,
            opacity: 0,
            cursor: disabled ? "not-allowed" : "pointer",
            margin: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `calc(${pct}% - 7px)`,
            width: 14,
            height: 14,
            borderRadius: 7,
            background: disabled ? "var(--border-default)" : "var(--accent-primary, #4f46e5)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 0.1s",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
