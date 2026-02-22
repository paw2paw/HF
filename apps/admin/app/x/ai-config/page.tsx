"use client";

import { useState, useEffect, useCallback } from "react";
import { FancySelect } from "@/components/shared/FancySelect";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";
import { useSession } from "next-auth/react";
import "./ai-config.css";

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
      <div className="aic-page">
        <div className="aic-loading">
          <div className="aic-loading-text">Loading AI configurations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="aic-page">
      <AdvancedBanner />
      {/* Header */}
      <div className="aic-header">
        <div>
          <h1 className="hf-page-title">AI Model Configuration</h1>
          <p className="aic-header-subtitle">
            Configure which AI provider and model to use for each operation. Changes take effect
            immediately at runtime.
          </p>
        </div>
        <div className="aic-header-actions">
          <a href="/x/ai-knowledge" className="aic-header-btn">
            🧠 AI Knowledge
          </a>
          <button onClick={openModelsManager} className="aic-header-btn">
            <span>Manage Models</span>
            <span className="aic-toggle-icon">{showModelsManager ? "▼" : "▶"}</span>
          </button>
        </div>
      </div>

      {/* Models Manager Section */}
      {showModelsManager && (
        <div className="aic-models-panel">
          <div className="aic-models-header">
            <h2 className="aic-models-title">Available AI Models</h2>
            <button onClick={() => setShowModelsManager(false)} className="aic-close-btn">
              &times;
            </button>
          </div>

          {loadingModels ? (
            <div className="aic-models-loading">Loading models...</div>
          ) : (
            <>
              {/* Add New Model Form */}
              <div className="aic-add-model-form">
                <h3 className="aic-add-model-title">Add New Model</h3>
                <div className="aic-add-model-fields">
                  <div>
                    <label className="aic-field-label">
                      MODEL ID *
                    </label>
                    <input
                      type="text"
                      value={newModel.modelId}
                      onChange={(e) => setNewModel({ ...newModel, modelId: e.target.value })}
                      placeholder="e.g., claude-3-opus-20240229"
                      className="aic-field-input aic-field-input-model-id"
                    />
                  </div>
                  <div>
                    <label className="aic-field-label">
                      LABEL *
                    </label>
                    <input
                      type="text"
                      value={newModel.label}
                      onChange={(e) => setNewModel({ ...newModel, label: e.target.value })}
                      placeholder="e.g., Claude 3 Opus"
                      className="aic-field-input aic-field-input-label"
                    />
                  </div>
                  <div>
                    <label className="aic-field-label">
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
                    <label className="aic-field-label">
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
                  <button onClick={addModel} className="aic-add-model-btn">
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
                  <div key={provider.id} className="aic-provider-section">
                    <h4
                      className="aic-provider-heading"
                      style={{ color: providerStyle.text }}
                    >
                      <span
                        className="aic-provider-dot"
                        style={{ background: providerStyle.bg, border: `1px solid ${providerStyle.border}` }}
                      />
                      {provider.label}
                    </h4>

                    {/* API Key Management */}
                    {provider.id !== "mock" && (
                      <div
                        className="aic-key-row"
                        style={{ borderColor: keyStatus[provider.id]?.configured ? "var(--status-success-text)" : "var(--status-warning-text)" }}
                      >
                        <div className="aic-key-status">
                          <span
                            className="aic-key-dot"
                            style={{ background: keyStatus[provider.id]?.configured ? "var(--status-success-text)" : "var(--status-warning-text)" }}
                          />
                          <span className="aic-key-env-var">
                            {keyStatus[provider.id]?.envVar || `${provider.id.toUpperCase()}_API_KEY`}:
                          </span>
                          {keyStatus[provider.id]?.configured ? (
                            <code className="aic-key-masked">
                              {keyStatus[provider.id]?.masked}
                            </code>
                          ) : (
                            <span className="aic-key-unconfigured">
                              Not configured
                            </span>
                          )}
                        </div>

                        {editingKey === provider.id ? (
                          <div className="aic-key-edit">
                            <input
                              type="password"
                              value={newKeyValue}
                              onChange={(e) => setNewKeyValue(e.target.value)}
                              placeholder="Paste API key..."
                              className="aic-key-input"
                            />
                            <button onClick={() => saveApiKey(provider.id)} className="aic-key-save-btn">
                              Save
                            </button>
                            <button
                              onClick={() => { setEditingKey(null); setNewKeyValue(""); }}
                              className="aic-key-cancel-btn"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="aic-key-actions">
                            <button onClick={() => setEditingKey(provider.id)} className="aic-key-btn">
                              {keyStatus[provider.id]?.configured ? "Update" : "Add Key"}
                            </button>
                            {keyStatus[provider.id]?.configured && (
                              <>
                                <button
                                  onClick={() => testApiKey(provider.id)}
                                  disabled={testingKey === provider.id}
                                  className="aic-key-btn"
                                  style={{
                                    cursor: testingKey === provider.id ? "wait" : "pointer",
                                    opacity: testingKey === provider.id ? 0.6 : 1,
                                  }}
                                >
                                  {testingKey === provider.id ? "Testing..." : "Test"}
                                </button>
                                <button onClick={() => deleteApiKey(provider.id)} className="aic-key-remove-btn">
                                  Remove
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Test result */}
                        {keyTestResult?.provider === provider.id && (
                          <div className={`aic-key-test-result ${keyTestResult.valid ? "aic-key-test-success" : "aic-key-test-failure"}`}>
                            <span>{keyTestResult.valid ? "✓" : "✗"}</span>
                            <span>{keyTestResult.message}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <h4 className="aic-models-subheading">
                      Models
                    </h4>
                    <div className="aic-model-list">
                      {providerModels.map((model) => {
                        const tierStyle = TIER_STYLES[model.tier] || TIER_STYLES.standard;
                        const isEditing = editingModel?.modelId === model.modelId;

                        return (
                          <div
                            key={model.modelId}
                            className={`aic-model-row ${model.isActive ? "aic-model-row-active" : "aic-model-row-inactive"}`}
                          >
                            {isEditing ? (
                              <>
                                <input
                                  type="text"
                                  value={editingModel.label}
                                  onChange={(e) =>
                                    setEditingModel({ ...editingModel, label: e.target.value })
                                  }
                                  className="aic-model-edit-input"
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
                                  className="aic-model-save-btn"
                                >
                                  Save
                                </button>
                                <button onClick={() => setEditingModel(null)} className="aic-model-cancel-btn">
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <code className="aic-model-id-badge">
                                  {model.modelId}
                                </code>
                                <span className="aic-model-label">
                                  {model.label}
                                </span>
                                <span
                                  className="aic-tier-badge"
                                  style={{ background: tierStyle.bg, color: tierStyle.text }}
                                >
                                  {model.tier}
                                </span>
                                <button onClick={() => setEditingModel(model)} className="aic-model-edit-btn">
                                  Edit
                                </button>
                                <button
                                  onClick={() => toggleModelActive(model)}
                                  className={`aic-model-toggle-btn ${model.isActive ? "aic-model-toggle-disable" : "aic-model-toggle-enable"}`}
                                >
                                  {model.isActive ? "Disable" : "Enable"}
                                </button>
                                {isOperator && (
                                  <button
                                    onClick={() => deleteModel(model.modelId)}
                                    className="hf-btn hf-btn-destructive aic-model-delete-btn"
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
        <div className="aic-status-msg aic-status-error">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="aic-dismiss-btn aic-dismiss-error">
            &times;
          </button>
        </div>
      )}

      {successMessage && (
        <div className="aic-status-msg aic-status-success">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="aic-dismiss-btn aic-dismiss-success">
            &times;
          </button>
        </div>
      )}

      {/* Provider Legend */}
      <div className="aic-provider-legend">
        <span className="aic-legend-label">Providers:</span>
        {Object.entries(PROVIDER_STYLES).map(([provider, style]) => (
          <div key={provider} className="aic-legend-item">
            <div
              className="aic-legend-swatch"
              style={{ background: style.bg, border: `1px solid ${style.border}` }}
            />
            <span className="aic-legend-text" style={{ color: style.text }}>
              {provider.charAt(0).toUpperCase() + provider.slice(1)}
            </span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="aic-search-wrapper">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search configs by name, description, provider, model..."
          className="aic-search-input"
        />
        <span className="aic-search-icon">
          &#x2315;
        </span>
        {search && (
          <button onClick={() => setSearch("")} className="aic-search-clear">
            &times;
          </button>
        )}
      </div>

      {/* Result count when filtering */}
      {search.trim() && (
        <div className="aic-result-count">
          {filteredConfigs.length} of {configs.length} configurations match &ldquo;{search.trim()}&rdquo;
        </div>
      )}

      {/* Configuration Cards */}
      <div className="aic-config-list">
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
              className="aic-config-card"
              style={{
                borderColor: config.isCustomized ? providerStyle.border : "var(--border-default)",
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              <div className="aic-config-card-layout">
                {/* Left: Label and Description */}
                <div className="aic-config-info">
                  <div className="aic-config-label-row">
                    <span className="aic-config-label">{config.label}</span>
                    {config.isCustomized && (
                      <span
                        className="aic-customized-badge"
                        style={{ background: providerStyle.bg, color: providerStyle.text }}
                      >
                        Customized
                      </span>
                    )}
                  </div>
                  <p className="aic-config-desc">{config.description}</p>
                </div>

                {/* Right: Controls */}
                <div className="aic-config-controls">
                  {/* Provider Selector */}
                  <div className="aic-control-group">
                    <label className="aic-control-label">
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
                  <div className="aic-control-group">
                    <label className="aic-control-label">MODEL</label>
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
                    <div className="aic-control-group">
                      <label className="aic-control-label">
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
                        className="aic-transcript-input"
                        title={`Characters of transcript to include. Default: ${config.defaultTranscriptLimit}`}
                      />
                    </div>
                  )}

                  {/* Tier Badge */}
                  {currentModel && (
                    <div
                      className="aic-config-tier"
                      style={{ background: tierStyle.bg, color: tierStyle.text }}
                    >
                      {currentModel.tier}
                    </div>
                  )}

                  {/* Reset Button */}
                  {config.isCustomized && (
                    <button
                      onClick={() => resetToDefault(config.callPoint)}
                      disabled={isSaving}
                      className="aic-reset-btn"
                      title={`Reset to default: ${config.defaultProvider} / ${config.defaultModel}`}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Default hint */}
              {!config.isCustomized && (
                <div className="aic-config-hint">
                  Using default: {config.defaultProvider} / {config.defaultModel}
                </div>
              )}

              {/* Last updated */}
              {config.updatedAt && (
                <div className="aic-config-hint">
                  Last updated: {new Date(config.updatedAt).toLocaleString()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="aic-footer-info">
        <strong>How it works:</strong> These settings are loaded at runtime by the AI client. When
        an operation runs (e.g., Pipeline MEASURE), it looks up the configuration for that call
        point and uses the specified provider and model. If no custom configuration exists, the
        system default is used.
      </div>
    </div>
  );
}
