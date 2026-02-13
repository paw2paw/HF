"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redirect /x/supervisor → /x/flows (Pipeline tab auto-selected) */
export default function SupervisorRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/x/flows");
  }, [router]);
  return null;
}
