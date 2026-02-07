"use client";

import { useState, useEffect, useCallback } from "react";

// =====================================================
// TYPES
// =====================================================

interface AIConfig {
  callPoint: string;
  label: string;
  description: string;
  provider: string;
  model: string;
  maxTokens: number | null;
  temperature: number | null;
  isActive: boolean;
  isCustomized: boolean;
  savedId: string | null;
  updatedAt: string | null;
  defaultProvider: string;
  defaultModel: string;
}

interface ModelOption {
  id: string;
  label: string;
  tier: string;
}

interface AvailableModels {
  claude: ModelOption[];
  openai: ModelOption[];
  mock: ModelOption[];
  [key: string]: ModelOption[];
}

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
  claude: { bg: "#fdf4ff", text: "#9333ea", border: "#d8b4fe" },
  openai: { bg: "#ecfdf5", text: "#059669", border: "#6ee7b7" },
  mock: { bg: "#f3f4f6", text: "#6b7280", border: "#d1d5db" },
};

// Tier badges
const TIER_STYLES: Record<string, { bg: string; text: string }> = {
  flagship: { bg: "#fef3c7", text: "#d97706" },
  standard: { bg: "#f3f4f6", text: "#374151" },
  fast: { bg: "#dbeafe", text: "#2563eb" },
  test: { bg: "#d1fae5", text: "#059669" },
  premium: { bg: "#fef3c7", text: "#d97706" },
  free: { bg: "#d1fae5", text: "#059669" },
};

// =====================================================
// COMPONENT
// =====================================================

