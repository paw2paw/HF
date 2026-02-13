/**
 * AI Identity Generator
 *
 * Generates a tailored identity spec config from extracted assertions + persona choice.
 * Upload "Food Safety Level 2.pdf" → get a food safety expert tutor identity.
 * Upload "Quantum Mechanics.pdf" → get a physics tutor identity.
 *
 * NO HARDCODING — persona is a string, identity is AI-generated from your content.
 * The config shape matches what `extractIdentitySpec` transform reads (identity.ts:119-156).
 */

import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";

// ── Types ──────────────────────────────────────────────

export interface GeneratedIdentityConfig {
  roleStatement: string;
  primaryGoal: string;
  secondaryGoals: string[];
  techniques: Array<{ name: string; description: string; when: string }>;
  defaults: Record<string, any>;
  styleGuidelines: string[];
  does: string[];
  doesNot: string[];
  opening: { approach: string; examples: string[] };
  main: { approach: string; strategies: string[] };
  closing: { approach: string; examples: string[] };
  principles: string[];
  methods: string[];
  domainVocabulary: string[];
}

export interface GenerateIdentityOptions {
  subjectName: string;
  persona: string;
  learningGoals: string[];
  assertions: Array<{
    assertion: string;
    category: string;
    chapter?: string | null;
    tags: string[];
  }>;
  maxSampleSize?: number;
}

export interface GenerateIdentityResult {
  ok: boolean;
  config: GeneratedIdentityConfig | null;
  error?: string;
}

// ── Assertion Sampling ─────────────────────────────────

/**
 * Sample assertions proportionally across chapters/categories
 * to give the AI a representative view of the subject.
 */
function sampleAssertions(
  assertions: GenerateIdentityOptions["assertions"],
  maxSize: number
): GenerateIdentityOptions["assertions"] {
  if (assertions.length <= maxSize) return assertions;

  // Group by chapter
  const byChapter = new Map<string, typeof assertions>();
  for (const a of assertions) {
    const key = a.chapter || "__uncategorized__";
    const group = byChapter.get(key) || [];
    group.push(a);
    byChapter.set(key, group);
  }

  // Take proportionally from each chapter
  const sampled: typeof assertions = [];
  const chapterCount = byChapter.size;
  const perChapter = Math.max(1, Math.floor(maxSize / chapterCount));

  for (const [, group] of byChapter) {
    const take = Math.min(perChapter, group.length);
    // Spread evenly through the group
    const step = group.length / take;
    for (let i = 0; i < take; i++) {
      sampled.push(group[Math.floor(i * step)]);
    }
    if (sampled.length >= maxSize) break;
  }

  return sampled.slice(0, maxSize);
}

// ── AI Prompt ──────────────────────────────────────────

const IDENTITY_SYSTEM_PROMPT = `You are generating the identity configuration for an AI teaching agent.
The agent will teach learners via phone calls. Based on the teaching material excerpts provided,
generate a JSON identity configuration that makes this agent a convincing subject matter expert.

The configuration MUST include ALL of these fields:
- roleStatement: A 2-3 sentence description positioning the agent as an expert in this specific subject
- primaryGoal: The main teaching objective (informed by the learner's goals if provided)
- secondaryGoals: Array of 3-5 secondary goals
- techniques: Array of 3-5 teaching techniques, each with { name, description, when }
- defaults: Object with style defaults like { warmth: "high", formality: "moderate", pace: "adaptive" }
- styleGuidelines: Array of 4-6 style guidelines specific to this subject
- does: Array of 4-6 things this agent DOES (boundaries)
- doesNot: Array of 4-6 things this agent DOES NOT do
- opening: { approach: string, examples: string[] } for session openings
- main: { approach: string, strategies: string[] } for main teaching
- closing: { approach: string, examples: string[] } for session closings
- principles: Array of 3-5 assessment principles
- methods: Array of 3-5 assessment methods
- domainVocabulary: Array of 10-20 key terms the agent should use naturally

IMPORTANT:
- The agent should sound like a genuine expert in this specific subject
- Use vocabulary and examples from the actual source material
- Do NOT claim qualifications the agent doesn't have
- Do NOT give advice outside the subject domain
- Tailor everything to phone-based teaching (verbal, conversational)
- Return ONLY valid JSON (no markdown code fences)`;

// ── Main Function ──────────────────────────────────────

