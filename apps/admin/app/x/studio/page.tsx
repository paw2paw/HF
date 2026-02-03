"use client";

import { useState, useEffect, useCallback } from "react";

// =============================================================================
// TYPES
// =============================================================================

type Domain = {
  id: string;
  slug: string;
  name: string;
};

type Playbook = {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: string;
  domainId: string;
  domain: Domain;
  items: PlaybookItem[];
  systemSpecs: SystemSpecToggle[];
};

type PlaybookItem = {
  id: string;
  specId: string;
  isEnabled: boolean;
  sortOrder: number;
  spec: SpecSummary;
};

type SystemSpecToggle = {
  id: string;
  specId: string;
  isEnabled: boolean;
  spec: SpecSummary;
};

type SpecSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  specRole: string | null;
  outputType: string;
  scope: string;
};

type Caller = {
  id: string;
  name: string;
  email: string | null;
  domain: Domain | null;
  _count?: { calls: number };
};

type GeneratedPrompt = {
  _quickStart: {
    you_are: string;
    this_caller: string;
    this_session: string;
    learner_goals: string;
  };
  caller: { name: string };
  [key: string]: any;
};

// =============================================================================
// SPEC TYPE DESCRIPTIONS (for colleague understanding)
// =============================================================================

const SPEC_TYPE_INFO: Record<string, { label: string; description: string; icon: string }> = {
  // Output Types (pipeline stages)
  LEARN: { label: "① Learn", description: "Extracts caller data (memories, scores)", icon: "🧠" },
  MEASURE: { label: "② Measure", description: "Scores agent behavior against targets", icon: "📊" },
  ADAPT: { label: "③ Adapt", description: "Computes personalized targets", icon: "🔄" },
  COMPOSE: { label: "④ Compose", description: "Builds prompt sections", icon: "✍️" },
  // Spec Roles (for COMPOSE specs - define prompt sections)
  IDENTITY: { label: "Identity", description: "WHO the agent is", icon: "🎭" },
  CONTENT: { label: "Content", description: "WHAT the agent knows", icon: "📖" },
  CONTEXT: { label: "Context", description: "Caller-specific context", icon: "👤" },
  META: { label: "Meta", description: "Legacy - for migration", icon: "⚙️" },
};

const SCOPE_INFO: Record<string, { label: string; description: string }> = {
  SYSTEM: { label: "System", description: "Applies to all playbooks (locked)" },
  DOMAIN: { label: "Domain", description: "Specific to a domain/playbook (toggleable)" },
};

