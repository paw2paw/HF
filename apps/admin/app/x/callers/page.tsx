"use client";

import { useResponsive } from "@/hooks/useResponsive";
import { CallersPage } from "@/components/callers/CallersPage";
import CallersMobile from "./mobile-page";

/**
 * Callers Page - Responsive Wrapper
 *
 * Routes to mobile-simplified or desktop version based on:
 * - Device size (< 768px = mobile)
 * - User preference (forceDesktopMode toggle)
 */
export default function CallersPageRoute() {
  const { showDesktop } = useResponsive();

  if (!showDesktop) {
    return <CallersMobile />;
  }

  return <CallersPage routePrefix="/x" />;
}
