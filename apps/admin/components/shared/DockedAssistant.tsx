"use client";

import { useGlobalAssistant } from "@/contexts/AssistantContext";
import { UnifiedAssistantPanel } from "./UnifiedAssistantPanel";
import { useResponsive } from "@/hooks/useResponsive";

/**
 * Docked assistant window - anchored to a corner of the screen
 * Unlike floating mode, this stays in a fixed position relative to viewport edges
 */
export function DockedAssistant() {
  const assistant = useGlobalAssistant();
  const { isMobile } = useResponsive();

  // Disable docked mode on mobile (force popout instead)
  if (isMobile) return null;

  if (!assistant.isOpen) return null;

  // Position based on dock position
  const getPositionStyles = () => {
    const baseStyles = {
      position: "fixed" as const,
      width: 420,
      height: 550,
      zIndex: 1500,
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
      borderRadius: 12,
      overflow: "hidden",
    };

    switch (assistant.dockPosition) {
      case "top":
        return { ...baseStyles, top: 20, right: 20 };
      case "right":
        return { ...baseStyles, top: "50%", right: 20, transform: "translateY(-50%)" };
      case "bottom":
        return { ...baseStyles, bottom: 20, right: 20 };
      case "left":
        return { ...baseStyles, top: "50%", left: 20, transform: "translateY(-50%)" };
      default:
        return { ...baseStyles, bottom: 20, right: 20 };
    }
  };

  return (
    <div style={getPositionStyles()}>
      <UnifiedAssistantPanel
        visible={true}
        onClose={assistant.close}
        context={assistant.context}
        location={assistant.location}
        layout="embedded"
        defaultTab="chat"
        enabledTabs={["chat", "tasks", "data", "spec"]}
      />
    </div>
  );
}
