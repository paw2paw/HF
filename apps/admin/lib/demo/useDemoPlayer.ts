"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import type {
  DemoSpec,
  DemoStep,
  DemoPlayerState,
  DemoPlayerAction,
} from "./types";

// =====================================================
// REDUCER
// =====================================================

function demoPlayerReducer(
  state: DemoPlayerState,
  action: DemoPlayerAction,
): DemoPlayerState {
  switch (action.type) {
    case "NEXT": {
      if (state.currentStepIndex >= state.totalSteps - 1) return state;
      const next = state.currentStepIndex + 1;
      const visited = new Set(state.visitedSteps);
      visited.add(next);
      return { ...state, currentStepIndex: next, visitedSteps: visited };
    }
    case "PREV": {
      if (state.currentStepIndex <= 0) return state;
      return { ...state, currentStepIndex: state.currentStepIndex - 1 };
    }
    case "GOTO": {
      if (action.index < 0 || action.index >= state.totalSteps) return state;
      const visited = new Set(state.visitedSteps);
      visited.add(action.index);
      return { ...state, currentStepIndex: action.index, visitedSteps: visited };
    }
    case "TOGGLE_AUTOPLAY":
      return { ...state, isAutoplay: !state.isAutoplay };
    case "PAUSE_FOR_AI":
      return { ...state, isPaused: true, isAutoplay: false };
    case "RESUME_FROM_AI":
      return { ...state, isPaused: false };
    case "RESET": {
      const visited = new Set<number>();
      visited.add(0);
      return {
        specId: state.specId,
        currentStepIndex: 0,
        totalSteps: action.totalSteps,
        isAutoplay: false,
        isPaused: false,
        visitedSteps: visited,
        startedAt: Date.now(),
      };
    }
    default:
      return state;
  }
}

function createInitialState(spec: DemoSpec): DemoPlayerState {
  const visited = new Set<number>();
  visited.add(0);
  return {
    specId: spec.id,
    currentStepIndex: 0,
    totalSteps: spec.steps.length,
    isAutoplay: spec.autoplay.enabled,
    isPaused: false,
    visitedSteps: visited,
    startedAt: Date.now(),
  };
}

// =====================================================
// HOOK
// =====================================================

export interface UseDemoPlayerOptions {
  spec: DemoSpec;
  /** Called when step changes — use for sidebar highlights */
  onStepChange?: (step: DemoStep, index: number) => void;
  /** Called when user wants to ask AI */
  onAskAI?: (step: DemoStep) => void;
  /** Called when user exits the demo */
  onExit?: () => void;
}

export interface UseDemoPlayerReturn {
  state: DemoPlayerState;
  currentStep: DemoStep;
  isFirstStep: boolean;
  isLastStep: boolean;
  progress: number;
  // Actions
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  toggleAutoplay: () => void;
  pauseForAI: () => void;
  resumeFromAI: () => void;
  reset: () => void;
}

export function useDemoPlayer({
  spec,
  onStepChange,
  onAskAI,
  onExit,
}: UseDemoPlayerOptions): UseDemoPlayerReturn {
  const [state, dispatch] = useReducer(demoPlayerReducer, spec, createInitialState);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStep = spec.steps[state.currentStepIndex];
  const isFirstStep = state.currentStepIndex === 0;
  const isLastStep = state.currentStepIndex === state.totalSteps - 1;
  const progress = state.totalSteps > 0
    ? Math.round(((state.currentStepIndex + 1) / state.totalSteps) * 100)
    : 0;

  // --- Actions ---

  const next = useCallback(() => dispatch({ type: "NEXT" }), []);
  const prev = useCallback(() => dispatch({ type: "PREV" }), []);
  const goTo = useCallback((index: number) => dispatch({ type: "GOTO", index }), []);
  const toggleAutoplay = useCallback(() => dispatch({ type: "TOGGLE_AUTOPLAY" }), []);
  const reset = useCallback(() => dispatch({ type: "RESET", totalSteps: spec.steps.length }), [spec.steps.length]);

  const pauseForAI = useCallback(() => {
    dispatch({ type: "PAUSE_FOR_AI" });
    onAskAI?.(currentStep);
  }, [currentStep, onAskAI]);

  const resumeFromAI = useCallback(() => {
    dispatch({ type: "RESUME_FROM_AI" });
  }, []);

  // --- Step change effect ---

  useEffect(() => {
    onStepChange?.(currentStep, state.currentStepIndex);
  }, [state.currentStepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Autoplay timer ---

  useEffect(() => {
    if (autoplayTimerRef.current) {
      clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }

    if (state.isAutoplay && !state.isPaused && !isLastStep) {
      const duration = (currentStep.durationOverrideSec ?? spec.autoplay.defaultDurationSec) * 1000;
      autoplayTimerRef.current = setTimeout(() => {
        dispatch({ type: "NEXT" });
      }, duration);
    }

    return () => {
      if (autoplayTimerRef.current) {
        clearTimeout(autoplayTimerRef.current);
      }
    };
  }, [state.isAutoplay, state.isPaused, state.currentStepIndex, isLastStep, currentStep, spec.autoplay.defaultDurationSec]);

  // --- Keyboard handlers ---

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          dispatch({ type: "NEXT" });
          break;
        case "ArrowLeft":
          e.preventDefault();
          dispatch({ type: "PREV" });
          break;
        case " ":
          e.preventDefault();
          dispatch({ type: "TOGGLE_AUTOPLAY" });
          break;
        case "?":
          e.preventDefault();
          onAskAI?.(spec.steps[state.currentStepIndex]);
          dispatch({ type: "PAUSE_FOR_AI" });
          break;
        case "Escape":
          e.preventDefault();
          onExit?.();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.currentStepIndex, onAskAI, onExit, spec.steps]);

  // --- Touch / swipe handlers ---

  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;

    function handleTouchStart(e: TouchEvent) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }

    function handleTouchEnd(e: TouchEvent) {
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;

      // Only register horizontal swipes (at least 50px, more horizontal than vertical)
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX < 0) {
          dispatch({ type: "NEXT" }); // Swipe left = next
        } else {
          dispatch({ type: "PREV" }); // Swipe right = prev
        }
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  return {
    state,
    currentStep,
    isFirstStep,
    isLastStep,
    progress,
    next,
    prev,
    goTo,
    toggleAutoplay,
    pauseForAI,
    resumeFromAI,
    reset,
  };
}
