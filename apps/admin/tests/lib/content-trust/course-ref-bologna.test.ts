/**
 * Course Reference — Bologna Framework Awareness
 *
 * Tests for:
 * - detectAcademicContext: returns true for HE signals, false for primary/school
 * - renderCourseRefMarkdown: renders EQF, ECTS, Dublin Descriptors, Module Descriptors
 * - convertCourseRefToAssertions: Bologna fields do NOT produce assertions (by design)
 */

import { describe, it, expect } from "vitest";
import { detectAcademicContext } from "@/lib/chat/course-ref-system-prompt";
import { renderCourseRefMarkdown } from "@/lib/content-trust/course-ref-to-markdown";
import {
  convertCourseRefToAssertions,
  type CourseRefData,
} from "@/lib/content-trust/course-ref-to-assertions";

// ── detectAcademicContext ─────────────────────────────────────────────────────

describe("detectAcademicContext", () => {
  it("returns false for primary school data", () => {
    const data: CourseRefData = {
      courseOverview: { studentAge: "9-11 (Year 5-6)", subject: "English" },
    };
    expect(detectAcademicContext(data)).toBe(false);
  });

  it("returns false for empty data", () => {
    expect(detectAcademicContext({})).toBe(false);
  });

  it("returns true when eqfLevel is set", () => {
    const data: CourseRefData = {
      courseOverview: { eqfLevel: 6 },
    };
    expect(detectAcademicContext(data)).toBe(true);
  });

  it("returns true when ectsCredits is set", () => {
    const data: CourseRefData = {
      courseOverview: { ectsCredits: 15 },
    };
    expect(detectAcademicContext(data)).toBe(true);
  });

  it("returns true when moduleDescriptors are present", () => {
    const data: CourseRefData = {
      moduleDescriptors: [{ id: "MOD-01", title: "Intro" }],
    };
    expect(detectAcademicContext(data)).toBe(true);
  });

  it("returns true when dublinDescriptors are present", () => {
    const data: CourseRefData = {
      learningOutcomes: {
        dublinDescriptors: {
          knowledgeAndUnderstanding: ["Explain the principles of..."],
        },
      },
    };
    expect(detectAcademicContext(data)).toBe(true);
  });

  it("returns true for 'University undergraduates' in studentAge", () => {
    const data: CourseRefData = {
      courseOverview: { studentAge: "University undergraduates" },
    };
    expect(detectAcademicContext(data)).toBe(true);
  });

  it("returns true for 'Masters degree' in examContext", () => {
    const data: CourseRefData = {
      courseOverview: { examContext: "Masters degree programme" },
    };
    expect(detectAcademicContext(data)).toBe(true);
  });

  it("returns true for 'postgraduate diploma' in qualificationLevel", () => {
    const data: CourseRefData = {
      courseOverview: { qualificationLevel: "Postgraduate Diploma" },
    };
    expect(detectAcademicContext(data)).toBe(true);
  });

  it("returns false for secondary school context", () => {
    const data: CourseRefData = {
      courseOverview: {
        studentAge: "14-16 (GCSE)",
        examContext: "AQA GCSE English Literature",
      },
    };
    expect(detectAcademicContext(data)).toBe(false);
  });

  it("returns false for professional context without academic keywords", () => {
    const data: CourseRefData = {
      courseOverview: {
        studentAge: "Working professionals 30-50",
        examContext: "CII R04 insurance exam",
      },
    };
    expect(detectAcademicContext(data)).toBe(false);
  });
});

// ── renderCourseRefMarkdown — Bologna fields ─────────────────────────────────

