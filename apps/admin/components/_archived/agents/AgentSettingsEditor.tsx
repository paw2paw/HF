"use client";

import { useState, useCallback, useMemo } from "react";

// JSON Schema types
interface JsonSchema {
  type?: "object" | "string" | "number" | "integer" | "boolean" | "array";
  title?: string;
  description?: string;
  default?: any;
  enum?: any[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  minimum?: number;
  maximum?: number;
  $ref?: string;
}

interface AgentSettingsEditorProps {
  agentId: string;
  agentTitle: string;
  schema?: JsonSchema;
  settings: Record<string, any>;
  onChange: (settings: Record<string, any>) => void;
  disabled?: boolean;
}

// Helper to resolve $ref placeholders (simplified - just strips the ref for now)
function resolveSchema(schema: JsonSchema | undefined): JsonSchema | undefined {
  if (!schema) return undefined;
  if (schema.$ref) {
    // In real implementation, would resolve $ref from a definitions object
    // For now, just return a basic string type
    return { type: "string", title: schema.$ref.split("/").pop() };
  }
  return schema;
}

// Get effective value considering defaults
function getEffectiveValue(settings: Record<string, any>, key: string, schema?: JsonSchema): any {
  if (Object.prototype.hasOwnProperty.call(settings, key)) {
    return settings[key];
  }
  return schema?.default;
}

// Determine UI control type from schema
function getControlType(schema?: JsonSchema): "boolean" | "number" | "string" | "enum" | "array" | "object" {
  if (!schema) return "string";
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return "enum";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "number" || schema.type === "integer") return "number";
  if (schema.type === "array") return "array";
  if (schema.type === "object") return "object";
  return "string";
}

