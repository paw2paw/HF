"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Redirect /x/orchestrators → /x/flows (preserves ?id= param) */
export default function OrchestratorsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  useEffect(() => {
    const target = id ? `/x/flows?id=${id}` : "/x/flows";
    router.replace(target);
  }, [router, id]);

  return null;
}
