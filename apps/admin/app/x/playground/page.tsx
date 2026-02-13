"use client";

import { useResponsive } from "@/hooks/useResponsive";
import PlaygroundDesktop from "./desktop-page";
import PlaygroundMobile from "./mobile-page";

/**
 * Playground Page - Responsive Wrapper
 *
 * Routes to mobile-simplified or desktop version based on:
 * - Device size (< 768px = mobile)
 * - User preference (forceDesktopMode toggle)
 */
export default function PlaygroundPage() {
  const { showDesktop } = useResponsive();

  if (!showDesktop) {
    return <PlaygroundMobile />;
  }

  return <PlaygroundDesktop />;
}