export async function generateIdentityFromAssertions(
  options: GenerateIdentityOptions
): Promise<GenerateIdentityResult> {
  const maxSample = options.maxSampleSize ?? 60;
  const sampled = sampleAssertions(options.assertions, maxSample);

  if (sampled.length === 0) {
    return buildFallbackConfig(options.subjectName, options.persona, options.learningGoals);
  }

  // Build assertion summary for AI
  const assertionText = sampled
    .map((a, i) => {
      const loc = a.chapter ? `(${a.chapter}) ` : "";
      return `[${i + 1}] ${loc}[${a.category}] ${a.assertion}`;
    })
    .join("\n");

  // Extract key chapters/topics for context
  const chapters = [...new Set(sampled.map(a => a.chapter).filter(Boolean))];
  const categories = [...new Set(sampled.map(a => a.category))];

  const goalsSection = options.learningGoals.length > 0
    ? `\nLearner's goals: ${options.learningGoals.join(", ")}.\nTailor the identity's primaryGoal, techniques, and session structure to support these goals.`
    : "";

  const userPrompt = `Generate an identity for a "${options.persona}" agent teaching "${options.subjectName}".
${goalsSection}

Subject covers ${chapters.length} topic areas: ${chapters.slice(0, 10).join(", ")}${chapters.length > 10 ? "..." : ""}
Content categories: ${categories.join(", ")}

Here are ${sampled.length} representative teaching points from the source material:

${assertionText}

Generate the identity configuration JSON.`;

  try {
    const response = await getConfiguredMeteredAICompletion({
      callPoint: "quick-launch.identity",
      messages: [
        { role: "system", content: IDENTITY_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    });

    const content = response.content || "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[generate-identity] AI did not return valid JSON, using fallback");
      return buildFallbackConfig(options.subjectName, options.persona, options.learningGoals);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields exist
    const config: GeneratedIdentityConfig = {
      roleStatement: parsed.roleStatement || `You are a knowledgeable ${options.persona} specializing in ${options.subjectName}.`,
      primaryGoal: parsed.primaryGoal || `Help learners develop genuine understanding of ${options.subjectName}`,
      secondaryGoals: parsed.secondaryGoals || [],
      techniques: Array.isArray(parsed.techniques) ? parsed.techniques : [],
      defaults: parsed.defaults || { warmth: "high", formality: "moderate", pace: "adaptive" },
      styleGuidelines: parsed.styleGuidelines || [],
      does: parsed.does || [],
      doesNot: parsed.doesNot || [],
      opening: parsed.opening || { approach: "Warm greeting with subject context", examples: [] },
      main: parsed.main || { approach: "Conversational teaching with checks for understanding", strategies: [] },
      closing: parsed.closing || { approach: "Summary and preview of next session", examples: [] },
      principles: parsed.principles || [],
      methods: parsed.methods || [],
      domainVocabulary: parsed.domainVocabulary || [],
    };

    return { ok: true, config };
  } catch (err: any) {
    console.error("[generate-identity] AI call failed:", err.message);
    return buildFallbackConfig(options.subjectName, options.persona, options.learningGoals);
  }
}

// ── Fallback ───────────────────────────────────────────

function buildFallbackConfig(
  subjectName: string,
  persona: string,
  learningGoals: string[]
): GenerateIdentityResult {
  const goalText = learningGoals.length > 0
    ? `, focused on helping learners ${learningGoals[0].toLowerCase()}`
    : "";

  return {
    ok: true,
    config: {
      roleStatement: `You are a friendly, patient ${persona} specializing in ${subjectName}${goalText}. You make complex topics accessible through clear explanations and real-world examples.`,
      primaryGoal: `Help learners build genuine understanding of ${subjectName}`,
      secondaryGoals: [
        "Build learner confidence through encouragement",
        "Adapt to each learner's pace and style",
        "Make content relevant to real-world applications",
      ],
      techniques: [
        { name: "Scaffolding", description: "Build on what the learner already knows", when: "Introducing new concepts" },
        { name: "Check Understanding", description: "Ask open questions to verify comprehension", when: "After explaining a concept" },
        { name: "Real-World Examples", description: "Connect theory to practical scenarios", when: "When concepts feel abstract" },
      ],
      defaults: { warmth: "high", formality: "moderate", pace: "adaptive" },
      styleGuidelines: [
        "Use clear, jargon-free language unless teaching technical terms",
        "Keep explanations concise — this is a phone call, not a lecture",
        "Encourage questions and curiosity",
        "Celebrate progress and correct answers",
      ],
      does: [
        `Teaches ${subjectName} content accurately`,
        "Adapts pace to the learner",
        "Checks understanding regularly",
        "Provides encouragement",
      ],
      doesNot: [
        "Give advice outside the subject domain",
        "Rush through material",
        "Use overly complex language",
        "Make up facts not in the source material",
      ],
      opening: { approach: "Warm greeting with brief recap of previous session", examples: [] },
      main: { approach: "Conversational teaching with comprehension checks", strategies: [] },
      closing: { approach: "Summarise key points and preview next topic", examples: [] },
      principles: ["Focus on understanding, not memorisation", "Check before moving on"],
      methods: ["Open-ended questions", "Scenario-based checks"],
      domainVocabulary: [],
    },
    error: undefined,
  };
}
