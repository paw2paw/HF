"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEntityContext } from "@/contexts/EntityContext";

type Spec = {
  id: string;
  slug: string;
  name: string;
  scope: string;
  outputType: string;
  specRole: string;
  description: string | null;
};

type SpecDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  scope: string;
  outputType: string;
  specRole: string | null;
  domain: string | null;
  config: Record<string, unknown> | null;
  promptTemplate: string | null;
  isActive: boolean;
  isLocked: boolean;
  lockedReason: string | null;
  priority: number;
  version: string | null;
  compiledAt: string | null;
  compiledSetId: string | null;
  createdAt: string;
  updatedAt: string;
};

type FeatureSet = {
  id: string;
  featureId: string;
  name: string;
  description: string | null;
  version: string;
  specType: string;
  rawSpec: Record<string, unknown> | null;
  parameters: any[];
  constraints: any[];
  promptGuidance: any[];
  scoringSpec: Record<string, unknown> | null;
  definitions: Record<string, string> | null;
  thresholds: any[];
  parameterCount: number;
  constraintCount: number;
  definitionCount: number;
  isActive: boolean;
  activatedAt: string | null;
  validations: any[];
  createdAt: string;
  updatedAt: string;
};

const SCOPES = ["SYSTEM", "DOMAIN", "CALLER"] as const;
const TYPES = ["MEASURE", "LEARN", "ADAPT", "COMPOSE", "AGGREGATE", "REWARD"] as const;

const outputTypeColors: Record<string, { bg: string; text: string }> = {
  LEARN: { bg: "#ede9fe", text: "#4c1d95" },
  MEASURE: { bg: "#dcfce7", text: "#14532d" },
  ADAPT: { bg: "#fef3c7", text: "#78350f" },
  COMPOSE: { bg: "#fce7f3", text: "#9d174d" },
  AGGREGATE: { bg: "#e0e7ff", text: "#3730a3" },
  REWARD: { bg: "#fef9c3", text: "#854d0e" },
};

const scopeColors: Record<string, { bg: string; text: string }> = {
  SYSTEM: { bg: "#e5e7eb", text: "#1f2937" },
  DOMAIN: { bg: "#dbeafe", text: "#1e3a8a" },
  CALLER: { bg: "#fce7f3", text: "#9d174d" },
};

const roleColors: Record<string, string> = {
  IDENTITY: "bg-indigo-100 text-indigo-700",
  CONTENT: "bg-orange-100 text-orange-700",
  CONTEXT: "bg-amber-100 text-amber-700",
  META: "bg-slate-100 text-slate-700",
};

