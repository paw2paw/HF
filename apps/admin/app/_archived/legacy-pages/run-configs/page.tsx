"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type AnalysisSpec = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  outputType: "MEASURE" | "LEARN";
  domain: string | null;
  priority: number;
  isActive: boolean;
  triggerCount: number;
  actionCount: number;
  compiledAt: string | null;
  isDirty: boolean;
  dirtyReason: string | null;
};

type RunConfig = {
  id: string;
  name: string;
  description: string | null;
  version: string;
  status: "DRAFT" | "COMPILING" | "READY" | "ERROR" | "SUPERSEDED";
  compiledAt: string | null;
  measureSpecCount: number;
  learnSpecCount: number;
  parameterCount: number;
  anchorCount: number;
  runCount: number;
  createdAt: string;
  analysisProfile?: {
    id: string;
    name: string;
    isLocked: boolean;
    usageCount: number;
  };
};

type ActionItem = {
  id: string;
  code: string;
  specName: string;
  specId: string;
  triggerName: string | null;
  description: string;
  parameterId: string | null;
  parameterName: string | null;
  anchorCount: number;
  isEnriched: boolean;
};

type RunConfigDetail = {
  compiledSet: RunConfig;
  specs: {
    measure: { id: string; slug: string; name: string; domain: string | null; triggerCount: number }[];
    learn: { id: string; slug: string; name: string; domain: string | null; triggerCount: number }[];
  };
  actions: ActionItem[];
  parameters: {
    parameterId: string;
    name: string;
    isEnriched: boolean;
    anchorCount: number;
    specCount: number;
  }[];
  summary: {
    measureSpecCount: number;
    learnSpecCount: number;
    actionCount: number;
    parameterCount: number;
    enrichedParameterCount: number;
    totalAnchors: number;
  };
};

// Inline style versions
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  DRAFT: { bg: "#fffbeb", border: "#fcd34d", text: "#d97706" },
  COMPILING: { bg: "#eff6ff", border: "#93c5fd", text: "#2563eb" },
  READY: { bg: "#f0fdf4", border: "#86efac", text: "#16a34a" },
  ERROR: { bg: "#fef2f2", border: "#fca5a5", text: "#dc2626" },
  SUPERSEDED: { bg: "#f5f5f5", border: "#d4d4d4", text: "#6b7280" },
};

const DOMAIN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  personality: { bg: "#f3e8ff", text: "#7c3aed", border: "#ddd6fe" },
  engagement: { bg: "#dbeafe", text: "#2563eb", border: "#bfdbfe" },
  conversation: { bg: "#ccfbf1", text: "#0d9488", border: "#99f6e4" },
  memory: { bg: "#fef3c7", text: "#d97706", border: "#fde68a" },
  safety: { bg: "#fee2e2", text: "#dc2626", border: "#fecaca" },
  commercial: { bg: "#dcfce7", text: "#16a34a", border: "#bbf7d0" },
};

