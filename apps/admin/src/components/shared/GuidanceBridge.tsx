"use client";

import { useEffect } from "react";
import { useChatContext } from "@/contexts/ChatContext";
import { useGuidance } from "@/contexts/GuidanceContext";

/**
 * GuidanceBridge
 *
 * Connects ChatContext and GuidanceContext by watching for pending
 * guidance directives from AI chat responses and executing them
 * on the guidance context (e.g., highlighting sidebar items).
 *
 * Place this component inside both ChatProvider and GuidanceProvider.
 */
export function GuidanceBridge() {
  const { pendingGuidance, consumeGuidance, isStreaming } = useChatContext();
  const guidance = useGuidance();

  useEffect(() => {
    // Process pending guidance when available
    if (pendingGuidance.length > 0 && guidance) {
      console.log("[GuidanceBridge] Processing guidance:", pendingGuidance);
      const directives = consumeGuidance();

      for (const directive of directives) {
        if (directive.action === "highlight") {
          console.log("[GuidanceBridge] Highlighting:", directive.target);
          guidance.highlightSidebar(
            directive.target,
            directive.type || "pulse",
            15000, // 15 seconds
            directive.message
          );
        }
      }
    }
  }, [pendingGuidance, consumeGuidance, guidance]);

  // This component doesn't render anything
  return null;
}
