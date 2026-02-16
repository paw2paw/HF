/**
 * Content Extraction Config Resolver
 *
 * Resolves extraction and structuring configuration by merging:
 * 1. System-level CONTENT-EXTRACT-001 spec (global defaults)
 * 2. Domain-level override spec (per-domain customization)
 *
 * Follows the same pattern as identity layer merging (mergeIdentitySpec).
 */

import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface PyramidLevel {
  depth: number;
  label: string;
  maxChildren: number;
  renderAs: "paragraph" | "heading" | "subheading" | "bold" | "bullet";
  description?: string;
}

export interface ExtractionCategory {
  id: string;
  label: string;
  description: string;
}

export type DocumentType = "CURRICULUM" | "TEXTBOOK" | "WORKSHEET" | "EXAMPLE" | "ASSESSMENT" | "REFERENCE";

export interface ClassificationConfig {
  systemPrompt: string;
  llmConfig: { temperature: number; maxTokens: number };
  sampleSize: number;
  fewShot: {
    enabled: boolean;
    maxExamples: number;
    exampleSampleSize: number;
    domainAware: boolean;
  };
}

export interface TypeOverride {
  extraction?: Partial<ExtractionConfig["extraction"]>;
  structuring?: Partial<ExtractionConfig["structuring"]>;
  rendering?: Partial<ExtractionConfig["rendering"]>;
}

export interface ExtractionConfig {
  extraction: {
    systemPrompt: string;
    categories: ExtractionCategory[];
    llmConfig: { temperature: number; maxTokens: number };
    chunkSize: number;
    maxAssertionsPerDocument: number;
    rules: {
      requirePrecision: string[];
      noInvention: boolean;
      trackTaxYear: boolean;
      trackValidity: boolean;
    };
  };
  structuring: {
    systemPrompt: string;
    levels: PyramidLevel[];
    targetChildCount: number;
    llmConfig: { temperature: number; maxTokens: number };
  };
  rendering: {
    defaultMaxDepth: number;
    depthAdaptation: {
      entryLevel: number;
      fastPace: number;
      advancedPriorKnowledge: number;
    };
  };
  classification: ClassificationConfig;
  typeOverrides: Partial<Record<DocumentType, TypeOverride>>;
}

// ------------------------------------------------------------------
// Default config (fallback if no spec found)
// ------------------------------------------------------------------

