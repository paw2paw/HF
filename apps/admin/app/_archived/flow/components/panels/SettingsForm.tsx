"use client";

import { useState, useEffect } from "react";

type SchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  default?: any;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  items?: { type?: string; enum?: string[] };
};

type SettingsSchema = {
  type?: string;
  properties?: Record<string, SchemaProperty>;
};

interface SettingsFormProps {
  schema: SettingsSchema | null;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  disabled?: boolean;
}

export function SettingsForm({ schema, values, onChange, disabled }: SettingsFormProps) {
  if (!schema?.properties) {
    return (
      <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>
        No configurable settings
      </div>
    );
  }

  const properties = schema.properties;

  const handleChange = (key: string, value: any) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Object.entries(properties).map(([key, prop]) => (
        <SettingField
          key={key}
          name={key}
          property={prop}
          value={values[key] ?? prop.default}
          onChange={(v) => handleChange(key, v)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

interface SettingFieldProps {
  name: string;
  property: SchemaProperty;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}

function SettingField({ name, property, value, onChange, disabled }: SettingFieldProps) {
  const label = property.title || name;
  const description = property.description;
  const type = property.type || "string";

  const inputStyles: React.CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    fontSize: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    background: disabled ? "#f9fafb" : "white",
    color: disabled ? "#9ca3af" : "#374151",
  };

  const renderInput = () => {
    // Enum dropdown
    if (property.enum) {
      return (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={inputStyles}
        >
          {property.enum.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    // Boolean checkbox
    if (type === "boolean") {
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            style={{ width: 16, height: 16 }}
          />
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            {value ? "Enabled" : "Disabled"}
          </span>
        </label>
      );
    }

    // Number input
    if (type === "number" || type === "integer") {
      return (
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? undefined : Number(v));
          }}
          min={property.minimum}
          max={property.maximum}
          disabled={disabled}
          style={inputStyles}
        />
      );
    }

    // Array of strings (simple comma-separated for now)
    if (type === "array" && property.items?.type === "string") {
      const arrValue = Array.isArray(value) ? value : [];

      // If items have enum, show multi-select checkboxes
      if (property.items.enum) {
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {property.items.enum.map((opt) => (
              <label
                key={opt}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  cursor: "pointer",
                  padding: "4px 8px",
                  background: arrValue.includes(opt) ? "#dbeafe" : "#f3f4f6",
                  borderRadius: 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={arrValue.includes(opt)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...arrValue, opt]);
                    } else {
                      onChange(arrValue.filter((v: string) => v !== opt));
                    }
                  }}
                  disabled={disabled}
                  style={{ width: 12, height: 12 }}
                />
                {opt}
              </label>
            ))}
          </div>
        );
      }

      // Plain text input for comma-separated values
      return (
        <input
          type="text"
          value={arrValue.join(", ")}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v ? v.split(",").map((s) => s.trim()) : []);
          }}
          placeholder="comma, separated, values"
          disabled={disabled}
          style={inputStyles}
        />
      );
    }

    // Default: string input
    return (
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={disabled}
        style={inputStyles}
      />
    );
  };

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
        {label}
      </div>
      {renderInput()}
      {description && (
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
          {description}
        </div>
      )}
    </div>
  );
}
