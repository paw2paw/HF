"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

// =============================================================================
// Types
// =============================================================================

type ParameterSpec = {
  id: string;
  slug: string;
  name: string;
  outputType: string;
  scope: string;
  domain: string | null;
  isActive: boolean;
  actionCount: number;
  triggers: string[];
};

type ParameterPlaybook = {
  id: string;
  name: string;
  status: string;
  domain: { id: string; name: string; slug: string } | null;
};

type ScoringAnchor = {
  id: string;
  score: number;
  example: string;
  rationale: string | null;
  isGold: boolean;
};

type BehaviorTarget = {
  id: string;
  scope: string;
  targetValue: number;
  confidence: number;
  source: string;
  playbook: { id: string; name: string } | null;
};

type PromptSlugLink = {
  id: string;
  slug: string;
  name: string;
};

type Parameter = {
  id: string;
  parameterId: string;
  name: string;
  definition: string | null;
  domainGroup: string;
  sectionId: string | null;
  scaleType: string;
  directionality: string | null;
  computedBy: string | null;
  interpretationHigh: string | null;
  interpretationLow: string | null;
  measurementMvp: string | null;
  measurementVoiceOnly: string | null;
  isActive: boolean;
  sourceFeatureSet?: {
    id: string;
    featureId: string;
    name: string;
    version: string;
  } | null;
  scoringAnchors: ScoringAnchor[];
  behaviorTargets: BehaviorTarget[];
  specs: ParameterSpec[];
  playbooks: ParameterPlaybook[];
  promptSlugs: PromptSlugLink[];
  _counts: {
    specs: number;
    activeSpecs: number;
    playbooks: number;
    behaviorTargets: number;
    promptSlugs: number;
    scoringAnchors: number;
  };
};

type ParameterSummary = {
  total: number;
  active: number;
  withSpecs: number;
  withPlaybooks: number;
  withTargets: number;
  withAnchors: number;
  orphaned: number;
  byDomainGroup: Record<string, number>;
};

// =============================================================================
// Colors & Styles
// =============================================================================

const DOMAIN_COLORS: Record<string, { bg: string; text: string }> = {
  personality: { bg: "#f3e8ff", text: "#7c3aed" },
  behavior: { bg: "#dbeafe", text: "#2563eb" },
  conversation: { bg: "#ccfbf1", text: "#0d9488" },
  companion: { bg: "#fef3c7", text: "#d97706" },
  tutor: { bg: "#fce7f3", text: "#be185d" },
  mvp: { bg: "#dcfce7", text: "#16a34a" },
  learner: { bg: "#e0f2fe", text: "#0369a1" },
};


const OUTPUT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  LEARN: { bg: "#fef3c7", text: "#d97706" },
  MEASURE: { bg: "#e0e7ff", text: "#4f46e5" },
  ADAPT: { bg: "#ccfbf1", text: "#0d9488" },
  COMPOSE: { bg: "#fef9c3", text: "#a16207" },
};

function getDomainColor(domain: string | null) {
  if (!domain) return { bg: "#f9fafb", text: "#6b7280" };
  return DOMAIN_COLORS[domain.toLowerCase()] || { bg: "#f9fafb", text: "#6b7280" };
}

// =============================================================================
// Dynamic Prompts Modal Component
// =============================================================================

