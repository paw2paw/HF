"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Square, ChevronDown, ChevronRight, Bot, Loader2 } from "lucide-react";
import { AIModelBadge } from "@/components/shared/AIModelBadge";
import type {
  ChatMessage,
  ChatOption,
  ChatThread,
  WorkflowStep,
  WorkflowPhase,
  WorkflowPlan,
} from "@/lib/workflow/types";
import "./workflow-ai-panel.css";

// ============================================================================
// Types
// ============================================================================

interface WorkflowAIPanelProps {
  phase: WorkflowPhase;
  chatThreads: Record<string, ChatThread>;
  currentThreadId: string;
  steps: WorkflowStep[];
  currentStepId: string | null;
  plan: WorkflowPlan | null;
  planReady: boolean;
  onSendMessage: (message: string) => void;
  onConfirmPlan: () => void;
  onStop: () => void;
  isLoading: boolean;
}

// ============================================================================
// Breadcrumb Bar (shown during execution phase)
// ============================================================================

function BreadcrumbBar({
  steps,
  currentStepId,
  currentThreadId,
  onThreadSelect,
}: {
  steps: WorkflowStep[];
  currentStepId: string | null;
  currentThreadId: string;
  onThreadSelect: (threadId: string) => void;
}) {
  return (
    <div className="wap-breadcrumb">
      <button
        onClick={() => onThreadSelect("planning")}
        className={`wap-breadcrumb-btn ${
          currentThreadId === "planning"
            ? "wap-breadcrumb-btn-active"
            : "wap-breadcrumb-btn-inactive"
        }`}
      >
        Planning ✓
      </button>
      {steps.map((step) => {
        const isCurrent = step.id === currentStepId;
        const isCompleted = step.status === "completed";
        const isActive = step.id === currentThreadId;
        const indicator = isCompleted ? "✓" : isCurrent ? "●" : "○";
        return (
          <div key={step.id} className="hf-flex hf-items-center">
            <span className="wap-breadcrumb-sep">→</span>
            <button
              onClick={() => onThreadSelect(step.id)}
              className={`wap-breadcrumb-btn ${
                isActive
                  ? "wap-breadcrumb-btn-active"
                  : isCompleted
                    ? "wap-breadcrumb-step-completed"
                    : "wap-breadcrumb-btn-inactive"
              }${!isCompleted && !isCurrent ? " wap-breadcrumb-step-disabled" : ""}`}
            >
              {indicator} {step.title}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Thread View (collapsible message thread)
// ============================================================================

function ThreadView({
  threadId,
  thread,
  label,
  isActive,
  isReadOnly,
  onToggle,
}: {
  threadId: string;
  thread: ChatThread;
  label: string;
  isActive: boolean;
  isReadOnly: boolean;
  onToggle: (threadId: string) => void;
}) {
  if (thread.messages.length === 0 && !isActive) return null;

  const isCollapsed = thread.collapsed && !isActive;

  return (
    <div className={`wap-thread${!isActive ? " wap-thread-inactive" : ""}`}>
      {/* Thread header (clickable to expand/collapse) */}
      {!isActive && (
        <button
          onClick={() => onToggle(threadId)}
          className="wap-thread-header"
        >
          {isCollapsed ? (
            <ChevronRight size={14} className="wap-thread-chevron" />
          ) : (
            <ChevronDown size={14} className="wap-thread-chevron" />
          )}
          <span className="wap-thread-label">{label}</span>
          {thread.summary && isCollapsed && (
            <span className="wap-thread-summary">{thread.summary}</span>
          )}
          {isCollapsed && thread.messages.length > 0 && (
            <span className="wap-thread-count">
              {thread.messages.length} msg{thread.messages.length !== 1 ? "s" : ""}
            </span>
          )}
        </button>
      )}

      {/* Thread messages (shown when expanded) */}
      {!isCollapsed && (
        <div className={isActive ? "wap-thread-messages-active" : "wap-thread-messages"}>
          {thread.messages.map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Message Bubble
// ============================================================================

function MessageBubble({
  message,
  isReadOnly,
}: {
  message: ChatMessage;
  isReadOnly: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={`wap-msg-row ${isUser ? "wap-msg-row-user" : "wap-msg-row-assistant"}${
        isReadOnly ? " wap-msg-row-readonly" : ""
      }`}
    >
      <div
        className={`wap-msg-bubble ${
          isUser ? "wap-msg-bubble-user" : "wap-msg-bubble-assistant"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

// ============================================================================
// Option Buttons (Claude-style clickable choices)
// ============================================================================

function OptionButtons({
  options,
  onSelect,
  disabled,
}: {
  options: ChatOption[];
  onSelect: (option: ChatOption) => void;
  disabled: boolean;
}) {
  return (
    <div className="wap-options">
      {options.map((option, i) => (
        <button
          key={i}
          onClick={() => !disabled && onSelect(option)}
          disabled={disabled}
          className={`wap-option-btn${option.description ? " wap-option-btn-with-desc" : ""}`}
        >
          <div className="wap-option-label">{option.label}</div>
          {option.description && (
            <div className="wap-option-desc">{option.description}</div>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Plan Preview Card
// ============================================================================

function PlanPreview({
  plan,
  onConfirm,
}: {
  plan: WorkflowPlan;
  onConfirm: () => void;
}) {
  return (
    <div className="wap-plan">
      <div className="wap-plan-title">Proposed Plan</div>
      <p className="wap-plan-summary">{plan.summary}</p>

      {plan.existingMatches.length > 0 && (
        <div className="hf-mb-12">
          <div className="wap-plan-section-label">Existing matches</div>
          {plan.existingMatches.map((match, i) => (
            <div key={i} className="wap-plan-match">
              ● <strong>{match.name}</strong> ({match.type}) — {match.matchReason}
              {match.action === "reuse" && (
                <span className="wap-plan-reuse-badge">reuse</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="hf-mb-md">
        <div className="wap-plan-section-label wap-plan-section-label-steps">Steps</div>
        {plan.steps.map((step, i) => (
          <div key={step.id} className="wap-plan-step">
            <span className="wap-plan-step-number">{i + 1}</span>
            <div>
              <div className="wap-plan-step-title">{step.title}</div>
              <div className="wap-plan-step-desc">{step.description}</div>
              {step.condition?.question && (
                <div className="wap-plan-step-condition">
                  Conditional: {step.condition.question}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="wap-plan-actions">
        <button onClick={onConfirm} className="wap-plan-confirm-btn">
          Looks good — let&apos;s start
        </button>
      </div>
      <p className="wap-plan-hint">Or type to amend the plan</p>
    </div>
  );
}

// ============================================================================
// Main AI Panel
// ============================================================================

export function WorkflowAIPanel({
  phase,
  chatThreads,
  currentThreadId,
  steps,
  currentStepId,
  plan,
  planReady,
  onSendMessage,
  onConfirmPlan,
  onStop,
  isLoading,
}: WorkflowAIPanelProps) {
  const [input, setInput] = useState("");
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of current thread
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatThreads, currentThreadId]);

  // Focus input on thread change
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentThreadId]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
  }, [input, isLoading, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleThreadToggle = useCallback(
    (threadId: string) => {
      setExpandedThreadId((prev) =>
        prev === threadId ? null : threadId
      );
    },
    []
  );

  const currentThread = chatThreads[currentThreadId];
  const isPlanningPhase = phase === "planning";

  return (
    <div
      className={`wap-panel ${isPlanningPhase ? "wap-panel-planning" : "wap-panel-execution"}`}
    >
      {/* Header */}
      <div className="wap-header">
        <div className="wap-header-icon">
          <Bot size={18} color="var(--button-primary-text, var(--surface-primary))" />
        </div>
        <div className="hf-flex-1">
          <div className="wap-header-title">
            {isPlanningPhase ? "What do you want to build?" : "Workflow Assistant"}
          </div>
          <div className="wap-header-subtitle">
            {isPlanningPhase
              ? "Describe what you want to accomplish"
              : `Step ${steps.findIndex((s) => s.id === currentStepId) + 1} of ${steps.length}`}
          </div>
        </div>
        <AIModelBadge callPoint="workflow.classify" />
      </div>

      {/* Breadcrumb bar (execution phase only) */}
      {!isPlanningPhase && steps.length > 0 && (
        <BreadcrumbBar
          steps={steps}
          currentStepId={currentStepId}
          currentThreadId={expandedThreadId || currentThreadId}
          onThreadSelect={(id) => {
            if (id === currentThreadId) {
              setExpandedThreadId(null);
            } else {
              setExpandedThreadId(id);
            }
          }}
        />
      )}

      {/* Chat area */}
      <div className={`wap-chat ${isPlanningPhase ? "wap-chat-planning" : "wap-chat-execution"}`}>
        {/* Planning phase: show messages directly */}
        {isPlanningPhase && currentThread && (
          <>
            {currentThread.messages.length === 0 && (
              <div className="wap-empty">
                <div className="wap-empty-icon">✨</div>
                <div className="wap-empty-title">What do you want to accomplish?</div>
                <div className="wap-empty-desc">
                  Describe your goal in plain English. For example:
                  <br />
                  &ldquo;I want a new Food Safety Level 2 Tutor&rdquo;
                  <br />
                  &ldquo;Add a mindfulness companion domain&rdquo;
                  <br />
                  &ldquo;Create a measure spec for engagement&rdquo;
                </div>
              </div>
            )}
            {currentThread.messages.map((msg, i) => {
              const isLastAssistant =
                msg.role === "assistant" &&
                i === currentThread.messages.length - 1;
              return (
                <div key={i}>
                  <MessageBubble message={msg} isReadOnly={false} />
                  {isLastAssistant && msg.options && msg.options.length > 0 && (
                    <OptionButtons
                      options={msg.options}
                      onSelect={(opt) => onSendMessage(opt.label)}
                      disabled={isLoading}
                    />
                  )}
                </div>
              );
            })}
            {plan && planReady && (
              <PlanPreview plan={plan} onConfirm={onConfirmPlan} />
            )}
          </>
        )}

        {/* Execution phase: show threaded conversations */}
        {!isPlanningPhase && (
          <>
            {/* Planning thread (always first, collapsed) */}
            {chatThreads.planning && (
              <ThreadView
                threadId="planning"
                thread={{
                  ...chatThreads.planning,
                  collapsed:
                    expandedThreadId !== "planning" &&
                    chatThreads.planning.collapsed,
                }}
                label="Planning"
                isActive={expandedThreadId === "planning"}
                isReadOnly={true}
                onToggle={handleThreadToggle}
              />
            )}

            {/* Step threads */}
            {steps.map((step) => {
              const thread = chatThreads[step.id];
              if (!thread) return null;
              const isViewing = expandedThreadId === step.id;
              const isCurrent =
                step.id === currentStepId && expandedThreadId === null;
              return (
                <ThreadView
                  key={step.id}
                  threadId={step.id}
                  thread={{
                    ...thread,
                    collapsed:
                      !isViewing && !isCurrent && thread.collapsed,
                  }}
                  label={step.title}
                  isActive={isViewing || isCurrent}
                  isReadOnly={step.status === "completed"}
                  onToggle={handleThreadToggle}
                />
              );
            })}
          </>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className={`wap-loading ${isPlanningPhase ? "wap-loading-planning" : "wap-loading-execution"}`}>
            <Loader2 size={14} className="wap-loading-spinner" />
            Thinking...
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div className={`wap-input-area ${isPlanningPhase ? "wap-input-area-planning" : "wap-input-area-execution"}`}>
        <div className="wap-input-row">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isPlanningPhase
                ? "Describe what you want to build..."
                : "Ask about this step..."
            }
            rows={isPlanningPhase ? 3 : 2}
            className="wap-textarea"
          />
          {isLoading ? (
            <button
              onClick={onStop}
              className="wap-action-btn wap-stop-btn"
              title="Stop generation"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={`wap-action-btn ${input.trim() ? "wap-send-btn-active" : "wap-send-btn-disabled"}`}
            >
              <Send size={16} />
            </button>
          )}
        </div>
        <div className="wap-shortcut-hint">⌘+Enter to send</div>
      </div>
    </div>
  );
}
