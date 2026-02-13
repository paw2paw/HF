/**
 * Tests for Demo Registry (lib/demo/registry.ts)
 *
 * Validates:
 *   - Registry loads and returns demo specs
 *   - listDemos() only returns active demos
 *   - loadDemo() returns correct demo or null
 *   - Demo spec JSON conforms to expected schema
 *   - DEMO-TUTOR-001 content has valid structure
 */

import { describe, it, expect } from "vitest";
import { listDemos, loadDemo, listAllDemos } from "@/lib/demo/registry";
import demoTutor001 from "@/lib/demo/content/DEMO-TUTOR-001.demo.json";
import type { DemoSpec, DemoStep } from "@/lib/demo/types";

// =====================================================
// REGISTRY TESTS
// =====================================================

describe("Demo Registry", () => {
  describe("listDemos", () => {
    it("returns an array of active demos", () => {
      const demos = listDemos();
      expect(Array.isArray(demos)).toBe(true);
      // All returned demos should be active
      for (const demo of demos) {
        expect(demo.status).toBe("active");
      }
    });

    it("includes DEMO-TUTOR-001", () => {
      const demos = listDemos();
      const tutor = demos.find((d) => d.id === "DEMO-TUTOR-001");
      expect(tutor).toBeDefined();
    });
  });

  describe("listAllDemos", () => {
    it("returns all demos regardless of status", () => {
      const all = listAllDemos();
      expect(all.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("loadDemo", () => {
    it("returns a demo by ID", () => {
      const demo = loadDemo("DEMO-TUTOR-001");
      expect(demo).not.toBeNull();
      expect(demo!.id).toBe("DEMO-TUTOR-001");
    });

    it("returns null for unknown ID", () => {
      const demo = loadDemo("DOES-NOT-EXIST");
      expect(demo).toBeNull();
    });
  });
});

// =====================================================
// SCHEMA VALIDATION
// =====================================================

describe("Demo Spec Schema Validation", () => {
  const spec = demoTutor001 as unknown as DemoSpec;

  it("has all required top-level fields", () => {
    expect(spec.id).toBeTruthy();
    expect(spec.title).toBeTruthy();
    expect(spec.subtitle).toBeTruthy();
    expect(spec.version).toBeTruthy();
    expect(spec.status).toBeTruthy();
    expect(spec.date).toBeTruthy();
    expect(Array.isArray(spec.audience)).toBe(true);
    expect(spec.estimatedMinutes).toBeGreaterThan(0);
    expect(spec.icon).toBeTruthy();
  });

  it("has a valid story block", () => {
    expect(spec.story).toBeDefined();
    expect(spec.story.asA).toBeTruthy();
    expect(spec.story.iWant).toBeTruthy();
    expect(spec.story.soThat).toBeTruthy();
  });

  it("has objectives", () => {
    expect(Array.isArray(spec.objectives)).toBe(true);
    expect(spec.objectives.length).toBeGreaterThan(0);
  });

  it("has autoplay configuration", () => {
    expect(spec.autoplay).toBeDefined();
    expect(typeof spec.autoplay.enabled).toBe("boolean");
    expect(spec.autoplay.defaultDurationSec).toBeGreaterThan(0);
  });

  it("has steps array with at least one step", () => {
    expect(Array.isArray(spec.steps)).toBe(true);
    expect(spec.steps.length).toBeGreaterThan(0);
  });

  it("every step has required fields", () => {
    for (const step of spec.steps) {
      expect(step.id, `step missing id`).toBeTruthy();
      expect(step.title, `step ${step.id} missing title`).toBeTruthy();
      expect(step.description, `step ${step.id} missing description`).toBeTruthy();
      expect(step.content, `step ${step.id} missing content`).toBeDefined();
      expect(step.content.type, `step ${step.id} content missing type`).toBeTruthy();
      expect(step.aiContext, `step ${step.id} missing aiContext`).toBeDefined();
      expect(step.aiContext.currentView, `step ${step.id} aiContext missing currentView`).toBeTruthy();
      expect(step.aiContext.action, `step ${step.id} aiContext missing action`).toBeTruthy();
      expect(Array.isArray(step.aiContext.relatedConcepts), `step ${step.id} aiContext.relatedConcepts not array`).toBe(true);
    }
  });

  it("step IDs are unique", () => {
    const ids = spec.steps.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("content types are valid", () => {
    const validTypes = ["screenshot", "markdown", "split"];
    for (const step of spec.steps) {
      expect(
        validTypes.includes(step.content.type),
        `step ${step.id} has invalid content type: ${step.content.type}`,
      ).toBe(true);
    }
  });

  it("screenshot content has src and alt", () => {
    for (const step of spec.steps) {
      if (step.content.type === "screenshot") {
        expect(step.content.src, `step ${step.id} screenshot missing src`).toBeTruthy();
        expect(step.content.alt, `step ${step.id} screenshot missing alt`).toBeTruthy();
      }
    }
  });

  it("markdown content has body", () => {
    for (const step of spec.steps) {
      if (step.content.type === "markdown") {
        expect(step.content.body, `step ${step.id} markdown missing body`).toBeTruthy();
      }
    }
  });

  it("tip types are valid", () => {
    const validTypes = ["tip", "warning", "shortcut", "best-practice"];
    for (const step of spec.steps) {
      if (step.tips) {
        for (const tip of step.tips) {
          expect(
            validTypes.includes(tip.type),
            `step ${step.id} has invalid tip type: ${tip.type}`,
          ).toBe(true);
        }
      }
    }
  });

  it("sidebar highlights have valid shape", () => {
    const validHighlightTypes = ["pulse", "flash", "glow"];
    for (const step of spec.steps) {
      if (step.sidebarHighlight) {
        expect(step.sidebarHighlight.href).toBeTruthy();
        expect(
          validHighlightTypes.includes(step.sidebarHighlight.type),
        ).toBe(true);
      }
    }
  });

  it("audience values are valid", () => {
    const validAudiences = ["operator", "team_member", "evaluator", "developer"];
    for (const aud of spec.audience) {
      expect(validAudiences.includes(aud)).toBe(true);
    }
  });
});

// =====================================================
// DEMO-TUTOR-001 SPECIFIC TESTS
// =====================================================

describe("DEMO-TUTOR-001 Content", () => {
  const spec = demoTutor001 as unknown as DemoSpec;

  it("has 15 steps", () => {
    expect(spec.steps.length).toBe(15);
  });

  it("first step is welcome with markdown", () => {
    expect(spec.steps[0].id).toBe("welcome");
    expect(spec.steps[0].content.type).toBe("markdown");
  });

  it("last step is summary with markdown", () => {
    const last = spec.steps[spec.steps.length - 1];
    expect(last.id).toBe("summary");
    expect(last.content.type).toBe("markdown");
  });

  it("has steps with sidebar highlights", () => {
    const withHighlights = spec.steps.filter((s) => s.sidebarHighlight);
    expect(withHighlights.length).toBeGreaterThanOrEqual(5);
  });

  it("has steps with tips", () => {
    const withTips = spec.steps.filter((s) => s.tips && s.tips.length > 0);
    expect(withTips.length).toBeGreaterThanOrEqual(3);
  });

  it("includes at least one split content step", () => {
    const splitSteps = spec.steps.filter((s) => s.content.type === "split");
    expect(splitSteps.length).toBeGreaterThanOrEqual(1);
  });

  it("covers the key workflow pages", () => {
    const highlightedPages = spec.steps
      .filter((s) => s.sidebarHighlight)
      .map((s) => s.sidebarHighlight!.href);
    expect(highlightedPages).toContain("/x/domains");
    expect(highlightedPages).toContain("/x/specs");
    expect(highlightedPages).toContain("/x/playbooks");
    expect(highlightedPages).toContain("/x/sim");
  });
});
