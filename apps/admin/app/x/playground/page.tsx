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

type PlaygroundSection = "caller" | "specs" | "prompts";
type WizardMode = "caller" | "playbook" | "compare";

// =============================================================================
// CONSTANTS
// =============================================================================

const WIZARD_MODES: { id: WizardMode; label: string; icon: string; description: string }[] = [
  { id: "caller", label: "Caller", icon: "👤", description: "Generate prompt for a specific caller" },
  { id: "playbook", label: "Playbook", icon: "📦", description: "Test playbook across multiple callers" },
  { id: "compare", label: "Compare", icon: "⚖️", description: "A/B compare two configurations" },
];

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
  // Wizard mode (top-level)
  const [wizardMode, setWizardMode] = useState<WizardMode>("caller");

  // Section navigation (for Caller wizard steps)
  const [activeSection, setActiveSection] = useState<PlaygroundSection>("caller");

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
  const [showSystemSpecs, setShowSystemSpecs] = useState(false);

  // Tuning panel state
  const [behaviorParams, setBehaviorParams] = useState<BehaviorParameter[]>([]);
  const [previewOverrides, setPreviewOverrides] = useState<Record<string, number>>({});
  const [loadingTargets, setLoadingTargets] = useState(false);

  // Draft spec injection
  const [draftSpecJson, setDraftSpecJson] = useState("");
  const [draftSpecError, setDraftSpecError] = useState<string | null>(null);
  const [draftSpecEnabled, setDraftSpecEnabled] = useState(false);
  const [showDraftInput, setShowDraftInput] = useState(false);

  // Transcript viewer state
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

  // Section validation
  const canAccessSpecs = !!selectedCallerId;
  const canAccessPrompts = !!selectedCallerId && !!selectedPlaybookId;

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
    } catch {
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
  // TRANSCRIPT VIEWER
  // =============================================================================

  const selectedCall = caller?.calls.find((c) => c.id === selectedCallId);
  const parsedMessages = selectedCall ? parseTranscript(selectedCall.transcript) : [];

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

  const sectionTabs: { id: PlaygroundSection; label: string; icon: string; enabled: boolean }[] = [
    { id: "caller", label: "1. Caller", icon: "👤", enabled: true },
    { id: "specs", label: "2. Specs", icon: "📋", enabled: canAccessSpecs },
    { id: "prompts", label: "3. Prompts", icon: "✨", enabled: canAccessPrompts },
  ];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f9fafb" }}>
      {/* ===== HEADER WITH WIZARD MODE TABS ===== */}
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
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", margin: 0 }}>
          Playground
        </h1>

        {/* Wizard Mode Tabs */}
        <div style={{ display: "flex", gap: 4, marginLeft: 24 }}>
          {WIZARD_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setWizardMode(mode.id)}
              title={mode.description}
              style={{
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 500,
                border: wizardMode === mode.id ? "1px solid #4f46e5" : "1px solid #e5e7eb",
                borderRadius: 6,
                background: wizardMode === mode.id ? "#eef2ff" : "#fff",
                color: wizardMode === mode.id ? "#4f46e5" : "#6b7280",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              <span>{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Context indicators (only show in caller mode) */}
        {wizardMode === "caller" && caller && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Caller:</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
              {caller.name || caller.email || caller.id.slice(0, 8)}
            </span>
          </div>
        )}
        {wizardMode === "caller" && selectedPlaybookId && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Playbook:</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
              {playbooks.find((p) => p.id === selectedPlaybookId)?.name || "..."}
            </span>
          </div>
        )}
      </div>

      {/* ===== CALLER WIZARD: SECTION TABS ===== */}
      {wizardMode === "caller" && (
        <div
          style={{
            display: "flex",
            gap: 0,
            background: "#fff",
            borderBottom: "1px solid #e5e7eb",
            padding: "0 20px",
          }}
        >
          {sectionTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.enabled && setActiveSection(tab.id)}
              disabled={!tab.enabled}
              style={{
              padding: "12px 24px",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              borderBottom: activeSection === tab.id ? "2px solid #4f46e5" : "2px solid transparent",
              background: "transparent",
              color: !tab.enabled
                ? "#d1d5db"
                : activeSection === tab.id
                  ? "#4f46e5"
                  : "#6b7280",
              cursor: tab.enabled ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s",
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {!tab.enabled && <span style={{ fontSize: 10, opacity: 0.5 }}>locked</span>}
          </button>
        ))}
        </div>
      )}

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

      {/* ================================================================ */}
      {/* CALLER WIZARD CONTENT                                           */}
      {/* ================================================================ */}
      {wizardMode === "caller" && (
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {/* ============================================================ */}
          {/* SECTION 1: CALLER */}
          {/* ============================================================ */}
          {activeSection === "caller" && (
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            {!selectedCallerId ? (
              /* Empty state */
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1f2937", margin: "0 0 8px 0" }}>
                  No caller selected
                </h2>
                <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
                  Start by selecting an existing caller or creating a new one
                </p>

                {/* Search and Create side by side */}
                <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                  {/* Search */}
                  <div ref={callerSearchRef} style={{ position: "relative", width: 280 }}>
                    <input
                      type="text"
                      placeholder="Search callers..."
                      value={callerSearch}
                      onChange={(e) => {
                        setCallerSearch(e.target.value);
                        setShowCallerDropdown(true);
                      }}
                      onFocus={() => setShowCallerDropdown(true)}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        paddingLeft: 40,
                        border: "1px solid #d1d5db",
                        borderRadius: 8,
                        fontSize: 14,
                        background: "#fff",
                      }}
                    />
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>
                      🔍
                    </span>

                    {showCallerDropdown && callerSearch && (
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
                          maxHeight: 280,
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
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Create Caller */}
                  <button
                    onClick={() => setShowCreateCallerModal(true)}
                    style={{
                      padding: "12px 24px",
                      background: "#4f46e5",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    ➕ Create Caller
                  </button>
                </div>
              </div>
            ) : (
              /* Caller selected - show info and transcripts */
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Caller Card */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    padding: 20,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "#eef2ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                      }}
                    >
                      👤
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 600, color: "#1f2937" }}>
                        {caller?.name || "Unnamed Caller"}
                      </h3>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>
                        {caller?.email || caller?.phone || caller?.externalId || caller?.id.slice(0, 12)}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        {caller?.domain ? (
                          <span
                            style={{
                              fontSize: 11,
                              padding: "4px 8px",
                              background: "#dbeafe",
                              color: "#1e40af",
                              borderRadius: 4,
                            }}
                          >
                            {caller.domain.name}
                          </span>
                        ) : (
                          <select
                            onChange={(e) => e.target.value && handleAttachDomain(e.target.value)}
                            defaultValue=""
                            style={{
                              padding: "4px 8px",
                              border: "1px solid #fcd34d",
                              borderRadius: 6,
                              fontSize: 11,
                              background: "#fffbeb",
                              color: "#92400e",
                            }}
                          >
                            <option value="">Attach to domain...</option>
                            {domains.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>
                          {caller?.calls.length || 0} calls
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCallerId("");
                        setCaller(null);
                        setSelectedCallId("");
                        setGeneratedPrompt(null);
                        setPreviousPrompt(null);
                      }}
                      style={{
                        padding: "6px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        background: "#fff",
                        fontSize: 12,
                        color: "#6b7280",
                        cursor: "pointer",
                      }}
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Calls */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 20px",
                      borderBottom: "1px solid #e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>📞</span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#374151" }}>Calls</span>
                    <div style={{ flex: 1 }} />

                    {/* Add Call */}
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        background: "#f0f9ff",
                        border: "1px solid #bae6fd",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                        color: "#0369a1",
                      }}
                    >
                      <span>📄</span>
                      <span>Upload</span>
                      <input
                        type="file"
                        accept=".txt,.json"
                        style={{ display: "none" }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !selectedCallerId) return;
                          try {
                            const text = await file.text();
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
                              const callerRes = await fetch(`/api/callers/${selectedCallerId}`);
                              const callerData = await callerRes.json();
                              if (callerData.ok) {
                                setCaller({ ...callerData.caller, calls: callerData.calls || [] });
                                setSelectedCallId(data.call.id);
                              }
                            } else {
                              setError(data.error || "Failed to upload transcript");
                            }
                          } catch {
                            setError("Failed to upload transcript");
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {/* Call tabs + transcript content */}
                  {!caller?.calls.length ? (
                    <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      <p>No calls yet. Upload one to get started.</p>
                    </div>
                  ) : (
                    <>
                      {/* Call tabs */}
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          padding: "8px 20px",
                          borderBottom: "1px solid #f3f4f6",
                          overflowX: "auto",
                        }}
                      >
                        {caller.calls.map((call, i) => (
                          <button
                            key={call.id}
                            onClick={() => setSelectedCallId(call.id)}
                            style={{
                              padding: "6px 12px",
                              fontSize: 11,
                              border: selectedCallId === call.id ? "1px solid #4f46e5" : "1px solid #e5e7eb",
                              borderRadius: 6,
                              background: selectedCallId === call.id ? "#eef2ff" : "#fff",
                              color: selectedCallId === call.id ? "#4f46e5" : "#6b7280",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            #{call.callSequence || i + 1}
                            <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>
                              {formatDate(call.createdAt)}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Call transcript */}
                      <div style={{ maxHeight: 300, overflow: "auto", padding: "12px 20px" }}>
                        {!selectedCall?.transcript ? (
                          <div style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic" }}>
                            No transcript content
                          </div>
                        ) : parsedMessages.length === 0 ? (
                          /* Raw transcript when parsing fails (no AI:/User: format) */
                          <div
                            style={{
                              whiteSpace: "pre-wrap",
                              fontSize: 13,
                              lineHeight: 1.6,
                              color: "#374151",
                              background: "#f9fafb",
                              padding: 12,
                              borderRadius: 8,
                            }}
                          >
                            {selectedCall.transcript}
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
                                    maxWidth: "80%",
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
                    </>
                  )}
                </div>

                {/* Next Step */}
                <div style={{ textAlign: "center", padding: 20 }}>
                  <button
                    onClick={() => setActiveSection("specs")}
                    style={{
                      padding: "12px 32px",
                      background: "#4f46e5",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    Continue to Specs →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION 2: SPECS */}
        {/* ============================================================ */}
        {activeSection === "specs" && (
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            {!canAccessSpecs ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📋</div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "#9ca3af", margin: "0 0 8px 0" }}>
                  Select a caller first
                </h2>
                <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 24 }}>
                  Go back to the Caller section to select or create a caller
                </p>
                <button
                  onClick={() => setActiveSection("caller")}
                  style={{
                    padding: "10px 20px",
                    background: "#4f46e5",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  ← Back to Caller
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Domain & Playbook Selectors */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    padding: 20,
                  }}
                >
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {/* Domain */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: "#374151" }}>
                        Domain
                      </label>
                      <select
                        value={selectedDomainId}
                        onChange={(e) => {
                          if (e.target.value === "__create__") {
                            setShowCreateDomainModal(true);
                            e.target.value = selectedDomainId;
                          } else {
                            setSelectedDomainId(e.target.value);
                            setSelectedPlaybookId("");
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #d1d5db",
                          borderRadius: 8,
                          fontSize: 14,
                        }}
                      >
                        <option value="">All domains</option>
                        {domains.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                        <option value="__create__" style={{ fontStyle: "italic" }}>+ Create new domain...</option>
                      </select>
                    </div>

                    {/* Playbook */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: "#374151" }}>
                        Playbook
                      </label>
                      <select
                        value={selectedPlaybookId}
                        onChange={(e) => {
                          if (e.target.value === "__create__") {
                            setNewPlaybookDomainId(selectedDomainId);
                            setShowCreatePlaybookModal(true);
                            e.target.value = selectedPlaybookId;
                          } else {
                            setSelectedPlaybookId(e.target.value);
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: selectedPlaybookId ? "1px solid #4f46e5" : "1px solid #d1d5db",
                          borderRadius: 8,
                          fontSize: 14,
                          background: selectedPlaybookId ? "#eef2ff" : "#fff",
                        }}
                      >
                        <option value="">Select playbook...</option>
                        {filteredPlaybooks.map((pb) => (
                          <option key={pb.id} value={pb.id}>
                            {pb.name} ({pb.status})
                          </option>
                        ))}
                        <option value="__create__" style={{ fontStyle: "italic" }}>+ Create new playbook...</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Playbook Specs */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    padding: 20,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ fontSize: 14 }}>✏️</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Playbook Specs</span>
                    <div style={{ flex: 1 }} />
                    {/* Upload BDD Spec */}
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        background: uploadingSpec ? "#f3f4f6" : "#f0f9ff",
                        border: "1px solid #bae6fd",
                        borderRadius: 6,
                        cursor: uploadingSpec ? "wait" : "pointer",
                        fontSize: 12,
                        color: "#0369a1",
                      }}
                    >
                      <span>📤</span>
                      <span>{uploadingSpec ? "Uploading..." : "Upload Spec"}</span>
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
                          } catch {
                            setSpecUploadResult({ ok: false, message: "Failed to upload spec" });
                          } finally {
                            setUploadingSpec(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                  </div>

                  {specUploadResult && (
                    <div
                      style={{
                        marginBottom: 12,
                        fontSize: 12,
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: specUploadResult.ok ? "#dcfce7" : "#fee2e2",
                        color: specUploadResult.ok ? "#166534" : "#dc2626",
                      }}
                    >
                      {specUploadResult.message}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                            padding: "10px 14px",
                            background: enabled ? "#f0fdf4" : "#f9fafb",
                            border: enabled ? "1px solid #86efac" : "1px solid #e5e7eb",
                            borderRadius: 8,
                            fontSize: 13,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                          title={spec.description || info?.description}
                        >
                          <span style={{ fontSize: 16 }}>{enabled ? "◉" : "○"}</span>
                          <span style={{ flex: 1, color: enabled ? "#374151" : "#9ca3af" }}>{spec.name}</span>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "3px 8px",
                              background: colors?.bg || "#f3f4f6",
                              color: colors?.text || "#6b7280",
                              borderRadius: 4,
                            }}
                          >
                            {info?.label || badgeType}
                          </span>
                        </div>
                      );
                    })}
                    {availableSpecs.domainSpecs.length === 0 && (
                      <div style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic", padding: 12, textAlign: "center" }}>
                        No playbook specs available
                      </div>
                    )}
                  </div>
                </div>

                {/* System Specs (collapsed by default) */}
                <div
                  style={{
                    background: "#f8fafc",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    overflow: "hidden",
                  }}
                >
                  <div
                    onClick={() => setShowSystemSpecs(!showSystemSpecs)}
                    style={{
                      padding: "12px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>🔒</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>
                      System Specs ({availableSpecs.systemSpecs.length})
                    </span>
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>read-only</span>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{showSystemSpecs ? "▼" : "▶"}</span>
                  </div>
                  {showSystemSpecs && (
                    <div style={{ padding: "0 20px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {availableSpecs.systemSpecs.map((spec) => {
                          const badgeType = getSpecBadgeType(spec);
                          const info = SPEC_TYPE_INFO[badgeType];
                          const colors = BADGE_COLORS[badgeType];
                          return (
                            <div
                              key={spec.id}
                              style={{
                                padding: "8px 12px",
                                background: "#fff",
                                borderRadius: 6,
                                fontSize: 12,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                opacity: 0.8,
                              }}
                              title={spec.description || info?.description}
                            >
                              <span style={{ fontSize: 12 }}>{info?.icon || "📋"}</span>
                              <span style={{ flex: 1, color: "#64748b" }}>{spec.name}</span>
                              <span
                                style={{
                                  fontSize: 9,
                                  padding: "2px 6px",
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
                      </div>
                    </div>
                  )}
                </div>

                {/* Draft Spec */}
                <div
                  style={{
                    background: "#fffbeb",
                    borderRadius: 12,
                    border: "1px solid #fcd34d",
                    overflow: "hidden",
                  }}
                >
                  <div
                    onClick={() => setShowDraftInput(!showDraftInput)}
                    style={{
                      padding: "12px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>🧪</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#92400e" }}>Draft Spec</span>
                    {parsedDraftSpec && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          background: "#dcfce7",
                          color: "#166534",
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        ACTIVE
                      </span>
                    )}
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: "#92400e" }}>{showDraftInput ? "▼" : "▶"}</span>
                  </div>
                  {showDraftInput && (
                    <div style={{ padding: "0 20px 16px" }}>
                      <div style={{ fontSize: 12, color: "#92400e", marginBottom: 10 }}>
                        Paste spec JSON to test without activating
                      </div>
                      <textarea
                        value={draftSpecJson}
                        onChange={(e) => handleDraftSpecChange(e.target.value)}
                        placeholder={`{\n  "id": "my-spec",\n  "title": "My Draft Spec",\n  ...\n}`}
                        style={{
                          width: "100%",
                          height: 120,
                          padding: 10,
                          border: draftSpecError ? "1px solid #dc2626" : "1px solid #d1d5db",
                          borderRadius: 8,
                          fontSize: 12,
                          fontFamily: "ui-monospace, monospace",
                          resize: "vertical",
                          background: "#fff",
                        }}
                      />
                      {draftSpecError && (
                        <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{draftSpecError}</div>
                      )}
                      {parsedDraftSpec && (
                        <div style={{ marginTop: 10, padding: 10, background: "#f0fdf4", borderRadius: 8 }}>
                          <div style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>
                            ✓ {parsedDraftSpec.title}
                          </div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                            ID: {parsedDraftSpec.id}
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          onClick={() => {
                            setDraftSpecJson("");
                            setDraftSpecError(null);
                            setDraftSpecEnabled(false);
                          }}
                          style={{
                            padding: "6px 12px",
                            fontSize: 12,
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            background: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          Clear
                        </button>
                        <label
                          style={{
                            padding: "6px 12px",
                            fontSize: 12,
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            background: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
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
                    </div>
                  )}
                </div>

                {/* Next Step */}
                <div style={{ textAlign: "center", padding: 20 }}>
                  <button
                    onClick={() => setActiveSection("prompts")}
                    disabled={!canAccessPrompts}
                    style={{
                      padding: "12px 32px",
                      background: canAccessPrompts ? "#4f46e5" : "#e5e7eb",
                      color: canAccessPrompts ? "#fff" : "#9ca3af",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: canAccessPrompts ? "pointer" : "not-allowed",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {canAccessPrompts ? "Continue to Prompts →" : "Select a playbook first"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION 3: PROMPTS */}
        {/* ============================================================ */}
        {activeSection === "prompts" && (
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            {!canAccessPrompts ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>✨</div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "#9ca3af", margin: "0 0 8px 0" }}>
                  Configure specs first
                </h2>
                <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 24 }}>
                  Select a caller and playbook before generating prompts
                </p>
                <button
                  onClick={() => setActiveSection("specs")}
                  style={{
                    padding: "10px 20px",
                    background: "#4f46e5",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  ← Back to Specs
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 20 }}>
                {/* Left: Tuning + Generate */}
                <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Generate Button */}
                  <button
                    onClick={generatePrompt}
                    disabled={isGenerating}
                    style={{
                      padding: "14px 24px",
                      background: isGenerating ? "#a5b4fc" : "#4f46e5",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: isGenerating ? "wait" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {isGenerating ? "Generating..." : "Generate Prompt"}
                  </button>

                  {/* Tuning Panel */}
                  <div
                    style={{
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 14 }}>🎚️</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>Tuning</span>
                      {Object.keys(previewOverrides).length > 0 && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#f59e0b",
                          }}
                          title="Modified values"
                        />
                      )}
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, color: "#b45309" }}>
                        {behaviorParams.length} params
                      </span>
                    </div>

                    {loadingTargets ? (
                      <div style={{ fontSize: 12, color: "#92400e", textAlign: "center", padding: 16 }}>
                        Loading targets...
                      </div>
                    ) : behaviorParams.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#92400e", textAlign: "center", padding: 16 }}>
                        No behavior parameters
                      </div>
                    ) : (
                      <>
                        {Object.keys(previewOverrides).length > 0 && (
                          <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => setPreviewOverrides({})}
                              style={{
                                fontSize: 11,
                                padding: "4px 10px",
                                background: "#fff",
                                border: "1px solid #fbbf24",
                                borderRadius: 6,
                                cursor: "pointer",
                                color: "#92400e",
                              }}
                            >
                              Reset ({Object.keys(previewOverrides).length})
                            </button>
                          </div>
                        )}
                        {Object.entries(
                          behaviorParams.reduce((groups, param) => {
                            const group = param.domainGroup || "General";
                            if (!groups[group]) groups[group] = [];
                            groups[group].push(param);
                            return groups;
                          }, {} as Record<string, BehaviorParameter[]>)
                        ).map(([groupName, params]) => (
                          <div key={groupName} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "#92400e", marginBottom: 10, textTransform: "uppercase" }}>
                              {groupName}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
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
                </div>

                {/* Right: Output */}
                <div
                  style={{
                    flex: 1,
                    background: "#1e293b",
                    borderRadius: 12,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 500,
                    overflow: "hidden",
                  }}
                >
                  {/* Output Header */}
                  <div
                    style={{
                      padding: "12px 16px",
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
                          padding: "5px 12px",
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
                          padding: "5px 12px",
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
                          padding: "5px 12px",
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
                        padding: "5px 12px",
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
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Ready to generate</div>
                        <div style={{ fontSize: 12 }}>Click "Generate Prompt" to create a prompt</div>
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
            )}
          </div>
        )}
        </div>
      )}

      {/* ================================================================ */}
      {/* PLAYBOOK WIZARD CONTENT                                         */}
      {/* ================================================================ */}
      {wizardMode === "playbook" && (
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1f2937", margin: "0 0 8px 0" }}>
                Playbook Testing
              </h2>
              <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
                Select a playbook to see how it generates prompts for different callers.
                Compare outputs across personality types and contexts.
              </p>

              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>
                <select
                  value={selectedPlaybookId}
                  onChange={(e) => setSelectedPlaybookId(e.target.value)}
                  style={{
                    padding: "10px 16px",
                    fontSize: 14,
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    minWidth: 250,
                  }}
                >
                  <option value="">Select a playbook...</option>
                  {playbooks.filter(p => p.status === "PUBLISHED").map((pb) => (
                    <option key={pb.id} value={pb.id}>
                      {pb.name} ({pb.domain?.name || "No domain"})
                    </option>
                  ))}
                </select>
              </div>

              {selectedPlaybookId && (
                <div style={{ marginTop: 32, padding: 20, background: "#f9fafb", borderRadius: 8, textAlign: "left" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 12 }}>
                    Selected: {playbooks.find(p => p.id === selectedPlaybookId)?.name}
                  </div>
                  <p style={{ fontSize: 13, color: "#6b7280" }}>
                    Playbook multi-caller testing coming soon.
                    This mode will allow you to select multiple sample callers and generate prompts
                    for each to see how the playbook adapts to different personalities.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* COMPARE WIZARD CONTENT                                          */}
      {/* ================================================================ */}
      {wizardMode === "compare" && (
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚖️</div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1f2937", margin: "0 0 8px 0" }}>
                A/B Compare
              </h2>
              <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24, maxWidth: 450, margin: "0 auto 24px" }}>
                Compare two different spec configurations side-by-side for the same caller.
                See exactly what changes when you toggle specs on or off.
              </p>

              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>
                <select
                  value={selectedCallerId}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleCallerSelect(e.target.value);
                    }
                  }}
                  style={{
                    padding: "10px 16px",
                    fontSize: 14,
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    minWidth: 250,
                  }}
                >
                  <option value="">Select a caller...</option>
                  {callers.slice(0, 50).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.email || c.externalId || c.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCallerId && (
                <div style={{ marginTop: 32, padding: 20, background: "#f9fafb", borderRadius: 8, textAlign: "left" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 12 }}>
                    Selected: {caller?.name || caller?.email || selectedCallerId.slice(0, 8)}
                  </div>
                  <p style={{ fontSize: 13, color: "#6b7280" }}>
                    A/B comparison mode coming soon.
                    This mode will show two side-by-side configurations with a diff view
                    highlighting exactly what changed between them.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== MODALS ===== */}

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
                      setCallers((prev) => [data.caller, ...prev]);
                      handleCallerSelect(data.caller.id);
                      setShowCreateCallerModal(false);
                      setNewCallerName("");
                      setNewCallerEmail("");
                      setNewCallerDomainId("");
                    } else {
                      setError(data.error || "Failed to create caller");
                    }
                  } catch {
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
                  } catch {
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
                  } catch {
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
