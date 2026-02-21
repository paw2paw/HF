"use client";

import { useState, useEffect, useRef } from "react";

export interface AIAssistantPanelProps {
  visible?: boolean;
  onClose?: () => void;
  context?: {
    type: "spec" | "parameter" | "domain" | "caller";
    data: any;
  };
  location?: {
    page: string;
    section?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
  };
  endpoint?: string; // Custom API endpoint (defaults to /api/ai/assistant)
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  suggestions?: any; // Structured suggestions (e.g., JSON edits)
}

export function AIAssistantPanel({
  visible = false,
  onClose,
  context,
  location,
  endpoint = "/api/ai/assistant",
}: AIAssistantPanelProps) {
  const [isVisible, setIsVisible] = useState(visible);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add welcome message when panel opens with context
  useEffect(() => {
    if (isVisible && context && messages.length === 0) {
      const contextName = context.data?.name || context.data?.title || context.data?.slug;
      setMessages([
        {
          role: "assistant",
          content: `Hi! I'm here to help you understand and work with this ${context.type}${
            contextName ? ` (${contextName})` : ""
          }. Ask me anything!`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isVisible, context]);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.trim(),
          context,
          location,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (data.ok) {
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          suggestions: data.suggestions || data.fieldUpdates,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error || "Failed to get AI response");
      }
    } catch (error) {
      console.error("AI assistant error:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(2px)",
          zIndex: 999,
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          background: "var(--surface-primary)",
          borderLeft: "1px solid var(--border-default)",
          boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.15)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-default)",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary, #8b5cf6) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                }}
              >
                🤖
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  AI Assistant
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                  {context ? `Helping with ${context.type}` : "Ask me anything"}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-tertiary)";
                e.currentTarget.style.borderColor = "var(--border-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--surface-secondary)";
                e.currentTarget.style.borderColor = "var(--border-default)";
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {messages.map((message, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: message.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              {/* Message bubble */}
              <div
                style={{
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background:
                    message.role === "user"
                      ? "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary, #8b5cf6) 100%)"
                      : "var(--surface-secondary)",
                  color: message.role === "user" ? "var(--surface-primary)" : "var(--text-primary)",
                  fontSize: 14,
                  lineHeight: 1.5,
                  border:
                    message.role === "assistant" ? "1px solid var(--border-default)" : "none",
                }}
              >
                {message.content}
              </div>

              {/* Suggestions (if any) */}
              {message.suggestions && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 12,
                    background: "rgba(99, 102, 241, 0.05)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    borderRadius: 8,
                    maxWidth: "85%",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    💡 Suggested Changes
                  </div>
                  <pre
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      background: "var(--surface-primary)",
                      padding: 8,
                      borderRadius: 6,
                      overflow: "auto",
                      margin: 0,
                    }}
                  >
                    {JSON.stringify(message.suggestions, null, 2)}
                  </pre>
                  <button
                    style={{
                      marginTop: 8,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: "1px solid var(--accent-primary)",
                      background: "var(--accent-primary)",
                      color: "var(--surface-primary)",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      // TODO: Implement apply suggestions
                      console.log("Apply suggestions:", message.suggestions);
                    }}
                  >
                    Apply Changes
                  </button>
                </div>
              )}

              {/* Timestamp */}
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-placeholder)",
                  marginTop: 4,
                }}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                background: "var(--surface-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 12,
                maxWidth: "85%",
                fontSize: 14,
                color: "var(--text-muted)",
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid var(--border-default)",
                  borderTopColor: "var(--accent-primary)",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Thinking...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border-default)",
            background: "var(--surface-secondary)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 10,
              padding: 8,
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything..."
              disabled={loading}
              rows={1}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                resize: "none",
                fontSize: 14,
                color: "var(--text-primary)",
                fontFamily: "inherit",
                padding: "4px 8px",
                minHeight: 28,
                maxHeight: 120,
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "28px";
                target.style.height = target.scrollHeight + "px";
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: "none",
                background: !input.trim() || loading ? "var(--surface-disabled)" : "var(--accent-primary)",
                color: !input.trim() || loading ? "var(--text-placeholder)" : "var(--surface-primary)",
                cursor: !input.trim() || loading ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 13,
                transition: "all 0.2s ease",
              }}
            >
              Send
            </button>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "var(--text-placeholder)",
              textAlign: "center",
            }}
          >
            Press Enter to send • Shift+Enter for new line
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