export default function SpecsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");

  // List state
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Detail state
  const [spec, setSpec] = useState<SpecDetail | null>(null);
  const [featureSet, setFeatureSet] = useState<FeatureSet | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recompiling, setRecompiling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Editable fields
  const [configText, setConfigText] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [promptTemplate, setPromptTemplate] = useState("");
  const [specRole, setSpecRole] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Collapsible sections
  const [showRawSpec, setShowRawSpec] = useState(false);
  const [showParameters, setShowParameters] = useState(true);
  const [showPromptGuidance, setShowPromptGuidance] = useState(false);
  const [activeTab, setActiveTab] = useState<"derived" | "source">("derived");

  const { pushEntity } = useEntityContext();

  // Fetch list
  useEffect(() => {
    fetch(`/api/analysis-specs`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setSpecs(data.specs || []);
        else setError(data.error);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // Fetch detail when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setSpec(null);
      setFeatureSet(null);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);
    setHasChanges(false);
    setSaveMessage(null);

    fetch(`/api/analysis-specs/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setSpec(data.spec);
          setFeatureSet(data.featureSet);
          setConfigText(JSON.stringify(data.spec.config || {}, null, 2));
          setPromptTemplate(data.spec.promptTemplate || "");
          setSpecRole(data.spec.specRole || "");
          setActiveTab("derived");
          pushEntity({
            type: "spec",
            id: data.spec.id,
            label: data.spec.name,
            href: `/x/specs?id=${data.spec.id}`,
            data: {
              slug: data.spec.slug,
              scope: data.spec.scope,
              outputType: data.spec.outputType,
              specRole: data.spec.specRole,
              description: data.spec.description,
              domain: data.spec.domain,
            },
          });
        } else {
          setDetailError(data.error);
        }
        setDetailLoading(false);
      })
      .catch((e) => {
        setDetailError(e.message);
        setDetailLoading(false);
      });
  }, [selectedId, pushEntity]);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const filteredSpecs = specs.filter((s) => {
    if (selectedScopes.size > 0 && !selectedScopes.has(s.scope)) return false;
    if (selectedTypes.size > 0 && !selectedTypes.has(s.outputType)) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
    }
    return true;
  });

  const selectSpec = (id: string) => {
    router.push(`/x/specs?id=${id}`, { scroll: false });
  };

  // Detail handlers
  const handleConfigChange = useCallback((value: string) => {
    setConfigText(value);
    setHasChanges(true);
    try {
      JSON.parse(value);
      setConfigError(null);
    } catch (e: any) {
      setConfigError(e.message);
    }
  }, []);

  const handlePromptTemplateChange = useCallback((value: string) => {
    setPromptTemplate(value);
    setHasChanges(true);
  }, []);

  const handleSpecRoleChange = useCallback((value: string) => {
    setSpecRole(value);
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    if (!spec || configError) {
      setSaveMessage({ type: "error", text: "Fix JSON errors before saving" });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const parsedConfig = JSON.parse(configText);
      const res = await fetch(`/api/analysis-specs/${spec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: parsedConfig,
          promptTemplate: promptTemplate || null,
          specRole: specRole || null,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSpec(data.spec);
        setHasChanges(false);
        setSaveMessage({ type: "success", text: "Saved successfully" });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to save" });
      }
    } catch (e: any) {
      setSaveMessage({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRecompile = async () => {
    if (!spec) return;
    setRecompiling(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`/api/analysis-specs/${spec.id}/recompile`, {
        method: "POST",
      });

      const data = await res.json();
      if (data.ok) {
        setSpec(data.spec);
        setConfigText(JSON.stringify(data.spec.config || {}, null, 2));
        setPromptTemplate(data.spec.promptTemplate || "");
        setHasChanges(false);
        setSaveMessage({ type: "success", text: "Recompiled successfully from source spec" });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to recompile" });
      }
    } catch (e: any) {
      setSaveMessage({ type: "error", text: e.message });
    } finally {
      setRecompiling(false);
    }
  };

  const handleExportToSource = async () => {
    if (!spec) return;

    if (hasChanges) {
      const saveFirst = window.confirm(
        "You have unsaved changes. Save them first before exporting?\n\nClick OK to save & export, or Cancel to abort."
      );
      if (!saveFirst) return;
      await handleSave();
    }

    const confirmed = window.confirm(
      "This will:\n1. Write config parameters back to the .spec.json file on disk\n2. Re-seed the full pipeline (BDDFeatureSet → Parameters → Anchors → Triggers → Prompt Template)\n\nThe source file will be overwritten. Reversible via git only. Continue?"
    );
    if (!confirmed) return;

    setExporting(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`/api/analysis-specs/${spec.id}/export-to-source`, {
        method: "POST",
      });

      const data = await res.json();
      if (data.ok) {
        const r = data.seedResult;
        const details = r
          ? ` (${r.parametersCreated + r.parametersUpdated} params, ${r.anchorsCreated} anchors, ${r.triggersCreated} triggers)`
          : "";
        setSaveMessage({ type: "success", text: `Exported to ${data.filePath} & re-seeded${details}` });
        // Reload spec data
        const refreshRes = await fetch(`/api/analysis-specs/${spec.id}`);
        const refreshData = await refreshRes.json();
        if (refreshData.ok) {
          setSpec(refreshData.spec);
          setFeatureSet(refreshData.featureSet);
          setConfigText(JSON.stringify(refreshData.spec.config || {}, null, 2));
          setPromptTemplate(refreshData.spec.promptTemplate || "");
          setHasChanges(false);
        }
        setTimeout(() => setSaveMessage(null), 5000);
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to export" });
      }
    } catch (e: any) {
      setSaveMessage({ type: "error", text: e.message });
    } finally {
      setExporting(false);
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(configText);
      setConfigText(JSON.stringify(parsed, null, 2));
      setConfigError(null);
    } catch (e: any) {
      setConfigError(e.message);
    }
  };

  const FilterPill = ({
    label,
    isActive,
    colors,
    onClick,
  }: {
    label: string;
    isActive: boolean;
    colors: { bg: string; text: string };
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 600,
        border: isActive ? `1px solid ${colors.text}40` : "1px solid #e5e7eb",
        borderRadius: 5,
        cursor: "pointer",
        background: isActive ? colors.bg : "#f9fafb",
        color: isActive ? colors.text : "#9ca3af",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );

  const MiniBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        padding: "2px 6px",
        fontSize: 9,
        fontWeight: 600,
        border: "1px solid #d1d5db",
        borderRadius: 4,
        cursor: "pointer",
        background: "#fff",
        color: "#6b7280",
      }}
    >
      {label}
    </button>
  );

  const isMeasureSpec = spec?.outputType === "MEASURE";
  const isIdentityOrContent = spec?.specRole === "IDENTITY" || spec?.specRole === "CONTENT";
  const hasRichConfig = spec?.config && Object.keys(spec.config).length > 2;
  const hasPromptTemplate = spec?.promptTemplate && spec.promptTemplate.length > 100;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>Analysis Specs</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "6px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                width: 160,
                fontSize: 12,
              }}
            />
            <Link
              href="/x/spec-schema"
              style={{
                padding: "6px 12px",
                background: "#f3f4f6",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontWeight: 500,
                fontSize: 12,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Schema
            </Link>
          </div>
        </div>

        {/* Scope Filter Row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, minWidth: 40 }}>Scope</span>
          <MiniBtn label="ALL" onClick={() => setSelectedScopes(new Set(SCOPES))} />
          <MiniBtn label="CLR" onClick={() => setSelectedScopes(new Set())} />
          <div style={{ width: 1, height: 16, background: "#e5e7eb", margin: "0 4px" }} />
          {SCOPES.map((scope) => (
            <FilterPill
              key={scope}
              label={scope}
              isActive={selectedScopes.has(scope)}
              colors={scopeColors[scope]}
              onClick={() => toggleScope(scope)}
            />
          ))}
          <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 4 }}>
            {selectedScopes.size === 0 ? "all" : selectedScopes.size}
          </span>
        </div>

        {/* Type Filter Row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, minWidth: 40 }}>Type</span>
          <MiniBtn label="ALL" onClick={() => setSelectedTypes(new Set(TYPES))} />
          <MiniBtn label="CLR" onClick={() => setSelectedTypes(new Set())} />
          <div style={{ width: 1, height: 16, background: "#e5e7eb", margin: "0 4px" }} />
          {TYPES.map((type) => (
            <FilterPill
              key={type}
              label={type}
              isActive={selectedTypes.has(type)}
              colors={outputTypeColors[type]}
              onClick={() => toggleType(type)}
            />
          ))}
          <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 4 }}>
            {selectedTypes.size === 0 ? "all" : selectedTypes.size}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ padding: 16, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Master-Detail Layout */}
      <div style={{ display: "flex", gap: 16, minHeight: "calc(100vh - 220px)" }}>
        {/* List Panel */}
        <div style={{ width: 340, flexShrink: 0, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
          ) : filteredSpecs.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                background: "#f3f4f6",
                borderRadius: 12,
                border: "1px solid #d1d5db",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
                {search || selectedScopes.size > 0 || selectedTypes.size > 0 ? "No specs match filters" : "No specs yet"}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredSpecs.map((s) => (
                <div
                  key={s.id}
                  onClick={() => selectSpec(s.id)}
                  style={{
                    background: selectedId === s.id ? "#eef2ff" : "#fff",
                    border: selectedId === s.id ? "1px solid #4f46e5" : "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 12,
                    cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                >
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 6px",
                        background: scopeColors[s.scope]?.bg,
                        color: scopeColors[s.scope]?.text,
                        borderRadius: 4,
                      }}
                    >
                      {s.scope}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 6px",
                        background: outputTypeColors[s.outputType]?.bg || "#e5e7eb",
                        color: outputTypeColors[s.outputType]?.text || "#374151",
                        borderRadius: 4,
                      }}
                    >
                      {s.outputType}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{s.slug}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div style={{ flex: 1, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, overflowY: "auto" }}>
          {!selectedId ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 14 }}>Select a spec to view details</div>
              </div>
            </div>
          ) : detailLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading spec...</div>
          ) : detailError || !spec ? (
            <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
              {detailError || "Spec not found"}
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>{spec.name}</h2>
                <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace", marginTop: 4 }}>{spec.slug}</div>
              </div>

              {/* Badges */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: scopeColors[spec.scope]?.bg,
                    color: scopeColors[spec.scope]?.text,
                  }}
                >
                  {spec.scope}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: outputTypeColors[spec.outputType]?.bg,
                    color: outputTypeColors[spec.outputType]?.text,
                  }}
                >
                  {spec.outputType}
                </span>
                {spec.specRole && (
                  <span className={`text-xs px-2 py-1 rounded ${roleColors[spec.specRole] || "bg-neutral-100"}`}>
                    {spec.specRole}
                  </span>
                )}
                {spec.domain && (
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#cffafe", color: "#0e7490" }}>
                    {spec.domain}
                  </span>
                )}
                {featureSet && (
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#d1fae5", color: "#065f46" }}>
                    Has Source Spec
                  </span>
                )}
                {spec.isLocked && (
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#fee2e2", color: "#b91c1c" }}>
                    Locked
                  </span>
                )}
                {!spec.isActive && (
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#f3f4f6", color: "#6b7280" }}>
                    Inactive
                  </span>
                )}
              </div>

              {spec.description && (
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 13, color: "#4b5563" }}>
                  {spec.description}
                </div>
              )}

              {/* Data Flow Overview */}
              {featureSet && (
                <div style={{ background: "linear-gradient(to right, #eff6ff, #eef2ff)", border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1e3a8a", marginBottom: 8 }}>Data Flow</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, flexWrap: "wrap" }}>
                    <span style={{ background: "#dbeafe", color: "#1e40af", padding: "3px 8px", borderRadius: 4, fontFamily: "monospace" }}>
                      {featureSet.featureId}.spec.json
                    </span>
                    <span style={{ color: "#93c5fd" }}>→</span>
                    <span style={{ background: "#e9d5ff", color: "#6b21a8", padding: "3px 8px", borderRadius: 4 }}>
                      BDDFeatureSet
                    </span>
                    <span style={{ color: "#c4b5fd" }}>→</span>
                    <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "3px 8px", borderRadius: 4 }}>
                      AnalysisSpec
                    </span>
                    <span style={{ color: "#9ca3af", marginLeft: 8 }}>
                      ({featureSet.parameterCount} params, {featureSet.constraintCount} constraints)
                    </span>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div style={{ borderBottom: "1px solid #e5e7eb", marginBottom: 20 }}>
                <div style={{ display: "flex", gap: 16 }}>
                  <button
                    onClick={() => setActiveTab("derived")}
                    style={{
                      padding: "8px 0",
                      background: "none",
                      border: "none",
                      borderBottom: activeTab === "derived" ? "2px solid #4f46e5" : "2px solid transparent",
                      color: activeTab === "derived" ? "#4f46e5" : "#6b7280",
                      fontWeight: activeTab === "derived" ? 600 : 400,
                      fontSize: 13,
                      cursor: "pointer",
                      marginBottom: -1,
                    }}
                  >
                    Derived Output
                  </button>
                  {featureSet && (
                    <button
                      onClick={() => setActiveTab("source")}
                      style={{
                        padding: "8px 0",
                        background: "none",
                        border: "none",
                        borderBottom: activeTab === "source" ? "2px solid #4f46e5" : "2px solid transparent",
                        color: activeTab === "source" ? "#4f46e5" : "#6b7280",
                        fontWeight: activeTab === "source" ? 600 : 400,
                        fontSize: 13,
                        cursor: "pointer",
                        marginBottom: -1,
                      }}
                    >
                      Source Spec
                    </button>
                  )}
                </div>
              </div>

              {activeTab === "derived" && (
                <>
                  {/* Spec Role Selector */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                      Spec Role
                    </label>
                    <select
                      value={specRole}
                      onChange={(e) => handleSpecRoleChange(e.target.value)}
                      disabled={spec.isLocked}
                      style={{
                        width: "100%",
                        maxWidth: 300,
                        padding: "8px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        fontSize: 13,
                        background: spec.isLocked ? "#f3f4f6" : "#fff",
                      }}
                    >
                      <option value="">None</option>
                      <option value="IDENTITY">IDENTITY (who the agent is)</option>
                      <option value="CONTENT">CONTENT (domain knowledge)</option>
                      <option value="CONTEXT">CONTEXT (caller-specific)</option>
                      <option value="META">META (legacy)</option>
                    </select>
                  </div>

                  {/* Prompt Template */}
                  {(isMeasureSpec || hasPromptTemplate) && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
                          Compiled Prompt Template
                          {isMeasureSpec && (
                            <span style={{ marginLeft: 8, fontSize: 10, background: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: 4 }}>
                              Primary output for MEASURE specs
                            </span>
                          )}
                        </label>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>
                          {promptTemplate.length.toLocaleString()} chars
                        </span>
                      </div>
                      <textarea
                        value={promptTemplate}
                        onChange={(e) => handlePromptTemplateChange(e.target.value)}
                        disabled={spec.isLocked}
                        rows={isMeasureSpec ? 16 : 8}
                        style={{
                          width: "100%",
                          fontFamily: "monospace",
                          fontSize: 11,
                          border: "1px solid #d1d5db",
                          borderRadius: 8,
                          padding: 12,
                          background: spec.isLocked ? "#f3f4f6" : "#fff",
                          resize: "vertical",
                        }}
                        placeholder="Compiled prompt template..."
                      />
                    </div>
                  )}

                  {/* Config Editor */}
                  {(!isMeasureSpec || hasRichConfig) && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
                          Config (JSON)
                          {isIdentityOrContent && (
                            <span style={{ marginLeft: 8, fontSize: 10, background: "#e0e7ff", color: "#3730a3", padding: "2px 6px", borderRadius: 4 }}>
                              Primary output for {spec.specRole} specs
                            </span>
                          )}
                        </label>
                        <button
                          onClick={formatJson}
                          style={{ fontSize: 11, color: "#4f46e5", background: "none", border: "none", cursor: "pointer" }}
                        >
                          Format JSON
                        </button>
                      </div>
                      <div style={{ position: "relative" }}>
                        <textarea
                          value={configText}
                          onChange={(e) => handleConfigChange(e.target.value)}
                          disabled={spec.isLocked}
                          rows={isIdentityOrContent ? 16 : 8}
                          style={{
                            width: "100%",
                            fontFamily: "monospace",
                            fontSize: 11,
                            border: configError ? "1px solid #fca5a5" : "1px solid #d1d5db",
                            borderRadius: 8,
                            padding: 12,
                            background: configError ? "#fef2f2" : spec.isLocked ? "#f3f4f6" : "#fff",
                            resize: "vertical",
                          }}
                          placeholder="{}"
                        />
                        {configError && (
                          <div style={{ position: "absolute", bottom: 8, left: 8, right: 8, background: "#fee2e2", color: "#b91c1c", fontSize: 11, padding: 8, borderRadius: 4 }}>
                            JSON Error: {configError}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Save / Recompile Buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <button
                      onClick={handleSave}
                      disabled={saving || spec.isLocked || !hasChanges}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        fontWeight: 500,
                        fontSize: 13,
                        border: "none",
                        cursor: saving || spec.isLocked || !hasChanges ? "not-allowed" : "pointer",
                        background: saving || spec.isLocked || !hasChanges ? "#e5e7eb" : "#4f46e5",
                        color: saving || spec.isLocked || !hasChanges ? "#9ca3af" : "#fff",
                      }}
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    {featureSet && (
                      <button
                        onClick={handleRecompile}
                        disabled={recompiling || spec.isLocked}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 6,
                          fontWeight: 500,
                          fontSize: 13,
                          border: "none",
                          cursor: recompiling || spec.isLocked ? "not-allowed" : "pointer",
                          background: recompiling || spec.isLocked ? "#e5e7eb" : "#d97706",
                          color: recompiling || spec.isLocked ? "#9ca3af" : "#fff",
                        }}
                      >
                        {recompiling ? "Recompiling..." : "Recompile from Source"}
                      </button>
                    )}
                    {spec.compiledSetId && (
                      <button
                        onClick={handleExportToSource}
                        disabled={exporting || spec.isLocked}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 6,
                          fontWeight: 500,
                          fontSize: 13,
                          border: "none",
                          cursor: exporting || spec.isLocked ? "not-allowed" : "pointer",
                          background: exporting || spec.isLocked ? "#e5e7eb" : "#dc2626",
                          color: exporting || spec.isLocked ? "#9ca3af" : "#fff",
                        }}
                        title="Writes config parameters back to the .spec.json file on disk, then re-seeds the full pipeline"
                      >
                        {exporting ? "Writing & Re-seeding..." : "Write to Source & Re-seed"}
                      </button>
                    )}
                    {saveMessage && (
                      <span style={{ fontSize: 12, color: saveMessage.type === "success" ? "#16a34a" : "#dc2626" }}>
                        {saveMessage.text}
                      </span>
                    )}
                    {hasChanges && !saveMessage && (
                      <span style={{ fontSize: 12, color: "#d97706" }}>Unsaved changes</span>
                    )}
                  </div>
                </>
              )}

              {activeTab === "source" && featureSet && (
                <>
                  {/* Parameters */}
                  <div style={{ marginBottom: 20 }}>
                    <button
                      onClick={() => setShowParameters(!showParameters)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        marginBottom: 12,
                      }}
                    >
                      <span>{showParameters ? "▼" : "▶"}</span>
                      Parameters ({featureSet.parameterCount})
                    </button>
                    {showParameters && featureSet.parameters && featureSet.parameters.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {featureSet.parameters.map((param: any, idx: number) => (
                          <div key={param.id || idx} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                              <div>
                                <div style={{ fontWeight: 500, color: "#111827" }}>{param.name}</div>
                                <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{param.id}</div>
                              </div>
                              {param.targetRange && (
                                <span style={{ fontSize: 11, background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 4 }}>
                                  Target: {param.targetRange.min}-{param.targetRange.max}
                                </span>
                              )}
                            </div>
                            {param.definition && (
                              <p style={{ fontSize: 12, color: "#4b5563", margin: "0 0 8px 0" }}>{param.definition}</p>
                            )}
                            {param.interpretationScale && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", marginBottom: 4 }}>Interpretation Scale:</div>
                                <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                                  <span style={{ background: "#fef2f2", color: "#b91c1c", padding: "2px 8px", borderRadius: 4 }}>
                                    Low: {param.interpretationScale.low}
                                  </span>
                                  <span style={{ background: "#fefce8", color: "#a16207", padding: "2px 8px", borderRadius: 4 }}>
                                    Mid: {param.interpretationScale.mid}
                                  </span>
                                  <span style={{ background: "#f0fdf4", color: "#166534", padding: "2px 8px", borderRadius: 4 }}>
                                    High: {param.interpretationScale.high}
                                  </span>
                                </div>
                              </div>
                            )}
                            {param.scoringAnchors && param.scoringAnchors.length > 0 && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", marginBottom: 4 }}>Scoring Anchors:</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, fontSize: 10 }}>
                                  {param.scoringAnchors.map((anchor: any, ai: number) => (
                                    <div key={ai} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 4, padding: "4px 6px", textAlign: "center" }}>
                                      <div style={{ fontWeight: 600 }}>{anchor.score}</div>
                                      <div style={{ color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={anchor.label}>
                                        {anchor.label}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {showParameters && (!featureSet.parameters || featureSet.parameters.length === 0) && (
                      <p style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic" }}>No parameters defined in source spec</p>
                    )}
                  </div>

                  {/* Prompt Guidance */}
                  <div style={{ marginBottom: 20 }}>
                    <button
                      onClick={() => setShowPromptGuidance(!showPromptGuidance)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        marginBottom: 12,
                      }}
                    >
                      <span>{showPromptGuidance ? "▼" : "▶"}</span>
                      Prompt Guidance ({featureSet.promptGuidance?.length || 0})
                    </button>
                    {showPromptGuidance && featureSet.promptGuidance && featureSet.promptGuidance.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {featureSet.promptGuidance.map((guidance: any, idx: number) => (
                          <div key={idx} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
                            <div style={{ fontWeight: 500, color: "#111827", marginBottom: 8 }}>{guidance.parameterId}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 12 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 500, color: "#16a34a", marginBottom: 4 }}>When High:</div>
                                <p style={{ color: "#4b5563", margin: 0 }}>{guidance.whenHigh}</p>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 500, color: "#dc2626", marginBottom: 4 }}>When Low:</div>
                                <p style={{ color: "#4b5563", margin: 0 }}>{guidance.whenLow}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Raw Spec JSON */}
                  <div style={{ marginBottom: 20 }}>
                    <button
                      onClick={() => setShowRawSpec(!showRawSpec)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        marginBottom: 12,
                      }}
                    >
                      <span>{showRawSpec ? "▼" : "▶"}</span>
                      Raw Spec JSON (Source)
                    </button>
                    {showRawSpec && featureSet.rawSpec && (
                      <pre style={{ background: "#1f2937", color: "#e5e7eb", fontSize: 11, fontFamily: "monospace", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 400 }}>
                        {JSON.stringify(featureSet.rawSpec, null, 2)}
                      </pre>
                    )}
                    {showRawSpec && !featureSet.rawSpec && (
                      <p style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic" }}>No rawSpec stored</p>
                    )}
                  </div>

                  {/* Feature Set Metadata */}
                  <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 20 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 12 }}>BDDFeatureSet Metadata</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, fontSize: 12 }}>
                      <div>
                        <div style={{ color: "#6b7280" }}>Feature ID</div>
                        <div style={{ fontFamily: "monospace", color: "#111827" }}>{featureSet.featureId}</div>
                      </div>
                      <div>
                        <div style={{ color: "#6b7280" }}>Version</div>
                        <div style={{ color: "#111827" }}>{featureSet.version}</div>
                      </div>
                      <div>
                        <div style={{ color: "#6b7280" }}>Spec Type</div>
                        <div style={{ color: "#111827" }}>{featureSet.specType}</div>
                      </div>
                      <div>
                        <div style={{ color: "#6b7280" }}>Updated At</div>
                        <div style={{ color: "#111827" }}>{new Date(featureSet.updatedAt).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ color: "#6b7280" }}>Activated At</div>
                        <div style={{ color: "#111827" }}>{featureSet.activatedAt ? new Date(featureSet.activatedAt).toLocaleString() : "—"}</div>
                      </div>
                      <div>
                        <div style={{ color: "#6b7280" }}>Status</div>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: featureSet.isActive ? "#dcfce7" : "#f3f4f6", color: featureSet.isActive ? "#166534" : "#6b7280" }}>
                          {featureSet.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* AnalysisSpec Metadata */}
              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 20, marginTop: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 12 }}>AnalysisSpec Metadata</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, fontSize: 12 }}>
                  <div>
                    <div style={{ color: "#6b7280" }}>ID</div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: "#111827" }}>{spec.id}</div>
                  </div>
                  <div>
                    <div style={{ color: "#6b7280" }}>Priority</div>
                    <div style={{ color: "#111827" }}>{spec.priority}</div>
                  </div>
                  <div>
                    <div style={{ color: "#6b7280" }}>Version</div>
                    <div style={{ color: "#111827" }}>{spec.version || "—"}</div>
                  </div>
                  <div>
                    <div style={{ color: "#6b7280" }}>Compiled At</div>
                    <div style={{ color: "#111827" }}>{spec.compiledAt ? new Date(spec.compiledAt).toLocaleString() : "Never"}</div>
                  </div>
                  <div>
                    <div style={{ color: "#6b7280" }}>Created</div>
                    <div style={{ color: "#111827" }}>{new Date(spec.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div style={{ color: "#6b7280" }}>Linked FeatureSet</div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: "#111827" }}>
                      {spec.compiledSetId ? spec.compiledSetId.slice(0, 8) + "..." : "None"}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
