"use client";

/**
 * Holographic Institution Page
 *
 * Two-pane surface where every facet of a domain is visible simultaneously,
 * editable inline, and reactive across sections.
 *
 * Route: /x/institutions/[id]/holo
 * Create mode: /x/institutions/new/holo
 *
 * Parallel build — existing institution page at ../page.tsx is untouched.
 */

import { useParams } from "next/navigation";
import { HolographicPage } from "@/components/holographic/HolographicPage";
import "./holographic-page.css";

export default function HolographicRoute() {
  const params = useParams<{ id: string }>();
  const domainId = params.id;

  return <HolographicPage domainId={domainId} />;
}
