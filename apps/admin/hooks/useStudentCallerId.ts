"use client";

import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

const STORAGE_KEY = "hf.student-view.callerId";

/**
 * Returns the callerId to use for student API calls.
 * - For STUDENT users: returns null (APIs resolve it from session)
 * - For admin users: returns the selected callerId from URL/sessionStorage
 *
 * Also returns a helper to build API URLs with the callerId param.
 */
export function useStudentCallerId() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const isStudent = session?.user?.role === "STUDENT";

  if (isStudent) {
    return {
      callerId: null as string | null,
      isAdmin: false,
      hasSelection: true,
      buildUrl: (base: string, extraParams?: Record<string, string>) => {
        const params = new URLSearchParams(extraParams);
        const qs = params.toString();
        return qs ? `${base}?${qs}` : base;
      },
    };
  }

  const urlCallerId = searchParams.get("callerId");
  const storedCallerId =
    typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
  const callerId = urlCallerId || storedCallerId;

  return {
    callerId,
    isAdmin: true,
    hasSelection: !!callerId,
    buildUrl: (base: string, extraParams?: Record<string, string>) => {
      if (!callerId) return base;
      const params = new URLSearchParams(extraParams);
      params.set("callerId", callerId);
      return `${base}?${params.toString()}`;
    },
  };
}
