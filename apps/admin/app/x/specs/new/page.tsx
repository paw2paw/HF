"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Upload, RefreshCw, X, ArrowRight, Plus } from "lucide-react";
import { FancySelect, FancySelectOption } from "@/components/shared/FancySelect";
import { AIConfigButton } from "@/components/shared/AIConfigButton";
import { FlashSidebar } from "@/components/shared/FlashSidebar";
import { AIModelBadge } from "@/components/shared/AIModelBadge";

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
  learningOutcomes?: string[];
}

interface CurriculumMetadata {
  type: string;
  trackingMode: string;
  moduleSelector: string;
  moduleOrder: string;
  progressKey: string;
  masteryThreshold: number;
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
  metadata?: {
    curriculum?: CurriculumMetadata;
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
  { value: "MEASURE", label: "MEASURE", subtitle: "Behavioral measurement" },
  { value: "ADAPT", label: "ADAPT", subtitle: "Behavior adaptation" },
  { value: "REWARD", label: "REWARD", subtitle: "Reward computation" },
  { value: "GUARDRAIL", label: "GUARDRAIL", subtitle: "Safety constraints" },
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
// Styled Components
// ============================================================================

const StepBadge = ({ number, active = true }: { number: number; active?: boolean }) => (
  <div className={`hf-step-badge ${active ? "hf-step-badge-active" : "hf-step-badge-inactive"}`}>
    {number}
  </div>
);

const InputField = ({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) => (
  <div>
    <label className="hf-label hf-mb-sm" style={{ letterSpacing: "0.02em" }}>
      {label}
      {required && <span className="hf-text-error" style={{ marginLeft: 4 }}>*</span>}
    </label>
    {children}
    {error && (
      <p className="hf-text-error" style={{ marginTop: 6, fontSize: 12 }}>{error}</p>
    )}
  </div>
);

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

  // Active step tracking
  const [activeStep, setActiveStep] = useState(1);

  // Track AI-updated fields for visual feedback
  const [aiUpdatedFields, setAiUpdatedFields] = useState<Set<string>>(new Set());
  const aiUpdateTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [showAiUpdateNotification, setShowAiUpdateNotification] = useState(false);

  // Task tracking & flash sidebar
  const [taskId, setTaskId] = useState<string | null>(null);
  const [showFlashSidebar, setShowFlashSidebar] = useState(false);

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

  // Start task tracking on mount (non-blocking - spec creation works without it)
  useEffect(() => {
    async function startTask() {
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskType: "create_spec",
            context: { page: "spec_creation" },
          }),
        });
        if (!res.ok) return; // Task tracking unavailable, continue without it
        const data = await res.json();
        if (data.ok && data.taskId) {
          setTaskId(data.taskId);
        }
      } catch {
        // Task tracking is optional - spec creation works without it
      }
    }
    startTask();
  }, []);

  // Update task progress when activeStep changes
  useEffect(() => {
    if (!taskId) return;

    async function updateTask() {
      try {
        await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            updates: { currentStep: activeStep },
          }),
        });
      } catch (error) {
        console.error("Failed to update task progress:", error);
      }
    }
    updateTask();
  }, [activeStep, taskId]);

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
          id: "",
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

    // CONTENT spec curriculum validation
    if (formData.specRole === "CONTENT") {
      const meta = formData.metadata?.curriculum;
      if (!meta) {
        errors.curriculum = "Curriculum configuration is required for CONTENT specs";
      } else {
        if (!meta.type) errors["curriculum.type"] = "Curriculum type is required";
        if (meta.masteryThreshold < 0 || meta.masteryThreshold > 1) {
          errors["curriculum.threshold"] = "Mastery threshold must be 0–1";
        }
      }
      // Check at least one module parameter exists
      const selectorValue = meta?.moduleSelector?.split("=")?.[1] || "content";
      const moduleParams = formData.parameters.filter(p => p.section === selectorValue);
      if (formData.parameters.length > 0 && moduleParams.length === 0) {
        errors.modules = `No parameters have section="${selectorValue}" — they won't be recognized as modules`;
      }
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

        // Mark task as complete
        if (taskId) {
          try {
            await fetch(`/api/tasks?taskId=${taskId}`, { method: "DELETE" });
          } catch (error) {
            console.error("Failed to complete task:", error);
          }
        }

        router.push(`/x/specs?id=${data.specId}`);
      } else {
        setError(data.error || "Failed to create spec");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create spec");
    } finally {
      setCreating(false);
    }
  }, [formData, validate, router, taskId]);

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

        // Auto-apply field updates if present
        if (data.fieldUpdates) {
          const updatedFieldsList = new Set<string>();

          setFormData((prev) => {
            const updated = { ...prev };

            // Apply top-level fields
            Object.keys(data.fieldUpdates).forEach((key) => {
              updatedFieldsList.add(key);
              if (key === "story" && typeof data.fieldUpdates.story === "object") {
                updated.story = { ...prev.story, ...data.fieldUpdates.story };
                Object.keys(data.fieldUpdates.story).forEach(k => updatedFieldsList.add(`story.${k}`));
              } else if (key === "parameters" && Array.isArray(data.fieldUpdates.parameters)) {
                updated.parameters = data.fieldUpdates.parameters;
              } else if (key === "acceptanceCriteria" && Array.isArray(data.fieldUpdates.acceptanceCriteria)) {
                updated.acceptanceCriteria = data.fieldUpdates.acceptanceCriteria;
              } else if (key === "constraints" && Array.isArray(data.fieldUpdates.constraints)) {
                updated.constraints = data.fieldUpdates.constraints;
              } else if (key === "context" && typeof data.fieldUpdates.context === "object") {
                updated.context = { ...prev.context, ...data.fieldUpdates.context };
              } else if (key !== "story" && key !== "parameters" && key !== "acceptanceCriteria" && key !== "constraints" && key !== "context") {
                (updated as any)[key] = data.fieldUpdates[key];
              }
            });

            return updated;
          });
          setIsDirty(true);

          // Show visual feedback for updated fields
          setAiUpdatedFields(updatedFieldsList);
          setShowAiUpdateNotification(true);

          // Clear the highlight after 3 seconds
          if (aiUpdateTimeoutRef.current) {
            clearTimeout(aiUpdateTimeoutRef.current);
          }
          aiUpdateTimeoutRef.current = setTimeout(() => {
            setAiUpdatedFields(new Set());
            setShowAiUpdateNotification(false);
          }, 3000);
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
    const isContent = formData.specRole === "CONTENT";
    const newParam: JsonParameter = {
      id: isContent ? `MOD-${formData.parameters.length + 1}` : `PARAM-${formData.parameters.length + 1}`,
      name: "",
      description: "",
      section: isContent ? "content" : undefined,
      isAdjustable: !isContent,
      targetRange: isContent ? undefined : { min: 0, max: 1 },
      scoringAnchors: [],
      learningOutcomes: isContent ? [] : undefined,
    };
    setFormData((prev) => ({
      ...prev,
      parameters: [...prev.parameters, newParam],
    }));
    setIsDirty(true);
  }, [formData.parameters.length]);

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

  // Input class helper — returns className + optional inline style for dynamic states
  const getInputClassName = (fieldName: string, hasError?: boolean): string => {
    const base = "hf-input";
    if (hasError) return `${base} hf-input-error`;
    if (aiUpdatedFields.has(fieldName)) return `${base} hf-input-ai-updated`;
    return base;
  };

  const getInputDynamicStyle = (fieldName: string, hasError?: boolean): React.CSSProperties | undefined => {
    if (hasError) {
      return {
        borderColor: "var(--error-text)",
        boxShadow: "0 0 0 3px var(--error-bg)",
      };
    }
    if (aiUpdatedFields.has(fieldName)) {
      return {
        borderColor: "var(--accent-primary)",
        boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent)",
        animation: "aiGlow 0.5s ease-in-out",
      };
    }
    return undefined;
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Flash Sidebar for Task Guidance */}
      <FlashSidebar
        taskId={taskId || undefined}
        visible={showFlashSidebar}
        onClose={() => setShowFlashSidebar(false)}
      />

      {/* AI Update Notification */}
      {showAiUpdateNotification && (
        <div className="hf-toast hf-toast-ai">
          <span style={{ fontSize: 20 }}>✨</span>
          <span>AI filled in {aiUpdatedFields.size} field{aiUpdatedFields.size !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Draft Restore Modal */}
      {showDraftPrompt && (
        <div className="hf-modal-overlay hf-modal-overlay-dark" style={{ backdropFilter: "blur(4px)" }}>
          <div className="hf-modal hf-modal-lg">
            <div className="hf-text-center">
              <div
                className="hf-modal-icon"
                style={{ background: "linear-gradient(135deg, var(--status-warning-accent, #fbbf24) 0%, var(--status-warning-text, #f59e0b) 100%)" }}
              >
                📝
              </div>
              <h3 className="hf-text-primary hf-mb-sm" style={{ fontSize: 20, fontWeight: 700 }}>
                Restore Draft?
              </h3>
              <p className="hf-text-md hf-text-muted" style={{ marginBottom: 24, lineHeight: 1.5 }}>
                You have a saved draft from a previous session. Would you like to continue where you left off?
              </p>
              <div className="hf-flex-center hf-gap-md">
                <button onClick={handleDiscardDraft} className="hf-btn hf-btn-secondary">
                  Discard
                </button>
                <button onClick={handleRestoreDraft} className="hf-btn-gradient-primary">
                  Restore Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--surface-primary) 0%, var(--surface-secondary) 100%)",
          borderBottom: "1px solid var(--border-default)",
          padding: "20px 0",
        }}
        className="hf-mb-lg"
      >
        <div className="hf-flex-between hf-flex-wrap hf-gap-lg">
          <div className="hf-flex hf-gap-lg">
            <Link href="/x/specs" className="hf-back-btn">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="hf-page-title hf-flex hf-gap-sm" style={{ gap: 10 }}>
                <span style={{ fontSize: 28 }}>✨</span>
                Create New Spec
              </h1>
              <p className="hf-text-md hf-text-muted hf-mt-xs" style={{ marginBottom: 0 }}>
                Define a new behavior specification for your AI system
              </p>
            </div>
          </div>
          <div className="hf-flex hf-gap-md">
            <div style={{ minWidth: 240 }}>
              <FancySelect
                value=""
                onChange={handleCopyFrom}
                options={copyOptions}
                placeholder={loadingSpecs ? "Loading..." : "Clone existing spec..."}
                disabled={loadingSpecs}
              />
            </div>
            <Link href="/x/import?tab=specs" className="hf-link-btn hf-link-btn-accent">
              <Upload size={16} />
              Import
            </Link>
            <Link href="/x/admin/spec-sync" className="hf-link-btn hf-link-btn-warning">
              <RefreshCw size={16} />
              Sync
            </Link>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="hf-banner hf-banner-error hf-mb-lg" style={{ justifyContent: "space-between" }}>
          <div className="hf-flex hf-gap-md">
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span className="hf-text-md hf-text-500">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="hf-p-xs"
            style={{ background: "none", border: "none", color: "var(--status-error-text)", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* AI Assistant - Large Top Section */}
      <div
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent-secondary, #8b5cf6) 5%, transparent) 0%, color-mix(in srgb, var(--badge-indigo-text, #6366f1) 5%, transparent) 100%)",
          border: "2px solid",
          borderColor: chatMessages.length > 0 ? "var(--accent-primary)" : "var(--border-default)",
          borderRadius: 20,
          overflow: "hidden",
          marginBottom: 32,
          transition: "all 0.3s ease",
        }}
      >
        {/* AI Header */}
        <div
          className="hf-flex-between"
          style={{
            background: "var(--surface-primary)",
            borderBottom: "1px solid var(--border-default)",
            padding: 20,
          }}
        >
          <div className="hf-flex hf-gap-lg">
            <div className="hf-ai-avatar">
              🤖
            </div>
            <div>
              <h2 className="hf-ai-title">
                AI Spec Builder
              </h2>
              <p className="hf-text-md hf-text-muted hf-mt-xs" style={{ marginBottom: 0 }}>
                Describe what you want to measure, and I&apos;ll build the spec for you
              </p>
              <div className="hf-mt-sm">
                <AIModelBadge callPoint="spec.assistant" variant="text" size="sm" />
              </div>
            </div>
          </div>
          <div className="hf-flex hf-gap-sm">
            {taskId && (
              <button
                onClick={() => setShowFlashSidebar(!showFlashSidebar)}
                className="hf-btn"
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: showFlashSidebar ? "var(--accent-primary)" : "var(--surface-secondary)",
                  color: showFlashSidebar ? "white" : "var(--text-primary)",
                  transition: "all 0.2s ease",
                }}
              >
                ✨ {showFlashSidebar ? "Hide" : "Show"} Guidance
              </button>
            )}
            <AIConfigButton callPoint="spec.assistant" label="Config" inline />
          </div>
        </div>

        {/* Chat Input - ALWAYS VISIBLE AT TOP */}
        <div className="hf-p-lg" style={{ background: "var(--surface-primary)" }}>
          <div className="hf-flex hf-gap-md hf-items-start">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              placeholder="Tell me what you want to measure... (e.g., 'I want to track how curious someone is during conversations')"
              rows={4}
              className="hf-input hf-flex-1"
              style={{
                padding: 16,
                fontSize: 15,
                borderRadius: 12,
                borderWidth: 2,
                resize: "vertical",
                fontFamily: "inherit",
                lineHeight: 1.6,
                transition: "all 0.2s ease",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--accent-primary)";
                e.target.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--accent-primary) 10%, transparent)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border-default)";
                e.target.style.boxShadow = "none";
              }}
            />
            <button
              onClick={handleSendChat}
              disabled={chatLoading || !chatInput.trim()}
              style={{
                padding: "16px 28px",
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 12,
                border: "none",
                background:
                  chatLoading || !chatInput.trim()
                    ? "var(--surface-tertiary)"
                    : "linear-gradient(135deg, var(--accent-primary) 0%, var(--badge-indigo-text, #6366f1) 100%)",
                color: chatLoading || !chatInput.trim() ? "var(--text-muted)" : "white",
                cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                boxShadow: chatLoading || !chatInput.trim() ? "none" : "0 4px 12px color-mix(in srgb, var(--badge-indigo-text, #6366f1) 30%, transparent)",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: 8,
                minHeight: 56,
              }}
            >
              {chatLoading ? (
                <>
                  <span className="hf-spinner-inline" />
                  Thinking...
                </>
              ) : (
                <>
                  <ArrowRight size={18} strokeWidth={2.5} />
                  Send
                </>
              )}
            </button>
          </div>
          <p className="hf-text-muted hf-mt-sm" style={{ fontSize: 12, marginBottom: 0 }}>
            💡 Tip: Press <kbd style={{ padding: "2px 6px", background: "var(--surface-tertiary)", borderRadius: 4 }} className="hf-text-xs">⌘ Enter</kbd> to send
          </p>
        </div>

        {/* Conversation History */}
        {chatMessages.length > 0 && (
          <div style={{ maxHeight: 400, overflow: "auto", padding: "0 24px 24px", background: "var(--surface-primary)" }}>
            <div className="hf-flex-col hf-gap-lg">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className="hf-flex hf-gap-md"
                  style={{
                    alignItems: "flex-start",
                    ...(msg.role === "user" && { flexDirection: "row-reverse" }),
                  }}
                >
                  <div
                    className="hf-chat-avatar"
                    style={{
                      background: msg.role === "user"
                        ? "linear-gradient(135deg, var(--status-success-text, #10b981) 0%, var(--status-success-accent, #059669) 100%)"
                        : "linear-gradient(135deg, var(--accent-secondary, #8b5cf6) 0%, var(--badge-indigo-text, #6366f1) 100%)",
                    }}
                  >
                    {msg.role === "user" ? "👤" : "🤖"}
                  </div>
                  <div
                    className="hf-chat-bubble"
                    style={{
                      background: msg.role === "user"
                        ? "var(--surface-secondary)"
                        : "var(--surface-tertiary)",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Form Panel */}
      <div>
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            {/* Progress Steps */}
            <div
              className="hf-flex hf-gap-sm"
              style={{
                background: "var(--surface-secondary)",
                borderBottom: "1px solid var(--border-default)",
                padding: "16px 24px",
              }}
            >
              {[
                { num: 1, label: "Basics" },
                { num: 2, label: "Type" },
                { num: 3, label: "Story" },
                { num: 4, label: "Parameters" },
                { num: 5, label: "Review" },
              ].map((step, idx) => (
                <div key={step.num} className="hf-flex">
                  <button
                    onClick={() => setActiveStep(step.num)}
                    className="hf-flex hf-gap-sm"
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: activeStep === step.num ? "var(--accent-bg)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      className="hf-step-badge-sm"
                      style={{
                        background: activeStep === step.num ? "var(--accent-primary)" : "var(--surface-tertiary)",
                        color: activeStep === step.num ? "white" : "var(--text-muted)",
                      }}
                    >
                      {step.num}
                    </div>
                    <span
                      className="hf-text-sm hf-text-bold"
                      style={{
                        color: activeStep === step.num ? "var(--accent-primary)" : "var(--text-muted)",
                      }}
                    >
                      {step.label}
                    </span>
                  </button>
                  {idx < 4 && <div className="hf-step-connector" />}
                </div>
              ))}
            </div>

            {/* Form Content */}
            <div className="hf-p-lg" style={{ maxHeight: "calc(100vh - 340px)", overflowY: "auto" }}>
              {/* Step 1: Basics */}
              <section style={{ marginBottom: 32 }}>
                <div className="hf-flex hf-gap-md" style={{ marginBottom: 20 }}>
                  <StepBadge number={1} />
                  <div>
                    <h2 className="hf-step-header-title">
                      Basic Information
                    </h2>
                    <p className="hf-step-header-desc">
                      Define the core identity of your spec
                    </p>
                  </div>
                </div>

                <div className="hf-grid-2" style={{ gap: 16 }}>
                  <InputField label="Spec ID" required error={validationErrors.id}>
                    <input
                      type="text"
                      value={formData.id}
                      onChange={(e) => updateForm({ id: e.target.value.toUpperCase() })}
                      placeholder="e.g., PERS-001"
                      className={getInputClassName("id", !!validationErrors.id)}
                      style={getInputDynamicStyle("id", !!validationErrors.id)}
                    />
                  </InputField>

                  <InputField label="Title" required error={validationErrors.title}>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => updateForm({ title: e.target.value })}
                      placeholder="e.g., Personality Measurement"
                      className={getInputClassName("title", !!validationErrors.title)}
                      style={getInputDynamicStyle("title", !!validationErrors.title)}
                    />
                  </InputField>

                  <InputField label="Version">
                    <input
                      type="text"
                      value={formData.version}
                      onChange={(e) => updateForm({ version: e.target.value })}
                      placeholder="1.0"
                      className="hf-input"
                    />
                  </InputField>

                  <InputField label="Status">
                    <FancySelect
                      value={formData.status}
                      onChange={(v) => updateForm({ status: v as SpecFormData["status"] })}
                      options={STATUS_OPTIONS}
                      searchable={false}
                    />
                  </InputField>

                  <div style={{ gridColumn: "span 2" }}>
                    <InputField label="Domain">
                      <input
                        type="text"
                        value={formData.domain}
                        onChange={(e) => updateForm({ domain: e.target.value })}
                        placeholder="e.g., personality, memory, engagement"
                        className={getInputClassName("domain")}
                        style={getInputDynamicStyle("domain")}
                      />
                    </InputField>
                  </div>
                </div>
              </section>

              {/* Step 2: Classification */}
              <section style={{ marginBottom: 32 }}>
                <div className="hf-flex hf-gap-md" style={{ marginBottom: 20 }}>
                  <StepBadge number={2} />
                  <div>
                    <h2 className="hf-step-header-title">
                      Classification
                    </h2>
                    <p className="hf-step-header-desc">
                      How this spec fits into the system
                    </p>
                  </div>
                </div>

                <div className="hf-grid-3" style={{ gap: 16 }}>
                  <InputField label="Spec Type">
                    <FancySelect
                      value={formData.specType}
                      onChange={(v) => updateForm({ specType: v as SpecFormData["specType"] })}
                      options={SPEC_TYPE_OPTIONS}
                      searchable={false}
                    />
                  </InputField>

                  <InputField label="Spec Role">
                    <FancySelect
                      value={formData.specRole}
                      onChange={(v) => {
                        const role = v as SpecFormData["specRole"];
                        const updates: Partial<SpecFormData> = { specRole: role };
                        if (role === "CONTENT" && !formData.metadata?.curriculum) {
                          updates.metadata = {
                            curriculum: {
                              type: "sequential",
                              trackingMode: "module-based",
                              moduleSelector: "section=content",
                              moduleOrder: "sortBySequence",
                              progressKey: "current_module",
                              masteryThreshold: 0.7,
                            },
                          };
                          updates.outputType = "COMPOSE";
                        }
                        updateForm(updates);
                      }}
                      options={SPEC_ROLE_OPTIONS}
                      searchable={false}
                    />
                  </InputField>

                  <InputField label="Output Type">
                    <FancySelect
                      value={formData.outputType}
                      onChange={(v) => updateForm({ outputType: v as SpecFormData["outputType"] })}
                      options={OUTPUT_TYPE_OPTIONS}
                      searchable={false}
                    />
                  </InputField>
                </div>
              </section>

              {/* Step 3: User Story */}
              <section style={{ marginBottom: 32 }}>
                <div className="hf-flex hf-gap-md" style={{ marginBottom: 20 }}>
                  <StepBadge number={3} />
                  <div>
                    <h2 className="hf-step-header-title">
                      User Story
                    </h2>
                    <p className="hf-step-header-desc">
                      What problem does this spec solve?
                    </p>
                  </div>
                </div>

                <div className="hf-surface-section hf-flex-col hf-gap-lg">
                  <InputField label="As a..." required error={validationErrors["story.asA"]}>
                    <textarea
                      value={formData.story.asA}
                      onChange={(e) => updateStory("asA", e.target.value)}
                      placeholder="e.g., conversational AI system"
                      rows={2}
                      className={getInputClassName("story.asA", !!validationErrors["story.asA"])}
                      style={{
                        ...getInputDynamicStyle("story.asA", !!validationErrors["story.asA"]),
                        resize: "vertical",
                      }}
                    />
                  </InputField>

                  <InputField label="I want..." required error={validationErrors["story.iWant"]}>
                    <textarea
                      value={formData.story.iWant}
                      onChange={(e) => updateStory("iWant", e.target.value)}
                      placeholder="e.g., to measure and adapt to the caller's personality traits"
                      rows={2}
                      className={getInputClassName("story.iWant", !!validationErrors["story.iWant"])}
                      style={{
                        ...getInputDynamicStyle("story.iWant", !!validationErrors["story.iWant"]),
                        resize: "vertical",
                      }}
                    />
                  </InputField>

                  <InputField label="So that..." required error={validationErrors["story.soThat"]}>
                    <textarea
                      value={formData.story.soThat}
                      onChange={(e) => updateStory("soThat", e.target.value)}
                      placeholder="e.g., I can provide a more personalized and engaging experience"
                      rows={2}
                      className={getInputClassName("story.soThat", !!validationErrors["story.soThat"])}
                      style={{
                        ...getInputDynamicStyle("story.soThat", !!validationErrors["story.soThat"]),
                        resize: "vertical",
                      }}
                    />
                  </InputField>
                </div>
              </section>

              {/* Step 3.5: Curriculum Configuration (CONTENT specs only) */}
              {formData.specRole === "CONTENT" && formData.metadata?.curriculum && (
                <section style={{ marginBottom: 32 }}>
                  <div className="hf-flex hf-gap-md" style={{ marginBottom: 20 }}>
                    <StepBadge number={4} />
                    <div>
                      <h2 className="hf-step-header-title">
                        Curriculum Configuration
                      </h2>
                      <p className="hf-step-header-desc">
                        How the pipeline tracks learner progress through modules
                      </p>
                    </div>
                  </div>

                  <div className="hf-surface-section hf-flex-col hf-gap-lg">
                    <div className="hf-grid-2" style={{ gap: 16 }}>
                      <InputField label="Curriculum Type" required>
                        <FancySelect
                          value={formData.metadata.curriculum.type}
                          onChange={(v) => updateForm({
                            metadata: { curriculum: { ...formData.metadata!.curriculum!, type: v } },
                          })}
                          options={[
                            { value: "sequential", label: "Sequential", subtitle: "Modules completed in order" },
                            { value: "branching", label: "Branching", subtitle: "Prerequisites determine path" },
                            { value: "open-ended", label: "Open-ended", subtitle: "Learner chooses order" },
                          ]}
                          searchable={false}
                        />
                      </InputField>

                      <InputField label="Tracking Mode">
                        <FancySelect
                          value={formData.metadata.curriculum.trackingMode}
                          onChange={(v) => updateForm({
                            metadata: { curriculum: { ...formData.metadata!.curriculum!, trackingMode: v } },
                          })}
                          options={[
                            { value: "module-based", label: "Module-based", subtitle: "Track per-module mastery" },
                            { value: "competency-based", label: "Competency-based", subtitle: "Track competency scores" },
                          ]}
                          searchable={false}
                        />
                      </InputField>

                      <InputField label="Module Order">
                        <FancySelect
                          value={formData.metadata.curriculum.moduleOrder}
                          onChange={(v) => updateForm({
                            metadata: { curriculum: { ...formData.metadata!.curriculum!, moduleOrder: v } },
                          })}
                          options={[
                            { value: "sortBySequence", label: "By Sequence", subtitle: "Parameter sequence field" },
                            { value: "sortBySectionThenId", label: "By Section + ID", subtitle: "Alphabetical by ID" },
                            { value: "explicit", label: "Explicit", subtitle: "As listed in spec" },
                          ]}
                          searchable={false}
                        />
                      </InputField>

                      <InputField label="Mastery Threshold">
                        <div className="hf-flex hf-gap-md">
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={formData.metadata.curriculum.masteryThreshold}
                            onChange={(e) => updateForm({
                              metadata: { curriculum: { ...formData.metadata!.curriculum!, masteryThreshold: parseFloat(e.target.value) } },
                            })}
                            className="hf-flex-1"
                          />
                          <span className="hf-text-md hf-text-primary hf-text-right" style={{ fontWeight: 700, minWidth: 44 }}>
                            {Math.round(formData.metadata.curriculum.masteryThreshold * 100)}%
                          </span>
                        </div>
                      </InputField>
                    </div>

                    <div className="hf-banner hf-banner-info" style={{ padding: "10px 14px", fontSize: 12, lineHeight: 1.5 }}>
                      Module selector: <strong>{formData.metadata.curriculum.moduleSelector}</strong> — parameters with <code>section=&quot;content&quot;</code> are treated as curriculum modules.
                      A caller advances to the next module when mastery reaches {Math.round(formData.metadata.curriculum.masteryThreshold * 100)}%.
                    </div>
                  </div>
                </section>
              )}

              {/* Step 4: Parameters (renumbered to 5 when CONTENT) */}
              <section style={{ marginBottom: 32 }}>
                <div className="hf-flex-between" style={{ marginBottom: 20 }}>
                  <div className="hf-flex hf-gap-md">
                    <StepBadge number={formData.specRole === "CONTENT" ? 5 : 4} />
                    <div>
                      <h2 className="hf-step-header-title">
                        {formData.specRole === "CONTENT" ? "Modules" : "Parameters"}
                      </h2>
                      <p className="hf-step-header-desc">
                        {formData.specRole === "CONTENT"
                          ? "What modules does this curriculum contain?"
                          : "What does this spec measure or track?"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={addParameter}
                    className="hf-btn hf-text-sm hf-text-bold"
                    style={{
                      background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--badge-indigo-text, #6366f1) 100%)",
                      color: "white",
                      boxShadow: "0 2px 8px color-mix(in srgb, var(--badge-indigo-text, #6366f1) 30%, transparent)",
                    }}
                  >
                    <Plus size={16} />
                    {formData.specRole === "CONTENT" ? "Add Module" : "Add Parameter"}
                  </button>
                </div>

                {formData.parameters.length === 0 ? (
                  <div
                    className="hf-text-center"
                    style={{
                      padding: 48,
                      background: "var(--surface-secondary)",
                      borderRadius: 16,
                      border: "2px dashed var(--border-default)",
                    }}
                  >
                    <div
                      className="hf-modal-icon"
                      style={{ background: "var(--surface-tertiary)", margin: "0 auto 16px" }}
                    >
                      📊
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 4px" }}>
                      No parameters yet
                    </p>
                    <p className="hf-text-sm hf-text-muted" style={{ margin: 0 }}>
                      Parameters define what this spec measures or tracks
                    </p>
                  </div>
                ) : (
                  <div className="hf-flex-col hf-gap-lg">
                    {formData.parameters.map((param, index) => (
                      <div key={param.id} className="hf-param-card">
                        <div className="hf-flex-between hf-mb-md">
                          <div className="hf-flex" style={{ gap: 10 }}>
                            <div className="hf-param-index">
                              {index + 1}
                            </div>
                            <span className="hf-text-md hf-text-bold hf-text-primary">
                              Parameter
                            </span>
                          </div>
                          <button
                            onClick={() => removeParameter(index)}
                            className="hf-text-sm hf-text-bold"
                            style={{
                              color: "var(--error-text)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "6px 12px",
                              borderRadius: 6,
                            }}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="hf-grid-2">
                          <InputField label="ID">
                            <input
                              type="text"
                              value={param.id}
                              onChange={(e) => updateParameter(index, { id: e.target.value.toUpperCase() })}
                              placeholder={formData.specRole === "CONTENT" ? "e.g., MOD-1" : "e.g., OPENNESS"}
                              className="hf-input hf-text-sm"
                            />
                          </InputField>
                          <InputField label="Name">
                            <input
                              type="text"
                              value={param.name}
                              onChange={(e) => updateParameter(index, { name: e.target.value })}
                              placeholder={formData.specRole === "CONTENT" ? "e.g., Food Hygiene Legislation" : "e.g., Openness to Experience"}
                              className="hf-input hf-text-sm"
                            />
                          </InputField>
                          <div style={{ gridColumn: "span 2" }}>
                            <InputField label="Description">
                              <textarea
                                value={param.description}
                                onChange={(e) => updateParameter(index, { description: e.target.value })}
                                placeholder={formData.specRole === "CONTENT" ? "What does this module cover?" : "What does this parameter measure?"}
                                rows={2}
                                className="hf-input hf-text-sm"
                                style={{ resize: "vertical" }}
                              />
                            </InputField>
                          </div>

                          {/* Target Range (non-CONTENT specs) */}
                          {formData.specRole !== "CONTENT" && (
                            <>
                              <InputField label="Target Min">
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
                                  className="hf-input hf-text-sm"
                                />
                              </InputField>
                              <InputField label="Target Max">
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
                                  className="hf-input hf-text-sm"
                                />
                              </InputField>
                            </>
                          )}

                          {/* Learning Outcomes (CONTENT specs only) */}
                          {formData.specRole === "CONTENT" && (
                            <div style={{ gridColumn: "span 2" }}>
                              <InputField label="Learning Outcomes">
                                <div className="hf-flex-col hf-gap-sm">
                                  {(param.learningOutcomes || []).map((lo, loIdx) => (
                                    <div key={loIdx} className="hf-flex hf-gap-sm">
                                      <span className="hf-text-xs hf-text-muted" style={{ fontWeight: 700, minWidth: 28 }}>
                                        LO{loIdx + 1}
                                      </span>
                                      <input
                                        type="text"
                                        value={lo}
                                        onChange={(e) => {
                                          const updated = [...(param.learningOutcomes || [])];
                                          updated[loIdx] = e.target.value;
                                          updateParameter(index, { learningOutcomes: updated });
                                        }}
                                        placeholder="e.g., Understand the role of local authorities in food safety enforcement"
                                        className="hf-input"
                                        style={{ fontSize: 12, padding: "6px 10px" }}
                                      />
                                      <button
                                        onClick={() => {
                                          const updated = (param.learningOutcomes || []).filter((_, i) => i !== loIdx);
                                          updateParameter(index, { learningOutcomes: updated });
                                        }}
                                        className="hf-flex-shrink-0"
                                        style={{
                                          background: "none",
                                          border: "none",
                                          cursor: "pointer",
                                          color: "var(--error-text)",
                                          fontSize: 16,
                                          padding: "2px 6px",
                                        }}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => {
                                      const updated = [...(param.learningOutcomes || []), ""];
                                      updateParameter(index, { learningOutcomes: updated });
                                    }}
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: "var(--accent-primary)",
                                      background: "none",
                                      border: "1px dashed var(--border-default)",
                                      borderRadius: 8,
                                      padding: "6px 12px",
                                      cursor: "pointer",
                                      alignSelf: "flex-start",
                                    }}
                                  >
                                    + Add Learning Outcome
                                  </button>
                                </div>
                              </InputField>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Step 5/6: Review */}
              <section>
                <div className="hf-flex hf-gap-md" style={{ marginBottom: 20 }}>
                  <StepBadge number={formData.specRole === "CONTENT" ? 6 : 5} />
                  <div>
                    <h2 className="hf-step-header-title">
                      Review JSON
                    </h2>
                    <p className="hf-step-header-desc">
                      Preview the generated spec
                    </p>
                  </div>
                </div>

                <div className="hf-json-preview">
                  <pre>
                    {JSON.stringify(formData, null, 2)}
                  </pre>
                </div>
              </section>
            </div>

            {/* Footer Actions */}
            <div
              className="hf-flex-between"
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
              }}
            >
              <div>
                {isDirty && (
                  <span className="hf-flex hf-gap-sm hf-text-sm hf-text-warning">
                    <span className="hf-autosave-dot" />
                    Auto-saving draft...
                  </span>
                )}
              </div>
              <div className="hf-flex hf-gap-md">
                <Link
                  href="/x/specs"
                  className="hf-btn hf-btn-secondary"
                  style={{ textDecoration: "none", padding: "12px 20px" }}
                >
                  Cancel
                </Link>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className={creating ? "hf-btn" : "hf-btn-gradient-success"}
                  style={creating ? {
                    padding: "12px 24px",
                    background: "var(--surface-tertiary)",
                    color: "var(--text-muted)",
                    cursor: "not-allowed",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                  } : undefined}
                >
                  {creating && <span className="hf-spinner-inline" />}
                  {creating ? "Creating..." : "Create & Activate"}
                </button>
              </div>
            </div>
          </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes aiGlow {
          0% {
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.25);
          }
          100% {
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
          }
        }
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
