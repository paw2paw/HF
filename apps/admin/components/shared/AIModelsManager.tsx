"use client";

import { useState, useEffect, useCallback } from "react";
import { FancySelect } from "@/components/shared/FancySelect";

// =====================================================
// TYPES
// =====================================================

interface AIModelRecord {
  id: string;
  modelId: string;
  provider: string;
  label: string;
  tier: string;
  isActive: boolean;
  sortOrder: number;
}

interface Provider {
  id: string;
  label: string;
  color: string;
}

// Provider styling
const PROVIDER_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  claude: { bg: "var(--badge-purple-bg, #fdf4ff)", text: "var(--badge-purple-text, #9333ea)", border: "var(--badge-purple-border, #d8b4fe)" },
  openai: { bg: "var(--badge-green-bg, #ecfdf5)", text: "var(--badge-green-text, #059669)", border: "var(--badge-green-border, #6ee7b7)" },
  mock: { bg: "var(--badge-gray-bg, #f3f4f6)", text: "var(--badge-gray-text, #6b7280)", border: "var(--badge-gray-border, #d1d5db)" },
};

// Tier badges
const TIER_STYLES: Record<string, { bg: string; text: string }> = {
  flagship: { bg: "var(--badge-amber-bg, #fef3c7)", text: "var(--badge-amber-text, #d97706)" },
  standard: { bg: "var(--surface-secondary)", text: "var(--text-primary)" },
  fast: { bg: "var(--badge-blue-bg, #dbeafe)", text: "var(--badge-blue-text, #2563eb)" },
  test: { bg: "var(--badge-green-bg, #d1fae5)", text: "var(--badge-green-text, #059669)" },
  premium: { bg: "var(--badge-amber-bg, #fef3c7)", text: "var(--badge-amber-text, #d97706)" },
  free: { bg: "var(--badge-green-bg, #d1fae5)", text: "var(--badge-green-text, #059669)" },
};

// =====================================================
// COMPONENT
// =====================================================

interface AIModelsManagerProps {
  onClose?: () => void;
  showHeader?: boolean;
}

