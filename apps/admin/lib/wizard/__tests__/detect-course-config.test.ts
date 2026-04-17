import { describe, it, expect } from "vitest";
import {
  detectCourseConfig,
  hasCourseConfig,
  type DetectedCourseConfig,
} from "../detect-course-config";

// ── Helpers ────────────────────────────────────────────────

const FULL_BLOCK = `# GCSE Biology — Course Reference

## Course Configuration

> Machine-readable fields — used by HumanFirst to configure the AI tutor automatically.

**Course name:** GCSE Biology
**Subject / qualification:** GCSE Biology AQA

### Teaching approach
- [ ] **Socratic** — question-based discovery
- [x] **Directive** — structured, step-by-step instruction
- [ ] **Advisory** — coaching style

### Teaching emphasis
- [ ] **Recall** — retrieval practice
- [ ] **Comprehension** — understanding through language
- [x] **Practice** — skill application through worked examples
- [ ] **Syllabus** — structured curriculum coverage

### Student audience
- [ ] **Primary** — age 5–11
- [x] **Secondary** — age 11–16 (KS3–4)
- [ ] **Sixth Form** — age 16–19

### Coverage emphasis
- [ ] **Breadth** — cover more outcomes lightly
- [ ] **Balanced** — sensible default
- [x] **Depth** — fewer outcomes, mastered thoroughly

## Document Purpose
...
`;

const OUTCOMES_BLOCK = `
**OUT-01: Cell structure**
- *The learner can:* identify and describe the function of organelles in plant and animal cells
- *Prerequisites:* none
- *Mastery criterion:* correctly labels 6 of 8 organelles

**OUT-02: Cell division**
- *The learner can:* explain the stages of mitosis and their significance
- *Prerequisites:* OUT-01
- *Mastery criterion:* sequences 4 stages correctly

**OUT-03: Osmosis**
- *The learner can:* predict the direction of water movement across a semi-permeable membrane
- *Prerequisites:* OUT-01
`;

// ── Full block parsing ─────────────────────────────────────

