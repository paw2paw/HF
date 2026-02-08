"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FancySelect, FancySelectOption } from "@/components/shared/FancySelect";
import { AIConfigButton } from "@/components/shared/AIConfigButton";

// ============================================================================
// Types (matching JsonFeatureSpec from ai-parser.ts)
// ============================================================================

interface JsonParameter {
  id: string;
  name: string;
  description: string;
  section?: string;
  isAdjustable?: boolean;
  targetRange?: { min: number; max: number };
  scoringAnchors?: { score: number; example: string; rationale?: string; isGold?: boolean }[];
  promptGuidance?: { whenHigh?: string; whenLow?: string };
}

interface JsonAcceptanceCriterion {
  id: string;
  title: string;
  given: string;
  when: string;
  then: string;
}

interface JsonConstraint {
  id: string;
  type?: string;
  description: string;
  severity?: "critical" | "warning" | "info";
}

interface SpecFormData {
  id: string;
  title: string;
  version: string;
  status: "Draft" | "Review" | "Approved" | "Deprecated";
  domain: string;
  specType: "SYSTEM" | "DOMAIN" | "ADAPT" | "SUPERVISE";
  specRole: "IDENTITY" | "CONTENT" | "VOICE" | "MEASURE" | "ADAPT" | "REWARD" | "GUARDRAIL" | "";
  outputType: "MEASURE" | "LEARN" | "ADAPT" | "COMPOSE" | "AGGREGATE" | "REWARD" | "";
  story: {
    asA: string;
    iWant: string;
    soThat: string;
  };
  parameters: JsonParameter[];
  acceptanceCriteria: JsonAcceptanceCriterion[];
  constraints: JsonConstraint[];
  context: {
    applies?: string;
    dependsOn?: string[];
    assumptions?: string[];
  };
}

type ExistingSpec = {
  id: string;
  featureId: string;
  name: string;
  specType: string;
  domain: string | null;
};

// ============================================================================
// Constants
// ============================================================================

const DRAFT_KEY = "hf.spec.draft";

const STATUS_OPTIONS: FancySelectOption[] = [
  { value: "Draft", label: "Draft", subtitle: "Work in progress" },
  { value: "Review", label: "Review", subtitle: "Ready for review" },
  { value: "Approved", label: "Approved", subtitle: "Production ready" },
  { value: "Deprecated", label: "Deprecated", subtitle: "No longer used" },
];

const SPEC_TYPE_OPTIONS: FancySelectOption[] = [
  { value: "DOMAIN", label: "DOMAIN", subtitle: "Domain-specific behavior" },
  { value: "SYSTEM", label: "SYSTEM", subtitle: "System-wide behavior" },
  { value: "ADAPT", label: "ADAPT", subtitle: "Adaptive behavior" },
  { value: "SUPERVISE", label: "SUPERVISE", subtitle: "Supervision spec" },
];

const SPEC_ROLE_OPTIONS: FancySelectOption[] = [
  { value: "", label: "None", subtitle: "No specific role" },
  { value: "IDENTITY", label: "IDENTITY", subtitle: "Who the agent is" },
  { value: "CONTENT", label: "CONTENT", subtitle: "Domain knowledge" },
  { value: "META", label: "META", subtitle: "Meta-level behavior" },
];

const OUTPUT_TYPE_OPTIONS: FancySelectOption[] = [
  { value: "MEASURE", label: "MEASURE", subtitle: "Measures parameters" },
  { value: "LEARN", label: "LEARN", subtitle: "Extracts information" },
  { value: "ADAPT", label: "ADAPT", subtitle: "Adapts behavior" },
  { value: "COMPOSE", label: "COMPOSE", subtitle: "Composes prompts" },
  { value: "AGGREGATE", label: "AGGREGATE", subtitle: "Aggregates data" },
  { value: "REWARD", label: "REWARD", subtitle: "Computes rewards" },
];

const defaultFormData: SpecFormData = {
  id: "",
  title: "",
  version: "1.0",
  status: "Draft",
  domain: "",
  specType: "DOMAIN",
  specRole: "",
  outputType: "MEASURE",
  story: { asA: "", iWant: "", soThat: "" },
  parameters: [],
  acceptanceCriteria: [],
  constraints: [],
  context: {},
};

// ============================================================================
// Main Component
// ============================================================================

