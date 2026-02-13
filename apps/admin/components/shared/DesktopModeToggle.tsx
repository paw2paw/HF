"use client";

import { useResponsive } from "@/hooks/useResponsive";
import { Monitor, Smartphone } from "lucide-react";

/**
 * Desktop Mode Toggle Banner
 *
 * Shows only on mobile devices (< 768px).
 * Allows user to toggle between mobile-simplified view and desktop view with horizontal scroll.
 *
 * Persists preference to localStorage: hf.mobile.forceDesktopMode
 */
export function DesktopModeToggle() {
  const { isMobile, forceDesktopMode, toggleDesktopMode } = useResponsive();

  // Only show on actual mobile devices
  if (!isMobile) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {forceDesktopMode ? (
              <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            ) : (
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            )}
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              {forceDesktopMode ? "Desktop Mode" : "Mobile Mode"}
            </p>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {forceDesktopMode
              ? "You can scroll horizontally to view all features"
              : "Simplified view for mobile devices"}
          </p>
        </div>
        <button
          onClick={toggleDesktopMode}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 flex-shrink-0"
        >
          {forceDesktopMode ? (
            <>
              <Smartphone className="w-3.5 h-3.5" />
              Mobile
            </>
          ) : (
            <>
              <Monitor className="w-3.5 h-3.5" />
              Desktop
            </>
          )}
        </button>
      </div>
    </div>
  );
}
