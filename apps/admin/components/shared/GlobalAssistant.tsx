"use client";

import { useEffect } from "react";
import { UnifiedAssistantPanel } from "./UnifiedAssistantPanel";
import { useGlobalAssistant } from "@/contexts/AssistantContext";
import { FloatingAssistant } from "./FloatingAssistant";
import { MinimizedAssistant } from "./MinimizedAssistant";
import { DockedAssistant } from "./DockedAssistant";

/**
 * Global AI Assistant with multiple layout modes
 * - Popout: Slides from edge (default)
 * - Floating: Draggable window
 * - Docked: Attached to screen edge
 * - Minimized: Small bubble
 */
export function GlobalAssistant() {
  const assistant = useGlobalAssistant();

  // Global Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        assistant.toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assistant]);

  // Render based on layout mode
  if (assistant.layoutMode === "minimized") {
    return <MinimizedAssistant />;
  }

  if (assistant.layoutMode === "floating") {
    return <FloatingAssistant />;
  }

  if (assistant.layoutMode === "docked") {
    return <DockedAssistant />;
  }

  // Popout mode (default)
  return (
    <UnifiedAssistantPanel
      visible={assistant.isOpen}
      onClose={assistant.close}
      context={assistant.context}
      location={assistant.location}
      layout="popout"
      defaultTab="chat"
      enabledTabs={["chat", "jobs", "data", "spec"]}
    />
  );
}