export default function CreateSpecPage() {
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState<SpecFormData>(defaultFormData);
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Copy from existing
  const [existingSpecs, setExistingSpecs] = useState<ExistingSpec[]>([]);
  const [loadingSpecs, setLoadingSpecs] = useState(false);

  // AI Assistant
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Submission
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft restore prompt
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [savedDraft, setSavedDraft] = useState<SpecFormData | null>(null);

  // Load existing specs for copy dropdown
  useEffect(() => {
    setLoadingSpecs(true);
    fetch("/api/lab/features")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.features) {
          setExistingSpecs(
            data.features.map((f: ExistingSpec & { id: string }) => ({
              id: f.id,
              featureId: f.featureId,
              name: f.name,
              specType: f.specType,
              domain: f.domain,
            }))
          );
        }
      })
      .catch(console.error)
      .finally(() => setLoadingSpecs(false));
  }, []);

  // Check for saved draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setSavedDraft(draft);
        setShowDraftPrompt(true);
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, []);

  // Auto-save draft on changes (debounced)
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData, isDirty]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Form update helper
  const updateForm = useCallback((updates: Partial<SpecFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
  }, []);

  const updateStory = useCallback((field: keyof SpecFormData["story"], value: string) => {
    setFormData((prev) => ({
      ...prev,
      story: { ...prev.story, [field]: value },
    }));
    setIsDirty(true);
  }, []);

  // Copy from existing spec
  const handleCopyFrom = useCallback(async (featureId: string) => {
    if (!featureId) return;

    try {
      const res = await fetch(`/api/lab/features/${featureId}`);
      const data = await res.json();

      if (data.ok && data.feature?.rawSpec) {
        const rawSpec = data.feature.rawSpec;
        setFormData({
          id: "", // Clear ID so user must provide new one
          title: `Copy of ${rawSpec.title || data.feature.name}`,
          version: "1.0",
          status: "Draft",
          domain: rawSpec.domain || "",
          specType: rawSpec.specType || "DOMAIN",
          specRole: rawSpec.specRole || "",
          outputType: rawSpec.outputType || "MEASURE",
          story: rawSpec.story || { asA: "", iWant: "", soThat: "" },
          parameters: rawSpec.parameters || [],
          acceptanceCriteria: rawSpec.acceptanceCriteria || [],
          constraints: rawSpec.constraints || [],
          context: rawSpec.context || {},
        });
        setIsDirty(true);
      }
    } catch (e) {
      console.error("Failed to copy spec:", e);
    }
  }, []);

  // Restore draft
  const handleRestoreDraft = useCallback(() => {
    if (savedDraft) {
      setFormData(savedDraft);
      setIsDirty(true);
    }
    setShowDraftPrompt(false);
  }, [savedDraft]);

  const handleDiscardDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setShowDraftPrompt(false);
  }, []);

  // Validation
  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.id.trim()) {
      errors.id = "ID is required (e.g., PERS-001)";
    } else if (!/^[A-Z]+-[A-Z]*-?[0-9]+$/.test(formData.id)) {
      errors.id = "ID must match pattern like PERS-001 or COMP-IE-001";
    }

    if (!formData.title.trim()) {
      errors.title = "Title is required";
    }

    if (!formData.story.asA.trim()) {
      errors["story.asA"] = "As a... is required";
    }
    if (!formData.story.iWant.trim()) {
      errors["story.iWant"] = "I want... is required";
    }
    if (!formData.story.soThat.trim()) {
      errors["story.soThat"] = "So that... is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Create spec
  const handleCreate = useCallback(async () => {
    if (!validate()) {
      setError("Please fix validation errors before creating");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/specs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spec: formData,
          autoActivate: true,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        localStorage.removeItem(DRAFT_KEY);
        router.push(`/x/specs?id=${data.specId}`);
      } else {
        setError(data.error || "Failed to create spec");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create spec");
    } finally {
      setCreating(false);
    }
  }, [formData, validate, router]);

  // AI Chat
  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/specs/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          currentSpec: formData,
          history: chatMessages,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.response }]);

        // If AI provided suggestions, we could auto-apply them here
        if (data.suggestions) {
          // TODO: Parse and apply suggestions
        }
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${data.error || "Failed to get response"}` },
        ]);
      }
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Unknown error"}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, formData, chatMessages]);

  // Parameter management
  const addParameter = useCallback(() => {
    const newParam: JsonParameter = {
      id: `param-${Date.now()}`,
      name: "",
      description: "",
      isAdjustable: true,
      targetRange: { min: 0, max: 1 },
      scoringAnchors: [],
    };
    setFormData((prev) => ({
      ...prev,
      parameters: [...prev.parameters, newParam],
    }));
    setIsDirty(true);
  }, []);

  const updateParameter = useCallback((index: number, updates: Partial<JsonParameter>) => {
    setFormData((prev) => ({
      ...prev,
      parameters: prev.parameters.map((p, i) => (i === index ? { ...p, ...updates } : p)),
    }));
    setIsDirty(true);
  }, []);

  const removeParameter = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index),
    }));
    setIsDirty(true);
  }, []);

  // Build copy options
  const copyOptions: FancySelectOption[] = [
    { value: "", label: "Start from scratch" },
    ...existingSpecs.map((s) => ({
      value: s.id,
      label: s.name,
      subtitle: `${s.featureId} - ${s.specType}`,
      badge: s.domain || undefined,
    })),
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div>
      {/* Draft Restore Modal */}
      {showDraftPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-neutral-200 dark:border-neutral-700">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📝</span>
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Restore Draft?
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                You have a saved draft from a previous session. Would you like to restore it?
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleDiscardDraft}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleRestoreDraft}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  Restore Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/x/specs"
              className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span>✨</span>
                Create New Spec
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Define a new behavior specification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Copy from:</span>
            <div className="w-72">
              <FancySelect
                value=""
                onChange={handleCopyFrom}
                options={copyOptions}
                placeholder={loadingSpecs ? "Loading..." : "Start from scratch"}
                disabled={loadingSpecs}
              />
            </div>
            <Link
              href="/x/admin/spec-sync"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Specs
            </Link>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-red-500">⚠️</span>
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Two-Panel Layout */}
      <div className="flex gap-6" style={{ minHeight: "calc(100vh - 220px)" }}>
        {/* Form Panel */}
        <div className="flex-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
          <div className="p-6 space-y-8 overflow-y-auto max-h-[calc(100vh-220px)]">
            {/* Step 1: Basics */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                  1
                </div>
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Basic Information
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => updateForm({ id: e.target.value.toUpperCase() })}
                    placeholder="e.g., PERS-001"
                    className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 ${
                      validationErrors.id
                        ? "border-red-300 dark:border-red-700 focus:ring-red-500"
                        : "border-neutral-300 dark:border-neutral-600 focus:ring-indigo-500"
                    } focus:outline-none focus:ring-2 focus:ring-offset-0`}
                  />
                  {validationErrors.id && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.id}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => updateForm({ title: e.target.value })}
                    placeholder="e.g., Personality Measurement"
                    className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 ${
                      validationErrors.title
                        ? "border-red-300 dark:border-red-700 focus:ring-red-500"
                        : "border-neutral-300 dark:border-neutral-600 focus:ring-indigo-500"
                    } focus:outline-none focus:ring-2 focus:ring-offset-0`}
                  />
                  {validationErrors.title && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.title}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Version
                  </label>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => updateForm({ version: e.target.value })}
                    placeholder="1.0"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Status
                  </label>
                  <FancySelect
                    value={formData.status}
                    onChange={(v) => updateForm({ status: v as SpecFormData["status"] })}
                    options={STATUS_OPTIONS}
                    searchable={false}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Domain
                  </label>
                  <input
                    type="text"
                    value={formData.domain}
                    onChange={(e) => updateForm({ domain: e.target.value })}
                    placeholder="e.g., personality, memory, engagement"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                </div>
              </div>
            </section>

            {/* Step 2: Classification */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                  2
                </div>
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Classification
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Spec Type
                  </label>
                  <FancySelect
                    value={formData.specType}
                    onChange={(v) => updateForm({ specType: v as SpecFormData["specType"] })}
                    options={SPEC_TYPE_OPTIONS}
                    searchable={false}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Spec Role
                  </label>
                  <FancySelect
                    value={formData.specRole}
                    onChange={(v) => updateForm({ specRole: v as SpecFormData["specRole"] })}
                    options={SPEC_ROLE_OPTIONS}
                    searchable={false}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Output Type
                  </label>
                  <FancySelect
                    value={formData.outputType}
                    onChange={(v) => updateForm({ outputType: v as SpecFormData["outputType"] })}
                    options={OUTPUT_TYPE_OPTIONS}
                    searchable={false}
                  />
                </div>
              </div>
            </section>

            {/* Step 3: User Story */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                  3
                </div>
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  User Story
                </h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    As a... <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.story.asA}
                    onChange={(e) => updateStory("asA", e.target.value)}
                    placeholder="e.g., conversational AI system"
                    rows={2}
                    className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 resize-y ${
                      validationErrors["story.asA"]
                        ? "border-red-300 dark:border-red-700"
                        : "border-neutral-300 dark:border-neutral-600"
                    } focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0`}
                  />
                  {validationErrors["story.asA"] && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors["story.asA"]}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    I want... <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.story.iWant}
                    onChange={(e) => updateStory("iWant", e.target.value)}
                    placeholder="e.g., to measure and adapt to the caller's personality traits"
                    rows={2}
                    className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 resize-y ${
                      validationErrors["story.iWant"]
                        ? "border-red-300 dark:border-red-700"
                        : "border-neutral-300 dark:border-neutral-600"
                    } focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0`}
                  />
                  {validationErrors["story.iWant"] && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors["story.iWant"]}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    So that... <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.story.soThat}
                    onChange={(e) => updateStory("soThat", e.target.value)}
                    placeholder="e.g., I can provide a more personalized and engaging experience"
                    rows={2}
                    className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 resize-y ${
                      validationErrors["story.soThat"]
                        ? "border-red-300 dark:border-red-700"
                        : "border-neutral-300 dark:border-neutral-600"
                    } focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0`}
                  />
                  {validationErrors["story.soThat"] && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors["story.soThat"]}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Step 4: Parameters */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                    4
                  </div>
                  <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Parameters
                  </h2>
                </div>
                <button
                  onClick={addParameter}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Parameter
                </button>
              </div>

              {formData.parameters.length === 0 ? (
                <div className="p-8 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 text-center">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">📊</span>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">No parameters yet</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500">
                    Parameters define what this spec measures or tracks
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.parameters.map((param, index) => (
                    <div
                      key={param.id}
                      className="bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                            {index + 1}
                          </span>
                          Parameter
                        </span>
                        <button
                          onClick={() => removeParameter(index)}
                          className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                            ID
                          </label>
                          <input
                            type="text"
                            value={param.id}
                            onChange={(e) => updateParameter(index, { id: e.target.value })}
                            placeholder="e.g., openness"
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                            Name
                          </label>
                          <input
                            type="text"
                            value={param.name}
                            onChange={(e) => updateParameter(index, { name: e.target.value })}
                            placeholder="e.g., Openness to Experience"
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                            Description
                          </label>
                          <textarea
                            value={param.description}
                            onChange={(e) => updateParameter(index, { description: e.target.value })}
                            placeholder="What does this parameter measure?"
                            rows={2}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                            Target Min
                          </label>
                          <input
                            type="number"
                            value={param.targetRange?.min ?? 0}
                            onChange={(e) =>
                              updateParameter(index, {
                                targetRange: { ...param.targetRange!, min: parseFloat(e.target.value) || 0 },
                              })
                            }
                            step="0.1"
                            min="0"
                            max="1"
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                            Target Max
                          </label>
                          <input
                            type="number"
                            value={param.targetRange?.max ?? 1}
                            onChange={(e) =>
                              updateParameter(index, {
                                targetRange: { ...param.targetRange!, max: parseFloat(e.target.value) || 1 },
                              })
                            }
                            step="0.1"
                            min="0"
                            max="1"
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Step 5: Review */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                  5
                </div>
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Review JSON
                </h2>
              </div>
              <div className="bg-neutral-900 dark:bg-black rounded-xl p-4 max-h-72 overflow-auto">
                <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap">
                  {JSON.stringify(formData, null, 2)}
                </pre>
              </div>
            </section>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex items-center justify-between">
            <div>
              {isDirty && (
                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved changes (auto-saved as draft)
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Link
                href="/x/specs"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
              >
                Cancel
              </Link>
              <button
                onClick={handleCreate}
                disabled={creating}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                  creating
                    ? "bg-neutral-300 dark:bg-neutral-600 text-neutral-500 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  "Create & Activate"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* AI Assistant Panel */}
        <div className="w-96 flex-shrink-0 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl flex flex-col sticky top-4" style={{ maxHeight: "calc(100vh - 220px)" }}>
          {/* Header */}
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white text-sm">🤖</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">AI Assistant</span>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Help building specs</p>
              </div>
            </div>
            <AIConfigButton callPoint="spec.assistant" label="Config" inline />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-4">
                  <span className="text-3xl">💬</span>
                </div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Describe your spec
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Tell me what behavior you want to measure or track, and I&apos;ll help you fill in the fields.
                </p>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] p-3 rounded-xl text-sm ${
                    msg.role === "user"
                      ? "ml-auto bg-indigo-600 text-white"
                      : "bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
                  }`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {msg.content}
                </div>
              ))
            )}
            {chatLoading && (
              <div className="max-w-[85%] p-3 rounded-xl bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 text-sm flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-neutral-300 dark:border-neutral-500 border-t-neutral-600 dark:border-t-neutral-300 rounded-full animate-spin" />
                Thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-neutral-200 dark:border-neutral-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                placeholder="Ask for help..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
              />
              <button
                onClick={handleSendChat}
                disabled={chatLoading || !chatInput.trim()}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  chatLoading || !chatInput.trim()
                    ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-400 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
