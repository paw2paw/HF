"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: 10,
      background: active
        ? "linear-gradient(135deg, var(--accent-primary) 0%, #6366f1 100%)"
        : "var(--surface-tertiary)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: active ? "#fff" : "var(--text-muted)",
      fontWeight: 700,
      fontSize: 13,
      boxShadow: active ? "0 2px 8px rgba(99, 102, 241, 0.3)" : "none",
    }}
  >
    {number}
  </div>
);

const SectionCard = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      background: "var(--surface-primary)",
      border: "1px solid var(--border-default)",
      borderRadius: 16,
      padding: 24,
      ...style,
    }}
  >
    {children}
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
    <label
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text-secondary)",
        marginBottom: 8,
        letterSpacing: "0.02em",
      }}
    >
      {label}
      {required && <span style={{ color: "var(--error-text)", marginLeft: 4 }}>*</span>}
    </label>
    {children}
    {error && (
      <p style={{ marginTop: 6, fontSize: 12, color: "var(--error-text)" }}>{error}</p>
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
  const aiUpdateTimeoutRef = useRef<NodeJS.Timeout>();
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

  // Start task tracking on mount
  useEffect(() => {
    async function startTask() {
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskType: "create_spec",
            userId: "default",
            context: { page: "spec_creation" },
          }),
        });
        const data = await res.json();
        if (data.ok && data.taskId) {
          setTaskId(data.taskId);
        }
      } catch (error) {
        console.error("Failed to start task tracking:", error);
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
    const newParam: JsonParameter = {
      id: `PARAM-${formData.parameters.length + 1}`,
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

  // Common input styles
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    fontSize: 14,
    borderRadius: 10,
    border: "1px solid var(--border-default)",
    background: "var(--surface-secondary)",
    color: "var(--text-primary)",
    outline: "none",
    transition: "all 0.15s ease",
  };

  const inputErrorStyle: React.CSSProperties = {
    ...inputStyle,
    borderColor: "var(--error-text)",
    boxShadow: "0 0 0 3px var(--error-bg)",
  };

  const getInputStyle = (fieldName: string, hasError?: boolean): React.CSSProperties => {
    if (hasError) return inputErrorStyle;
    if (aiUpdatedFields.has(fieldName)) {
      return {
        ...inputStyle,
        borderColor: "var(--accent-primary)",
        boxShadow: "0 0 0 3px rgba(99, 102, 241, 0.15)",
        animation: "aiGlow 0.5s ease-in-out",
      };
    }
    return inputStyle;
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
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 1000,
            background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            color: "#fff",
            padding: "16px 20px",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(139, 92, 246, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            animation: "slideInRight 0.3s ease-out",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <span style={{ fontSize: 20 }}>✨</span>
          <span>AI filled in {aiUpdatedFields.size} field{aiUpdatedFields.size !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Draft Restore Modal */}
      {showDraftPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "var(--surface-primary)",
              borderRadius: 20,
              padding: 32,
              maxWidth: 420,
              width: "100%",
              margin: 16,
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: 28,
                }}
              >
                📝
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                Restore Draft?
              </h3>
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.5 }}>
                You have a saved draft from a previous session. Would you like to continue where you left off?
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button
                  onClick={handleDiscardDraft}
                  style={{
                    padding: "12px 24px",
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 10,
                    border: "1px solid var(--border-default)",
                    background: "var(--surface-secondary)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Discard
                </button>
                <button
                  onClick={handleRestoreDraft}
                  style={{
                    padding: "12px 24px",
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, var(--accent-primary) 0%, #6366f1 100%)",
                    color: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                  }}
                >
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
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link
              href="/x/specs"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "var(--surface-secondary)",
                border: "1px solid var(--border-default)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 28 }}>✨</span>
                Create New Spec
              </h1>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "4px 0 0" }}>
                Define a new behavior specification for your AI system
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ minWidth: 240 }}>
              <FancySelect
                value=""
                onChange={handleCopyFrom}
                options={copyOptions}
                placeholder={loadingSpecs ? "Loading..." : "Clone existing spec..."}
                disabled={loadingSpecs}
              />
            </div>
            <Link
              href="/x/import?tab=specs"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 10,
                border: "1px solid var(--accent-primary)",
                background: "var(--accent-bg)",
                color: "var(--accent-primary)",
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import
            </Link>
            <Link
              href="/x/admin/spec-sync"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 10,
                border: "1px solid var(--warning-border)",
                background: "var(--warning-bg)",
                color: "var(--warning-text)",
                textDecoration: "none",
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync
            </Link>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            background: "var(--error-bg)",
            border: "1px solid var(--error-border)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span style={{ fontSize: 14, color: "var(--error-text)", fontWeight: 500 }}>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              color: "var(--error-text)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* AI Assistant - Large Top Section */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%)",
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
          style={{
            background: "var(--surface-primary)",
            borderBottom: "1px solid var(--border-default)",
            padding: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                boxShadow: "0 4px 16px rgba(139, 92, 246, 0.3)",
              }}
            >
              🤖
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                AI Spec Builder
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "4px 0 0" }}>
                Describe what you want to measure, and I'll build the spec for you
              </p>
              <div style={{ marginTop: 8 }}>
                <AIModelBadge callPoint="spec.assistant" variant="text" size="sm" />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowFlashSidebar(!showFlashSidebar)}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: showFlashSidebar ? "var(--accent-primary)" : "var(--surface-secondary)",
                color: showFlashSidebar ? "#fff" : "var(--text-primary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s ease",
              }}
            >
              ✨ {showFlashSidebar ? "Hide" : "Show"} Guidance
            </button>
            <AIConfigButton callPoint="spec.assistant" label="Config" inline />
          </div>
        </div>

        {/* Chat Input - ALWAYS VISIBLE AT TOP */}
        <div style={{ padding: 24, background: "var(--surface-primary)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
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
              style={{
                flex: 1,
                padding: 16,
                fontSize: 15,
                borderRadius: 12,
                border: "2px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
                lineHeight: 1.6,
                transition: "all 0.2s ease",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--accent-primary)";
                e.target.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)";
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
                    : "linear-gradient(135deg, var(--accent-primary) 0%, #6366f1 100%)",
                color: chatLoading || !chatInput.trim() ? "var(--text-muted)" : "#fff",
                cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                boxShadow: chatLoading || !chatInput.trim() ? "none" : "0 4px 12px rgba(99, 102, 241, 0.3)",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: 8,
                minHeight: 56,
              }}
            >
              {chatLoading ? (
                <>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Thinking...
                </>
              ) : (
                <>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Send
                </>
              )}
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, marginBottom: 0 }}>
            💡 Tip: Press <kbd style={{ padding: "2px 6px", background: "var(--surface-tertiary)", borderRadius: 4, fontSize: 11 }}>⌘ Enter</kbd> to send
          </p>
        </div>

        {/* Conversation History */}
        {chatMessages.length > 0 && (
          <div
            style={{
              maxHeight: 400,
              overflow: "auto",
              padding: "0 24px 24px",
              background: "var(--surface-primary)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    ...(msg.role === "user" && { flexDirection: "row-reverse" }),
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: msg.role === "user"
                        ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                        : "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {msg.role === "user" ? "👤" : "🤖"}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      borderRadius: 12,
                      fontSize: 14,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      background: msg.role === "user"
                        ? "var(--surface-secondary)"
                        : "var(--surface-tertiary)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-default)",
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
              style={{
                background: "var(--surface-secondary)",
                borderBottom: "1px solid var(--border-default)",
                padding: "16px 24px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {[
                { num: 1, label: "Basics" },
                { num: 2, label: "Type" },
                { num: 3, label: "Story" },
                { num: 4, label: "Parameters" },
                { num: 5, label: "Review" },
              ].map((step, idx) => (
                <div key={step.num} style={{ display: "flex", alignItems: "center" }}>
                  <button
                    onClick={() => setActiveStep(step.num)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: activeStep === step.num ? "var(--accent-bg)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: activeStep === step.num ? "var(--accent-primary)" : "var(--surface-tertiary)",
                        color: activeStep === step.num ? "#fff" : "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {step.num}
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: activeStep === step.num ? "var(--accent-primary)" : "var(--text-muted)",
                      }}
                    >
                      {step.label}
                    </span>
                  </button>
                  {idx < 4 && (
                    <div
                      style={{
                        width: 24,
                        height: 2,
                        background: "var(--border-default)",
                        margin: "0 4px",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Form Content */}
            <div style={{ padding: 24, maxHeight: "calc(100vh - 340px)", overflowY: "auto" }}>
              {/* Step 1: Basics */}
              <section style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <StepBadge number={1} />
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                      Basic Information
                    </h2>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 0" }}>
                      Define the core identity of your spec
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <InputField label="Spec ID" required error={validationErrors.id}>
                    <input
                      type="text"
                      value={formData.id}
                      onChange={(e) => updateForm({ id: e.target.value.toUpperCase() })}
                      placeholder="e.g., PERS-001"
                      style={getInputStyle("id", !!validationErrors.id)}
                    />
                  </InputField>

                  <InputField label="Title" required error={validationErrors.title}>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => updateForm({ title: e.target.value })}
                      placeholder="e.g., Personality Measurement"
                      style={getInputStyle("title", !!validationErrors.title)}
                    />
                  </InputField>

                  <InputField label="Version">
                    <input
                      type="text"
                      value={formData.version}
                      onChange={(e) => updateForm({ version: e.target.value })}
                      placeholder="1.0"
                      style={inputStyle}
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
                        style={getInputStyle("domain")}
                      />
                    </InputField>
                  </div>
                </div>
              </section>

              {/* Step 2: Classification */}
              <section style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <StepBadge number={2} />
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                      Classification
                    </h2>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 0" }}>
                      How this spec fits into the system
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
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
                      onChange={(v) => updateForm({ specRole: v as SpecFormData["specRole"] })}
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
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <StepBadge number={3} />
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                      User Story
                    </h2>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 0" }}>
                      What problem does this spec solve?
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    background: "var(--surface-secondary)",
                    borderRadius: 16,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  <InputField label="As a..." required error={validationErrors["story.asA"]}>
                    <textarea
                      value={formData.story.asA}
                      onChange={(e) => updateStory("asA", e.target.value)}
                      placeholder="e.g., conversational AI system"
                      rows={2}
                      style={{
                        ...getInputStyle("story.asA", !!validationErrors["story.asA"]),
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
                      style={{
                        ...getInputStyle("story.iWant", !!validationErrors["story.iWant"]),
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
                      style={{
                        ...getInputStyle("story.soThat", !!validationErrors["story.soThat"]),
                        resize: "vertical",
                      }}
                    />
                  </InputField>
                </div>
              </section>

              {/* Step 4: Parameters */}
              <section style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <StepBadge number={4} />
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                        Parameters
                      </h2>
                      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 0" }}>
                        What does this spec measure or track?
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={addParameter}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 10,
                      border: "none",
                      background: "linear-gradient(135deg, var(--accent-primary) 0%, #6366f1 100%)",
                      color: "#fff",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                    }}
                  >
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Parameter
                  </button>
                </div>

                {formData.parameters.length === 0 ? (
                  <div
                    style={{
                      padding: 48,
                      background: "var(--surface-secondary)",
                      borderRadius: 16,
                      border: "2px dashed var(--border-default)",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 16,
                        background: "var(--surface-tertiary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 16px",
                        fontSize: 28,
                      }}
                    >
                      📊
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 4px" }}>
                      No parameters yet
                    </p>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                      Parameters define what this spec measures or tracks
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {formData.parameters.map((param, index) => (
                      <div
                        key={param.id}
                        style={{
                          background: "var(--surface-secondary)",
                          borderRadius: 16,
                          border: "1px solid var(--border-default)",
                          padding: 20,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                background: "linear-gradient(135deg, var(--accent-primary) 0%, #6366f1 100%)",
                                color: "#fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {index + 1}
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                              Parameter
                            </span>
                          </div>
                          <button
                            onClick={() => removeParameter(index)}
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
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
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <InputField label="ID">
                            <input
                              type="text"
                              value={param.id}
                              onChange={(e) => updateParameter(index, { id: e.target.value.toUpperCase() })}
                              placeholder="e.g., OPENNESS"
                              style={{ ...inputStyle, fontSize: 13 }}
                            />
                          </InputField>
                          <InputField label="Name">
                            <input
                              type="text"
                              value={param.name}
                              onChange={(e) => updateParameter(index, { name: e.target.value })}
                              placeholder="e.g., Openness to Experience"
                              style={{ ...inputStyle, fontSize: 13 }}
                            />
                          </InputField>
                          <div style={{ gridColumn: "span 2" }}>
                            <InputField label="Description">
                              <textarea
                                value={param.description}
                                onChange={(e) => updateParameter(index, { description: e.target.value })}
                                placeholder="What does this parameter measure?"
                                rows={2}
                                style={{ ...inputStyle, fontSize: 13, resize: "vertical" }}
                              />
                            </InputField>
                          </div>
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
                              style={{ ...inputStyle, fontSize: 13 }}
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
                              style={{ ...inputStyle, fontSize: 13 }}
                            />
                          </InputField>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Step 5: Review */}
              <section>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <StepBadge number={5} />
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                      Review JSON
                    </h2>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 0" }}>
                      Preview the generated spec
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    background: "#1e1e2e",
                    borderRadius: 16,
                    padding: 20,
                    maxHeight: 320,
                    overflow: "auto",
                    border: "1px solid #313244",
                  }}
                >
                  <pre
                    style={{
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      color: "#cdd6f4",
                      whiteSpace: "pre-wrap",
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {JSON.stringify(formData, null, 2)}
                  </pre>
                </div>
              </section>
            </div>

            {/* Footer Actions */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                {isDirty && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      color: "var(--warning-text)",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--warning-text)",
                        animation: "pulse 2s infinite",
                      }}
                    />
                    Auto-saving draft...
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <Link
                  href="/x/specs"
                  style={{
                    padding: "12px 20px",
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 10,
                    border: "1px solid var(--border-default)",
                    background: "var(--surface-primary)",
                    color: "var(--text-secondary)",
                    textDecoration: "none",
                  }}
                >
                  Cancel
                </Link>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  style={{
                    padding: "12px 24px",
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 10,
                    border: "none",
                    background: creating
                      ? "var(--surface-tertiary)"
                      : "linear-gradient(135deg, var(--success-text) 0%, #059669 100%)",
                    color: creating ? "var(--text-muted)" : "#fff",
                    cursor: creating ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: creating ? "none" : "0 4px 12px rgba(16, 185, 129, 0.3)",
                  }}
                >
                  {creating && (
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  )}
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
