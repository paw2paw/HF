"use client";

import { useState, useEffect } from "react";

export interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  forceDesktopMode: boolean;
  showDesktop: boolean;
  toggleDesktopMode: () => void;
}

/**
 * Responsive hook for detecting device type and managing desktop mode toggle
 *
 * Breakpoints:
 * - Mobile: < 768px
 * - Tablet: 768px - 1023px
 * - Desktop: ≥ 1024px
 *
 * forceDesktopMode: User can force desktop UI on mobile (horizontal scroll)
 */
export function useResponsive(): ResponsiveState {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [forceDesktopMode, setForceDesktopMode] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // SSR safety - only run on client
    if (typeof window === "undefined") return;

    // Check localStorage for forced desktop mode
    const forced = localStorage.getItem("hf.mobile.forceDesktopMode") === "true";
    setForceDesktopMode(forced);

    // Media query listeners
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const tabletQuery = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");

    const handleMobileChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    const handleTabletChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsTablet(e.matches);
    };

    // Set initial values
    setIsMobile(mobileQuery.matches);
    setIsTablet(tabletQuery.matches);
    setIsHydrated(true);

    // Add listeners
    mobileQuery.addEventListener("change", handleMobileChange);
    tabletQuery.addEventListener("change", handleTabletChange);

    return () => {
      mobileQuery.removeEventListener("change", handleMobileChange);
      tabletQuery.removeEventListener("change", handleTabletChange);
    };
  }, []);

  const toggleDesktopMode = () => {
    const newValue = !forceDesktopMode;
    setForceDesktopMode(newValue);
    if (typeof window !== "undefined") {
      localStorage.setItem("hf.mobile.forceDesktopMode", String(newValue));
    }
  };

  return {
    isMobile: isHydrated && isMobile,
    isTablet: isHydrated && isTablet,
    isDesktop: isHydrated && !isMobile && !isTablet,
    forceDesktopMode,
    showDesktop: !isMobile || forceDesktopMode,
    toggleDesktopMode,
  };
}
