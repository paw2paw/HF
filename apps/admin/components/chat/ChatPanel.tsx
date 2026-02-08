"use client";

import React from "react";
import { useChatContext, useChatKeyboardShortcut, MODE_CONFIG } from "@/contexts/ChatContext";
import { useEntityContext, ENTITY_COLORS, EntityBreadcrumb } from "@/contexts/EntityContext";
import { useEntityDetection } from "@/hooks/useEntityDetection";

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
          color: "#9ca3af",
          background: "#f9fafb",
          borderBottom: "1px solid #e5e7eb",
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
        background: "#f9fafb",
        borderBottom: "1px solid #e5e7eb",
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
            {i > 0 && <span style={{ color: "#9ca3af" }}>›</span>}
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

function ModeTabs() {
  const { mode, setMode } = useChatContext();

  return (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid #e5e7eb",
        background: "white",
      }}
    >
      {(Object.keys(MODE_CONFIG) as Array<keyof typeof MODE_CONFIG>).map((m) => {
        const config = MODE_CONFIG[m];
        const isActive = mode === m;

        return (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1,
              padding: "10px 8px",
              border: "none",
              borderBottom: isActive ? `2px solid ${config.color}` : "2px solid transparent",
              background: isActive ? "#f9fafb" : "white",
              color: isActive ? config.color : "#6b7280",
              fontSize: 12,
              fontWeight: isActive ? 600 : 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              transition: "all 0.15s",
            }}
            title={config.description}
          >
            <span>{config.icon}</span>
            <span>{config.label}</span>
          </button>
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
          color: "#9ca3af",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 48, marginBottom: 16 }}>{config.icon}</span>
        <p style={{ fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 4 }}>
          {config.label} Mode
        </p>
        <p style={{ fontSize: 12 }}>{config.description}</p>
        <p style={{ fontSize: 11, marginTop: 16, color: "#9ca3af" }}>
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

        return (
          <div
            key={msg.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: isUser ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: 12,
                background: isUser ? "#3b82f6" : hasError ? "#fef2f2" : "#f3f4f6",
                color: isUser ? "white" : hasError ? "#dc2626" : "#1f2937",
                fontSize: 13,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {msg.content || (isCurrentStreaming ? "..." : "")}
              {isCurrentStreaming && (
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 14,
                    background: "#6b7280",
                    marginLeft: 2,
                    animation: "blink 1s infinite",
                  }}
                />
              )}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#9ca3af",
                marginTop: 4,
                paddingLeft: isUser ? 0 : 4,
                paddingRight: isUser ? 4 : 0,
              }}
            >
              {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {msg.metadata?.command && (
                <span style={{ marginLeft: 8, color: "#8b5cf6" }}>{msg.metadata.command}</span>
              )}
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
        borderTop: "1px solid #e5e7eb",
        background: "white",
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
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 13,
            resize: "none",
            minHeight: 40,
            maxHeight: 120,
            outline: "none",
            fontFamily: "inherit",
            background: "#ffffff",
            color: "#111827",
            caretColor: "#111827",
            WebkitTextFillColor: "#111827",
          } as React.CSSProperties}
          rows={1}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={cancelStream}
            style={{
              padding: "10px 16px",
              background: "#ef4444",
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
              background: input.trim() ? config.color : "#e5e7eb",
              color: input.trim() ? "white" : "#9ca3af",
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
      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6, textAlign: "center" }}>
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
      background: "white",
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
          borderTop: "1px solid #e5e7eb",
          boxShadow: isOpen ? "0 -4px 24px rgba(0,0,0,0.1)" : "none",
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
          border: "1px solid #e5e7eb",
          boxShadow: isOpen ? "0 8px 32px rgba(0,0,0,0.15)" : "none",
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
          borderLeft: "1px solid #e5e7eb",
          boxShadow: isOpen ? "-4px 0 24px rgba(0,0,0,0.1)" : "none",
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
            background: "rgba(0,0,0,0.3)",
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
            borderBottom: "1px solid #e5e7eb",
            background: "white",
            borderRadius: chatLayout === "popout" ? "12px 12px 0 0" : undefined,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>{config.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>AI Assistant</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{config.description}</div>
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
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                background: "white",
                cursor: "pointer",
                fontSize: 14,
                color: "#6b7280",
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
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                background: "white",
                cursor: "pointer",
                fontSize: 16,
                color: "#6b7280",
              }}
              title="Close (Cmd+K)"
            >
              ×
            </button>
          </div>
        </div>

        {/* Context Breadcrumbs */}
        <ChatBreadcrumbStripe breadcrumbs={breadcrumbs} />

        {/* Mode Tabs */}
        <ModeTabs />

        {/* Messages */}
        <ChatMessages />

        {/* Input */}
        <ChatInput />
      </div>
    </>
  );
}

export default ChatPanel;
