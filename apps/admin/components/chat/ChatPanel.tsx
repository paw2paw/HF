"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatContext, useChatKeyboardShortcut, MODE_CONFIG } from "@/contexts/ChatContext";
import { useEntityContext, ENTITY_COLORS, EntityBreadcrumb } from "@/contexts/EntityContext";
import { useEntityDetection } from "@/hooks/useEntityDetection";
import { AIModelBadge } from "@/components/shared/AIModelBadge";

// Sub-components
function ChatBreadcrumbStripe({ breadcrumbs }: { breadcrumbs: EntityBreadcrumb[] }) {
  const { clearToEntity } = useEntityContext();

  // Deduplicate breadcrumbs by ID (keep first occurrence)
  const uniqueBreadcrumbs = breadcrumbs.filter(
    (crumb, index, self) => self.findIndex((c) => c.id === crumb.id) === index
  );

  if (uniqueBreadcrumbs.length === 0) {
    return (
      <div
        style={{
          padding: "8px 16px",
          fontSize: 12,
          color: "var(--text-muted)",
          background: "var(--surface-secondary)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        No context selected - navigate to a caller or call to add context
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "8px 16px",
        background: "var(--surface-secondary)",
        borderBottom: "1px solid var(--border-default)",
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexWrap: "wrap",
        fontSize: 12,
      }}
    >
      {uniqueBreadcrumbs.map((crumb, i) => {
        const colors = ENTITY_COLORS[crumb.type];
        return (
          <React.Fragment key={crumb.id}>
            {i > 0 && <span style={{ color: "var(--text-muted)" }}>›</span>}
            <button
              onClick={() => clearToEntity(crumb.id)}
              style={{
                background: colors.bg,
                color: colors.text,
                padding: "2px 8px",
                borderRadius: 4,
                border: `1px solid ${colors.border}`,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 500,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              title={`Click to clear context after ${crumb.label}`}
            >
              {crumb.type}: {crumb.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}


function ChatMessages() {
  const { messages, mode, isStreaming, streamingMessageId } = useChatContext();
  const currentMessages = messages[mode];
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  if (currentMessages.length === 0) {
    const config = MODE_CONFIG[mode];
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 48, marginBottom: 16 }}>{config.icon}</span>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
          {config.label} Mode
        </p>
        <p style={{ fontSize: 12 }}>{config.description}</p>
        <p style={{ fontSize: 11, marginTop: 16, color: "var(--text-muted)" }}>
          Type a message or use /help for commands
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {currentMessages.map((msg) => {
        const isUser = msg.role === "user";
        const isCurrentStreaming = isStreaming && msg.id === streamingMessageId;
        const hasError = msg.metadata?.error;
        const toolCalls = msg.metadata?.toolCalls;

        return (
          <div
            key={msg.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: isUser ? "flex-end" : "flex-start",
            }}
          >
            {/* Tool usage indicator */}
            {!isUser && toolCalls && toolCalls > 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--accent-secondary, #8b5cf6)",
                  marginBottom: 4,
                  paddingLeft: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 12 }}>&#x1F527;</span>
                <span>Used {toolCalls} tool{toolCalls > 1 ? "s" : ""}</span>
              </div>
            )}
            <div
              style={{
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: 12,
                background: isUser ? "var(--accent-primary)" : hasError ? "color-mix(in srgb, var(--status-error-text) 10%, transparent)" : "var(--surface-secondary)",
                color: isUser ? "white" : hasError ? "var(--status-error-text)" : "var(--text-primary)",
                fontSize: 13,
                lineHeight: 1.5,
                wordBreak: "break-word",
                ...(isUser ? { whiteSpace: "pre-wrap" as const } : {}),
              }}
            >
              {isUser ? (
                msg.content || ""
              ) : (
                <div className="chat-markdown">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p style={{ margin: "0 0 8px 0" }}>{children}</p>,
                      strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                      code: ({ children, className }) => {
                        const isBlock = className?.includes("language-");
                        if (isBlock) {
                          return (
                            <code
                              style={{
                                display: "block",
                                background: "var(--text-primary)",
                                color: "var(--border-default)",
                                padding: 12,
                                borderRadius: 6,
                                fontSize: 12,
                                overflowX: "auto",
                                whiteSpace: "pre",
                                margin: "8px 0",
                              }}
                            >
                              {children}
                            </code>
                          );
                        }
                        return (
                          <code
                            style={{
                              background: "var(--border-default)",
                              padding: "1px 4px",
                              borderRadius: 3,
                              fontSize: 12,
                            }}
                          >
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => <div>{children}</div>,
                      ul: ({ children }) => <ul style={{ margin: "4px 0", paddingLeft: 20 }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ margin: "4px 0", paddingLeft: 20 }}>{children}</ol>,
                      li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
                      table: ({ children }) => (
                        <table
                          style={{
                            borderCollapse: "collapse",
                            fontSize: 12,
                            margin: "8px 0",
                            width: "100%",
                          }}
                        >
                          {children}
                        </table>
                      ),
                      th: ({ children }) => (
                        <th
                          style={{
                            border: "1px solid var(--border-default)",
                            padding: "4px 8px",
                            background: "var(--border-default)",
                            fontWeight: 600,
                            textAlign: "left",
                          }}
                        >
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td style={{ border: "1px solid var(--border-default)", padding: "4px 8px" }}>{children}</td>
                      ),
                      h3: ({ children }) => (
                        <h3 style={{ fontSize: 14, fontWeight: 600, margin: "12px 0 4px 0" }}>{children}</h3>
                      ),
                      h4: ({ children }) => (
                        <h4 style={{ fontSize: 13, fontWeight: 600, margin: "8px 0 4px 0" }}>{children}</h4>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote
                          style={{
                            borderLeft: "3px solid var(--accent-secondary, #8b5cf6)",
                            paddingLeft: 12,
                            margin: "8px 0",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {msg.content || (isCurrentStreaming ? "..." : "")}
                  </ReactMarkdown>
                </div>
              )}
              {isCurrentStreaming && (
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 14,
                    background: "var(--text-muted)",
                    marginLeft: 2,
                    animation: "blink 1s infinite",
                  }}
                />
              )}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                marginTop: 4,
                paddingLeft: isUser ? 0 : 4,
                paddingRight: isUser ? 4 : 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {msg.metadata?.command && (
                <span style={{ marginLeft: 8, color: "var(--accent-secondary, #8b5cf6)" }}>{msg.metadata.command}</span>
              )}
              {!isUser && <AIModelBadge callPoint={`chat.${mode.toLowerCase()}`} variant="text" size="sm" />}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function ChatInput() {
  const { sendMessage, isStreaming, cancelStream, mode } = useChatContext();
  const [input, setInput] = React.useState("");
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;
    const message = input;
    setInput("");
    await sendMessage(message);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const config = MODE_CONFIG[mode];

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: 12,
        borderTop: "1px solid var(--border-default)",
        background: "var(--surface-primary)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${config.label}... (or /help)`}
          disabled={isStreaming}
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            fontSize: 13,
            resize: "none",
            minHeight: 40,
            maxHeight: 120,
            outline: "none",
            fontFamily: "inherit",
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
            caretColor: "var(--text-primary)",
            WebkitTextFillColor: "var(--text-primary)",
          } as React.CSSProperties}
          rows={1}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={cancelStream}
            style={{
              padding: "10px 16px",
              background: "var(--status-error-text)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            style={{
              padding: "10px 16px",
              background: input.trim() ? config.color : "var(--border-default)",
              color: input.trim() ? "white" : "var(--text-muted)",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: input.trim() ? "pointer" : "not-allowed",
            }}
          >
            Send
          </button>
        )}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, textAlign: "center" }}>
        Press Enter to send, Shift+Enter for new line
      </div>
    </form>
  );
}

export function ChatPanel() {
  const { isOpen, closePanel, mode, chatLayout, setChatLayout } = useChatContext();
  const { breadcrumbs } = useEntityContext();

  // Register keyboard shortcut
  useChatKeyboardShortcut();

  // Auto-detect entities from URL
  useEntityDetection();

  const config = MODE_CONFIG[mode];

  // Layout-specific styles
  const getLayoutStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: "fixed",
      background: "var(--surface-primary)",
      display: "flex",
      flexDirection: "column",
      zIndex: 50,
      transition: "all 200ms ease-out",
    };

    switch (chatLayout) {
      case "horizontal":
        return {
          ...baseStyles,
          left: 0,
          right: 0,
          bottom: 0,
          height: 320,
          borderTop: "1px solid var(--border-default)",
          boxShadow: isOpen ? "0 -4px 24px color-mix(in srgb, var(--text-primary) 10%, transparent)" : "none",
          transform: isOpen ? "translateY(0)" : "translateY(100%)",
        };
      case "popout":
        return {
          ...baseStyles,
          right: 24,
          bottom: 24,
          width: 420,
          height: 560,
          borderRadius: 12,
          border: "1px solid var(--border-default)",
          boxShadow: isOpen ? "0 8px 32px color-mix(in srgb, var(--text-primary) 15%, transparent)" : "none",
          transform: isOpen ? "scale(1)" : "scale(0.9)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        };
      case "vertical":
      default:
        return {
          ...baseStyles,
          right: 0,
          top: 0,
          width: 400,
          height: "100vh",
          borderLeft: "1px solid var(--border-default)",
          boxShadow: isOpen ? "-4px 0 24px color-mix(in srgb, var(--text-primary) 10%, transparent)" : "none",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
        };
    }
  };

  const layoutLabels: Record<string, { icon: string; title: string }> = {
    vertical: { icon: "│", title: "Vertical (sidebar)" },
    horizontal: { icon: "─", title: "Horizontal (bottom)" },
    popout: { icon: "⧉", title: "Popout (floating)" },
  };

  const cycleLayout = () => {
    const layouts: Array<"vertical" | "horizontal" | "popout"> = ["vertical", "horizontal", "popout"];
    const idx = layouts.indexOf(chatLayout);
    setChatLayout(layouts[(idx + 1) % layouts.length]);
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          onClick={closePanel}
          style={{
            position: "fixed",
            inset: 0,
            background: "color-mix(in srgb, var(--text-primary) 30%, transparent)",
            zIndex: 40,
            display: "none", // Hidden on desktop, show on mobile via media query
          }}
        />
      )}

      {/* Panel */}
      <div style={getLayoutStyles()}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-default)",
            background: "var(--surface-primary)",
            borderRadius: chatLayout === "popout" ? "12px 12px 0 0" : undefined,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>{config.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>AI Assistant</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{config.description}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={cycleLayout}
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                background: "var(--surface-primary)",
                cursor: "pointer",
                fontSize: 14,
                color: "var(--text-muted)",
              }}
              title={`Layout: ${layoutLabels[chatLayout].title} (click to change)`}
            >
              {layoutLabels[chatLayout].icon}
            </button>
            <button
              onClick={closePanel}
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                background: "var(--surface-primary)",
                cursor: "pointer",
                fontSize: 16,
                color: "var(--text-muted)",
              }}
              title="Close (Cmd+K)"
            >
              ×
            </button>
          </div>
        </div>

        {/* AI Chat Interface */}
        <>
          {/* Context Breadcrumbs */}
          <ChatBreadcrumbStripe breadcrumbs={breadcrumbs} />

          {/* Messages */}
          <ChatMessages />

          {/* Input */}
          <ChatInput />
        </>
      </div>
    </>
  );
}

export default ChatPanel;
