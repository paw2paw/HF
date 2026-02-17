"use client";

import React, { useCallback } from "react";
import { useSession } from "next-auth/react";
import { useGuidance, type MissionStep } from "@/contexts/GuidanceContext";
import { getTourForRole } from "@/lib/tours/tour-definitions";
import { markTourCompleted, resetTourCompletion } from "@/lib/tours/tour-storage";
import { resolveManifestItem } from "@/lib/tours/manifest-resolver";
import { PlayCircle } from "lucide-react";

/**
 * TourTrigger — Button that starts or restarts the role-specific tour.
 * Place on dashboards or in account menus.
 */
export function TourTrigger({ className }: { className?: string }) {
  const { data: session } = useSession();
  const guidance = useGuidance();

  const startTour = useCallback(() => {
    if (!session?.user?.role || !guidance) return;
    const role = session.user.role as string;
    const userId = session.user.id as string;
    const tour = getTourForRole(role);
    if (!tour) return;

    // Reset so the tour shows again
    resetTourCompletion(userId, tour.id);

    const steps: MissionStep[] = tour.steps.map(s => ({
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
      completed: false,
    }));

    guidance.startMission({
      id: tour.id,
      name: tour.name,
      icon: tour.icon,
      isTour: true,
      onComplete: () => markTourCompleted(userId, tour.id),
      steps,
    });
  }, [session, guidance]);

  if (!session?.user?.role) return null;
  const tour = getTourForRole(session.user.role as string);
  if (!tour) return null;

  return (
    <button
      onClick={startTour}
      className={`flex items-center gap-1.5 text-xs cursor-pointer ${className || ""}`}
      style={{ color: "var(--text-tertiary)" }}
      title="Take a guided tour"
    >
      <PlayCircle size={14} />
      Take Tour
    </button>
  );
}