export default function AIConfigPage() {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [availableModels, setAvailableModels] = useState<AvailableModels | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Models management state
  const [showModelsManager, setShowModelsManager] = useState(false);
  const [allModels, setAllModels] = useState<AIModelRecord[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModelRecord | null>(null);
  const [newModel, setNewModel] = useState({ modelId: "", provider: "claude", label: "", tier: "standard" });

  // Fetch configurations
  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-config");
      const data = await res.json();
      if (data.ok) {
        setConfigs(data.configs);
        setAvailableModels(data.availableModels);
      } else {
        setError(data.error || "Failed to fetch configurations");
      }
    } catch {
      setError("Failed to fetch AI configurations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // Update a configuration
  const updateConfig = async (
    callPoint: string,
    updates: { provider?: string; model?: string }
  ) => {
    setSaving(callPoint);
    setSuccessMessage(null);

    const current = configs.find((c) => c.callPoint === callPoint);
    if (!current) return;

    const newProvider = updates.provider ?? current.provider;
    let newModel = updates.model ?? current.model;

    // If provider changed, pick first model of new provider
    if (updates.provider && updates.provider !== current.provider) {
      const models = availableModels?.[updates.provider as keyof AvailableModels];
      newModel = models?.[0]?.id ?? newModel;
    }

    try {
      const res = await fetch("/api/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callPoint,
          provider: newProvider,
          model: newModel,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSuccessMessage(data.message);
        await fetchConfigs();
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to update configuration");
    } finally {
      setSaving(null);
    }
  };

  // Reset to default
  const resetToDefault = async (callPoint: string) => {
    setSaving(callPoint);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/ai-config?callPoint=${callPoint}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.ok) {
        setSuccessMessage(data.message);
        await fetchConfigs();
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to reset configuration");
    } finally {
      setSaving(null);
    }
  };

  // Fetch all models for management
  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const res = await fetch("/api/ai-models?includeInactive=true");
      const data = await res.json();
      if (data.ok) {
        setAllModels(data.models);
        setProviders(data.providers);
      }
    } catch {
      setError("Failed to fetch models");
    } finally {
      setLoadingModels(false);
    }
  }, []);

  // Open models manager
  const openModelsManager = () => {
    setShowModelsManager(true);
    fetchModels();
  };

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
        fetchConfigs(); // Refresh available models in config dropdowns
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
        fetchConfigs();
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
        fetchConfigs();
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

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 24, color: "#6b7280" }}>Loading AI configurations...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>AI Model Configuration</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Configure which AI provider and model to use for each operation. Changes take effect
            immediately at runtime.
          </p>
        </div>
        <button
          onClick={openModelsManager}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "white",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>Manage Models</span>
          <span style={{ fontSize: 16 }}>{showModelsManager ? "▼" : "▶"}</span>
        </button>
      </div>

      {/* Models Manager Section */}
      {showModelsManager && (
        <div
          style={{
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Available AI Models</h2>
            <button
              onClick={() => setShowModelsManager(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 20,
                color: "#6b7280",
              }}
            >
              &times;
            </button>
          </div>

          {loadingModels ? (
            <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>Loading models...</div>
          ) : (
            <>
              {/* Add New Model Form */}
              <div
                style={{
                  background: "white",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px 0" }}>Add New Model</h3>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
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
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                        width: 220,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
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
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                        width: 150,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                      PROVIDER
                    </label>
                    <select
                      value={newModel.provider}
                      onChange={(e) => setNewModel({ ...newModel, provider: e.target.value })}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                        width: 100,
                      }}
                    >
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                      TIER
                    </label>
                    <select
                      value={newModel.tier}
                      onChange={(e) => setNewModel({ ...newModel, tier: e.target.value })}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                        width: 100,
                      }}
                    >
                      <option value="flagship">Flagship</option>
                      <option value="standard">Standard</option>
                      <option value="fast">Fast</option>
                      <option value="test">Test</option>
                    </select>
                  </div>
                  <button
                    onClick={addModel}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      border: "none",
                      background: "#3b82f6",
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
                              background: model.isActive ? "white" : "#f3f4f6",
                              border: "1px solid #e5e7eb",
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
                                    border: "1px solid #d1d5db",
                                    fontSize: 13,
                                    width: 150,
                                  }}
                                />
                                <select
                                  value={editingModel.tier}
                                  onChange={(e) =>
                                    setEditingModel({ ...editingModel, tier: e.target.value })
                                  }
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    border: "1px solid #d1d5db",
                                    fontSize: 12,
                                  }}
                                >
                                  <option value="flagship">Flagship</option>
                                  <option value="standard">Standard</option>
                                  <option value="fast">Fast</option>
                                  <option value="test">Test</option>
                                </select>
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
                                    background: "#10b981",
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
                                    border: "1px solid #d1d5db",
                                    background: "white",
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
                                    color: "#6b7280",
                                    background: "#f3f4f6",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                  }}
                                >
                                  {model.modelId}
                                </code>
                                <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
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
                                    border: "1px solid #d1d5db",
                                    background: "white",
                                    fontSize: 11,
                                    cursor: "pointer",
                                    color: "#6b7280",
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => toggleModelActive(model)}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    border: "1px solid #d1d5db",
                                    background: model.isActive ? "#fef2f2" : "#f0fdf4",
                                    fontSize: 11,
                                    cursor: "pointer",
                                    color: model.isActive ? "#dc2626" : "#16a34a",
                                  }}
                                >
                                  {model.isActive ? "Disable" : "Enable"}
                                </button>
                                <button
                                  onClick={() => deleteModel(model.modelId)}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    border: "1px solid #fecaca",
                                    background: "#fef2f2",
                                    fontSize: 11,
                                    cursor: "pointer",
                                    color: "#dc2626",
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
      )}

      {/* Status Messages */}
      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            color: "#dc2626",
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
              color: "#dc2626",
            }}
          >
            &times;
          </button>
        </div>
      )}

      {successMessage && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            color: "#16a34a",
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
              color: "#16a34a",
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Provider Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 20,
          padding: 12,
          background: "#f9fafb",
          borderRadius: 8,
        }}
      >
        <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Providers:</span>
        {Object.entries(PROVIDER_STYLES).map(([provider, style]) => (
          <div
            key={provider}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: style.bg,
                border: `1px solid ${style.border}`,
              }}
            />
            <span style={{ fontSize: 13, color: style.text, fontWeight: 500 }}>
              {provider.charAt(0).toUpperCase() + provider.slice(1)}
            </span>
          </div>
        ))}
      </div>

      {/* Configuration Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {configs.map((config) => {
          const providerStyle = PROVIDER_STYLES[config.provider] || PROVIDER_STYLES.mock;
          const models = availableModels?.[config.provider as keyof AvailableModels] || [];
          const currentModel = models.find((m) => m.id === config.model);
          const tierStyle = currentModel
            ? TIER_STYLES[currentModel.tier] || TIER_STYLES.standard
            : TIER_STYLES.standard;
          const isSaving = saving === config.callPoint;

          return (
            <div
              key={config.callPoint}
              style={{
                background: "white",
                border: `1px solid ${config.isCustomized ? providerStyle.border : "#e5e7eb"}`,
                borderRadius: 8,
                padding: 16,
                opacity: isSaving ? 0.7 : 1,
                transition: "opacity 0.2s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                {/* Left: Label and Description */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{config.label}</span>
                    {config.isCustomized && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: providerStyle.bg,
                          color: providerStyle.text,
                          fontWeight: 500,
                        }}
                      >
                        Customized
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{config.description}</p>
                </div>

                {/* Right: Controls */}
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {/* Provider Selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>
                      PROVIDER
                    </label>
                    <select
                      value={config.provider}
                      onChange={(e) => updateConfig(config.callPoint, { provider: e.target.value })}
                      disabled={isSaving}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: `1px solid ${providerStyle.border}`,
                        background: providerStyle.bg,
                        color: providerStyle.text,
                        fontWeight: 500,
                        fontSize: 13,
                        cursor: "pointer",
                        minWidth: 100,
                      }}
                    >
                      <option value="claude">Claude</option>
                      <option value="openai">OpenAI</option>
                      <option value="mock">Mock</option>
                    </select>
                  </div>

                  {/* Model Selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>MODEL</label>
                    <select
                      value={config.model}
                      onChange={(e) => updateConfig(config.callPoint, { model: e.target.value })}
                      disabled={isSaving}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        background: "white",
                        fontSize: 13,
                        cursor: "pointer",
                        minWidth: 180,
                      }}
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tier Badge */}
                  {currentModel && (
                    <div
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        background: tierStyle.bg,
                        color: tierStyle.text,
                        fontSize: 11,
                        fontWeight: 500,
                        textTransform: "uppercase",
                      }}
                    >
                      {currentModel.tier}
                    </div>
                  )}

                  {/* Reset Button */}
                  {config.isCustomized && (
                    <button
                      onClick={() => resetToDefault(config.callPoint)}
                      disabled={isSaving}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #e5e7eb",
                        background: "#f9fafb",
                        fontSize: 12,
                        cursor: "pointer",
                        color: "#6b7280",
                      }}
                      title={`Reset to default: ${config.defaultProvider} / ${config.defaultModel}`}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Default hint */}
              {!config.isCustomized && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af" }}>
                  Using default: {config.defaultProvider} / {config.defaultModel}
                </div>
              )}

              {/* Last updated */}
              {config.updatedAt && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af" }}>
                  Last updated: {new Date(config.updatedAt).toLocaleString()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 8,
          fontSize: 13,
          color: "#0369a1",
        }}
      >
        <strong>How it works:</strong> These settings are loaded at runtime by the AI client. When
        an operation runs (e.g., Pipeline MEASURE), it looks up the configuration for that call
        point and uses the specified provider and model. If no custom configuration exists, the
        system default is used.
      </div>
    </div>
  );
}
