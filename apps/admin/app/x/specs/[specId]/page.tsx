"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirects /x/specs/[specId] → /x/specs?id=[specId]
 * The full spec editor lives on /x/specs with split-panel layout.
 */
export default function SpecDetailRedirect() {
  const params = useParams();
  const router = useRouter();
  const specId = params.specId as string;

  useEffect(() => {
    router.replace(`/x/specs?id=${specId}`);
  }, [specId, router]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "var(--text-secondary)" }}>
      Redirecting...
    </div>
  );
}
