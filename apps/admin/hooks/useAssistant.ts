"use client";

import { useState, useCallback, useEffect } from "react";
import type { AssistantTab, AssistantLayout } from "@/components/shared/UnifiedAssistantPanel";

export interface AssistantContext {
  type: "spec" | "parameter" | "domain" | "caller" | "demo";
  data: any;
}

export interface AssistantLocation {
  page: string;
  section?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
}

export interface UseAssistantOptions {
  defaultTab?: AssistantTab;
  layout?: AssistantLayout;
  enabledTabs?: AssistantTab[];
  endpoint?: string;
}

export function useAssistant(options: UseAssistantOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<AssistantContext | undefined>();
  const [location, setLocation] = useState<AssistantLocation | undefined>();

  const open = useCallback(
    (assistantContext?: AssistantContext, assistantLocation?: AssistantLocation) => {
      setContext(assistantContext);
      setLocation(assistantLocation);
      setIsOpen(true);
    },
    []
  );

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const openWithSpec = useCallback((spec: any) => {
    setContext({ type: "spec", data: spec });
    setLocation({ page: "/x/specs", entityType: "spec", entityId: spec.id });
    setIsOpen(true);
  }, []);

  const openWithCaller = useCallback((caller: any) => {
    setContext({ type: "caller", data: caller });
    setLocation({ page: "/callers", entityType: "caller", entityId: caller.id });
    setIsOpen(true);
  }, []);

  const openWithParameter = useCallback((parameter: any) => {
    setContext({ type: "parameter", data: parameter });
    setLocation({ page: "/data-dictionary", entityType: "parameter", entityId: parameter.parameterId });
    setIsOpen(true);
  }, []);

  const openWithDomain = useCallback((domain: any) => {
    setContext({ type: "domain", data: domain });
    setLocation({ page: "/x/domains", entityType: "domain", entityId: domain.domain });
    setIsOpen(true);
  }, []);

  const openWithDemo = useCallback((demoStep: {
    demoId: string;
    demoTitle: string;
    stepId: string;
    stepTitle: string;
    currentView: string;
    action: string;
    relatedConcepts: string[];
    reason?: string;
  }) => {
    setContext({ type: "demo", data: demoStep });
    setLocation({ page: "/x/demos", section: demoStep.stepTitle, entityType: "demo", entityId: demoStep.demoId });
    setIsOpen(true);
  }, []);

  return {
    isOpen,
    context,
    location,
    options,
    open,
    close,
    toggle,
    // Convenience helpers
    openWithSpec,
    openWithCaller,
    openWithParameter,
    openWithDomain,
    openWithDemo,
  };
}

/**
 * Hook to add Cmd+K keyboard shortcut for toggling assistant
 */
export function useAssistantKeyboardShortcut(callback: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callback]);
}
