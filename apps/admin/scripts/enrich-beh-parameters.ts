/**
 * One-off script: Enrich BEH-* parameter metadata
 *
 * Updates name, definition, interpretationHigh, interpretationLow
 * for all BEH-* parameters that still have raw ID-style names.
 *
 * Usage: cd apps/admin && npx tsx scripts/enrich-beh-parameters.ts
 *
 * After running:
 *   1. Run `npm run registry:generate` to regenerate the registry JSON
 *   2. Commit both the DB changes and the regenerated JSON
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ParamEnrichment {
  parameterId: string;
  name: string;
  definition: string;
  interpretationHigh: string;
  interpretationLow: string;
}

/**
 * Curated enrichment data for BEH-* parameters.
 *
 * Naming conventions:
 * - Short, educator-friendly names (2-3 words max)
 * - Definition explains what the slider controls in plain English
 * - interpretationHigh/Low describe what happens at each extreme
 */
const ENRICHMENTS: ParamEnrichment[] = [
  // ── curriculum-adaptation ──────────────────────────────────────────
  {
    parameterId: "BEH-ADVANCE-READINESS",
    name: "Advance Readiness",
    definition: "How quickly the AI moves the learner to new material based on demonstrated understanding.",
    interpretationHigh: "Fast Progression: Moves to new topics as soon as basic competence is shown",
    interpretationLow: "Thorough Mastery: Stays on a topic until deep understanding is confirmed",
  },
  {
    parameterId: "BEH-ANALOGY-USAGE",
    name: "Analogy Use",
    definition: "How often the AI uses analogies and metaphors to bridge from familiar concepts to new ones.",
    interpretationHigh: "Analogy-Rich: Frequently uses comparisons and metaphors to explain ideas",
    interpretationLow: "Direct Explanation: Explains concepts in their own terms without analogies",
  },
  {
    parameterId: "BEH-CHALLENGE-LEVEL",
    name: "Challenge Level",
    definition: "The difficulty of questions and problems the AI presents to the learner.",
    interpretationHigh: "Stretching: Presents problems just beyond current ability to promote growth",
    interpretationLow: "Comfortable: Keeps problems within easy reach to build confidence",
  },
  {
    parameterId: "BEH-CHECK-FOR-UNDERSTANDING",
    name: "Comprehension Checks",
    definition: "How frequently the AI pauses to verify the learner has understood before moving on.",
    interpretationHigh: "Frequent Checks: Regularly asks the learner to explain back or demonstrate understanding",
    interpretationLow: "Trust & Continue: Assumes understanding unless the learner signals confusion",
  },
  {
    parameterId: "BEH-CONCEPT-DENSITY",
    name: "Concept Density",
    definition: "How many new ideas the AI introduces in a single exchange.",
    interpretationHigh: "Dense: Introduces multiple connected ideas per exchange for fast learners",
    interpretationLow: "Sparse: One idea at a time with space to absorb before adding more",
  },
  {
    parameterId: "BEH-EXAMPLE-RICHNESS",
    name: "Example Richness",
    definition: "How many concrete examples the AI provides when explaining a concept.",
    interpretationHigh: "Example-Rich: Multiple worked examples and illustrations for each concept",
    interpretationLow: "Minimal Examples: Brief or no examples — relies on abstract explanation",
  },
  {
    parameterId: "BEH-EXPLANATION-VARIETY",
    name: "Explanation Variety",
    definition: "Whether the AI tries different approaches when a learner doesn't understand the first time.",
    interpretationHigh: "Multi-Angle: Rephrases, uses different models, and tries new angles automatically",
    interpretationLow: "Consistent: Repeats and reinforces the same explanation with more detail",
  },
  {
    parameterId: "BEH-FOUNDATION-FOCUS",
    name: "Foundation Focus",
    definition: "How much the AI prioritises filling gaps in prerequisite knowledge before advancing.",
    interpretationHigh: "Gap-Filling: Pauses to address missing foundations before teaching new material",
    interpretationLow: "Forward-Moving: Focuses on current material, addressing gaps only when they block progress",
  },
  {
    parameterId: "BEH-GUIDED-PRACTICE",
    name: "Guided Practice",
    definition: "How much step-by-step support the AI provides during practice activities.",
    interpretationHigh: "Heavily Guided: Walks through each step, provides hints and scaffolding",
    interpretationLow: "Independent: Sets the task and lets the learner work through it alone",
  },
  {
    parameterId: "BEH-INTERLEAVING",
    name: "Interleaving",
    definition: "How much the AI mixes review of previous topics into current learning.",
    interpretationHigh: "Mixed Practice: Regularly weaves past topics into current sessions for retention",
    interpretationLow: "Focused Blocks: Concentrates on one topic at a time without mixing",
  },
  {
    parameterId: "BEH-NEW-CONTENT-RATE",
    name: "New Content Rate",
    definition: "How quickly the AI introduces fresh material versus reviewing what's already been taught.",
    interpretationHigh: "Fast Introduction: Quickly moves to new material, minimal review time",
    interpretationLow: "Review First: Extensive review of existing material before introducing anything new",
  },
  {
    parameterId: "BEH-NUANCE-EXPLORATION",
    name: "Nuance Exploration",
    definition: "How deeply the AI explores edge cases, exceptions, and subtle distinctions.",
    interpretationHigh: "Deep Nuance: Probes edge cases, exceptions, and grey areas to deepen understanding",
    interpretationLow: "Core Only: Sticks to the main rule or concept without exploring exceptions",
  },
  {
    parameterId: "BEH-PRACTICE-RATIO",
    name: "Practice Ratio",
    definition: "The balance between explanation and hands-on practice in each session.",
    interpretationHigh: "Practice-Heavy: Most of the session is spent on exercises and application",
    interpretationLow: "Explanation-Heavy: Most of the session is spent on teaching and explaining",
  },
  {
    parameterId: "BEH-PREREQUISITE-CALLBACK",
    name: "Prerequisite Callback",
    definition: "How often the AI explicitly links current material back to previously learned concepts.",
    interpretationHigh: "Frequent Links: Regularly connects new ideas to what was learned before",
    interpretationLow: "Standalone: Teaches each concept independently without referencing prior knowledge",
  },
  {
    parameterId: "BEH-PROBING-QUESTIONS",
    name: "Probing Questions",
    definition: "How often the AI asks deeper follow-up questions to extend the learner's thinking.",
    interpretationHigh: "Socratic: Frequently asks 'why' and 'what if' to push thinking further",
    interpretationLow: "Accepting: Accepts answers at face value without probing deeper",
  },
  {
    parameterId: "BEH-PRODUCTIVE-STRUGGLE",
    name: "Productive Struggle",
    definition: "How long the AI lets a learner work through difficulty before stepping in to help.",
    interpretationHigh: "Patient Struggle: Lets the learner wrestle with the problem, offering encouragement",
    interpretationLow: "Quick Rescue: Steps in quickly with hints or answers when difficulty is detected",
  },
  {
    parameterId: "BEH-REPETITION-FREQUENCY",
    name: "Repetition Frequency",
    definition: "How often the AI restates or revisits key concepts within a session.",
    interpretationHigh: "Frequent Repetition: Deliberately restates key ideas multiple times per session",
    interpretationLow: "Say Once: States concepts once and moves on without repetition",
  },
  {
    parameterId: "BEH-SCAFFOLDING",
    name: "Scaffolding",
    definition: "How much structural support the AI provides to help the learner tackle complex tasks.",
    interpretationHigh: "Heavy Scaffolding: Breaks tasks into small steps, provides frameworks and templates",
    interpretationLow: "Minimal Scaffolding: Presents the full task and lets the learner structure their approach",
  },
  {
    parameterId: "BEH-SPACED-RETRIEVAL-PRIORITY",
    name: "Spaced Retrieval",
    definition: "How aggressively the AI schedules review of material showing signs of fading.",
    interpretationHigh: "Aggressive Review: Prioritises retrieval practice for declining mastery areas",
    interpretationLow: "Forward Focus: Prioritises new material over reviewing fading knowledge",
  },
  {
    parameterId: "BEH-WORKED-EXAMPLES",
    name: "Worked Examples",
    definition: "Whether the AI demonstrates complete solutions before asking the learner to try.",
    interpretationHigh: "Demo First: Shows fully worked examples before asking the learner to attempt",
    interpretationLow: "Try First: Asks the learner to attempt the problem before showing solutions",
  },

  // ── learning-adaptation ────────────────────────────────────────────
  {
    parameterId: "BEH-ABSTRACT-OK",
    name: "Abstract Comfort",
    definition: "How comfortable the learner is with theoretical and abstract concepts versus concrete ones.",
    interpretationHigh: "Abstract Thinker: Comfortable with theory, models, and generalisations",
    interpretationLow: "Concrete Thinker: Needs tangible examples and real-world grounding",
  },
  {
    parameterId: "BEH-ACTION-VERBS",
    name: "Action Language",
    definition: "Whether the AI uses action-oriented, practical language versus abstract terminology.",
    interpretationHigh: "Action-Oriented: Uses 'do', 'build', 'try' — grounds learning in activity",
    interpretationLow: "Conceptual: Uses 'consider', 'reflect', 'understand' — grounds learning in thought",
  },
  {
    parameterId: "BEH-APPROACH-SWITCHING",
    name: "Approach Switching",
    definition: "How freely the AI switches between different teaching modalities during a session.",
    interpretationHigh: "Flexible: Switches freely between visual, auditory, and hands-on approaches",
    interpretationLow: "Consistent: Sticks with one approach throughout the session",
  },
  {
    parameterId: "BEH-CONVERSATIONAL-TONE",
    name: "Conversational Tone",
    definition: "How casual and natural the AI's language is during teaching.",
    interpretationHigh: "Chatty: Relaxed, informal, conversational — like talking to a friend",
    interpretationLow: "Formal: Structured, professional, precise — like a textbook",
  },
  {
    parameterId: "BEH-DEFINITION-PRECISION",
    name: "Definition Precision",
    definition: "How precisely the AI defines technical terms and concepts.",
    interpretationHigh: "Precise: Uses exact definitions, technical accuracy, formal terminology",
    interpretationLow: "Approximate: Uses plain-language descriptions, favours intuition over precision",
  },
  {
    parameterId: "BEH-DIAGRAM-LANGUAGE",
    name: "Diagram Language",
    definition: "How much the AI describes concepts using visual/spatial structures (diagrams, charts, maps).",
    interpretationHigh: "Visual Structures: Describes layouts, diagrams, and spatial relationships frequently",
    interpretationLow: "Narrative: Explains through stories and sequential descriptions",
  },
  {
    parameterId: "BEH-FEELING-LANGUAGE",
    name: "Feeling Language",
    definition: "How much the AI uses sensory and emotional language (feel, sense, touch, experience).",
    interpretationHigh: "Kinaesthetic: Rich sensory language — 'feel the weight of', 'get a sense for'",
    interpretationLow: "Analytical: Factual, logical language — 'note that', 'observe that'",
  },
  {
    parameterId: "BEH-IMAGERY-DENSITY",
    name: "Imagery Density",
    definition: "How much the AI uses vivid mental imagery and visualisation in explanations.",
    interpretationHigh: "Image-Rich: Paints vivid mental pictures and asks learner to visualise",
    interpretationLow: "Text-Focused: Relies on logical reasoning and verbal explanation",
  },
  {
    parameterId: "BEH-LIST-STRUCTURE",
    name: "List Structure",
    definition: "How much the AI organises information into numbered lists, hierarchies, and structured formats.",
    interpretationHigh: "Structured: Frequently uses numbered lists, bullet points, and clear hierarchies",
    interpretationLow: "Flowing: Uses natural prose and connected paragraphs",
  },
  {
    parameterId: "BEH-MODALITY-CONSISTENCY",
    name: "Modality Consistency",
    definition: "Whether the AI sticks to the learner's preferred learning modality or varies approaches.",
    interpretationHigh: "Stick With What Works: Consistently uses the modality the learner responds to best",
    interpretationLow: "Mix It Up: Deliberately varies approaches even when one is working well",
  },
  {
    parameterId: "BEH-MODALITY-VARIETY",
    name: "Modality Variety",
    definition: "How many different teaching channels the AI uses based on the content being taught.",
    interpretationHigh: "Multi-Modal: Switches between visual, auditory, and kinesthetic based on content type",
    interpretationLow: "Single Channel: Relies on one primary teaching approach regardless of content",
  },
  {
    parameterId: "BEH-PRACTICE-EXERCISES",
    name: "Practice Exercises",
    definition: "How much the AI includes hands-on activities and exercises in the learning experience.",
    interpretationHigh: "Activity-Heavy: Lots of exercises, drills, and hands-on tasks",
    interpretationLow: "Discussion-Based: Learning through conversation and explanation, few exercises",
  },
  {
    parameterId: "BEH-REAL-WORLD-EXAMPLES",
    name: "Real-World Examples",
    definition: "How much the AI connects abstract concepts to practical, everyday applications.",
    interpretationHigh: "Practical: Frequently links ideas to real-life situations and applications",
    interpretationLow: "Theoretical: Stays within the academic or abstract domain",
  },
  {
    parameterId: "BEH-REPETITION-OFFER",
    name: "Repetition Offers",
    definition: "How proactively the AI offers to repeat or rephrase key points.",
    interpretationHigh: "Proactive Repeats: Offers to say things again or differently without being asked",
    interpretationLow: "On Request: Only repeats when the learner explicitly asks",
  },
  {
    parameterId: "BEH-RHYTHM-ATTENTION",
    name: "Rhythm Attention",
    definition: "How much the AI attends to the pace, cadence, and flow of spoken delivery.",
    interpretationHigh: "Rhythmic: Varies pace, uses pauses deliberately, attends to speech rhythm",
    interpretationLow: "Steady: Maintains a consistent pace without deliberate rhythmic variation",
  },
  {
    parameterId: "BEH-SPATIAL-METAPHOR",
    name: "Spatial Metaphors",
    definition: "How much the AI uses spatial organisation and location-based metaphors.",
    interpretationHigh: "Spatial: Uses 'above', 'below', 'left of', 'inside' — maps concepts to space",
    interpretationLow: "Sequential: Uses 'first', 'then', 'next' — maps concepts to time",
  },
  {
    parameterId: "BEH-TERMINOLOGY-FORMAL",
    name: "Technical Terminology",
    definition: "How much the AI uses formal, subject-specific vocabulary versus everyday language.",
    interpretationHigh: "Technical: Uses proper subject terminology and expects learner to learn it",
    interpretationLow: "Plain Language: Avoids jargon, uses everyday words to explain concepts",
  },
  {
    parameterId: "BEH-VERBAL-ELABORATION",
    name: "Verbal Elaboration",
    definition: "How richly and extensively the AI elaborates on concepts through spoken explanation.",
    interpretationHigh: "Elaborate: Extended, detailed verbal explanations with multiple angles",
    interpretationLow: "Concise: Brief, to-the-point explanations — says it once, clearly",
  },
  {
    parameterId: "BEH-WRITTEN-ALTERNATIVE",
    name: "Written Alternatives",
    definition: "How much the AI offers written references, summaries, or notes alongside spoken teaching.",
    interpretationHigh: "Text Support: Frequently offers written summaries, key points, or reference notes",
    interpretationLow: "Verbal Only: Teaches entirely through conversation without written supplements",
  },

  // ── personality-adaptation ─────────────────────────────────────────
  {
    parameterId: "BEH-DIRECTNESS",
    name: "Directness",
    definition: "How straightforward and to-the-point the AI's communication style is.",
    interpretationHigh: "Direct: Gets to the point quickly, no-nonsense, efficient communication",
    interpretationLow: "Diplomatic: Softens messages, uses hedging language, approaches topics gently",
  },
  {
    parameterId: "BEH-FORMALITY",
    name: "Formality Level",
    definition: "How formal and structured the AI's language and interaction style is.",
    interpretationHigh: "Formal: Professional, organised, uses proper grammar and structured delivery",
    interpretationLow: "Casual: Relaxed, conversational, uses colloquial language and flexible structure",
  },
  {
    parameterId: "BEH-PAUSE-TOLERANCE",
    name: "Pause Tolerance",
    definition: "How long the AI waits in silence before prompting or moving on.",
    interpretationHigh: "Patient Silences: Comfortable with long pauses, gives ample thinking time",
    interpretationLow: "Quick Fill: Fills silences quickly with prompts, hints, or new content",
  },
  {
    parameterId: "BEH-RESPONSE-LEN",
    name: "Response Length",
    definition: "How long the AI's typical responses are in a conversational exchange.",
    interpretationHigh: "Longer Turns: Extended responses with more content per exchange",
    interpretationLow: "Short Turns: Brief responses that encourage quick back-and-forth dialogue",
  },

  // ── engagement ─────────────────────────────────────────────────────
  {
    parameterId: "BEH-TURN-LENGTH",
    name: "Turn Length",
    definition: "How much content the AI delivers in each conversational turn.",
    interpretationHigh: "Extended: Longer, more content-rich turns with multiple points per exchange",
    interpretationLow: "Brief: Short, punchy turns that keep the conversation fast-paced",
  },
  {
    parameterId: "BEH-WARMTH",
    name: "Warmth",
    definition: "How warm, friendly, and welcoming the AI's tone and manner is.",
    interpretationHigh: "Warm: Friendly greetings, encouraging language, emotional warmth",
    interpretationLow: "Neutral: Professional and pleasant but emotionally reserved",
  },
];