function getDomainColor(domain: string | null) {
  if (!domain) return { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" };
  return DOMAIN_COLORS[domain.toLowerCase()] || { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" };
}

function getOutputTypeBadge(outputType: "MEASURE" | "LEARN") {
  if (outputType === "LEARN") {
    return { bg: "#fef3c7", text: "#d97706", label: "Learn" };
  }
  return { bg: "#e0e7ff", text: "#4f46e5", label: "Measure" };
}

export default function RunConfigsPage() {
  const router = useRouter();

  // Available compiled specs
  const [availableSpecs, setAvailableSpecs] = useState<AnalysisSpec[]>([]);
  const [loadingSpecs, setLoadingSpecs] = useState(true);

  // Existing run configs
  const [runConfigs, setRunConfigs] = useState<RunConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);

  // Builder state
  const [builderSpecs, setBuilderSpecs] = useState<AnalysisSpec[]>([]);
  const [configName, setConfigName] = useState("");
  const [configDescription, setConfigDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Drag state
  const [draggedSpec, setDraggedSpec] = useState<AnalysisSpec | null>(null);

  // Filter state
  const [specFilter, setSpecFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [outputTypeFilter, setOutputTypeFilter] = useState<"MEASURE" | "LEARN" | null>(null);

  // Messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Slideout state
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [configDetail, setConfigDetail] = useState<RunConfigDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch available specs (only compiled ones)
  const fetchSpecs = useCallback(async () => {
    try {
      const res = await fetch("/api/analysis-specs?active=true");
      const data = await res.json();
      if (data.ok) {
        const compiledSpecs = (data.specs || []).filter(
          (s: AnalysisSpec) => s.compiledAt && !s.isDirty
        );
        setAvailableSpecs(compiledSpecs);
      }
    } catch (err: any) {
      console.error("Failed to fetch specs:", err);
    } finally {
      setLoadingSpecs(false);
    }
  }, []);

  // Fetch existing run configs
  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/compiled-sets");
      const data = await res.json();
      if (data.ok) {
        setRunConfigs(data.sets || []);
      }
    } catch (err: any) {
      console.error("Failed to fetch configs:", err);
    } finally {
      setLoadingConfigs(false);
    }
  }, []);

  useEffect(() => {
    fetchSpecs();
    fetchConfigs();
  }, [fetchSpecs, fetchConfigs]);

  // Fetch config detail when selected
  const fetchConfigDetail = useCallback(async (configId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/compiled-sets/${configId}`);
      const data = await res.json();
      if (data.ok) {
        setConfigDetail(data);
      } else {
        setError(data.error || "Failed to load config details");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load config details");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Handle row click
  const handleRowClick = (configId: string) => {
    if (selectedConfigId === configId) {
      // Close if clicking same row
      setSelectedConfigId(null);
      setConfigDetail(null);
    } else {
      setSelectedConfigId(configId);
      fetchConfigDetail(configId);
    }
  };

  // Filter available specs
  const filteredSpecs = availableSpecs.filter((spec) => {
    if (specFilter && !spec.name.toLowerCase().includes(specFilter.toLowerCase())) {
      return false;
    }
    if (domainFilter && spec.domain !== domainFilter) {
      return false;
    }
    if (outputTypeFilter && spec.outputType !== outputTypeFilter) {
      return false;
    }
    if (builderSpecs.some((bs) => bs.id === spec.id)) {
      return false;
    }
    return true;
  });

  // Get unique domains
  const uniqueDomains = [...new Set(availableSpecs.map((s) => s.domain).filter(Boolean))] as string[];

  // Drag handlers
  const handleDragStart = (spec: AnalysisSpec) => {
    setDraggedSpec(spec);
  };

  const handleDragEnd = () => {
    setDraggedSpec(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedSpec && !builderSpecs.some((s) => s.id === draggedSpec.id)) {
      setBuilderSpecs([...builderSpecs, draggedSpec]);
    }
    setDraggedSpec(null);
  };

  const handleRemoveFromBuilder = (specId: string) => {
    setBuilderSpecs(builderSpecs.filter((s) => s.id !== specId));
  };

  const handleClearBuilder = () => {
    setBuilderSpecs([]);
    setConfigName("");
    setConfigDescription("");
  };

  // Save the run config
  const handleSave = async () => {
    if (!configName.trim()) {
      setError("Please enter a name for the Run Config");
      return;
    }
    if (builderSpecs.length === 0) {
      setError("Please add at least one spec to the Run Config");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/compiled-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: configName.trim(),
          description: configDescription.trim() || undefined,
          specIds: builderSpecs.map((s) => s.id),
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess(`Run Config "${configName}" saved successfully!`);
        handleClearBuilder();
        fetchConfigs();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to save Run Config");
      }
    } catch (err: any) {
      setError(err.message || "Failed to save Run Config");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/compiled-sets/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setRunConfigs((prev) => prev.filter((c) => c.id !== id));
        setSuccess(`"${name}" deleted`);
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError(data.error || "Failed to delete");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const measureCount = builderSpecs.filter((s) => s.outputType === "MEASURE").length;
  const learnCount = builderSpecs.filter((s) => s.outputType === "LEARN").length;
  const isBuilding = builderSpecs.length > 0 || configName.trim().length > 0;

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: "#fafafa",
    }}>
      {/* Header */}
      <div style={{ padding: "12px 24px", background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#171717" }}>Run Configs</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>
            Drag compiled specs to build analysis configurations
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14, color: "#6b7280" }}>
          <span>{availableSpecs.length} compiled specs</span>
          <span>·</span>
          <span>{runConfigs.length} configs</span>
        </div>
      </div>

      {/* Error/Success banners */}
      {(error || success) && (
        <div style={{
          margin: "12px 24px 0",
          padding: "8px 16px",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 14,
          background: error ? "#fef2f2" : "#f0fdf4",
          border: error ? "1px solid #fecaca" : "1px solid #bbf7d0",
          color: error ? "#dc2626" : "#16a34a",
        }}>
          <span>{error || success}</span>
          <button onClick={() => { setError(null); setSuccess(null); }} style={{ fontWeight: 700, background: "none", border: "none", cursor: "pointer", color: "inherit" }}>×</button>
        </div>
      )}

      {/* TOP HALF: Available Specs (left) + Builder (right) */}
      <div style={{ flex: 1, minHeight: 0, padding: 16, display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, overflow: "hidden" }}>
        {/* LEFT: Available Specs */}
        <div style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", background: "#f0fdf4", borderBottom: "1px solid #bbf7d0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#16a34a" }} />
                <span style={{ fontWeight: 600, color: "#166534", fontSize: 14 }}>Available Specs</span>
              </div>
              <span style={{ fontSize: 12, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 12 }}>
                {filteredSpecs.length}
              </span>
            </div>
          </div>

          {/* Filters */}
          <div style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
            <input
              type="text"
              placeholder="Filter specs..."
              value={specFilter}
              onChange={(e) => setSpecFilter(e.target.value)}
              style={{ width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6, marginBottom: 6 }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <select
                value={domainFilter || ""}
                onChange={(e) => setDomainFilter(e.target.value || null)}
                style={{ flex: 1, fontSize: 12, padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6 }}
              >
                <option value="">All domains</option>
                {uniqueDomains.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                value={outputTypeFilter || ""}
                onChange={(e) => setOutputTypeFilter((e.target.value as "MEASURE" | "LEARN") || null)}
                style={{ flex: 1, fontSize: 12, padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6 }}
              >
                <option value="">All types</option>
                <option value="MEASURE">MEASURE</option>
                <option value="LEARN">LEARN</option>
              </select>
            </div>
          </div>

          {/* Specs list */}
          <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>
            {loadingSpecs ? (
              <div style={{ textAlign: "center", padding: 24, color: "#9ca3af", fontSize: 14 }}>Loading...</div>
            ) : filteredSpecs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "#9ca3af" }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>📋</div>
                <div style={{ fontSize: 12 }}>No compiled specs</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {filteredSpecs.map((spec) => {
                  const domainColors = getDomainColor(spec.domain);
                  const outputBadge = getOutputTypeBadge(spec.outputType);
                  return (
                    <div
                      key={spec.id}
                      draggable
                      onDragStart={() => handleDragStart(spec)}
                      onDragEnd={handleDragEnd}
                      style={{
                        cursor: "grab",
                        borderRadius: 6,
                        border: "1px solid #bbf7d0",
                        padding: 10,
                        background: "#f0fdf4",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span
                              style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }}
                              title="Compiled"
                            />
                            <span style={{ fontWeight: 500, color: "#1f2937", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spec.name}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginLeft: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spec.slug}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: outputBadge.bg, color: outputBadge.text }}>
                            {outputBadge.label}
                          </span>
                          <span style={{ color: "#16a34a", fontSize: 16 }}>⊕</span>
                        </div>
                      </div>
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#6b7280", marginLeft: 14 }}>
                        <span>{spec.actionCount || 0} params</span>
                        {spec.domain && (
                          <span style={{ padding: "1px 6px", borderRadius: 4, background: domainColors.bg, color: domainColors.text }}>
                            {spec.domain}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Config Builder */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            display: "flex",
            flexDirection: "column",
            borderRadius: 12,
            border: draggedSpec ? "2px dashed #60a5fa" : isBuilding ? "2px solid #93c5fd" : "2px dashed #d1d5db",
            background: draggedSpec ? "#eff6ff" : isBuilding ? "#fff" : "#fafafa",
            overflow: "hidden",
            transition: "all 0.15s",
          }}
        >
          {/* Builder header with inputs */}
          <div style={{ padding: 12, borderBottom: `1px solid ${isBuilding ? "#bfdbfe" : "#e5e7eb"}`, background: isBuilding ? "#eff6ff" : "#f9fafb" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Run Config name..."
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", fontSize: 14, fontWeight: 500, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff" }}
                />
                <input
                  type="text"
                  placeholder="Description (optional)..."
                  value={configDescription}
                  onChange={(e) => setConfigDescription(e.target.value)}
                  style={{ width: "100%", padding: "6px 12px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff" }}
                />
              </div>
              {isBuilding && (
                <button
                  onClick={handleClearBuilder}
                  style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Builder drop zone */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {builderSpecs.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>Drop specs here</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Drag from the left panel to build your config</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                {builderSpecs.map((spec, idx) => {
                  const domainColors = getDomainColor(spec.domain);
                  const outputBadge = getOutputTypeBadge(spec.outputType);
                  return (
                    <div
                      key={spec.id}
                      style={{ borderRadius: 6, border: "1px solid #bfdbfe", padding: 12, background: "#eff6ff" }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, color: "#3b82f6", fontFamily: "monospace", background: "#dbeafe", padding: "2px 6px", borderRadius: 4 }}>
                              #{idx + 1}
                            </span>
                            <span style={{ borderRadius: 4, padding: "2px 6px", fontSize: 10, background: outputBadge.bg, color: outputBadge.text }}>
                              {outputBadge.label}
                            </span>
                          </div>
                          <div style={{ fontWeight: 500, fontSize: 14, color: "#171717", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 6 }}>
                            {spec.name}
                          </div>
                          <div style={{ fontSize: 11, color: "#737373", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spec.slug}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveFromBuilder(spec.id)}
                          style={{ color: "#a3a3a3", background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1, marginTop: -4 }}
                        >
                          ×
                        </button>
                      </div>
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#737373" }}>
                        <span>{spec.actionCount || 0} param{(spec.actionCount || 0) !== 1 ? "s" : ""}</span>
                        {spec.domain && (
                          <span style={{ borderRadius: 4, padding: "2px 4px", background: domainColors.bg, color: domainColors.text }}>
                            {spec.domain}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Builder footer with stats and save */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
              <span style={{ color: "#4f46e5", fontWeight: 500 }}>{measureCount} MEASURE</span>
              <span style={{ color: "#d97706", fontWeight: 500 }}>{learnCount} LEARN</span>
              <span style={{ color: "#737373" }}>{builderSpecs.length} total</span>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !configName.trim() || builderSpecs.length === 0}
              style={{
                padding: "8px 24px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                border: "none",
                cursor: saving || !configName.trim() || builderSpecs.length === 0 ? "not-allowed" : "pointer",
                background: saving || !configName.trim() || builderSpecs.length === 0 ? "#e5e5e5" : "#2563eb",
                color: saving || !configName.trim() || builderSpecs.length === 0 ? "#a3a3a3" : "#fff",
              }}
            >
              {saving ? "Saving..." : "SAVE CONFIG"}
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: Run Configs List + Detail Panel */}
      <div style={{
        height: selectedConfigId ? 480 : 280,
        borderTop: "1px solid #d1d5db",
        background: "#fff",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        transition: "height 0.2s ease-out"
      }}>
        {/* Run Configs Table Header */}
        <div style={{ padding: "8px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#404040", fontSize: 14 }}>Run Configs</span>
            <span style={{ fontSize: 12, color: "#6b7280", background: "#e5e7eb", padding: "2px 8px", borderRadius: 999 }}>
              {runConfigs.length}
            </span>
          </div>
        </div>

        {/* Run Configs Table (scrollable) */}
        <div style={{ height: selectedConfigId ? 160 : "100%", overflowY: "auto", flexShrink: 0 }}>
          {loadingConfigs ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#a3a3a3" }}>Loading...</div>
          ) : runConfigs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#a3a3a3" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
              <div style={{ fontSize: 14 }}>No run configs yet</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Build one using the panel above</div>
            </div>
          ) : (
            <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
              <thead style={{ background: "#fafafa", position: "sticky", top: 0 }}>
                <tr style={{ textAlign: "left", fontSize: 12, color: "#737373", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 16px", fontWeight: 500 }}>Name</th>
                  <th style={{ padding: "8px 16px", fontWeight: 500 }}>Status</th>
                  <th style={{ padding: "8px 16px", fontWeight: 500, textAlign: "center" }}>Specs</th>
                  <th style={{ padding: "8px 16px", fontWeight: 500, textAlign: "center" }}>Params</th>
                  <th style={{ padding: "8px 16px", fontWeight: 500, textAlign: "center" }}>Runs</th>
                  <th style={{ padding: "8px 16px", fontWeight: 500 }}>Created</th>
                  <th style={{ padding: "8px 16px", fontWeight: 500, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runConfigs.map((config) => {
                  const colors = STATUS_COLORS[config.status] || STATUS_COLORS.DRAFT;
                  const totalSpecs = config.measureSpecCount + config.learnSpecCount;
                  const createdDate = new Date(config.createdAt);
                  const isSelected = selectedConfigId === config.id;
                  return (
                    <tr
                      key={config.id}
                      onClick={() => handleRowClick(config.id)}
                      style={{
                        borderBottom: "1px solid #f5f5f5",
                        cursor: "pointer",
                        background: isSelected ? "#eff6ff" : "transparent",
                      }}
                    >
                      <td style={{ padding: "8px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, transform: isSelected ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>▶</span>
                          <div>
                            <div style={{ fontWeight: 500, color: "#171717" }}>{config.name}</div>
                            <div style={{ fontSize: 12, color: "#737373" }}>v{config.version}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "8px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 500, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                          {config.status}
                        </span>
                      </td>
                      <td style={{ padding: "8px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                          <span style={{ color: "#4f46e5", fontWeight: 500 }}>{config.measureSpecCount}</span>
                          <span style={{ color: "#d4d4d4" }}>/</span>
                          <span style={{ color: "#d97706", fontWeight: 500 }}>{config.learnSpecCount}</span>
                        </div>
                        <div style={{ fontSize: 10, color: "#a3a3a3" }}>{totalSpecs} total</div>
                      </td>
                      <td style={{ padding: "8px 16px", textAlign: "center" }}>
                        <span style={{ color: "#404040", fontWeight: 500 }}>{config.parameterCount || 0}</span>
                      </td>
                      <td style={{ padding: "8px 16px", textAlign: "center" }}>
                        {config.runCount > 0 ? (
                          <span style={{ color: "#16a34a", fontWeight: 500 }}>{config.runCount}</span>
                        ) : (
                          <span style={{ color: "#a3a3a3" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "8px 16px" }}>
                        <div style={{ color: "#404040" }}>{createdDate.toLocaleDateString()}</div>
                        <div style={{ fontSize: 10, color: "#a3a3a3" }}>{createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td style={{ padding: "8px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                          {config.status === "DRAFT" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); }}
                              style={{ padding: "4px 10px", fontSize: 12, fontWeight: 500, background: "#dcfce7", color: "#15803d", borderRadius: 4, border: "none", cursor: "pointer" }}
                            >
                              Publish
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteConfig(config.id, config.name); }}
                            style={{ padding: "4px 10px", fontSize: 12, fontWeight: 500, background: "#fef2f2", color: "#dc2626", borderRadius: 4, border: "none", cursor: "pointer" }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Config Detail Panel (fixed at bottom when selected) */}
        {selectedConfigId && (
          <div style={{ flex: 1, borderTop: "1px solid #d4d4d4", background: "#fafafa", overflow: "hidden" }}>
            {/* Detail Header */}
            <div style={{ padding: "8px 16px", background: "#eff6ff", borderBottom: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <h3 style={{ fontWeight: 600, color: "#171717", margin: 0 }}>
                  {configDetail?.compiledSet?.name || "Loading..."}
                </h3>
                {configDetail?.compiledSet && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
                    <span style={{ color: "#737373" }}>v{configDetail.compiledSet.version}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: STATUS_COLORS[configDetail.compiledSet.status]?.bg, color: STATUS_COLORS[configDetail.compiledSet.status]?.text, border: `1px solid ${STATUS_COLORS[configDetail.compiledSet.status]?.border}` }}>
                      {configDetail.compiledSet.status}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => { setSelectedConfigId(null); setConfigDetail(null); }}
                style={{ padding: 4, borderRadius: 4, border: "none", background: "transparent", color: "#737373", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Detail Content - Horizontal layout */}
            <div style={{ padding: "12px 16px", overflowY: "auto", height: "calc(100% - 44px)" }}>
              {loadingDetail ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#a3a3a3" }}>Loading details...</div>
              ) : configDetail ? (
                <div style={{ display: "flex", gap: 24, height: "100%" }}>
                  {/* Left: Stats + Specs */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 320, flexShrink: 0 }}>
                    {/* Compact stats - 2 rows */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 4, fontSize: 11, background: "#eef2ff", border: "1px solid #e0e7ff", color: "#4f46e5" }}>
                          Measure <b style={{ marginLeft: 2 }}>{configDetail.summary.measureSpecCount}</b>
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 4, fontSize: 11, background: "#fffbeb", border: "1px solid #fef3c7", color: "#d97706" }}>
                          Learn <b style={{ marginLeft: 2 }}>{configDetail.summary.learnSpecCount}</b>
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 4, fontSize: 11, background: "#eff6ff", border: "1px solid #dbeafe", color: "#2563eb" }}>
                          Actions <b style={{ marginLeft: 2 }}>{configDetail.summary.actionCount || configDetail.actions?.length || 0}</b>
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 4, fontSize: 11, background: "#f0fdf4", border: "1px solid #dcfce7", color: "#16a34a" }}>
                          Anchors <b style={{ marginLeft: 2 }}>{configDetail.summary.totalAnchors}</b>
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 4, fontSize: 11, background: "#ecfeff", border: "1px solid #cffafe", color: "#0891b2" }}>
                          Runs <b style={{ marginLeft: 2 }}>{configDetail.compiledSet?.runCount || 0}</b>
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 4, fontSize: 11, background: "#f0fdfa", border: "1px solid #ccfbf1", color: "#0d9488" }}>
                          Enriched <b style={{ marginLeft: 2 }}>{configDetail.summary.enrichedParameterCount}</b>
                        </span>
                      </div>
                    </div>

                    {/* Specs list - clickable to navigate to Analysis Specs */}
                    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                      {configDetail.specs.measure.map((spec) => {
                        const domainColors = getDomainColor(spec.domain);
                        return (
                          <div
                            key={spec.id}
                            onClick={() => router.push(`/analysis-specs?select=${spec.id}`)}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 4, background: "#fff", border: "1px solid #e0e7ff", cursor: "pointer" }}
                          >
                            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "#e0e7ff", color: "#4f46e5", fontWeight: 500 }}>M</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: "#262626", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spec.name}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#a3a3a3" }}>
                                <span>{spec.triggerCount} triggers</span>
                                {spec.domain && (
                                  <span style={{ borderRadius: 4, padding: "2px 4px", background: domainColors.bg, color: domainColors.text }}>
                                    {spec.domain}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span style={{ color: "#d4d4d4", fontSize: 12 }}>→</span>
                          </div>
                        );
                      })}
                      {configDetail.specs.learn.map((spec) => {
                        const domainColors = getDomainColor(spec.domain);
                        return (
                          <div
                            key={spec.id}
                            onClick={() => router.push(`/analysis-specs?select=${spec.id}`)}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 4, background: "#fff", border: "1px solid #fef3c7", cursor: "pointer" }}
                          >
                            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "#fef3c7", color: "#d97706", fontWeight: 500 }}>L</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: "#262626", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spec.name}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#a3a3a3" }}>
                                <span>{spec.triggerCount} triggers</span>
                                {spec.domain && (
                                  <span style={{ borderRadius: 4, padding: "2px 4px", background: domainColors.bg, color: domainColors.text }}>
                                    {spec.domain}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span style={{ color: "#d4d4d4", fontSize: 12 }}>→</span>
                          </div>
                        );
                      })}
                      {configDetail.specs.measure.length === 0 && configDetail.specs.learn.length === 0 && (
                        <div style={{ textAlign: "center", padding: "16px 0", color: "#d4d4d4", fontSize: 14 }}>No specs</div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions table (AC-1, AC-2, etc.) */}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <h4 style={{ fontSize: 10, fontWeight: 600, color: "#737373", textTransform: "uppercase", marginBottom: 8 }}>
                      Actions ({configDetail.actions?.length || 0})
                    </h4>
                    {configDetail.actions && configDetail.actions.length > 0 ? (
                      <div style={{ border: "1px solid #e5e7eb", borderRadius: 4, background: "#fff", flex: 1, overflow: "hidden", overflowY: "auto" }}>
                        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                          <thead style={{ background: "#fafafa", position: "sticky", top: 0 }}>
                            <tr style={{ textAlign: "left", color: "#737373" }}>
                              <th style={{ padding: 8, fontWeight: 500, width: 56 }}>Code</th>
                              <th style={{ padding: 8, fontWeight: 500 }}>Parameter</th>
                              <th style={{ padding: 8, fontWeight: 500, textAlign: "center", width: 64 }}>Anchors</th>
                              <th style={{ padding: 8, fontWeight: 500, textAlign: "center", width: 64 }}>Enriched</th>
                              <th style={{ padding: 8, width: 24 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {configDetail.actions.map((action) => (
                              <tr
                                key={action.id}
                                onClick={() => action.parameterId && router.push(`/admin#/parameters?select=${action.parameterId}`)}
                                style={{ borderTop: "1px solid #f5f5f5", cursor: action.parameterId ? "pointer" : "default" }}
                              >
                                <td style={{ padding: "6px 8px" }}>
                                  <span style={{ fontFamily: "monospace", fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#dbeafe", color: "#1d4ed8" }}>{action.code}</span>
                                </td>
                                <td style={{ padding: "6px 8px" }}>
                                  <div style={{ fontWeight: 500, color: "#262626", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{action.parameterName || "—"}</div>
                                  <div style={{ fontSize: 9, color: "#a3a3a3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{action.specName}</div>
                                </td>
                                <td style={{ padding: "6px 8px", textAlign: "center", color: "#525252" }}>{action.anchorCount}</td>
                                <td style={{ padding: "6px 8px", textAlign: "center" }}>
                                  {action.isEnriched ? (
                                    <span style={{ color: "#16a34a" }}>✓</span>
                                  ) : (
                                    <span style={{ color: "#d4d4d4" }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: "6px 8px", color: "#d4d4d4", fontSize: 12 }}>{action.parameterId ? "→" : ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#d4d4d4", fontSize: 14, border: "1px dashed #e5e7eb", borderRadius: 4 }}>
                        No actions
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#a3a3a3" }}>Failed to load details</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
