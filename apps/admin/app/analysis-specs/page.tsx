"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Types
type ScoringAnchor = {
  id: string;
  score: number;
  example: string;
  rationale: string | null;
  positiveSignals: string[];
  negativeSignals: string[];
  isGold: boolean;
};

type ParameterInfo = {
  parameterId: string;
  name: string;
  definition?: string;
  scaleType: string;
  interpretationHigh?: string;
  interpretationLow?: string;
  scoringAnchors: ScoringAnchor[];
};

type AnalysisAction = {
  id: string;
  description: string;
  weight: number;
  // MEASURE fields
  parameterId: string | null;
  parameter: ParameterInfo | null;
  // LEARN fields
  learnCategory: string | null;
  learnKeyPrefix: string | null;
  learnKeyHint: string | null;
};

type AnalysisTrigger = {
  id: string;
  name: string | null;
  given: string;
  when: string;
  then: string;
  actions: AnalysisAction[];
};

// OutputType = WHAT the spec produces (pipeline stage)
// Maps to Prisma AnalysisOutputType enum
type OutputType = "LEARN" | "MEASURE" | "ADAPT" | "COMPOSE";

// SpecType = WHEN the spec runs (system vs domain-specific)
// Maps to Prisma SpecType enum
type PipelinePhase = "SYSTEM" | "DOMAIN";

// SpecRole = WHAT prompt section (for COMPOSE specs)
// Maps to Prisma SpecRole enum
type SpecRole = "IDENTITY" | "CONTENT" | "CONTEXT" | "META";

// Valid output types per scope - determines what types are shown in filter
const OUTPUT_TYPES_BY_SCOPE: Record<SpecScope | "ALL", OutputType[]> = {
  CALLER: ["LEARN", "ADAPT"],
  DOMAIN: ["MEASURE", "COMPOSE"],
  SYSTEM: ["LEARN", "MEASURE", "ADAPT", "COMPOSE"],
  ALL: ["LEARN", "MEASURE", "ADAPT", "COMPOSE"],
};

// Which spec types can be selected based on scope
const PIPELINE_PHASES_BY_SCOPE: Record<SpecScope | "ALL", PipelinePhase[]> = {
  CALLER: ["DOMAIN"],
  DOMAIN: ["DOMAIN"],
  SYSTEM: ["SYSTEM"],
  ALL: ["SYSTEM", "DOMAIN"],
};

type SpecScope = "CALLER" | "DOMAIN" | "SYSTEM";

type PlaybookUsage = {
  id: string;
  name: string;
  status: string;
  domain: string | null;
};

type AnalysisSpec = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  outputType: OutputType;
  specType: PipelinePhase;  // When this spec runs in the pipeline
  specRole: SpecRole;  // WHO/WHAT/HOW: Identity, Content, or Meta
  scope: SpecScope;
  domain: string | null;
  priority: number;
  isActive: boolean;
  version: string;
  triggerCount?: number;
  actionCount?: number;
  triggers?: AnalysisTrigger[];
  // Compilation status
  compiledAt?: string | null;
  compiledSetId?: string | null;
  isDirty?: boolean;
  dirtyReason?: string | null;
  // Locking
  isLocked?: boolean;
  lockedReason?: string | null;
  usageCount?: number;
  // Prompt template
  promptTemplate?: string | null;
  // Configuration (for ADAPT, COMPOSE, etc.)
  config?: Record<string, unknown> | null;
  // Playbook usage
  playbookCount?: number;
  playbooks?: PlaybookUsage[];
  // Provenance tracking
  sourceFeatureSet?: {
    id: string;
    featureId: string;
    name: string;
    version: string;
  } | null;
};

type FullParameter = {
  parameterId: string;
  name: string;
  definition: string | null;
  domainGroup: string;
  scaleType: string;
  interpretationHigh: string | null;
  interpretationLow: string | null;
};

// Memory categories for LEARN type
const MEMORY_CATEGORIES = [
  { value: "FACT", label: "Fact", description: "Immutable facts: location, job, etc." },
  { value: "PREFERENCE", label: "Preference", description: "User preferences: contact method, style" },
  { value: "EVENT", label: "Event", description: "Time-bound events: meetings, requests" },
  { value: "TOPIC", label: "Topic", description: "Topics discussed: interests, concerns" },
  { value: "RELATIONSHIP", label: "Relationship", description: "People: family, colleagues" },
  { value: "CONTEXT", label: "Context", description: "Situational: traveling, busy period" },
];

// Domain colors (inline style version)
const DOMAIN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  personality: { bg: "#f3e8ff", text: "#7c3aed", border: "#ddd6fe" },
  engagement: { bg: "#dbeafe", text: "#2563eb", border: "#bfdbfe" },
  conversation: { bg: "#ccfbf1", text: "#0d9488", border: "#99f6e4" },
  memory: { bg: "#fef3c7", text: "#d97706", border: "#fde68a" },
  safety: { bg: "#fee2e2", text: "#dc2626", border: "#fecaca" },
  commercial: { bg: "#dcfce7", text: "#16a34a", border: "#bbf7d0" },
};

// Colors for OutputType (pipeline stage - WHAT the spec does)
const OUTPUT_TYPE_COLORS: Record<OutputType, { bg: string; text: string; label: string; icon: string; desc: string }> = {
  LEARN: { bg: "#fef3c7", text: "#d97706", label: "① LEARN", icon: "💾", desc: "Extracts caller data (memories, scores)" },
  MEASURE: { bg: "#e0e7ff", text: "#4f46e5", label: "② MEASURE", icon: "📊", desc: "Scores behaviour" },
  ADAPT: { bg: "#ccfbf1", text: "#0d9488", label: "③ ADAPT", icon: "🎯", desc: "Computes personalized targets" },
  COMPOSE: { bg: "#fef9c3", text: "#a16207", label: "④ COMPOSE", icon: "✍️", desc: "Builds prompt sections" },
};

// Colors for SpecType (WHEN the spec runs - system vs domain)
const PIPELINE_PHASE_COLORS: Record<PipelinePhase, { bg: string; text: string; label: string; icon: string; desc: string }> = {
  SYSTEM: { bg: "#fef3c7", text: "#d97706", label: "System", icon: "⚙️", desc: "Runs on every call" },
  DOMAIN: { bg: "#f3e8ff", text: "#7c3aed", label: "Domain", icon: "📋", desc: "Runs when playbook is active" },
};

const SCOPE_COLORS: Record<SpecScope, { bg: string; text: string; label: string; icon: string }> = {
  CALLER: { bg: "#dbeafe", text: "#2563eb", label: "Caller", icon: "👤" },
  DOMAIN: { bg: "#f3e8ff", text: "#7c3aed", label: "Domain", icon: "🏢" },
  SYSTEM: { bg: "#fef3c7", text: "#d97706", label: "System", icon: "⚙️" },
};

// Colors for SpecRole (prompt section - for COMPOSE specs)
const SPEC_ROLE_COLORS: Record<SpecRole, { bg: string; text: string; label: string; icon: string; desc: string }> = {
  IDENTITY: { bg: "#dbeafe", text: "#1e40af", label: "WHO", icon: "🎭", desc: "Agent identity/persona" },
  CONTENT: { bg: "#d1fae5", text: "#065f46", label: "WHAT", icon: "📚", desc: "Domain knowledge/curriculum" },
  CONTEXT: { bg: "#fef3c7", text: "#92400e", label: "CALLER", icon: "👤", desc: "Caller-specific context" },
  META: { bg: "#f3f4f6", text: "#6b7280", label: "META", icon: "⚡", desc: "Legacy - for migration" },
};

function getDomainColor(domain: string | null) {
  if (!domain) return { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" };
  return DOMAIN_COLORS[domain.toLowerCase()] || { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" };
}

function getOutputTypeBadge(outputType: OutputType) {
  return OUTPUT_TYPE_COLORS[outputType] || OUTPUT_TYPE_COLORS.MEASURE;
}

function getPipelinePhaseBadge(specType: PipelinePhase) {
  return PIPELINE_PHASE_COLORS[specType] || PIPELINE_PHASE_COLORS.DOMAIN;
}

// Filter Button Component
function FilterButton({
  active,
  onClick,
  label,
  icon,
  count,
  color,
  bg,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: string;
  count?: number;
  color?: string;
  bg?: string;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "8px 12px",
        borderRadius: 6,
        border: "none",
        background: active ? (bg || "#e5e7eb") : "transparent",
        color: active ? (color || "#1f2937") : "#6b7280",
        fontWeight: active ? 500 : 400,
        fontSize: 13,
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />}
      {icon && <span>{icon}</span>}
      <span style={{ flex: 1 }}>{label}</span>
      {count !== undefined && (
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{count}</span>
      )}
    </button>
  );
}

// Wrapper to handle Suspense boundary for useSearchParams
export default function AnalysisSpecsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-neutral-400">Loading...</div>}>
      <AnalysisSpecsContent />
    </Suspense>
  );
}

