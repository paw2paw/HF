"use client";

import { CallersPage } from "@/components/callers/CallersPage";

// DEPRECATED: Use /callers instead - this page now uses the shared CallersPage component
export default function CallersPageRoute() {
  return <CallersPage routePrefix="/x" />;
}
