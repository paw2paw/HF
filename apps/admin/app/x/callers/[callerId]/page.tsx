"use client";

import { Suspense } from "react";
import CallerDetailPage from "@/components/callers/CallerDetailPage";
export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>}>
      <CallerDetailPage />
    </Suspense>
  );
}