const DEFAULT_CONFIG: ExtractionConfig = {
  extraction: {
    systemPrompt: `You are a content extraction specialist. Your job is to parse educational/training material and extract atomic teaching points (assertions).

Each assertion should be:
- A single, self-contained fact, definition, threshold, rule, process step, or example
- Specific enough to be independently verifiable against the source
- Tagged with its category and any relevant metadata

Categories:
- fact: A specific factual statement (e.g., "The ISA allowance is £20,000")
- definition: A term definition (e.g., "An annuity is a series of regular payments")
- threshold: A numeric limit or boundary (e.g., "Higher rate tax starts at £50,270")
- rule: A regulatory or procedural rule (e.g., "Advisors must check affordability before recommending")
- process: A step in a procedure (e.g., "Step 3: Calculate the net relevant earnings")
- example: An illustrative example (e.g., "Example: If a client earns £80,000...")

Return a JSON array of objects with these fields:
- assertion: string (the teaching point)
- category: string (one of the configured categories)
- chapter: string | null (chapter or section heading this comes from)
- section: string | null (sub-section)
- tags: string[] (2-5 keywords)
- examRelevance: number (0.0-1.0, how likely to appear in an exam)
- learningOutcomeRef: string | null (e.g., "LO2", "AC2.3" if identifiable)
- validUntil: string | null (ISO date if time-bound, e.g., tax year figures)
- taxYear: string | null (e.g., "2024/25" if applicable)

IMPORTANT:
- Extract EVERY distinct teaching point, not just highlights
- Be precise with numbers, dates, and thresholds
- If content mentions a tax year or validity period, include it
- Do NOT invent information not present in the source text
- Return ONLY valid JSON (no markdown code fences)`,
    categories: [
      { id: "fact", label: "Factual Statement", description: "A specific factual statement" },
      { id: "definition", label: "Term Definition", description: "A term definition" },
      { id: "threshold", label: "Threshold/Limit", description: "A numeric limit or boundary" },
      { id: "rule", label: "Rule/Regulation", description: "A regulatory or procedural rule" },
      { id: "process", label: "Process Step", description: "A step in a procedure" },
      { id: "example", label: "Example/Scenario", description: "An illustrative example" },
    ],
    llmConfig: { temperature: 0.1, maxTokens: 4000 },
    chunkSize: 8000,
    maxAssertionsPerDocument: 500,
    rules: {
      requirePrecision: ["numbers", "dates", "thresholds"],
      noInvention: true,
      trackTaxYear: false,
      trackValidity: true,
    },
  },
  structuring: {
    systemPrompt: `You are organizing extracted teaching points into a pedagogical pyramid.

Given a set of raw teaching points (assertions), create a hierarchical structure following the configured pyramid levels. Each level should branch into approximately the target number of children.

Rules:
- Every existing assertion must appear as a leaf-level detail under exactly one parent
- Aim for the target child count per node (default: ~3 children)
- Topic slugs should be kebab-case (e.g., "temperature-control")
- Preserve the exact text of existing assertions at the leaf level
- Create new synthesized text for all higher levels
- Higher levels should summarize and frame their children pedagogically
- Return valid JSON matching the requested schema`,
    levels: [
      { depth: 0, label: "overview", maxChildren: 1, renderAs: "paragraph", description: "One paragraph framing the entire subject" },
      { depth: 1, label: "topic", maxChildren: 7, renderAs: "heading", description: "Major topic areas" },
      { depth: 2, label: "key_point", maxChildren: 4, renderAs: "bold", description: "Key points per topic" },
      { depth: 3, label: "detail", maxChildren: 4, renderAs: "bullet", description: "Specific facts, rules, thresholds" },
    ],
    targetChildCount: 3,
    llmConfig: { temperature: 0.2, maxTokens: 8000 },
  },
  rendering: {
    defaultMaxDepth: 3,
    depthAdaptation: {
      entryLevel: -1,
      fastPace: -1,
      advancedPriorKnowledge: -1,
    },
  },
  classification: {
    systemPrompt: `You are a document classification specialist for an educational content system.
Given a text sample from a document and its filename, classify the document into one of these types:

- CURRICULUM: A formal syllabus, curriculum specification, or qualification framework. Contains Learning Outcomes (LOs), Assessment Criteria (ACs), range statements, or module descriptors. Highly structured. Examples: CII R04 syllabus, Ofqual qualification spec, awarding body curriculum.
- TEXTBOOK: A published study text, training manual, or dense reference material. Contains detailed explanations, chapters, worked examples. The primary teaching content. Examples: Sprenger food safety textbook, BFT study guide.
- WORKSHEET: A learner-facing activity sheet or exercise. Something the learner looks at or works through during a lesson. Contains questions, tasks, fill-in-the-blank, case studies for completion. Examples: "The Black Death" worksheet, lab exercise sheet.
- EXAMPLE: An illustrative or case-study document used as source material for discussion. Something the AI will talk ABOUT with the learner. Examples: sample cross-contamination report, case study document, sample complaint letter.
- ASSESSMENT: Test, quiz, or exam material. Contains questions with expected answers, mark schemes, past papers. Examples: mock exam paper, end-of-module test, practice quiz.
- REFERENCE: Quick reference card, glossary, cheat sheet, or summary table. Flat lookup material. Examples: tax rate card, food temperature reference chart, glossary of terms.

Return a JSON object:
{
  "documentType": "CURRICULUM" | "TEXTBOOK" | "WORKSHEET" | "EXAMPLE" | "ASSESSMENT" | "REFERENCE",
  "confidence": 0.0-1.0,
  "reasoning": "one sentence explaining why"
}

Return ONLY valid JSON (no markdown code fences).`,
    llmConfig: { temperature: 0.1, maxTokens: 500 },
    sampleSize: 2000,
    fewShot: {
      enabled: true,
      maxExamples: 5,
      exampleSampleSize: 500,
      domainAware: true,
    },
  },
  typeOverrides: {
    CURRICULUM: {
      extraction: {
        systemPrompt: `You are extracting from a formal syllabus or curriculum document.
Map Learning Outcomes (LOs) to topics, Assessment Criteria (ACs) to key points, and Range statements to details.
Preserve all LO/AC references exactly as written (e.g., "LO2", "AC2.3").

Each assertion should capture one specific requirement, outcome, or criterion from the syllabus.
Use these categories:
- learning_outcome: A formal Learning Outcome statement (e.g., "LO2: Understand the principles of food safety")
- assessment_criterion: An Assessment Criterion under an LO (e.g., "AC2.3: Explain the importance of temperature control")
- range: A range statement or scope item (e.g., "Range: hot holding, cold storage, chilling, freezing")
- definition: A defined term from the syllabus
- rule: A regulatory or procedural requirement

Return a JSON array with: assertion, category, chapter, section, tags, examRelevance, learningOutcomeRef, validUntil, taxYear.
Return ONLY valid JSON.`,
        categories: [
          { id: "learning_outcome", label: "Learning Outcome", description: "A formal LO statement from the syllabus" },
          { id: "assessment_criterion", label: "Assessment Criterion", description: "An AC under a Learning Outcome" },
          { id: "range", label: "Range/Scope", description: "A range statement or scope item" },
          { id: "definition", label: "Term Definition", description: "A defined term from the syllabus" },
          { id: "rule", label: "Rule/Regulation", description: "A regulatory requirement" },
        ],
      },
      structuring: {
        levels: [
          { depth: 0, label: "module", maxChildren: 10, renderAs: "heading", description: "Top-level module or unit" },
          { depth: 1, label: "learning_outcome", maxChildren: 8, renderAs: "subheading", description: "Learning Outcome" },
          { depth: 2, label: "assessment_criterion", maxChildren: 6, renderAs: "bold", description: "Assessment Criterion" },
          { depth: 3, label: "range_detail", maxChildren: 8, renderAs: "bullet", description: "Range statement or detail" },
        ],
      },
    },
    WORKSHEET: {
      extraction: {
        systemPrompt: `You are extracting from a learner worksheet or activity sheet.
This document is something a learner looks at and works through during a lesson.
Capture the worksheet structure: title, sections, questions, activities, reference material, and any key information presented.
Do NOT extract standalone teaching facts — extract what the learner sees and interacts with.

Categories:
- question: A question or task for the learner
- activity: An activity or exercise instruction
- information: Key information or context presented on the worksheet
- reference: Reference data, tables, or source material on the worksheet

Return a JSON array with: assertion, category, chapter, section, tags, examRelevance, learningOutcomeRef.
Return ONLY valid JSON.`,
        categories: [
          { id: "question", label: "Question/Task", description: "A question or task for the learner" },
          { id: "activity", label: "Activity", description: "An activity or exercise instruction" },
          { id: "information", label: "Information", description: "Key information presented on the worksheet" },
          { id: "reference", label: "Reference Data", description: "Tables, sources, or reference material" },
        ],
        maxAssertionsPerDocument: 100,
      },
    },
    EXAMPLE: {
      extraction: {
        systemPrompt: `You are extracting from an illustrative or case-study document.
This is a source document the AI tutor will discuss WITH the learner — not teach FROM.
Capture: what the document shows, key concepts it illustrates, why it is significant,
and discussion points a tutor might raise about it.

Categories:
- concept: A key concept the example illustrates
- observation: Something notable about the document
- discussion_point: A question or point a tutor would raise about this example
- context: Background context about the document

Return a JSON array with: assertion, category, chapter, section, tags.
Return ONLY valid JSON.`,
        categories: [
          { id: "concept", label: "Key Concept", description: "A concept the example illustrates" },
          { id: "observation", label: "Observation", description: "Something notable about the document" },
          { id: "discussion_point", label: "Discussion Point", description: "A point a tutor would raise" },
          { id: "context", label: "Context", description: "Background context" },
        ],
        maxAssertionsPerDocument: 50,
      },
    },
    ASSESSMENT: {
      extraction: {
        systemPrompt: `You are extracting from assessment or quiz material.
Capture each question, the correct answer(s), common misconceptions, and which Learning Outcome is being tested.

Categories:
- question: An assessment question
- answer: The correct answer or mark scheme point
- misconception: A common wrong answer or misunderstanding
- fact: A factual statement used in the question context

Return a JSON array with: assertion, category, chapter, section, tags, examRelevance, learningOutcomeRef.
Return ONLY valid JSON.`,
        categories: [
          { id: "question", label: "Question", description: "An assessment question" },
          { id: "answer", label: "Correct Answer", description: "The correct answer or mark scheme point" },
          { id: "misconception", label: "Misconception", description: "A common wrong answer" },
          { id: "fact", label: "Factual Statement", description: "A fact used in question context" },
        ],
      },
    },
    REFERENCE: {
      extraction: {
        systemPrompt: `You are extracting from a reference card, glossary, or quick-reference document.
Extract terms, definitions, thresholds, key values, and rules as flat items.
No deep structuring needed — these are lookup items.

Categories:
- definition: A term definition
- threshold: A numeric limit or boundary value
- rule: A rule or regulation
- fact: A factual statement or key value

Return a JSON array with: assertion, category, tags.
Return ONLY valid JSON.`,
        maxAssertionsPerDocument: 200,
      },
      structuring: {
        levels: [
          { depth: 0, label: "topic", maxChildren: 20, renderAs: "heading", description: "Topic grouping" },
          { depth: 1, label: "term", maxChildren: 10, renderAs: "bullet", description: "Individual term or value" },
        ],
      },
    },
  },
};

