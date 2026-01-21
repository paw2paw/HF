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

type AnalysisSpec = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  outputType: "MEASURE" | "LEARN";
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

// Domain colors
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
  const [selectedOutputType, setSelectedOutputType] = useState<"MEASURE" | "LEARN" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTriggers, setExpandedTriggers] = useState<Set<string>>(new Set());
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

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

  // Group specs by domain
  const domains = useMemo(() => {
    const domainMap = new Map<string, AnalysisSpec[]>();
    for (const s of specs) {
      const domain = s.domain || "uncategorized";
      if (!domainMap.has(domain)) domainMap.set(domain, []);
      domainMap.get(domain)!.push(s);
    }
    return domainMap;
  }, [specs]);

  // Filter specs
  const filteredSpecs = useMemo(() => {
    let result = specs;
    if (selectedDomain) {
      result = result.filter((s) => (s.domain || "uncategorized") === selectedDomain);
    }
    if (selectedOutputType) {
      result = result.filter((s) => s.outputType === selectedOutputType);
    }
    return result;
  }, [specs, selectedDomain, selectedOutputType]);

  useEffect(() => {
    fetchSpecs();
    fetchParameters();
    fetchProfiles();
  }, []);

  // Handle initial select from URL query param (e.g., from Run Configs click-through)
  useEffect(() => {
    if (!initialSelectHandled && specs.length > 0) {
      const selectId = searchParams.get("select");
      if (selectId) {
        fetchSpecDetail(selectId);
      }
      setInitialSelectHandled(true);
    }
  }, [specs, searchParams, initialSelectHandled]);

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
      } else {
        setError(data.error || "Failed to update");
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
        message: "This spec has been modified since last compile. Recompiling now...",
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
      <div className="p-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Analysis Specs</h1>
        <div className="text-neutral-600 dark:text-neutral-400">Loading...</div>
      </div>
    );
  }

  // Count active specs
  const activeSpecCount = specs.filter(s => s.isActive).length;
  const measureCount = specs.filter(s => s.isActive && s.outputType === "MEASURE").length;
  const learnCount = specs.filter(s => s.isActive && s.outputType === "LEARN").length;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Analysis Specs</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Define what to analyze in calls: MEASURE behaviors or LEARN facts</p>
        </div>
        <button
          onClick={() => setShowCompileModal(true)}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          <span>📦</span>
          Compile All Active ({activeSpecCount})
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-4">
        {/* Domain + Type Filter (Column 1) */}
        <div className="w-52 flex-shrink-0">
          <div className="mb-4">
            <h2 className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">Output Type</h2>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedOutputType(null)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  selectedOutputType === null
                    ? "bg-neutral-200 dark:bg-neutral-700 font-medium text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                All Types
              </button>
              <button
                onClick={() => setSelectedOutputType("MEASURE")}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  selectedOutputType === "MEASURE"
                    ? "bg-indigo-100 dark:bg-indigo-900 font-medium text-indigo-700 dark:text-indigo-300"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="mr-2">📊</span> Measure
              </button>
              <button
                onClick={() => setSelectedOutputType("LEARN")}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  selectedOutputType === "LEARN"
                    ? "bg-amber-100 dark:bg-amber-900 font-medium text-amber-700 dark:text-amber-300"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="mr-2">💾</span> Learn
              </button>
            </div>
          </div>

          <div className="mb-3">
            <h2 className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">Domains</h2>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedDomain(null)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                selectedDomain === null
                  ? "bg-neutral-200 dark:bg-neutral-700 font-medium text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              All Domains
              <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">({specs.length})</span>
            </button>
            {Array.from(domains.entries()).map(([domain, domainSpecs]) => {
              const colors = getDomainColor(domain);
              return (
                <button
                  key={domain}
                  onClick={() => setSelectedDomain(domain)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    selectedDomain === domain
                      ? `${colors.bg} font-medium ${colors.text}`
                      : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${colors.bg} ${colors.border} border`} />
                    <span className="capitalize">{domain}</span>
                  </div>
                  <span className="ml-4 text-xs text-neutral-500 dark:text-neutral-400">({domainSpecs.length})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Spec List (Column 2) */}
        <div className="w-80 flex-shrink-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Specs
              {(selectedDomain || selectedOutputType) && (
                <span className="ml-2 font-normal text-neutral-600 dark:text-neutral-400">
                  ({filteredSpecs.length})
                </span>
              )}
            </h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              + New
            </button>
          </div>

          <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
            {filteredSpecs.length === 0 ? (
              <div className="text-sm text-neutral-600 dark:text-neutral-400">No specs found.</div>
            ) : (
              filteredSpecs.map((s) => {
                const colors = getDomainColor(s.domain);
                const outputBadge = getOutputTypeBadge(s.outputType);
                // Compilation status: green = compiled & clean, amber = dirty, red = not compiled
                const isCompiled = s.compiledAt && !s.isDirty;
                const isDirty = s.compiledAt && s.isDirty;
                const compilationTitle = isCompiled
                  ? `Compiled ${new Date(s.compiledAt!).toLocaleDateString()}`
                  : isDirty
                  ? `Needs recompile: ${s.dirtyReason || "modified"}`
                  : "Not compiled";
                // Background colors based on compilation status
                const compilationBg = isCompiled
                  ? "bg-green-50 border-green-200 hover:border-green-300"
                  : isDirty
                  ? "bg-amber-50 border-amber-200 hover:border-amber-300"
                  : "bg-red-50 border-red-200 hover:border-red-300";
                return (
                  <div
                    key={s.id}
                    onClick={() => fetchSpecDetail(s.id)}
                    className={`cursor-pointer rounded-md border p-3 transition-colors ${
                      selectedSpec?.id === s.id
                        ? "border-indigo-500 bg-indigo-100 dark:bg-indigo-900/50"
                        : compilationBg
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              isCompiled ? "bg-green-500" : isDirty ? "bg-amber-500" : "bg-red-500"
                            }`}
                            title={compilationTitle}
                          />
                          <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{s.name}</span>
                          {s.isLocked && <span title={s.lockedReason || "Locked"}>🔒</span>}
                        </div>
                        <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate ml-5">{s.slug}</div>
                      </div>
                      <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs ${outputBadge.bg} ${outputBadge.text}`}>
                        {outputBadge.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 ml-5">
                      <span>{s.actionCount || 0} param{(s.actionCount || 0) !== 1 ? "s" : ""}</span>
                      {s.domain && (
                        <span className={`rounded px-1 py-0.5 ${colors.bg} ${colors.text}`}>
                          {s.domain}
                        </span>
                      )}
                      {s.isActive ? (
                        <span className="text-green-600 dark:text-green-400" title="Active">●</span>
                      ) : (
                        <span className="text-neutral-400 dark:text-neutral-500" title="Inactive">○</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Spec Detail (Column 3) */}
        <div className="flex-1 min-w-0 max-h-[calc(100vh-200px)] overflow-y-auto">
          {selectedSpec ? (() => {
            // Compute compilation status for background
            const isSpecCompiled = selectedSpec.compiledAt && !selectedSpec.isDirty;
            const isSpecDirty = selectedSpec.compiledAt && selectedSpec.isDirty;
            const detailBg = isSpecCompiled
              ? "bg-green-50/50 dark:bg-green-900/20"
              : isSpecDirty
              ? "bg-amber-50/50 dark:bg-amber-900/20"
              : "bg-red-50/50 dark:bg-red-900/20";
            return (
            <div className={`rounded-lg p-4 ${detailBg}`}>
              {/* Detail Header */}
              <div className="mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{selectedSpec.name}</h2>
                      <span className={`rounded px-2 py-0.5 text-xs ${getOutputTypeBadge(selectedSpec.outputType).bg} ${getOutputTypeBadge(selectedSpec.outputType).text}`}>
                        {selectedSpec.outputType}
                      </span>
                      {selectedSpec.isLocked && (
                        <span className="rounded bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300" title={selectedSpec.lockedReason || ""}>
                          🔒 Locked ({selectedSpec.usageCount} callers)
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{selectedSpec.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Active Toggle */}
                    <button
                      onClick={() => handleToggleActive(selectedSpec.id, !selectedSpec.isActive)}
                      className={`rounded px-3 py-1.5 text-xs font-medium ${
                        selectedSpec.isActive
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      }`}
                      title={selectedSpec.isActive ? "Click to deactivate" : "Click to activate"}
                    >
                      {selectedSpec.isActive ? "● Active" : "○ Inactive"}
                    </button>
                    {/* Compile Button - disabled if already compiled and not dirty */}
                    <button
                      onClick={() => handleCompileSpec(selectedSpec.id)}
                      disabled={
                        compilingSpec === selectedSpec.id ||
                        !!selectedSpec.isLocked ||
                        !!(selectedSpec.compiledAt && !selectedSpec.isDirty)
                      }
                      className={`rounded px-3 py-1.5 text-xs font-medium ${
                        selectedSpec.compiledAt && !selectedSpec.isDirty
                          ? "bg-green-100 text-green-600 cursor-default"
                          : selectedSpec.isDirty
                          ? "bg-amber-500 text-white hover:bg-amber-600"
                          : "bg-blue-500 text-white hover:bg-blue-600"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={
                        selectedSpec.isLocked
                          ? "Cannot compile locked spec"
                          : selectedSpec.compiledAt && !selectedSpec.isDirty
                          ? "Already compiled"
                          : selectedSpec.isDirty
                          ? "Click to recompile (spec modified)"
                          : "Click to compile"
                      }
                    >
                      {compilingSpec === selectedSpec.id
                        ? "..."
                        : selectedSpec.compiledAt && !selectedSpec.isDirty
                        ? "✓ Compiled"
                        : "⚙️ Compile"}
                    </button>
                    {/* Enrich Button - pulls knowledge from artifacts */}
                    <button
                      onClick={() => handleEnrichSpec(selectedSpec.id)}
                      disabled={enrichingSpec === selectedSpec.id || selectedSpec.isLocked}
                      className="rounded px-3 py-1.5 text-xs font-medium bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Enrich action terms with knowledge from artifacts"
                    >
                      {enrichingSpec === selectedSpec.id ? "..." : "🧠 Enrich"}
                    </button>
                    {/* Add Trigger */}
                    <button
                      onClick={() => checkEditWarning(selectedSpec.id, () => setShowAddTriggerModal(true))}
                      disabled={selectedSpec.isLocked}
                      className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add Trigger
                    </button>
                  </div>
                </div>
                {/* Compilation Status Bar */}
                {selectedSpec.compiledAt && (
                  <div className={`mt-2 rounded px-3 py-1.5 text-xs ${
                    selectedSpec.isDirty
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-green-50 text-green-700 border border-green-200"
                  }`}>
                    {selectedSpec.isDirty ? (
                      <>⚠️ Needs recompile: {selectedSpec.dirtyReason || "spec modified"}</>
                    ) : (
                      <>✓ Compiled {new Date(selectedSpec.compiledAt).toLocaleString()}</>
                    )}
                  </div>
                )}
                {compileResult && compileResult.specId === selectedSpec.id && (
                  <div className={`mt-2 rounded p-3 text-xs ${
                    compileResult.ok
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : compileResult.warning
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}>
                    <div className="font-semibold mb-1">
                      {compileResult.ok ? "✓ Compilation successful" : compileResult.warning ? "⚠️ Recompiling..." : "✗ Compilation failed"}
                    </div>
                    {compileResult.message && <div>{compileResult.message}</div>}
                    {compileResult.errors?.map((e: any, i: number) => (
                      <div key={i} className="mt-1">• {e.name}: {e.error}</div>
                    ))}
                    {compileResult.warnings?.map((w: any, i: number) => (
                      <div key={i} className="mt-1 text-amber-600">• {w.name}: {w.error}</div>
                    ))}
                  </div>
                )}
                {enrichResult && enrichResult.specId === selectedSpec.id && (
                  <div className={`mt-2 rounded p-3 text-xs ${
                    enrichResult.ok
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}>
                    <div className="font-semibold mb-1">
                      {enrichResult.ok ? "🧠 Enrichment complete" : "✗ Enrichment failed"}
                    </div>
                    {enrichResult.message && <div>{enrichResult.message}</div>}
                    {enrichResult.enriched && (
                      <div className="mt-1">Enriched {enrichResult.enriched} action term(s)</div>
                    )}
                    {enrichResult.error && <div className="mt-1">{enrichResult.error}</div>}
                  </div>
                )}
              </div>

              {/* Prompt Template Section */}
              <PromptTemplateSection
                spec={selectedSpec}
                onUpdate={(newTemplate) => {
                  setSelectedSpec({ ...selectedSpec, promptTemplate: newTemplate });
                  fetchSpecs();
                }}
              />

              {/* Triggers */}
              {selectedSpec.triggers && selectedSpec.triggers.length > 0 && (
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">Triggers ({selectedSpec.triggers.length})</span>
                  <div className="flex gap-1 ml-auto">
                    <button
                      onClick={() => {
                        const allTriggerIds = new Set(selectedSpec.triggers!.map(t => t.id));
                        const allActionIds = new Set(selectedSpec.triggers!.flatMap(t => t.actions.map(a => a.id)));
                        setExpandedTriggers(allTriggerIds);
                        setExpandedActions(allActionIds);
                      }}
                      className="rounded px-2 py-1 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      Expand All
                    </button>
                    <button
                      onClick={() => {
                        setExpandedTriggers(new Set());
                        setExpandedActions(new Set());
                      }}
                      className="rounded px-2 py-1 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-4">
                {selectedSpec.triggers?.map((trigger, tIdx) => (
                  <div key={trigger.id} className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                    <div
                      onClick={() => toggleTrigger(trigger.id)}
                      className="flex cursor-pointer items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700"
                    >
                      <div>
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">
                          Trigger {tIdx + 1}: {trigger.name || "Unnamed"}
                        </div>
                        <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                          {trigger.actions.length} action{trigger.actions.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {expandedTriggers.has(trigger.id) ? "▾" : "▸"}
                      </span>
                    </div>

                    {expandedTriggers.has(trigger.id) && (
                      <div className="border-t border-neutral-100 dark:border-neutral-700 p-4">
                        {/* Given/When/Then */}
                        <div className="mb-4 space-y-1 rounded bg-neutral-50 dark:bg-neutral-900 p-3 font-mono text-sm">
                          <div>
                            <span className="font-semibold text-purple-600 dark:text-purple-400">Given</span>{" "}
                            <span className="text-neutral-800 dark:text-neutral-200">{trigger.given}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">When</span>{" "}
                            <span className="text-neutral-800 dark:text-neutral-200">{trigger.when}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-green-600 dark:text-green-400">Then</span>{" "}
                            <span className="text-neutral-800 dark:text-neutral-200">{trigger.then}</span>
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
            <div className="flex h-64 items-center justify-center text-neutral-600 dark:text-neutral-400">
              Select a spec to view details
            </div>
          )}
        </div>
      </div>

      {/* Create Spec Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white dark:bg-neutral-800 p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Create Analysis Spec</h3>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white dark:bg-neutral-800 p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Add Trigger to "{selectedSpec.name}"</h3>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white dark:bg-neutral-800 p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Compile Analysis Specs</h3>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-neutral-800 p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-amber-600 dark:text-amber-400">⚠️ Editing Compiled Spec</h3>
            <p className="mb-4 text-sm text-neutral-700 dark:text-neutral-300">
              This spec has been compiled and is ready for use. Making changes will mark it as "dirty" and require recompilation before it can be used in analysis runs.
            </p>
            <p className="mb-4 text-sm text-neutral-700 dark:text-neutral-300">
              Are you sure you want to continue editing?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowEditWarningModal(false); setPendingEdit(null); }}
                className="rounded border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmEdit}
                className="rounded bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600"
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

  const exampleTemplates = {
    MEASURE: `The caller scores {{value}} on {{param.name}} ({{label}}).
{{#if high}}Engage warmly and conversationally. Match their energy and be expressive.{{/if}}
{{#if medium}}Use a balanced, professional tone. Be friendly but focused.{{/if}}
{{#if low}}Be direct and efficient. Avoid excessive small talk.{{/if}}`,
    LEARN: `{{#if hasMemories}}Use these memories about the caller in your conversation:
{{#each memories.facts}}- {{this.key}}: {{this.value}}
{{/each}}{{/if}}`,
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

// Compile Specs Form
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
              {compiling ? "Compiling..." : "Force Compile (ignore warnings)"}
            </button>
          )}
          <Link
            href="/compiled-sets"
            className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            View Compiled Sets
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
        <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">Will compile:</div>
        <div className="flex gap-4 text-sm">
          <span className="rounded bg-indigo-100 dark:bg-indigo-900 px-2 py-1 text-indigo-700 dark:text-indigo-300">{measureCount} MEASURE specs</span>
          <span className="rounded bg-amber-100 dark:bg-amber-900 px-2 py-1 text-amber-700 dark:text-amber-300">{learnCount} LEARN specs</span>
        </div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
          {activeSpecs.length} total active specs will be validated and compiled
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
          The profile will be locked once the compiled set is used in analysis runs
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
          {saving ? "Creating..." : compiling ? "Compiling..." : "Compile"}
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
  outputType: "MEASURE" | "LEARN";
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