function DynamicPromptsModal({
  isOpen,
  onClose,
  parameterId,
  parameterName,
  rowId,
  onUpdate,
}: {
  isOpen: boolean;
  onClose: () => void;
  parameterId: string;
  parameterName: string;
  rowId: string;
  onUpdate: () => void;
}) {
  const [links, setLinks] = useState<any[]>([]);
  const [availableSlugs, setAvailableSlugs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlugId, setSelectedSlugId] = useState("");
  const [newLinkWeight, setNewLinkWeight] = useState(1.0);
  const [newLinkMode, setNewLinkMode] = useState<"ABSOLUTE" | "DELTA">("ABSOLUTE");

  useEffect(() => {
    if (isOpen && rowId) {
      fetchData();
    }
  }, [isOpen, rowId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/parameters/${rowId}/prompts`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setLinks(data.links || []);
      setAvailableSlugs(data.availableSlugs || []);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAttach = async () => {
    if (!selectedSlugId) return;
    try {
      const res = await fetch(`/api/parameters/${rowId}/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slugId: selectedSlugId,
          weight: newLinkWeight,
          mode: newLinkMode,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSelectedSlugId("");
      setNewLinkWeight(1.0);
      setNewLinkMode("ABSOLUTE");
      fetchData();
      onUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to attach prompt");
    }
  };

  const handleDetach = async (slugId: string) => {
    if (!confirm("Detach this dynamic prompt?")) return;
    try {
      const res = await fetch(`/api/parameters/${rowId}/prompts?slugId=${slugId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      fetchData();
      onUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to detach prompt");
    }
  };

  const linkedSlugIds = new Set(links.map((l) => l.slug?.id));
  const unlinkedSlugs = availableSlugs.filter((s) => !linkedSlugIds.has(s.id));

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "24px",
          width: "600px",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>Dynamic Prompts</h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
              Parameter: <strong>{parameterName}</strong> ({parameterId})
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#9ca3af",
            }}
          >
            x
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              color: "#dc2626",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>Loading...</div>
        ) : (
          <>
            {/* Linked Prompts */}
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>
                Linked Dynamic Prompts ({links.length})
              </h3>
              {links.length === 0 ? (
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "6px",
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: "13px",
                  }}
                >
                  No dynamic prompts linked yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {links.map((link: any) => (
                    <div
                      key={link.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px",
                        backgroundColor: "#f9fafb",
                        borderRadius: "6px",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "10px",
                              fontWeight: "500",
                              backgroundColor: link.slug?.sourceType === "COMPOSITE" ? "#f59e0b" : "#6366f1",
                              color: "white",
                            }}
                          >
                            {link.slug?.sourceType}
                          </span>
                          <span style={{ fontWeight: "500", fontSize: "14px" }}>{link.slug?.name}</span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>{link.slug?.slug}</div>
                      </div>
                      <button
                        onClick={() => handleDetach(link.slug?.id)}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#fee2e2",
                          color: "#dc2626",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        Detach
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attach New Prompt */}
            <div
              style={{
                padding: "16px",
                backgroundColor: "#f0fdf4",
                borderRadius: "6px",
                border: "1px solid #bbf7d0",
              }}
            >
              <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#166534" }}>
                Attach New Dynamic Prompt
              </h3>
              {unlinkedSlugs.length === 0 ? (
                <div style={{ fontSize: "13px", color: "#6b7280" }}>
                  All available dynamic prompts are already linked.
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <label style={{ display: "block", fontSize: "12px", color: "#374151", marginBottom: "4px" }}>
                      Dynamic Prompt
                    </label>
                    <select
                      value={selectedSlugId}
                      onChange={(e) => setSelectedSlugId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        fontSize: "13px",
                      }}
                    >
                      <option value="">Select a dynamic prompt...</option>
                      {unlinkedSlugs.map((slug: any) => (
                        <option key={slug.id} value={slug.id}>
                          [{slug.sourceType}] {slug.name} ({slug.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleAttach}
                    disabled={!selectedSlugId}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: selectedSlugId ? "#10b981" : "#d1d5db",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: selectedSlugId ? "pointer" : "not-allowed",
                    }}
                  >
                    Attach
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Edit Drawer Component
// =============================================================================

function EditDrawer({
  isOpen,
  onClose,
  parameter,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  parameter: Parameter | null;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState<Partial<Parameter>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (parameter) {
      setFormData({
        name: parameter.name,
        definition: parameter.definition,
        domainGroup: parameter.domainGroup,
        sectionId: parameter.sectionId,
        scaleType: parameter.scaleType,
        directionality: parameter.directionality,
        computedBy: parameter.computedBy,
        interpretationHigh: parameter.interpretationHigh,
        interpretationLow: parameter.interpretationLow,
        measurementMvp: parameter.measurementMvp,
        measurementVoiceOnly: parameter.measurementVoiceOnly,
      });
    }
  }, [parameter]);

  const handleSave = async () => {
    if (!parameter) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/parameters/${parameter.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !parameter) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.3)",
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "520px",
          backgroundColor: "white",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>Edit Parameter</h2>
            <code
              style={{
                fontSize: "13px",
                color: "#6b7280",
                background: "#f3f4f6",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              {parameter.parameterId}
            </code>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#9ca3af",
            }}
          >
            x
          </button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          {error && (
            <div
              style={{
                padding: "12px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                color: "#dc2626",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>Name</label>
              <input
                type="text"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>
                  Domain Group
                </label>
                <input
                  type="text"
                  value={formData.domainGroup || ""}
                  onChange={(e) => setFormData({ ...formData, domainGroup: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>
                  Section ID
                </label>
                <input
                  type="text"
                  value={formData.sectionId || ""}
                  onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>
                  Scale Type
                </label>
                <input
                  type="text"
                  value={formData.scaleType || ""}
                  onChange={(e) => setFormData({ ...formData, scaleType: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>
                  Directionality
                </label>
                <input
                  type="text"
                  value={formData.directionality || ""}
                  onChange={(e) => setFormData({ ...formData, directionality: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>
                Definition
              </label>
              <textarea
                value={formData.definition || ""}
                onChange={(e) => setFormData({ ...formData, definition: e.target.value })}
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  resize: "vertical",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>
                Interpretation (High)
              </label>
              <input
                type="text"
                value={formData.interpretationHigh || ""}
                onChange={(e) => setFormData({ ...formData, interpretationHigh: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>
                Interpretation (Low)
              </label>
              <input
                type="text"
                value={formData.interpretationLow || ""}
                onChange={(e) => setFormData({ ...formData, interpretationLow: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>
                Computed By
              </label>
              <input
                type="text"
                value={formData.computedBy || ""}
                onChange={(e) => setFormData({ ...formData, computedBy: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              backgroundColor: "white",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 20px",
              backgroundColor: saving ? "#9ca3af" : "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Parameter Row Component
// =============================================================================

function ParameterRow({
  param,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  onEdit,
  onRefresh,
}: {
  param: Parameter;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const [promptsModalOpen, setPromptsModalOpen] = useState(false);
  const domainColor = getDomainColor(param.domainGroup);
  const hasRelationships = param._counts.specs > 0 || param._counts.playbooks > 0 || param._counts.behaviorTargets > 0;

  return (
    <>
      <tr
        style={{
          borderBottom: isExpanded ? "none" : "1px solid #f3f4f6",
          backgroundColor: isSelected ? "#eff6ff" : "transparent",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = "#f9fafb";
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        {/* Checkbox */}
        <td style={{ padding: "12px 8px", width: "40px" }} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            style={{ cursor: "pointer", width: "16px", height: "16px" }}
          />
        </td>

        {/* Expand arrow + Parameter ID */}
        <td style={{ padding: "12px 16px" }} onClick={onToggleExpand}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#9ca3af", fontSize: "10px" }}>{isExpanded ? "v" : ">"}</span>
            <code
              style={{
                background: "#e0e7ff",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#4338ca",
                fontWeight: 500,
              }}
            >
              {param.parameterId}
            </code>
            {param.sourceFeatureSet && (
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  background: "#d1fae5",
                  color: "#059669",
                }}
              >
                {param.sourceFeatureSet.name}
              </span>
            )}
          </div>
        </td>

        {/* Name */}
        <td style={{ padding: "12px 16px", color: "#374151", fontWeight: 500 }} onClick={onToggleExpand}>
          {param.name}
        </td>

        {/* Domain Group */}
        <td style={{ padding: "12px 16px" }} onClick={onToggleExpand}>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 500,
              background: domainColor.bg,
              color: domainColor.text,
            }}
          >
            {param.domainGroup}
          </span>
        </td>

        {/* Scale Type */}
        <td style={{ padding: "12px 16px", color: "#6b7280", fontSize: "12px" }} onClick={onToggleExpand}>
          {param.scaleType}
        </td>

        {/* Relationships */}
        <td style={{ padding: "12px 16px" }} onClick={onToggleExpand}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {param._counts.specs > 0 && (
              <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", background: "#eef2ff", color: "#4338ca" }}>
                {param._counts.specs} specs
              </span>
            )}
            {param._counts.playbooks > 0 && (
              <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", background: "#fff7ed", color: "#c2410c" }}>
                {param._counts.playbooks} playbooks
              </span>
            )}
            {param._counts.behaviorTargets > 0 && (
              <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", background: "#f0fdf4", color: "#166534" }}>
                {param._counts.behaviorTargets} targets
              </span>
            )}
            {param._counts.scoringAnchors > 0 && (
              <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", background: "#fef3c7", color: "#92400e" }}>
                {param._counts.scoringAnchors} anchors
              </span>
            )}
            {param._counts.promptSlugs > 0 && (
              <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", background: "#fdf4ff", color: "#86198f" }}>
                {param._counts.promptSlugs} slugs
              </span>
            )}
            {!hasRelationships && (
              <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", background: "#fee2e2", color: "#991b1b" }}>
                orphan
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded Detail Row */}
      {isExpanded && (
        <tr>
          <td colSpan={6} style={{ padding: 0, background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ padding: "20px 24px 20px 64px" }}>
              {/* Definition */}
              {param.definition && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "4px", textTransform: "uppercase" }}>
                    Definition
                  </div>
                  <div style={{ fontSize: "13px", color: "#374151", lineHeight: 1.5 }}>{param.definition}</div>
                </div>
              )}

              {/* Interpretation */}
              {(param.interpretationHigh || param.interpretationLow) && (
                <div style={{ marginBottom: "16px", display: "flex", gap: "24px" }}>
                  {param.interpretationHigh && (
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#16a34a", marginBottom: "4px" }}>HIGH means</div>
                      <div style={{ fontSize: "12px", color: "#374151" }}>{param.interpretationHigh}</div>
                    </div>
                  )}
                  {param.interpretationLow && (
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#dc2626", marginBottom: "4px" }}>LOW means</div>
                      <div style={{ fontSize: "12px", color: "#374151" }}>{param.interpretationLow}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Related Specs */}
              {param.specs.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "8px", textTransform: "uppercase" }}>
                    Used in Analysis Specs ({param.specs.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {param.specs.slice(0, 8).map((spec) => {
                      const typeColor = OUTPUT_TYPE_COLORS[spec.outputType] || { bg: "#f3f4f6", text: "#6b7280" };
                      return (
                        <Link
                          key={spec.id}
                          href={`/analysis-specs?select=${spec.id}`}
                          style={{ textDecoration: "none" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              background: typeColor.bg,
                              color: typeColor.text,
                              border: `1px solid ${typeColor.text}20`,
                              opacity: spec.isActive ? 1 : 0.5,
                            }}
                          >
                            {spec.name}
                          </span>
                        </Link>
                      );
                    })}
                    {param.specs.length > 8 && (
                      <span style={{ fontSize: "11px", color: "#6b7280", alignSelf: "center" }}>+{param.specs.length - 8} more</span>
                    )}
                  </div>
                </div>
              )}

              {/* Related Playbooks */}
              {param.playbooks.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "8px", textTransform: "uppercase" }}>
                    Included in Playbooks ({param.playbooks.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {param.playbooks.map((pb) => (
                      <Link
                        key={pb.id}
                        href={`/playbooks/${pb.id}`}
                        style={{ textDecoration: "none" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            background: "#fff7ed",
                            color: "#c2410c",
                            border: "1px solid #fed7aa",
                          }}
                        >
                          {pb.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt Slugs */}
              {param.promptSlugs.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "8px", textTransform: "uppercase" }}>
                    Prompt Slugs ({param.promptSlugs.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {param.promptSlugs.map((slug) => (
                      <Link
                        key={slug.id}
                        href={`/prompt-slugs?select=${slug.id}`}
                        style={{ textDecoration: "none" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            background: "#fdf4ff",
                            color: "#86198f",
                            border: "1px solid #f5d0fe",
                          }}
                        >
                          {slug.name || slug.slug}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions Row */}
              <div style={{ display: "flex", gap: "12px", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
                <button
                  onClick={onEdit}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#4f46e5",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  Edit Parameter
                </button>
                <button
                  onClick={() => setPromptsModalOpen(true)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "white",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  Manage Dynamic Prompts
                </button>
              </div>

              {/* No relationships warning */}
              {!hasRelationships && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px 16px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                    color: "#991b1b",
                    fontSize: "13px",
                  }}
                >
                  This parameter is not referenced by any specs, playbooks, or behavior targets. Consider removing it or connecting it to the system.
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      <DynamicPromptsModal
        isOpen={promptsModalOpen}
        onClose={() => setPromptsModalOpen(false)}
        parameterId={param.parameterId}
        parameterName={param.name}
        rowId={param.id}
        onUpdate={onRefresh}
      />
    </>
  );
}

// =============================================================================
// Bulk Actions Bar Component
// =============================================================================

function BulkActionsBar({
  selectedCount,
  onDelete,
  onClear,
}: {
  selectedCount: number;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "#1f2937",
        padding: "12px 20px",
        borderRadius: "12px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        zIndex: 100,
      }}
    >
      <span style={{ color: "white", fontSize: "14px", fontWeight: "500" }}>{selectedCount} selected</span>

      <div style={{ width: "1px", height: "24px", backgroundColor: "#4b5563" }} />

      <button
        onClick={onDelete}
        style={{
          padding: "8px 16px",
          backgroundColor: "#ef4444",
          color: "white",
          border: "none",
          borderRadius: "6px",
          fontSize: "13px",
          fontWeight: "500",
          cursor: "pointer",
        }}
      >
        Delete
      </button>

      <button
        onClick={onClear}
        style={{
          padding: "6px",
          backgroundColor: "transparent",
          color: "#9ca3af",
          border: "none",
          borderRadius: "4px",
          fontSize: "18px",
          cursor: "pointer",
          marginLeft: "8px",
        }}
      >
        x
      </button>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function ParametersPage() {
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [summary, setSummary] = useState<ParameterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [showOrphansOnly, setShowOrphansOnly] = useState(false);

  // UI State
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingParam, setEditingParam] = useState<Parameter | null>(null);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = showOrphansOnly ? "/api/data-dictionary/parameters?orphans=true" : "/api/data-dictionary/parameters";
      const res = await fetch(url);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setParameters(data.parameters);
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message || "Failed to load parameters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [showOrphansOnly]);

  // Get unique domain groups
  const domainGroups = [...new Set(parameters.map((p) => p.domainGroup))].sort();

  // Filter parameters
  const filteredParameters = parameters.filter((p) => {
    const matchesSearch =
      !searchTerm ||
      p.parameterId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.definition && p.definition.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDomain = !selectedDomain || p.domainGroup === selectedDomain;
    return matchesSearch && matchesDomain;
  });

  // Handlers
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedRows.size} parameter(s)? This cannot be undone.`)) return;
    await Promise.all(Array.from(selectedRows).map((id) => fetch(`/api/parameters/${id}`, { method: "DELETE" })));
    setSelectedRows(new Set());
    fetchData();
  };

  const handleSelectAll = () => {
    if (selectedRows.size === filteredParameters.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredParameters.map((p) => p.id)));
    }
  };

  const handleExport = () => {
    window.location.href = "/api/parameters/export";
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/parameters/import", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!data.ok) {
          alert(`Import failed: ${data.error}`);
          return;
        }

        alert(data.summary);
        fetchData();
      } catch (err: any) {
        alert(`Import error: ${err.message}`);
      }
    };
    input.click();
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto" }}>
      <SourcePageHeader
        title="Parameters"
        description="Manage parameter definitions, calibration, and dynamic prompt links. Click any row to expand details."
        dataNodeId="data:parameters"
      />

      {/* Summary Stats */}
      {summary && (
        <div
          style={{
            marginBottom: "20px",
            padding: "16px 20px",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        >
          <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", fontSize: "13px" }}>
            <div>
              <span style={{ color: "#6b7280" }}>Total:</span>{" "}
              <span style={{ fontWeight: 600 }}>{summary.total}</span>
            </div>
            <div>
              <span style={{ color: "#6b7280" }}>With Specs:</span>{" "}
              <span style={{ fontWeight: 600, color: "#4338ca" }}>{summary.withSpecs}</span>
            </div>
            <div>
              <span style={{ color: "#6b7280" }}>With Playbooks:</span>{" "}
              <span style={{ fontWeight: 600, color: "#c2410c" }}>{summary.withPlaybooks}</span>
            </div>
            <div>
              <span style={{ color: "#6b7280" }}>With Anchors:</span>{" "}
              <span style={{ fontWeight: 600, color: "#92400e" }}>{summary.withAnchors}</span>
            </div>
            <div>
              <span style={{ color: "#dc2626" }}>Orphaned:</span>{" "}
              <span style={{ fontWeight: 600, color: "#dc2626" }}>{summary.orphaned}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Actions */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "20px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Search */}
        <input
          type="text"
          placeholder="Search by ID, name, or definition..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            fontSize: "14px",
            width: "300px",
          }}
        />

        {/* Domain filter buttons */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            onClick={() => setSelectedDomain(null)}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: selectedDomain === null ? "2px solid #4f46e5" : "1px solid #e5e7eb",
              background: selectedDomain === null ? "#eef2ff" : "#fff",
              fontSize: "12px",
              cursor: "pointer",
              fontWeight: selectedDomain === null ? 600 : 400,
            }}
          >
            All
          </button>
          {domainGroups.map((domain) => {
            const color = getDomainColor(domain);
            return (
              <button
                key={domain}
                onClick={() => setSelectedDomain(selectedDomain === domain ? null : domain)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: selectedDomain === domain ? `2px solid ${color.text}` : "1px solid #e5e7eb",
                  background: selectedDomain === domain ? color.bg : "#fff",
                  color: selectedDomain === domain ? color.text : "#374151",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: selectedDomain === domain ? 600 : 400,
                }}
              >
                {domain}
              </button>
            );
          })}
        </div>

        {/* Quick filters */}
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
          <input
            type="checkbox"
            checked={showOrphansOnly}
            onChange={(e) => setShowOrphansOnly(e.target.checked)}
            style={{ accentColor: "#dc2626" }}
          />
          <span style={{ color: showOrphansOnly ? "#dc2626" : "#6b7280" }}>Orphans only</span>
        </label>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Export/Import */}
        <button
          onClick={handleExport}
          style={{
            padding: "8px 16px",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: "500",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          Export CSV
        </button>
        <button
          onClick={handleImport}
          style={{
            padding: "8px 16px",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: "500",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          Import CSV
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div
          style={{
            padding: "16px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            color: "#dc2626",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>Loading parameters...</div>
      )}

      {/* Table */}
      {!loading && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ padding: "12px 8px", textAlign: "left", width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={selectedRows.size === filteredParameters.length && filteredParameters.length > 0}
                    onChange={handleSelectAll}
                    style={{ cursor: "pointer", width: "16px", height: "16px" }}
                  />
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>
                  Parameter ID
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>
                  Name
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>
                  Domain
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>
                  Scale
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>
                  Relationships
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredParameters.map((param) => (
                <ParameterRow
                  key={param.id}
                  param={param}
                  isExpanded={expandedRow === param.id}
                  isSelected={selectedRows.has(param.id)}
                  onToggleExpand={() => setExpandedRow(expandedRow === param.id ? null : param.id)}
                  onToggleSelect={() => {
                    const next = new Set(selectedRows);
                    if (next.has(param.id)) {
                      next.delete(param.id);
                    } else {
                      next.add(param.id);
                    }
                    setSelectedRows(next);
                  }}
                  onEdit={() => setEditingParam(param)}
                  onRefresh={fetchData}
                />
              ))}
            </tbody>
          </table>

          {filteredParameters.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>
              {parameters.length === 0 ? "No parameters found" : "No parameters match your filters"}
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      {!loading && (
        <div style={{ marginTop: "12px", fontSize: "13px", color: "#6b7280" }}>
          Showing {filteredParameters.length} of {parameters.length} parameters
        </div>
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedRows.size}
        onDelete={handleBulkDelete}
        onClear={() => setSelectedRows(new Set())}
      />

      {/* Edit Drawer */}
      <EditDrawer
        isOpen={editingParam !== null}
        onClose={() => setEditingParam(null)}
        parameter={editingParam}
        onSave={fetchData}
      />
    </div>
  );
}
