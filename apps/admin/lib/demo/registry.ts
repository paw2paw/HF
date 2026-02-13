/**
 * Demo Registry
 *
 * Static JSON imports for demo specs. No runtime filesystem reads,
 * consistent with project pattern of eliminating runtime FS access.
 *
 * To add a new demo:
 * 1. Create a JSON file in lib/demo/content/
 * 2. Import it here
 * 3. Add to DEMO_REGISTRY
 */

import type { DemoSpec } from "./types";
import demoTutor001 from "./content/DEMO-TUTOR-001.demo.json";

const DEMO_REGISTRY: Record<string, DemoSpec> = {
  "DEMO-TUTOR-001": demoTutor001 as unknown as DemoSpec,
};

/**
 * List all active demos (status = "active").
 */
export function listDemos(): DemoSpec[] {
  return Object.values(DEMO_REGISTRY).filter((d) => d.status === "active");
}

/**
 * Load a specific demo by ID. Returns null if not found.
 */
export function loadDemo(id: string): DemoSpec | null {
  return DEMO_REGISTRY[id] || null;
}

/**
 * List all demos regardless of status (for admin views).
 */
export function listAllDemos(): DemoSpec[] {
  return Object.values(DEMO_REGISTRY);
}