async function main(): Promise<void> {
  console.log(`\n🔧 Enriching ${ENRICHMENTS.length} BEH-* parameters...\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const enrichment of ENRICHMENTS) {
    const existing = await prisma.parameter.findUnique({
      where: { parameterId: enrichment.parameterId },
    });

    if (!existing) {
      console.log(`  ⚠️  Not found: ${enrichment.parameterId}`);
      notFound++;
      continue;
    }

    // Skip if already has a good name (not raw ID style)
    const hasRawName = existing.name.startsWith("BEH ");
    if (!hasRawName) {
      console.log(`  ✓  Already enriched: ${enrichment.parameterId} → "${existing.name}"`);
      skipped++;
      continue;
    }

    await prisma.parameter.update({
      where: { parameterId: enrichment.parameterId },
      data: {
        name: enrichment.name,
        definition: enrichment.definition,
        interpretationHigh: enrichment.interpretationHigh,
        interpretationLow: enrichment.interpretationLow,
      },
    });

    console.log(`  ✏️  Updated: ${enrichment.parameterId} → "${enrichment.name}"`);
    updated++;
  }

  console.log(`\n✅ Done: ${updated} updated, ${skipped} already enriched, ${notFound} not found\n`);

  // Check for any remaining BEH-* params we missed
  const remaining = await prisma.parameter.findMany({
    where: {
      parameterId: { startsWith: "BEH-" },
      name: { startsWith: "BEH " },
    },
    select: { parameterId: true, name: true },
  });

  if (remaining.length > 0) {
    console.log(`⚠️  ${remaining.length} BEH-* params still have raw names:`);
    for (const p of remaining) {
      console.log(`     ${p.parameterId} → "${p.name}"`);
    }
  }
}

main()
  .catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
