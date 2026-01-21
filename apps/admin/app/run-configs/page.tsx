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

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  DRAFT: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
  COMPILING: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  READY: { bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
  ERROR: { bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  SUPERSEDED: { bg: "bg-neutral-100", border: "border-neutral-300", text: "text-neutral-600" },
};

// Match Analysis Specs page domain colors
const DOMAIN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  personality: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  engagement: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  conversation: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  memory: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  safety: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  commercial: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
};

function getDomainColor(domain: string | null) {
  if (!domain) return { bg: "bg-neutral-50", text: "text-neutral-700", border: "border-neutral-200" };
  return DOMAIN_COLORS[domain.toLowerCase()] || { bg: "bg-neutral-50", text: "text-neutral-700", border: "border-neutral-200" };
}

function getOutputTypeBadge(outputType: "MEASURE" | "LEARN") {
  if (outputType === "LEARN") {
    return { bg: "bg-amber-100", text: "text-amber-700", label: "Learn" };
  }
  return { bg: "bg-indigo-100", text: "text-indigo-700", label: "Measure" };
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
          <div className="px-3 py-2 bg-green-50 border-b border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                <span className="font-semibold text-green-800 text-sm">Available Specs</span>
              </div>
              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                {filteredSpecs.length}
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="px-2 py-2 border-b border-neutral-100 space-y-1.5">
            <input
              type="text"
              placeholder="Filter specs..."
              value={specFilter}
              onChange={(e) => setSpecFilter(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-green-300"
            />
            <div className="flex gap-1.5">
              <select
                value={domainFilter || ""}
                onChange={(e) => setDomainFilter(e.target.value || null)}
                className="text-xs px-1.5 py-0.5 border border-neutral-200 rounded bg-white flex-1"
              >
                <option value="">All domains</option>
                {uniqueDomains.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                value={outputTypeFilter || ""}
                onChange={(e) => setOutputTypeFilter((e.target.value as "MEASURE" | "LEARN") || null)}
                className="text-xs px-1.5 py-0.5 border border-neutral-200 rounded bg-white flex-1"
              >
                <option value="">All types</option>
                <option value="MEASURE">MEASURE</option>
                <option value="LEARN">LEARN</option>
              </select>
            </div>
          </div>

          {/* Specs list */}
          <div className="flex-1 overflow-y-auto p-1.5">
            {loadingSpecs ? (
              <div className="text-center py-6 text-neutral-400 text-sm">Loading...</div>
            ) : filteredSpecs.length === 0 ? (
              <div className="text-center py-6 text-neutral-400">
                <div className="text-xl mb-1">📋</div>
                <div className="text-xs">No compiled specs</div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredSpecs.map((spec) => {
                  const domainColors = getDomainColor(spec.domain);
                  const outputBadge = getOutputTypeBadge(spec.outputType);
                  return (
                    <div
                      key={spec.id}
                      draggable
                      onDragStart={() => handleDragStart(spec)}
                      onDragEnd={handleDragEnd}
                      className="cursor-grab active:cursor-grabbing rounded-md border p-2.5 transition-colors bg-green-50 border-green-200 hover:border-green-300"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block w-2 h-2 rounded-full flex-shrink-0 bg-green-500"
                              title="Compiled"
                            />
                            <span className="font-medium text-neutral-900 truncate text-sm">{spec.name}</span>
                          </div>
                          <div className="text-[11px] text-neutral-500 truncate ml-3.5">{spec.slug}</div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] ${outputBadge.bg} ${outputBadge.text}`}>
                            {outputBadge.label}
                          </span>
                          <span className="text-green-500 text-base">⊕</span>
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-neutral-500 ml-3.5">
                        <span>{spec.actionCount || 0} param{(spec.actionCount || 0) !== 1 ? "s" : ""}</span>
                        {spec.domain && (
                          <span className={`rounded px-1 py-0.5 ${domainColors.bg} ${domainColors.text}`}>
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
          <div className={`px-4 py-3 border-b ${isBuilding ? "bg-blue-50 border-blue-200" : "bg-neutral-100 border-neutral-200"}`}>
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  placeholder="Run Config name..."
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-medium border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                />
                <input
                  type="text"
                  placeholder="Description (optional)..."
                  value={configDescription}
                  onChange={(e) => setConfigDescription(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                />
              </div>
              {isBuilding && (
                <button
                  onClick={handleClearBuilder}
                  className="text-xs text-neutral-500 hover:text-red-500 px-2 py-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Builder drop zone */}
          <div className="flex-1 overflow-y-auto p-4">
            {builderSpecs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-400">
                <div className="text-5xl mb-3">📦</div>
                <div className="text-base font-medium">Drop specs here</div>
                <div className="text-xs mt-1">Drag from the left panel to build your config</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {builderSpecs.map((spec, idx) => {
                  const domainColors = getDomainColor(spec.domain);
                  const outputBadge = getOutputTypeBadge(spec.outputType);
                  return (
                    <div
                      key={spec.id}
                      className="rounded-md border p-3 bg-blue-50 border-blue-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-blue-500 font-mono bg-blue-100 px-1.5 py-0.5 rounded">
                              #{idx + 1}
                            </span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] ${outputBadge.bg} ${outputBadge.text}`}>
                              {outputBadge.label}
                            </span>
                          </div>
                          <div className="font-medium text-sm text-neutral-900 truncate mt-1.5">
                            {spec.name}
                          </div>
                          <div className="text-[11px] text-neutral-500 truncate">{spec.slug}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveFromBuilder(spec.id)}
                          className="text-neutral-400 hover:text-red-500 transition-colors text-lg leading-none -mt-1"
                        >
                          ×
                        </button>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-neutral-500">
                        <span>{spec.actionCount || 0} param{(spec.actionCount || 0) !== 1 ? "s" : ""}</span>
                        {spec.domain && (
                          <span className={`rounded px-1 py-0.5 ${domainColors.bg} ${domainColors.text}`}>
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
          <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <div className="flex gap-4 text-sm">
              <span className="text-indigo-600 font-medium">{measureCount} MEASURE</span>
              <span className="text-amber-600 font-medium">{learnCount} LEARN</span>
              <span className="text-neutral-500">{builderSpecs.length} total</span>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !configName.trim() || builderSpecs.length === 0}
              className={`
                px-6 py-2 rounded-lg font-semibold text-sm transition-all
                ${saving || !configName.trim() || builderSpecs.length === 0
                  ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                }
              `}
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
            <div className="text-center py-8 text-neutral-400">Loading...</div>
          ) : runConfigs.length === 0 ? (
            <div className="text-center py-8 text-neutral-400">
              <div className="text-2xl mb-2">📦</div>
              <div className="text-sm">No run configs yet</div>
              <div className="text-xs mt-1">Build one using the panel above</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 sticky top-0">
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-center">Specs</th>
                  <th className="px-4 py-2 font-medium text-center">Params</th>
                  <th className="px-4 py-2 font-medium text-center">Runs</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  <th className="px-4 py-2 font-medium text-right">Actions</th>
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
                      className={`border-b border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer ${
                        isSelected ? "bg-blue-50 hover:bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs transition-transform ${isSelected ? "rotate-90" : ""}`}>▶</span>
                          <div>
                            <div className="font-medium text-neutral-900">{config.name}</div>
                            <div className="text-xs text-neutral-500">v{config.version}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {config.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-indigo-600 font-medium">{config.measureSpecCount}</span>
                          <span className="text-neutral-300">/</span>
                          <span className="text-amber-600 font-medium">{config.learnSpecCount}</span>
                        </div>
                        <div className="text-[10px] text-neutral-400">{totalSpecs} total</div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-neutral-700 font-medium">{config.parameterCount || 0}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {config.runCount > 0 ? (
                          <span className="text-green-600 font-medium">{config.runCount}</span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-neutral-700">{createdDate.toLocaleDateString()}</div>
                        <div className="text-[10px] text-neutral-400">{createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          {config.status === "DRAFT" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); }}
                              className="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                            >
                              Publish
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteConfig(config.id, config.name); }}
                            className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
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
          <div className="flex-1 border-t border-neutral-300 bg-neutral-50 overflow-hidden">
            {/* Detail Header */}
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold text-neutral-900">
                  {configDetail?.compiledSet?.name || "Loading..."}
                </h3>
                {configDetail?.compiledSet && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-neutral-500">v{configDetail.compiledSet.version}</span>
                    <span className={`px-2 py-0.5 rounded font-medium ${STATUS_COLORS[configDetail.compiledSet.status]?.bg} ${STATUS_COLORS[configDetail.compiledSet.status]?.text} border ${STATUS_COLORS[configDetail.compiledSet.status]?.border}`}>
                      {configDetail.compiledSet.status}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => { setSelectedConfigId(null); setConfigDetail(null); }}
                className="p-1 rounded hover:bg-blue-100 transition-colors text-neutral-500 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            {/* Detail Content - Horizontal layout */}
            <div className="px-4 py-3 overflow-y-auto h-[calc(100%-44px)]">
              {loadingDetail ? (
                <div className="text-center py-8 text-neutral-400">Loading details...</div>
              ) : configDetail ? (
                <div className="flex gap-6 h-full">
                  {/* Left: Stats + Specs */}
                  <div className="flex flex-col gap-3 w-[320px] flex-shrink-0">
                    {/* Compact stats - 2 rows */}
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-indigo-50 border border-indigo-100 text-indigo-600">
                          Measure <b className="ml-0.5">{configDetail.summary.measureSpecCount}</b>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-amber-50 border border-amber-100 text-amber-600">
                          Learn <b className="ml-0.5">{configDetail.summary.learnSpecCount}</b>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-blue-50 border border-blue-100 text-blue-600">
                          Actions <b className="ml-0.5">{configDetail.summary.actionCount || configDetail.actions?.length || 0}</b>
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-green-50 border border-green-100 text-green-600">
                          Anchors <b className="ml-0.5">{configDetail.summary.totalAnchors}</b>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-cyan-50 border border-cyan-100 text-cyan-600">
                          Runs <b className="ml-0.5">{configDetail.compiledSet?.runCount || 0}</b>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-teal-50 border border-teal-100 text-teal-600">
                          Enriched <b className="ml-0.5">{configDetail.summary.enrichedParameterCount}</b>
                        </span>
                      </div>
                    </div>

                    {/* Specs list - clickable to navigate to Analysis Specs */}
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
                      {configDetail.specs.measure.map((spec) => {
                        const domainColors = getDomainColor(spec.domain);
                        return (
                          <div
                            key={spec.id}
                            onClick={() => router.push(`/analysis-specs?select=${spec.id}`)}
                            className="flex items-center gap-2 p-2 rounded bg-white border border-indigo-100 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                          >
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 font-medium">M</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-neutral-800 truncate">{spec.name}</div>
                              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                                <span>{spec.triggerCount} triggers</span>
                                {spec.domain && (
                                  <span className={`rounded px-1 py-0.5 ${domainColors.bg} ${domainColors.text}`}>
                                    {spec.domain}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-neutral-300 text-xs">→</span>
                          </div>
                        );
                      })}
                      {configDetail.specs.learn.map((spec) => {
                        const domainColors = getDomainColor(spec.domain);
                        return (
                          <div
                            key={spec.id}
                            onClick={() => router.push(`/analysis-specs?select=${spec.id}`)}
                            className="flex items-center gap-2 p-2 rounded bg-white border border-amber-100 cursor-pointer hover:bg-amber-50 hover:border-amber-200 transition-colors"
                          >
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 font-medium">L</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-neutral-800 truncate">{spec.name}</div>
                              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                                <span>{spec.triggerCount} triggers</span>
                                {spec.domain && (
                                  <span className={`rounded px-1 py-0.5 ${domainColors.bg} ${domainColors.text}`}>
                                    {spec.domain}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-neutral-300 text-xs">→</span>
                          </div>
                        );
                      })}
                      {configDetail.specs.measure.length === 0 && configDetail.specs.learn.length === 0 && (
                        <div className="text-center py-4 text-neutral-300 text-sm">No specs</div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions table (AC-1, AC-2, etc.) */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <h4 className="text-[10px] font-semibold text-neutral-500 uppercase mb-2">
                      Actions ({configDetail.actions?.length || 0})
                    </h4>
                    {configDetail.actions && configDetail.actions.length > 0 ? (
                      <div className="border border-neutral-200 rounded bg-white flex-1 overflow-hidden overflow-y-auto">
                        <table className="w-full text-[11px]">
                          <thead className="bg-neutral-50 sticky top-0">
                            <tr className="text-left text-neutral-500">
                              <th className="px-2 py-2 font-medium w-14">Code</th>
                              <th className="px-2 py-2 font-medium">Parameter</th>
                              <th className="px-2 py-2 font-medium text-center w-16">Anchors</th>
                              <th className="px-2 py-2 font-medium text-center w-16">Enriched</th>
                              <th className="px-2 py-2 w-6"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {configDetail.actions.map((action) => (
                              <tr
                                key={action.id}
                                onClick={() => action.parameterId && router.push(`/admin#/parameters?select=${action.parameterId}`)}
                                className={`border-t border-neutral-100 transition-colors ${action.parameterId ? "hover:bg-purple-50 cursor-pointer" : ""}`}
                              >
                                <td className="px-2 py-1.5">
                                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{action.code}</span>
                                </td>
                                <td className="px-2 py-1.5">
                                  <div className="font-medium text-neutral-800 truncate max-w-[200px]">{action.parameterName || "—"}</div>
                                  <div className="text-[9px] text-neutral-400 truncate">{action.specName}</div>
                                </td>
                                <td className="px-2 py-1.5 text-center text-neutral-600">{action.anchorCount}</td>
                                <td className="px-2 py-1.5 text-center">
                                  {action.isEnriched ? (
                                    <span className="text-green-600">✓</span>
                                  ) : (
                                    <span className="text-neutral-300">—</span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-neutral-300 text-xs">{action.parameterId ? "→" : ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-neutral-300 text-sm border border-dashed border-neutral-200 rounded">
                        No actions
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-400">Failed to load details</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
