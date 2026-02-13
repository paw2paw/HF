/**
 * Teaching Content Transform
 *
 * Renders curriculum assertions (extracted from trusted documents) as
 * "APPROVED TEACHING POINTS" in the LLM prompt. This gives the tutor
 * actual source material to teach from, rather than hallucinating content.
 *
 * Data flow:
 * 1. Documents uploaded → assertions extracted (UploadStepForm)
 * 2. Assertions stored in ContentAssertion table
 * 3. curriculumAssertions loader fetches them (SectionDataLoader)
 * 4. This transform groups them by category/chapter and renders for the LLM
 *
 * Categories: fact, definition, threshold, rule, process, example
 */

import { registerTransform } from "../TransformRegistry";
import type { AssembledContext, CurriculumAssertionData } from "../types";

const CATEGORY_LABELS: Record<string, string> = {
  definition: "KEY DEFINITIONS",
  fact: "VERIFIED FACTS",
  threshold: "THRESHOLDS & LIMITS",
  rule: "RULES & REGULATIONS",
  process: "PROCESSES & PROCEDURES",
  example: "EXAMPLES & SCENARIOS",
};

// Category display order (most important first)
const CATEGORY_ORDER = ["definition", "rule", "threshold", "fact", "process", "example"];

/**
 * Group assertions by category, then by chapter within each category.
 */
function groupAssertions(assertions: CurriculumAssertionData[]): Map<string, Map<string, CurriculumAssertionData[]>> {
  const grouped = new Map<string, Map<string, CurriculumAssertionData[]>>();

  for (const a of assertions) {
    const cat = a.category || "fact";
    const chapter = a.chapter || "General";

    if (!grouped.has(cat)) grouped.set(cat, new Map());
    const catMap = grouped.get(cat)!;
    if (!catMap.has(chapter)) catMap.set(chapter, []);
    catMap.get(chapter)!.push(a);
  }

  return grouped;
}

/**
 * Render grouped assertions as structured text for the LLM prompt.
 */
function renderTeachingPoints(
  grouped: Map<string, Map<string, CurriculumAssertionData[]>>,
  totalCount: number,
): string {
  const lines: string[] = [];

  lines.push("## APPROVED TEACHING POINTS");
  lines.push(`(${totalCount} verified assertions from trusted sources)\n`);
  lines.push("IMPORTANT: Use ONLY these teaching points when stating specific facts,");
  lines.push("definitions, thresholds, or rules. Cite the source when quoting figures.\n");

  // Render categories in priority order
  for (const cat of CATEGORY_ORDER) {
    const chapters = grouped.get(cat);
    if (!chapters || chapters.size === 0) continue;

    const label = CATEGORY_LABELS[cat] || cat.toUpperCase();
    lines.push(`### ${label}`);

    for (const [chapter, assertions] of chapters) {
      if (chapter !== "General") {
        lines.push(`  ${chapter}:`);
      }
      for (const a of assertions) {
        const citation = a.pageRef ? ` [${a.sourceName}, ${a.pageRef}]` : ` [${a.sourceName}]`;
        const loRef = a.learningOutcomeRef ? ` (${a.learningOutcomeRef})` : "";
        lines.push(`  - ${a.assertion}${citation}${loRef}`);
      }
    }

    lines.push(""); // blank line between categories
  }

  // Also render any categories not in the predefined order
  for (const [cat, chapters] of grouped) {
    if (CATEGORY_ORDER.includes(cat)) continue;
    const label = cat.toUpperCase();
    lines.push(`### ${label}`);
    for (const [chapter, assertions] of chapters) {
      if (chapter !== "General") {
        lines.push(`  ${chapter}:`);
      }
      for (const a of assertions) {
        const citation = a.pageRef ? ` [${a.sourceName}, ${a.pageRef}]` : ` [${a.sourceName}]`;
        lines.push(`  - ${a.assertion}${citation}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Main transform — registered as "renderTeachingContent".
 *
 * Reads curriculumAssertions from loadedData and renders them as
 * structured teaching points for the LLM prompt.
 */
registerTransform("renderTeachingContent", (
  _rawData: any,
  context: AssembledContext,
) => {
  const allAssertions = context.loadedData.curriculumAssertions || [];

  if (allAssertions.length === 0) {
    return {
      hasTeachingContent: false,
      totalAssertions: 0,
      teachingPoints: null,
      categories: {},
      currentModule: null,
    };
  }

  // Filter assertions to current module's learning outcomes if available
  const currentModule = context.sharedState?.nextModule || context.sharedState?.moduleToReview;
  let assertions = allAssertions;

  if (currentModule?.learningOutcomes?.length && allAssertions.length > 0) {
    const moduleLOs = currentModule.learningOutcomes as string[];
    // Extract short LO identifiers (e.g., "LO2" from "LO2: Explain food safety hazards")
    const loIds = moduleLOs.map((lo) => {
      const match = lo.match(/^(LO\d+|AC[\d.]+)/i);
      return match ? match[1] : lo;
    });

    const moduleAssertions = allAssertions.filter((a) => {
      if (!a.learningOutcomeRef) return false;
      return loIds.some((loId) => a.learningOutcomeRef!.includes(loId));
    });

    // Only use filtered set if we got meaningful matches
    if (moduleAssertions.length > 0) {
      assertions = moduleAssertions;
    }
    // Otherwise fall back to all assertions (better too much context than none)
  }

  // Group assertions
  const grouped = groupAssertions(assertions);

  // Count per category
  const categories: Record<string, number> = {};
  for (const [cat, chapters] of grouped) {
    let count = 0;
    for (const [, items] of chapters) count += items.length;
    categories[cat] = count;
  }

  // Render teaching points text
  const teachingPoints = renderTeachingPoints(grouped, assertions.length);

  // Collect unique sources for metadata
  const sources = [...new Set(assertions.map((a) => a.sourceName))];

  return {
    hasTeachingContent: true,
    totalAssertions: assertions.length,
    teachingPoints,
    categories,
    sources,
    highExamRelevanceCount: assertions.filter((a) => (a.examRelevance ?? 0) > 0.7).length,
    currentModule: currentModule ? {
      id: currentModule.id,
      name: currentModule.name || currentModule.title,
      learningOutcomes: currentModule.learningOutcomes || [],
    } : null,
  };
});
