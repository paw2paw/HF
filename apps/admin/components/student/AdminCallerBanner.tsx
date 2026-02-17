"use client";

import { useSession } from "next-auth/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { CallerPicker } from "@/components/shared/CallerPicker";
import { Eye } from "lucide-react";

const STORAGE_KEY = "hf.student-view.callerId";

/**
 * Shows a learner picker banner for non-STUDENT users viewing the student portal.
 * Persists selection via sessionStorage + URL searchParams.
 */
export function AdminCallerBanner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedCallerId, setSelectedCallerId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const role = session?.user?.role;
  const isStudent = role === "STUDENT";

  // Initialize from URL param or sessionStorage on mount
  useEffect(() => {
    setMounted(true);
    const urlCallerId = searchParams.get("callerId");
    if (urlCallerId) {
      setSelectedCallerId(urlCallerId);
      sessionStorage.setItem(STORAGE_KEY, urlCallerId);
    } else {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSelectedCallerId(stored);
        // Sync URL to include callerId
        const params = new URLSearchParams(searchParams.toString());
        params.set("callerId", stored);
        router.replace(`${pathname}?${params.toString()}`);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback(
    (callerId: string) => {
      setSelectedCallerId(callerId || null);
      if (callerId) {
        sessionStorage.setItem(STORAGE_KEY, callerId);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
      // Update URL
      const params = new URLSearchParams(searchParams.toString());
      if (callerId) {
        params.set("callerId", callerId);
      } else {
        params.delete("callerId");
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  // Don't render for actual students
  if (isStudent || !mounted) return null;

  return (
    <div
      style={{
        background: "color-mix(in srgb, var(--accent-primary) 8%, transparent)",
        borderBottom:
          "1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)",
        padding: "8px 24px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Eye
        size={14}
        style={{ color: "var(--accent-primary)", flexShrink: 0 }}
      />
      <span
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          whiteSpace: "nowrap",
        }}
      >
        Viewing learner:
      </span>
      <CallerPicker
        value={selectedCallerId}
        onChange={handleSelect}
        roleFilter="LEARNER"
        placeholder="Select a learner to view..."
        style={{ maxWidth: 320, flex: 1 }}
      />
    </div>
  );
}
