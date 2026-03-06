/**
 * Session Materials Transform
 *
 * Identifies student-visible content sources (tagged "student-material")
 * and builds a manifest for the voice prompt. The AI uses this to:
 * - Know what the student can see on their screen
 * - Reference specific documents and pages during the call
 * - Adjust delivery (e.g. don't read back questions the student can see)
 *
 * Auto-classified by documentType at upload time (teacher can override
 * via eye toggle in sources panel).
 */

import { registerTransform } from "../TransformRegistry";
import type { AssembledContext } from "../types";

export interface SessionMaterialItem {
  sourceName: string;
  documentType: string;
  chapters: string[];
}

registerTransform("formatSessionMaterials", (_rawData: any, context: AssembledContext) => {
  const subjectSources = context.loadedData?.subjectSources;
  if (!subjectSources?.subjects?.length) return null;

  const assertions = context.loadedData?.curriculumAssertions || [];
  const vocab = context.loadedData?.curriculumVocabulary || [];

  // Build a map: sourceName → documentType (from assertions)
  const sourceDocTypes = new Map<string, string>();
  for (const a of assertions) {
    if (a.sourceName && a.sourceDocumentType && !sourceDocTypes.has(a.sourceName)) {
      sourceDocTypes.set(a.sourceName, a.sourceDocumentType);
    }
  }

  // Collect student-visible sources across all subjects
  const materials: SessionMaterialItem[] = [];
  const seenNames = new Set<string>();

  for (const subject of subjectSources.subjects) {
    for (const source of subject.sources) {
      if (!source.tags?.includes("student-material")) continue;
      if (seenNames.has(source.name)) continue;
      seenNames.add(source.name);

      // Gather chapter names from assertions for this source
      const chapters = [
        ...new Set(
          assertions
            .filter((a) => a.sourceName === source.name && a.chapter)
            .map((a) => a.chapter!),
        ),
      ];

      materials.push({
        sourceName: source.name,
        documentType: sourceDocTypes.get(source.name) || "DOCUMENT",
        chapters,
      });
    }
  }

  if (materials.length === 0) return null;

  // Collect vocabulary terms for student-visible sources
  const vocabTerms = vocab.slice(0, 10).map((v) => v.term);

  return {
    hasSessionMaterials: true,
    count: materials.length,
    materials,
    vocabTerms: vocabTerms.length > 0 ? vocabTerms : undefined,
  };
});
