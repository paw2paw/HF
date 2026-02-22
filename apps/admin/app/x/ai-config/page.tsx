"use client";

import { useState, useEffect, useCallback } from "react";
import { FancySelect } from "@/components/shared/FancySelect";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";
import { useSession } from "next-auth/react";

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
  transcriptLimit: number | null;
  isActive: boolean;
  isCustomized: boolean;
  savedId: string | null;
  updatedAt: string | null;
  defaultProvider: string;
  defaultModel: string;
  defaultTranscriptLimit: number | null;
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

interface KeyStatus {
  envVar: string;
  configured: boolean;
  masked: string | null;
  fromEnv: boolean;
}

// Provider styling - using CSS variables for theme support
const PROVIDER_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  claude: { bg: "var(--badge-purple-bg)", text: "var(--badge-purple-text)", border: "var(--badge-purple-text)" },
  openai: { bg: "var(--badge-green-bg)", text: "var(--badge-green-text)", border: "var(--badge-green-text)" },
  mock: { bg: "var(--status-neutral-bg)", text: "var(--status-neutral-text)", border: "var(--border-default)" },
};

// Tier badges - using CSS variables for theme support
const TIER_STYLES: Record<string, { bg: string; text: string }> = {
  flagship: { bg: "var(--badge-yellow-bg)", text: "var(--badge-yellow-text)" },
  standard: { bg: "var(--status-neutral-bg)", text: "var(--status-neutral-text)" },
  fast: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text)" },
  test: { bg: "var(--badge-green-bg)", text: "var(--badge-green-text)" },
  premium: { bg: "var(--badge-yellow-bg)", text: "var(--badge-yellow-text)" },
  free: { bg: "var(--badge-green-bg)", text: "var(--badge-green-text)" },
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
  const [search, setSearch] = useState("");

  const { data: session } = useSession();
  const isOperator = ["OPERATOR", "EDUCATOR", "ADMIN", "SUPERADMIN"].includes((session?.user?.role as string) || "");

  // Models management state
  const [showModelsManager, setShowModelsManager] = useState(false);
  const [allModels, setAllModels] = useState<AIModelRecord[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModelRecord | null>(null);
  const [newModel, setNewModel] = useState({ modelId: "", provider: "claude", label: "", tier: "standard" });

  // API Keys management state
  const [keyStatus, setKeyStatus] = useState<Record<string, KeyStatus>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null); // provider id
  const [newKeyValue, setNewKeyValue] = useState("");
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [keyTestResult, setKeyTestResult] = useState<{ provider: string; valid: boolean; message: string } | null>(null);

  // Filter configs by search term
  const filteredConfigs = configs.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const models = availableModels?.[c.provider as keyof AvailableModels] || [];
    const modelLabel = models.find((m) => m.id === c.model)?.label || "";
    return (
      c.label.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.callPoint.toLowerCase().includes(q) ||
      c.provider.toLowerCase().includes(q) ||
      c.model.toLowerCase().includes(q) ||
      modelLabel.toLowerCase().includes(q)
    );
  });

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
    updates: { provider?: string; model?: string; transcriptLimit?: number | null }
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
          transcriptLimit: updates.transcriptLimit !== undefined ? updates.transcriptLimit : current.transcriptLimit,
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

  // Fetch API key status
  const fetchKeyStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-keys");
      const data = await res.json();
      if (data.ok) {
        setKeyStatus(data.keys);
      }
    } catch {
      // Silently fail - keys are optional
    }
  }, []);

  // Open models manager
  const openModelsManager = () => {
    setShowModelsManager(true);
    fetchModels();
    fetchKeyStatus();
  };

  // Save API key
  const saveApiKey = async (provider: string) => {
    if (!newKeyValue.trim()) {
      setError("API key cannot be empty");
      return;
    }

    try {
      const res = await fetch("/api/ai-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key: newKeyValue }),
      });

      const data = await res.json();
      if (data.ok) {
        setSuccessMessage(data.message);
        setEditingKey(null);
        setNewKeyValue("");
        fetchKeyStatus();
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to save API key");
    }
  };

  // Test API key
  const testApiKey = async (provider: string, key?: string) => {
    setTestingKey(provider);
    setKeyTestResult(null);

    try {
      const res = await fetch("/api/ai-keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          ...(key ? { key } : {}), // Only include key if explicitly provided
        }),
      });

      const data = await res.json();
      setKeyTestResult({
        provider,
        valid: data.valid,
        message: data.message,
      });
    } catch {
      setKeyTestResult({
        provider,
        valid: false,
        message: "Failed to test key",
      });
    } finally {
      setTestingKey(null);
    }
  };

  // Delete API key
  const deleteApiKey = async (provider: string) => {
    if (!confirm(`Remove ${provider} API key from .env.local?`)) return;

    try {
      const res = await fetch(`/api/ai-keys?provider=${provider}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.ok) {
        setSuccessMessage(data.message);
        fetchKeyStatus();
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to delete API key");
    }
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
          <div style={{ fontSize: 24, color: "var(--text-muted)" }}>Loading AI configurations...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <AdvancedBanner />
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="hf-page-title">AI Model Configuration</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
            Configure which AI provider and model to use for each operation. Changes take effect
            immediately at runtime.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <a
            href="/x/ai-knowledge"
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "var(--surface-primary)",
              color: "var(--text-primary)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              textDecoration: "none",
            }}
          >
            🧠 AI Knowledge
          </a>
          <button
            onClick={openModelsManager}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "var(--surface-primary)",
              color: "var(--text-primary)",
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
      </div>

      {/* Models Manager Section */}
      {showModelsManager && (
        <div
          style={{
            background: "var(--surface-secondary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>Available AI Models</h2>
            <button
              onClick={() => setShowModelsManager(false)}
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
          </div>

          {loadingModels ? (
            <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>Loading models...</div>
          ) : (
            <>
              {/* Add New Model Form */}
              <div
                style={{
                  background: "var(--surface-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px 0", color: "var(--text-primary)" }}>Add New Model</h3>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
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
                        border: "1px solid var(--border-default)",
                        background: "var(--surface-secondary)",
                        color: "var(--text-primary)",
                        fontSize: 13,
                        width: 220,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
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
                        border: "1px solid var(--border-default)",
                        background: "var(--surface-secondary)",
                        color: "var(--text-primary)",
                        fontSize: 13,
                        width: 150,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
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
                    <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
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
                      background: "var(--accent-primary)",
                      color: "var(--accent-primary-text)",
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

                    {/* API Key Management */}
                    {provider.id !== "mock" && (
                      <div
                        style={{
                          background: "var(--surface-primary)",
                          border: `1px solid ${keyStatus[provider.id]?.configured ? "var(--status-success-text)" : "var(--status-warning-text)"}`,
                          borderRadius: 6,
                          padding: "10px 12px",
                          marginBottom: 10,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: keyStatus[provider.id]?.configured ? "var(--status-success-text)" : "var(--status-warning-text)",
                            }}
                          />
                          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
                            {keyStatus[provider.id]?.envVar || `${provider.id.toUpperCase()}_API_KEY`}:
                          </span>
                          {keyStatus[provider.id]?.configured ? (
                            <code
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                background: "var(--surface-tertiary)",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}
                            >
                              {keyStatus[provider.id]?.masked}
                            </code>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--status-warning-text)", fontStyle: "italic" }}>
                              Not configured
                            </span>
                          )}
                        </div>

                        {editingKey === provider.id ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              type="password"
                              value={newKeyValue}
                              onChange={(e) => setNewKeyValue(e.target.value)}
                              placeholder="Paste API key..."
                              style={{
                                padding: "5px 10px",
                                borderRadius: 4,
                                border: "1px solid var(--border-default)",
                                background: "var(--surface-secondary)",
                                color: "var(--text-primary)",
                                fontSize: 12,
                                width: 280,
                              }}
                            />
                            <button
                              onClick={() => saveApiKey(provider.id)}
                              style={{
                                padding: "5px 10px",
                                borderRadius: 4,
                                border: "none",
                                background: "var(--button-success-bg)",
                                color: "var(--button-primary-text)",
                                fontSize: 11,
                                fontWeight: 500,
                                cursor: "pointer",
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => { setEditingKey(null); setNewKeyValue(""); }}
                              style={{
                                padding: "5px 10px",
                                borderRadius: 4,
                                border: "1px solid var(--border-default)",
                                background: "var(--surface-primary)",
                                color: "var(--text-muted)",
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => setEditingKey(provider.id)}
                              style={{
                                padding: "5px 10px",
                                borderRadius: 4,
                                border: "1px solid var(--border-default)",
                                background: "var(--surface-primary)",
                                color: "var(--text-primary)",
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              {keyStatus[provider.id]?.configured ? "Update" : "Add Key"}
                            </button>
                            {keyStatus[provider.id]?.configured && (
                              <>
                                <button
                                  onClick={() => testApiKey(provider.id)}
                                  disabled={testingKey === provider.id}
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: 4,
                                    border: "1px solid var(--border-default)",
                                    background: "var(--surface-primary)",
                                    color: "var(--text-primary)",
                                    fontSize: 11,
                                    cursor: testingKey === provider.id ? "wait" : "pointer",
                                    opacity: testingKey === provider.id ? 0.6 : 1,
                                  }}
                                >
                                  {testingKey === provider.id ? "Testing..." : "Test"}
                                </button>
                                <button
                                  onClick={() => deleteApiKey(provider.id)}
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: 4,
                                    border: `1px solid var(--status-error-border)`,
                                    background: "var(--status-error-bg)",
                                    color: "var(--status-error-text)",
                                    fontSize: 11,
                                    cursor: "pointer",
                                  }}
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Test result */}
                        {keyTestResult?.provider === provider.id && (
                          <div
                            style={{
                              width: "100%",
                              marginTop: 4,
                              padding: "6px 10px",
                              borderRadius: 4,
                              background: keyTestResult.valid ? "var(--status-success-bg)" : "var(--status-error-bg)",
                              color: keyTestResult.valid ? "var(--status-success-text)" : "var(--status-error-text)",
                              fontSize: 12,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span>{keyTestResult.valid ? "✓" : "✗"}</span>
                            <span>{keyTestResult.message}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <h4
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        margin: "0 0 6px 0",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Models
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
                              background: model.isActive ? "var(--surface-primary)" : "var(--surface-tertiary)",
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
                                    border: "1px solid var(--border-default)",
                                    background: "var(--surface-secondary)",
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
                                    color: "var(--button-primary-text)",
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
                                    border: "1px solid var(--border-default)",
                                    background: "var(--surface-primary)",
                                    color: "var(--text-primary)",
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
                                    background: "var(--surface-tertiary)",
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
                                    border: "1px solid var(--border-default)",
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
                                    border: `1px solid var(--border-default)`,
                                    background: model.isActive ? "var(--status-error-bg)" : "var(--status-success-bg)",
                                    fontSize: 11,
                                    cursor: "pointer",
                                    color: model.isActive ? "var(--status-error-text)" : "var(--status-success-text)",
                                  }}
                                >
                                  {model.isActive ? "Disable" : "Enable"}
                                </button>
                                {isOperator && (
                                  <button
                                    onClick={() => deleteModel(model.modelId)}
                                    className="hf-btn hf-btn-destructive"
                                    style={{ padding: "4px 8px", fontSize: 11 }}
                                  >
                                    Delete
                                  </button>
                                )}
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

      {/* Provider Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 20,
          padding: 12,
          background: "var(--surface-secondary)",
          borderRadius: 8,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Providers:</span>
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

      {/* Search */}
      <div style={{ marginBottom: 16, position: "relative" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search configs by name, description, provider, model..."
          style={{
            width: "100%",
            padding: "10px 14px 10px 36px",
            borderRadius: 8,
            border: "1px solid var(--border-default)",
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
            fontSize: 15,
            pointerEvents: "none",
          }}
        >
          &#x2315;
        </span>
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              color: "var(--text-muted)",
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        )}
      </div>

      {/* Result count when filtering */}
      {search.trim() && (
        <div style={{ marginBottom: 12, fontSize: 13, color: "var(--text-secondary)" }}>
          {filteredConfigs.length} of {configs.length} configurations match &ldquo;{search.trim()}&rdquo;
        </div>
      )}

      {/* Configuration Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredConfigs.map((config) => {
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
                background: "var(--surface-primary)",
                border: `1px solid ${config.isCustomized ? providerStyle.border : "var(--border-default)"}`,
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
                    <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>{config.label}</span>
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
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>{config.description}</p>
                </div>

                {/* Right: Controls */}
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {/* Provider Selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                      PROVIDER
                    </label>
                    <FancySelect
                      value={config.provider}
                      onChange={(v) => updateConfig(config.callPoint, { provider: v })}
                      disabled={isSaving}
                      searchable={false}
                      style={{ minWidth: 100 }}
                      selectedStyle={{ border: `1px solid ${providerStyle.border}`, background: providerStyle.bg }}
                      options={[
                        { value: "claude", label: "Claude" },
                        { value: "openai", label: "OpenAI" },
                        { value: "mock", label: "Mock" },
                      ]}
                    />
                  </div>

                  {/* Model Selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>MODEL</label>
                    <FancySelect
                      value={config.model}
                      onChange={(v) => updateConfig(config.callPoint, { model: v })}
                      disabled={isSaving}
                      searchable={models.length > 5}
                      style={{ minWidth: 180 }}
                      options={models.map((m) => ({ value: m.id, label: m.label }))}
                    />
                  </div>

                  {/* Transcript Limit (only for pipeline stages that use transcripts) */}
                  {config.defaultTranscriptLimit && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                        TRANSCRIPT LIMIT
                      </label>
                      <input
                        type="number"
                        value={config.transcriptLimit ?? config.defaultTranscriptLimit ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value, 10) : null;
                          updateConfig(config.callPoint, { transcriptLimit: val });
                        }}
                        disabled={isSaving}
                        placeholder={String(config.defaultTranscriptLimit)}
                        min={500}
                        max={50000}
                        step={500}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--border-default)",
                          background: "var(--surface-secondary)",
                          color: "var(--text-primary)",
                          fontSize: 13,
                          width: 90,
                        }}
                        title={`Characters of transcript to include. Default: ${config.defaultTranscriptLimit}`}
                      />
                    </div>
                  )}

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
                        border: "1px solid var(--border-default)",
                        background: "var(--surface-secondary)",
                        fontSize: 12,
                        cursor: "pointer",
                        color: "var(--text-muted)",
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
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                  Using default: {config.defaultProvider} / {config.defaultModel}
                </div>
              )}

              {/* Last updated */}
              {config.updatedAt && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
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
          background: "var(--status-info-bg)",
          border: "1px solid var(--status-info-border)",
          borderRadius: 8,
          fontSize: 13,
          color: "var(--status-info-text)",
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
