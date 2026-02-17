"use client";

import { Suspense } from "react";
import { AdminInstitutionBanner } from "@/components/educator/AdminInstitutionBanner";

export default function EducatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <AdminInstitutionBanner />
      </Suspense>
      {children}
    </>
  );
}
