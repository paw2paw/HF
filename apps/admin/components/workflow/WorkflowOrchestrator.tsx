"use client";

import { useState, useCallback, useEffect, useRef, type ComponentType } from "react";
import { WorkflowAIPanel } from "./WorkflowAIPanel";
import { WorkflowStepper } from "./WorkflowStepper";
import { ConditionCard } from "./ConditionCard";
import type {
  WorkflowState,
  WorkflowStep,
  WorkflowPlan,
  ChatThread,
  StepType,
  StepFormProps,
  ClassifyResponse,
} from "@/lib/workflow/types";
import {
  createInitialWorkflowState,
  resolvePrefilled,
  WORKFLOW_DRAFT_KEY,
} from "@/lib/workflow/types";

// Step form imports
import { DomainStepForm } from "./steps/DomainStepForm";
import { ContentSourceStepForm } from "./steps/ContentSourceStepForm";
import { SpecStepForm } from "./steps/SpecStepForm";
import { UploadStepForm } from "./steps/UploadStepForm";
import { ActivateStepForm } from "./steps/ActivateStepForm";
import { OnboardingStepForm } from "./steps/OnboardingStepForm";

// ============================================================================
// Step Component Registry — maps step types to form components
// ============================================================================

const STEP_REGISTRY: Partial<Record<StepType, ComponentType<StepFormProps>>> = {
  domain: DomainStepForm,
  content_source: ContentSourceStepForm,
  spec: SpecStepForm,
  upload: UploadStepForm,
  activate: ActivateStepForm,
  onboarding: OnboardingStepForm,
};

/** Register a step component at runtime */
export function registerStepComponent(type: StepType, component: ComponentType<StepFormProps>) {
  STEP_REGISTRY[type] = component;
}

// ============================================================================
// Placeholder step component for unregistered types
// ============================================================================

