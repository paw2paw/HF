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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "8px 12px",
        borderBottom: "1px solid var(--border-default)",
        overflowX: "auto",
        flexShrink: 0,
      }}
    >
      <button
        onClick={() => onThreadSelect("planning")}
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          border: "none",
          background:
            currentThreadId === "planning"
              ? "var(--accent-bg)"
              : "var(--surface-tertiary)",
          color:
            currentThreadId === "planning"
              ? "var(--accent-primary)"
              : "var(--text-muted)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Planning ✓
      </button>
      {steps.map((step) => {
        const isCurrent = step.id === currentStepId;
        const isCompleted = step.status === "completed";
        const isActive = step.id === currentThreadId;
        const indicator = isCompleted ? "✓" : isCurrent ? "●" : "○";
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
            <span
              style={{
                color: "var(--text-muted)",
                fontSize: 10,
                margin: "0 2px",
              }}
            >
              →
            </span>
            <button
              onClick={() => onThreadSelect(step.id)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                background: isActive
                  ? "var(--accent-bg)"
                  : isCompleted
                    ? "var(--success-bg)"
                    : "var(--surface-tertiary)",
                color: isActive
                  ? "var(--accent-primary)"
                  : isCompleted
                    ? "var(--success-text)"
                    : "var(--text-muted)",
                cursor: isCompleted || isCurrent ? "pointer" : "default",
                opacity: !isCompleted && !isCurrent ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
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
    <div
      style={{
        borderBottom: "1px solid var(--border-default)",
        background: isActive ? "transparent" : "var(--surface-secondary)",
      }}
    >
      {/* Thread header (clickable to expand/collapse) */}
      {!isActive && (
        <button
          onClick={() => onToggle(threadId)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {isCollapsed ? (
            <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
          ) : (
            <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
          )}
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              flex: 1,
            }}
          >
            {label}
          </span>
          {thread.summary && isCollapsed && (
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {thread.summary}
            </span>
          )}
          {isCollapsed && thread.messages.length > 0 && (
            <span
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                background: "var(--surface-tertiary)",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              {thread.messages.length} msg{thread.messages.length !== 1 ? "s" : ""}
            </span>
          )}
        </button>
      )}

      {/* Thread messages (shown when expanded) */}
      {!isCollapsed && (
        <div style={{ padding: isActive ? 0 : "0 12px 8px" }}>
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
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 8,
        opacity: isReadOnly ? 0.7 : 1,
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          padding: "10px 14px",
          borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          background: isUser
            ? "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary) 100%)"
            : "var(--surface-secondary)",
          color: isUser ? "var(--button-primary-text, var(--surface-primary))" : "var(--text-primary)",
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
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
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 12,
        paddingLeft: 4,
      }}
    >
      {options.map((option, i) => (
        <button
          key={i}
          onClick={() => !disabled && onSelect(option)}
          disabled={disabled}
          style={{
            padding: option.description ? "10px 16px" : "8px 16px",
            borderRadius: 12,
            border: "1px solid var(--border-default)",
            background: "var(--surface-primary)",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.5 : 1,
            textAlign: "left",
            transition: "all 0.15s ease",
            maxWidth: "100%",
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.borderColor = "var(--accent-primary)";
              e.currentTarget.style.background = "var(--accent-bg)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-default)";
            e.currentTarget.style.background = "var(--surface-primary)";
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.3,
            }}
          >
            {option.label}
          </div>
          {option.description && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginTop: 2,
                lineHeight: 1.3,
              }}
            >
              {option.description}
            </div>
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
    <div
      style={{
        margin: "12px 0",
        padding: 16,
        borderRadius: 12,
        border: "2px solid var(--accent-primary)",
        background: "var(--accent-bg)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--accent-primary)",
          marginBottom: 8,
        }}
      >
        Proposed Plan
      </div>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          margin: "0 0 12px",
          lineHeight: 1.4,
        }}
      >
        {plan.summary}
      </p>

      {plan.existingMatches.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Existing matches
          </div>
          {plan.existingMatches.map((match, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                padding: "4px 0",
              }}
            >
              ● <strong>{match.name}</strong> ({match.type}) — {match.matchReason}
              {match.action === "reuse" && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: "var(--success-bg)",
                    color: "var(--success-text)",
                  }}
                >
                  reuse
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Steps
        </div>
        {plan.steps.map((step, i) => (
          <div
            key={step.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "6px 0",
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-muted)",
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                {step.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {step.description}
              </div>
              {step.condition?.question && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--warning-text)",
                    fontStyle: "italic",
                    marginTop: 2,
                  }}
                >
                  Conditional: {step.condition.question}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onConfirm}
          style={{
            flex: 1,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            border: "none",
            background: "var(--accent-primary)",
            color: "var(--button-primary-text, var(--surface-primary))",
            cursor: "pointer",
            boxShadow: "0 4px 12px color-mix(in srgb, var(--accent-primary) 30%, transparent)",
          }}
        >
          Looks good — let's start
        </button>
      </div>
      <p
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          margin: "8px 0 0",
          textAlign: "center",
        }}
      >
        Or type to amend the plan
      </p>
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
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--surface-primary)",
        borderRadius: isPlanningPhase ? 16 : 0,
        border: isPlanningPhase
          ? "1px solid var(--border-default)"
          : "none",
        borderRight: !isPlanningPhase
          ? "1px solid var(--border-default)"
          : undefined,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px",
          borderBottom: "1px solid var(--border-default)",
          background: "var(--surface-secondary)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background:
              "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Bot size={18} color="var(--button-primary-text, var(--surface-primary))" />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {isPlanningPhase ? "What do you want to build?" : "Workflow Assistant"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
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
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: isPlanningPhase ? 16 : 0,
        }}
      >
        {/* Planning phase: show messages directly */}
        {isPlanningPhase && currentThread && (
          <>
            {currentThread.messages.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "var(--text-muted)",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 16 }}>✨</div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 8,
                  }}
                >
                  What do you want to accomplish?
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 400, margin: "0 auto" }}>
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: isPlanningPhase ? "8px 0" : "8px 12px",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            <Loader2
              size={14}
              style={{ animation: "spin 1s linear infinite" }}
            />
            Thinking...
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          padding: isPlanningPhase ? "12px 16px 16px" : "12px",
          borderTop: "1px solid var(--border-default)",
          background: "var(--surface-secondary)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
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
            style={{
              flex: 1,
              padding: "10px 14px",
              fontSize: 14,
              borderRadius: 12,
              border: "1px solid var(--border-default)",
              background: "var(--surface-primary)",
              color: "var(--text-primary)",
              outline: "none",
              resize: "none",
              fontFamily: "inherit",
              lineHeight: 1.5,
            }}
          />
          {isLoading ? (
            <button
              onClick={onStop}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: "1px solid var(--error-border, var(--status-error-text))",
                background: "var(--surface-primary)",
                color: "var(--error-text, var(--status-error-text))",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.15s ease",
              }}
              title="Stop generation"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: "none",
                background: input.trim()
                  ? "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary) 100%)"
                  : "var(--surface-tertiary)",
                color: input.trim() ? "var(--button-primary-text, var(--surface-primary))" : "var(--text-muted)",
                cursor: input.trim() ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.15s ease",
              }}
            >
              <Send size={16} />
            </button>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 6,
            textAlign: "right",
          }}
        >
          ⌘+Enter to send
        </div>
      </div>

      {/* CSS animation for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
