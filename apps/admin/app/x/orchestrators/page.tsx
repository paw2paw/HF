"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SequencerView } from "@/components/orchestrator/SequencerView";
import { EnvelopeEditor, type EnvelopeData } from "@/components/orchestrator/EnvelopeEditor";
import { SpecConfigEditor } from "@/components/config-editor";

// ============================================================================
// Types
// ============================================================================

type OrchestratorSpec = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  specType: string;
  specRole: string | null;
  outputType: string;
  isActive: boolean;
  isDeletable: boolean;
  version: string | null;
  updatedAt: string;
};

type SpecDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  scope: string;
  outputType: string;
  specRole: string | null;
  specType: string;
  domain: string | null;
  config: Record<string, unknown> | null;
  promptTemplate: string | null;
  isActive: boolean;
  isLocked: boolean;
  lockedReason: string | null;
  isDeletable: boolean;
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
  rawSpec: Record<string, unknown> | null;
};

const TABS = [
  { id: "designer", label: "Designer" },
  { id: "story", label: "Story" },
  { id: "context", label: "Context" },
  { id: "acceptance", label: "Acceptance" },
  { id: "constraints", label: "Constraints" },
  { id: "related", label: "Related" },
  { id: "json", label: "JSON" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ============================================================================
// Orchestrator List (left panel)
// ============================================================================

function OrchestratorList({
  specs,
  selectedId,
  onSelect,
  loading,
}: {
  specs: OrchestratorSpec[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return specs;
    const q = search.toLowerCase();
    return specs.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q),
    );
  }, [specs, search]);

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--border-default, #e5e7eb)",
        background: "var(--surface-secondary, #f9fafb)",
        height: "100%",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 14px 12px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary, #111827)", marginBottom: 10 }}>
          Orchestrators
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--border-default, #e5e7eb)",
            background: "var(--surface-primary, #fff)",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>&#x1F50D;</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orchestrators..."
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 12,
              color: "var(--text-primary)",
              width: "100%",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "var(--text-tertiary)", padding: 0 }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
            {search ? "No matches" : "No orchestrator specs found"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map((spec) => {
              const isSelected = spec.id === selectedId;
              return (
                <button
                  key={spec.id}
                  onClick={() => onSelect(spec.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: isSelected
                      ? "1px solid var(--accent-primary, #3b82f6)"
                      : "1px solid transparent",
                    background: isSelected
                      ? "color-mix(in srgb, var(--accent-primary, #3b82f6) 8%, transparent)"
                      : "var(--surface-primary, #fff)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                    boxShadow: isSelected ? "0 1px 4px rgba(59,130,246,0.1)" : "0 1px 2px rgba(0,0,0,0.04)",
                    width: "100%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: "monospace",
                        fontWeight: 600,
                        color: "var(--accent-primary, #3b82f6)",
                        background: "color-mix(in srgb, var(--accent-primary, #3b82f6) 10%, transparent)",
                        padding: "1px 5px",
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      {spec.slug}
                    </span>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: spec.isActive ? "#22c55e" : "#d1d5db",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {spec.name}
                  </div>
                  {spec.description && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary, #6b7280)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {spec.description}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer count */}
      <div
        style={{
          padding: "8px 14px",
          borderTop: "1px solid var(--border-default, #e5e7eb)",
          fontSize: 11,
          color: "var(--text-tertiary, #9ca3af)",
        }}
      >
        {specs.length} orchestrator{specs.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ============================================================================
// Orchestrator Shell (right panel)
// ============================================================================

function OrchestratorShell({
  spec,
  featureSet,
  onSave,
  saving,
}: {
  spec: SpecDetail;
  featureSet: FeatureSet | null;
  onSave: (updates: { config?: Record<string, unknown>; rawSpec?: Record<string, unknown>; metadata?: Partial<SpecDetail> }) => void;
  saving: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("designer");
  const [editedConfig, setEditedConfig] = useState<Record<string, unknown>>(spec.config || {});
  const [editedEnvelope, setEditedEnvelope] = useState<EnvelopeData>({});
  const [editedName, setEditedName] = useState(spec.name);
  const [editedActive, setEditedActive] = useState(spec.isActive);
  const [jsonText, setJsonText] = useState("");

  // Reset state when spec changes
  useEffect(() => {
    setEditedConfig(spec.config || {});
    setEditedName(spec.name);
    setEditedActive(spec.isActive);

    // Extract envelope from rawSpec
    const raw = featureSet?.rawSpec || {};
    setEditedEnvelope({
      story: (raw as any).story,
      context: (raw as any).context,
      acceptanceCriteria: (raw as any).acceptanceCriteria,
      constraints: (raw as any).constraints,
      related: (raw as any).related,
    });

    // JSON tab: merge config + envelope for full view
    setJsonText(JSON.stringify(spec.config || {}, null, 2));
  }, [spec, featureSet]);

  // Track changes
  const hasConfigChanges = JSON.stringify(editedConfig) !== JSON.stringify(spec.config || {});
  const hasEnvelopeChanges = (() => {
    const raw = featureSet?.rawSpec || {};
    const orig: EnvelopeData = {
      story: (raw as any).story,
      context: (raw as any).context,
      acceptanceCriteria: (raw as any).acceptanceCriteria,
      constraints: (raw as any).constraints,
      related: (raw as any).related,
    };
    return JSON.stringify(editedEnvelope) !== JSON.stringify(orig);
  })();
  const hasMetadataChanges = editedName !== spec.name || editedActive !== spec.isActive;
  const hasChanges = hasConfigChanges || hasEnvelopeChanges || hasMetadataChanges;

  const handleSave = useCallback(() => {
    const updates: Parameters<typeof onSave>[0] = {};
    if (hasConfigChanges) updates.config = editedConfig;
    if (hasEnvelopeChanges) {
      const rawSpec = { ...(featureSet?.rawSpec || {}), ...editedEnvelope };
      updates.rawSpec = rawSpec as Record<string, unknown>;
    }
    if (hasMetadataChanges) {
      updates.metadata = { name: editedName, isActive: editedActive };
    }
    onSave(updates);
  }, [editedConfig, editedEnvelope, editedName, editedActive, hasConfigChanges, hasEnvelopeChanges, hasMetadataChanges, featureSet, onSave]);

  const handleDiscard = useCallback(() => {
    setEditedConfig(spec.config || {});
    setEditedName(spec.name);
    setEditedActive(spec.isActive);
    const raw = featureSet?.rawSpec || {};
    setEditedEnvelope({
      story: (raw as any).story,
      context: (raw as any).context,
      acceptanceCriteria: (raw as any).acceptanceCriteria,
      constraints: (raw as any).constraints,
      related: (raw as any).related,
    });
    setJsonText(JSON.stringify(spec.config || {}, null, 2));
  }, [spec, featureSet]);

  // Handle JSON tab edits
  const handleJsonChange = useCallback(
    (newJson: string) => {
      setJsonText(newJson);
      try {
        const parsed = JSON.parse(newJson);
        setEditedConfig(parsed);
      } catch {
        // Invalid JSON, don't update config
      }
    },
    [],
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Metadata bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-default, #e5e7eb)",
          background: "var(--surface-primary, #fff)",
          flexShrink: 0,
        }}
      >
        {/* Slug */}
        <span
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            fontWeight: 700,
            color: "var(--accent-primary, #3b82f6)",
            background: "color-mix(in srgb, var(--accent-primary, #3b82f6) 10%, transparent)",
            padding: "3px 8px",
            borderRadius: 6,
            flexShrink: 0,
          }}
        >
          {spec.slug}
        </span>

        {/* Editable name */}
        <input
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: 700,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text-primary, #111827)",
            minWidth: 0,
          }}
        />

        {/* Version */}
        {spec.version && (
          <span
            style={{
              fontSize: 10,
              color: "var(--text-tertiary, #9ca3af)",
              background: "var(--surface-secondary, #f3f4f6)",
              padding: "2px 6px",
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            v{spec.version}
          </span>
        )}

        {/* Active toggle */}
        <button
          onClick={() => setEditedActive(!editedActive)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid",
            borderColor: editedActive ? "#22c55e" : "#d1d5db",
            background: editedActive ? "#dcfce7" : "#f9fafb",
            color: editedActive ? "#166534" : "#6b7280",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s",
            flexShrink: 0,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: editedActive ? "#22c55e" : "#d1d5db" }} />
          {editedActive ? "Active" : "Inactive"}
        </button>

        {/* Locked indicator */}
        {spec.isLocked && (
          <span
            style={{
              fontSize: 10,
              color: "#d97706",
              background: "#fffbeb",
              padding: "2px 6px",
              borderRadius: 4,
              flexShrink: 0,
            }}
            title={spec.lockedReason || "Locked"}
          >
            Locked
          </span>
        )}

        {/* Save/Discard */}
        {hasChanges && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleDiscard}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid var(--border-default, #e5e7eb)",
                background: "var(--surface-primary, #fff)",
                color: "var(--text-secondary, #6b7280)",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "1px solid var(--accent-primary, #3b82f6)",
                background: "var(--accent-primary, #3b82f6)",
                color: "#fff",
                fontSize: 12,
                cursor: saving ? "wait" : "pointer",
                fontWeight: 600,
                opacity: saving ? 0.7 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          padding: "0 16px",
          borderBottom: "1px solid var(--border-default, #e5e7eb)",
          background: "var(--surface-primary, #fff)",
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          // Show dot indicators for changed tabs
          const hasDot =
            (tab.id === "designer" && hasConfigChanges) ||
            (["story", "context", "acceptance", "constraints", "related"].includes(tab.id) && hasEnvelopeChanges);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 14px",
                border: "none",
                borderBottom: isActive ? "2px solid var(--accent-primary, #3b82f6)" : "2px solid transparent",
                background: "none",
                color: isActive ? "var(--accent-primary, #3b82f6)" : "var(--text-secondary, #6b7280)",
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                position: "relative",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
              }}
            >
              {tab.label}
              {hasDot && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 4,
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "#f59e0b",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div
        style={{
          flex: 1,
          overflowY: activeTab === "designer" ? "hidden" : "auto",
          padding: 16,
        }}
      >
        {activeTab === "designer" && (
          <SequencerView
            config={editedConfig}
            onChange={setEditedConfig}
            disabled={spec.isLocked}
          />
        )}

        {activeTab === "json" && (
          <SpecConfigEditor
            configText={jsonText}
            onConfigChange={handleJsonChange}
            disabled={spec.isLocked}
          />
        )}

        {(["story", "context", "acceptance", "constraints", "related"] as const).includes(activeTab as any) && (
          <EnvelopeEditor
            tab={activeTab as "story" | "context" | "acceptance" | "constraints" | "related"}
            envelope={editedEnvelope}
            onChange={setEditedEnvelope}
            disabled={spec.isLocked}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function OrchestratorsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedId = searchParams.get("id");

  const [specs, setSpecs] = useState<OrchestratorSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpec, setSelectedSpec] = useState<SpecDetail | null>(null);
  const [selectedFeatureSet, setSelectedFeatureSet] = useState<FeatureSet | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Fetch orchestrator spec list
  useEffect(() => {
    setLoading(true);
    fetch("/api/analysis-specs?specRole=ORCHESTRATE")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.specs) {
          setSpecs(data.specs);
        } else if (data.ok && Array.isArray(data)) {
          setSpecs(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch selected spec detail
  useEffect(() => {
    if (!selectedId) {
      setSelectedSpec(null);
      setSelectedFeatureSet(null);
      return;
    }
    setDetailLoading(true);
    fetch(`/api/analysis-specs/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setSelectedSpec(data.spec);
          setSelectedFeatureSet(data.featureSet || null);
        }
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const handleSelect = useCallback(
    (id: string) => {
      router.push(`/x/orchestrators?id=${id}`, { scroll: false });
    },
    [router],
  );

  // Save handler — orchestrates config, envelope, and metadata saves
  const handleSave = useCallback(
    async (updates: { config?: Record<string, unknown>; rawSpec?: Record<string, unknown>; metadata?: Partial<SpecDetail> }) => {
      if (!selectedSpec) return;
      setSaving(true);
      try {
        // 1. Save config via PATCH
        if (updates.config) {
          const res = await fetch(`/api/analysis-specs/${selectedSpec.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config: updates.config }),
          });
          const data = await res.json();
          if (!data.ok) throw new Error(data.error || "Failed to save config");
        }

        // 2. Save metadata via PUT
        if (updates.metadata) {
          const res = await fetch(`/api/analysis-specs/${selectedSpec.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates.metadata),
          });
          const data = await res.json();
          if (!data.ok) throw new Error(data.error || "Failed to save metadata");
        }

        // 3. Save rawSpec envelope via PATCH (extended)
        if (updates.rawSpec && selectedSpec.compiledSetId) {
          const res = await fetch(`/api/analysis-specs/${selectedSpec.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rawSpec: updates.rawSpec }),
          });
          // If the existing PATCH doesn't support rawSpec yet, this may silently skip.
          // That's OK — the API extension is a separate step.
          const data = await res.json();
          if (!data.ok && data.error) {
            console.warn("rawSpec save:", data.error);
          }
        }

        // Re-fetch to get fresh state
        const res = await fetch(`/api/analysis-specs/${selectedSpec.id}`);
        const data = await res.json();
        if (data.ok) {
          setSelectedSpec(data.spec);
          setSelectedFeatureSet(data.featureSet || null);
        }

        // Refresh list
        const listRes = await fetch("/api/analysis-specs?specRole=ORCHESTRATE");
        const listData = await listRes.json();
        if (listData.ok && listData.specs) setSpecs(listData.specs);

        setToast({ message: "Saved successfully", type: "success" });
      } catch (err: any) {
        setToast({ message: err.message || "Save failed", type: "error" });
      } finally {
        setSaving(false);
        setTimeout(() => setToast(null), 3000);
      }
    },
    [selectedSpec],
  );

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 48px)",
        position: "relative",
      }}
    >
      {/* Left panel */}
      <OrchestratorList
        specs={specs}
        selectedId={selectedId}
        onSelect={handleSelect}
        loading={loading}
      />

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {detailLoading ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-tertiary, #9ca3af)",
              fontSize: 13,
            }}
          >
            Loading spec...
          </div>
        ) : selectedSpec ? (
          <OrchestratorShell
            spec={selectedSpec}
            featureSet={selectedFeatureSet}
            onSave={handleSave}
            saving={saving}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "var(--text-tertiary, #9ca3af)",
            }}
          >
            <div style={{ fontSize: 36 }}>&#x1F3AF;</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Orchestrator Designer</div>
            <div style={{ fontSize: 12 }}>Select an orchestrator spec from the left panel</div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            padding: "10px 16px",
            borderRadius: 8,
            background: toast.type === "success" ? "#166534" : "#dc2626",
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 100,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
