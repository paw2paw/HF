"use client";

import { useGlobalAssistant } from "@/contexts/AssistantContext";

/**
 * Minimized floating bubble
 * Click to expand
 */
export function MinimizedAssistant() {
  const assistant = useGlobalAssistant();

  return (
    <button
      onClick={() => {
        assistant.setLayoutMode("popout");
        assistant.open();
      }}
      title="Open AI Assistant (Cmd+K)"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        border: "none",
        boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
        zIndex: 1000,
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.1)";
        e.currentTarget.style.boxShadow = "0 6px 30px rgba(99, 102, 241, 0.6)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(99, 102, 241, 0.4)";
      }}
    >
      🤖
    </button>
  );
}
