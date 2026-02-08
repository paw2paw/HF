"use client";

import { Suspense } from "react";
import CallerDetailPage from "@/app/_archived/legacy-pages/callers/[callerId]/page";

// Re-export the caller detail page from archived location
// TODO: Consider properly migrating this large component to /components
export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>}>
      <CallerDetailPage />
    </Suspense>
  );
}
