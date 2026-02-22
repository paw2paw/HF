"use client";

import { useState, useCallback, useEffect, useRef, type ComponentType } from "react";
import { WorkflowAIPanel } from "./WorkflowAIPanel";
import { WorkflowStepper } from "./WorkflowStepper";
import { ConditionCard } from "./ConditionCard";
import "./workflow-orchestrator.css";
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
    <div className="wo-placeholder">
      <div className="wo-placeholder-icon">🚧</div>
      <h3 className="wo-placeholder-title">{step.title}</h3>
      <p className="wo-placeholder-desc">
        The <strong>{step.type}</strong> step form is being built.
        <br />
        {step.description}
      </p>
      <div className="wo-placeholder-actions">
        {!step.required && (
          <button onClick={onSkip} className="wo-btn-skip">
            Skip
          </button>
        )}
        <button
          onClick={() => onComplete({ placeholder: true })}
          className="wo-btn-complete"
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
    <div className="wo-summary">
      <div className="wo-summary-icon">✓</div>
      <h2 className="wo-summary-title">Workflow Complete</h2>
      <p className="wo-summary-desc">{state.plan?.summary}</p>

      <div className="wo-summary-steps">
        {completedSteps.map((step) => (
          <div key={step.id} className="wo-summary-step-row">
            <span className="wo-check-badge">✓</span>
            <div className="hf-flex-1">
              <div className="wo-step-title">{step.title}</div>
              {step.result?.name && (
                <div className="wo-step-meta">
                  Created: {step.result.name}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => (window.location.href = "/x")}
        className="wo-btn-dashboard"
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

  const isCurrent = nextStep?.id === currentStepId;

  return (
    <div className="wo-nav-bar">
      {prevStep ? (
        <button
          onClick={() => onNavigate(prevStep.id)}
          className="wo-nav-btn wo-nav-btn-secondary"
        >
          ← {prevStep.title}
        </button>
      ) : (
        <div />
      )}
      {nextStep ? (
        <button
          onClick={() => onNavigate(nextStep.id)}
          className={`wo-nav-btn ${isCurrent ? "wo-nav-btn-primary" : "wo-nav-btn-secondary"}`}
        >
          {isCurrent ? "Back to Current Step" : nextStep.title} →
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
    <div className="wo-root">
      {/* Draft Restore Modal */}
      {showDraftPrompt && (
        <div className="wo-modal-overlay">
          <div className="wo-modal-card">
            <div className="wo-modal-icon">📋</div>
            <h3 className="wo-modal-title">Resume Workflow?</h3>
            <p className="wo-modal-text">
              You have a saved workflow in progress:
            </p>
            <p className="wo-modal-intent">
              &ldquo;{savedDraft?.intentDescription || "Untitled workflow"}&rdquo;
              {savedDraft?.steps && savedDraft.steps.length > 0 && (
                <>
                  <br />
                  <span className="wo-modal-intent-sub">
                    {savedDraft.steps.filter((s) => s.status === "completed").length} of{" "}
                    {savedDraft.steps.length} steps completed
                  </span>
                </>
              )}
            </p>
            <div className="wo-modal-actions">
              <button onClick={handleDiscardDraft} className="wo-btn-discard">
                Start Fresh
              </button>
              <button onClick={handleRestoreDraft} className="wo-btn-resume">
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Planning Phase: Full-width AI panel */}
      {state.phase === "planning" && (
        <div className="wo-planning-wrapper">
          <div className="wo-planning-header">
            <h1 className="wo-planning-title">
              <span className="wo-planning-title-icon">✨</span>
              New
            </h1>
            <p className="wo-planning-subtitle">
              Describe what you want to build and the AI will guide you through every step
            </p>
          </div>

          <div className="wo-planning-chat">
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
        <div className="wo-exec-layout">
          {/* AI side panel */}
          <div className="wo-exec-sidebar">
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
          <div className="wo-exec-main">
            {/* Step navigation */}
            <WorkflowStepper
              steps={state.steps}
              currentStepId={effectiveStepId}
              phase={state.phase}
              onStepClick={handleStepClick}
            />

            {/* Viewing a completed step — show read-only summary + nav */}
            {isViewingCompleted && displayStep ? (
              <div className="wo-exec-content">
                <div className="wo-completed-card">
                  <div className="wo-completed-header">
                    <span className="wo-check-badge-lg">✓</span>
                    <h3 className="wo-completed-title">
                      {displayStep.title} — Completed
                    </h3>
                  </div>
                  {displayStep.result && (
                    <div className="wo-completed-detail">
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
              <div className="wo-exec-content">
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
