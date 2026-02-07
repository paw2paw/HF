"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { VerticalSlider } from "@/components/shared/VerticalSlider";
import { CallerPicker } from "@/components/shared/CallerPicker";
import {
  entityColors,
  specTypeColors,
  pipelineColors,
  compareColors,
  diffColors,
} from "@/src/components/shared/uiColors";

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
  { id: "caller", label: "Prompt Tuner", icon: "🧪", description: "Tune prompt output for one caller" },
  { id: "compare", label: "Compare Playbooks", icon: "📖📖", description: "A/B compare two playbook configurations" },
  { id: "playbook", label: "Validate Playbook", icon: "✅", description: "Test playbook across multiple callers" },
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

// Merge spec type and pipeline colors for badge display
const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  // Spec roles (from specTypeColors)
  IDENTITY: { bg: specTypeColors.IDENTITY.bg, text: specTypeColors.IDENTITY.text },
  CONTENT:  { bg: specTypeColors.CONTENT.bg,  text: specTypeColors.CONTENT.text },
  CONTEXT:  { bg: specTypeColors.CONTEXT.bg,  text: specTypeColors.CONTEXT.text },
  VOICE:    { bg: specTypeColors.VOICE.bg,    text: specTypeColors.VOICE.text },
  META:     { bg: specTypeColors.META.bg,     text: specTypeColors.META.text },
  // Pipeline operations (from pipelineColors)
  LEARN:    { bg: pipelineColors.LEARN.bg,    text: pipelineColors.LEARN.text },
  MEASURE:  { bg: pipelineColors.MEASURE.bg,  text: pipelineColors.MEASURE.text },
  ADAPT:    { bg: pipelineColors.ADAPT.bg,    text: pipelineColors.ADAPT.text },
  COMPOSE:  { bg: pipelineColors.COMPOSE.bg,  text: pipelineColors.COMPOSE.text },
};

// =============================================================================
// FANCY SELECT COMPONENT
// =============================================================================

type FancySelectOption = {
  value: string;
  label: string;
  subtitle?: string;
  badge?: string;
  isAction?: boolean; // For special actions like "+ Create new..."
};

type FancySelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: FancySelectOption[];
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  selectedStyle?: { border: string; background: string }; // Custom style when selected
  style?: React.CSSProperties;
};

function FancySelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchable = true,
  clearable = false,
  disabled = false,
  selectedStyle,
  style,
}: FancySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value && !o.isAction);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const s = search.toLowerCase();
    return options.filter(
      (o) =>
        o.isAction ||
        o.label.toLowerCase().includes(s) ||
        o.subtitle?.toLowerCase().includes(s)
    );
  }, [options, search]);

  const handleSelect = useCallback(
    (option: FancySelectOption) => {
      onChange(option.value);
      setSearch("");
      setIsOpen(false);
      setHighlightIndex(0);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          setIsOpen(true);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredOptions[highlightIndex]) {
            handleSelect(filteredOptions[highlightIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setHighlightIndex(0);
          break;
      }
    },
    [isOpen, filteredOptions, highlightIndex, handleSelect]
  );

  // Scroll highlighted into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${highlightIndex}"]`);
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex, isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightIndex(0);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightIndex(0);
  }, [filteredOptions.length]);

  const hasValue = !!value && !!selectedOption;
  const inputBorder = hasValue && selectedStyle ? selectedStyle.border : "1px solid #d1d5db";
  const inputBg = hasValue && selectedStyle ? selectedStyle.background : disabled ? "#f3f4f6" : "white";

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }}>
      <input
        ref={inputRef}
        type="text"
        readOnly={!searchable}
        value={isOpen && searchable ? search : selectedOption?.label || ""}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => {
          setIsOpen(true);
          if (selectedOption) setSearch("");
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "10px 12px",
          paddingRight: 36,
          fontSize: 14,
          border: inputBorder,
          borderRadius: 8,
          outline: "none",
          background: inputBg,
          cursor: disabled ? "not-allowed" : searchable ? "text" : "pointer",
        }}
      />

      {/* Right icons */}
      <div
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          pointerEvents: clearable && hasValue ? "auto" : "none",
        }}
      >
        {clearable && hasValue && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setSearch("");
              inputRef.current?.focus();
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              color: "#9ca3af",
              fontSize: 14,
              lineHeight: 1,
              pointerEvents: "auto",
            }}
          >
            &times;
          </button>
        )}
        <span style={{ color: "#9ca3af", fontSize: 10, pointerEvents: "none" }}>
          {isOpen ? "▲" : "▼"}
        </span>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "white",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            maxHeight: 300,
            overflowY: "auto",
            zIndex: 100,
          }}
        >
          {filteredOptions.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
              No options found
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  color: "#9ca3af",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                {filteredOptions.filter((o) => !o.isAction).length} option
                {filteredOptions.filter((o) => !o.isAction).length !== 1 ? "s" : ""}
              </div>
              {filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  data-index={index}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    background:
                      highlightIndex === index
                        ? "#f0f9ff"
                        : option.value === value
                          ? "#f9fafb"
                          : "transparent",
                    borderBottom: "1px solid #f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontStyle: option.isAction ? "italic" : "normal",
                  }}
                >
                  {/* Selection indicator */}
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: option.value === value && !option.isAction ? "#3b82f6" : "transparent",
                      flexShrink: 0,
                    }}
                  />

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: option.isAction ? 400 : 500,
                        color: option.isAction ? "#6b7280" : "#1f2937",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {option.label}
                    </div>
                    {option.subtitle && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {option.subtitle}
                      </div>
                    )}
                  </div>

                  {/* Badge */}
                  {option.badge && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#f3f4f6",
                        color: "#6b7280",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {option.badge}
                    </span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

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

// Find where two strings diverge and return snippets around the difference
function getDiffSnippets(a: string, b: string, contextLen = 40): { a: string; b: string } {
  // Find first difference
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;

  // Get context before the difference
  const start = Math.max(0, i - contextLen);
  const prefix = start > 0 ? "..." : "";

  // Extract snippets around the difference
  const aSnippet = prefix + a.slice(start, i + contextLen) + (i + contextLen < a.length ? "..." : "");
  const bSnippet = prefix + b.slice(start, i + contextLen) + (i + contextLen < b.length ? "..." : "");

  return { a: aSnippet, b: bSnippet };
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
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read mode from URL, default to "caller"
  const modeParam = searchParams.get("mode") as WizardMode | null;
  const initialMode: WizardMode = modeParam && ["caller", "playbook", "compare"].includes(modeParam) ? modeParam : "caller";

  // Wizard mode (top-level)
  const [wizardMode, setWizardMode] = useState<WizardMode>(initialMode);

  // Sync URL when mode changes
  const handleModeChange = useCallback((mode: WizardMode) => {
    setWizardMode(mode);
    router.replace(`/x/playground?mode=${mode}`, { scroll: false });
  }, [router]);

  // Sync mode from URL when navigating via sidebar
  useEffect(() => {
    const urlMode = searchParams.get("mode") as WizardMode | null;
    if (urlMode && ["caller", "playbook", "compare"].includes(urlMode) && urlMode !== wizardMode) {
      setWizardMode(urlMode);
    }
  }, [searchParams, wizardMode]);

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

  // Compare mode state
  const [compareConfigA, setCompareConfigA] = useState<Record<string, boolean>>({});
  const [compareConfigB, setCompareConfigB] = useState<Record<string, boolean>>({});
  const [comparePlaybookA, setComparePlaybookA] = useState<string>("");
  const [comparePlaybookB, setComparePlaybookB] = useState<string>("");
  const [promptA, setPromptA] = useState<GeneratedPrompt | null>(null);
  const [promptB, setPromptB] = useState<GeneratedPrompt | null>(null);
  const [isGeneratingA, setIsGeneratingA] = useState(false);
  const [isGeneratingB, setIsGeneratingB] = useState(false);
  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set());

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
        Loading Lab...
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
      {/* ===== CONTROL BAR HEADER ===== */}
      <div
        style={{
          padding: "16px 24px",
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Mode title */}
        <h1 style={{ fontSize: 16, fontWeight: 600, color: "#6b7280", margin: 0, minWidth: 120 }}>
          {WIZARD_MODES.find(m => m.id === wizardMode)?.label || "Lab"}
        </h1>

        {/* Control bar with pickers - Prompt Tuner mode */}
        {wizardMode === "caller" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            {/* Step 1: Caller Picker */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: selectedCallerId ? entityColors.caller.bg : "#f3f4f6",
                  color: selectedCallerId ? entityColors.caller.text : "#9ca3af",
                  fontSize: 11,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                1
              </span>
              <div style={{ minWidth: 260 }}>
                <CallerPicker
                  value={selectedCallerId || null}
                  onChange={(id) => {
                    if (id) handleCallerSelect(id);
                  }}
                  placeholder="Select caller..."
                />
              </div>
            </div>

            <span style={{ color: "#d1d5db", fontSize: 18 }}>›</span>

            {/* Step 2: Playbook Picker */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: selectedPlaybookId ? entityColors.playbook.bg : "#f3f4f6",
                  color: selectedPlaybookId ? entityColors.playbook.text : "#9ca3af",
                  fontSize: 11,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                2
              </span>
              <div style={{ minWidth: 220 }}>
                <FancySelect
                  value={selectedPlaybookId}
                  onChange={setSelectedPlaybookId}
                  options={playbooks
                    .filter((pb) => !selectedDomainId || pb.domainId === selectedDomainId)
                    .map((pb) => ({
                      value: pb.id,
                      label: pb.name,
                      subtitle: pb.domain?.name,
                      badge: pb.status,
                    }))}
                  placeholder="Select playbook..."
                  disabled={!selectedCallerId}
                  selectedStyle={{
                    border: `1px solid ${entityColors.playbook.accent}`,
                    background: entityColors.playbook.bg,
                  }}
                />
              </div>
            </div>

            <span style={{ color: "#d1d5db", fontSize: 18 }}>›</span>

            {/* Step 3: Generate Button */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: generatedPrompt ? "#ede9fe" : "#f3f4f6",
                  color: generatedPrompt ? "#7c3aed" : "#9ca3af",
                  fontSize: 11,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                3
              </span>
              <button
                onClick={generatePrompt}
                disabled={!selectedCallerId || !selectedPlaybookId || isGenerating}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  background:
                    !selectedCallerId || !selectedPlaybookId
                      ? "#d1d5db"
                      : isGenerating
                        ? "#a78bfa"
                        : "#7c3aed",
                  border: "none",
                  borderRadius: 8,
                  cursor: !selectedCallerId || !selectedPlaybookId ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    Generating...
                  </>
                ) : generatedPrompt ? (
                  <>
                    <span>↻</span>
                    Regenerate
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    Generate
                  </>
                )}
              </button>
            </div>

            <div style={{ flex: 1 }} />

            {/* Clear all button */}
            {(selectedCallerId || selectedPlaybookId || generatedPrompt) && (
              <button
                onClick={() => {
                  setSelectedCallerId("");
                  setCaller(null);
                  setSelectedPlaybookId("");
                  setGeneratedPrompt(null);
                  setPreviousPrompt(null);
                }}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  color: "#6b7280",
                  background: "transparent",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Clear all
              </button>
            )}
          </div>
        )}
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

      {/* ================================================================ */}
      {/* CALLER WIZARD CONTENT                                           */}
      {/* ================================================================ */}
      {wizardMode === "caller" && (
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {/* ============================================================ */}
          {/* EMPTY STATE: No caller selected */}
          {/* ============================================================ */}
          {!selectedCallerId && (
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>🧪</div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1f2937", margin: "0 0 8px 0" }}>
                  Prompt Tuner
                </h2>
                <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
                  Select a caller using the picker above, then choose a playbook and generate prompts
                </p>
                <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                  <CallerPicker
                    value={selectedCallerId || null}
                    onChange={(callerId) => {
                      if (callerId) {
                        handleCallerSelect(callerId);
                      }
                    }}
                    placeholder="Search callers..."
                    style={{ width: 280 }}
                  />
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
            </div>
          )}

          {/* ============================================================ */}
          {/* MAIN CONTENT: Two-column layout when caller is selected */}
          {/* ============================================================ */}
          {selectedCallerId && (
            <div style={{ display: "flex", gap: 20, maxWidth: 1400, margin: "0 auto" }}>
              {/* LEFT COLUMN: Caller info + Specs */}
              <div style={{ width: 320, flexShrink: 0 }}>
                {/* Compact Caller Card */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: entityColors.caller.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                      }}
                    >
                      👤
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {caller?.name || "Unnamed Caller"}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {caller?.email || caller?.phone || caller?.externalId || caller?.id.slice(0, 12)}
                      </div>
                    </div>
                    {caller?.domain && (
                      <span style={{ fontSize: 10, padding: "3px 6px", background: entityColors.domain.bg, color: entityColors.domain.text, borderRadius: 4, whiteSpace: "nowrap" }}>
                        {caller.domain.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Specs Panel */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 14 }}>📋</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>Specs</span>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => setShowSystemSpecs(!showSystemSpecs)}
                      style={{
                        fontSize: 11,
                        color: showSystemSpecs ? "#4f46e5" : "#9ca3af",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      {showSystemSpecs ? "Hide system" : "Show system"}
                    </button>
                  </div>

                  {/* System Specs */}
                  {showSystemSpecs && availableSpecs.systemSpecs.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6, fontWeight: 500 }}>SYSTEM</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {availableSpecs.systemSpecs.map((spec) => {
                          const isEnabled = specToggles[spec.id] !== false;
                          const badgeType = getSpecBadgeType(spec);
                          const colors = BADGE_COLORS[badgeType] || { bg: "#f3f4f6", text: "#6b7280" };
                          return (
                            <button
                              key={spec.id}
                              onClick={() => handleToggleSpec(spec.id)}
                              title={spec.description || spec.name}
                              style={{
                                fontSize: 10,
                                padding: "4px 8px",
                                borderRadius: 4,
                                border: "none",
                                cursor: "pointer",
                                background: isEnabled ? colors.bg : "#f3f4f6",
                                color: isEnabled ? colors.text : "#9ca3af",
                                opacity: isEnabled ? 1 : 0.5,
                              }}
                            >
                              {spec.slug}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Playbook Specs */}
                  {availableSpecs.domainSpecs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6, fontWeight: 500 }}>PLAYBOOK</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {availableSpecs.domainSpecs.map((spec) => {
                          const isEnabled = specToggles[spec.id] !== false;
                          const badgeType = getSpecBadgeType(spec);
                          const colors = BADGE_COLORS[badgeType] || { bg: "#f3f4f6", text: "#6b7280" };
                          return (
                            <button
                              key={spec.id}
                              onClick={() => handleToggleSpec(spec.id)}
                              title={spec.description || spec.name}
                              style={{
                                fontSize: 10,
                                padding: "4px 8px",
                                borderRadius: 4,
                                border: "none",
                                cursor: "pointer",
                                background: isEnabled ? colors.bg : "#f3f4f6",
                                color: isEnabled ? colors.text : "#9ca3af",
                                opacity: isEnabled ? 1 : 0.5,
                              }}
                            >
                              {spec.slug}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {availableSpecs.systemSpecs.length === 0 && availableSpecs.domainSpecs.length === 0 && (
                    <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: 12 }}>
                      No specs available
                    </div>
                  )}
                </div>

                {/* Tuning Panel */}
                {selectedPlaybookId && behaviorParams.length > 0 && (
                  <div
                    style={{
                      marginTop: 16,
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
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} title="Modified" />
                      )}
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, color: "#b45309" }}>{behaviorParams.length} params</span>
                    </div>
                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                      {behaviorParams.slice(0, 5).map((param) => (
                        <div key={param.parameterId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #fef3c7" }}>
                          <div style={{ flex: 1, fontSize: 11, color: "#92400e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{param.name}</div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={previewOverrides[param.parameterId] ?? param.effectiveValue}
                            onChange={(e) => setPreviewOverrides((prev) => ({ ...prev, [param.parameterId]: parseInt(e.target.value) }))}
                            style={{ width: 60 }}
                          />
                          <span style={{ fontSize: 10, color: "#b45309", width: 24, textAlign: "right" }}>{previewOverrides[param.parameterId] ?? param.effectiveValue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Output Panel */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* No playbook selected */}
                {!selectedPlaybookId && (
                  <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📚</div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: "#6b7280", margin: "0 0 8px 0" }}>Select a Playbook</h3>
                    <p style={{ fontSize: 14, color: "#9ca3af" }}>Choose a playbook from the control bar above to generate prompts</p>
                  </div>
                )}

                {/* Ready to generate */}
                {selectedPlaybookId && !generatedPrompt && !isGenerating && (
                  <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: "#1f2937", margin: "0 0 8px 0" }}>Ready to Generate</h3>
                    <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>Click Generate in the control bar or below</p>
                    <button
                      onClick={generatePrompt}
                      style={{ padding: "12px 24px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#7c3aed", border: "none", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                      <span>✨</span> Generate Prompt
                    </button>
                  </div>
                )}

                {/* Generating */}
                {isGenerating && (
                  <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }} className="animate-pulse">⟳</div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: "#7c3aed", margin: 0 }}>Generating prompt...</h3>
                  </div>
                )}

                {/* Generated output */}
                {generatedPrompt && !isGenerating && (
                  <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                    {/* Header */}
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 14 }}>✨</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>Generated Prompt</span>
                      <div style={{ flex: 1 }} />
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => setOutputMode("sections")}
                          style={{
                            padding: "4px 10px", fontSize: 11, fontWeight: outputMode === "sections" ? 600 : 400,
                            color: outputMode === "sections" ? "#4f46e5" : "#6b7280",
                            background: outputMode === "sections" ? "#eef2ff" : "transparent",
                            border: "1px solid", borderColor: outputMode === "sections" ? "#c7d2fe" : "#e5e7eb", borderRadius: 4, cursor: "pointer",
                          }}
                        >
                          Sections
                        </button>
                        <button
                          onClick={() => setOutputMode("raw")}
                          style={{
                            padding: "4px 10px", fontSize: 11, fontWeight: outputMode === "raw" ? 600 : 400,
                            color: outputMode === "raw" ? "#4f46e5" : "#6b7280",
                            background: outputMode === "raw" ? "#eef2ff" : "transparent",
                            border: "1px solid", borderColor: outputMode === "raw" ? "#c7d2fe" : "#e5e7eb", borderRadius: 4, cursor: "pointer",
                          }}
                        >
                          Raw
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(outputMode === "raw" ? JSON.stringify(generatedPrompt.llmPrompt, null, 2) : generatedPrompt.prompt);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        style={{ padding: "4px 10px", fontSize: 11, color: copied ? "#059669" : "#6b7280", background: copied ? "#d1fae5" : "#f3f4f6", border: "none", borderRadius: 4, cursor: "pointer" }}
                      >
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>

                    {/* Content */}
                    <div style={{ padding: 16, maxHeight: 500, overflowY: "auto" }}>
                      {outputMode === "raw" ? (
                        <pre style={{ fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, color: "#374151" }}>
                          {JSON.stringify(generatedPrompt.llmPrompt, null, 2)}
                        </pre>
                      ) : (
                        <div style={{ fontSize: 13, lineHeight: 1.6, color: "#374151" }}>
                          {generatedPrompt.llmPrompt?._quickStart && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Quick Start</div>
                              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 12, fontSize: 12 }}>
                                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{JSON.stringify(generatedPrompt.llmPrompt._quickStart, null, 2)}</pre>
                              </div>
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Prompt</div>
                            <div style={{ whiteSpace: "pre-wrap" }}>{generatedPrompt.prompt}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Diff */}
                    {previousPrompt && showDiff && (
                      <div style={{ borderTop: "1px solid #e5e7eb", padding: 16, background: "#fafafa" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>Changes</span>
                          <button onClick={() => setShowDiff(false)} style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>Hide</button>
                        </div>
                        <div style={{ fontSize: 12 }}>
                          {computeDiff(previousPrompt.llmPrompt, generatedPrompt.llmPrompt)
                            .filter((d) => d.status !== "unchanged")
                            .slice(0, 10)
                            .map((diff) => (
                              <div key={diff.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                                <span style={{ fontSize: 10, fontWeight: 600, color: diff.status === "added" ? diffColors.added.text : diff.status === "removed" ? diffColors.removed.text : diffColors.changed.text }}>
                                  {diff.status === "added" ? "+" : diff.status === "removed" ? "-" : "~"}
                                </span>
                                <span style={{ color: "#374151" }}>{diff.key}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                <FancySelect
                  value={selectedPlaybookId}
                  onChange={setSelectedPlaybookId}
                  placeholder="Select a playbook..."
                  style={{ minWidth: 280 }}
                  options={playbooks.filter(p => p.status === "PUBLISHED").map((pb) => ({
                    value: pb.id,
                    label: pb.name,
                    subtitle: pb.domain?.name || "No domain",
                  }))}
                />
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
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ marginBottom: 20, textAlign: "center" }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1f2937", margin: "0 0 8px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span>A/B Compare</span>
              </h2>
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                Compare two different configurations side-by-side for the same caller
              </p>
            </div>

            {/* Caller Selection */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <CallerPicker
                value={selectedCallerId || null}
                onChange={(callerId) => {
                  if (callerId) {
                    handleCallerSelect(callerId);
                    // Reset compare prompts when caller changes
                    setPromptA(null);
                    setPromptB(null);
                  }
                }}
                placeholder="Select a caller to compare..."
                style={{ width: 320 }}
              />
            </div>

            {!selectedCallerId ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>👤</div>
                <p style={{ fontSize: 14, color: "#6b7280" }}>
                  Select a caller above to start comparing configurations
                </p>
              </div>
            ) : (
              <>
                {/* Two-column layout */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                  {/* Config A */}
                  <div
                    style={{
                      background: "#fff",
                      border: `2px solid ${compareColors.configA.border}`,
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ background: compareColors.configA.headerBg, padding: "12px 16px", borderBottom: `1px solid ${entityColors.caller.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <span style={{ fontWeight: 600, color: compareColors.configA.text }}>Config A</span>
                        <FancySelect
                          value={comparePlaybookA}
                          onChange={setComparePlaybookA}
                          placeholder="All playbooks"
                          style={{ flex: 1, maxWidth: 200 }}
                          options={[
                            { value: "", label: "All playbooks (domain default)" },
                            { value: "__none__", label: "No playbook (baseline)" },
                            ...playbooks.filter(p => p.status === "PUBLISHED").map((pb) => ({
                              value: pb.id,
                              label: pb.name,
                              subtitle: pb.domain?.name || "no domain",
                            })),
                          ]}
                        />
                        <button
                          onClick={async () => {
                            if (!selectedCallerId) return;
                            setIsGeneratingA(true);
                            try {
                              const body: any = {};
                              if (comparePlaybookA === "__none__") {
                                body.playbookIds = []; // Empty array = no playbooks
                              } else if (comparePlaybookA) {
                                body.playbookIds = [comparePlaybookA]; // Specific playbook
                              }
                              // If empty string, don't send playbookIds (use all)
                              const res = await fetch(`/api/callers/${selectedCallerId}/compose-prompt`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(body),
                              });
                              const data = await res.json();
                              if (data.ok) {
                                setPromptA(data.prompt);
                              }
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setIsGeneratingA(false);
                            }
                          }}
                          disabled={isGeneratingA}
                          style={{
                            padding: "6px 12px",
                            background: isGeneratingA ? entityColors.caller.border : compareColors.configA.border,
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: isGeneratingA ? "not-allowed" : "pointer",
                          }}
                        >
                          {isGeneratingA ? "..." : "Generate"}
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: 16, minHeight: 300 }}>
                      {isGeneratingA ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#6b7280" }}>
                          Generating...
                        </div>
                      ) : promptA ? (
                        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                          <div style={{ marginBottom: 12, padding: 8, background: compareColors.configA.bg, borderRadius: 6, fontSize: 11, color: compareColors.configA.text }}>
                            {(promptA.inputs as any)?.playbooksUsed?.join(", ") || "No playbooks"} | {(promptA.inputs as any)?.composition?.sectionsActivated?.length || 0} sections
                          </div>
                          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, maxHeight: 400, overflow: "auto" }}>
                            {promptA.prompt}
                          </pre>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#9ca3af", fontSize: 13 }}>
                          Select playbook config and click Generate
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Config B */}
                  <div
                    style={{
                      background: "#fff",
                      border: `2px solid ${compareColors.configB.border}`,
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ background: compareColors.configB.headerBg, padding: "12px 16px", borderBottom: `1px solid ${entityColors.playbook.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <span style={{ fontWeight: 600, color: compareColors.configB.text }}>Config B</span>
                        <FancySelect
                          value={comparePlaybookB}
                          onChange={setComparePlaybookB}
                          placeholder="All playbooks"
                          style={{ flex: 1, maxWidth: 200 }}
                          options={[
                            { value: "", label: "All playbooks (domain default)" },
                            { value: "__none__", label: "No playbook (baseline)" },
                            ...playbooks.filter(p => p.status === "PUBLISHED").map((pb) => ({
                              value: pb.id,
                              label: pb.name,
                              subtitle: pb.domain?.name || "no domain",
                            })),
                          ]}
                        />
                        <button
                          onClick={async () => {
                            if (!selectedCallerId) return;
                            setIsGeneratingB(true);
                            try {
                              const body: any = {};
                              if (comparePlaybookB === "__none__") {
                                body.playbookIds = []; // Empty array = no playbooks
                              } else if (comparePlaybookB) {
                                body.playbookIds = [comparePlaybookB]; // Specific playbook
                              }
                              const res = await fetch(`/api/callers/${selectedCallerId}/compose-prompt`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(body),
                              });
                              const data = await res.json();
                              if (data.ok) {
                                setPromptB(data.prompt);
                              }
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setIsGeneratingB(false);
                            }
                          }}
                          disabled={isGeneratingB}
                          style={{
                            padding: "6px 12px",
                            background: isGeneratingB ? entityColors.playbook.border : compareColors.configB.border,
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: isGeneratingB ? "not-allowed" : "pointer",
                          }}
                        >
                          {isGeneratingB ? "..." : "Generate"}
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: 16, minHeight: 300 }}>
                      {isGeneratingB ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#6b7280" }}>
                          Generating...
                        </div>
                      ) : promptB ? (
                        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                          <div style={{ marginBottom: 12, padding: 8, background: compareColors.configB.bg, borderRadius: 6, fontSize: 11, color: compareColors.configB.text }}>
                            {(promptB.inputs as any)?.playbooksUsed?.join(", ") || "No playbooks"} | {(promptB.inputs as any)?.composition?.sectionsActivated?.length || 0} sections
                          </div>
                          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, maxHeight: 400, overflow: "auto" }}>
                            {promptB.prompt}
                          </pre>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#9ca3af", fontSize: 13 }}>
                          Select playbook config and click Generate
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Generate Both button */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                  <button
                    onClick={async () => {
                      if (!selectedCallerId) return;
                      setIsGeneratingA(true);
                      setIsGeneratingB(true);
                      try {
                        const bodyA: any = {};
                        if (comparePlaybookA === "__none__") bodyA.playbookIds = [];
                        else if (comparePlaybookA) bodyA.playbookIds = [comparePlaybookA];

                        const bodyB: any = {};
                        if (comparePlaybookB === "__none__") bodyB.playbookIds = [];
                        else if (comparePlaybookB) bodyB.playbookIds = [comparePlaybookB];

                        const [resA, resB] = await Promise.all([
                          fetch(`/api/callers/${selectedCallerId}/compose-prompt`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(bodyA),
                          }),
                          fetch(`/api/callers/${selectedCallerId}/compose-prompt`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(bodyB),
                          }),
                        ]);
                        const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);
                        if (dataA.ok) setPromptA(dataA.prompt);
                        if (dataB.ok) setPromptB(dataB.prompt);
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setIsGeneratingA(false);
                        setIsGeneratingB(false);
                      }
                    }}
                    disabled={isGeneratingA || isGeneratingB}
                    style={{
                      padding: "10px 24px",
                      background: (isGeneratingA || isGeneratingB) ? "#d1d5db" : "#1f2937",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: (isGeneratingA || isGeneratingB) ? "not-allowed" : "pointer",
                    }}
                  >
                    {(isGeneratingA || isGeneratingB) ? "Generating..." : "Generate Both"}
                  </button>
                </div>

                {/* Diff View */}
                {promptA && promptB && (
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                    {(() => {
                      const diffResult = computeDiff(promptA.llmPrompt, promptB.llmPrompt);
                      const changes = diffResult.filter(d => d.status !== "unchanged");
                      const allExpanded = changes.length > 0 && changes.every(d => expandedDiffs.has(d.key));
                      return (
                        <>
                          <div style={{ background: "#f9fafb", padding: "12px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 600, color: "#374151" }}>Differences</span>
                            {changes.length > 0 && (
                              <button
                                onClick={() => {
                                  if (allExpanded) {
                                    setExpandedDiffs(new Set());
                                  } else {
                                    setExpandedDiffs(new Set(changes.map(d => d.key)));
                                  }
                                }}
                                style={{
                                  padding: "4px 10px",
                                  fontSize: 12,
                                  background: "#fff",
                                  border: "1px solid #d1d5db",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  color: "#374151",
                                }}
                              >
                                {allExpanded ? "Collapse All" : "Expand All"}
                              </button>
                            )}
                          </div>
                          <div style={{ padding: 16 }}>
                            {changes.length === 0 ? (
                              <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>
                                No differences found between Config A and Config B
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {changes.map((d) => {
                                  const isExpanded = expandedDiffs.has(d.key);
                                  const aStr = typeof d.previous === "object" ? JSON.stringify(d.previous, null, 2) : String(d.previous ?? "");
                                  const bStr = typeof d.current === "object" ? JSON.stringify(d.current, null, 2) : String(d.current ?? "");
                                  return (
                                    <div
                                      key={d.key}
                                      style={{
                                        padding: "10px 14px",
                                        borderRadius: 8,
                                        background:
                                          d.status === "added" ? diffColors.added.bg :
                                          d.status === "removed" ? diffColors.removed.bg :
                                          diffColors.changed.bg,
                                        border: `1px solid ${
                                          d.status === "added" ? diffColors.added.border :
                                          d.status === "removed" ? diffColors.removed.border :
                                          diffColors.changed.border
                                        }`,
                                      }}
                                    >
                                      <div
                                        onClick={() => {
                                          setExpandedDiffs(prev => {
                                            const next = new Set(prev);
                                            if (next.has(d.key)) {
                                              next.delete(d.key);
                                            } else {
                                              next.add(d.key);
                                            }
                                            return next;
                                          });
                                        }}
                                        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, cursor: "pointer" }}
                                      >
                                        <span style={{ fontSize: 11, color: "#6b7280", width: 12 }}>{isExpanded ? "▼" : "▶"}</span>
                                        <span style={{
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color:
                                            d.status === "added" ? diffColors.added.text :
                                            d.status === "removed" ? diffColors.removed.text :
                                            diffColors.changed.text,
                                        }}>
                                          {d.status === "added" ? "+ ADDED" : d.status === "removed" ? "- REMOVED" : "~ CHANGED"}
                                        </span>
                                        <code style={{ fontSize: 12, color: "#374151" }}>{d.key}</code>
                                      </div>
                                      <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>
                                        {isExpanded ? (
                                          <div style={{ marginTop: 8 }}>
                                            {(d.status === "changed" || d.status === "removed") && (
                                              <div style={{ marginBottom: 8 }}>
                                                <div style={{ fontSize: 10, fontWeight: 600, color: diffColors.removed.text, marginBottom: 4 }}>A:</div>
                                                <pre style={{
                                                  margin: 0,
                                                  padding: 8,
                                                  background: "rgba(239,68,68,0.1)",
                                                  borderRadius: 4,
                                                  whiteSpace: "pre-wrap",
                                                  wordBreak: "break-word",
                                                  color: diffColors.removed.text,
                                                  maxHeight: 300,
                                                  overflow: "auto",
                                                }}>{aStr}</pre>
                                              </div>
                                            )}
                                            {(d.status === "changed" || d.status === "added") && (
                                              <div>
                                                <div style={{ fontSize: 10, fontWeight: 600, color: diffColors.added.text, marginBottom: 4 }}>B:</div>
                                                <pre style={{
                                                  margin: 0,
                                                  padding: 8,
                                                  background: "rgba(34,197,94,0.1)",
                                                  borderRadius: 4,
                                                  whiteSpace: "pre-wrap",
                                                  wordBreak: "break-word",
                                                  color: diffColors.added.text,
                                                  maxHeight: 300,
                                                  overflow: "auto",
                                                }}>{bStr}</pre>
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          d.status === "changed" ? (() => {
                                            const snippets = getDiffSnippets(aStr, bStr);
                                            return (
                                              <>
                                                <div style={{ color: diffColors.removed.text }}>A: {snippets.a}</div>
                                                <div style={{ color: diffColors.added.text }}>B: {snippets.b}</div>
                                              </>
                                            );
                                          })() : d.status === "removed" ? (
                                            <div style={{ color: diffColors.removed.text }}>
                                              A: {aStr.slice(0, 120)}{aStr.length > 120 ? "..." : ""}
                                            </div>
                                          ) : (
                                            <div style={{ color: diffColors.added.text }}>
                                              B: {bStr.slice(0, 120)}{bStr.length > 120 ? "..." : ""}
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Info box */}
                <div
                  style={{
                    marginTop: 20,
                    padding: 16,
                    background: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#0369a1",
                  }}
                >
                  <strong>Tip:</strong> Select different playbook configurations for A and B to compare how they affect the prompt.
                  Choose "No playbook" to see the baseline system prompt without any playbook specs applied.
                </div>
              </>
            )}
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
                <FancySelect
                  value={newCallerDomainId}
                  onChange={setNewCallerDomainId}
                  placeholder="No domain"
                  options={[
                    { value: "", label: "No domain" },
                    ...domains.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                />
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
                <FancySelect
                  value={newPlaybookDomainId}
                  onChange={setNewPlaybookDomainId}
                  placeholder="Select domain..."
                  options={domains.map((d) => ({ value: d.id, label: d.name }))}
                />
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