// Get the primary badge type for a spec
// IDENTITY/CONTENT/VOICE specs show their specRole; META specs show outputType
const getSpecBadgeType = (spec: { specRole: string | null; outputType: string }): string => {
  const role = spec.specRole;
  if (role === "IDENTITY" || role === "CONTENT" || role === "VOICE") {
    return role;
  }
  return spec.outputType;
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PlaybookStudioPage() {
  // State
  const [domains, setDomains] = useState<Domain[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [callers, setCallers] = useState<Caller[]>([]);
  const [availableSpecs, setAvailableSpecs] = useState<SpecSummary[]>([]);

  const [selectedDomainId, setSelectedDomainId] = useState<string>("");
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>("");
  const [selectedCallerId, setSelectedCallerId] = useState<string>("");

  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<GeneratedPrompt | null>(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Create modals
  const [showCreateDomain, setShowCreateDomain] = useState(false);
  const [showCreatePlaybook, setShowCreatePlaybook] = useState(false);
  const [newDomainName, setNewDomainName] = useState("");
  const [newDomainSlug, setNewDomainSlug] = useState("");
  const [newPlaybookName, setNewPlaybookName] = useState("");
  const [creating, setCreating] = useState(false);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  // Initial load
  useEffect(() => {
    Promise.all([
      fetch("/api/domains").then((r) => r.json()),
      fetch("/api/playbooks").then((r) => r.json()),
      fetch("/api/callers?withCounts=true").then((r) => r.json()),
      fetch("/api/playbooks/available-items").then((r) => r.json()),
    ])
      .then(([domRes, pbRes, calRes, specRes]) => {
        if (domRes.ok) setDomains(domRes.domains || []);
        if (pbRes.ok) setPlaybooks(pbRes.playbooks || []);
        if (calRes.ok) setCallers(calRes.callers || []);
        // API returns systemSpecs and domainSpecs separately - combine them
        if (specRes.ok) {
          const allSpecs = [
            ...(specRes.systemSpecs || []),
            ...(specRes.domainSpecs || []),
          ];
          setAvailableSpecs(allSpecs);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // Load playbook details when selected
  useEffect(() => {
    if (!selectedPlaybookId) {
      setPlaybook(null);
      return;
    }
    fetch(`/api/playbooks/${selectedPlaybookId}/tree`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setPlaybook(data.playbook);
          // Auto-select domain
          if (data.playbook?.domainId) {
            setSelectedDomainId(data.playbook.domainId);
          }
        }
      });
  }, [selectedPlaybookId]);

  // Filter playbooks by domain
  const filteredPlaybooks = selectedDomainId
    ? playbooks.filter((pb) => pb.domainId === selectedDomainId)
    : playbooks;

  // Filter callers by domain
  const filteredCallers = selectedDomainId
    ? callers.filter((c) => c.domain?.id === selectedDomainId || !c.domain)
    : callers;

  // =============================================================================
  // SPEC CATEGORIZATION
  // =============================================================================

  // System specs (SYSTEM scope) - shown as locked
  const systemSpecs = availableSpecs.filter((s) => s.scope === "SYSTEM");

  // Domain specs (DOMAIN scope) - toggleable in playbook
  const domainSpecs = availableSpecs.filter((s) => s.scope === "DOMAIN");

  // Get enabled state for a spec
  const isSpecEnabled = (specId: string): boolean => {
    if (!playbook) return false;
    // Check playbook items
    const item = playbook.items.find((i) => i.specId === specId);
    if (item) return item.isEnabled;
    // Check system spec toggles
    const toggle = playbook.systemSpecs?.find((t) => t.specId === specId);
    if (toggle) return toggle.isEnabled;
    return false;
  };

  // =============================================================================
  // ACTIONS
  // =============================================================================

  const toggleSpec = async (specId: string, currentEnabled: boolean) => {
    if (!playbook) return;
    try {
      await fetch(`/api/playbooks/${playbook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toggleSpec: { specId, enabled: !currentEnabled },
        }),
      });
      // Refresh playbook
      const res = await fetch(`/api/playbooks/${playbook.id}/tree`);
      const data = await res.json();
      if (data.ok) setPlaybook(data.playbook);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const generatePrompt = async () => {
    if (!selectedCallerId) {
      setError("Select a caller first");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/callers/${selectedCallerId}/compose-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        setGeneratedPrompt(data.prompt);
      } else {
        setError(data.error || "Failed to generate prompt");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleUploadSpec = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setError(null);
    try {
      const content = await uploadFile.text();
      const spec = JSON.parse(content);

      const res = await fetch("/api/lab/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const data = await res.json();
      if (data.ok) {
        // Refresh available specs
        const specRes = await fetch("/api/playbooks/available-items").then((r) => r.json());
        if (specRes.ok) {
          const allSpecs = [
            ...(specRes.systemSpecs || []),
            ...(specRes.domainSpecs || []),
          ];
          setAvailableSpecs(allSpecs);
        }
        setShowUpload(false);
        setUploadFile(null);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateDomain = async () => {
    if (!newDomainName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const slug = newDomainSlug.trim() || newDomainName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDomainName.trim(), slug }),
      });
      const data = await res.json();
      if (data.ok) {
        setDomains((prev) => [...prev, data.domain]);
        setSelectedDomainId(data.domain.id);
        setShowCreateDomain(false);
        setNewDomainName("");
        setNewDomainSlug("");
      } else {
        setError(data.error || "Failed to create domain");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCreatePlaybook = async () => {
    if (!newPlaybookName.trim() || !selectedDomainId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPlaybookName.trim(), domainId: selectedDomainId }),
      });
      const data = await res.json();
      if (data.ok) {
        setPlaybooks((prev) => [...prev, data.playbook]);
        setSelectedPlaybookId(data.playbook.id);
        setShowCreatePlaybook(false);
        setNewPlaybookName("");
      } else {
        setError(data.error || "Failed to create playbook");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  // Badge colors for spec types (both outputType and specRole)
  const badgeColors: Record<string, { bg: string; text: string }> = {
    // Spec Roles (for COMPOSE specs - define prompt sections)
    IDENTITY: { bg: "#dbeafe", text: "#1e40af" },  // Blue
    CONTENT: { bg: "#f0fdf4", text: "#166534" },   // Green
    CONTEXT: { bg: "#fef3c7", text: "#92400e" },   // Amber
    META: { bg: "#f3f4f6", text: "#4b5563" },      // Gray (legacy)
    // Output Types (pipeline stages)
    LEARN: { bg: "#ede9fe", text: "#5b21b6" },     // Purple
    MEASURE: { bg: "#dcfce7", text: "#166534" },   // Light green
    ADAPT: { bg: "#fef3c7", text: "#92400e" },     // Amber
    COMPOSE: { bg: "#fce7f3", text: "#be185d" },   // Pink
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#6b7280" }}>
        Loading Playbook Studio...
      </div>
    );
  }

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div style={{ height: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 0",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1f2937", margin: 0 }}>
            Playbook Studio
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0 0" }}>
            Configure specs and generate prompts
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          style={{
            padding: "8px 16px",
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>📤</span> Upload Spec
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            margin: "12px 0",
            padding: 12,
            background: "#fef2f2",
            color: "#dc2626",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, paddingTop: 16, overflow: "hidden" }}>
        {/* LEFT PANEL: Config */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, overflow: "auto", paddingRight: 8 }}>
          {/* Domain & Playbook Selection */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#6b7280", marginBottom: 12 }}>
              1. Select Playbook
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Domain</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={selectedDomainId}
                  onChange={(e) => {
                    setSelectedDomainId(e.target.value);
                    setSelectedPlaybookId("");
                    setSelectedCallerId("");
                  }}
                  style={{ flex: 1, padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}
                >
                  <option value="">All domains</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCreateDomain(true)}
                  title="Create new domain"
                  style={{
                    padding: "8px 12px",
                    background: "#f3f4f6",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Playbook</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={selectedPlaybookId}
                  onChange={(e) => setSelectedPlaybookId(e.target.value)}
                  style={{ flex: 1, padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}
                >
                  <option value="">Select playbook...</option>
                  {filteredPlaybooks.map((pb) => (
                    <option key={pb.id} value={pb.id}>
                      {pb.name} ({pb.status})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCreatePlaybook(true)}
                  disabled={!selectedDomainId}
                  title={selectedDomainId ? "Create new playbook" : "Select a domain first"}
                  style={{
                    padding: "8px 12px",
                    background: selectedDomainId ? "#f3f4f6" : "#e5e7eb",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    cursor: selectedDomainId ? "pointer" : "not-allowed",
                    fontSize: 14,
                    opacity: selectedDomainId ? 1 : 0.5,
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* System Specs (Locked) */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 14 }}>🔒</span>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#64748b" }}>
                System Specs (Auto-included)
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {systemSpecs.map((spec) => (
                <div
                  key={spec.id}
                  style={{
                    padding: "8px 10px",
                    background: "#fff",
                    borderRadius: 6,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    opacity: 0.8,
                  }}
                >
                  {(() => {
                    const badgeType = getSpecBadgeType(spec);
                    return (
                      <>
                        <span title={SPEC_TYPE_INFO[badgeType]?.description || ""}>
                          {SPEC_TYPE_INFO[badgeType]?.icon || "📋"}
                        </span>
                        <span style={{ flex: 1 }} title={spec.description || undefined}>{spec.name}</span>
                        <span
                          title={SPEC_TYPE_INFO[badgeType]?.description || ""}
                          style={{
                            fontSize: 9,
                            padding: "2px 5px",
                            background: badgeColors[badgeType]?.bg || "#f3f4f6",
                            color: badgeColors[badgeType]?.text || "#6b7280",
                            borderRadius: 3,
                            cursor: "help",
                          }}
                        >
                          {SPEC_TYPE_INFO[badgeType]?.label || badgeType}
                        </span>
                      </>
                    );
                  })()}
                </div>
              ))}
              {systemSpecs.length === 0 && (
                <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>No system specs</div>
              )}
            </div>
          </div>

          {/* Playbook Specs (Toggleable) */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 14 }}>✏️</span>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#6b7280" }}>
                Playbook Specs (Toggleable)
              </span>
            </div>

            {!playbook ? (
              <div style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic", padding: 12, textAlign: "center" }}>
                Select a playbook to configure specs
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {domainSpecs.map((spec) => {
                  const enabled = isSpecEnabled(spec.id);
                  return (
                    <div
                      key={spec.id}
                      onClick={() => toggleSpec(spec.id, enabled)}
                      title={spec.description || undefined}
                      style={{
                        padding: "8px 10px",
                        background: enabled ? "#f0fdf4" : "#f9fafb",
                        border: enabled ? "1px solid #86efac" : "1px solid #e5e7eb",
                        borderRadius: 6,
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {(() => {
                        const badgeType = getSpecBadgeType(spec);
                        return (
                          <>
                            <span style={{ fontSize: 16 }}>{enabled ? "☑️" : "☐"}</span>
                            <span style={{ flex: 1, opacity: enabled ? 1 : 0.6 }}>{spec.name}</span>
                            <span
                              title={SPEC_TYPE_INFO[badgeType]?.description || ""}
                              style={{
                                fontSize: 9,
                                padding: "2px 5px",
                                background: badgeColors[badgeType]?.bg || "#f3f4f6",
                                color: badgeColors[badgeType]?.text || "#6b7280",
                                borderRadius: 3,
                                cursor: "help",
                              }}
                            >
                              {SPEC_TYPE_INFO[badgeType]?.label || badgeType}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  );
                })}
                {domainSpecs.length === 0 && (
                  <div style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                    No domain specs available. Upload one!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>
          {/* Caller Selection & Generate */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 16,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#6b7280" }}>
              2. Generate Prompt
            </div>
            <select
              value={selectedCallerId}
              onChange={(e) => setSelectedCallerId(e.target.value)}
              style={{ flex: 1, padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}
            >
              <option value="">Select caller...</option>
              {filteredCallers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c._count?.calls != null ? ` (${c._count.calls} calls)` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={generatePrompt}
              disabled={!selectedCallerId || generating}
              style={{
                padding: "10px 20px",
                background: selectedCallerId ? "#4f46e5" : "#e5e7eb",
                color: selectedCallerId ? "#fff" : "#9ca3af",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: selectedCallerId ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {generating ? "Generating..." : "▶ Generate"}
            </button>
          </div>

          {/* Prompt Preview */}
          <div
            style={{
              flex: 1,
              background: "#1e293b",
              borderRadius: 10,
              padding: 20,
              overflow: "auto",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              color: "#e2e8f0",
            }}
          >
            {!generatedPrompt ? (
              <div style={{ color: "#64748b", textAlign: "center", paddingTop: 60 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
                <div>Select a caller and click Generate to preview the prompt</div>
              </div>
            ) : (
              <div>
                {/* Quick Start Section */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ color: "#4ade80", fontWeight: 700, marginBottom: 8 }}>## QUICK START</div>
                  <div style={{ paddingLeft: 12 }}>
                    <div><span style={{ color: "#94a3b8" }}>you_are:</span> {generatedPrompt._quickStart?.you_are}</div>
                    <div><span style={{ color: "#94a3b8" }}>this_caller:</span> {generatedPrompt._quickStart?.this_caller}</div>
                    <div><span style={{ color: "#94a3b8" }}>this_session:</span> {generatedPrompt._quickStart?.this_session}</div>
                    <div><span style={{ color: "#94a3b8" }}>learner_goals:</span> {generatedPrompt._quickStart?.learner_goals}</div>
                  </div>
                </div>

                {/* Full JSON */}
                <div>
                  <div style={{ color: "#94a3b8", fontWeight: 700, marginBottom: 8 }}>## FULL CONTEXT</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11 }}>
                    {JSON.stringify(generatedPrompt, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowUpload(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 12, padding: 24, width: 560, maxHeight: "80vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 8px 0", fontSize: 18 }}>Upload BDD Spec</h2>
            <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#6b7280" }}>
              Upload a <code>.spec.json</code> file conforming to the BDD schema
            </p>

            {/* Schema Guide */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: "#475569" }}>Required Fields:</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#64748b" }}>
                <div><code>id</code> - Unique spec ID (e.g., "PERS-001")</div>
                <div><code>title</code> - Human-readable name</div>
                <div><code>specType</code> - SYSTEM or DOMAIN</div>
                <div><code>specRole</code> or <code>outputType</code></div>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: "#475569" }}>Spec Role (defines the agent):</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, color: "#64748b", fontSize: 11 }}>
                  <div><strong>IDENTITY</strong> - WHO the agent is</div>
                  <div><strong>CONTENT</strong> - WHAT it knows/teaches</div>
                  <div><strong>VOICE</strong> - HOW it speaks</div>
                </div>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: "#475569" }}>Output Type (runtime data):</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, color: "#64748b", fontSize: 11 }}>
                  <div><strong>MEASURE</strong> - Measure caller traits</div>
                  <div><strong>LEARN</strong> - Extract memories</div>
                  <div><strong>ADAPT</strong> - Adjust to caller</div>
                  <div><strong>REWARD</strong> - Compute signals</div>
                </div>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: "#475569" }}>Spec Scope:</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, color: "#64748b" }}>
                  <div><strong>SYSTEM</strong> - Auto-included (locked)</div>
                  <div><strong>DOMAIN</strong> - Toggleable per playbook</div>
                </div>
              </div>
            </div>

            <div
              style={{
                border: "2px dashed #d1d5db",
                borderRadius: 8,
                padding: 32,
                textAlign: "center",
                marginBottom: 20,
                background: uploadFile ? "#f0fdf4" : "#f9fafb",
              }}
            >
              {uploadFile ? (
                <div>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 500 }}>{uploadFile.name}</div>
                  <button
                    onClick={() => setUploadFile(null)}
                    style={{ marginTop: 8, fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    style={{ fontSize: 13 }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowUpload(false);
                  setUploadFile(null);
                }}
                style={{ padding: "8px 16px", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSpec}
                disabled={!uploadFile || uploading}
                style={{
                  padding: "8px 16px",
                  background: uploadFile ? "#4f46e5" : "#e5e7eb",
                  color: uploadFile ? "#fff" : "#9ca3af",
                  border: "none",
                  borderRadius: 6,
                  cursor: uploadFile ? "pointer" : "not-allowed",
                }}
              >
                {uploading ? "Uploading..." : "Upload & Activate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Domain Modal */}
      {showCreateDomain && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateDomain(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 12, padding: 24, width: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: 18 }}>Create New Domain</h2>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Domain Name *
              </label>
              <input
                type="text"
                value={newDomainName}
                onChange={(e) => setNewDomainName(e.target.value)}
                placeholder="e.g., Economics Education"
                style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Slug (optional)
              </label>
              <input
                type="text"
                value={newDomainSlug}
                onChange={(e) => setNewDomainSlug(e.target.value)}
                placeholder="auto-generated from name"
                style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
              />
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                Lowercase, hyphens only. Leave blank to auto-generate.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowCreateDomain(false); setNewDomainName(""); setNewDomainSlug(""); }}
                style={{ padding: "8px 16px", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDomain}
                disabled={!newDomainName.trim() || creating}
                style={{
                  padding: "8px 16px",
                  background: newDomainName.trim() ? "#4f46e5" : "#e5e7eb",
                  color: newDomainName.trim() ? "#fff" : "#9ca3af",
                  border: "none",
                  borderRadius: 6,
                  cursor: newDomainName.trim() ? "pointer" : "not-allowed",
                }}
              >
                {creating ? "Creating..." : "Create Domain"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Playbook Modal */}
      {showCreatePlaybook && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreatePlaybook(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 12, padding: 24, width: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: 18 }}>Create New Playbook</h2>

            <div style={{ marginBottom: 12, padding: 10, background: "#f0fdf4", borderRadius: 6, fontSize: 12 }}>
              <strong>Domain:</strong> {domains.find(d => d.id === selectedDomainId)?.name || "None selected"}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Playbook Name *
              </label>
              <input
                type="text"
                value={newPlaybookName}
                onChange={(e) => setNewPlaybookName(e.target.value)}
                placeholder="e.g., Economics Companion v1"
                style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowCreatePlaybook(false); setNewPlaybookName(""); }}
                style={{ padding: "8px 16px", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaybook}
                disabled={!newPlaybookName.trim() || creating}
                style={{
                  padding: "8px 16px",
                  background: newPlaybookName.trim() ? "#4f46e5" : "#e5e7eb",
                  color: newPlaybookName.trim() ? "#fff" : "#9ca3af",
                  border: "none",
                  borderRadius: 6,
                  cursor: newPlaybookName.trim() ? "pointer" : "not-allowed",
                }}
              >
                {creating ? "Creating..." : "Create Playbook"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
