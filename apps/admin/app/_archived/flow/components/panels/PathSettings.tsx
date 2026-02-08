"use client";

import { useState, useEffect, useCallback } from "react";

interface PathInfo {
  key: string;
  label: string;
  description?: string;
  defaultPath: string | null;
  currentPath: string;
  isOverridden: boolean;
}

interface PathSettingsProps {
  agentId: string;
  onSave?: () => void;
}

export function PathSettings({ agentId, onSave }: PathSettingsProps) {
  const [paths, setPaths] = useState<PathInfo[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch path info for this agent
  const fetchPathInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      const data = await res.json();

      if (data.ok && data.paths?.info) {
        setPaths(data.paths.info);
        // Initialize overrides with current values that differ from defaults
        const initialOverrides: Record<string, string> = {};
        for (const p of data.paths.info) {
          if (p.isOverridden) {
            initialOverrides[p.key] = p.currentPath;
          }
        }
        setOverrides(initialOverrides);
      } else {
        setError(data.error || "Failed to load path info");
      }
    } catch (err) {
      setError("Failed to fetch path configuration");
      console.error("[PathSettings] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchPathInfo();
  }, [fetchPathInfo]);

  // Save path overrides
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      // Filter out empty overrides
      const settingsToSave: Record<string, string> = {};
      for (const [key, value] of Object.entries(overrides)) {
        if (value && value.trim()) {
          settingsToSave[key] = value.trim();
        }
      }

      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: settingsToSave,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        // Refresh the path info
        await fetchPathInfo();
        onSave?.();
      } else {
        setError(data.error || "Failed to save settings");
      }
    } catch (err) {
      setError("Failed to save path settings");
      console.error("[PathSettings] Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset a single path override
  const resetOverride = (key: string) => {
    const newOverrides = { ...overrides };
    delete newOverrides[key];
    setOverrides(newOverrides);
  };

  // Reset all overrides
  const resetAllOverrides = () => {
    setOverrides({});
  };

  // Check if there are unsaved changes
  const hasChanges = () => {
    for (const p of paths) {
      const override = overrides[p.key];
      if (p.isOverridden && !override) return true; // Was overridden, now cleared
      if (!p.isOverridden && override) return true; // Was default, now has override
      if (p.isOverridden && override !== p.currentPath) return true; // Override changed
    }
    return false;
  };

  if (isLoading) {
    return (
      <div
        style={{
          padding: 12,
          textAlign: "center",
          fontSize: 12,
          color: "#6b7280",
        }}
      >
        Loading path settings...
      </div>
    );
  }

  if (paths.length === 0) {
    return (
      <div
        style={{
          padding: 12,
          textAlign: "center",
          fontSize: 12,
          color: "#6b7280",
        }}
      >
        This agent has no configurable paths.
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>
          Path Configuration
        </div>
        {Object.keys(overrides).length > 0 && (
          <button
            onClick={resetAllOverrides}
            style={{
              padding: "4px 8px",
              background: "transparent",
              color: "#6b7280",
              border: "1px solid #d1d5db",
              borderRadius: 4,
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            Reset All
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: "8px 12px",
            background: "#fee2e2",
            color: "#dc2626",
            borderRadius: 6,
            fontSize: 11,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Success message */}
      {saveSuccess && (
        <div
          style={{
            padding: "8px 12px",
            background: "#d1fae5",
            color: "#059669",
            borderRadius: 6,
            fontSize: 11,
            marginBottom: 12,
          }}
        >
          Path settings saved successfully
        </div>
      )}

      {/* Path list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {paths.map((p) => {
          const override = overrides[p.key];
          const displayValue = override !== undefined ? override : (p.isOverridden ? p.currentPath : "");
          const isCurrentlyOverridden = override !== undefined || p.isOverridden;

          return (
            <div
              key={p.key}
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                padding: 12,
              }}
            >
              {/* Label */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 6,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
                    {p.label}
                  </div>
                  {p.description && (
                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                      {p.description}
                    </div>
                  )}
                </div>
                {isCurrentlyOverridden && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "#fef3c7",
                      color: "#92400e",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    Overridden
                  </span>
                )}
              </div>

              {/* Default value */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>
                  System Default
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: "#6b7280",
                    background: "#f3f4f6",
                    padding: "4px 8px",
                    borderRadius: 4,
                    wordBreak: "break-all",
                  }}
                >
                  {p.defaultPath || "(not configured)"}
                </div>
              </div>

              {/* Override input */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 10, color: "#6b7280" }}>Override</div>
                  {isCurrentlyOverridden && (
                    <button
                      onClick={() => resetOverride(p.key)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#dc2626",
                        fontSize: 10,
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      clear
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={displayValue}
                  onChange={(e) =>
                    setOverrides({ ...overrides, [p.key]: e.target.value })
                  }
                  placeholder={p.defaultPath || "Enter custom path..."}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    fontSize: 11,
                    fontFamily: "monospace",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    background: "white",
                    color: "#374151",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isSaving || !hasChanges()}
        style={{
          width: "100%",
          marginTop: 16,
          padding: "10px 16px",
          background: isSaving || !hasChanges() ? "#9ca3af" : "#2563eb",
          color: "white",
          border: "none",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: isSaving || !hasChanges() ? "not-allowed" : "pointer",
        }}
      >
        {isSaving ? "Saving..." : hasChanges() ? "Save Path Overrides" : "No Changes"}
      </button>

      {/* Help text */}
      <div
        style={{
          marginTop: 12,
          fontSize: 10,
          color: "#6b7280",
          lineHeight: 1.4,
        }}
      >
        Path overrides are saved to this agent's instance settings. Leave empty to use the system default.
      </div>
    </div>
  );
}
