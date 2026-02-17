"use client";

import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

const STORAGE_KEY = "hf.educator-view.institutionId";

/**
 * Returns the institutionId to use for educator API calls.
 * - For EDUCATOR users: returns null (APIs resolve it from session)
 * - For admin users: returns the selected institutionId from URL/sessionStorage
 *
 * Also returns a helper to build API URLs with the institutionId param.
 */
export function useEducatorInstitutionId() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const isEducator = session?.user?.role === "EDUCATOR";

  if (isEducator) {
    return {
      institutionId: null as string | null,
      isAdmin: false,
      hasSelection: true,
      buildUrl: (base: string, extraParams?: Record<string, string>) => {
        const params = new URLSearchParams(extraParams);
        const qs = params.toString();
        return qs ? `${base}?${qs}` : base;
      },
    };
  }

  const urlInstitutionId = searchParams.get("institutionId");
  const storedInstitutionId =
    typeof window !== "undefined"
      ? sessionStorage.getItem(STORAGE_KEY)
      : null;
  const institutionId = urlInstitutionId || storedInstitutionId;

  return {
    institutionId,
    isAdmin: true,
    hasSelection: !!institutionId,
    buildUrl: (base: string, extraParams?: Record<string, string>) => {
      if (!institutionId) return base;
      const params = new URLSearchParams(extraParams);
      params.set("institutionId", institutionId);
      return `${base}?${params.toString()}`;
    },
  };
}
