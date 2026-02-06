"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { VerticalSlider } from "@/components/shared/VerticalSlider";

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

type CallerSummary = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  externalId: string | null;
  domain: Domain | null;
  _count?: { calls: number; memories: number };
};

type Call = {
  id: string;
  transcript: string;
  createdAt: string;
  callSequence?: number;
  source?: string;
  hasScores?: boolean;
  hasMemories?: boolean;
};

type CallerDetail = CallerSummary & {
  calls: Call[];
};

type GeneratedPrompt = {
  id: string;
  prompt: string;
  llmPrompt: Record<string, any>;
  inputs?: {
    sectionsActivated?: string[];
    sectionsSkipped?: string[];
  };
};

type ParsedMessage = {
  role: "ai" | "user";
  content: string;
};

type SectionDiff = {
  key: string;
  status: "added" | "removed" | "changed" | "unchanged";
  previous?: unknown;
  current?: unknown;
};

type BehaviorParameter = {
  parameterId: string;
  name: string;
  definition: string | null;
  domainGroup: string | null;
  systemValue: number | null;
  playbookValue: number | null;
  effectiveValue: number;
  effectiveScope: string;
};

// =============================================================================
// CONSTANTS
// =============================================================================

const SPEC_TYPE_INFO: Record<string, { label: string; description: string; icon: string }> = {
  LEARN: { label: "Learn", description: "Extracts caller data", icon: "🧠" },
  MEASURE: { label: "Measure", description: "Scores behaviour", icon: "📊" },
  ADAPT: { label: "Adapt", description: "Computes targets", icon: "🔄" },
  COMPOSE: { label: "Compose", description: "Builds prompt", icon: "✍️" },
  IDENTITY: { label: "Identity", description: "WHO the agent is", icon: "🎭" },
  CONTENT: { label: "Content", description: "WHAT it knows", icon: "📖" },
  CONTEXT: { label: "Context", description: "Caller context", icon: "👤" },
  VOICE: { label: "Voice", description: "HOW it speaks", icon: "🗣️" },
  META: { label: "Meta", description: "Legacy", icon: "⚙️" },
};

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  IDENTITY: { bg: "#dbeafe", text: "#1e40af" },
  CONTENT: { bg: "#f0fdf4", text: "#166534" },
  CONTEXT: { bg: "#fef3c7", text: "#92400e" },
  VOICE: { bg: "#fce7f3", text: "#be185d" },
  META: { bg: "#f3f4f6", text: "#4b5563" },
  LEARN: { bg: "#ede9fe", text: "#5b21b6" },
  MEASURE: { bg: "#dcfce7", text: "#166534" },
  ADAPT: { bg: "#fef3c7", text: "#92400e" },
  COMPOSE: { bg: "#fce7f3", text: "#be185d" },
};

// =============================================================================
// UTILITIES
// =============================================================================

function getSpecBadgeType(spec: { specRole: string | null; outputType: string }): string {
  const role = spec.specRole;
  if (role === "IDENTITY" || role === "CONTENT" || role === "VOICE" || role === "CONTEXT") {
    return role;
  }
  return spec.outputType;
}

function parseTranscript(text: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  let current: ParsedMessage | null = null;

  for (const line of text.split("\n")) {
    if (line.match(/^(AI|Agent):/i)) {
      if (current) messages.push(current);
      current = { role: "ai", content: line.replace(/^(AI|Agent):\s*/i, "") };
    } else if (line.match(/^(User|Caller):/i)) {
      if (current) messages.push(current);
      current = { role: "user", content: line.replace(/^(User|Caller):\s*/i, "") };
    } else if (current && line.trim()) {
      current.content += "\n" + line;
    }
  }
  if (current) messages.push(current);
  return messages;
}