export function AIModelsManager({ onClose, showHeader = true }: AIModelsManagerProps) {
  const [allModels, setAllModels] = useState<AIModelRecord[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingModel, setEditingModel] = useState<AIModelRecord | null>(null);
  const [newModel, setNewModel] = useState({ modelId: "", provider: "claude", label: "", tier: "standard" });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch all models
  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-models?includeInactive=true");
      const data = await res.json();
      if (data.ok) {
        setAllModels(data.models);
        setProviders(data.providers);
      } else {
        setError(data.error || "Failed to fetch models");
      }
    } catch {
      setError("Failed to fetch models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Add new model
  const addModel = async () => {
    if (!newModel.modelId || !newModel.label) {
      setError("Model ID and Label are required");
      return;
    }

    try {
      const res = await fetch("/api/ai-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newModel),
      });

      const data = await res.json();
      if (data.ok) {
        setSuccessMessage(`Added model "${newModel.label}"`);
        setNewModel({ modelId: "", provider: "claude", label: "", tier: "standard" });
        fetchModels();
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to add model");
    }
  };

  // Update model
  const updateModel = async (modelId: string, updates: Partial<AIModelRecord>) => {
    try {
      const res = await fetch(`/api/ai-models/${modelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (data.ok) {
        setSuccessMessage(`Updated model "${modelId}"`);
        setEditingModel(null);
        fetchModels();
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to update model");
    }
  };

  // Delete model
  const deleteModel = async (modelId: string) => {
    if (!confirm(`Delete model "${modelId}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/ai-models/${modelId}`, { method: "DELETE" });
      const data = await res.json();

      if (data.ok) {
        setSuccessMessage(`Deleted model "${modelId}"`);
        fetchModels();
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to delete model");
    }
  };

  // Toggle model active status
  const toggleModelActive = async (model: AIModelRecord) => {
    await updateModel(model.modelId, { isActive: !model.isActive });
  };

  // Clear messages after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div
      style={{
        background: "var(--surface-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      {showHeader && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
            Manage AI Models
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 20,
                color: "var(--text-muted)",
              }}
            >
              &times;
            </button>
          )}
        </div>
      )}

      {/* Status Messages */}
      {error && (
        <div
          style={{
            background: "var(--status-error-bg)",
            border: "1px solid var(--status-error-border)",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            color: "var(--status-error-text)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "var(--status-error-text)",
            }}
          >
            &times;
          </button>
        </div>
      )}

      {successMessage && (
        <div
          style={{
            background: "var(--status-success-bg)",
            border: "1px solid var(--status-success-border)",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            color: "var(--status-success-text)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "var(--status-success-text)",
            }}
          >
            &times;
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>Loading models...</div>
      ) : (
        <>
          {/* Add New Model Form */}
          <div
            style={{
              background: "var(--background)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px 0", color: "var(--text-primary)" }}>
              Add New Model
            </h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                  MODEL ID *
                </label>
                <input
                  type="text"
                  value={newModel.modelId}
                  onChange={(e) => setNewModel({ ...newModel, modelId: e.target.value })}
                  placeholder="e.g., claude-3-opus-20240229"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--input-border)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    width: 220,
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                  LABEL *
                </label>
                <input
                  type="text"
                  value={newModel.label}
                  onChange={(e) => setNewModel({ ...newModel, label: e.target.value })}
                  placeholder="e.g., Claude 3 Opus"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--input-border)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    width: 150,
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                  PROVIDER
                </label>
                <FancySelect
                  value={newModel.provider}
                  onChange={(v) => setNewModel({ ...newModel, provider: v })}
                  searchable={false}
                  style={{ minWidth: 100 }}
                  options={providers.map((p) => ({ value: p.id, label: p.label }))}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                  TIER
                </label>
                <FancySelect
                  value={newModel.tier}
                  onChange={(v) => setNewModel({ ...newModel, tier: v })}
                  searchable={false}
                  style={{ minWidth: 100 }}
                  options={[
                    { value: "flagship", label: "Flagship" },
                    { value: "standard", label: "Standard" },
                    { value: "fast", label: "Fast" },
                    { value: "test", label: "Test" },
                  ]}
                />
              </div>
              <button
                onClick={addModel}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--button-primary-bg)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Add Model
              </button>
            </div>
          </div>

          {/* Models List by Provider */}
          {providers.map((provider) => {
            const providerModels = allModels.filter((m) => m.provider === provider.id);
            if (providerModels.length === 0) return null;

            const providerStyle = PROVIDER_STYLES[provider.id] || PROVIDER_STYLES.mock;

            return (
              <div key={provider.id} style={{ marginBottom: 16 }}>
                <h4
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    margin: "0 0 8px 0",
                    color: providerStyle.text,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: providerStyle.bg,
                      border: `1px solid ${providerStyle.border}`,
                    }}
                  />
                  {provider.label}
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {providerModels.map((model) => {
                    const tierStyle = TIER_STYLES[model.tier] || TIER_STYLES.standard;
                    const isEditing = editingModel?.modelId === model.modelId;

                    return (
                      <div
                        key={model.modelId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "8px 12px",
                          background: model.isActive ? "var(--surface-primary)" : "var(--surface-secondary)",
                          border: "1px solid var(--border-default)",
                          borderRadius: 6,
                          opacity: model.isActive ? 1 : 0.6,
                        }}
                      >
                        {isEditing ? (
                          <>
                            <input
                              type="text"
                              value={editingModel.label}
                              onChange={(e) =>
                                setEditingModel({ ...editingModel, label: e.target.value })
                              }
                              style={{
                                padding: "4px 8px",
                                borderRadius: 4,
                                border: "1px solid var(--input-border)",
                                background: "var(--input-bg)",
                                color: "var(--text-primary)",
                                fontSize: 13,
                                width: 150,
                              }}
                            />
                            <FancySelect
                              value={editingModel.tier}
                              onChange={(v) => setEditingModel({ ...editingModel, tier: v })}
                              searchable={false}
                              style={{ minWidth: 100 }}
                              options={[
                                { value: "flagship", label: "Flagship" },
                                { value: "standard", label: "Standard" },
                                { value: "fast", label: "Fast" },
                                { value: "test", label: "Test" },
                              ]}
                            />
                            <button
                              onClick={() =>
                                updateModel(model.modelId, {
                                  label: editingModel.label,
                                  tier: editingModel.tier,
                                })
                              }
                              style={{
                                padding: "4px 10px",
                                borderRadius: 4,
                                border: "none",
                                background: "var(--button-success-bg)",
                                color: "white",
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingModel(null)}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 4,
                                border: "1px solid var(--input-border)",
                                background: "var(--surface-primary)",
                                color: "var(--text-secondary)",
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <code
                              style={{
                                fontSize: 12,
                                color: "var(--text-muted)",
                                background: "var(--surface-secondary)",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}
                            >
                              {model.modelId}
                            </code>
                            <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: "var(--text-primary)" }}>
                              {model.label}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: tierStyle.bg,
                                color: tierStyle.text,
                                fontWeight: 500,
                                textTransform: "uppercase",
                              }}
                            >
                              {model.tier}
                            </span>
                            <button
                              onClick={() => setEditingModel(model)}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 4,
                                border: "1px solid var(--input-border)",
                                background: "var(--surface-primary)",
                                fontSize: 11,
                                cursor: "pointer",
                                color: "var(--text-muted)",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleModelActive(model)}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 4,
                                border: "1px solid var(--input-border)",
                                background: model.isActive ? "var(--status-error-bg)" : "var(--status-success-bg)",
                                fontSize: 11,
                                cursor: "pointer",
                                color: model.isActive ? "var(--status-error-text)" : "var(--status-success-text)",
                              }}
                            >
                              {model.isActive ? "Disable" : "Enable"}
                            </button>
                            <button
                              onClick={() => deleteModel(model.modelId)}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 4,
                                border: "1px solid var(--status-error-border)",
                                background: "var(--status-error-bg)",
                                fontSize: 11,
                                cursor: "pointer",
                                color: "var(--status-error-text)",
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
