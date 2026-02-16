"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useGuidance, type MissionStep } from "@/contexts/GuidanceContext";
import { useGlobalAssistant } from "@/contexts/AssistantContext";
import { getTourForRole, type TourAction } from "@/lib/tours/tour-definitions";
import { isTourCompleted, markTourCompleted } from "@/lib/tours/tour-storage";
import { resolveManifestItem } from "@/lib/tours/manifest-resolver";
import {
  X, ChevronRight, ChevronLeft, PlayCircle, Sparkles,
  BookOpen, Globe, User, Users, School, TrendingUp, Phone,
  Backpack, MessageCircle, Zap, Presentation,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  BookOpen, Globe, User, Users, School, PlayCircle, TrendingUp,
  Phone, Backpack, MessageCircle, Zap, Presentation, Sparkles,
};

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * TourOverlay — Full-screen spotlight + tooltip for guided tours.
 *
 * Reads activeMission from GuidanceContext. When mission.isTour is true,
 * renders a backdrop with a spotlight cutout and a positioned tooltip card.
 *
 * After the tour completes, shows a "What's Next?" card with role-specific
 * action suggestions (glowing buttons).
 */
export function TourOverlay() {
  const guidance = useGuidance();
  const assistant = useGlobalAssistant();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showWhatsNext, setShowWhatsNext] = useState(false);
  const [whatsNextActions, setWhatsNextActions] = useState<TourAction[]>([]);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const mission = guidance?.activeMission;
  const isTour = mission?.isTour;
  const prevMissionRef = useRef<typeof mission>(null);
  const tourDismissedRef = useRef(false);

  // ── Detect tour completion (works for both TourOverlay and TourTrigger starts)
  useEffect(() => {
    const prev = prevMissionRef.current;
    prevMissionRef.current = mission;
    // If we had an active tour and now it's gone, show "What's Next?"
    // But only if the user completed it (not dismissed/skipped)
    if (prev?.isTour && !mission && !tourDismissedRef.current) {
      const role = session?.user?.role as string;
      if (role) {
        const tour = getTourForRole(role);
        if (tour?.actions?.length) {
          setWhatsNextActions(tour.actions);
          setShowWhatsNext(true);
        }
      }
    }
    tourDismissedRef.current = false;
  }, [mission, session]);

  // ── Auto-prompt on first visit ────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.id || !session?.user?.role) return;
    const userId = session.user.id as string;
    const role = session.user.role as string;
    const tour = getTourForRole(role);
    if (!tour) return;
    if (isTourCompleted(userId, tour.id)) return;
    // Only show on the dashboard page
    if (pathname !== "/x") return;
    // Delay slightly so the page has rendered
    const timer = setTimeout(() => setShowWelcome(true), 800);
    return () => clearTimeout(timer);
  }, [session, pathname]);

  // ── Measure target element ────────────────────────────────────────
  const measureTarget = useCallback(() => {
    if (!mission?.isTour) return;
    const step = mission.steps[mission.currentStepIndex];
    if (!step) return;

    // Priority: elementSelector > sidebarTarget
    const selector = step.elementSelector
      || (step.target ? `a[href="${step.target}"]` : null);

    if (!selector || step.placement === "center") {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(selector);
    if (!el) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[Tour] Step "${step.id}" target not found in DOM: ${selector}`);
      }
      setTargetRect(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top - 4,
      left: rect.left - 4,
      width: rect.width + 8,
      height: rect.height + 8,
    });
  }, [mission]);

  useEffect(() => {
    measureTarget();
    window.addEventListener("resize", measureTarget);
    return () => window.removeEventListener("resize", measureTarget);
  }, [measureTarget, mission?.currentStepIndex]);

  // ── Navigate if step requires it ──────────────────────────────────
  useEffect(() => {
    if (!mission?.isTour) return;
    const step = mission.steps[mission.currentStepIndex];
    if (step?.navigateTo && pathname !== step.navigateTo) {
      router.push(step.navigateTo);
    }
  }, [mission?.currentStepIndex, mission?.isTour, mission?.steps, pathname, router]);

  // ── Keyboard navigation ───────────────────────────────────────────
  useEffect(() => {
    if (!isTour && !showWhatsNext) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showWhatsNext) {
          setShowWhatsNext(false);
        } else {
          guidance?.skipMission();
        }
      }
      if (isTour) {
        if (e.key === "ArrowRight" || e.key === "Enter") guidance?.advanceMission();
        if (e.key === "ArrowLeft") goBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isTour, guidance, showWhatsNext]); // eslint-disable-line react-hooks/exhaustive-deps

  const startTour = useCallback(() => {
    if (!session?.user?.role || !guidance) return;
    setShowWelcome(false);
    const tour = getTourForRole(session.user.role as string);
    if (!tour) return;

    const userId = session.user.id as string;
    const steps: Omit<MissionStep, "completed">[] = tour.steps.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      target: s.manifestItem
        ? (resolveManifestItem(s.manifestItem, tour.role)?.href ?? "")
        : "",
      elementSelector: s.elementSelector,
      placement: s.placement,
      navigateTo: s.navigateTo,
      nextLabel: s.nextLabel,
    }));

    guidance.startMission({
      id: tour.id,
      name: tour.name,
      icon: tour.icon,
      isTour: true,
      onComplete: () => markTourCompleted(userId, tour.id),
      steps: steps.map(s => ({ ...s, completed: false })),
    });
  }, [session, guidance]);

  const goBack = useCallback(() => {
    if (!guidance?.activeMission) return;
    const prev = guidance.activeMission;
    if (prev.currentStepIndex <= 0) return;
    const newIndex = prev.currentStepIndex - 1;
    guidance.skipMission();
    setTimeout(() => {
      guidance.startMission({
        ...prev,
        steps: prev.steps,
        currentStepIndex: newIndex,
      } as any);
    }, 0);
  }, [guidance]);

  const dismiss = useCallback(() => {
    tourDismissedRef.current = true;
    guidance?.skipMission();
    if (session?.user?.id && mission?.id) {
      markTourCompleted(session.user.id as string, mission.id);
    }
  }, [guidance, session, mission]);

  const handleAction = useCallback((action: TourAction) => {
    setShowWhatsNext(false);
    if (action.openAssistant) {
      assistant.setLayoutMode("popout");
      assistant.open();
    } else if (action.href) {
      router.push(action.href);
    }
  }, [assistant, router]);

  // ── "What's Next?" card ─────────────────────────────────────────
  if (showWhatsNext && whatsNextActions.length > 0) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center tour-overlay" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
        <div
          className="rounded-xl p-6 shadow-2xl max-w-md mx-4 tour-tooltip"
          style={{
            backgroundColor: "var(--surface-primary)",
            border: "1px solid var(--border-secondary)",
          }}
        >
          <button
            onClick={() => setShowWhatsNext(false)}
            className="absolute top-3 right-3 p-1 rounded cursor-pointer"
            style={{ color: "var(--text-tertiary)" }}
            aria-label="Close"
          >
            <X size={14} />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--accent-primary)", color: "white" }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                {"What's next?"}
              </h3>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Tour complete — here are some things to try
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {whatsNextActions.map((action) => {
              const IconComponent = ICON_MAP[action.icon];
              return (
                <button
                  key={action.label}
                  onClick={() => handleAction(action)}
                  className="flex items-center gap-3 w-full p-3 rounded-lg text-left cursor-pointer tour-action-glow transition-all"
                  style={{
                    border: "1px solid var(--border-secondary)",
                    backgroundColor: "var(--surface-secondary)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "var(--accent-primary)", color: "white" }}
                  >
                    {IconComponent ? <IconComponent size={16} /> : <Sparkles size={16} />}
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {action.label}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {action.description}
                    </div>
                  </div>
                  <ChevronRight size={14} className="ml-auto shrink-0" style={{ color: "var(--text-tertiary)" }} />
                </button>
              );
            })}
          </div>

          <p className="text-xs mt-4 text-center" style={{ color: "var(--text-placeholder)" }}>
            You can retake the tour anytime from your account menu
          </p>
        </div>
      </div>
    );
  }

  // ── Welcome prompt ────────────────────────────────────────────────
  if (showWelcome && !isTour) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
        <div
          className="rounded-xl p-6 shadow-2xl max-w-sm mx-4 tour-tooltip"
          style={{
            backgroundColor: "var(--surface-primary)",
            border: "1px solid var(--border-secondary)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--accent-primary)", color: "white" }}>
              <PlayCircle size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                Welcome!
              </h3>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                First time here?
              </p>
            </div>
          </div>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Would you like a quick tour of the platform? It only takes 30 seconds.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowWelcome(false);
                if (session?.user?.id) {
                  const tour = getTourForRole(session.user.role as string);
                  if (tour) markTourCompleted(session.user.id as string, tour.id);
                }
              }}
              className="px-3 py-1.5 text-sm rounded-md cursor-pointer"
              style={{ color: "var(--text-secondary)" }}
            >
              Skip
            </button>
            <button
              onClick={startTour}
              className="px-4 py-1.5 text-sm font-medium rounded-md cursor-pointer"
              style={{
                backgroundColor: "var(--accent-primary)",
                color: "white",
              }}
            >
              Start Tour
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Tour overlay ──────────────────────────────────────────────────
  if (!isTour || !mission) return null;

  const step = mission.steps[mission.currentStepIndex];
  if (!step) return null;

  const totalSteps = mission.steps.length;
  const currentIndex = mission.currentStepIndex;
  const isCentered = step.placement === "center" || !targetRect;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (isCentered) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const placement = step.placement || "right";
    const gap = 12;

    switch (placement) {
      case "right":
        return {
          position: "fixed",
          top: targetRect!.top,
          left: targetRect!.left + targetRect!.width + gap,
        };
      case "left":
        return {
          position: "fixed",
          top: targetRect!.top,
          right: window.innerWidth - targetRect!.left + gap,
        };
      case "bottom":
        return {
          position: "fixed",
          top: targetRect!.top + targetRect!.height + gap,
          left: targetRect!.left,
        };
      case "top":
        return {
          position: "fixed",
          bottom: window.innerHeight - targetRect!.top + gap,
          left: targetRect!.left,
        };
      default:
        return {
          position: "fixed",
          top: targetRect!.top,
          left: targetRect!.left + targetRect!.width + gap,
        };
    }
  };

  // SVG clip path for spotlight
  const clipPath = targetRect
    ? `polygon(
        0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
        ${targetRect.left}px ${targetRect.top}px,
        ${targetRect.left}px ${targetRect.top + targetRect.height}px,
        ${targetRect.left + targetRect.width}px ${targetRect.top + targetRect.height}px,
        ${targetRect.left + targetRect.width}px ${targetRect.top}px,
        ${targetRect.left}px ${targetRect.top}px
      )`
    : undefined;

  return (
    <>
      {/* Backdrop with spotlight cutout */}
      <div
        className="fixed inset-0 z-[999] tour-overlay"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          clipPath,
        }}
        onClick={dismiss}
      />

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="z-[1000] rounded-xl p-5 shadow-2xl max-w-sm tour-tooltip"
        style={{
          ...getTooltipStyle(),
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-secondary)",
        }}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1 rounded cursor-pointer"
          style={{ color: "var(--text-tertiary)" }}
          aria-label="Close tour"
        >
          <X size={14} />
        </button>

        {/* Step content */}
        <h3 className="text-sm font-semibold mb-1.5 pr-6" style={{ color: "var(--text-primary)" }}>
          {step.title}
        </h3>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
          {step.description}
        </p>

        {/* Step dots + navigation */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: i === currentIndex
                    ? "var(--accent-primary)"
                    : i < currentIndex
                    ? "var(--accent-primary)"
                    : "var(--border-secondary)",
                  opacity: i <= currentIndex ? 1 : 0.5,
                }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {currentIndex > 0 && (
              <button
                onClick={goBack}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded cursor-pointer"
                style={{ color: "var(--text-secondary)" }}
              >
                <ChevronLeft size={12} />
                Back
              </button>
            )}
            <button
              onClick={() => guidance?.advanceMission()}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded cursor-pointer"
              style={{
                backgroundColor: "var(--accent-primary)",
                color: "white",
              }}
            >
              {currentIndex === totalSteps - 1 ? "Done" : (step.nextLabel || "Next")}
              {currentIndex < totalSteps - 1 && <ChevronRight size={12} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