describe("detectCourseConfig", () => {
  describe("full block", () => {
    it("parses all fields from a complete config block", () => {
      const result = detectCourseConfig(FULL_BLOCK);

      expect(result.courseName).toBe("GCSE Biology");
      expect(result.subjectDiscipline).toBe("GCSE Biology AQA");
      expect(result.interactionPattern).toBe("directive");
      expect(result.teachingMode).toBe("practice");
      expect(result.audience).toBe("secondary");
      expect(result.planEmphasis).toBe("depth");
      expect(hasCourseConfig(result)).toBe(true);
      expect(result.detectedFrom.length).toBeGreaterThan(0);
    });
  });

  // ── Course name ──────────────────────────────────────────

  describe("courseName", () => {
    it("extracts from explicit field", () => {
      const r = detectCourseConfig("**Course name:** Advanced Mathematics");
      expect(r.courseName).toBe("Advanced Mathematics");
    });

    it("falls back to H1 title", () => {
      const r = detectCourseConfig("# Advanced Mathematics — Course Reference\n\nSome text");
      expect(r.courseName).toBe("Advanced Mathematics");
    });

    it("prefers explicit field over H1", () => {
      const text = `# Old Name — Course Reference\n\n**Course name:** New Name`;
      const r = detectCourseConfig(text);
      expect(r.courseName).toBe("New Name");
    });

    it("skips template placeholder in explicit field", () => {
      const r = detectCourseConfig("**Course name:** [Full course name]");
      expect(r.courseName).toBeNull();
    });

    it("skips template placeholder in H1", () => {
      const r = detectCourseConfig("# [Course Name] — Course Reference");
      expect(r.courseName).toBeNull();
    });
  });

  // ── Subject ──────────────────────────────────────────────

  describe("subjectDiscipline", () => {
    it("extracts from Subject / qualification field", () => {
      const r = detectCourseConfig("**Subject / qualification:** A-Level Economics");
      expect(r.subjectDiscipline).toBe("A-Level Economics");
    });

    it("falls back to Subject field", () => {
      const r = detectCourseConfig("**Subject:** English Literature");
      expect(r.subjectDiscipline).toBe("English Literature");
    });

    it("skips template placeholder", () => {
      const r = detectCourseConfig("**Subject / qualification:** [e.g. GCSE Biology]");
      expect(r.subjectDiscipline).toBeNull();
    });
  });

  // ── Interaction pattern ──────────────────────────────────

  describe("interactionPattern", () => {
    const patterns = [
      ["Socratic", "socratic"],
      ["Directive", "directive"],
      ["Advisory", "advisory"],
      ["Coaching", "coaching"],
      ["Companion", "companion"],
      ["Facilitation", "facilitation"],
      ["Reflective", "reflective"],
      ["Open", "open"],
      ["Conversational Guide", "conversational-guide"],
    ] as const;

    for (const [label, expected] of patterns) {
      it(`parses [x] **${label}** → "${expected}"`, () => {
        const r = detectCourseConfig(`- [x] **${label}** — description`);
        expect(r.interactionPattern).toBe(expected);
      });
    }
  });

  // ── Teaching mode ────────────────────────────────────────

  describe("teachingMode", () => {
    const modes = [
      ["Recall", "recall"],
      ["Comprehension", "comprehension"],
      ["Practice", "practice"],
      ["Syllabus", "syllabus"],
    ] as const;

    for (const [label, expected] of modes) {
      it(`parses [x] **${label}** → "${expected}"`, () => {
        const r = detectCourseConfig(`- [x] **${label}** — description`);
        expect(r.teachingMode).toBe(expected);
      });
    }
  });

  // ── Audience ─────────────────────────────────────────────

  describe("audience", () => {
    const audiences = [
      ["Primary", "primary"],
      ["Secondary", "secondary"],
      ["Sixth Form", "sixth-form"],
      ["Higher Education", "higher-ed"],
      ["Professional", "adult-professional"],
      ["Adult Learner", "adult-casual"],
      ["Mixed", "mixed"],
    ] as const;

    for (const [label, expected] of audiences) {
      it(`parses [x] **${label}** → "${expected}"`, () => {
        const r = detectCourseConfig(`- [x] **${label}** — description`);
        expect(r.audience).toBe(expected);
      });
    }
  });

  // ── Plan emphasis ────────────────────────────────────────

  describe("planEmphasis", () => {
    const emphases = [
      ["Breadth", "breadth"],
      ["Balanced", "balanced"],
      ["Depth", "depth"],
    ] as const;

    for (const [label, expected] of emphases) {
      it(`parses [x] **${label}** → "${expected}"`, () => {
        const r = detectCourseConfig(`- [x] **${label}** — description`);
        expect(r.planEmphasis).toBe(expected);
      });
    }
  });

  // ── Learning outcomes ────────────────────────────────────

  describe("learningOutcomes", () => {
    it("extracts OUT-XX statements", () => {
      const r = detectCourseConfig(OUTCOMES_BLOCK);
      expect(r.learningOutcomes).toHaveLength(3);
      expect(r.learningOutcomes![0]).toBe(
        "identify and describe the function of organelles in plant and animal cells",
      );
      expect(r.learningOutcomes![1]).toBe(
        "explain the stages of mitosis and their significance",
      );
      expect(r.learningOutcomes![2]).toBe(
        "predict the direction of water movement across a semi-permeable membrane",
      );
    });

    it("caps at 30 outcomes", () => {
      const lines = Array.from({ length: 35 }, (_, i) => {
        const num = String(i + 1).padStart(2, "0");
        return `**OUT-${num}: Outcome ${num}**\n- *The learner can:* do thing ${num}`;
      }).join("\n\n");
      const r = detectCourseConfig(lines);
      expect(r.learningOutcomes).toHaveLength(30);
    });

    it("skips template placeholders", () => {
      const text = `**OUT-01: [Outcome name]**\n- *The learner can:* [concrete, observable statement]`;
      const r = detectCourseConfig(text);
      expect(r.learningOutcomes).toBeNull();
    });
  });

  // ── Checkbox spacing variants ────────────────────────────

  describe("checkbox spacing", () => {
    it("handles [X] (uppercase)", () => {
      const r = detectCourseConfig("- [X] **Socratic** — description");
      expect(r.interactionPattern).toBe("socratic");
    });

    it("handles [ x ] (spaced)", () => {
      const r = detectCourseConfig("- [ x ] **Directive** — description");
      expect(r.interactionPattern).toBe("directive");
    });

    it("handles [ X ] (uppercase spaced)", () => {
      const r = detectCourseConfig("- [ X ] **Coaching** — description");
      expect(r.interactionPattern).toBe("coaching");
    });
  });

  // ── No block / empty input ───────────────────────────────

  describe("no block", () => {
    it("returns all nulls for empty string", () => {
      const r = detectCourseConfig("");
      expect(hasCourseConfig(r)).toBe(false);
    });

    it("returns all nulls for text without config block", () => {
      const r = detectCourseConfig(
        "This is a regular document about teaching biology.\nNo checkboxes here.",
      );
      expect(hasCourseConfig(r)).toBe(false);
    });

    it("returns all nulls for template with only placeholders", () => {
      const template = `# [Course Name] — Course Reference
**Course name:** [Full course name]
**Subject / qualification:** [e.g. GCSE Biology]
- [ ] **Socratic** — unchecked
- [ ] **Directive** — unchecked`;
      const r = detectCourseConfig(template);
      expect(hasCourseConfig(r)).toBe(false);
    });
  });

  // ── Partial block ────────────────────────────────────────

  describe("partial block", () => {
    it("parses course name only", () => {
      const r = detectCourseConfig("**Course name:** Just a Name");
      expect(r.courseName).toBe("Just a Name");
      expect(r.interactionPattern).toBeNull();
      expect(hasCourseConfig(r)).toBe(true);
    });

    it("parses checkbox only (no course name)", () => {
      const r = detectCourseConfig("- [x] **Socratic** — question-based");
      expect(r.courseName).toBeNull();
      expect(r.interactionPattern).toBe("socratic");
      expect(hasCourseConfig(r)).toBe(true);
    });
  });
});

// ── hasCourseConfig ────────────────────────────────────────

describe("hasCourseConfig", () => {
  const empty: DetectedCourseConfig = {
    courseName: null,
    subjectDiscipline: null,
    interactionPattern: null,
    teachingMode: null,
    audience: null,
    planEmphasis: null,
    learningOutcomes: null,
    detectedFrom: [],
  };

  it("returns false when all fields are null", () => {
    expect(hasCourseConfig(empty)).toBe(false);
  });

  it("returns true when courseName is set", () => {
    expect(hasCourseConfig({ ...empty, courseName: "Test" })).toBe(true);
  });

  it("returns true when interactionPattern is set", () => {
    expect(hasCourseConfig({ ...empty, interactionPattern: "socratic" })).toBe(true);
  });

  it("returns true when learningOutcomes is set", () => {
    expect(hasCourseConfig({ ...empty, learningOutcomes: ["outcome 1"] })).toBe(true);
  });
});