// ------------------------------------------------------------------
// Deep merge utility
// ------------------------------------------------------------------

/**
 * Deep-merge two objects. Override values win; arrays are replaced (not concatenated).
 */
export function deepMerge<T extends Record<string, any>>(base: T, override: Partial<T>): T {
  const result = { ...base };

  for (const key of Object.keys(override) as (keyof T)[]) {
    const overrideVal = override[key];
    const baseVal = base[key];

    if (overrideVal === undefined) continue;

    if (
      overrideVal !== null &&
      typeof overrideVal === "object" &&
      !Array.isArray(overrideVal) &&
      baseVal !== null &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal)
    ) {
      // Recurse for nested objects
      result[key] = deepMerge(baseVal as any, overrideVal as any);
    } else {
      // Direct replacement (including arrays)
      result[key] = overrideVal as T[keyof T];
    }
  }

  return result;
}

// ------------------------------------------------------------------
// Config resolution
// ------------------------------------------------------------------

/**
 * Resolve extraction config for a content source.
 *
 * Resolution chain:
 * 1. Load system spec (CONTENT-EXTRACT-001)
 * 2. Find domain via: ContentSource → SubjectSource → Subject → SubjectDomain → Domain
 * 3. Find domain-level EXTRACT spec override (if any)
 * 4. Deep-merge: domain override wins where specified
 * 5. Apply document-type-specific overrides (if documentType provided)
 */
