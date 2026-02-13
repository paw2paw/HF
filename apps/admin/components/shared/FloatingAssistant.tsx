"use client";

import { useState, useRef, useEffect } from "react";
import { useGlobalAssistant } from "@/contexts/AssistantContext";
import { UnifiedAssistantPanel } from "./UnifiedAssistantPanel";
import { useResponsive } from "@/hooks/useResponsive";

/**
 * Floating draggable assistant window
 */
export function FloatingAssistant() {
  const assistant = useGlobalAssistant();
  const { isMobile } = useResponsive();
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(assistant.floatingPosition);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Disable floating mode on mobile (force popout instead)
  if (isMobile) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;

      // Keep within bounds
      const maxX = window.innerWidth - 400;
      const maxY = window.innerHeight - 500;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      assistant.setFloatingPosition(position);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position, assistant]);

  if (!assistant.isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        width: 450,
        height: 600,
        zIndex: 2000,
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 40,
          cursor: isDragging ? "grabbing" : "grab",
          zIndex: 2001,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(99, 102, 241, 0.1)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>
          ⋮⋮ DRAG TO MOVE
        </div>
      </div>

      {/* Panel */}
      <div style={{ paddingTop: 40, height: "100%" }}>
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
    </div>
  );
}