// Individual field components
function BooleanField({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ padding: 16, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{label}</div>
          {description && (
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, lineHeight: 1.4 }}>
              {description}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => !disabled && onChange(!value)}
          disabled={disabled}
          style={{
            position: "relative",
            width: 48,
            height: 26,
            borderRadius: 13,
            border: "none",
            background: value ? "#10b981" : "#d1d5db",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
            transition: "background 0.15s ease",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: value ? 25 : 3,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              transition: "left 0.15s ease",
            }}
          />
        </button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  description,
  value,
  onChange,
  disabled,
  min,
  max,
  defaultValue,
}: {
  label: string;
  description?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  defaultValue?: number;
}) {
  const hasRange = min !== undefined && max !== undefined;
  const displayValue = value ?? defaultValue ?? 0;
  const isDefault = value === undefined || value === defaultValue;

  return (
    <div style={{ padding: 16, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{label}</span>
            {!isDefault && (
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  background: "#fef3c7",
                  color: "#92400e",
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                MODIFIED
              </span>
            )}
          </div>
          {description && (
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, lineHeight: 1.4 }}>
              {description}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <input
            type="number"
            value={displayValue}
            min={min}
            max={max}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                onChange(undefined);
              } else {
                const n = parseFloat(v);
                if (!isNaN(n)) onChange(n);
              }
            }}
            style={{
              width: 80,
              padding: "6px 10px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 13,
              textAlign: "right",
              fontWeight: 600,
              color: isDefault ? "#6b7280" : "#1f2937",
            }}
          />
          {defaultValue !== undefined && !isDefault && (
            <button
              onClick={() => onChange(defaultValue)}
              disabled={disabled}
              style={{
                padding: "4px 8px",
                background: "#f3f4f6",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                fontSize: 10,
                color: "#6b7280",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
              title={`Reset to default: ${defaultValue}`}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Slider for ranged numbers */}
      {hasRange && (
        <div style={{ marginTop: 8 }}>
          <input
            type="range"
            min={min}
            max={max}
            value={displayValue}
            disabled={disabled}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            style={{
              width: "100%",
              height: 6,
              borderRadius: 3,
              appearance: "none",
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((displayValue - (min || 0)) / ((max || 100) - (min || 0))) * 100}%, #e5e7eb ${((displayValue - (min || 0)) / ((max || 100) - (min || 0))) * 100}%, #e5e7eb 100%)`,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "#9ca3af" }}>{min}</span>
            <span style={{ fontSize: 10, color: "#9ca3af" }}>{max}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StringField({
  label,
  description,
  value,
  onChange,
  disabled,
  defaultValue,
  placeholder,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  const isDefault = value === defaultValue || (value === "" && defaultValue === undefined);

  return (
    <div style={{ padding: 16, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{label}</span>
        {!isDefault && (
          <span
            style={{
              fontSize: 9,
              padding: "2px 6px",
              background: "#fef3c7",
              color: "#92400e",
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            MODIFIED
          </span>
        )}
      </div>
      {description && (
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, lineHeight: 1.4 }}>
          {description}
        </div>
      )}
      <input
        type="text"
        value={value}
        placeholder={placeholder || defaultValue}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1px solid #d1d5db",
          borderRadius: 6,
          fontSize: 13,
          color: "#1f2937",
          background: disabled ? "#f9fafb" : "#fff",
        }}
      />
    </div>
  );
}

function EnumField({
  label,
  description,
  value,
  options,
  onChange,
  disabled,
  defaultValue,
}: {
  label: string;
  description?: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
  defaultValue?: string;
}) {
  const isDefault = value === defaultValue;

  return (
    <div style={{ padding: 16, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{label}</span>
        {!isDefault && (
          <span
            style={{
              fontSize: 9,
              padding: "2px 6px",
              background: "#fef3c7",
              color: "#92400e",
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            MODIFIED
          </span>
        )}
      </div>
      {description && (
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, lineHeight: 1.4 }}>
          {description}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => !disabled && onChange(opt)}
            disabled={disabled}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: value === opt ? "2px solid #3b82f6" : "1px solid #d1d5db",
              background: value === opt ? "#eff6ff" : "#fff",
              color: value === opt ? "#1e40af" : "#374151",
              fontSize: 12,
              fontWeight: value === opt ? 600 : 400,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
              transition: "all 0.15s ease",
            }}
          >
            {opt}
            {opt === defaultValue && (
              <span style={{ marginLeft: 6, fontSize: 10, color: "#9ca3af" }}>(default)</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ArrayField({
  label,
  description,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: any[];
  options?: string[];
  onChange: (v: any[]) => void;
  disabled?: boolean;
}) {
  // For enum arrays, show multi-select checkboxes
  if (options && options.length > 0) {
    return (
      <div style={{ padding: 16, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>{label}</div>
        {description && (
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12, lineHeight: 1.4 }}>
            {description}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {options.map((opt) => {
            const isSelected = Array.isArray(value) && value.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  if (disabled) return;
                  if (isSelected) {
                    onChange(value.filter((v) => v !== opt));
                  } else {
                    onChange([...(Array.isArray(value) ? value : []), opt]);
                  }
                }}
                disabled={disabled}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: isSelected ? "2px solid #10b981" : "1px solid #d1d5db",
                  background: isSelected ? "#ecfdf5" : "#fff",
                  color: isSelected ? "#047857" : "#374151",
                  fontSize: 12,
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: isSelected ? "none" : "2px solid #d1d5db",
                    background: isSelected ? "#10b981" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 20 20" fill="white">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // For generic arrays, show JSON editor
  return (
    <div style={{ padding: 16, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>{label}</div>
      {description && (
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, lineHeight: 1.4 }}>
          {description}
        </div>
      )}
      <textarea
        value={JSON.stringify(value || [], null, 2)}
        disabled={disabled}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            if (Array.isArray(parsed)) onChange(parsed);
          } catch {
            // Ignore invalid JSON
          }
        }}
        rows={4}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1px solid #d1d5db",
          borderRadius: 6,
          fontSize: 12,
          fontFamily: "monospace",
          resize: "vertical",
        }}
      />
    </div>
  );
}

// Main editor component
export function AgentSettingsEditor({
  agentId,
  agentTitle,
  schema,
  settings,
  onChange,
  disabled = false,
}: AgentSettingsEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["main"]));

  // Parse schema properties
  const fields = useMemo(() => {
    if (!schema?.properties) return [];

    return Object.entries(schema.properties)
      .map(([key, rawSchema]) => {
        const fieldSchema = resolveSchema(rawSchema);
        return {
          key,
          schema: fieldSchema,
          label: fieldSchema?.title || key,
          description: fieldSchema?.description,
          controlType: getControlType(fieldSchema),
          value: getEffectiveValue(settings, key, fieldSchema),
          defaultValue: fieldSchema?.default,
          min: fieldSchema?.minimum,
          max: fieldSchema?.maximum,
          options: fieldSchema?.enum || (fieldSchema?.items?.enum),
        };
      })
      .sort((a, b) => {
        // Sort booleans first, then enums, then numbers, then strings
        const order = { boolean: 0, enum: 1, number: 2, string: 3, array: 4, object: 5 };
        const aOrder = order[a.controlType] ?? 6;
        const bOrder = order[b.controlType] ?? 6;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.label.localeCompare(b.label);
      });
  }, [schema, settings]);

  // Group fields by type
  const toggleFields = fields.filter((f) => f.controlType === "boolean");
  const enumFields = fields.filter((f) => f.controlType === "enum");
  const numberFields = fields.filter((f) => f.controlType === "number");
  const stringFields = fields.filter((f) => f.controlType === "string");
  const arrayFields = fields.filter((f) => f.controlType === "array");
  const otherFields = fields.filter((f) => f.controlType === "object");

  const handleChange = useCallback(
    (key: string, value: any) => {
      onChange({ ...settings, [key]: value });
    },
    [settings, onChange]
  );

  if (!schema?.properties || fields.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          background: "#f9fafb",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 14, color: "#6b7280" }}>
          No configurable settings for this agent.
        </div>
        {Object.keys(settings).length > 0 && (
          <details style={{ marginTop: 16, textAlign: "left" }}>
            <summary style={{ fontSize: 12, color: "#9ca3af", cursor: "pointer" }}>
              View raw settings
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 11,
                overflow: "auto",
              }}
            >
              {JSON.stringify(settings, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toggle switches section */}
      {toggleFields.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "#6b7280",
              marginBottom: 8,
              letterSpacing: "0.05em",
            }}
          >
            Feature Toggles
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {toggleFields.map((field) => (
              <BooleanField
                key={field.key}
                label={field.label}
                description={field.description}
                value={Boolean(field.value)}
                onChange={(v) => handleChange(field.key, v)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Enum selections section */}
      {enumFields.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "#6b7280",
              marginBottom: 8,
              letterSpacing: "0.05em",
            }}
          >
            Options
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {enumFields.map((field) => (
              <EnumField
                key={field.key}
                label={field.label}
                description={field.description}
                value={String(field.value ?? "")}
                options={(field.options || []).map(String)}
                onChange={(v) => handleChange(field.key, v)}
                disabled={disabled}
                defaultValue={field.defaultValue ? String(field.defaultValue) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Number inputs section */}
      {numberFields.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "#6b7280",
              marginBottom: 8,
              letterSpacing: "0.05em",
            }}
          >
            Parameters
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 8 }}>
            {numberFields.map((field) => (
              <NumberField
                key={field.key}
                label={field.label}
                description={field.description}
                value={typeof field.value === "number" ? field.value : undefined}
                onChange={(v) => handleChange(field.key, v)}
                disabled={disabled}
                min={field.min}
                max={field.max}
                defaultValue={typeof field.defaultValue === "number" ? field.defaultValue : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* String inputs section */}
      {stringFields.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "#6b7280",
              marginBottom: 8,
              letterSpacing: "0.05em",
            }}
          >
            Paths & Text
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stringFields.map((field) => (
              <StringField
                key={field.key}
                label={field.label}
                description={field.description}
                value={String(field.value ?? "")}
                onChange={(v) => handleChange(field.key, v)}
                disabled={disabled}
                defaultValue={field.defaultValue ? String(field.defaultValue) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Array inputs section */}
      {arrayFields.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "#6b7280",
              marginBottom: 8,
              letterSpacing: "0.05em",
            }}
          >
            Multi-Select
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {arrayFields.map((field) => (
              <ArrayField
                key={field.key}
                label={field.label}
                description={field.description}
                value={Array.isArray(field.value) ? field.value : []}
                options={(field.options || []).map(String)}
                onChange={(v) => handleChange(field.key, v)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Object/other fields section */}
      {otherFields.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "#6b7280",
              marginBottom: 8,
              letterSpacing: "0.05em",
            }}
          >
            Advanced
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {otherFields.map((field) => (
              <div
                key={field.key}
                style={{ padding: 16, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", marginBottom: 4 }}>
                  {field.label}
                </div>
                {field.description && (
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
                    {field.description}
                  </div>
                )}
                <textarea
                  value={JSON.stringify(field.value || {}, null, 2)}
                  disabled={disabled}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      handleChange(field.key, parsed);
                    } catch {
                      // Ignore invalid JSON
                    }
                  }}
                  rows={6}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: "monospace",
                    resize: "vertical",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentSettingsEditor;