export async function resolveExtractionConfig(
  sourceId?: string,
  documentType?: DocumentType,
): Promise<ExtractionConfig> {
  // 1. Load system spec
  const systemSpec = await prisma.analysisSpec.findFirst({
    where: {
      slug: { contains: config.specs.contentExtract.toLowerCase() },
      specRole: "EXTRACT",
      scope: "SYSTEM",
    },
    select: { config: true },
  });

  const systemConfig = systemSpec?.config as Record<string, any> | null;
  let resolved = systemConfig
    ? deepMerge(DEFAULT_CONFIG, systemConfig as Partial<ExtractionConfig>)
    : DEFAULT_CONFIG;

  // 2. If we have a sourceId, find the domain and check for overrides
  if (sourceId) {
    const domainOverride = await findDomainOverrideConfig(sourceId);
    if (domainOverride) {
      resolved = deepMerge(resolved, domainOverride as Partial<ExtractionConfig>);
    }
  }

  // 3. Apply document-type-specific overrides
  resolved = applyTypeOverrides(resolved, documentType);

  return resolved;
}

/**
 * Resolve extraction config for a specific domain (by domainId).
 * Used by the domain config UI.
 */
export async function resolveExtractionConfigForDomain(
  domainId: string,
  documentType?: DocumentType,
): Promise<ExtractionConfig> {
  // 1. Load system spec
  const systemSpec = await prisma.analysisSpec.findFirst({
    where: {
      slug: { contains: config.specs.contentExtract.toLowerCase() },
      specRole: "EXTRACT",
      scope: "SYSTEM",
    },
    select: { config: true },
  });

  const systemConfig = systemSpec?.config as Record<string, any> | null;
  let resolved = systemConfig
    ? deepMerge(DEFAULT_CONFIG, systemConfig as Partial<ExtractionConfig>)
    : DEFAULT_CONFIG;

  // 2. Find domain-level override
  const domainSpec = await findDomainExtractSpec(domainId);
  if (domainSpec) {
    resolved = deepMerge(resolved, domainSpec as Partial<ExtractionConfig>);
  }

  // 3. Apply document-type-specific overrides
  resolved = applyTypeOverrides(resolved, documentType);

  return resolved;
}