function PlaceholderStep({ step, onComplete, onSkip }: StepFormProps) {
  return (
    <div
      style={{
        padding: 40,
        textAlign: "center",
        border: "2px dashed var(--border-default)",
        borderRadius: 16,
        background: "var(--surface-secondary)",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 16 }}>🚧</div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}
      >
        {step.title}
      </h3>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          marginBottom: 24,
          maxWidth: 400,
          margin: "0 auto 24px",
        }}
      >
        The <strong>{step.type}</strong> step form is being built.
        <br />
        {step.description}
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        {!step.required && (
          <button
            onClick={onSkip}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              border: "1px solid var(--border-default)",
              background: "var(--surface-primary)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Skip
          </button>
        )}
        <button
          onClick={() => onComplete({ placeholder: true })}
          style={{
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            border: "none",
            background:
              "linear-gradient(135deg, var(--accent-primary) 0%, #6366f1 100%)",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Mark Complete (placeholder)
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Completion Summary
// ============================================================================

function CompletionSummary({
  state,
}: {
  state: WorkflowState;
}) {
  const completedSteps = state.steps.filter((s) => s.status === "completed");

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "40px auto",
        padding: 32,
        borderRadius: 16,
        border: "2px solid var(--success-border)",
        background: "var(--success-bg)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "var(--success-text)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: 28,
          color: "#fff",
        }}
      >
        ✓
      </div>
      <h2
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}
      >
        Workflow Complete
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-secondary)",
          marginBottom: 24,
        }}
      >
        {state.plan?.summary}
      </p>

      <div style={{ textAlign: "left", marginBottom: 24 }}>
        {completedSteps.map((step) => (
          <div
            key={step.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 0",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: "var(--success-text)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              ✓
            </span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {step.title}
              </div>
              {step.result?.name && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Created: {step.result.name}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => (window.location.href = "/x")}
        style={{
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 700,
          borderRadius: 10,
          border: "none",
          background:
            "linear-gradient(135deg, var(--accent-primary) 0%, #6366f1 100%)",
          color: "#fff",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
        }}
      >
        Go to Dashboard
      </button>
    </div>
  );
}

// ============================================================================
// Step Navigation Buttons
// ============================================================================

function StepNavButtons({
  prevStep,
  nextStep,
  currentStepId,
  onNavigate,
}: {
  prevStep: WorkflowStep | null | undefined;
  nextStep: WorkflowStep | null | undefined;
  currentStepId: string | null;
  onNavigate: (stepId: string) => void;
}) {
  if (!prevStep && !nextStep) return null;

  const btnBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 10,
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 24,
        paddingTop: 16,
        borderTop: "1px solid var(--border-default)",
      }}
    >
      {prevStep ? (
        <button
          onClick={() => onNavigate(prevStep.id)}
          style={{
            ...btnBase,
            border: "1px solid var(--border-default)",
            background: "var(--surface-secondary)",
            color: "var(--text-secondary)",
          }}
        >
          ← {prevStep.title}
        </button>
      ) : (
        <div />
      )}
      {nextStep ? (
        <button
          onClick={() => onNavigate(nextStep.id)}
          style={{
            ...btnBase,
            border: nextStep.id === currentStepId
              ? "none"
              : "1px solid var(--border-default)",
            background: nextStep.id === currentStepId
              ? "linear-gradient(135deg, var(--accent-primary) 0%, #6366f1 100%)"
              : "var(--surface-secondary)",
            color: nextStep.id === currentStepId ? "#fff" : "var(--text-secondary)",
          }}
        >
          {nextStep.id === currentStepId ? "Back to Current Step" : nextStep.title} →
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}

// ============================================================================
// Main Orchestrator
// ============================================================================

export function WorkflowOrchestrator() {
  const [state, setState] = useState<WorkflowState>(createInitialWorkflowState);
  const [isLoading, setIsLoading] = useState(false);
  const [planReady, setPlanReady] = useState(false);
  const [pendingFieldUpdates, setPendingFieldUpdates] = useState<Record<string, any> | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [savedDraft, setSavedDraft] = useState<WorkflowState | null>(null);
  // viewingStepId: which step the user is looking at (null = show currentStepId)
  const [viewingStepId, setViewingStepId] = useState<string | null>(null);
  const draftTimerRef = useRef<NodeJS.Timeout>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Draft persistence ──────────────────────────────────────────────────

  // Check for saved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WORKFLOW_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as WorkflowState;
        if (draft.phase !== "completed" && draft.phase !== "abandoned") {
          setSavedDraft(draft);
          setShowDraftPrompt(true);
        }
      }
    } catch {
      localStorage.removeItem(WORKFLOW_DRAFT_KEY);
    }
  }, []);

  // Auto-save draft on state changes (debounced)
  useEffect(() => {
    if (state.phase === "completed" || state.phase === "abandoned") return;
    // Only save if we have some content
    const hasContent =
      state.chatThreads.planning?.messages.length > 0 || state.steps.length > 0;
    if (!hasContent) return;

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      localStorage.setItem(WORKFLOW_DRAFT_KEY, JSON.stringify(state));
    }, 1000);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [state]);

  const handleRestoreDraft = useCallback(() => {
    if (savedDraft) {
      setState(savedDraft);
      if (savedDraft.plan) setPlanReady(true);
    }
    setShowDraftPrompt(false);
  }, [savedDraft]);

  const handleDiscardDraft = useCallback(() => {
    localStorage.removeItem(WORKFLOW_DRAFT_KEY);
    setShowDraftPrompt(false);
  }, []);

  // ── Planning phase: send message to classify endpoint ──────────────────

  const handleSendMessage = useCallback(
    async (message: string) => {
      const threadId =
        state.phase === "planning"
          ? "planning"
          : state.currentStepId || "planning";

      // Add user message to thread
      setState((prev) => {
        const thread = prev.chatThreads[threadId] || {
          messages: [],
          collapsed: false,
        };
        return {
          ...prev,
          chatThreads: {
            ...prev.chatThreads,
            [threadId]: {
              ...thread,
              messages: [...thread.messages, { role: "user", content: message }],
            },
          },
          intentDescription:
            prev.phase === "planning" && !prev.intentDescription
              ? message
              : prev.intentDescription,
          updatedAt: new Date().toISOString(),
        };
      });

      setIsLoading(true);

      try {
        // Choose endpoint based on phase
        const endpoint =
          state.phase === "planning"
            ? "/api/ai/workflow/classify"
            : "/api/ai/workflow/step-guidance";

        const body =
          state.phase === "planning"
            ? {
                message,
                history: state.chatThreads.planning?.messages || [],
                currentPlan: state.plan,
              }
            : {
                message,
                stepType: state.steps.find((s) => s.id === state.currentStepId)
                  ?.type,
                stepTitle: state.steps.find(
                  (s) => s.id === state.currentStepId
                )?.title,
                formState: {},
                collectedData: state.collectedData,
                history:
                  state.chatThreads[state.currentStepId || ""]?.messages || [],
              };

        const controller = new AbortController();
        abortRef.current = controller;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const data: ClassifyResponse = await res.json();

        if (data.ok) {
          setState((prev) => {
            const thread = prev.chatThreads[threadId] || {
              messages: [],
              collapsed: false,
            };
            const assistantMessage: { role: "assistant"; content: string; options?: typeof data.options } = {
              role: "assistant",
              content: data.response,
            };
            if (data.options && data.options.length > 0) {
              assistantMessage.options = data.options;
            }
            const newState = {
              ...prev,
              chatThreads: {
                ...prev.chatThreads,
                [threadId]: {
                  ...thread,
                  messages: [
                    ...thread.messages,
                    assistantMessage,
                  ],
                },
              },
              updatedAt: new Date().toISOString(),
            };

            if (data.plan) {
              newState.plan = data.plan;
            }

            return newState;
          });

          if (data.planReady) {
            setPlanReady(true);
          }

          // Handle field updates for step guidance
          if ("fieldUpdates" in data && data.fieldUpdates) {
            setPendingFieldUpdates(data.fieldUpdates as Record<string, any>);
          }
        } else {
          // Error response
          setState((prev) => {
            const thread = prev.chatThreads[threadId] || {
              messages: [],
              collapsed: false,
            };
            return {
              ...prev,
              chatThreads: {
                ...prev.chatThreads,
                [threadId]: {
                  ...thread,
                  messages: [
                    ...thread.messages,
                    {
                      role: "assistant" as const,
                      content: `Sorry, something went wrong: ${data.error || "Unknown error"}`,
                    },
                  ],
                },
              },
            };
          });
        }
      } catch (error) {
        // Don't add error message if the request was intentionally aborted
        if (error instanceof DOMException && error.name === "AbortError") {
          setState((prev) => {
            const thread = prev.chatThreads[threadId] || {
              messages: [],
              collapsed: false,
            };
            return {
              ...prev,
              chatThreads: {
                ...prev.chatThreads,
                [threadId]: {
                  ...thread,
                  messages: [
                    ...thread.messages,
                    { role: "assistant" as const, content: "Stopped." },
                  ],
                },
              },
            };
          });
        } else {
          setState((prev) => {
            const thread = prev.chatThreads[threadId] || {
              messages: [],
              collapsed: false,
            };
            return {
              ...prev,
              chatThreads: {
                ...prev.chatThreads,
                [threadId]: {
                  ...thread,
                  messages: [
                    ...thread.messages,
                    {
                      role: "assistant" as const,
                      content: `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`,
                    },
                  ],
                },
              },
            };
          });
        }
      } finally {
        abortRef.current = null;
        setIsLoading(false);
      }
    },
    [state.phase, state.plan, state.chatThreads, state.currentStepId, state.collectedData, state.steps]
  );

  // ── Stop in-flight request ──────────────────────────────────────────────

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ── Confirm plan → transition to execution ─────────────────────────────

  const handleConfirmPlan = useCallback(() => {
    if (!state.plan) return;

    setState((prev) => {
      // Convert planned steps to runtime steps
      const steps: WorkflowStep[] = prev.plan!.steps.map((ps) => ({
        ...ps,
        status: "pending" as const,
      }));

      // Find first non-conditional, non-dependent step
      const firstStepId = steps[0]?.id || null;
      if (firstStepId) {
        const firstStep = steps.find((s) => s.id === firstStepId);
        if (firstStep) firstStep.status = "active";
      }

      // Initialize chat threads for each step
      const chatThreads: Record<string, ChatThread> = {
        planning: { ...prev.chatThreads.planning, collapsed: true },
      };
      for (const step of steps) {
        chatThreads[step.id] = { messages: [], collapsed: false };
      }

      // Add initial AI guidance message for first step
      if (firstStepId && chatThreads[firstStepId]) {
        const firstStep = steps.find((s) => s.id === firstStepId);
        chatThreads[firstStepId].messages.push({
          role: "assistant",
          content: `Let's start with: **${firstStep?.title}**\n\n${firstStep?.description || "Fill in the details below."}`,
        });
      }

      return {
        ...prev,
        phase: "executing",
        steps,
        currentStepId: firstStepId,
        chatThreads,
        updatedAt: new Date().toISOString(),
      };
    });

    setPlanReady(false);
  }, [state.plan]);

  // ── Step completion ────────────────────────────────────────────────────

  const handleStepComplete = useCallback(
    (stepId: string, result: Record<string, any>) => {
      // Reset viewing to follow the active frontier
      setViewingStepId(null);
      setState((prev) => {
        const steps = [...prev.steps];
        const idx = steps.findIndex((s) => s.id === stepId);
        if (idx === -1) return prev;

        // Mark current step complete
        steps[idx] = { ...steps[idx], status: "completed", result };

        // Collapse the thread and set summary
        const threadSummary =
          result.name
            ? `Created "${result.name}"`
            : result.slug
              ? `Created ${result.slug}`
              : "Completed";

        // Find next step
        let nextStepId: string | null = null;
        for (let i = idx + 1; i < steps.length; i++) {
          const s = steps[i];
          if (s.status === "skipped") continue;

          // Check dependencies
          if (s.dependsOn?.some((dep) => {
            const depStep = steps.find((x) => x.id === dep);
            return depStep && depStep.status !== "completed";
          })) continue;

          nextStepId = s.id;
          steps[i] = { ...steps[i], status: "active" };
          break;
        }

        // Store result and update collected data
        const collectedData = {
          ...prev.collectedData,
          [stepId]: result,
        };

        // Update chat threads
        const chatThreads = {
          ...prev.chatThreads,
          [stepId]: {
            ...(prev.chatThreads[stepId] || { messages: [] }),
            collapsed: true,
            summary: threadSummary,
          },
        };

        // Add initial guidance for next step
        if (nextStepId) {
          const nextStep = steps.find((s) => s.id === nextStepId);
          if (!chatThreads[nextStepId]) {
            chatThreads[nextStepId] = { messages: [], collapsed: false };
          }
          chatThreads[nextStepId].messages.push({
            role: "assistant",
            content: `Next: **${nextStep?.title}**\n\n${nextStep?.description || "Fill in the details below."}`,
          });
        }

        const isComplete = !nextStepId;

        return {
          ...prev,
          steps,
          currentStepId: nextStepId,
          collectedData,
          chatThreads,
          phase: isComplete ? "completed" : prev.phase,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    []
  );

  const handleStepSkip = useCallback((stepId: string) => {
    setViewingStepId(null);
    setState((prev) => {
      const steps = [...prev.steps];
      const idx = steps.findIndex((s) => s.id === stepId);
      if (idx === -1) return prev;

      steps[idx] = { ...steps[idx], status: "skipped" };

      // Also skip steps that depend on this one
      for (const s of steps) {
        if (s.dependsOn?.includes(stepId) && s.status === "pending") {
          s.status = "skipped";
        }
      }

      // Find next active step
      let nextStepId: string | null = null;
      for (let i = idx + 1; i < steps.length; i++) {
        if (steps[i].status === "pending") {
          nextStepId = steps[i].id;
          steps[i] = { ...steps[i], status: "active" };
          break;
        }
      }

      return {
        ...prev,
        steps,
        currentStepId: nextStepId,
        phase: nextStepId ? prev.phase : "completed",
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleStepError = useCallback((stepId: string, errors: string[]) => {
    setState((prev) => {
      const steps = prev.steps.map((s) =>
        s.id === stepId ? { ...s, status: "error" as const, validationErrors: errors } : s
      );
      return { ...prev, steps };
    });
  }, []);

  // ── Condition resolution ───────────────────────────────────────────────

  const handleConditionAnswer = useCallback(
    (stepId: string, answer: boolean) => {
      if (answer) {
        // User said yes — proceed with step
        setState((prev) => {
          const steps = prev.steps.map((s) =>
            s.id === stepId
              ? {
                  ...s,
                  condition: s.condition
                    ? { ...s.condition, resolved: true, answer: true }
                    : undefined,
                }
              : s
          );
          return { ...prev, steps };
        });
      } else {
        // User said no — skip step
        handleStepSkip(stepId);
      }
    },
    [handleStepSkip]
  );

  // ── Step navigation (click on completed step) ──────────────────────────

  const handleStepClick = useCallback((stepId: string) => {
    // Allow navigating to any completed or active step
    const step = state.steps.find((s) => s.id === stepId);
    if (!step) return;
    if (step.status === "completed" || step.id === state.currentStepId) {
      setViewingStepId(stepId === state.currentStepId ? null : stepId);
    }
  }, [state.steps, state.currentStepId]);

  // ── Clear draft on completion ──────────────────────────────────────────

  useEffect(() => {
    if (state.phase === "completed") {
      localStorage.removeItem(WORKFLOW_DRAFT_KEY);
    }
  }, [state.phase]);

  // ── Render ─────────────────────────────────────────────────────────────

  // The step the user is currently viewing (may differ from active frontier)
  const effectiveStepId = viewingStepId || state.currentStepId;
  const displayStep = state.steps.find((s) => s.id === effectiveStepId);
  const isViewingCompleted = displayStep?.status === "completed";
  const currentThreadId =
    state.phase === "planning"
      ? "planning"
      : effectiveStepId || "planning";

  // Navigation helpers
  const displayStepIndex = state.steps.findIndex((s) => s.id === effectiveStepId);
  const navigableSteps = state.steps.filter(
    (s) => s.status === "completed" || s.status === "active" || s.id === state.currentStepId
  );
  const prevStep = displayStepIndex > 0
    ? state.steps.slice(0, displayStepIndex).reverse().find(
        (s) => s.status === "completed" || s.status === "active"
      )
    : null;
  const nextStep = displayStepIndex < state.steps.length - 1
    ? state.steps.slice(displayStepIndex + 1).find(
        (s) => s.status === "completed" || s.status === "active"
      )
    : null;

  // Check if current step has an unresolved condition
  const showCondition =
    displayStep?.condition &&
    !displayStep.condition.resolved &&
    displayStep.condition.type === "user_choice";

  // Get the step form component
  const StepComponent = displayStep
    ? STEP_REGISTRY[displayStep.type] || PlaceholderStep
    : null;

  // Resolve prefilled values with collected data
  const resolvedPrefilled = displayStep
    ? resolvePrefilled(displayStep.prefilled, state.collectedData)
    : {};

  return (
    <div style={{ minHeight: "100vh" }}>
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
              textAlign: "center",
            }}
          >
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
              📋
            </div>
            <h3
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              Resume Workflow?
            </h3>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                marginBottom: 8,
                lineHeight: 1.5,
              }}
            >
              You have a saved workflow in progress:
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                fontWeight: 600,
                marginBottom: 24,
              }}
            >
              &ldquo;{savedDraft?.intentDescription || "Untitled workflow"}&rdquo;
              {savedDraft?.steps && savedDraft.steps.length > 0 && (
                <>
                  <br />
                  <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>
                    {savedDraft.steps.filter((s) => s.status === "completed").length} of{" "}
                    {savedDraft.steps.length} steps completed
                  </span>
                </>
              )}
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
                Start Fresh
              </button>
              <button
                onClick={handleRestoreDraft}
                style={{
                  padding: "12px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 10,
                  border: "none",
                  background:
                    "linear-gradient(135deg, var(--accent-primary) 0%, #6366f1 100%)",
                  color: "#fff",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                }}
              >
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Planning Phase: Full-width AI panel */}
      {state.phase === "planning" && (
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>
          <div style={{ marginBottom: 24 }}>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 32 }}>✨</span>
              New
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "6px 0 0" }}>
              Describe what you want to build and the AI will guide you through every step
            </p>
          </div>

          <div style={{ height: "calc(100vh - 160px)" }}>
            <WorkflowAIPanel
              phase={state.phase}
              chatThreads={state.chatThreads}
              currentThreadId="planning"
              steps={state.steps}
              currentStepId={null}
              plan={state.plan}
              planReady={planReady}
              onSendMessage={handleSendMessage}
              onConfirmPlan={handleConfirmPlan}
              onStop={handleStop}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}

      {/* Execution Phase: Side panel + step forms */}
      {state.phase === "executing" && (
        <div style={{ display: "flex", height: "100vh" }}>
          {/* AI side panel */}
          <div
            style={{
              width: 360,
              flexShrink: 0,
              height: "100%",
              overflowY: "auto",
            }}
          >
            <WorkflowAIPanel
              phase={state.phase}
              chatThreads={state.chatThreads}
              currentThreadId={currentThreadId}
              steps={state.steps}
              currentStepId={state.currentStepId}
              plan={state.plan}
              planReady={false}
              onSendMessage={handleSendMessage}
              onConfirmPlan={() => {}}
              onStop={handleStop}
              isLoading={isLoading}
            />
          </div>

          {/* Main content area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 24px" }}>
            {/* Step navigation */}
            <WorkflowStepper
              steps={state.steps}
              currentStepId={effectiveStepId}
              phase={state.phase}
              onStepClick={handleStepClick}
            />

            {/* Viewing a completed step — show read-only summary + nav */}
            {isViewingCompleted && displayStep ? (
              <div style={{ maxWidth: 800, paddingBottom: 60 }}>
                <div
                  style={{
                    padding: "20px 24px",
                    borderRadius: 14,
                    border: "1px solid var(--success-border)",
                    background: "var(--success-bg)",
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: "var(--success-text)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                      {displayStep.title} — Completed
                    </h3>
                  </div>
                  {displayStep.result && (
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {displayStep.result.name && (
                        <div><strong>Name:</strong> {displayStep.result.name}</div>
                      )}
                      {displayStep.result.slug && (
                        <div><strong>Slug:</strong> {displayStep.result.slug}</div>
                      )}
                      {displayStep.result.id && (
                        <div><strong>ID:</strong> {displayStep.result.id}</div>
                      )}
                      {displayStep.result.featureId && (
                        <div><strong>Feature ID:</strong> {displayStep.result.featureId}</div>
                      )}
                    </div>
                  )}
                </div>
                <StepNavButtons
                  prevStep={prevStep}
                  nextStep={nextStep}
                  currentStepId={state.currentStepId}
                  onNavigate={(id) => setViewingStepId(id === state.currentStepId ? null : id)}
                />
              </div>
            ) : showCondition && displayStep ? (
              <ConditionCard
                condition={displayStep.condition!}
                stepTitle={displayStep.title}
                onAnswer={(answer) =>
                  handleConditionAnswer(displayStep.id, answer)
                }
              />
            ) : StepComponent && displayStep ? (
              <div style={{ maxWidth: 800, paddingBottom: 60 }}>
                <StepComponent
                  step={displayStep}
                  prefilled={resolvedPrefilled}
                  collectedData={state.collectedData}
                  onComplete={(result) =>
                    handleStepComplete(displayStep.id, result)
                  }
                  onSkip={() => handleStepSkip(displayStep.id)}
                  onError={(errors) =>
                    handleStepError(displayStep.id, errors)
                  }
                  pendingFieldUpdates={pendingFieldUpdates || undefined}
                  onFieldUpdatesApplied={() => setPendingFieldUpdates(null)}
                />
                {/* Show nav buttons below active step form too */}
                {navigableSteps.length > 1 && (
                  <StepNavButtons
                    prevStep={prevStep}
                    nextStep={nextStep}
                    currentStepId={state.currentStepId}
                    onNavigate={(id) => setViewingStepId(id === state.currentStepId ? null : id)}
                  />
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Completed Phase */}
      {state.phase === "completed" && <CompletionSummary state={state} />}
    </div>
  );
}
