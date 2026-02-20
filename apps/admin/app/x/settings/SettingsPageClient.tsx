"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSettingsModal } from "@/contexts/SettingsContext";

/**
 * This client component opens the settings modal when the /x/settings page is accessed.
 * The actual modal rendering happens in the root layout.
 */
export default function SettingsPageClient() {
  const { openSettings } = useSettingsModal();
  const router = useRouter();

  useEffect(() => {
    // Open the settings modal
    openSettings();

    // If user navigates away from /x/settings, go back to the previous page
    const handlePopState = () => {
      router.back();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [openSettings, router]);

  // Return null since the modal is rendered in the root layout
  return null;
}