function computeDiff(prev: Record<string, unknown> | null, curr: Record<string, unknown>): SectionDiff[] {
  const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(curr)]);
  return Array.from(allKeys)
    .filter((key) => !key.startsWith("_")) // Skip internal keys for cleaner diff
    .map((key) => {
      const prevVal = prev?.[key];
      const currVal = curr[key];
      const prevStr = JSON.stringify(prevVal);
      const currStr = JSON.stringify(currVal);

      return {
        key,
        status: !prevVal
          ? "added"
          : !currVal
            ? "removed"
            : prevStr !== currStr
              ? "changed"
              : "unchanged",
        previous: prevVal,
        current: currVal,
      } as SectionDiff;
    });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ` ${time}`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PlaygroundPage() {
  // Selection state
  const [selectedCallerId, setSelectedCallerId] = useState("");
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [selectedPlaybookId, setSelectedPlaybookId] = useState("");

  // Data state
  const [caller, setCaller] = useState<CallerDetail | null>(null);
  const [callers, setCallers] = useState<CallerSummary[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [availableSpecs, setAvailableSpecs] = useState<{
    systemSpecs: SpecSummary[];
    domainSpecs: SpecSummary[];
  }>({ systemSpecs: [], domainSpecs: [] });

  // Prompt state
  const [generatedPrompt, setGeneratedPrompt] = useState<GeneratedPrompt | null>(null);
  const [previousPrompt, setPreviousPrompt] = useState<GeneratedPrompt | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Local spec toggles (not persisted)
  const [specToggles, setSpecToggles] = useState<Record<string, boolean>>({});

  // Tuning panel state
  const [isTuningPanelOpen, setIsTuningPanelOpen] = useState(false);
  const [behaviorParams, setBehaviorParams] = useState<BehaviorParameter[]>([]);
  const [previewOverrides, setPreviewOverrides] = useState<Record<string, number>>({});
  const [loadingTargets, setLoadingTargets] = useState(false);

  // Draft spec injection
  const [draftSpecJson, setDraftSpecJson] = useState("");
  const [draftSpecError, setDraftSpecError] = useState<string | null>(null);
  const [draftSpecEnabled, setDraftSpecEnabled] = useState(false);
  const [showDraftInput, setShowDraftInput] = useState(false);

  // Transcript drawer
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(300);
  const [selectedCallId, setSelectedCallId] = useState("");

  // UI state
  const [showDiff, setShowDiff] = useState(true);
  const [outputMode, setOutputMode] = useState<"sections" | "raw">("sections");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callerSearch, setCallerSearch] = useState("");
  const [showCallerDropdown, setShowCallerDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  // Create Caller modal state
  const [showCreateCallerModal, setShowCreateCallerModal] = useState(false);
  const [newCallerName, setNewCallerName] = useState("");
  const [newCallerEmail, setNewCallerEmail] = useState("");
  const [newCallerDomainId, setNewCallerDomainId] = useState("");
  const [creatingCaller, setCreatingCaller] = useState(false);

  // Spec upload state
  const [uploadingSpec, setUploadingSpec] = useState(false);
  const [specUploadResult, setSpecUploadResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Create Domain modal state
  const [showCreateDomainModal, setShowCreateDomainModal] = useState(false);
  const [newDomainName, setNewDomainName] = useState("");
  const [newDomainSlug, setNewDomainSlug] = useState("");
  const [creatingDomain, setCreatingDomain] = useState(false);

  // Create Playbook modal state
  const [showCreatePlaybookModal, setShowCreatePlaybookModal] = useState(false);
  const [newPlaybookName, setNewPlaybookName] = useState("");
  const [newPlaybookDomainId, setNewPlaybookDomainId] = useState("");
  const [creatingPlaybook, setCreatingPlaybook] = useState(false);

  // Refs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callerSearchRef = useRef<HTMLDivElement>(null);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  useEffect(() => {
    Promise.all([
      fetch("/api/callers?withCounts=true").then((r) => r.json()),
      fetch("/api/domains").then((r) => r.json()),
      fetch("/api/playbooks").then((r) => r.json()),
      fetch("/api/playbooks/available-items").then((r) => r.json()),
    ])
      .then(([callersRes, domainsRes, playbooksRes, specsRes]) => {
        if (callersRes.ok) setCallers(callersRes.callers || []);
        if (domainsRes.ok) setDomains(domainsRes.domains || []);
        if (playbooksRes.ok) setPlaybooks(playbooksRes.playbooks || []);
        if (specsRes.ok) {
          setAvailableSpecs({
            systemSpecs: specsRes.systemSpecs || [],
            domainSpecs: specsRes.domainSpecs || [],
          });
          // Initialize toggles from specs (all enabled by default)
          const toggles: Record<string, boolean> = {};
          [...(specsRes.systemSpecs || []), ...(specsRes.domainSpecs || [])].forEach((spec: SpecSummary) => {
            toggles[spec.id] = true;
          });
          setSpecToggles(toggles);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (callerSearchRef.current && !callerSearchRef.current.contains(e.target as Node)) {
        setShowCallerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch behavior targets when playbook changes
  useEffect(() => {
    if (!selectedPlaybookId) {
      setBehaviorParams([]);
      setPreviewOverrides({});
      return;
    }

    setLoadingTargets(true);
    fetch(`/api/playbooks/${selectedPlaybookId}/targets`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setBehaviorParams(data.parameters || []);
          setPreviewOverrides({}); // Reset overrides when playbook changes
        }
        setLoadingTargets(false);
      })
      .catch(() => {
        setLoadingTargets(false);
      });
  }, [selectedPlaybookId]);

  // =============================================================================
  // CALLER SELECTION
  // =============================================================================

  const filteredCallers = useMemo(() => {
    if (!callerSearch) return callers.slice(0, 20);
    const s = callerSearch.toLowerCase();
    return callers
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(s) ||
          c.email?.toLowerCase().includes(s) ||
          c.phone?.toLowerCase().includes(s) ||
          c.externalId?.toLowerCase().includes(s)
      )
      .slice(0, 20);
  }, [callers, callerSearch]);

  const handleCallerSelect = useCallback(
    async (callerId: string) => {
      setSelectedCallerId(callerId);
      setShowCallerDropdown(false);
      setCallerSearch("");
      setGeneratedPrompt(null);
      setPreviousPrompt(null);

      try {
        const res = await fetch(`/api/callers/${callerId}`);
        const data = await res.json();
        if (data.ok) {
          setCaller({ ...data.caller, calls: data.calls || [] });

          // Auto-select domain/playbook
          if (data.caller.domain?.id) {
            setSelectedDomainId(data.caller.domain.id);
            const published = playbooks.find(
              (pb) => pb.domainId === data.caller.domain.id && pb.status === "PUBLISHED"
            );
            if (published) {
              setSelectedPlaybookId(published.id);
            }
          }

          // Auto-select most recent call
          if (data.calls?.length > 0) {
            setSelectedCallId(data.calls[0].id);
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load caller");
      }
    },
    [playbooks]
  );

  const handleAttachDomain = useCallback(async (domainId: string) => {
    if (!selectedCallerId) return;
    try {
      const res = await fetch(`/api/callers/${selectedCallerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const data = await res.json();
      if (data.ok) {
        setCaller((prev) => (prev ? { ...prev, domain: domains.find((d) => d.id === domainId) || null } : null));
        setSelectedDomainId(domainId);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to attach domain");
    }
  }, [selectedCallerId, domains]);

  // =============================================================================
  // DRAFT SPEC PARSING (must be before generatePrompt which depends on it)
  // =============================================================================

  const parsedDraftSpec = useMemo(() => {
    if (!draftSpecEnabled || !draftSpecJson) return null;
    try {
      return JSON.parse(draftSpecJson);
    } catch {
      return null;
    }
  }, [draftSpecEnabled, draftSpecJson]);

  // =============================================================================
  // PROMPT GENERATION
  // =============================================================================

  const generatePrompt = useCallback(async () => {
    if (!selectedCallerId) return;

    // Store previous for diff
    if (generatedPrompt) {
      setPreviousPrompt(generatedPrompt);
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Build request body - include draft spec if enabled, and target overrides
      const requestBody: Record<string, unknown> = {};
      if (parsedDraftSpec) {
        requestBody.draftSpec = parsedDraftSpec;
      }
      // Include target overrides for preview (not persisted)
      if (Object.keys(previewOverrides).length > 0) {
        requestBody.targetOverrides = previewOverrides;
      }

      const res = await fetch(`/api/callers/${selectedCallerId}/compose-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json();
      if (data.ok) {
        setGeneratedPrompt(data.prompt);
      } else {
        setError(data.error || "Failed to generate prompt");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate prompt");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedCallerId, generatedPrompt, parsedDraftSpec, previewOverrides]);

  const triggerDebouncedRegenerate = useCallback(() => {
    if (!selectedCallerId || !generatedPrompt) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      generatePrompt();
    }, 400);
  }, [selectedCallerId, generatedPrompt, generatePrompt]);

  // =============================================================================
  // DRAFT SPEC HANDLING
  // =============================================================================

  const handleDraftSpecChange = useCallback((json: string) => {
    setDraftSpecJson(json);
    setDraftSpecError(null);

    if (!json.trim()) {
      setDraftSpecEnabled(false);
      return;
    }

    try {
      const parsed = JSON.parse(json);
      if (!parsed.id || !parsed.title) {
        setDraftSpecError("Spec must have 'id' and 'title' fields");
        setDraftSpecEnabled(false);
      } else {
        setDraftSpecEnabled(true);
      }
    } catch (e) {
      setDraftSpecError("Invalid JSON");
      setDraftSpecEnabled(false);
    }
  }, []);

  // =============================================================================
  // SPEC TOGGLES
  // =============================================================================

  const handleToggleSpec = useCallback(
    (specId: string) => {
      setSpecToggles((prev) => ({
        ...prev,
        [specId]: !prev[specId],
      }));
      triggerDebouncedRegenerate();
    },
    [triggerDebouncedRegenerate]
  );

  // =============================================================================
  // TRANSCRIPT DRAWER
  // =============================================================================

  const selectedCall = caller?.calls.find((c) => c.id === selectedCallId);
  const parsedMessages = selectedCall ? parseTranscript(selectedCall.transcript) : [];

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ y: 0, height: 0 });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { y: e.clientY, height: drawerHeight };
    e.preventDefault();
  }, [drawerHeight]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartRef.current.y - e.clientY;
      const newHeight = Math.max(150, Math.min(500, dragStartRef.current.height + delta));
      setDrawerHeight(newHeight);
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // =============================================================================
  // COPY TO CLIPBOARD
  // =============================================================================

  const handleCopy = useCallback(() => {
    if (!generatedPrompt) return;
    const text = outputMode === "raw"
      ? JSON.stringify(generatedPrompt.llmPrompt, null, 2)
      : generatedPrompt.prompt;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedPrompt, outputMode]);

  // =============================================================================
  // DIFF COMPUTATION
  // =============================================================================

  const diff = useMemo(() => {
    if (!previousPrompt || !generatedPrompt) return [];
    return computeDiff(
      previousPrompt.llmPrompt as Record<string, unknown>,
      generatedPrompt.llmPrompt as Record<string, unknown>
    ).filter((d) => d.status !== "unchanged");
  }, [previousPrompt, generatedPrompt]);

  // =============================================================================
  // FILTERED PLAYBOOKS
  // =============================================================================

  const filteredPlaybooks = selectedDomainId
    ? playbooks.filter((pb) => pb.domainId === selectedDomainId)
    : playbooks;

  // =============================================================================
  // RENDER
  // =============================================================================

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#6b7280" }}>
        Loading Playground...
      </div>
    );
  }

  const drawerCollapsedHeight = 48;
  const actualDrawerHeight = isDrawerExpanded ? drawerHeight : drawerCollapsedHeight;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f9fafb" }}>
      {/* ===== HEADER ===== */}
      <div
        style={{
          padding: "12px 20px",
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", margin: 0, marginRight: 8 }}>
          Playground
        </h1>

        {/* Caller Search */}
        <div ref={callerSearchRef} style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <input
            type="text"
            placeholder="Search callers..."
            value={callerSearch || (caller ? caller.name || caller.email || caller.id.slice(0, 8) : "")}
            onChange={(e) => {
              setCallerSearch(e.target.value);
              setShowCallerDropdown(true);
            }}
            onFocus={() => setShowCallerDropdown(true)}
            style={{
              width: "100%",
              padding: "8px 12px",
              paddingLeft: 32,
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 13,
              background: "#fff",
            }}
          />
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>
            🔍
          </span>

          {showCallerDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: 4,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                maxHeight: 320,
                overflow: "auto",
                zIndex: 100,
              }}
            >
              {filteredCallers.length === 0 ? (
                <div style={{ padding: 12, color: "#9ca3af", fontSize: 13 }}>No callers found</div>
              ) : (
                filteredCallers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleCallerSelect(c.id)}
                    style={{
                      padding: "10px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f3f4f6",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: "#1f2937" }}>
                        {c.name || c.email || c.phone || c.id.slice(0, 8)}
                      </div>
                      {c.email && c.name && (
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{c.email}</div>
                      )}
                    </div>
                    {c._count?.calls != null && (
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{c._count.calls} calls</span>
                    )}
                    {c.domain && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          background: "#dbeafe",
                          color: "#1e40af",
                          borderRadius: 4,
                        }}
                      >
                        {c.domain.name}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Create Caller Button */}
        <button
          onClick={() => setShowCreateCallerModal(true)}
          title="Create new caller"
          style={{
            padding: "8px 12px",
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ➕
        </button>

        {/* Domain Selector */}
        <select
          value={selectedDomainId}
          onChange={(e) => {
            if (e.target.value === "__create__") {
              setShowCreateDomainModal(true);
              e.target.value = selectedDomainId; // Reset to previous
            } else {
              setSelectedDomainId(e.target.value);
              setSelectedPlaybookId("");
            }
          }}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
          <option value="__create__" style={{ fontStyle: "italic" }}>+ Create new domain...</option>
        </select>

        {/* Playbook Selector */}
        <select
          value={selectedPlaybookId}
          onChange={(e) => {
            if (e.target.value === "__create__") {
              setNewPlaybookDomainId(selectedDomainId);
              setShowCreatePlaybookModal(true);
              e.target.value = selectedPlaybookId; // Reset to previous
            } else {
              setSelectedPlaybookId(e.target.value);
            }
          }}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}
        >
          <option value="">Select playbook...</option>
          {filteredPlaybooks.map((pb) => (
            <option key={pb.id} value={pb.id}>
              {pb.name} ({pb.status})
            </option>
          ))}
          <option value="__create__" style={{ fontStyle: "italic" }}>+ Create new playbook...</option>
        </select>

        {/* Generate Button */}
        <button
          onClick={generatePrompt}
          disabled={!selectedCallerId || isGenerating}
          style={{
            padding: "8px 20px",
            background: selectedCallerId ? "#4f46e5" : "#e5e7eb",
            color: selectedCallerId ? "#fff" : "#9ca3af",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            cursor: selectedCallerId ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {isGenerating ? "Generating..." : "Generate"}
        </button>
      </div>

      {/* ===== ERROR ===== */}
      {error && (
        <div
          style={{
            margin: "0 20px",
            marginTop: 12,
            padding: 12,
            background: "#fef2f2",
            color: "#dc2626",
            borderRadius: 8,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ===== NO DOMAIN WARNING ===== */}
      {caller && !caller.domain && (
        <div
          style={{
            margin: "0 20px",
            marginTop: 12,
            padding: "10px 16px",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ color: "#92400e" }}>
            ⚠️ This caller has no domain assigned. Attach one to use playbook specs.
          </span>
          <select
            onChange={(e) => e.target.value && handleAttachDomain(e.target.value)}
            defaultValue=""
            style={{
              padding: "4px 8px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            <option value="">Attach to domain...</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: 16,
          padding: 20,
          paddingBottom: actualDrawerHeight + 20,
          overflow: "hidden",
        }}
      >
        {/* ===== LEFT PANEL: SPECS ===== */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "auto" }}>
          {/* Tuning Panel - Behavior Target Sliders */}
          {selectedPlaybookId && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, overflow: "hidden" }}>
              <div
                onClick={() => setIsTuningPanelOpen(!isTuningPanelOpen)}
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  background: isTuningPanelOpen ? "#fef3c7" : "transparent",
                }}
              >
                <span style={{ fontSize: 13 }}>🎚️</span>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#92400e", flex: 1 }}>
                  Tuning
                </span>
                {Object.keys(previewOverrides).length > 0 && (
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#f59e0b",
                  }} title="Modified values" />
                )}
                <span style={{ fontSize: 10, color: "#b45309" }}>
                  {behaviorParams.length} params
                </span>
                <span style={{ fontSize: 10, color: "#92400e" }}>
                  {isTuningPanelOpen ? "▼" : "▶"}
                </span>
              </div>
              {isTuningPanelOpen && (
                <div style={{ padding: 14, paddingTop: 0 }}>
                  {loadingTargets ? (
                    <div style={{ fontSize: 11, color: "#92400e", textAlign: "center", padding: 12 }}>
                      Loading targets...
                    </div>
                  ) : behaviorParams.length === 0 ? (
                    <div style={{ fontSize: 11, color: "#92400e", textAlign: "center", padding: 12 }}>
                      No behavior parameters
                    </div>
                  ) : (
                    <>
                      {Object.keys(previewOverrides).length > 0 && (
                        <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => setPreviewOverrides({})}
                            style={{
                              fontSize: 10,
                              padding: "4px 8px",
                              background: "#fff",
                              border: "1px solid #fbbf24",
                              borderRadius: 4,
                              cursor: "pointer",
                              color: "#92400e",
                            }}
                          >
                            Reset ({Object.keys(previewOverrides).length})
                          </button>
                        </div>
                      )}
                      {/* Group by domainGroup */}
                      {Object.entries(
                        behaviorParams.reduce((groups, param) => {
                          const group = param.domainGroup || "General";
                          if (!groups[group]) groups[group] = [];
                          groups[group].push(param);
                          return groups;
                        }, {} as Record<string, BehaviorParameter[]>)
                      ).map(([groupName, params]) => (
                        <div key={groupName} style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#92400e", marginBottom: 8, textTransform: "uppercase" }}>
                            {groupName}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {params.map((param) => {
                              const currentValue = previewOverrides[param.parameterId] ?? param.effectiveValue;
                              const isModified = param.parameterId in previewOverrides;
                              return (
                                <div key={param.parameterId} style={{ textAlign: "center" }}>
                                  <VerticalSlider
                                    value={currentValue}
                                    editable={true}
                                    onChange={(val) => {
                                      setPreviewOverrides((prev) => ({
                                        ...prev,
                                        [param.parameterId]: val,
                                      }));
                                    }}
                                    isModified={isModified}
                                    color={{ primary: "#f59e0b", glow: "#d97706" }}
                                    width={44}
                                    height={100}
                                    showGauge={true}
                                    showSparkline={false}
                                    tooltip={param.definition || param.name}
                                  />
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: isModified ? "#d97706" : "#78716c",
                                      maxWidth: 44,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      marginTop: 4,
                                    }}
                                    title={param.name}
                                  >
                                    {param.name.split(" ")[0]}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* System Specs */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13 }}>🔒</span>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#64748b" }}>
                System Specs
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {availableSpecs.systemSpecs.map((spec) => {
                const badgeType = getSpecBadgeType(spec);
                const info = SPEC_TYPE_INFO[badgeType];
                const colors = BADGE_COLORS[badgeType];
                return (
                  <div
                    key={spec.id}
                    style={{
                      padding: "6px 8px",
                      background: "#fff",
                      borderRadius: 6,
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      opacity: 0.85,
                    }}
                    title={spec.description || info?.description}
                  >
                    <span style={{ fontSize: 11 }}>{info?.icon || "📋"}</span>
                    <span style={{ flex: 1, color: "#374151" }}>{spec.name}</span>
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 5px",
                        background: colors?.bg || "#f3f4f6",
                        color: colors?.text || "#6b7280",
                        borderRadius: 3,
                      }}
                    >
                      {info?.label || badgeType}
                    </span>
                  </div>
                );
              })}
              {availableSpecs.systemSpecs.length === 0 && (
                <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>No system specs</div>
              )}
            </div>
          </div>

          {/* Playbook Specs */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13 }}>✏️</span>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#6b7280" }}>
                Playbook Specs
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {availableSpecs.domainSpecs.map((spec) => {
                const enabled = specToggles[spec.id] ?? true;
                const badgeType = getSpecBadgeType(spec);
                const info = SPEC_TYPE_INFO[badgeType];
                const colors = BADGE_COLORS[badgeType];
                return (
                  <div
                    key={spec.id}
                    onClick={() => handleToggleSpec(spec.id)}
                    style={{
                      padding: "6px 8px",
                      background: enabled ? "#f0fdf4" : "#f9fafb",
                      border: enabled ? "1px solid #86efac" : "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    title={spec.description || info?.description}
                  >
                    <span style={{ fontSize: 13 }}>{enabled ? "◉" : "○"}</span>
                    <span style={{ flex: 1, color: enabled ? "#374151" : "#9ca3af" }}>{spec.name}</span>
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 5px",
                        background: colors?.bg || "#f3f4f6",
                        color: colors?.text || "#6b7280",
                        borderRadius: 3,
                      }}
                    >
                      {info?.label || badgeType}
                    </span>
                  </div>
                );
              })}
              {availableSpecs.domainSpecs.length === 0 && (
                <div style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic", padding: 8, textAlign: "center" }}>
                  No playbook specs available
                </div>
              )}
            </div>
          </div>

          {/* Draft Spec */}
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: showDraftInput ? 10 : 0,
                cursor: "pointer",
              }}
              onClick={() => setShowDraftInput(!showDraftInput)}
            >
              <span style={{ fontSize: 13 }}>🧪</span>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#92400e", flex: 1 }}>
                Draft Spec
              </span>
              {parsedDraftSpec && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    background: "#dcfce7",
                    color: "#166534",
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  ACTIVE
                </span>
              )}
              <span style={{ color: "#92400e", fontSize: 12 }}>{showDraftInput ? "▼" : "▶"}</span>
            </div>

            {showDraftInput && (
              <>
                <div style={{ fontSize: 11, color: "#92400e", marginBottom: 8 }}>
                  Paste spec JSON to test without activating
                </div>
                <textarea
                  value={draftSpecJson}
                  onChange={(e) => handleDraftSpecChange(e.target.value)}
                  placeholder={`{\n  "id": "my-spec",\n  "title": "My Draft Spec",\n  ...\n}`}
                  style={{
                    width: "100%",
                    height: 120,
                    padding: 8,
                    border: draftSpecError ? "1px solid #dc2626" : "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "ui-monospace, monospace",
                    resize: "vertical",
                    background: "#fff",
                  }}
                />
                {draftSpecError && (
                  <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{draftSpecError}</div>
                )}
                {parsedDraftSpec && (
                  <div style={{ marginTop: 8, padding: 8, background: "#f0fdf4", borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>
                      ✓ {parsedDraftSpec.title}
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                      ID: {parsedDraftSpec.id} • Type: {parsedDraftSpec.specType || "DOMAIN"}
                    </div>
                    {parsedDraftSpec.parameters && (
                      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                        {parsedDraftSpec.parameters.length} parameters
                      </div>
                    )}
                    <Link
                      href="/x/studio"
                      style={{
                        display: "inline-block",
                        marginTop: 8,
                        padding: "4px 8px",
                        fontSize: 10,
                        background: "#4f46e5",
                        color: "#fff",
                        borderRadius: 4,
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      Activate in Studio →
                    </Link>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      setDraftSpecJson("");
                      setDraftSpecError(null);
                      setDraftSpecEnabled(false);
                    }}
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      border: "1px solid #d1d5db",
                      borderRadius: 4,
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                  <label
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      border: "1px solid #d1d5db",
                      borderRadius: 4,
                      background: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    📁 Load File
                    <input
                      type="file"
                      accept=".json"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const text = await file.text();
                          handleDraftSpecChange(text);
                        }
                      }}
                    />
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13 }}>⚡</span>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#0369a1" }}>
                Quick Actions
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Upload Transcript */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: "#fff",
                  border: "1px solid #e0f2fe",
                  borderRadius: 6,
                  cursor: selectedCallerId ? "pointer" : "not-allowed",
                  opacity: selectedCallerId ? 1 : 0.5,
                  fontSize: 12,
                }}
              >
                <span>📄</span>
                <span>Upload Transcript</span>
                <input
                  type="file"
                  accept=".txt,.json"
                  disabled={!selectedCallerId}
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !selectedCallerId) return;
                    try {
                      const text = await file.text();
                      // Create a new call with the transcript
                      const res = await fetch(`/api/callers/${selectedCallerId}/calls`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          source: "playground-upload",
                          transcript: text,
                        }),
                      });
                      const data = await res.json();
                      if (data.ok) {
                        // Refresh caller data to show new call
                        const callerRes = await fetch(`/api/callers/${selectedCallerId}`);
                        const callerData = await callerRes.json();
                        if (callerData.ok) {
                          setCaller(callerData.caller);
                          setSelectedCallId(data.call.id);
                          setIsDrawerExpanded(true);
                        }
                      } else {
                        setError(data.error || "Failed to upload transcript");
                      }
                    } catch (err) {
                      setError("Failed to upload transcript");
                    }
                    e.target.value = ""; // Reset file input
                  }}
                />
              </label>
              {!selectedCallerId && (
                <div style={{ fontSize: 10, color: "#64748b", fontStyle: "italic", paddingLeft: 4 }}>
                  Select a caller first to upload transcripts
                </div>
              )}

              {/* Upload BDD Spec */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: "#fff",
                  border: "1px solid #e0f2fe",
                  borderRadius: 6,
                  cursor: uploadingSpec ? "wait" : "pointer",
                  opacity: uploadingSpec ? 0.7 : 1,
                  fontSize: 12,
                }}
              >
                <span>📤</span>
                <span>{uploadingSpec ? "Uploading..." : "Upload BDD Spec"}</span>
                <input
                  type="file"
                  accept=".json,.spec.json"
                  disabled={uploadingSpec}
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingSpec(true);
                    setSpecUploadResult(null);
                    try {
                      const content = await file.text();
                      // Preview first
                      const previewRes = await fetch("/api/lab/upload/preview", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ content, filename: file.name }),
                      });
                      const previewData = await previewRes.json();
                      if (!previewData.ok) {
                        setSpecUploadResult({ ok: false, message: previewData.error || "Invalid spec file" });
                        setUploadingSpec(false);
                        return;
                      }
                      // Activate the spec
                      const activateRes = await fetch("/api/lab/upload", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ content, filename: file.name }),
                      });
                      const activateData = await activateRes.json();
                      if (activateData.ok) {
                        setSpecUploadResult({
                          ok: true,
                          message: `Spec "${activateData.specName || previewData.specName}" activated!`,
                        });
                        // Refresh available specs
                        const specsRes = await fetch("/api/playbooks/available-items").then(r => r.json());
                        if (specsRes.ok) {
                          setAvailableSpecs({
                            systemSpecs: specsRes.systemSpecs || [],
                            domainSpecs: specsRes.domainSpecs || [],
                          });
                        }
                      } else {
                        setSpecUploadResult({ ok: false, message: activateData.error || "Failed to activate spec" });
                      }
                    } catch (err) {
                      setSpecUploadResult({ ok: false, message: "Failed to upload spec" });
                    } finally {
                      setUploadingSpec(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              {specUploadResult && (
                <div
                  style={{
                    fontSize: 11,
                    padding: "6px 10px",
                    borderRadius: 4,
                    background: specUploadResult.ok ? "#dcfce7" : "#fee2e2",
                    color: specUploadResult.ok ? "#166534" : "#dc2626",
                  }}
                >
                  {specUploadResult.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== RIGHT PANEL: OUTPUT ===== */}
        <div
          style={{
            background: "#1e293b",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Output Header */}
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid #334155",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>OUTPUT</span>
            <div style={{ flex: 1 }} />

            {/* View Toggle */}
            <div style={{ display: "flex", background: "#334155", borderRadius: 6, padding: 2 }}>
              <button
                onClick={() => setOutputMode("sections")}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 500,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: outputMode === "sections" ? "#475569" : "transparent",
                  color: outputMode === "sections" ? "#fff" : "#94a3b8",
                }}
              >
                Sections
              </button>
              <button
                onClick={() => setOutputMode("raw")}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 500,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: outputMode === "raw" ? "#475569" : "transparent",
                  color: outputMode === "raw" ? "#fff" : "#94a3b8",
                }}
              >
                Raw
              </button>
            </div>

            {/* Diff Toggle */}
            {previousPrompt && (
              <button
                onClick={() => setShowDiff(!showDiff)}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 500,
                  border: showDiff ? "1px solid #4ade80" : "1px solid #475569",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: showDiff ? "rgba(74, 222, 128, 0.1)" : "transparent",
                  color: showDiff ? "#4ade80" : "#94a3b8",
                }}
              >
                Diff {diff.length > 0 && `(${diff.length})`}
              </button>
            )}

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              disabled={!generatedPrompt}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 500,
                border: "1px solid #475569",
                borderRadius: 6,
                cursor: generatedPrompt ? "pointer" : "not-allowed",
                background: "transparent",
                color: copied ? "#4ade80" : "#94a3b8",
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          {/* Output Content */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 16,
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              color: "#e2e8f0",
            }}
          >
            {isGenerating ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    border: "3px solid #475569",
                    borderTopColor: "#4f46e5",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <span style={{ color: "#94a3b8" }}>Generating prompt...</span>
              </div>
            ) : !generatedPrompt ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#64748b",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No prompt generated yet</div>
                <div style={{ fontSize: 12 }}>Select a caller and click Generate</div>
              </div>
            ) : outputMode === "raw" ? (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {JSON.stringify(generatedPrompt.llmPrompt, null, 2)}
              </pre>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Quick Start Section */}
                {generatedPrompt.llmPrompt._quickStart && (
                  <div
                    style={{
                      background: "#334155",
                      borderRadius: 8,
                      padding: 14,
                      border: "1px solid #475569",
                    }}
                  >
                    <div style={{ color: "#4ade80", fontWeight: 600, marginBottom: 8, fontSize: 11 }}>
                      _quickStart
                    </div>
                    {Object.entries(generatedPrompt.llmPrompt._quickStart as Record<string, string>).map(
                      ([key, value]) => (
                        <div key={key} style={{ marginBottom: 4 }}>
                          <span style={{ color: "#94a3b8" }}>{key}:</span>{" "}
                          <span style={{ color: "#e2e8f0" }}>{value}</span>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Diff Panel */}
                {showDiff && diff.length > 0 && (
                  <div
                    style={{
                      background: "rgba(74, 222, 128, 0.05)",
                      border: "1px solid rgba(74, 222, 128, 0.2)",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        color: "#4ade80",
                        fontWeight: 600,
                        marginBottom: 8,
                        fontSize: 11,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      🔄 Changes ({diff.length})
                    </div>
                    {diff.map((d) => (
                      <div
                        key={d.key}
                        style={{
                          padding: "4px 8px",
                          marginBottom: 4,
                          borderRadius: 4,
                          fontSize: 11,
                          background:
                            d.status === "added"
                              ? "rgba(74, 222, 128, 0.15)"
                              : d.status === "removed"
                                ? "rgba(248, 113, 113, 0.15)"
                                : "rgba(251, 191, 36, 0.15)",
                          color:
                            d.status === "added"
                              ? "#4ade80"
                              : d.status === "removed"
                                ? "#f87171"
                                : "#fbbf24",
                        }}
                      >
                        {d.status === "added" && "+ "}
                        {d.status === "removed" && "- "}
                        {d.status === "changed" && "~ "}
                        <strong>{d.key}</strong>
                        {d.status === "changed" && " (modified)"}
                      </div>
                    ))}
                  </div>
                )}

                {/* Prose Prompt */}
                {generatedPrompt.prompt && (
                  <div>
                    <div style={{ color: "#94a3b8", fontWeight: 600, marginBottom: 8, fontSize: 11 }}>
                      GENERATED PROMPT
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{generatedPrompt.prompt}</div>
                  </div>
                )}

                {/* Other Sections */}
                {Object.entries(generatedPrompt.llmPrompt)
                  .filter(([key]) => !key.startsWith("_") && key !== "caller")
                  .slice(0, 10)
                  .map(([key, value]) => (
                    <div key={key}>
                      <div style={{ color: "#94a3b8", fontWeight: 600, marginBottom: 6, fontSize: 11 }}>
                        {key}
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: 11,
                          color: "#cbd5e1",
                        }}
                      >
                        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
                      </pre>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== TRANSCRIPT DRAWER ===== */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: actualDrawerHeight,
          background: "#fff",
          borderTop: "1px solid #e5e7eb",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.05)",
          transition: isDragging ? "none" : "height 200ms ease-out",
          display: "flex",
          flexDirection: "column",
          zIndex: 50,
        }}
      >
        {/* Drag Handle */}
        {isDrawerExpanded && (
          <div
            onMouseDown={handleDragStart}
            style={{
              height: 8,
              background: "#f3f4f6",
              cursor: "ns-resize",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 32, height: 3, background: "#d1d5db", borderRadius: 2 }} />
          </div>
        )}

        {/* Drawer Header */}
        <div
          onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
          style={{
            padding: "10px 20px",
            background: "#f9fafb",
            borderBottom: isDrawerExpanded ? "1px solid #e5e7eb" : "none",
            display: "flex",
            alignItems: "center",
            gap: 12,
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 14 }}>📞</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: "#374151" }}>
            Transcript
            {selectedCall && (
              <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: 8 }}>
                {formatDate(selectedCall.createdAt)}
                {selectedCall.callSequence && ` · Call #${selectedCall.callSequence}`}
              </span>
            )}
          </span>
          <div style={{ flex: 1 }} />

          {/* Call Tabs */}
          {caller && caller.calls.length > 1 && isDrawerExpanded && (
            <div style={{ display: "flex", gap: 4 }}>
              {caller.calls.slice(0, 5).map((call, i) => (
                <button
                  key={call.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCallId(call.id);
                  }}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    border: selectedCallId === call.id ? "1px solid #4f46e5" : "1px solid #d1d5db",
                    borderRadius: 6,
                    background: selectedCallId === call.id ? "#eef2ff" : "#fff",
                    color: selectedCallId === call.id ? "#4f46e5" : "#6b7280",
                    cursor: "pointer",
                  }}
                >
                  #{call.callSequence || i + 1}
                </button>
              ))}
            </div>
          )}

          <span style={{ color: "#9ca3af", fontSize: 16 }}>{isDrawerExpanded ? "▼" : "▲"}</span>
        </div>

        {/* Drawer Content */}
        {isDrawerExpanded && (
          <div style={{ flex: 1, overflow: "auto", padding: "12px 20px" }}>
            {!caller ? (
              <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", paddingTop: 20 }}>
                Select a caller to view transcripts
              </div>
            ) : !selectedCall ? (
              <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", paddingTop: 20 }}>
                No calls available for this caller
              </div>
            ) : parsedMessages.length === 0 ? (
              <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", paddingTop: 20 }}>
                No transcript content
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {parsedMessages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: msg.role === "ai" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "70%",
                        padding: "8px 12px",
                        borderRadius: 12,
                        borderBottomLeftRadius: msg.role === "user" ? 4 : 12,
                        borderBottomRightRadius: msg.role === "ai" ? 4 : 12,
                        background: msg.role === "ai" ? "#4f46e5" : "#f3f4f6",
                        color: msg.role === "ai" ? "#fff" : "#374151",
                        fontSize: 13,
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Caller Modal */}
      {showCreateCallerModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateCallerModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              width: 400,
              maxWidth: "90vw",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <h2 style={{ margin: "0 0 20px 0", fontSize: 18, fontWeight: 600 }}>Create New Caller</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4, color: "#374151" }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={newCallerName}
                  onChange={(e) => setNewCallerName(e.target.value)}
                  placeholder="Enter caller name"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4, color: "#374151" }}>
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={newCallerEmail}
                  onChange={(e) => setNewCallerEmail(e.target.value)}
                  placeholder="email@example.com"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4, color: "#374151" }}>
                  Domain (optional)
                </label>
                <select
                  value={newCallerDomainId}
                  onChange={(e) => setNewCallerDomainId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                >
                  <option value="">No domain</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
              <button
                onClick={() => {
                  setShowCreateCallerModal(false);
                  setNewCallerName("");
                  setNewCallerEmail("");
                  setNewCallerDomainId("");
                }}
                style={{
                  padding: "10px 20px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newCallerName.trim()) return;
                  setCreatingCaller(true);
                  try {
                    const res = await fetch("/api/callers", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: newCallerName.trim(),
                        email: newCallerEmail.trim() || null,
                        domainId: newCallerDomainId || null,
                      }),
                    });
                    const data = await res.json();
                    if (data.ok) {
                      // Add to callers list and select it
                      setCallers((prev) => [data.caller, ...prev]);
                      handleCallerSelect(data.caller.id);
                      setShowCreateCallerModal(false);
                      setNewCallerName("");
                      setNewCallerEmail("");
                      setNewCallerDomainId("");
                    } else {
                      setError(data.error || "Failed to create caller");
                    }
                  } catch (err) {
                    setError("Failed to create caller");
                  } finally {
                    setCreatingCaller(false);
                  }
                }}
                disabled={!newCallerName.trim() || creatingCaller}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  borderRadius: 6,
                  background: newCallerName.trim() ? "#4f46e5" : "#e5e7eb",
                  color: newCallerName.trim() ? "#fff" : "#9ca3af",
                  cursor: newCallerName.trim() ? "pointer" : "not-allowed",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {creatingCaller ? "Creating..." : "Create Caller"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Domain Modal */}
      {showCreateDomainModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateDomainModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              width: 400,
              maxWidth: "90vw",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <h2 style={{ margin: "0 0 20px 0", fontSize: 18, fontWeight: 600 }}>Create New Domain</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4, color: "#374151" }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  placeholder="e.g., Customer Support"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4, color: "#374151" }}>
                  Slug (optional)
                </label>
                <input
                  type="text"
                  value={newDomainSlug}
                  onChange={(e) => setNewDomainSlug(e.target.value)}
                  placeholder="e.g., customer-support"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                />
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                  Auto-generated from name if left empty
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
              <button
                onClick={() => {
                  setShowCreateDomainModal(false);
                  setNewDomainName("");
                  setNewDomainSlug("");
                }}
                style={{
                  padding: "10px 20px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newDomainName.trim()) return;
                  setCreatingDomain(true);
                  try {
                    // Generate slug from name if not provided
                    const slug = newDomainSlug.trim() || newDomainName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    const res = await fetch("/api/domains", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: newDomainName.trim(),
                        slug,
                      }),
                    });
                    const data = await res.json();
                    if (data.ok) {
                      setDomains((prev) => [...prev, data.domain]);
                      setSelectedDomainId(data.domain.id);
                      setSelectedPlaybookId("");
                      setShowCreateDomainModal(false);
                      setNewDomainName("");
                      setNewDomainSlug("");
                    } else {
                      setError(data.error || "Failed to create domain");
                    }
                  } catch (err) {
                    setError("Failed to create domain");
                  } finally {
                    setCreatingDomain(false);
                  }
                }}
                disabled={!newDomainName.trim() || creatingDomain}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  borderRadius: 6,
                  background: newDomainName.trim() ? "#4f46e5" : "#e5e7eb",
                  color: newDomainName.trim() ? "#fff" : "#9ca3af",
                  cursor: newDomainName.trim() ? "pointer" : "not-allowed",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {creatingDomain ? "Creating..." : "Create Domain"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Playbook Modal */}
      {showCreatePlaybookModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreatePlaybookModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              width: 400,
              maxWidth: "90vw",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <h2 style={{ margin: "0 0 20px 0", fontSize: 18, fontWeight: 600 }}>Create New Playbook</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4, color: "#374151" }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={newPlaybookName}
                  onChange={(e) => setNewPlaybookName(e.target.value)}
                  placeholder="e.g., Onboarding Flow v1"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4, color: "#374151" }}>
                  Domain *
                </label>
                <select
                  value={newPlaybookDomainId}
                  onChange={(e) => setNewPlaybookDomainId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                >
                  <option value="">Select domain...</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
              <button
                onClick={() => {
                  setShowCreatePlaybookModal(false);
                  setNewPlaybookName("");
                  setNewPlaybookDomainId("");
                }}
                style={{
                  padding: "10px 20px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newPlaybookName.trim() || !newPlaybookDomainId) return;
                  setCreatingPlaybook(true);
                  try {
                    const res = await fetch("/api/playbooks", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: newPlaybookName.trim(),
                        domainId: newPlaybookDomainId,
                      }),
                    });
                    const data = await res.json();
                    if (data.ok) {
                      setPlaybooks((prev) => [...prev, data.playbook]);
                      setSelectedDomainId(newPlaybookDomainId);
                      setSelectedPlaybookId(data.playbook.id);
                      setShowCreatePlaybookModal(false);
                      setNewPlaybookName("");
                      setNewPlaybookDomainId("");
                    } else {
                      setError(data.error || "Failed to create playbook");
                    }
                  } catch (err) {
                    setError("Failed to create playbook");
                  } finally {
                    setCreatingPlaybook(false);
                  }
                }}
                disabled={!newPlaybookName.trim() || !newPlaybookDomainId || creatingPlaybook}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  borderRadius: 6,
                  background: newPlaybookName.trim() && newPlaybookDomainId ? "#4f46e5" : "#e5e7eb",
                  color: newPlaybookName.trim() && newPlaybookDomainId ? "#fff" : "#9ca3af",
                  cursor: newPlaybookName.trim() && newPlaybookDomainId ? "pointer" : "not-allowed",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {creatingPlaybook ? "Creating..." : "Create Playbook"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
