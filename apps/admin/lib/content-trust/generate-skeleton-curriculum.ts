/**
 * Skeleton Curriculum Generation
 *
 * Fast, lightweight curriculum outline using Haiku model.
 * Produces module titles + descriptions only — no learning outcomes,
 * assessment criteria, or key terms. Detail is filled in async by
 * the curriculum enricher background job.
 */

import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";
import type { CurriculumModule } from "./extract-curriculum";

export interface SkeletonCurriculum {
  ok: boolean;
  name: string;
  description: string;
  modules: CurriculumModule[];
  warnings: string[];
  error?: string;
}

const SKELETON_SYSTEM_PROMPT = `You are a curriculum designer. Given a subject and learning goals, generate a skeleton curriculum outline.
Output ONLY module titles and one-sentence descriptions. Do NOT generate learning outcomes, assessment criteria, or key terms.

Return valid JSON only:
{
  "name": "Curriculum title",
  "description": "One-sentence description",
  "modules": [
    { "id": "MOD-1", "title": "Module title", "description": "One sentence", "sortOrder": 1 }
  ]
}

Rules:
- Generate 4-8 modules from foundational to advanced
- Keep descriptions to one sentence each
- Use module IDs: MOD-1, MOD-2, etc.
- Return ONLY valid JSON, no explanation`;

/**
 * Generate a skeleton curriculum outline using a fast model.
 * Returns module titles + descriptions; detail arrays are empty.
 */
export async function generateSkeletonCurriculum(
  subjectName: string,
  persona: string,
  learningGoals: string[],
  qualificationRef?: string,
): Promise<SkeletonCurriculum> {
  const goalsText = learningGoals.length > 0
    ? `\nGoals:\n${learningGoals.map((g, i) => `${i + 1}. ${g}`).join("\n")}`
    : "";

  try {
    // @ai-call content-trust.curriculum-skeleton — Fast skeleton curriculum (titles + descriptions only) | config: /x/ai-config
    const response = await getConfiguredMeteredAICompletion({
      callPoint: "content-trust.curriculum-skeleton",
      messages: [
        { role: "system", content: SKELETON_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Subject: ${subjectName}\nStyle: ${persona}${qualificationRef ? `\nQualification: ${qualificationRef}` : ""}${goalsText}\n\nGenerate a skeleton curriculum outline.`,
        },
      ],
      timeoutMs: 15000,
    });

    const content = response.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false, name: subjectName, description: "", modules: [], warnings: [], error: "No JSON in skeleton response" };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // Try removing trailing commas
      const cleaned = jsonMatch[0].replace(/,\s*([\]}])/g, "$1");
      parsed = JSON.parse(cleaned);
    }

    return {
      ok: true,
      name: parsed.name || subjectName,
      description: parsed.description || "",
      modules: (parsed.modules || []).map((m: any, i: number) => ({
        id: m.id || `MOD-${i + 1}`,
        title: m.title || `Module ${i + 1}`,
        description: m.description || "",
        sortOrder: m.sortOrder || i + 1,
        learningOutcomes: [],
        assessmentCriteria: [],
        keyTerms: [],
      })),
      warnings: [],
    };
  } catch (error: any) {
    return {
      ok: false,
      name: subjectName,
      description: "",
      modules: [],
      warnings: [],
      error: `Skeleton generation failed: ${error.message}`,
    };
  }
}