function AnalysisSpecsContent() {
  const searchParams = useSearchParams();
  const [specs, setSpecs] = useState<AnalysisSpec[]>([]);
  const [selectedSpec, setSelectedSpec] = useState<AnalysisSpec | null>(null);
  const [initialSelectHandled, setInitialSelectHandled] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedOutputType, setSelectedOutputType] = useState<OutputType | null>(null);
  const [selectedPipelinePhase, setSelectedPipelinePhase] = useState<PipelinePhase | null>(null);
  const [selectedSpecRole, setSelectedSpecRole] = useState<SpecRole | null>(null);
  const [selectedScope, setSelectedScope] = useState<SpecScope | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Tab state for Domain/System specs split
  const [activeTab, setActiveTab] = useState<"DOMAIN" | "SYSTEM">("DOMAIN");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTriggers, setExpandedTriggers] = useState<Set<string>>(new Set());
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

  // Locked scope mode - hide scope filter when scope is predetermined via URL
  const [scopeLocked, setScopeLocked] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddTriggerModal, setShowAddTriggerModal] = useState(false);
  const [showCompileModal, setShowCompileModal] = useState(false);
  const [showEditWarningModal, setShowEditWarningModal] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<{ specId: string; action: () => void } | null>(null);

  // Parameters for MEASURE actions
  const [parameters, setParameters] = useState<FullParameter[]>([]);

  // Profiles for compilation
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);

  // Per-spec compile state
  const [compilingSpec, setCompilingSpec] = useState<string | null>(null);
  const [compileResult, setCompileResult] = useState<any>(null);

  // Per-spec enrich state
  const [enrichingSpec, setEnrichingSpec] = useState<string | null>(null);
  const [enrichResult, setEnrichResult] = useState<any>(null);

  // Track which specs have shown dirty warning (only show once per session)
  const [dirtyWarningShown, setDirtyWarningShown] = useState<Set<string>>(new Set());

  // Track which spec is having its scope edited
  const [editingScopeId, setEditingScopeId] = useState<string | null>(null);

  // Group specs by domain (filtered by active tab/scope)
  const domains = useMemo(() => {
    const effectiveScope = scopeLocked ? selectedScope : activeTab;
    const domainMap = new Map<string, AnalysisSpec[]>();
    for (const s of specs) {
      // Filter by scope first
      if (effectiveScope && s.scope !== effectiveScope) continue;
      const domain = s.domain || "uncategorized";
      if (!domainMap.has(domain)) domainMap.set(domain, []);
      domainMap.get(domain)!.push(s);
    }
    return domainMap;
  }, [specs, scopeLocked, selectedScope, activeTab]);

  // Filter specs - uses activeTab for scope when not in locked mode
  const filteredSpecs = useMemo(() => {
    let result = specs;
    // Search filter (name or slug)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(query) ||
        s.slug.toLowerCase().includes(query)
      );
    }
    if (selectedDomain) {
      result = result.filter((s) => (s.domain || "uncategorized") === selectedDomain);
    }
    if (selectedOutputType) {
      result = result.filter((s) => s.outputType === selectedOutputType);
    }
    if (selectedPipelinePhase) {
      result = result.filter((s) => s.specType === selectedPipelinePhase);
    }
    if (selectedSpecRole) {
      result = result.filter((s) => s.specRole === selectedSpecRole);
    }
    // Use activeTab for scope filtering when not locked via URL
    const effectiveScope = scopeLocked ? selectedScope : activeTab;
    if (effectiveScope) {
      result = result.filter((s) => s.scope === effectiveScope);
    }
    if (showActiveOnly) {
      result = result.filter((s) => s.isActive);
    }
    return result;
  }, [specs, searchQuery, selectedDomain, selectedOutputType, selectedPipelinePhase, selectedSpecRole, selectedScope, scopeLocked, activeTab, showActiveOnly]);

  useEffect(() => {
    fetchSpecs();
    fetchParameters();
    fetchProfiles();
  }, []);

  // Handle initial select from URL query params (runs once)
  useEffect(() => {
    if (!initialSelectHandled && specs.length > 0) {
      const selectId = searchParams.get("select");
      if (selectId) {
        fetchSpecDetail(selectId);
      }
      setInitialSelectHandled(true);
    }
  }, [specs, initialSelectHandled]);

  // Respond to scope and locked URL params (runs on every URL change)
  useEffect(() => {
    const scopeParam = searchParams.get("scope") as SpecScope | null;
    const lockedParam = searchParams.get("locked");

    // Update scope from URL
    if (scopeParam && ["CALLER", "DOMAIN", "SYSTEM"].includes(scopeParam)) {
      setSelectedScope(scopeParam);
      // Check if scope is locked (simplified view mode)
      if (lockedParam === "1") {
        setScopeLocked(true);
      } else {
        setScopeLocked(false);
      }
    } else {
      // No scope param - show all scopes
      setSelectedScope(null);
      setScopeLocked(false);
    }
  }, [searchParams]);

  async function fetchProfiles() {
    try {
      const res = await fetch("/api/analysis-profiles");
      const data = await res.json();
      if (data.ok) {
        setProfiles(data.profiles || []);
      }
    } catch (e) {
      // Ignore
    }
  }

  // Toggle spec active status
  async function handleToggleActive(specId: string, newActive: boolean) {
    try {
      const res = await fetch(`/api/analysis-specs/${specId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActive }),
      });
      const data = await res.json();
      if (data.ok) {
        // Update local state
        setSpecs(prev => prev.map(s => s.id === specId ? { ...s, isActive: newActive } : s));
        if (selectedSpec?.id === specId) {
          setSelectedSpec(prev => prev ? { ...prev, isActive: newActive } : null);
        }
        // Show warning if spec was disabled in playbooks
        if (data.affectedPlaybooks && data.affectedPlaybooks.length > 0) {
          const playbookNames = data.affectedPlaybooks.map((p: { name: string }) => p.name).join(", ");
          alert(`Spec deactivated.\n\nThis spec has been automatically disabled in ${data.affectedPlaybooks.length} playbook(s):\n${playbookNames}`);
        }
      } else {
        setError(data.error || "Failed to update");
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  // Update spec scope (SYSTEM, DOMAIN, CALLER)
  async function handleUpdateScope(specId: string, newScope: SpecScope) {
    try {
      const res = await fetch(`/api/analysis-specs/${specId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: newScope }),
      });
      const data = await res.json();
      if (data.ok) {
        // Update local state
        setSpecs(prev => prev.map(s => s.id === specId ? { ...s, scope: newScope, isDirty: true } : s));
        if (selectedSpec?.id === specId) {
          setSelectedSpec(prev => prev ? { ...prev, scope: newScope, isDirty: true } : null);
        }
        setEditingScopeId(null);
      } else {
        setError(data.error || "Failed to update scope");
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  // Compile individual spec
  async function handleCompileSpec(specId: string) {
    const spec = specs.find(s => s.id === specId);

    // If spec is dirty and we haven't shown the warning yet, show it first
    if (spec?.isDirty && !dirtyWarningShown.has(specId)) {
      setDirtyWarningShown(prev => new Set(prev).add(specId));
      // Show a brief warning but proceed
      setCompileResult({
        ok: false,
        specId,
        warning: true,
        message: "This spec has been modified since last validation. Revalidating now...",
      });
    }

    setCompilingSpec(specId);
    try {
      const res = await fetch(`/api/analysis-specs/${specId}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      const data = await res.json();
      setCompileResult({ ...data, specId });

      if (data.ok) {
        // Refresh specs list and detail
        fetchSpecs();
        if (selectedSpec?.id === specId) {
          fetchSpecDetail(specId);
        }
      }
    } catch (e: any) {
      setCompileResult({ ok: false, error: e.message, specId });
    } finally {
      setCompilingSpec(null);
    }
  }

  // Enrich spec - pull knowledge from artifacts to deepen action terms
  async function handleEnrichSpec(specId: string) {
    setEnrichingSpec(specId);
    setEnrichResult(null);
    try {
      const res = await fetch(`/api/analysis-specs/${specId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      setEnrichResult({ ...data, specId });

      if (data.ok) {
        // Refresh spec detail to show enriched data
        if (selectedSpec?.id === specId) {
          fetchSpecDetail(specId);
        }
      }
    } catch (e: any) {
      setEnrichResult({ ok: false, error: e.message, specId });
    } finally {
      setEnrichingSpec(null);
    }
  }

  // Check if editing a compiled spec and show warning
  function checkEditWarning(specId: string, action: () => void) {
    const spec = specs.find(s => s.id === specId);
    if (spec?.compiledAt && !spec.isDirty) {
      setPendingEdit({ specId, action });
      setShowEditWarningModal(true);
    } else {
      action();
    }
  }

  function confirmEdit() {
    if (pendingEdit) {
      pendingEdit.action();
    }
    setShowEditWarningModal(false);
    setPendingEdit(null);
  }

  async function fetchSpecs() {
    try {
      setLoading(true);
      const res = await fetch("/api/analysis-specs");
      const data = await res.json();
      if (data.ok) {
        setSpecs(data.specs);
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchParameters() {
    try {
      const res = await fetch("/api/parameters?limit=200");
      const data = await res.json();
      if (data.ok) {
        setParameters(data.parameters);
      }
    } catch (e) {
      // Ignore
    }
  }

  async function fetchSpecDetail(specId: string) {
    try {
      const res = await fetch(`/api/analysis-specs/${specId}`);
      const data = await res.json();
      if (data.ok) {
        setSelectedSpec(data.spec);
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  function toggleTrigger(id: string) {
    setExpandedTriggers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAction(id: string) {
    setExpandedActions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function getScoreColor(score: number) {
    if (score >= 0.7) return "bg-green-100 text-green-800";
    if (score >= 0.4) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  }

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Analysis Specs</h1>
        <div style={{ color: "#6b7280", marginTop: 8 }}>Loading...</div>
      </div>
    );
  }

  // Count active specs
  const activeSpecCount = specs.filter(s => s.isActive).length;
  const measureCount = specs.filter(s => s.isActive && s.outputType === "MEASURE").length;
  const learnCount = specs.filter(s => s.isActive && s.outputType === "LEARN").length;
  const adaptCount = specs.filter(s => s.isActive && s.outputType === "ADAPT").length;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
            {scopeLocked && selectedScope ? (
              <>
                {SCOPE_COLORS[selectedScope].icon} {SCOPE_COLORS[selectedScope].label} Specs
              </>
            ) : (
              "Analysis Specs"
            )}
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            {scopeLocked && selectedScope ? (
              selectedScope === "CALLER" ? "Auto-generated specs (view only) - created by the learning system" :
              selectedScope === "DOMAIN" ? "Domain-level specs for measuring aggregate patterns" :
              "System specs for measuring behaviour and compliance"
            ) : (
              "Define what to analyze: MEASURE caller, LEARN facts, AGENT behavior, or ADAPT goals"
            )}
          </p>
          {scopeLocked && (
            <Link
              href="/analysis-specs"
              style={{ fontSize: 12, color: "#4f46e5", marginTop: 4, display: "inline-block" }}
            >
              View all specs →
            </Link>
          )}
        </div>
        <button
          onClick={() => setShowCompileModal(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#16a34a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <span>✓</span>
          Validate All Active ({activeSpecCount})
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: "#fef2f2", color: "#dc2626", borderRadius: 8, fontSize: 14 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Scope Tabs - hidden when scope is locked via URL */}
      {!scopeLocked && (
        <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: 20 }}>
          <button
            onClick={() => {
              setActiveTab("DOMAIN");
              setSelectedDomain(null);
              setSelectedOutputType(null);
            }}
            style={{
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 500,
              background: activeTab === "DOMAIN" ? "white" : "transparent",
              color: activeTab === "DOMAIN" ? "#7c3aed" : "#6b7280",
              border: "none",
              borderBottom: activeTab === "DOMAIN" ? "2px solid #7c3aed" : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            🏢 Domain Specs ({specs.filter(s => s.scope === "DOMAIN").length})
          </button>
          <button
            onClick={() => {
              setActiveTab("SYSTEM");
              setSelectedDomain(null);
              setSelectedOutputType(null);
            }}
            style={{
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 500,
              background: activeTab === "SYSTEM" ? "white" : "transparent",
              color: activeTab === "SYSTEM" ? "#d97706" : "#6b7280",
              border: "none",
              borderBottom: activeTab === "SYSTEM" ? "2px solid #d97706" : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            ⚙️ System Specs ({specs.filter(s => s.scope === "SYSTEM").length})
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 20 }}>
        {/* Filters (Column 1) */}
        <div style={{ width: 220, flexShrink: 0 }}>
          {/* Filter Card */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            {/* Search Input */}
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Search name or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            {/* Active Filter Toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                style={{ accentColor: "#16a34a" }}
              />
              <span style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>Active Only</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>({specs.filter(s => s.isActive).length})</span>
            </label>

            {/* Pipeline Phase Filter - WHEN the spec runs */}
            <h3 style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase" }}>Pipeline Phase</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
              <FilterButton
                active={selectedPipelinePhase === null}
                onClick={() => setSelectedPipelinePhase(null)}
                label="All Phases"
              />
              {PIPELINE_PHASES_BY_SCOPE[scopeLocked ? (selectedScope || "ALL") : activeTab].map((phase) => {
                const config = PIPELINE_PHASE_COLORS[phase];
                const effectiveScope = scopeLocked ? selectedScope : activeTab;
                const count = specs.filter(s => s.specType === phase && (!effectiveScope || s.scope === effectiveScope)).length;
                return (
                  <FilterButton
                    key={phase}
                    active={selectedPipelinePhase === phase}
                    onClick={() => setSelectedPipelinePhase(phase)}
                    label={config.label}
                    icon={config.icon}
                    count={count}
                    color={selectedPipelinePhase === phase ? config.text : undefined}
                    bg={selectedPipelinePhase === phase ? config.bg : undefined}
                  />
                );
              })}
            </div>

            {/* Output Type Filter - WHAT the spec produces */}
            <h3 style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase" }}>Output Type</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FilterButton
                active={selectedOutputType === null}
                onClick={() => setSelectedOutputType(null)}
                label="All Types"
              />
              {OUTPUT_TYPES_BY_SCOPE[scopeLocked ? (selectedScope || "ALL") : activeTab].map((type) => {
                const config = OUTPUT_TYPE_COLORS[type];
                const effectiveScope = scopeLocked ? selectedScope : activeTab;
                const count = specs.filter(s => s.outputType === type && (!effectiveScope || s.scope === effectiveScope)).length;
                return (
                  <FilterButton
                    key={type}
                    active={selectedOutputType === type}
                    onClick={() => setSelectedOutputType(type)}
                    label={config.label}
                    icon={config.icon}
                    count={count}
                    color={selectedOutputType === type ? config.text : undefined}
                    bg={selectedOutputType === type ? config.bg : undefined}
                  />
                );
              })}
            </div>

            {/* Spec Role Filter - WHO/WHAT/HOW */}
            <h3 style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8, marginTop: 16, textTransform: "uppercase" }}>Spec Role</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FilterButton
                active={selectedSpecRole === null}
                onClick={() => setSelectedSpecRole(null)}
                label="All Roles"
              />
              {(["IDENTITY", "CONTENT", "META"] as SpecRole[]).map((role) => {
                const config = SPEC_ROLE_COLORS[role];
                const effectiveScope = scopeLocked ? selectedScope : activeTab;
                const count = specs.filter(s => s.specRole === role && (!effectiveScope || s.scope === effectiveScope)).length;
                return (
                  <FilterButton
                    key={role}
                    active={selectedSpecRole === role}
                    onClick={() => setSelectedSpecRole(role)}
                    label={`${config.icon} ${config.label}`}
                    count={count}
                    color={selectedSpecRole === role ? config.text : undefined}
                    bg={selectedSpecRole === role ? config.bg : undefined}
                  />
                );
              })}
            </div>
          </div>

          {/* Domains Card */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase" }}>Domains</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FilterButton
                active={selectedDomain === null}
                onClick={() => setSelectedDomain(null)}
                label="All Domains"
                count={Array.from(domains.values()).reduce((sum, arr) => sum + arr.length, 0)}
              />
              {Array.from(domains.entries()).map(([domain, domainSpecs]) => {
                const colors = getDomainColor(domain);
                return (
                  <FilterButton
                    key={domain}
                    active={selectedDomain === domain}
                    onClick={() => setSelectedDomain(domain)}
                    label={domain.charAt(0).toUpperCase() + domain.slice(1)}
                    count={domainSpecs.length}
                    color={selectedDomain === domain ? colors.text : undefined}
                    bg={selectedDomain === domain ? colors.bg : undefined}
                    dot={colors.bg}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Spec List (Column 2) */}
        <div style={{ width: 320, flexShrink: 0 }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: 0 }}>
                Specs
                {(selectedDomain || selectedOutputType || selectedPipelinePhase || selectedSpecRole || showActiveOnly) && (
                  <span style={{ marginLeft: 8, fontWeight: 400, color: "#9ca3af" }}>
                    ({filteredSpecs.length})
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  background: "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                + New
              </button>
            </div>
            {/* Validation Status Legend */}
            <div style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: 10, color: "#6b7280" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />
                Validated
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706" }} />
                Needs revalidation
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }} />
                Not validated
              </span>
            </div>

            <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredSpecs.length === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 13, padding: 16, textAlign: "center" }}>No specs found.</div>
              ) : (
                filteredSpecs.map((s) => {
                  const colors = getDomainColor(s.domain);
                  const outputBadge = getOutputTypeBadge(s.outputType);
                  const phaseBadge = getPipelinePhaseBadge(s.specType || "DOMAIN");
                  const roleBadge = SPEC_ROLE_COLORS[s.specRole] || SPEC_ROLE_COLORS.META;
                  const isCompiled = s.compiledAt && !s.isDirty;
                  const isDirty = s.compiledAt && s.isDirty;
                  const statusColor = isCompiled ? "#16a34a" : isDirty ? "#d97706" : "#dc2626";
                  const statusBg = isCompiled ? "#dcfce7" : isDirty ? "#fef3c7" : "#fee2e2";
                  const isSelected = selectedSpec?.id === s.id;

                  return (
                    <div
                      key={s.id}
                      onClick={() => fetchSpecDetail(s.id)}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        border: isSelected ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                        background: isSelected ? "#eef2ff" : statusBg,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: statusColor,
                                flexShrink: 0,
                              }}
                              title={isCompiled ? "Validated" : isDirty ? "Needs revalidation" : "Not validated"}
                            />
                            <span style={{ fontWeight: 500, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {s.name}
                            </span>
                            {s.isLocked && <span title={s.lockedReason || "Locked"}>🔒</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, marginLeft: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.slug}
                          </div>
                        </div>
                        <span
                          style={{
                            flexShrink: 0,
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 500,
                            background: outputBadge.bg,
                            color: outputBadge.text,
                          }}
                        >
                          {outputBadge.label}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, marginLeft: 14, fontSize: 11, color: "#6b7280", flexWrap: "wrap" }}>
                        <span>{s.actionCount || 0} params</span>
                        {/* Pipeline Phase Badge */}
                        <span style={{ padding: "1px 6px", borderRadius: 4, background: phaseBadge.bg, color: phaseBadge.text }} title={phaseBadge.desc}>
                          {phaseBadge.icon} {phaseBadge.label}
                        </span>
                        {/* Spec Role Badge */}
                        <span style={{ padding: "1px 6px", borderRadius: 4, background: roleBadge.bg, color: roleBadge.text, fontWeight: 600 }} title={roleBadge.desc}>
                          {roleBadge.label}
                        </span>
                        {s.domain && (
                          <span style={{ padding: "1px 6px", borderRadius: 4, background: colors.bg, color: colors.text }}>
                            {s.domain}
                          </span>
                        )}
                        {/* Active/Inactive Status Pill */}
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontWeight: 500,
                            background: s.isActive ? "#dcfce7" : "#f3f4f6",
                            color: s.isActive ? "#16a34a" : "#6b7280",
                          }}
                        >
                          {s.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {/* Playbook Usage */}
                      {s.playbookCount !== undefined && s.playbookCount > 0 && (
                        <div
                          style={{
                            marginTop: 6,
                            marginLeft: 14,
                            fontSize: 10,
                            color: "#6b7280",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          title={s.playbooks?.map(p => `${p.name} (${p.domain || 'No domain'})`).join(', ') || ''}
                        >
                          <span style={{ color: "#8b5cf6" }}>📋</span>
                          <span>
                            Used in {s.playbookCount} playbook{s.playbookCount > 1 ? 's' : ''}
                            {s.playbooks && s.playbooks.length > 0 && (
                              <span style={{ color: "#9ca3af" }}>
                                {' '}({s.playbooks.slice(0, 2).map(p => p.name).join(', ')}{s.playbooks.length > 2 ? '...' : ''})
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      {/* Provenance - Source Feature Set */}
                      {s.sourceFeatureSet && (
                        <div
                          style={{
                            marginTop: 6,
                            marginLeft: 14,
                            fontSize: 10,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span style={{ color: "#10b981" }}>📦</span>
                          <Link
                            href={`/lab/features/${s.sourceFeatureSet.id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              color: "#059669",
                              textDecoration: "none",
                            }}
                          >
                            Managed by {s.sourceFeatureSet.name} v{s.sourceFeatureSet.version}
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Spec Detail (Column 3) */}
        <div style={{ flex: 1, minWidth: 0, maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
          {selectedSpec ? (() => {
            const isSpecCompiled = selectedSpec.compiledAt && !selectedSpec.isDirty;
            const isSpecDirty = selectedSpec.compiledAt && selectedSpec.isDirty;
            const detailBg = isSpecCompiled ? "#f0fdf4" : isSpecDirty ? "#fffbeb" : "#fef2f2";
            const badge = getOutputTypeBadge(selectedSpec.outputType);

            return (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
              {/* Detail Header */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1f2937", margin: 0 }}>{selectedSpec.name}</h2>
                      <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 12, fontWeight: 500, background: badge.bg, color: badge.text }}>
                        {selectedSpec.outputType}
                      </span>
                      {selectedSpec.scope && (
                        editingScopeId === selectedSpec.id ? (
                          <select
                            value={selectedSpec.scope}
                            onChange={(e) => handleUpdateScope(selectedSpec.id, e.target.value as SpecScope)}
                            onBlur={() => setEditingScopeId(null)}
                            autoFocus
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 500,
                              border: "1px solid #d1d5db",
                              background: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            <option value="SYSTEM">⚙️ SYSTEM</option>
                            <option value="DOMAIN">🏢 DOMAIN</option>
                            <option value="CALLER">👤 CALLER</option>
                          </select>
                        ) : (
                          <span
                            onClick={() => !selectedSpec.isLocked && setEditingScopeId(selectedSpec.id)}
                            style={{
                              padding: "2px 10px",
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 500,
                              background: SCOPE_COLORS[selectedSpec.scope].bg,
                              color: SCOPE_COLORS[selectedSpec.scope].text,
                              cursor: selectedSpec.isLocked ? "not-allowed" : "pointer",
                              opacity: selectedSpec.isLocked ? 0.7 : 1,
                            }}
                            title={selectedSpec.isLocked ? "Locked - cannot change scope" : "Click to change scope"}
                          >
                            {SCOPE_COLORS[selectedSpec.scope].icon} {selectedSpec.scope}
                          </span>
                        )
                      )}
                      {selectedSpec.isLocked && (
                        <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 12, background: "#fef3c7", color: "#d97706" }} title={selectedSpec.lockedReason || ""}>
                          🔒 Locked ({selectedSpec.usageCount} callers)
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>{selectedSpec.description}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {/* Active Toggle */}
                    <button
                      onClick={() => handleToggleActive(selectedSpec.id, !selectedSpec.isActive)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "none",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                        background: selectedSpec.isActive ? "#dcfce7" : "#f3f4f6",
                        color: selectedSpec.isActive ? "#16a34a" : "#6b7280",
                      }}
                      title={selectedSpec.isActive ? "Click to deactivate" : "Click to activate"}
                    >
                      {selectedSpec.isActive ? "● Active" : "○ Inactive"}
                    </button>
                    {/* Validate Button */}
                    <button
                      onClick={() => handleCompileSpec(selectedSpec.id)}
                      disabled={compilingSpec === selectedSpec.id || !!selectedSpec.isLocked || !!(selectedSpec.compiledAt && !selectedSpec.isDirty)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "none",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: (compilingSpec === selectedSpec.id || selectedSpec.isLocked || (selectedSpec.compiledAt && !selectedSpec.isDirty)) ? "not-allowed" : "pointer",
                        opacity: (compilingSpec === selectedSpec.id || selectedSpec.isLocked) ? 0.5 : 1,
                        background: selectedSpec.compiledAt && !selectedSpec.isDirty ? "#dcfce7" : selectedSpec.isDirty ? "#d97706" : "#3b82f6",
                        color: selectedSpec.compiledAt && !selectedSpec.isDirty ? "#16a34a" : "#fff",
                      }}
                    >
                      {compilingSpec === selectedSpec.id ? "..." : selectedSpec.compiledAt && !selectedSpec.isDirty ? "✓ Validated" : "✓ Validate"}
                    </button>
                    {/* Enrich Button */}
                    <button
                      onClick={() => handleEnrichSpec(selectedSpec.id)}
                      disabled={enrichingSpec === selectedSpec.id || selectedSpec.isLocked}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "none",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: (enrichingSpec === selectedSpec.id || selectedSpec.isLocked) ? "not-allowed" : "pointer",
                        opacity: (enrichingSpec === selectedSpec.id || selectedSpec.isLocked) ? 0.5 : 1,
                        background: "#8b5cf6",
                        color: "#fff",
                      }}
                    >
                      {enrichingSpec === selectedSpec.id ? "..." : "🧠 Enrich"}
                    </button>
                    {/* Add Trigger */}
                    <button
                      onClick={() => checkEditWarning(selectedSpec.id, () => setShowAddTriggerModal(true))}
                      disabled={selectedSpec.isLocked}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "none",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: selectedSpec.isLocked ? "not-allowed" : "pointer",
                        opacity: selectedSpec.isLocked ? 0.5 : 1,
                        background: "#4f46e5",
                        color: "#fff",
                      }}
                    >
                      + Add Trigger
                    </button>
                  </div>
                </div>
                {/* Compilation Status Bar */}
                {selectedSpec.compiledAt && (
                  <div style={{
                    marginTop: 8,
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    background: selectedSpec.isDirty ? "#fffbeb" : "#f0fdf4",
                    color: selectedSpec.isDirty ? "#d97706" : "#16a34a",
                    border: `1px solid ${selectedSpec.isDirty ? "#fde68a" : "#bbf7d0"}`,
                  }}>
                    {selectedSpec.isDirty ? (
                      <>⚠️ Needs revalidation: {selectedSpec.dirtyReason || "spec modified"}</>
                    ) : (
                      <>✓ Validated {new Date(selectedSpec.compiledAt).toLocaleString()}</>
                    )}
                  </div>
                )}
                {compileResult && compileResult.specId === selectedSpec.id && (
                  <div style={{
                    marginTop: 8,
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 12,
                    background: compileResult.ok ? "#f0fdf4" : compileResult.warning ? "#fffbeb" : "#fef2f2",
                    color: compileResult.ok ? "#16a34a" : compileResult.warning ? "#d97706" : "#dc2626",
                    border: `1px solid ${compileResult.ok ? "#bbf7d0" : compileResult.warning ? "#fde68a" : "#fecaca"}`,
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {compileResult.ok ? "✓ Validation successful" : compileResult.warning ? "⚠️ Revalidating..." : "✗ Validation failed"}
                    </div>
                    {compileResult.message && <div>{compileResult.message}</div>}
                    {compileResult.errors?.map((e: any, i: number) => (
                      <div key={i} style={{ marginTop: 4 }}>• {e.name}: {e.error}</div>
                    ))}
                    {compileResult.warnings?.map((w: any, i: number) => (
                      <div key={i} style={{ marginTop: 4, color: "#d97706" }}>• {w.name}: {w.error}</div>
                    ))}
                  </div>
                )}
                {enrichResult && enrichResult.specId === selectedSpec.id && (
                  <div style={{
                    marginTop: 8,
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 12,
                    background: enrichResult.ok ? "#f3e8ff" : "#fef2f2",
                    color: enrichResult.ok ? "#7c3aed" : "#dc2626",
                    border: `1px solid ${enrichResult.ok ? "#ddd6fe" : "#fecaca"}`,
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {enrichResult.ok ? "🧠 Enrichment complete" : "✗ Enrichment failed"}
                    </div>
                    {enrichResult.message && <div>{enrichResult.message}</div>}
                    {enrichResult.enriched && (
                      <div style={{ marginTop: 4 }}>Enriched {enrichResult.enriched} action term(s)</div>
                    )}
                    {enrichResult.error && <div style={{ marginTop: 4 }}>{enrichResult.error}</div>}
                  </div>
                )}
              </div>

              {/* Data Flow Panel - Shows what this spec READS and GENERATES */}
              {(() => {
                // Define data flow based on outputType (pipeline stage)
                const dataFlowConfig: Record<string, { reads: string[]; generates: string[]; phase: string; description: string }> = {
                  LEARN: {
                    reads: ["Call.transcript"],
                    generates: ["CallerMemory", "CallScore"],
                    phase: "① LEARN",
                    description: "Extracts caller data: memories, personality scores"
                  },
                  MEASURE: {
                    reads: ["Call.transcript", "BehaviorTarget"],
                    generates: ["BehaviorMeasurement", "RewardScore"],
                    phase: "② MEASURE",
                    description: "Scores behaviour against targets"
                  },
                  ADAPT: {
                    reads: ["CallScore[]", "CallerProfile"],
                    generates: ["CallTarget", "CallerTarget"],
                    phase: "③ ADAPT",
                    description: "Computes personalized targets for next call"
                  },
                  COMPOSE: {
                    reads: ["CallerMemory", "CallerTarget", "IDENTITY spec", "CONTENT spec"],
                    generates: ["Prompt section"],
                    phase: "④ COMPOSE",
                    description: "Builds a section of the agent prompt"
                  },
                };

                // Special handling for COMPOSE spec roles
                const roleConfig: Record<string, { function: string; icon: string; provides: string }> = {
                  IDENTITY: { function: "WHO the agent is", icon: "🎭", provides: "Persona, role, traits → Prompt section" },
                  CONTENT: { function: "WHAT the agent knows", icon: "📚", provides: "Domain knowledge, curriculum → Prompt section" },
                  CONTEXT: { function: "CALLER context", icon: "👤", provides: "Memories, preferences, history → Prompt section" },
                  META: { function: "Legacy", icon: "⚙️", provides: "Kept for migration" },
                };

                const flowInfo = dataFlowConfig[selectedSpec.outputType];
                const roleInfo = selectedSpec.specRole ? roleConfig[selectedSpec.specRole] : null;

                const phaseColors: Record<string, { bg: string; border: string; text: string }> = {
                  OBSERVE: { bg: "#f0fdf4", border: "#86efac", text: "#16a34a" },
                  EVALUATE: { bg: "#fefce8", border: "#fde047", text: "#ca8a04" },
                  COMPOSE: { bg: "#fdf4ff", border: "#e879f9", text: "#a855f7" },
                };
                const phaseStyle = flowInfo ? phaseColors[flowInfo.phase] : phaseColors.OBSERVE;

                return (
                  <div style={{
                    marginBottom: 16,
                    padding: 16,
                    background: phaseStyle.bg,
                    border: `1px solid ${phaseStyle.border}`,
                    borderRadius: 8
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: phaseStyle.text }}>
                        📊 Data Flow
                      </span>
                      {flowInfo && (
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 500,
                          background: phaseStyle.border,
                          color: "#fff"
                        }}>
                          {flowInfo.phase} phase
                        </span>
                      )}
                    </div>

                    {/* Role info for IDENTITY/CONTENT specs */}
                    {roleInfo && selectedSpec.specRole !== "META" && (
                      <div style={{
                        marginBottom: 12,
                        padding: 10,
                        background: "#fff",
                        borderRadius: 6,
                        fontSize: 13
                      }}>
                        <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                          {roleInfo.icon} {selectedSpec.specRole}: {roleInfo.function}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 12 }}>
                          {roleInfo.provides}
                        </div>
                      </div>
                    )}

                    {/* Data flow diagram */}
                    {flowInfo && (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        {/* READS */}
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" }}>
                            Reads
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {flowInfo.reads.map((r, i) => (
                              <span key={i} style={{
                                padding: "4px 8px",
                                background: "#fff",
                                borderRadius: 4,
                                fontSize: 12,
                                color: "#374151",
                                fontFamily: "monospace"
                              }}>
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Arrow */}
                        <div style={{ fontSize: 20, color: phaseStyle.text }}>→</div>

                        {/* GENERATES */}
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" }}>
                            Generates
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {flowInfo.generates.map((g, i) => (
                              <span key={i} style={{
                                padding: "4px 8px",
                                background: phaseStyle.border,
                                borderRadius: 4,
                                fontSize: 12,
                                color: "#fff",
                                fontWeight: 500,
                                fontFamily: "monospace"
                              }}>
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {flowInfo && (
                      <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>
                        {flowInfo.description}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Prompt Template Section - Only for COMPOSE specs */}
              {selectedSpec.outputType === "COMPOSE" && (
                <PromptTemplateSection
                  spec={selectedSpec}
                  onUpdate={(newTemplate) => {
                    setSelectedSpec({ ...selectedSpec, promptTemplate: newTemplate });
                    fetchSpecs();
                  }}
                />
              )}

              {/* Pipeline Stage Info - Based on outputType */}
              {selectedSpec.outputType === "ADAPT" && (
                <div style={{ marginTop: 16, padding: 16, background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 16 }}>🎯</span>
                    <span style={{ fontWeight: 600, color: "#0d9488" }}>③ ADAPT Stage</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    <strong>ADAPT specs</strong> compute personalized targets for the next call.
                    They read caller scores and profiles, then produce behavioral targets
                    that guide prompt composition.
                  </div>
                  {/* Config display */}
                  {selectedSpec.config && (
                    <div style={{ background: "#fff", borderRadius: 6, padding: 12, marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase" }}>
                        Config
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 12, color: "#374151", whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(selectedSpec.config, null, 2)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Configuration Requirements Banner */}
              {(() => {
                const hasTriggers = selectedSpec.triggers && selectedSpec.triggers.length > 0;
                const hasActions = hasTriggers && selectedSpec.triggers!.some(t => t.actions.length > 0);
                const actionsWithParams = selectedSpec.triggers?.flatMap(t => t.actions.filter(a => a.parameter)) || [];
                const actionsWithGuidance = selectedSpec.triggers?.flatMap(t => t.actions.filter(a => a.description && a.description.length > 50)) || [];

                if (selectedSpec.outputType === "MEASURE") {
                  // MEASURE specs score behaviour - need parameters with targets
                  const missingItems = [];
                  if (!hasTriggers) missingItems.push("triggers");
                  if (!hasActions) missingItems.push("actions");
                  if (actionsWithParams.length === 0) missingItems.push("parameters on actions");

                  if (missingItems.length > 0) {
                    return (
                      <div style={{ marginTop: 16, padding: 12, background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 8, fontSize: 13 }}>
                        <div style={{ fontWeight: 600, color: "#4338ca", marginBottom: 4 }}>📊 MEASURE Spec Configuration</div>
                        <div style={{ color: "#4f46e5" }}>
                          Still needed: {missingItems.join(", ")}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 11, color: "#6366f1" }}>
                          MEASURE specs score behaviour against targets
                        </div>
                      </div>
                    );
                  }
                } else if (selectedSpec.outputType === "LEARN") {
                  // LEARN specs extract memories - check for learn categories
                  const actionsWithCategory = selectedSpec.triggers?.flatMap(t => t.actions.filter(a => a.learnCategory)) || [];
                  const missingItems = [];
                  if (!hasTriggers) missingItems.push("triggers");
                  if (!hasActions) missingItems.push("actions");
                  if (actionsWithCategory.length === 0 && hasActions) missingItems.push("learn categories on actions");

                  if (missingItems.length > 0) {
                    return (
                      <div style={{ marginTop: 16, padding: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 13 }}>
                        <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 4 }}>💾 LEARN Spec Configuration</div>
                        <div style={{ color: "#b45309" }}>
                          Still needed: {missingItems.join(", ")}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 11, color: "#d97706" }}>
                          Note: Parameters and anchors are not required for LEARN specs
                        </div>
                      </div>
                    );
                  }
                } else if (selectedSpec.outputType === "COMPOSE") {
                  // COMPOSE specs generate prompt content - work with guidance
                  if (!hasTriggers) {
                    return (
                      <div style={{ marginTop: 16, padding: 12, background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8, fontSize: 13 }}>
                        <div style={{ fontWeight: 600, color: "#a16207", marginBottom: 4 }}>✍️ COMPOSE Spec Configuration</div>
                        <div style={{ color: "#ca8a04" }}>
                          Still needed: triggers defining composition scenarios
                        </div>
                      </div>
                    );
                  }
                } else if (selectedSpec.outputType === "ADAPT") {
                  // ADAPT specs compute targets from measurements
                  if (!hasTriggers || !hasActions) {
                    const missingItems = [];
                    if (!hasTriggers) missingItems.push("triggers");
                    if (!hasActions) missingItems.push("actions with adaptation guidance");
                    return (
                      <div style={{ marginTop: 16, padding: 12, background: "#ccfbf1", border: "1px solid #5eead4", borderRadius: 8, fontSize: 13 }}>
                        <div style={{ fontWeight: 600, color: "#0d9488", marginBottom: 4 }}>🎯 ADAPT Spec Configuration</div>
                        <div style={{ color: "#0f766e" }}>
                          Still needed: {missingItems.join(", ")}
                        </div>
                      </div>
                    );
                  }
                }
                return null;
              })()}

              {/* Triggers */}
              {selectedSpec.triggers && selectedSpec.triggers.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 20 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
                    Triggers ({selectedSpec.triggers.length})
                  </span>
                  <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                    <button
                      onClick={() => {
                        const allTriggerIds = new Set(selectedSpec.triggers!.map(t => t.id));
                        const allActionIds = new Set(selectedSpec.triggers!.flatMap(t => t.actions.map(a => a.id)));
                        setExpandedTriggers(allTriggerIds);
                        setExpandedActions(allActionIds);
                      }}
                      style={{ padding: "4px 8px", borderRadius: 4, border: "none", fontSize: 12, color: "#6b7280", background: "transparent", cursor: "pointer" }}
                    >
                      Expand All
                    </button>
                    <button
                      onClick={() => {
                        setExpandedTriggers(new Set());
                        setExpandedActions(new Set());
                      }}
                      style={{ padding: "4px 8px", borderRadius: 4, border: "none", fontSize: 12, color: "#6b7280", background: "transparent", cursor: "pointer" }}
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {selectedSpec.triggers?.map((trigger, tIdx) => (
                  <div key={trigger.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}>
                    <div
                      onClick={() => toggleTrigger(trigger.id)}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, cursor: "pointer" }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, color: "#1f2937" }}>
                          Trigger {tIdx + 1}: {trigger.name || "Unnamed"}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
                          {trigger.actions.length} action{trigger.actions.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <span style={{ color: "#9ca3af" }}>
                        {expandedTriggers.has(trigger.id) ? "▾" : "▸"}
                      </span>
                    </div>

                    {expandedTriggers.has(trigger.id) && (
                      <div style={{ borderTop: "1px solid #f3f4f6", padding: 16 }}>
                        {/* Given/When/Then */}
                        <div style={{ marginBottom: 16, padding: 12, background: "#f9fafb", borderRadius: 6, fontFamily: "monospace", fontSize: 13 }}>
                          <div style={{ marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: "#7c3aed" }}>Given</span>{" "}
                            <span style={{ color: "#1f2937" }}>{trigger.given}</span>
                          </div>
                          <div style={{ marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: "#2563eb" }}>When</span>{" "}
                            <span style={{ color: "#1f2937" }}>{trigger.when}</span>
                          </div>
                          <div>
                            <span style={{ fontWeight: 600, color: "#16a34a" }}>Then</span>{" "}
                            <span style={{ color: "#1f2937" }}>{trigger.then}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                          {trigger.actions.map((action, aIdx) => (
                            <div key={action.id} className="rounded border border-neutral-200 dark:border-neutral-700">
                              <div
                                onClick={() => toggleAction(action.id)}
                                className="flex cursor-pointer items-center justify-between p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700"
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                                    selectedSpec.outputType === "LEARN"
                                      ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                                      : "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                                  }`}>
                                    {selectedSpec.outputType === "LEARN" ? "EXT" : "AC"}{aIdx + 1}
                                  </span>
                                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                    {action.description}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  {selectedSpec.outputType === "MEASURE" && action.parameter && (
                                    <span className="rounded bg-purple-100 dark:bg-purple-900 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-300">
                                      {action.parameter.parameterId}
                                    </span>
                                  )}
                                  {selectedSpec.outputType === "LEARN" && action.learnCategory && (
                                    <span className="rounded bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                                      {action.learnCategory}
                                    </span>
                                  )}
                                  <span className="text-neutral-500 dark:text-neutral-400">
                                    {expandedActions.has(action.id) ? "▾" : "▸"}
                                  </span>
                                </div>
                              </div>

                              {expandedActions.has(action.id) && (
                                <div className="border-t border-neutral-100 dark:border-neutral-700 p-3">
                                  {/* MEASURE: Show parameter + anchors */}
                                  {selectedSpec.outputType === "MEASURE" && action.parameter && (
                                    <>
                                      <div className="mb-3 rounded bg-purple-50 dark:bg-purple-900/30 p-2 text-sm">
                                        <div className="font-medium text-purple-900 dark:text-purple-200">
                                          Parameter: {action.parameter.name}
                                        </div>
                                        {action.parameter.definition && (
                                          <div className="mt-1 text-purple-700 dark:text-purple-300">
                                            {action.parameter.definition}
                                          </div>
                                        )}
                                        <div className="mt-2 flex gap-4 text-xs">
                                          {action.parameter.interpretationHigh && (
                                            <div>
                                              <span className="font-medium text-green-700 dark:text-green-400">High:</span>{" "}
                                              <span className="text-neutral-700 dark:text-neutral-300">{action.parameter.interpretationHigh}</span>
                                            </div>
                                          )}
                                          {action.parameter.interpretationLow && (
                                            <div>
                                              <span className="font-medium text-red-700 dark:text-red-400">Low:</span>{" "}
                                              <span className="text-neutral-700 dark:text-neutral-300">{action.parameter.interpretationLow}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Anchors */}
                                      {action.parameter.scoringAnchors?.length > 0 && (
                                        <div>
                                          <div className="mb-2 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400">
                                            Scoring Anchors
                                          </div>
                                          <div className="space-y-2">
                                            {action.parameter.scoringAnchors.map((anchor) => (
                                              <div key={anchor.id} className="rounded bg-neutral-50 dark:bg-neutral-900 p-2 text-sm">
                                                <div className="flex items-center gap-2">
                                                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${getScoreColor(anchor.score)}`}>
                                                    {anchor.score}{anchor.isGold && " ⭐"}
                                                  </span>
                                                  <span className="text-neutral-800 dark:text-neutral-200">"{anchor.example}"</span>
                                                </div>
                                                {anchor.rationale && (
                                                  <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{anchor.rationale}</div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}

                                  {/* LEARN: Show learnion config */}
                                  {selectedSpec.outputType === "LEARN" && (
                                    <div className="rounded bg-amber-50 dark:bg-amber-900/30 p-2 text-sm">
                                      <div className="font-medium text-amber-900 dark:text-amber-200">
                                        Learns to: {action.learnCategory || "Not configured"}
                                      </div>
                                      {action.learnKeyPrefix && (
                                        <div className="mt-1 text-amber-700 dark:text-amber-300">
                                          Key prefix: <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{action.learnKeyPrefix}</code>
                                        </div>
                                      )}
                                      {action.learnKeyHint && (
                                        <div className="mt-1 text-amber-700 dark:text-amber-300">
                                          Hint: {action.learnKeyHint}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {(!selectedSpec.triggers || selectedSpec.triggers.length === 0) && (
                  <div className="rounded-md bg-neutral-50 dark:bg-neutral-800 p-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
                    No triggers yet. Click "+ Add Trigger" to get started.
                  </div>
                )}
              </div>
            </div>
            );
          })() : (
            <div style={{
              display: "flex",
              height: 256,
              alignItems: "center",
              justifyContent: "center",
              color: "#9ca3af",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
            }}>
              Select a spec to view details
            </div>
          )}
        </div>
      </div>

      {/* Create Spec Modal */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600, color: "#1f2937" }}>Create Analysis Spec</h3>
            <CreateSpecForm
              onClose={() => setShowCreateModal(false)}
              onCreated={() => {
                setShowCreateModal(false);
                fetchSpecs();
              }}
            />
          </div>
        </div>
      )}

      {/* Add Trigger Modal */}
      {showAddTriggerModal && selectedSpec && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
          <div style={{ maxHeight: "90vh", width: "100%", maxWidth: 640, overflowY: "auto", background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600, color: "#1f2937" }}>Add Trigger to "{selectedSpec.name}"</h3>
            <AddTriggerForm
              specId={selectedSpec.id}
              outputType={selectedSpec.outputType}
              parameters={parameters}
              onClose={() => setShowAddTriggerModal(false)}
              onCreated={() => {
                setShowAddTriggerModal(false);
                fetchSpecDetail(selectedSpec.id);
              }}
            />
          </div>
        </div>
      )}

      {/* Compile Modal */}
      {showCompileModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600, color: "#1f2937" }}>Validate Analysis Specs</h3>
            <CompileSpecsForm
              profiles={profiles}
              activeSpecs={specs.filter(s => s.isActive)}
              measureCount={measureCount}
              learnCount={learnCount}
              onClose={() => setShowCompileModal(false)}
            />
          </div>
        </div>
      )}

      {/* Edit Warning Modal */}
      {showEditWarningModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
          <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <h3 style={{ marginBottom: 8, fontSize: 18, fontWeight: 600, color: "#d97706" }}>⚠️ Editing Validated Spec</h3>
            <p style={{ marginBottom: 16, fontSize: 14, color: "#374151" }}>
              This spec has been validated and is ready for use. Making changes will mark it as "dirty" and require revalidation before it can be used in analysis runs.
            </p>
            <p style={{ marginBottom: 16, fontSize: 14, color: "#374151" }}>
              Are you sure you want to continue editing?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => { setShowEditWarningModal(false); setPendingEdit(null); }}
                style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", fontSize: 14, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmEdit}
                style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#d97706", color: "#fff", fontSize: 14, cursor: "pointer" }}
              >
                Continue Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Prompt Template Section Component
function PromptTemplateSection({
  spec,
  onUpdate,
}: {
  spec: AnalysisSpec;
  onUpdate: (template: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [template, setTemplate] = useState(spec.promptTemplate || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewValue, setPreviewValue] = useState(0.7);
  const [showPreview, setShowPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  // Get parameter info from spec's actions for preview
  const parameterFromSpec = spec.triggers?.flatMap(t => t.actions).find(a => a.parameter)?.parameter;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/analysis-specs/${spec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptTemplate: template || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      onUpdate(template || null);
      setEditing(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handlePreview() {
    if (!template) {
      setPreviewResult("No template defined");
      return;
    }

    // Simple client-side preview rendering
    const label = previewValue >= 0.7 ? "high" : previewValue >= 0.3 ? "medium" : "low";
    let result = template;

    // Handle conditionals
    result = result.replace(/\{\{#if high\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, content) =>
      previewValue >= 0.7 ? content : ""
    );
    result = result.replace(/\{\{#if medium\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, content) =>
      previewValue >= 0.3 && previewValue < 0.7 ? content : ""
    );
    result = result.replace(/\{\{#if low\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, content) =>
      previewValue < 0.3 ? content : ""
    );

    // Handle variables
    result = result.replace(/\{\{value\}\}/g, previewValue.toFixed(2));
    result = result.replace(/\{\{label\}\}/g, label);
    result = result.replace(/\{\{param\.name\}\}/g, parameterFromSpec?.name || "[parameter]");
    result = result.replace(/\{\{param\.definition\}\}/g, parameterFromSpec?.definition || "[definition]");
    result = result.replace(/\{\{param\.highLabel\}\}/g, parameterFromSpec?.interpretationHigh || "High");
    result = result.replace(/\{\{param\.lowLabel\}\}/g, parameterFromSpec?.interpretationLow || "Low");

    // Clean up remaining tags
    result = result.replace(/\{\{[^}]+\}\}/g, "");
    result = result.replace(/\n{3,}/g, "\n\n").trim();

    setPreviewResult(result);
    setShowPreview(true);
  }

  const exampleTemplates: Record<OutputType, string> = {
    LEARN: `{{#if hasMemories}}Use these memories about the caller in your conversation:
{{#each memories.facts}}- {{this.key}}: {{this.value}}
{{/each}}{{/if}}`,
    MEASURE: `Behaviour score for {{param.name}}: {{value}} ({{label}}).
{{#if high}}Agent is performing well on this dimension.{{/if}}
{{#if medium}}Agent behavior is acceptable but could improve.{{/if}}
{{#if low}}Agent needs adjustment on this behavior.{{/if}}`,
    ADAPT: `Based on caller profile for {{param.name}}:
{{#if high}}Great engagement! Continue current approach.{{/if}}
{{#if medium}}Making progress. Consider adjusting strategy.{{/if}}
{{#if low}}Limited engagement. Try a different approach.{{/if}}`,
    COMPOSE: `You are an expert at creating personalized conversational AI agent prompts.

## Caller Profile
- Name: {{caller.name}}
- Previous calls: {{caller.callCount}}

{{#personality}}
### Personality
{{#traits}}
- **{{name}}**: {{level}} ({{score}})
{{/traits}}
{{/personality}}

{{#hasMemories}}
### Known Information
{{#each memories.facts}}- {{this.key}}: {{this.value}}
{{/each}}
{{/hasMemories}}

Generate guidance for the next conversation.`,
  };

  return (
    <div className="mb-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">📝 Prompt Template</span>
          {spec.promptTemplate ? (
            <span className="rounded bg-green-100 dark:bg-green-900 px-2 py-0.5 text-xs text-green-700 dark:text-green-300">Configured</span>
          ) : (
            <span className="rounded bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 text-xs text-neutral-600 dark:text-neutral-400">Not set</span>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => {
              setTemplate(spec.promptTemplate || "");
              setEditing(true);
            }}
            disabled={spec.isLocked}
            className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {spec.promptTemplate ? "Edit" : "Add Template"}
          </button>
        )}
      </div>

      <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">
        Template text that will be injected into prompts when this spec is active. Use variables like{" "}
        <code className="bg-neutral-100 dark:bg-neutral-700 px-1 rounded">{"{{value}}"}</code>,{" "}
        <code className="bg-neutral-100 dark:bg-neutral-700 px-1 rounded">{"{{label}}"}</code>, and conditionals like{" "}
        <code className="bg-neutral-100 dark:bg-neutral-700 px-1 rounded">{"{{#if high}}...{{/if}}"}</code>.
      </p>

      {editing ? (
        <div className="space-y-3">
          {error && (
            <div className="rounded bg-red-50 dark:bg-red-900/30 p-2 text-xs text-red-700 dark:text-red-300">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Template
            </label>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder={exampleTemplates[spec.outputType]}
              rows={6}
              className="w-full rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-mono text-neutral-900 dark:text-neutral-100"
            />
          </div>

          {/* Quick insert buttons */}
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 mr-2">Insert:</span>
            {["{{value}}", "{{label}}", "{{param.name}}", "{{#if high}}{{/if}}", "{{#if low}}{{/if}}"].map((v) => (
              <button
                key={v}
                onClick={() => setTemplate(template + v)}
                className="rounded bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 text-xs font-mono text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"
              >
                {v}
              </button>
            ))}
          </div>

          {/* Preview section */}
          <div className="rounded bg-neutral-50 dark:bg-neutral-900 p-3">
            <div className="flex items-center gap-4 mb-2">
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Preview with value:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={previewValue}
                onChange={(e) => setPreviewValue(parseFloat(e.target.value))}
                className="w-32"
              />
              <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400">{previewValue.toFixed(1)}</span>
              <button
                onClick={handlePreview}
                className="rounded bg-purple-100 dark:bg-purple-900 px-2 py-1 text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800"
              >
                Preview
              </button>
            </div>
            {showPreview && previewResult && (
              <div className="rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-2 text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">
                {previewResult}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setEditing(false);
                setShowPreview(false);
                setPreviewResult(null);
              }}
              className="rounded border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setTemplate(exampleTemplates[spec.outputType]);
              }}
              className="rounded border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300"
            >
              Use Example
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Template"}
            </button>
          </div>
        </div>
      ) : spec.promptTemplate ? (
        <div className="rounded bg-neutral-50 dark:bg-neutral-900 p-3 text-sm font-mono text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap max-h-40 overflow-y-auto">
          {spec.promptTemplate}
        </div>
      ) : (
        <div className="text-xs text-neutral-500 dark:text-neutral-400 italic">
          No template configured. Add one to inject guidance into prompts based on this spec's analysis results.
        </div>
      )}
    </div>
  );
}

// Create Spec Form
function CreateSpecForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [outputType, setOutputType] = useState<"MEASURE" | "LEARN">("MEASURE");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !name) return;

    try {
      setSaving(true);
      const res = await fetch("/api/analysis-specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name,
          description: description || undefined,
          outputType,
          domain: domain || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onCreated();
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="mb-4 rounded bg-red-50 dark:bg-red-900/30 p-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Output Type</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <input
              type="radio"
              value="MEASURE"
              checked={outputType === "MEASURE"}
              onChange={() => setOutputType("MEASURE")}
            />
            <span className="text-sm">📊 Measure (scores)</span>
          </label>
          <label className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <input
              type="radio"
              value="LEARN"
              checked={outputType === "LEARN"}
              onChange={() => setOutputType("LEARN")}
            />
            <span className="text-sm">💾 Learn (memories)</span>
          </label>
        </div>
        {/* Output Type Info Banner */}
        <div className={`mt-3 rounded-md p-3 text-xs ${outputType === "MEASURE" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"}`}>
          {outputType === "MEASURE" ? (
            <>
              <div className="font-semibold mb-1">MEASURE specs require:</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Parameters (dimensions to score, e.g., "openness")</li>
                <li>Scoring Anchors (3+ calibration examples per parameter)</li>
                <li>Each action must be linked to a parameter</li>
              </ul>
            </>
          ) : (
            <>
              <div className="font-semibold mb-1">LEARN specs require:</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Learn Category (FACT, PREFERENCE, EVENT, etc.)</li>
                <li>Key Prefix (e.g., "relationship_", "hobby_")</li>
                <li>No parameters or anchors needed</li>
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Slug</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
          placeholder={outputType === "LEARN" ? "memory-personal-facts" : "personality-openness"}
          className="w-full rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          required
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={outputType === "LEARN" ? "Memory - Personal Facts" : "Personality - Openness"}
          className="w-full rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          required
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Domain</label>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="w-full rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
        >
          <option value="">Select domain...</option>
          <option value="personality">Personality</option>
          <option value="engagement">Engagement</option>
          <option value="conversation">Conversation</option>
          <option value="memory">Memory</option>
          <option value="safety">Safety</option>
          <option value="commercial">Commercial</option>
        </select>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded border border-neutral-300 dark:border-neutral-600 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !slug || !name}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
}

// Validate Specs Form
function CompileSpecsForm({
  profiles,
  activeSpecs,
  measureCount,
  learnCount,
  onClose,
}: {
  profiles: { id: string; name: string }[];
  activeSpecs: AnalysisSpec[];
  measureCount: number;
  learnCount: number;
  onClose: () => void;
}) {
  const [name, setName] = useState(`Analysis Set ${new Date().toLocaleDateString()}`);
  const [description, setDescription] = useState("");
  const [profileId, setProfileId] = useState("");
  const [saving, setSaving] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function handleCompile(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !profileId) return;

    try {
      setSaving(true);
      setError(null);

      // Step 1: Create the compiled set
      const createRes = await fetch("/api/compiled-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          analysisProfileId: profileId,
          specIds: activeSpecs.map(s => s.id),
        }),
      });
      const createData = await createRes.json();

      if (!createData.ok) {
        setError(createData.error || "Failed to create compiled set");
        setSaving(false);
        return;
      }

      const compiledSetId = createData.compiledSet.id;
      setSaving(false);
      setCompiling(true);

      // Step 2: Compile the set
      const compileRes = await fetch(`/api/compiled-sets/${compiledSetId}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      const compileData = await compileRes.json();
      setResult(compileData);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
      setCompiling(false);
    }
  }

  async function handleForceCompile() {
    if (!result?.compiledSet?.id) return;
    setCompiling(true);
    try {
      const compileRes = await fetch(`/api/compiled-sets/${result.compiledSet.id}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const compileData = await compileRes.json();
      setResult(compileData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCompiling(false);
    }
  }

  // Show result screen
  if (result) {
    return (
      <div>
        {result.ok ? (
          <div className="rounded-lg bg-green-50 p-4 mb-4">
            <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
              <span>✓</span> Compilation Successful
            </div>
            <p className="text-sm text-green-700">{result.message}</p>
            {result.summary && (
              <div className="mt-3 text-sm text-green-700">
                <div>{result.summary.measureSpecs} MEASURE specs</div>
                <div>{result.summary.learnSpecs} LEARN specs</div>
                <div>{result.summary.parameters} parameters ({result.summary.enrichedParameters} enriched)</div>
                <div>{result.summary.totalAnchors} scoring anchors</div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-red-50 p-4 mb-4">
            <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
              <span>✗</span> Compilation Failed
            </div>
            <p className="text-sm text-red-700 mb-3">{result.error}</p>

            {result.errors?.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-red-800 mb-1">Errors:</div>
                {result.errors.map((e: any, i: number) => (
                  <div key={i} className="text-xs bg-white rounded p-2 mb-1 text-red-700">
                    <strong>{e.name}</strong>: {e.error}
                  </div>
                ))}
              </div>
            )}

            {result.warnings?.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-amber-800 mb-1">Warnings:</div>
                {result.warnings.map((w: any, i: number) => (
                  <div key={i} className="text-xs bg-amber-50 rounded p-2 mb-1 text-amber-700">
                    <strong>{w.name}</strong>: {w.error}
                  </div>
                ))}
              </div>
            )}

            {result.hint && (
              <p className="text-xs text-neutral-600 italic">{result.hint}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {!result.ok && result.warnings?.length > 0 && (
            <button
              onClick={handleForceCompile}
              disabled={compiling}
              className="rounded bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {compiling ? "Validating..." : "Force Validate (ignore warnings)"}
            </button>
          )}
          <Link
            href="/compiled-sets"
            className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            View Validated Sets
          </Link>
          <button onClick={onClose} className="rounded border px-4 py-2 text-sm">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleCompile}>
      {error && <div className="mb-4 rounded bg-red-50 dark:bg-red-900/30 p-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="mb-4 rounded-lg bg-neutral-50 dark:bg-neutral-900 p-4">
        <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">Will validate:</div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded bg-indigo-100 dark:bg-indigo-900 px-2 py-1 text-indigo-700 dark:text-indigo-300">{measureCount} MEASURE</span>
          <span className="rounded bg-amber-100 dark:bg-amber-900 px-2 py-1 text-amber-700 dark:text-amber-300">{learnCount} LEARN</span>
          <span className="rounded bg-teal-100 dark:bg-teal-900 px-2 py-1 text-teal-700 dark:text-teal-300">{activeSpecs.filter(s => s.outputType === "ADAPT").length} ADAPT</span>
        </div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
          {activeSpecs.length} total active specs will be validated
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Full Analysis v1.0"
          className="w-full rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          required
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Analysis Profile *</label>
        <select
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          className="w-full rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          required
        >
          <option value="">Select a profile...</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
          The profile will be locked once the validated set is used in analysis runs
        </p>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded border border-neutral-300 dark:border-neutral-600 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || compiling || !name || !profileId}
          className="rounded bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Creating..." : compiling ? "Validating..." : "Validate"}
        </button>
      </div>
    </form>
  );
}

// Add Trigger Form (simplified - full version would have action editing)
function AddTriggerForm({
  specId,
  outputType,
  parameters,
  onClose,
  onCreated,
}: {
  specId: string;
  outputType: OutputType;
  parameters: FullParameter[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [given, setGiven] = useState("");
  const [when, setWhen] = useState("");
  const [then, setThen] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!given || !when || !then) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/analysis-specs/${specId}/triggers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          given,
          when,
          then,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onCreated();
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="mb-4 rounded bg-red-50 dark:bg-red-900/30 p-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Trigger Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={outputType === "LEARN" ? "Caller mentions personal info" : "Caller responds to alternatives"}
          className="w-full rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>

      <div className="mb-4 rounded bg-neutral-50 dark:bg-neutral-900 p-3">
        <label className="mb-2 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Trigger Condition</label>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="w-16 pt-2 text-sm font-semibold text-purple-600 dark:text-purple-400">Given</span>
            <textarea
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              placeholder="The context or precondition"
              rows={2}
              className="flex-1 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
              required
            />
          </div>
          <div className="flex items-start gap-2">
            <span className="w-16 pt-2 text-sm font-semibold text-blue-600 dark:text-blue-400">When</span>
            <textarea
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              placeholder="The trigger event"
              rows={2}
              className="flex-1 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
              required
            />
          </div>
          <div className="flex items-start gap-2">
            <span className="w-16 pt-2 text-sm font-semibold text-green-600 dark:text-green-400">Then</span>
            <textarea
              value={then}
              onChange={(e) => setThen(e.target.value)}
              placeholder={outputType === "LEARN" ? "Learn the relevant information" : "Score the behavior"}
              rows={2}
              className="flex-1 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
              required
            />
          </div>
        </div>
      </div>

      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        After creating the trigger, you can add actions to define what to {outputType === "LEARN" ? "learn" : "measure"}.
      </p>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded border border-neutral-300 dark:border-neutral-600 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !given || !when || !then}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add Trigger"}
        </button>
      </div>
    </form>
  );
}