/**
 * Apply document-type-specific overrides to a resolved config.
 * Type overrides are the last merge step — they override both system and domain configs.
 */
function applyTypeOverrides(
  resolved: ExtractionConfig,
  documentType?: DocumentType,
): ExtractionConfig {
  if (!documentType || documentType === "TEXTBOOK") return resolved;

  const typeOverride = resolved.typeOverrides?.[documentType];
  if (!typeOverride) return resolved;

  let result = resolved;
  if (typeOverride.extraction) {
    result = deepMerge(result, { extraction: typeOverride.extraction } as Partial<ExtractionConfig>);
  }
  if (typeOverride.structuring) {
    result = deepMerge(result, { structuring: typeOverride.structuring } as Partial<ExtractionConfig>);
  }
  if (typeOverride.rendering) {
    result = deepMerge(result, { rendering: typeOverride.rendering } as Partial<ExtractionConfig>);
  }
  return result;
}

/**
 * Find domain override config by following the source → subject → domain chain.
 */
async function findDomainOverrideConfig(sourceId: string): Promise<Record<string, any> | null> {
  // Find the domain(s) this source belongs to via Subject → SubjectDomain
  const subjectSources = await prisma.subjectSource.findMany({
    where: { sourceId },
    select: {
      subject: {
        select: {
          domains: {
            select: { domainId: true },
            take: 1,
          },
        },
      },
    },
    take: 1,
  });

  const domainId = subjectSources[0]?.subject?.domains?.[0]?.domainId;
  if (!domainId) return null;

  return findDomainExtractSpec(domainId);
}

/**
 * Find a domain-level EXTRACT spec override for a specific domain.
 */
async function findDomainExtractSpec(domainId: string): Promise<Record<string, any> | null> {
  // Look for domain-scoped EXTRACT specs in the domain's published playbook
  const playbook = await prisma.playbook.findFirst({
    where: {
      domainId,
      status: "PUBLISHED",
    },
    select: {
      items: {
        where: {
          itemType: "SPEC",
          spec: {
            specRole: "EXTRACT",
            scope: "DOMAIN",
            domain: "content-trust",
            isActive: true,
          },
        },
        select: {
          spec: {
            select: { config: true },
          },
        },
        take: 1,
      },
    },
  });

  const specConfig = playbook?.items?.[0]?.spec?.config as Record<string, any> | null;
  return specConfig || null;
}

/**
 * Get the max depth (leaf level) from the pyramid levels config.
 */
export function getMaxDepth(extractionConfig: ExtractionConfig): number {
  const levels = extractionConfig.structuring.levels;
  if (levels.length === 0) return 0;
  return Math.max(...levels.map((l) => l.depth));
}

/**
 * Get the leaf level label from the pyramid levels config.
 */
export function getLeafLabel(extractionConfig: ExtractionConfig): string {
  const levels = extractionConfig.structuring.levels;
  if (levels.length === 0) return "detail";
  return levels[levels.length - 1].label;
}