describe("renderCourseRefMarkdown — Bologna fields", () => {
  it("renders EQF level, ECTS credits, and qualification", () => {
    const data: CourseRefData = {
      courseOverview: {
        subject: "Research Methods",
        eqfLevel: 6,
        ectsCredits: 15,
        qualificationLevel: "BSc Year 2",
      },
    };
    const md = renderCourseRefMarkdown(data);
    expect(md).toContain("**EQF Level:** 6");
    expect(md).toContain("**ECTS Credits:** 15");
    expect(md).toContain("**Qualification:** BSc Year 2");
  });

  it("omits Bologna overview fields when not set", () => {
    const data: CourseRefData = {
      courseOverview: { subject: "Reading Comprehension", studentAge: "9-11" },
    };
    const md = renderCourseRefMarkdown(data);
    expect(md).not.toContain("EQF Level");
    expect(md).not.toContain("ECTS Credits");
    expect(md).not.toContain("Qualification:");
  });

  it("renders Dublin Descriptors", () => {
    const data: CourseRefData = {
      learningOutcomes: {
        skillOutcomes: [{ id: "SO1", description: "Analyse data" }],
        dublinDescriptors: {
          knowledgeAndUnderstanding: [
            "Explain statistical methods",
            "Identify research paradigms",
          ],
          applyingKnowledge: ["Apply SPSS to datasets"],
          makingJudgements: [],
          communicationSkills: ["Present findings orally"],
        },
      },
    };
    const md = renderCourseRefMarkdown(data);
    expect(md).toContain("### Dublin Descriptors");
    expect(md).toContain("**Knowledge & Understanding:**");
    expect(md).toContain("- Explain statistical methods");
    expect(md).toContain("- Identify research paradigms");
    expect(md).toContain("**Applying Knowledge:**");
    expect(md).toContain("- Apply SPSS to datasets");
    expect(md).toContain("**Communication Skills:**");
    expect(md).toContain("- Present findings orally");
    // Empty categories should be omitted
    expect(md).not.toContain("Making Judgements");
    // Categories with no entries at all should be omitted
    expect(md).not.toContain("Learning Skills");
  });

  it("omits Dublin Descriptors section when not set", () => {
    const data: CourseRefData = {
      learningOutcomes: {
        skillOutcomes: [{ id: "SO1", description: "Read fluently" }],
      },
    };
    const md = renderCourseRefMarkdown(data);
    expect(md).not.toContain("Dublin Descriptors");
  });

  it("renders Module Descriptors", () => {
    const data: CourseRefData = {
      moduleDescriptors: [
        {
          id: "MOD-01",
          title: "Introduction to Research Methods",
          ectsCredits: 10,
          assessmentMethod: "Portfolio + oral presentation",
          prerequisites: ["MOD-00"],
          learningOutcomes: [
            "Design a basic research methodology",
            "Critically evaluate published research",
          ],
        },
        {
          id: "MOD-02",
          title: "Advanced Statistics",
          ectsCredits: 15,
        },
      ],
    };
    const md = renderCourseRefMarkdown(data);
    expect(md).toContain("## Module Descriptors");
    expect(md).toContain("### MOD-01: Introduction to Research Methods");
    expect(md).toContain("**ECTS:** 10");
    expect(md).toContain("**Assessment:** Portfolio + oral presentation");
    expect(md).toContain("**Prerequisites:** MOD-00");
    expect(md).toContain("- Design a basic research methodology");
    expect(md).toContain("### MOD-02: Advanced Statistics");
    expect(md).toContain("**ECTS:** 15");
  });

  it("omits Module Descriptors section when empty", () => {
    const data: CourseRefData = {
      courseOverview: { subject: "Art" },
    };
    const md = renderCourseRefMarkdown(data);
    expect(md).not.toContain("Module Descriptors");
  });
});

// ── convertCourseRefToAssertions — Bologna fields produce NO assertions ──────

describe("convertCourseRefToAssertions — Bologna exclusion", () => {
  it("does not produce assertions from Bologna metadata", () => {
    const data: CourseRefData = {
      courseOverview: {
        subject: "Research Methods",
        eqfLevel: 6,
        ectsCredits: 15,
        qualificationLevel: "BSc Year 2",
      },
      learningOutcomes: {
        skillOutcomes: [{ id: "SO1", description: "Analyse data" }],
        dublinDescriptors: {
          knowledgeAndUnderstanding: ["Explain statistical methods"],
          applyingKnowledge: ["Apply SPSS to datasets"],
        },
      },
      moduleDescriptors: [
        {
          id: "MOD-01",
          title: "Intro",
          ectsCredits: 10,
          learningOutcomes: ["Design methodology"],
        },
      ],
    };
    const assertions = convertCourseRefToAssertions(data);
    // No assertions should reference Bologna data
    expect(assertions).toHaveLength(0);
  });

  it("existing assertion conversion is unaffected by Bologna fields", () => {
    const data: CourseRefData = {
      courseOverview: { eqfLevel: 7, ectsCredits: 30 },
      learningOutcomes: {
        dublinDescriptors: {
          knowledgeAndUnderstanding: ["Understand advanced topics"],
        },
      },
      moduleDescriptors: [{ id: "M1", title: "Core" }],
      // These SHOULD produce assertions (existing behaviour)
      skillsFramework: [
        {
          id: "SKILL-01",
          name: "Critical Analysis",
          tiers: {
            emerging: "Surface observations",
            developing: "Identifies patterns",
            secure: "Synthesises across sources",
          },
        },
      ],
      edgeCases: [
        { scenario: "Student distressed", response: "Pause and acknowledge" },
      ],
    };
    const assertions = convertCourseRefToAssertions(data);
    // Should have exactly 2: 1 skill + 1 edge case
    expect(assertions).toHaveLength(2);
    expect(assertions[0].category).toBe("skill_framework");
    expect(assertions[1].category).toBe("edge_case");
    // None should contain Bologna data
    const allText = assertions.map((a) => a.assertion).join(" ");
    expect(allText).not.toContain("EQF");
    expect(allText).not.toContain("ECTS");
    expect(allText).not.toContain("Dublin");
    expect(allText).not.toContain("Understand advanced topics");
  });
});
