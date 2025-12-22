// apps/admin/app/admin/page.tsx
"use client";

import dynamic from "next/dynamic";

// React Admin must run client-side only.
// AdminApp.tsx is a Client Component, but we still dynamically load it to avoid any SSR/router issues.
const AdminApp = dynamic(() => import("./AdminApp"), { ssr: false });

export default function Page() {
  return <AdminApp />;
}