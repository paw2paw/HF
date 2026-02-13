/**
 * Curriculum Structure Extraction
 *
 * Takes assertions extracted from a syllabus document and uses AI to generate
 * a structured curriculum: modules, learning outcomes, assessment criteria,
 * teaching order.
 */

import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";
import type { ExtractedAssertion } from "./extract-assertions";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface CurriculumModule {
  id: string; // "MOD-1", "MOD-2", etc.
  title: string;
  description: string;
  learningOutcomes: string[];
  assessmentCriteria?: string[];
  keyTerms?: string[];
  estimatedDurationMinutes?: number;
  sortOrder: number;
}

export interface ExtractedCurriculum {
  ok: boolean;
  name: string;
  description: string;
  modules: CurriculumModule[];
  deliveryConfig: {
    sessionStructure?: string[];
    assessmentStrategy?: string;
    pedagogicalNotes?: string[];
  };
  warnings: string[];
  error?: string;
}

// ------------------------------------------------------------------
// AI extraction
// ------------------------------------------------------------------

const CURRICULUM_SYSTEM_PROMPT = `You are a curriculum design specialist. Given a set of teaching assertions extracted from a syllabus or educational document, your job is to organize them into a structured curriculum with modules, learning outcomes, and assessment criteria.

Rules:
1. Group related assertions into logical modules
2. Each module should have 3-8 learning outcomes
3. Order modules from foundational to advanced
4. Use clear, measurable learning outcome language ("Identify...", "Explain...", "Apply...")
5. Preserve the source material's own structure if it has chapters/sections
6. Generate practical module IDs (MOD-1, MOD-2, etc.)

Return valid JSON only with this structure:
{
  "name": "Curriculum title",
  "description": "Brief description of what this curriculum covers",
  "modules": [
    {
      "id": "MOD-1",
      "title": "Module title",
      "description": "What this module covers",
      "learningOutcomes": ["LO1: Identify...", "LO2: Explain..."],
      "assessmentCriteria": ["Can define X", "Can list Y"],
      "keyTerms": ["term1", "term2"],
      "estimatedDurationMinutes": 30,
      "sortOrder": 1
    }
  ],
  "deliveryConfig": {
    "sessionStructure": ["Opening review", "New content", "Practice activity", "Summary check"],
    "assessmentStrategy": "Spaced repetition with formative checks per module",
    "pedagogicalNotes": ["Start with real-world examples", "Use misconception correction"]
  }
}`;

/**
 * Extract curriculum structure from assertions.
 * Takes the assertions from a syllabus-tagged source and organizes them into modules.
 */
export async function extractCurriculumFromAssertions(
  assertions: Array<{ assertion: string; category: string; chapter?: string | null; section?: string | null; tags?: string[] }>,
  subjectName: string,
  qualificationRef?: string,
): Promise<ExtractedCurriculum> {
  const warnings: string[] = [];

  if (assertions.length === 0) {
    return {
      ok: false,
      name: subjectName,
      description: "",
      modules: [],
      deliveryConfig: {},
      warnings: ["No assertions provided — upload and extract a document first"],
      error: "No assertions to build curriculum from",
    };
  }

  // Build assertion summary for AI
  const assertionText = assertions
    .map((a, i) => {
      const loc = [a.chapter, a.section].filter(Boolean).join(" > ");
      return `[${i + 1}] ${loc ? `(${loc}) ` : ""}[${a.category}] ${a.assertion}`;
    })
    .join("\n");

  if (assertions.length > 300) {
    warnings.push(`Large document: ${assertions.length} assertions. Curriculum may be approximate.`);
  }

  const userPrompt = `Subject: ${subjectName}${qualificationRef ? `\nQualification: ${qualificationRef}` : ""}

Here are ${assertions.length} extracted teaching assertions from the syllabus:

${assertionText}

Generate a structured curriculum from these assertions.`;

  try {
    const response = await getConfiguredMeteredAICompletion({
      callPoint: "content-trust.curriculum",
      systemPrompt: CURRICULUM_SYSTEM_PROMPT,
      userPrompt,
      responseFormat: "json",
      temperature: 0.3,
    });

    const content = response.content || response.text || "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        ok: false,
        name: subjectName,
        description: "",
        modules: [],
        deliveryConfig: {},
        warnings,
        error: "AI did not return valid JSON",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      ok: true,
      name: parsed.name || subjectName,
      description: parsed.description || "",
      modules: (parsed.modules || []).map((m: any, i: number) => ({
        id: m.id || `MOD-${i + 1}`,
        title: m.title || `Module ${i + 1}`,
        description: m.description || "",
        learningOutcomes: m.learningOutcomes || [],
        assessmentCriteria: m.assessmentCriteria || [],
        keyTerms: m.keyTerms || [],
        estimatedDurationMinutes: m.estimatedDurationMinutes || null,
        sortOrder: m.sortOrder || i + 1,
      })),
      deliveryConfig: parsed.deliveryConfig || {},
      warnings,
    };
  } catch (error: any) {
    return {
      ok: false,
      name: subjectName,
      description: "",
      modules: [],
      deliveryConfig: {},
      warnings,
      error: `AI extraction failed: ${error.message}`,
    };
  }
}
