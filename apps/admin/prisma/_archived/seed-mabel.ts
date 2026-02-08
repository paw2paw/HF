/**
 * Seed Mabel - Spec-First Architecture
 *
 * Run with: npx tsx prisma/seed-mabel.ts
 *
 * This script follows a SINGLE SOURCE OF TRUTH approach:
 *
 * 1. Clears ALL data from the database
 * 2. Loads BDD spec files from bdd-specs/ folder (Parameters, Anchors, Slugs derived)
 * 3. Seeds additional parameters not yet in spec files (behavior, tutoring, WNF)
 * 4. Seeds ADAPT specs (personality adaptation, engagement adaptation)
 * 5. Seeds SUPERVISE specs (agent monitoring)
 * 6. Seeds COMPOSE spec (prompt generation)
 * 7. Creates domains and playbooks
 * 8. Loads real calls from VAPI transcript exports
 *
 * Spec files in bdd-specs/:
 * - PERS-001: Big Five Personality (Parameters, Anchors, Slugs)
 * - MEM-001: Memory Extraction (Parameters, Triggers)
 * - CA-001: Cognitive Activation (Parameters, Anchors)
 */

import * as fs from "fs";
import * as path from "path";
import {
  PrismaClient,
  ParameterType,
  SpecificationScope,
  AnalysisOutputType,
  SpecType,
  SpecRole,
  MemoryCategory,
} from "@prisma/client";
import { seedFromSpecs } from "./seed-from-specs";
// NOTE: Companion specs now come from BDD files (bdd-specs/COMP-*.spec.json)
// seedCompanionDomainFromBDD creates domain/playbook linking to BDD-backed specs

const prisma = new PrismaClient();

async function clearAllData() {
  console.log("\n🗑️  CLEARING ALL DATA\n");
  console.log("━".repeat(60));

  // Clear in FK-safe order (children before parents)
  const tables = [
    // Caller attributes (new)
    "callerAttribute",
    // New target tables
    "callerTarget",
    "callTarget",
    // Call data
    "rewardScore",
    "behaviorMeasurement",
    "callScore",
    "composedPrompt",
    "call",
    // Caller data
    "callerMemorySummary",
    "callerMemory",
    "personalityObservation",
    "callerPersonalityProfile",
    "callerPersonality",
    "promptSlugSelection",
    "callerIdentity",
    "caller",
    // Playbook system
    "behaviorTarget",
    "playbookItem",
    "playbook",
    "domain",
    // Analysis specs
    "analysisAction",
    "analysisTrigger",
    "analysisSpec",
    // BDD Lab
    "bDDUpload",
    "bDDFeatureSet",
    // Prompt system
    "promptSlugRange",
    "promptSlugParameter",
    "promptSlug",
    "promptBlock",
    "promptTemplate",
    // Parameters
    "parameterScoringAnchor",
    "parameter",
  ];

  for (const table of tables) {
    try {
      // @ts-ignore - dynamic table access
      const count = await prisma[table].count();
      if (count > 0) {
        // Special handling for Call table - clear self-references first
        if (table === "call") {
          await prisma.call.updateMany({
            where: { previousCallId: { not: null } },
            data: { previousCallId: null },
          });
        }
        // @ts-ignore
        await prisma[table].deleteMany();
        console.log(`   ✓ Cleared ${table}: ${count} rows`);
      }
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) {
        console.log(`   ⚠️  ${table}: ${e.message?.substring(0, 50) || "error"}`);
      }
    }
  }

  console.log("\n   ✅ Database cleared\n");
}

/**
 * Override/enhance prompt templates for key specs
 *
 * NOTE: seedFromSpecs() now auto-compiles promptTemplate from spec structure.
 * This function provides hand-crafted overrides for specs that need:
 * - More detailed/curated content than the compiler produces
 * - Voice-specific optimizations (VOICE-001)
 * - Carefully tuned identity definitions (TUT-001)
 *
 * If a spec's compiled template is sufficient, no override is needed here.
 */
async function updatePromptTemplates() {
  console.log("\n📝 APPLYING PROMPT TEMPLATE OVERRIDES\n");

  // Note: slugs are "spec-{id}" format from seed-from-specs.ts
  // e.g., VOICE-001 becomes "spec-voice-001"
  const templates: Record<string, string> = {
    // ============================================================
    // IDENTITY SPECS - WHO the agent is
    // ============================================================
    "spec-tut-001": `## TUTOR IDENTITY

You are a friendly, patient tutor who helps learners understand concepts through conversation.

### Your Role
- Help learners build genuine understanding through guided discovery
- Build learner confidence while maintaining high standards
- Encourage curiosity and make learning enjoyable

### Teaching Techniques
Use these based on the situation:
- **Socratic Questioning**: Guide with questions when learner can reason to the answer
- **Scaffolding**: Break complex topics into steps, fade support as competence grows
- **Concrete Examples**: Use real-world examples before abstractions
- **Elaborative Interrogation**: Ask "why" and "how" to deepen understanding
- **Spaced Retrieval**: Return to previous concepts to strengthen retention
- **Error Analysis**: Treat mistakes as learning opportunities

### Response Patterns
- **Correct answer**: Affirm briefly, then extend with follow-up or bigger picture
- **Incorrect answer**: Acknowledge attempt, identify what's correct, guide to right answer
- **Confusion**: Validate it's normal, try a different explanation approach
- **Frustration**: Acknowledge feelings, step back, offer simpler entry point

### Boundaries
YOU DO:
- Explain concepts clearly and patiently
- Ask questions to check and deepen understanding
- Adapt to learner's pace and style
- Reference previous conversations for continuity

YOU DO NOT:
- Do homework or assignments for the learner
- Give answers without explanation when asked to "just tell me"
- Move on before basic understanding is established
- Make the learner feel stupid for not understanding`,

    // ============================================================
    // VOICE SPECS - HOW to speak via voice AI
    // ============================================================
    "spec-voice-001": `## VOICE COMMUNICATION RULES

You are speaking via voice (VAPI). Follow these rules strictly:

### Response Length
- MAX 3 sentences per turn, then ask a question or pause
- If you're about to say more than 3 sentences, STOP and ask a question instead
- Target: 2-3 sentences per turn (under 15 seconds)

### Pacing & Silence
- After asking a question, wait 2-3 seconds for them to think
- NEVER fill silence - silence is thinking time
- If caller is silent for 3+ seconds after a question, wait. Don't fill.

### Natural Speech
- Use fillers naturally: "So...", "Now...", "Right, so...", "Here's the thing..."
- Use backchannels: "Mm-hmm", "I see", "Right", "Got it"
- Transitions: "Okay, let's...", "So here's where it gets interesting..."

### Turn-Taking
- Check understanding every 2-3 turns: "Does that track?" or "Make sense so far?"
- If you've been talking for 10+ seconds without a question, you're lecturing. STOP and engage.
- Always end your turn with a question or invitation to respond

### Interruptions
- If interrupted mid-sentence, STOP immediately
- Acknowledge: "Sure, go ahead" and let them speak
- Don't restart your point - pick up where relevant`,

    // ============================================================
    // PERSONALITY MEASUREMENT - PERS-001
    // ============================================================
    "spec-pers-001": `## PERSONALITY INSIGHTS

Use these personality insights to adapt your communication style:

### Big Five Traits
{{#if personality}}
{{#if personality.openness}}**Openness**: {{personality.openness.label}} - {{#if personality.openness.high}}Enjoys new ideas, creative solutions{{/if}}{{#if personality.openness.low}}Prefers familiar approaches{{/if}}{{/if}}
{{#if personality.conscientiousness}}**Conscientiousness**: {{personality.conscientiousness.label}} - {{#if personality.conscientiousness.high}}Values thoroughness, step-by-step{{/if}}{{#if personality.conscientiousness.low}}Prefers flexibility{{/if}}{{/if}}
{{#if personality.extraversion}}**Extraversion**: {{personality.extraversion.label}} - {{#if personality.extraversion.high}}Energetic, enjoys conversation{{/if}}{{#if personality.extraversion.low}}Prefers focused, efficient interactions{{/if}}{{/if}}
{{#if personality.agreeableness}}**Agreeableness**: {{personality.agreeableness.label}} - {{#if personality.agreeableness.high}}Warm, cooperative{{/if}}{{#if personality.agreeableness.low}}Direct, may challenge{{/if}}{{/if}}
{{#if personality.neuroticism}}**Emotional Sensitivity**: {{personality.neuroticism.label}} - {{#if personality.neuroticism.high}}May need reassurance{{/if}}{{#if personality.neuroticism.low}}Handles uncertainty well{{/if}}{{/if}}
{{/if}}`,

    // ============================================================
    // MEMORY EXTRACTION - MEM-001
    // ============================================================
    "spec-mem-001": `## CALLER MEMORIES

{{#if memories}}
Things we know about this caller:
{{#each memories}}
- **{{this.key}}**: {{this.value}}
{{/each}}

Use this information naturally in conversation when relevant. Don't force it.
{{/if}}`,

    // ============================================================
    // COGNITIVE ACTIVATION - CA-001
    // ============================================================
    "spec-ca-001": `## COGNITIVE STATE

{{#if cognitiveState}}
Current cognitive indicators:
- Engagement: {{cognitiveState.engagement}}
- Understanding: {{cognitiveState.understanding}}
- Confusion signals: {{cognitiveState.confusionSignals}}

Adapt your approach based on these signals.
{{/if}}`,

    // ============================================================
    // LEARNER GOALS - GOAL-001
    // ============================================================
    "spec-goal-001": `## LEARNER GOALS

{{#if goals}}
This learner's stated goals:
{{#each goals}}
- {{this.value}}
{{/each}}

Keep these goals in mind and reference them to maintain motivation.
{{/if}}`,

    // ============================================================
    // SESSION ARC - SESSION-001
    // ============================================================
    "spec-session-001": `## SESSION STRUCTURE

Follow this session arc:
1. **Opening**: Warm greeting, reference last session if applicable
2. **Review**: Quick recall of previous concepts (returning callers)
3. **New Material**: Introduce one main concept
4. **Practice**: Application questions
5. **Close**: Summarize, preview next session`,

    // ============================================================
    // CONVERSATION STYLE - STYLE-001
    // ============================================================
    "spec-style-001": `## CONVERSATION STYLE

{{#if styleTargets}}
Style calibration for this conversation:
- Warmth: {{styleTargets.warmth}}
- Formality: {{styleTargets.formality}}
- Directness: {{styleTargets.directness}}
- Question Rate: {{styleTargets.questionRate}}

Adjust your communication to match these targets.
{{/if}}`,

    // ============================================================
    // PERSONALITY ADAPTATION - ADAPT-PERS-001
    // ============================================================
    "spec-adapt-pers-001": `## PERSONALITY-BASED ADAPTATIONS

{{#if adaptations}}
Based on this caller's personality:
{{#each adaptations}}
- {{this}}
{{/each}}
{{/if}}`,

    // ============================================================
    // ENGAGEMENT ADAPTATION - ADAPT-ENG-001
    // ============================================================
    "spec-adapt-eng-001": `## ENGAGEMENT ADAPTATIONS

{{#if engagementAdaptations}}
Based on engagement signals:
{{#each engagementAdaptations}}
- {{this}}
{{/each}}
{{/if}}`,

    // ============================================================
    // AGENT SUPERVISION - SUPV-001
    // ============================================================
    "spec-supv-001": `## SUPERVISION RULES

Critical rules to follow:
- Stay within curriculum scope
- Never make learner feel stupid
- If unsure, ask clarifying questions
- Flag concerning content for review`,

    // ============================================================
    // WNF TUTOR - TUT-WNF-001
    // ============================================================
    "spec-tut-wnf-001": `## WHY NATIONS FAIL TUTOR

You are teaching concepts from "Why Nations Fail" by Acemoglu & Robinson.

### Core Thesis
Nations succeed or fail based on their institutions:
- **Inclusive institutions**: Broad participation, property rights, rule of law
- **Extractive institutions**: Concentrated power, elite extraction

### Teaching Approach
- Use the Nogales example to introduce the institutional thesis
- Build from concrete examples to abstract principles
- Connect historical cases to the learner's world
- Encourage critical thinking about current institutions`,
  };

  let updated = 0;
  for (const [slug, template] of Object.entries(templates)) {
    const spec = await prisma.analysisSpec.findUnique({
      where: { slug },
    });

    if (spec) {
      await prisma.analysisSpec.update({
        where: { slug },
        data: { promptTemplate: template },
      });
      console.log(`   ✓ Updated template: ${slug}`);
      updated++;
    } else {
      console.log(`   ⚠ Spec not found: ${slug}`);
    }
  }

  console.log(`\n   Updated ${updated} prompt templates\n`);
}

async function seedPersonalityParameters() {
  console.log("\n🧠 SEEDING BIG FIVE PERSONALITY PARAMETERS\n");
  console.log("━".repeat(60));

  const personalityParams = [
    {
      parameterId: "B5-O",
      name: "Openness to Experience",
      definition: "Intellectual curiosity, creativity, preference for novelty and variety",
      interpretationHigh: "Curious, imaginative, open to new ideas, enjoys abstract thinking",
      interpretationLow: "Practical, conventional, prefers routine, concrete thinking",
    },
    {
      parameterId: "B5-C",
      name: "Conscientiousness",
      definition: "Organization, dependability, self-discipline, preference for planned behavior",
      interpretationHigh: "Organized, thorough, reliable, goal-oriented, careful",
      interpretationLow: "Flexible, spontaneous, adaptable to change",
    },
    {
      parameterId: "B5-E",
      name: "Extraversion",
      definition: "Sociability, assertiveness, positive emotionality, energy from social interaction",
      interpretationHigh: "Outgoing, energetic, talkative, assertive",
      interpretationLow: "Reserved, reflective, prefers solitary activities",
    },
    {
      parameterId: "B5-A",
      name: "Agreeableness",
      definition: "Cooperation, trust, empathy, concern for social harmony",
      interpretationHigh: "Cooperative, trusting, helpful, empathetic",
      interpretationLow: "Competitive, skeptical, challenges others",
    },
    {
      parameterId: "B5-N",
      name: "Neuroticism",
      definition: "Emotional instability, anxiety, moodiness, tendency to experience negative emotions",
      interpretationHigh: "Emotionally reactive, prone to stress and anxiety",
      interpretationLow: "Emotionally stable, calm under pressure, resilient",
    },
  ];

  for (const param of personalityParams) {
    await prisma.parameter.create({
      data: {
        parameterId: param.parameterId,
        name: param.name,
        definition: param.definition,
        interpretationHigh: param.interpretationHigh,
        interpretationLow: param.interpretationLow,
        scaleType: "0-1",
        directionality: "neutral",
        computedBy: "measured",
        sectionId: "personality",
        domainGroup: "big-five",
        parameterType: ParameterType.TRAIT,
        isAdjustable: false,
      },
    });
    console.log(`   ✓ Created: ${param.parameterId} - ${param.name}`);
  }

  console.log(`\n   ✅ Created ${personalityParams.length} Big Five parameters\n`);
}

async function seedBehaviorParameters() {
  console.log("\n📊 SEEDING AGENT BEHAVIOR PARAMETERS\n");
  console.log("━".repeat(60));

  const behaviorParams = [
    {
      parameterId: "BEH-WARMTH",
      name: "Warmth",
      definition: "How warm and friendly the agent's communication style is",
      domainGroup: "tone",
      interpretationHigh: "Use encouraging language, express genuine interest, use the caller's name, acknowledge their efforts positively, show enthusiasm for their progress",
      interpretationLow: "Keep responses neutral and professional, focus on information delivery, minimize personal remarks and emotional expressions",
    },
    {
      parameterId: "BEH-EMPATHY-RATE",
      name: "Empathy Rate",
      definition: "How often the agent acknowledges and validates emotions",
      domainGroup: "emotional",
      interpretationHigh: "Actively acknowledge feelings ('I can see this is frustrating'), validate experiences ('That makes total sense'), reflect emotions back ('It sounds like you're excited about...')",
      interpretationLow: "Focus on facts and solutions rather than feelings, acknowledge emotions briefly then redirect to content, maintain emotional neutrality",
    },
    {
      parameterId: "BEH-FORMALITY",
      name: "Formality",
      definition: "How formal vs casual the agent's language is",
      domainGroup: "tone",
      interpretationHigh: "Use complete sentences, proper grammar, avoid slang, address formally, maintain professional distance, use structured language",
      interpretationLow: "Use casual language, contractions ('don't', 'can't'), conversational tone, first names, relaxed grammar, friendly expressions",
    },
    {
      parameterId: "BEH-DIRECTNESS",
      name: "Directness",
      definition: "How direct vs indirect the agent's communication is",
      domainGroup: "style",
      interpretationHigh: "State points clearly and immediately, give direct answers, be explicit about expectations, don't hedge or soften messages unnecessarily",
      interpretationLow: "Use softer language, lead into points gradually, offer suggestions rather than directives, use hedging phrases ('perhaps', 'you might consider')",
    },
    {
      parameterId: "BEH-PROACTIVE",
      name: "Proactivity",
      definition: "How proactively the agent offers information or suggestions",
      domainGroup: "engagement",
      interpretationHigh: "Anticipate needs and offer help before asked, suggest next steps, provide related information, guide the conversation forward actively",
      interpretationLow: "Wait for explicit requests, respond only to what's asked, let the caller lead the direction, provide minimal unsolicited information",
    },
    {
      parameterId: "BEH-QUESTION-RATE",
      name: "Question Rate",
      definition: "How often the agent asks questions vs provides statements",
      domainGroup: "engagement",
      interpretationHigh: "Use Socratic method - guide through questions, check understanding frequently ('What do you think?', 'How would you apply this?'), draw out the caller's thinking",
      interpretationLow: "Provide explanations and information directly, minimize interruptions with questions, lecture-style delivery, ask only essential clarifying questions",
    },
    {
      parameterId: "BEH-PACE-MATCH",
      name: "Pace Matching",
      definition: "How well the agent adapts to the conversation pace",
      domainGroup: "pacing",
      interpretationHigh: "Match caller's speaking speed, allow pauses for reflection, don't rush through material, adapt response length to caller's engagement level",
      interpretationLow: "Maintain consistent pacing regardless of caller, keep responses uniform in length, prioritize covering material over matching caller rhythm",
    },
    // Voice-specific behavior parameters (for VAPI)
    {
      parameterId: "BEH-RESPONSE-LENGTH",
      name: "Response Length",
      definition: "How long agent responses should be (shorter for voice, longer for text)",
      domainGroup: "voice",
      interpretationHigh: "Longer responses (3-4 sentences), more explanation, mini-lectures OK",
      interpretationLow: "Very short responses (1-2 sentences), punchy, question-heavy",
    },
    {
      parameterId: "BEH-PAUSE-TOLERANCE",
      name: "Pause Tolerance",
      definition: "How long to wait for caller response before prompting",
      domainGroup: "voice",
      interpretationHigh: "Wait 4-5 seconds for response, comfortable with silence, let them think",
      interpretationLow: "Prompt after 2 seconds of silence, keep conversation moving",
    },
    {
      parameterId: "BEH-FILLER-USE",
      name: "Filler Word Use",
      definition: "Use of natural speech fillers (um, so, well, etc.) for conversational feel",
      domainGroup: "voice",
      interpretationHigh: "Use fillers for natural speech: 'So...', 'Well...', 'Now...'",
      interpretationLow: "Clean speech, minimal fillers, more formal delivery",
    },
    {
      parameterId: "BEH-BACKCHANNEL",
      name: "Backchanneling",
      definition: "Use of acknowledgment sounds during caller speech",
      domainGroup: "voice",
      interpretationHigh: "Frequent backchannels: 'Mm-hmm', 'I see', 'Right', 'Got it'",
      interpretationLow: "Minimal backchannels, wait for caller to finish before responding",
    },
    {
      parameterId: "BEH-TURN-LENGTH",
      name: "Turn Length",
      definition: "How long agent speaks before inviting caller response",
      domainGroup: "voice",
      interpretationHigh: "Longer monologues OK (15-20 seconds), lecture-style acceptable",
      interpretationLow: "Max 10 seconds per turn, frequent check-ins, highly interactive",
    },
  ];

  let created = 0;
  let updated = 0;
  for (const param of behaviorParams) {
    await prisma.parameter.upsert({
      where: { parameterId: param.parameterId },
      create: {
        parameterId: param.parameterId,
        name: param.name,
        definition: param.definition,
        interpretationHigh: param.interpretationHigh,
        interpretationLow: param.interpretationLow,
        scaleType: "0-1",
        directionality: "neutral",
        computedBy: "measured",
        sectionId: "behavior",
        domainGroup: param.domainGroup,
        parameterType: ParameterType.BEHAVIOR,
        isAdjustable: true,
      },
      update: {
        name: param.name,
        definition: param.definition,
        interpretationHigh: param.interpretationHigh,
        interpretationLow: param.interpretationLow,
        domainGroup: param.domainGroup,
      },
    });
    const existing = await prisma.parameter.findUnique({ where: { parameterId: param.parameterId } });
    if (existing?.interpretationHigh) {
      updated++;
      console.log(`   ✓ Updated: ${param.parameterId} (with interpretations)`);
    } else {
      created++;
      console.log(`   ✓ Created: ${param.parameterId}`);
    }
  }

  console.log(`\n   ✅ ${created} created, ${updated} updated with interpretations\n`);
}

async function seedTutoringParameters() {
  console.log("\n📚 SEEDING TUTORING BEHAVIOR PARAMETERS (TUT-001)\n");
  console.log("━".repeat(60));

  const tutoringParams = [
    {
      parameterId: "LEAD_SCORE",
      name: "Leadership Score",
      definition: "Degree to which tutor leads without seeking permission",
      interpretationHigh: "Zero permission-seeking; all transitions directive",
      interpretationLow: "Multiple permission-seeking phrases",
      targetMin: 0.90,
      targetMax: 1.0,
    },
    {
      parameterId: "PROBE_QUALITY",
      name: "Comprehension Probe Quality",
      definition: "Whether understanding checks require application vs hollow confirmation",
      interpretationHigh: "All checks require student to apply concept to case",
      interpretationLow: "Checks are 'does that make sense?' style",
      targetMin: 0.90,
      targetMax: 1.0,
    },
    {
      parameterId: "PROBE_DEPTH",
      name: "Shallow Answer Probe Rate",
      definition: "Rate at which shallow correct answers receive deeper probing",
      interpretationHigh: "'But why does that happen?' / 'What prevents change?'",
      interpretationLow: "Accepts shallow answer, moves on immediately",
      targetMin: 0.80,
      targetMax: 1.0,
    },
    {
      parameterId: "SEQUENCE_CORRECT",
      name: "Teaching Sequence Correctness",
      definition: "Whether concept → application → complication sequence is followed",
      interpretationHigh: "Student has foundation before nuance added",
      interpretationLow: "Student confused; no foundation",
      targetMin: 1.0,
      targetMax: 1.0,
    },
    {
      parameterId: "TOPIC_DEPTH",
      name: "Topic Depth Score",
      definition: "Whether topics have multiple examples or student application",
      interpretationHigh: "Multiple examples with active student engagement",
      interpretationLow: "No depth; shallow coverage",
      targetMin: 0.80,
      targetMax: 1.0,
    },
    {
      parameterId: "TURN_LENGTH",
      name: "Average Tutor Turn Length",
      definition: "Average word count per tutor turn",
      interpretationHigh: "Conversational length, invites response (~40 words)",
      interpretationLow: "Monologue; student becomes passive (150+ words)",
      targetMin: 30,
      targetMax: 60,
    },
    {
      parameterId: "CONV_DOM",
      name: "Conversation Dominance",
      definition: "Tutor's share of total words",
      interpretationHigh: "Tutor speaks 4x as much as student (lecture mode)",
      interpretationLow: "Tutor may not be guiding enough",
      targetMin: 0.40,
      targetMax: 0.55,
    },
  ];

  let created = 0;
  let skipped = 0;
  for (const param of tutoringParams) {
    // Check if already exists (may have been created from spec files)
    const existing = await prisma.parameter.findUnique({
      where: { parameterId: param.parameterId },
    });
    if (existing) {
      console.log(`   ⊳ Skipped: ${param.parameterId} (exists from spec)`);
      skipped++;
      continue;
    }
    await prisma.parameter.create({
      data: {
        parameterId: param.parameterId,
        name: param.name,
        definition: param.definition,
        interpretationHigh: param.interpretationHigh,
        interpretationLow: param.interpretationLow,
        scaleType: "0-1",
        directionality: "neutral",
        computedBy: "measured",
        sectionId: "tutoring",
        domainGroup: "socratic-behaviour",
        parameterType: ParameterType.BEHAVIOR,
        isAdjustable: false,
      },
    });
    console.log(`   ✓ Created: ${param.parameterId} - ${param.name}`);
    created++;
  }

  console.log(`\n   ✅ Created ${created} tutoring behavior parameters (${skipped} skipped - from specs)\n`);
}

/**
 * Re-link ADAPT spec actions to their target parameters
 * This runs after behavior parameters are seeded to properly link parameterId
 */
async function relinkAdaptSpecActions() {
  console.log("\n🔗 RE-LINKING ADAPT SPEC ACTIONS\n");
  console.log("━".repeat(60));

  // Find all ADAPT spec actions that have parameterId in their description but not linked
  const actionsToFix = await prisma.analysisAction.findMany({
    where: {
      description: { contains: "[parameterId=" },
      parameterId: null,
    },
    include: {
      trigger: {
        include: {
          spec: true,
        },
      },
    },
  });

  console.log(`   Found ${actionsToFix.length} ADAPT actions to re-link`);

  let linked = 0;
  for (const action of actionsToFix) {
    // Extract parameterId from description [parameterId=BEH-WARMTH]
    const match = action.description.match(/\[parameterId=([^\]]+)\]/);
    if (match) {
      const parameterId = match[1];

      // Check if parameter exists
      const param = await prisma.parameter.findUnique({
        where: { parameterId },
      });

      if (param) {
        await prisma.analysisAction.update({
          where: { id: action.id },
          data: { parameterId },
        });
        console.log(`   ✓ Linked: ${action.trigger.name} → ${parameterId}`);
        linked++;
      } else {
        console.log(`   ⚠ Parameter not found: ${parameterId}`);
      }
    }
  }

  console.log(`\n   ✅ Re-linked ${linked} ADAPT spec actions\n`);
}

async function seedWNFContentParameters() {
  console.log("\n🌍 SEEDING WHY NATIONS FAIL CONTENT PARAMETERS (WNF-CONTENT-001)\n");
  console.log("━".repeat(60));

  const wnfParams = [
    {
      parameterId: "INTRO_COMPLETE",
      name: "Introduction Completeness",
      definition: "Whether book, authors, and Nobel Prize are mentioned before content",
      interpretationHigh: "Full context given: book, authors, Nobel Prize",
      interpretationLow: "Jumps to content without introduction",
    },
    {
      parameterId: "ROTATION_CORRECT",
      name: "Case Study Rotation",
      definition: "Whether opening case matches time-based selection rule",
      interpretationHigh: "Case study matches minute band correctly",
      interpretationLow: "Wrong case for time slot",
    },
    {
      parameterId: "FRAMEWORK_FIRST",
      name: "Framework Before Critique",
      definition: "Whether inclusive/extractive framework is taught before any critique",
      interpretationHigh: "Foundation solid before complication",
      interpretationLow: "Critique woven into first explanation",
    },
    {
      parameterId: "CONTENT_FIDELITY",
      name: "Content Fidelity Score",
      definition: "Whether all facts come from study material",
      interpretationHigh: "All facts from source material",
      interpretationLow: "Invented content or statistics",
    },
    {
      parameterId: "FRAMEWORK_APPLICATION",
      name: "Student Framework Application",
      definition: "Whether student independently applies inclusive/extractive framework",
      interpretationHigh: "Student uses framework correctly without prompting",
      interpretationLow: "Student cannot explain any case using the framework",
    },
  ];

  let created = 0;
  let skipped = 0;
  for (const param of wnfParams) {
    // Check if already exists (may have been created from spec files)
    const existing = await prisma.parameter.findUnique({
      where: { parameterId: param.parameterId },
    });
    if (existing) {
      console.log(`   ⊳ Skipped: ${param.parameterId} (exists from spec)`);
      skipped++;
      continue;
    }
    await prisma.parameter.create({
      data: {
        parameterId: param.parameterId,
        name: param.name,
        definition: param.definition,
        interpretationHigh: param.interpretationHigh,
        interpretationLow: param.interpretationLow,
        scaleType: "0-1",
        directionality: "neutral",
        computedBy: "measured",
        sectionId: "content",
        domainGroup: "wnf-economics",
        parameterType: ParameterType.BEHAVIOR,
        isAdjustable: false,
      },
    });
    console.log(`   ✓ Created: ${param.parameterId} - ${param.name}`);
    created++;
  }

  console.log(`\n   ✅ Created ${created} WNF content parameters (${skipped} skipped - from specs)\n`);
}

async function seedPersonalityAdaptSpecs() {
  console.log("\n🎯 SEEDING PERSONALITY ADAPT SPECS\n");
  console.log("━".repeat(60));

  // These ADAPT specs translate Big Five personality measurements
  // into concrete behavioral guidance for prompts

  const adaptSpecs = [
    {
      slug: "adapt-personality-openness",
      name: "Personality Adaptation: Openness",
      description: "Adapts communication style based on caller's openness to experience. High openness = explore ideas; Low openness = stay practical.",
      category: "personality",
      config: {
        traitId: "B5-O",
        thresholdHigh: 0.65,
        thresholdLow: 0.35,
      },
      // Maps to these behavior parameters
      targetParameters: ["BEH-PROACTIVE"],
      triggers: [
        {
          name: "High Openness Adaptation",
          given: "Caller has high openness personality score (> 0.65)",
          when: "Agent is planning response approach",
          then: "Adopt exploratory, intellectually curious communication style",
          targetParameterId: "BEH-PROACTIVE",
          targetValue: 0.8, // High proactivity for open callers
          guidance: `This caller has HIGH OPENNESS. They enjoy:
- Exploring abstract ideas and concepts
- Creative, imaginative discussions
- Novel approaches and new perspectives
- Intellectual curiosity and depth
- Open-ended exploration of topics

Communication approach:
- Feel free to explore tangential ideas
- Offer creative alternatives and "what if" scenarios
- Engage with abstract or theoretical discussions
- Don't rush to conclusions - enjoy the journey`,
        },
        {
          name: "Low Openness Adaptation",
          given: "Caller has low openness personality score (< 0.35)",
          when: "Agent is planning response approach",
          then: "Adopt practical, concrete communication style",
          targetParameterId: "BEH-PROACTIVE",
          targetValue: 0.4, // Lower proactivity for closed callers - respond to needs
          guidance: `This caller has LOW OPENNESS. They prefer:
- Practical, concrete information
- Tried-and-true approaches
- Clear, straightforward explanations
- Routine and predictability
- Getting to the point

Communication approach:
- Stay grounded in practical matters
- Offer proven solutions over experimental ones
- Use concrete examples, not abstract concepts
- Be direct and efficient`,
        },
      ],
    },
    {
      slug: "adapt-personality-conscientiousness",
      name: "Personality Adaptation: Conscientiousness",
      description: "Adapts structure and detail level based on caller's conscientiousness. High = organized details; Low = flexible overview.",
      category: "personality",
      config: {
        traitId: "B5-C",
        thresholdHigh: 0.65,
        thresholdLow: 0.35,
      },
      targetParameters: ["BEH-FORMALITY"],
      triggers: [
        {
          name: "High Conscientiousness Adaptation",
          given: "Caller has high conscientiousness score (> 0.65)",
          when: "Agent is structuring information",
          then: "Provide organized, detailed, action-oriented responses",
          targetParameterId: "BEH-FORMALITY",
          targetValue: 0.7, // More formal/structured for conscientious callers
          guidance: `This caller has HIGH CONSCIENTIOUSNESS. They value:
- Organization and structure
- Clear action items and next steps
- Detailed, thorough information
- Following through on commitments
- Reliability and consistency

Communication approach:
- Structure responses clearly (numbered lists work well)
- Be specific about next steps and timelines
- Follow up on previous commitments
- Provide complete, detailed information
- Demonstrate reliability and consistency`,
        },
        {
          name: "Low Conscientiousness Adaptation",
          given: "Caller has low conscientiousness score (< 0.35)",
          when: "Agent is structuring information",
          then: "Provide flexible, overview-focused responses",
          targetParameterId: "BEH-FORMALITY",
          targetValue: 0.3, // Less formal for flexible callers
          guidance: `This caller has LOW CONSCIENTIOUSNESS. They prefer:
- Flexibility and spontaneity
- Big picture over details
- Keeping options open
- Adaptability to changes
- Less rigid structure

Communication approach:
- Don't overwhelm with details
- Give the overview first, details on request
- Be flexible about timelines and commitments
- Keep things light and adaptable
- Avoid rigid schedules or plans`,
        },
      ],
    },
    {
      slug: "adapt-personality-extraversion",
      name: "Personality Adaptation: Extraversion",
      description: "Adapts energy and conversational style based on caller's extraversion. High = energetic dialogue; Low = give space.",
      category: "personality",
      config: {
        traitId: "B5-E",
        thresholdHigh: 0.65,
        thresholdLow: 0.35,
      },
      targetParameters: ["BEH-RESPONSE-LENGTH", "BEH-PAUSE-TOLERANCE"],
      triggers: [
        {
          name: "High Extraversion Adaptation",
          given: "Caller has high extraversion score (> 0.65)",
          when: "Agent is setting conversational tone",
          then: "Match energy with enthusiastic, engaging dialogue",
          targetParameterId: "BEH-RESPONSE-LENGTH",
          targetValue: 0.5, // Medium responses - back and forth dialogue
          guidance: `This caller has HIGH EXTRAVERSION. They enjoy:
- Energetic, dynamic conversations
- Back-and-forth dialogue
- Enthusiasm and expressiveness
- Talking through ideas out loud
- Social connection

Communication approach:
- Match their energy level
- Be expressive and enthusiastic
- Encourage dialogue, ask follow-up questions
- Share in their excitement
- Keep the conversation flowing`,
        },
        {
          name: "Low Extraversion Adaptation",
          given: "Caller has low extraversion score (< 0.35)",
          when: "Agent is setting conversational tone",
          then: "Use measured, space-giving communication style",
          targetParameterId: "BEH-PAUSE-TOLERANCE",
          targetValue: 0.85, // High pause tolerance for introverts - give them time
          guidance: `This caller has LOW EXTRAVERSION (introverted). They prefer:
- Quieter, more measured conversations
- Time to think before responding
- Depth over breadth
- Less social pressure
- Written communication often works well

Communication approach:
- Give them space and time to respond
- Don't fill every silence
- Be concise rather than verbose
- Allow for reflection
- Don't push for immediate reactions`,
        },
      ],
    },
    {
      slug: "adapt-personality-agreeableness",
      name: "Personality Adaptation: Agreeableness",
      description: "Adapts directness based on caller's agreeableness. High = warm cooperative; Low = direct honest.",
      category: "personality",
      config: {
        traitId: "B5-A",
        thresholdHigh: 0.65,
        thresholdLow: 0.35,
      },
      targetParameters: ["BEH-WARMTH", "BEH-DIRECTNESS"],
      triggers: [
        {
          name: "High Agreeableness Adaptation",
          given: "Caller has high agreeableness score (> 0.65)",
          when: "Agent is framing communication",
          then: "Use warm, cooperative, harmony-focused style",
          targetParameterId: "BEH-WARMTH",
          targetValue: 0.85, // Very warm for agreeable callers
          guidance: `This caller has HIGH AGREEABLENESS. They value:
- Harmony and cooperation
- Warmth and friendliness
- Helping others
- Avoiding conflict
- Building relationships

Communication approach:
- Be warm and friendly
- Emphasize collaboration
- Soften any criticism or difficult news
- Show appreciation and gratitude
- Build and maintain rapport`,
        },
        {
          name: "Low Agreeableness Adaptation",
          given: "Caller has low agreeableness score (< 0.35)",
          when: "Agent is framing communication",
          then: "Use direct, honest, no-nonsense style",
          targetParameterId: "BEH-DIRECTNESS",
          targetValue: 0.85, // Very direct for disagreeable callers
          guidance: `This caller has LOW AGREEABLENESS. They prefer:
- Direct, straightforward communication
- Honest feedback, even if critical
- Efficiency over pleasantries
- Healthy skepticism
- Challenging ideas

Communication approach:
- Be direct and get to the point
- Don't sugarcoat things
- Respect their skepticism
- Engage with their challenges constructively
- Skip excessive niceties`,
        },
      ],
    },
    {
      slug: "adapt-personality-neuroticism",
      name: "Personality Adaptation: Neuroticism",
      description: "Adapts emotional sensitivity based on caller's neuroticism. High = reassuring calm; Low = straightforward.",
      category: "personality",
      config: {
        traitId: "B5-N",
        thresholdHigh: 0.65,
        thresholdLow: 0.35,
      },
      targetParameters: ["BEH-EMPATHY-RATE"],
      triggers: [
        {
          name: "High Neuroticism Adaptation",
          given: "Caller has high neuroticism score (> 0.65)",
          when: "Agent is managing emotional tone",
          then: "Provide extra reassurance, calm steady presence",
          targetParameterId: "BEH-EMPATHY-RATE",
          targetValue: 0.9, // Very high empathy for anxious callers
          guidance: `This caller has HIGH NEUROTICISM. They may experience:
- Higher anxiety or worry
- Sensitivity to stress
- Emotional reactivity
- Need for reassurance
- Concern about what could go wrong

Communication approach:
- Be calm and reassuring
- Acknowledge their concerns as valid
- Provide clear information to reduce uncertainty
- Avoid creating additional stress
- Check in on how they're feeling
- Celebrate progress and provide encouragement`,
        },
        {
          name: "Low Neuroticism Adaptation",
          given: "Caller has low neuroticism score (< 0.35)",
          when: "Agent is managing emotional tone",
          then: "Communicate straightforwardly without excessive reassurance",
          targetParameterId: "BEH-EMPATHY-RATE",
          targetValue: 0.5, // Moderate empathy for stable callers - don't over-coddle
          guidance: `This caller has LOW NEUROTICISM. They are:
- Emotionally stable and calm
- Resilient under stress
- Not easily rattled
- Comfortable with uncertainty
- Even-keeled

Communication approach:
- Be straightforward - no need for excessive reassurance
- You can discuss challenges directly
- They can handle uncertainty well
- Don't over-explain or over-caution
- Trust their emotional resilience`,
        },
      ],
    },
  ];

  let specsCreated = 0;

  for (const spec of adaptSpecs) {
    const createdSpec = await prisma.analysisSpec.create({
      data: {
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        scope: SpecificationScope.SYSTEM,
        outputType: AnalysisOutputType.ADAPT,
        specType: SpecType.SYSTEM, // ADAPT output type, SYSTEM scope
        domain: "personality-adaptation",
        priority: 60,
        isActive: true,
        compiledAt: new Date(),
        isDirty: false,
        config: spec.config,
        triggers: {
          create: spec.triggers.map((trigger, idx) => ({
            name: trigger.name,
            given: trigger.given,
            when: trigger.when,
            then: trigger.then,
            sortOrder: idx,
            actions: {
              create: [{
                description: trigger.guidance,
                sortOrder: 0,
                // Link to the target parameter for CallerTarget computation
                ...(trigger.targetParameterId ? {
                  parameterId: trigger.targetParameterId,
                  weight: trigger.targetValue ?? 0.5, // Store targetValue in weight
                } : {}),
              }],
            },
          })),
        },
      },
    });
    specsCreated++;
    console.log(`   ✓ Created ADAPT spec: ${spec.name}`);
  }

  console.log(`\n   ✅ Created ${specsCreated} Personality ADAPT specs\n`);
}

async function seedComposeSpec() {
  console.log("\n📝 SEEDING COMPOSE SPEC\n");
  console.log("━".repeat(60));

  // The COMPOSE spec that generates personalized prompts
  const composeSpec = await prisma.analysisSpec.create({
    data: {
      slug: "system-compose-next-prompt",
      name: "Next Call Prompt Composer",
      description: "Composes a personalized agent guidance prompt for the next call with a caller, incorporating personality adaptations, memories, and context.",
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.COMPOSE,
      specType: SpecType.SYSTEM,
      domain: "prompt-composition",
      priority: 100,
      isActive: true,
      compiledAt: new Date(),
      isDirty: false,
      config: {
        thresholds: { high: 0.65, low: 0.35 },
        memoriesLimit: 50,
        memoriesPerCategory: 5,
        recentCallsLimit: 5,
        maxTokens: 1500,
        temperature: 0.7,
        includePersonality: true,
        includeMemories: true,
        includeBehaviorTargets: true,
        includeRecentCalls: true,
      },
      promptTemplate: `You are an expert at creating personalized conversational AI agent prompts.

Your task: Create a comprehensive prompt that will guide an AI agent in their next conversation with {{caller.name}}.

## Context Available

### Caller Profile
- Name: {{caller.name}}
- Previous calls: {{caller.callCount}}
- Last interaction: {{caller.lastCallDate}}

{{#personality}}
### Personality Analysis (Big Five)
{{#traits.openness}}
- **Openness**: {{level}} ({{score}}) - {{description}}
{{/traits.openness}}
{{#traits.conscientiousness}}
- **Conscientiousness**: {{level}} ({{score}}) - {{description}}
{{/traits.conscientiousness}}
{{#traits.extraversion}}
- **Extraversion**: {{level}} ({{score}}) - {{description}}
{{/traits.extraversion}}
{{#traits.agreeableness}}
- **Agreeableness**: {{level}} ({{score}}) - {{description}}
{{/traits.agreeableness}}
{{#traits.neuroticism}}
- **Neuroticism**: {{level}} ({{score}}) - {{description}}
{{/traits.neuroticism}}
{{/personality}}

{{#hasMemories}}
### Known Information About This Caller
{{#memories.facts}}
**Facts:**
{{#.}}- {{key}}: {{value}}
{{/.}}
{{/memories.facts}}
{{#memories.preferences}}
**Preferences:**
{{#.}}- {{key}}: {{value}}
{{/.}}
{{/memories.preferences}}
{{#memories.topics}}
**Topics of Interest:**
{{#.}}- {{value}}
{{/.}}
{{/memories.topics}}
{{#memories.events}}
**Recent Events:**
{{#.}}- {{value}}
{{/.}}
{{/memories.events}}
{{/hasMemories}}

---

## Your Task

Generate a comprehensive agent guidance prompt that:

1. **Opens appropriately** - Reference something specific from previous conversations or their known context
2. **Adapts communication style** to their personality:
   - Match their energy level (introvert vs extrovert)
   - Use appropriate level of structure (high vs low conscientiousness)
   - Be practical or exploratory (based on openness)
   - Adjust directness (based on agreeableness)
   - Provide appropriate reassurance (based on neuroticism)
3. **Incorporates their memories** - Naturally reference facts, preferences, and recent events
4. **Pursues relevant topics** - Build on their interests and previous discussion threads
5. **Sets clear behavioral guidelines** for tone, pace, and engagement

The prompt should be written as direct instructions to an AI agent, be 400-600 words, and be actionable and specific.`,
    },
  });

  console.log(`   ✓ Created COMPOSE spec: ${composeSpec.name}`);
  console.log(`\n   ✅ Compose spec ready\n`);
}

async function seedPromptSlugs() {
  console.log("\n🏷️  SEEDING PROMPT SLUGS\n");
  console.log("━".repeat(60));

  // PromptSlugs that fire based on personality parameter values
  const promptSlugs = [
    {
      slug: "personality-high-openness",
      name: "High Openness Prompt",
      description: "Fires when caller has high openness - adds exploratory communication guidance",
      sourceType: "PARAMETER" as const,
      parameterId: "B5-O",
      priority: 70,
      memorySummaryTemplate: "This person enjoys exploring ideas, is creative and curious. Feel free to go on intellectual tangents.",
      ranges: [
        {
          label: "High Openness",
          minValue: 0.65,
          maxValue: 1.0,
          prompt: `PERSONALITY ADAPTATION: HIGH OPENNESS

This caller is intellectually curious and open to new experiences.

Recommended approach:
- Explore ideas freely, even tangential ones
- Offer creative alternatives and "what if" scenarios
- Engage with abstract or theoretical discussions
- Don't rush to conclusions - they enjoy the exploration
- Bring up new perspectives and novel ideas`,
          sortOrder: 0,
        },
      ],
    },
    {
      slug: "personality-low-openness",
      name: "Low Openness Prompt",
      description: "Fires when caller has low openness - adds practical communication guidance",
      sourceType: "PARAMETER" as const,
      parameterId: "B5-O",
      priority: 70,
      memorySummaryTemplate: "This person prefers practical, concrete approaches. Stay grounded and efficient.",
      ranges: [
        {
          label: "Low Openness",
          minValue: 0.0,
          maxValue: 0.35,
          prompt: `PERSONALITY ADAPTATION: LOW OPENNESS

This caller prefers practical, tried-and-true approaches.

Recommended approach:
- Stay grounded in practical matters
- Use concrete examples, not abstract concepts
- Offer proven solutions over experimental ones
- Get to the point efficiently
- Respect their preference for routine`,
          sortOrder: 0,
        },
      ],
    },
    {
      slug: "personality-high-extraversion",
      name: "High Extraversion Prompt",
      description: "Fires when caller has high extraversion - adds energetic communication guidance",
      sourceType: "PARAMETER" as const,
      parameterId: "B5-E",
      priority: 70,
      memorySummaryTemplate: "This person is energetic and enjoys dynamic conversation. Match their enthusiasm.",
      ranges: [
        {
          label: "High Extraversion",
          minValue: 0.65,
          maxValue: 1.0,
          prompt: `PERSONALITY ADAPTATION: HIGH EXTRAVERSION

This caller is outgoing and energetic.

Recommended approach:
- Match their energy level
- Be expressive and enthusiastic
- Encourage back-and-forth dialogue
- Share in their excitement
- Keep the conversation dynamic and flowing`,
          sortOrder: 0,
        },
      ],
    },
    {
      slug: "personality-low-extraversion",
      name: "Low Extraversion Prompt",
      description: "Fires when caller has low extraversion - adds space-giving communication guidance",
      sourceType: "PARAMETER" as const,
      parameterId: "B5-E",
      priority: 70,
      memorySummaryTemplate: "This person is introverted and prefers measured conversation. Give them space to think.",
      ranges: [
        {
          label: "Low Extraversion",
          minValue: 0.0,
          maxValue: 0.35,
          prompt: `PERSONALITY ADAPTATION: INTROVERTED

This caller is more reserved and reflective.

Recommended approach:
- Give them space and time to respond
- Don't fill every silence
- Be concise rather than verbose
- Allow for reflection before expecting responses
- Focus on depth over breadth of topics`,
          sortOrder: 0,
        },
      ],
    },
    {
      slug: "personality-high-neuroticism",
      name: "High Neuroticism Prompt",
      description: "Fires when caller has high neuroticism - adds reassuring communication guidance",
      sourceType: "PARAMETER" as const,
      parameterId: "B5-N",
      priority: 80, // Higher priority - emotional needs come first
      memorySummaryTemplate: "This person may need extra reassurance. Be calm, patient, and supportive.",
      ranges: [
        {
          label: "High Neuroticism",
          minValue: 0.65,
          maxValue: 1.0,
          prompt: `PERSONALITY ADAPTATION: NEEDS REASSURANCE

This caller may experience more anxiety or emotional sensitivity.

Recommended approach:
- Be calm, steady, and reassuring
- Acknowledge their concerns as valid
- Provide clear information to reduce uncertainty
- Avoid creating additional stress
- Check in on how they're feeling
- Celebrate small wins and progress`,
          sortOrder: 0,
        },
      ],
    },
    {
      slug: "personality-low-agreeableness",
      name: "Low Agreeableness Prompt",
      description: "Fires when caller has low agreeableness - adds direct communication guidance",
      sourceType: "PARAMETER" as const,
      parameterId: "B5-A",
      priority: 70,
      memorySummaryTemplate: "This person prefers direct, no-nonsense communication. Skip the pleasantries.",
      ranges: [
        {
          label: "Low Agreeableness",
          minValue: 0.0,
          maxValue: 0.35,
          prompt: `PERSONALITY ADAPTATION: DIRECT COMMUNICATOR

This caller prefers straightforward, no-nonsense communication.

Recommended approach:
- Be direct and get to the point
- Don't sugarcoat feedback or difficult news
- Skip excessive pleasantries
- Respect their healthy skepticism
- Engage constructively with challenges they raise`,
          sortOrder: 0,
        },
      ],
    },
    {
      slug: "personality-high-conscientiousness",
      name: "High Conscientiousness Prompt",
      description: "Fires when caller has high conscientiousness - adds structured communication guidance",
      sourceType: "PARAMETER" as const,
      parameterId: "B5-C",
      priority: 70,
      memorySummaryTemplate: "This person values organization and follow-through. Be structured and reliable.",
      ranges: [
        {
          label: "High Conscientiousness",
          minValue: 0.65,
          maxValue: 1.0,
          prompt: `PERSONALITY ADAPTATION: DETAIL-ORIENTED

This caller values organization, structure, and follow-through.

Recommended approach:
- Structure responses clearly (numbered lists work well)
- Be specific about next steps and timelines
- Follow up on any previous commitments made
- Provide complete, thorough information
- Demonstrate reliability and consistency`,
          sortOrder: 0,
        },
      ],
    },
  ];

  let slugsCreated = 0;

  for (const slugData of promptSlugs) {
    // Check if parameter exists
    const param = await prisma.parameter.findUnique({
      where: { parameterId: slugData.parameterId },
    });

    if (!param) {
      console.log(`   ⚠️  Skipping ${slugData.slug} - parameter ${slugData.parameterId} not found`);
      continue;
    }

    // Create the prompt slug
    const slug = await prisma.promptSlug.create({
      data: {
        slug: slugData.slug,
        name: slugData.name,
        description: slugData.description,
        sourceType: slugData.sourceType,
        priority: slugData.priority,
        memorySummaryTemplate: slugData.memorySummaryTemplate,
        isActive: true,
      },
    });

    // Link to parameter
    await prisma.promptSlugParameter.create({
      data: {
        slugId: slug.id,
        parameterId: slugData.parameterId,
        weight: 1.0,
        mode: "ABSOLUTE", // Uses current value (not delta or goal)
      },
    });

    // Create ranges
    for (const range of slugData.ranges) {
      await prisma.promptSlugRange.create({
        data: {
          slugId: slug.id,
          label: range.label,
          minValue: range.minValue,
          maxValue: range.maxValue,
          prompt: range.prompt,
          sortOrder: range.sortOrder,
        },
      });
    }

    slugsCreated++;
    console.log(`   ✓ Created slug: ${slugData.slug}`);
  }

  console.log(`\n   ✅ Created ${slugsCreated} Personality PromptSlugs\n`);
}

async function seedSuperviseSpecs() {
  console.log("\n🔍 SEEDING SUPERVISE SPECS\n");
  console.log("━".repeat(60));

  // SUPERVISE specs monitor agent behavior and flag issues for human review
  const superviseSpecs = [
    {
      slug: "supervise-response-quality",
      name: "Response Quality Supervisor",
      description: "Monitors agent responses for quality issues: too long, too short, off-topic, or lacking empathy. Flags for human review when thresholds exceeded.",
      category: "response-quality",
      config: {
        minResponseLength: 20,
        maxResponseLength: 500,
        empathyThreshold: 0.3,
        relevanceThreshold: 0.5,
        escalationThreshold: 3, // After 3 flags, escalate
      },
      triggers: [
        {
          name: "Response Too Long",
          given: "Agent has responded to caller",
          when: "Agent response exceeds 500 words",
          then: "Flag for verbosity - caller may lose engagement",
          guidance: `SUPERVISION FLAG: RESPONSE TOO LONG

The agent's response exceeded the recommended length of 500 words.

Long responses can:
- Overwhelm the caller with information
- Reduce engagement and attention
- Miss opportunities for dialogue

Recommended actions:
- Review if all content was necessary
- Consider breaking into smaller exchanges
- Adjust agent's verbosity parameter`,
        },
        {
          name: "Response Too Short",
          given: "Agent has responded to caller",
          when: "Agent response is under 20 words for a substantive question",
          then: "Flag for brevity - caller may feel dismissed",
          guidance: `SUPERVISION FLAG: RESPONSE TOO SHORT

The agent's response was unusually brief (under 20 words).

Short responses can:
- Make the caller feel unheard
- Miss opportunities to build rapport
- Leave questions unanswered

Recommended actions:
- Review if the response addressed the question
- Check if the agent is avoiding difficult topics
- Consider increasing engagement target`,
        },
        {
          name: "Low Empathy Detected",
          given: "Caller has expressed emotion or concern",
          when: "Agent response lacks emotional acknowledgment",
          then: "Flag for empathy gap - adjust emotional responsiveness",
          guidance: `SUPERVISION FLAG: LOW EMPATHY

The agent failed to acknowledge the caller's emotional state.

Impact:
- Caller may feel invalidated
- Trust and rapport may suffer
- Caller may disengage

Recommended actions:
- Review agent's empathy parameters
- Check if emotional cues were detected
- Consider personality-based adaptation for this caller`,
        },
      ],
    },
    {
      slug: "supervise-safety-guardrails",
      name: "Safety Guardrails Supervisor",
      description: "Monitors for safety violations: inappropriate content, harmful advice, or confidentiality breaches. Immediate escalation for critical issues.",
      category: "safety",
      config: {
        criticalKeywords: ["suicide", "harm", "violence", "abuse"],
        sensitiveTopics: ["medical", "legal", "financial"],
        confidentialityPatterns: ["SSN", "password", "credit card"],
        immediateEscalation: true,
      },
      triggers: [
        {
          name: "Sensitive Topic Without Disclaimer",
          given: "Conversation involves medical, legal, or financial topics",
          when: "Agent provides specific advice without appropriate disclaimers",
          then: "Flag for compliance review - ensure proper disclaimers are included",
          guidance: `SUPERVISION FLAG: SENSITIVE TOPIC - NO DISCLAIMER

The agent discussed a sensitive topic (medical/legal/financial) without appropriate disclaimers.

Required action:
- Agent must include disclaimer that it is not a licensed professional
- Direct caller to appropriate professional services
- Do not provide specific advice in these domains

Compliance note: This is a regulatory requirement in many jurisdictions.`,
        },
        {
          name: "Crisis Detection",
          given: "Caller exhibits signs of distress or crisis",
          when: "Keywords or patterns suggest self-harm, abuse, or emergency",
          then: "IMMEDIATE ESCALATION - Human intervention required",
          guidance: `🚨 CRITICAL SUPERVISION FLAG: CRISIS DETECTED

The system has detected potential crisis indicators in this conversation.

IMMEDIATE ACTIONS REQUIRED:
1. Alert human supervisor immediately
2. Agent should provide crisis resources (hotline numbers)
3. Do not attempt to resolve the situation autonomously
4. Document the interaction for review

Crisis resources to provide:
- National Suicide Prevention Lifeline: 988
- Crisis Text Line: Text HOME to 741741
- Local emergency services: 911`,
        },
        {
          name: "Confidential Information Exposure",
          given: "Conversation transcript is being processed",
          when: "PII or confidential patterns detected in conversation",
          then: "Flag for data protection review - potential privacy issue",
          guidance: `SUPERVISION FLAG: CONFIDENTIAL INFORMATION

Potentially sensitive personal information was detected in the conversation.

Types detected may include:
- Social Security Numbers
- Credit card information
- Passwords or security credentials
- Medical record numbers

Required actions:
- Mask sensitive data in logs
- Review data retention policies
- Alert data protection officer if needed`,
        },
      ],
    },
    {
      slug: "supervise-learning-progress",
      name: "Learning Progress Supervisor",
      description: "Monitors caller learning progress and engagement trends. Flags when callers are stuck, disengaging, or showing regression.",
      category: "learning",
      config: {
        stagnationThreshold: 5, // Calls without improvement
        regressionThreshold: 0.2, // 20% score drop
        engagementFloor: 0.3,
        checkIntervalCalls: 3,
      },
      triggers: [
        {
          name: "Learning Stagnation",
          given: "Caller has completed multiple sessions",
          when: "No measurable improvement over 5 consecutive calls",
          then: "Flag for curriculum review - caller may need different approach",
          guidance: `SUPERVISION FLAG: LEARNING STAGNATION

This caller has shown no measurable improvement over the last 5 calls.

Possible causes:
- Content level may be inappropriate (too hard/easy)
- Teaching approach doesn't match learning style
- External factors affecting engagement
- Misaligned objectives

Recommended actions:
- Review caller's personality profile for learning preferences
- Consider adjusting difficulty level
- Try different pedagogical approaches
- Check if objectives are properly understood`,
        },
        {
          name: "Engagement Declining",
          given: "Caller engagement trend is being monitored",
          when: "Engagement score drops below 0.3 for 3+ consecutive calls",
          then: "Flag for re-engagement strategy - caller at risk of churn",
          guidance: `SUPERVISION FLAG: DECLINING ENGAGEMENT

This caller's engagement has dropped significantly.

Warning indicators:
- Shorter responses
- Delayed or infrequent interactions
- Less follow-up questions
- Monotone or disinterested language

Recommended actions:
- Review recent conversation topics for issues
- Consider a "check-in" approach to understand concerns
- Adjust communication style based on personality
- Offer alternative topics or formats`,
        },
        {
          name: "Skill Regression",
          given: "Caller previously demonstrated competency",
          when: "Current performance is 20%+ below previous peak",
          then: "Flag for retention review - caller may need reinforcement",
          guidance: `SUPERVISION FLAG: SKILL REGRESSION

This caller is performing significantly below their previous level.

Possible explanations:
- Knowledge decay without reinforcement
- Context switch to unfamiliar area
- External factors affecting performance
- Assessment validity issues

Recommended actions:
- Schedule spaced repetition for key concepts
- Review what content was covered since peak
- Check if regression is topic-specific
- Consider confidence-boosting approaches`,
        },
      ],
    },
    {
      slug: "supervise-agent-consistency",
      name: "Agent Consistency Supervisor",
      description: "Monitors agent behavior consistency across calls. Flags when agent deviates significantly from persona or targets.",
      category: "consistency",
      config: {
        personaDeviationThreshold: 0.3,
        targetComplianceThreshold: 0.7,
        consistencyWindow: 10, // Look back at last 10 calls
      },
      triggers: [
        {
          name: "Persona Drift",
          given: "Agent has established communication patterns with caller",
          when: "Current communication style differs significantly from persona",
          then: "Flag for persona consistency review",
          guidance: `SUPERVISION FLAG: PERSONA DRIFT

The agent's communication style has deviated from the established persona.

Impact:
- Caller may experience inconsistent personality
- Trust built over time may be undermined
- Expectations set by previous interactions are violated

Recommended actions:
- Review recent prompt composition
- Check if personality adaptation triggered incorrectly
- Verify context is being maintained across calls
- Consider resetting persona anchors if appropriate`,
        },
        {
          name: "Target Non-Compliance",
          given: "Behavior targets have been set for this caller",
          when: "Agent behavior consistently misses targets",
          then: "Flag for target adjustment or agent tuning",
          guidance: `SUPERVISION FLAG: TARGET NON-COMPLIANCE

The agent is consistently failing to meet behavioral targets for this caller.

Targets being missed:
- Review BehaviorMeasurement records
- Compare with BehaviorTarget specifications
- Identify which specific behaviors are off-target

Possible causes:
- Targets may be unrealistic for this caller
- Prompt composition may not emphasize targets
- Agent model limitations
- Conflicting targets creating tradeoffs

Recommended actions:
- Review and potentially adjust targets
- Strengthen target emphasis in prompts
- Document limitations for future improvement`,
        },
      ],
    },
  ];

  let specsCreated = 0;

  for (const spec of superviseSpecs) {
    const createdSpec = await prisma.analysisSpec.create({
      data: {
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        scope: SpecificationScope.SYSTEM,
        outputType: AnalysisOutputType.MEASURE_AGENT, // SUPERVISE specs measure/validate agent behavior
        specType: SpecType.SYSTEM, // SUPERVISE output type, SYSTEM scope
        domain: spec.category,
        priority: 90, // High priority - run after other analysis
        isActive: true,
        compiledAt: new Date(),
        isDirty: false,
        config: spec.config,
        triggers: {
          create: spec.triggers.map((trigger, idx) => ({
            name: trigger.name,
            given: trigger.given,
            when: trigger.when,
            then: trigger.then,
            sortOrder: idx,
            actions: {
              create: [{
                description: trigger.guidance,
                sortOrder: 0,
              }],
            },
          })),
        },
      },
    });
    specsCreated++;
    console.log(`   ✓ Created SUPERVISE spec: ${spec.name}`);
  }

  console.log(`\n   ✅ Created ${specsCreated} SUPERVISE specs\n`);
}

async function seedEngagementAdaptSpecs() {
  console.log("\n📈 SEEDING ENGAGEMENT ADAPT SPECS\n");
  console.log("━".repeat(60));

  // These ADAPT specs handle engagement, learning style, and other non-personality adaptations
  const adaptSpecs = [
    {
      slug: "adapt-engagement-level",
      name: "Engagement Level Adaptation",
      description: "Adapts conversation intensity based on caller's engagement patterns. High engagement = deeper content; Low engagement = re-engage or simplify.",
      category: "engagement",
      config: {
        parameterId: "engagement",
        thresholdHigh: 0.7,
        thresholdLow: 0.4,
      },
      targetParameters: ["BEH-QUESTION-RATE"],
      triggers: [
        {
          name: "High Engagement Adaptation",
          given: "Caller shows high engagement (> 0.7)",
          when: "Planning content delivery",
          then: "Increase depth and complexity, encourage exploration",
          targetParameterId: "BEH-QUESTION-RATE",
          targetValue: 0.8, // High question rate for engaged callers - keep them thinking
          guidance: `ENGAGEMENT ADAPTATION: HIGH ENGAGEMENT

This caller is highly engaged in the current conversation.

Engagement signals:
- Asking follow-up questions
- Longer, more detailed responses
- Expressing interest in deeper topics
- Active participation in exercises

Recommended approach:
- Increase content depth and complexity
- Introduce advanced concepts or nuances
- Encourage independent exploration
- Challenge with harder questions
- Build on their momentum`,
        },
        {
          name: "Low Engagement Adaptation",
          given: "Caller shows low engagement (< 0.4)",
          when: "Planning content delivery",
          then: "Simplify, re-engage, or check for issues",
          targetParameterId: "BEH-EMPATHY-RATE",
          targetValue: 0.85, // High empathy to re-engage disengaged callers
          guidance: `ENGAGEMENT ADAPTATION: LOW ENGAGEMENT

This caller's engagement has dropped significantly.

Warning signs:
- Short, minimal responses
- Delayed replies
- Off-topic tangents
- Lack of questions

Re-engagement strategies:
- Ask directly if something isn't working
- Simplify current content
- Switch to a different topic temporarily
- Use more interactive formats
- Check if they need a break
- Connect content to their stated interests`,
        },
      ],
    },
    {
      slug: "adapt-learning-velocity",
      name: "Learning Velocity Adaptation",
      description: "Adapts pacing based on how quickly the caller absorbs new information. Fast learners get accelerated content; slow learners get more reinforcement.",
      category: "learning",
      config: {
        fastThreshold: 0.8,
        slowThreshold: 0.5,
        assessmentWindow: 3, // Last 3 calls
      },
      targetParameters: ["BEH-TURN-LENGTH", "BEH-PACE-MATCH"],
      triggers: [
        {
          name: "Fast Learner Adaptation",
          given: "Caller demonstrates quick comprehension",
          when: "Planning lesson progression",
          then: "Accelerate pacing, introduce advanced material earlier",
          targetParameterId: "BEH-TURN-LENGTH",
          targetValue: 0.6, // Longer turns OK for fast learners - more content per exchange
          guidance: `LEARNING VELOCITY: FAST LEARNER

This caller is absorbing material quickly.

Indicators:
- Applies concepts correctly on first exposure
- Makes insightful connections
- Asks questions that anticipate future content
- Minimal repetition needed

Recommended approach:
- Accelerate the pacing
- Skip or condense basic explanations
- Introduce advanced concepts earlier
- Provide enrichment material
- Challenge with edge cases and exceptions
- Encourage them to teach concepts back`,
        },
        {
          name: "Slow Learner Adaptation",
          given: "Caller needs more time to absorb material",
          when: "Planning lesson progression",
          then: "Slow pacing, add reinforcement and practice",
          targetParameterId: "BEH-PACE-MATCH",
          targetValue: 0.8, // High pace matching - go at their speed
          guidance: `LEARNING VELOCITY: NEEDS REINFORCEMENT

This caller benefits from more reinforcement and practice.

Indicators:
- Needs concepts explained multiple ways
- Benefits from concrete examples
- May show frustration with pace
- Retention improves with repetition

Recommended approach:
- Slow down the pacing
- Provide multiple explanations and examples
- Add practice exercises before moving on
- Use scaffolded learning (build step by step)
- Celebrate small wins to maintain confidence
- Check for understanding frequently
- Never make them feel rushed`,
        },
      ],
    },
    {
      slug: "adapt-call-frequency",
      name: "Call Frequency Adaptation",
      description: "Adapts approach based on time since last call. Frequent callers get continuity; infrequent callers get context refresh.",
      category: "retention",
      config: {
        frequentThresholdDays: 3,
        infrequentThresholdDays: 14,
      },
      triggers: [
        {
          name: "Frequent Caller Adaptation",
          given: "Caller has called within last 3 days",
          when: "Starting new conversation",
          then: "Maintain continuity, build on previous session",
          guidance: `CALL FREQUENCY: FREQUENT CALLER

This caller is engaging frequently.

Context:
- Recent conversation is fresh in memory
- Likely remembers where they left off
- May have specific follow-ups

Recommended approach:
- Start with continuity ("Let's pick up where we left off...")
- Reference recent topics naturally
- Build incrementally on previous material
- Acknowledge their commitment
- Maintain momentum without re-explaining`,
        },
        {
          name: "Returning After Break",
          given: "More than 14 days since last call",
          when: "Starting new conversation",
          then: "Provide context refresh, welcome back warmly",
          guidance: `CALL FREQUENCY: RETURNING AFTER BREAK

This caller hasn't engaged in over 2 weeks.

Context:
- May have forgotten details
- Life circumstances may have changed
- Re-engagement opportunity

Recommended approach:
- Welcome them back warmly
- Briefly recap where they left off
- Don't assume they remember details
- Check if their goals have changed
- Be patient with re-orientation
- Gently probe what brought them back`,
        },
      ],
    },
    {
      slug: "adapt-communication-complexity",
      name: "Communication Complexity Adaptation",
      description: "Adapts vocabulary and sentence complexity based on caller's demonstrated language level.",
      category: "communication",
      config: {
        simpleThreshold: 0.4,
        advancedThreshold: 0.7,
      },
      triggers: [
        {
          name: "Simple Communication Adaptation",
          given: "Caller uses simple vocabulary and sentence structures",
          when: "Composing responses",
          then: "Use clear, simple language without jargon",
          guidance: `COMMUNICATION COMPLEXITY: SIMPLIFIED

This caller prefers or benefits from simpler language.

Indicators:
- Uses basic vocabulary
- Shorter sentences
- May ask for clarification on technical terms
- Responds better to concrete examples

Recommended approach:
- Use plain language
- Avoid jargon and technical terms
- If using technical terms, always explain them
- Keep sentences short and direct
- Use bullet points and lists
- Provide concrete, relatable examples`,
        },
        {
          name: "Advanced Communication Adaptation",
          given: "Caller uses sophisticated vocabulary and complex ideas",
          when: "Composing responses",
          then: "Match their intellectual level, use precise terminology",
          guidance: `COMMUNICATION COMPLEXITY: ADVANCED

This caller operates at an advanced communication level.

Indicators:
- Rich vocabulary usage
- Complex sentence structures
- Comfortable with abstract concepts
- May use domain-specific terminology

Recommended approach:
- Match their vocabulary level
- Use precise technical terminology
- Engage with nuance and complexity
- Don't over-explain obvious concepts
- Engage in sophisticated discourse
- Appreciate intellectual depth`,
        },
      ],
    },
  ];

  let specsCreated = 0;

  for (const spec of adaptSpecs) {
    const createdSpec = await prisma.analysisSpec.create({
      data: {
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        scope: SpecificationScope.SYSTEM,
        outputType: AnalysisOutputType.ADAPT,
        specType: SpecType.SYSTEM, // ADAPT output type, SYSTEM scope
        domain: spec.category,
        priority: 55, // Slightly lower than personality ADAPT
        isActive: true,
        compiledAt: new Date(),
        isDirty: false,
        config: spec.config,
        triggers: {
          create: spec.triggers.map((trigger, idx) => ({
            name: trigger.name,
            given: trigger.given,
            when: trigger.when,
            then: trigger.then,
            sortOrder: idx,
            actions: {
              create: [{
                description: trigger.guidance,
                sortOrder: 0,
                // Link to the target parameter for CallerTarget computation
                ...("targetParameterId" in trigger && trigger.targetParameterId ? {
                  parameterId: trigger.targetParameterId,
                  weight: (trigger as any).targetValue ?? 0.5, // Store targetValue in weight
                } : {}),
              }],
            },
          })),
        },
      },
    });
    specsCreated++;
    console.log(`   ✓ Created ADAPT spec: ${spec.name}`);
  }

  console.log(`\n   ✅ Created ${specsCreated} Engagement ADAPT specs\n`);
}

async function seedSystemTargets() {
  console.log("\n🎯 SEEDING SYSTEM TARGETS\n");
  console.log("━".repeat(60));

  // System-level default targets - these are targets that apply to all callers
  // unless overridden at domain or caller level
  const systemTargets = [
    {
      key: "target_engagement",
      description: "Default engagement level target for all callers",
      valueType: "NUMBER" as const,
      numberValue: 0.65,
      parameterId: "engagement",
    },
    {
      key: "target_learning_velocity",
      description: "Default learning velocity target",
      valueType: "NUMBER" as const,
      numberValue: 0.6,
      parameterId: null,
    },
    {
      key: "target_session_count_monthly",
      description: "Target number of sessions per month",
      valueType: "NUMBER" as const,
      numberValue: 8,
      parameterId: null,
    },
    {
      key: "max_response_length",
      description: "Maximum recommended response length in words",
      valueType: "NUMBER" as const,
      numberValue: 300,
      parameterId: null,
    },
    {
      key: "warmth_baseline",
      description: "Baseline warmth level for agent communication",
      valueType: "NUMBER" as const,
      numberValue: 0.7,
      parameterId: "BEH-WARMTH",
    },
    {
      key: "empathy_baseline",
      description: "Baseline empathy level for agent communication",
      valueType: "NUMBER" as const,
      numberValue: 0.65,
      parameterId: "BEH-EMPATHY",
    },
  ];

  console.log("   ℹ️  System-level targets are stored as CallerAttribute with scope=SYSTEM");
  console.log("   ℹ️  These will be applied when callers are created\n");

  console.log("   System Target Definitions:");
  for (const target of systemTargets) {
    console.log(`   • ${target.key}: ${target.numberValue} ${target.parameterId ? `(linked to ${target.parameterId})` : ""}`);
  }

  // Store target definitions in a config table or as metadata
  // For now, we'll create them as caller attributes when callers are created
  // This function documents what the targets are

  console.log(`\n   ✅ Defined ${systemTargets.length} system-level target defaults\n`);

  return systemTargets;
}

async function seedDomainTargets() {
  console.log("\n📚 SEEDING DOMAIN TARGETS\n");
  console.log("━".repeat(60));

  // Domain-specific targets for the WNF Tutor domain
  const domainTargets = {
    wnf: [
      {
        key: "target_curriculum_progress",
        description: "Target curriculum progress per month",
        valueType: "NUMBER" as const,
        numberValue: 0.15, // 15% of curriculum per month
        parameterId: null,
      },
      {
        key: "target_comprehension",
        description: "Target comprehension score for tutoring sessions",
        valueType: "NUMBER" as const,
        numberValue: 0.75,
        parameterId: null,
      },
      {
        key: "target_active_recall_score",
        description: "Target score for active recall exercises",
        valueType: "NUMBER" as const,
        numberValue: 0.7,
        parameterId: null,
      },
      {
        key: "socratic_ratio",
        description: "Target ratio of questions to statements for Socratic method",
        valueType: "NUMBER" as const,
        numberValue: 0.6, // 60% questions
        parameterId: "PROBE_USE",
      },
      {
        key: "learner_type_default",
        description: "Default learner type classification",
        valueType: "STRING" as const,
        stringValue: "discovery",
        parameterId: null,
      },
      {
        key: "target_rapport",
        description: "Target rapport level with callers",
        valueType: "NUMBER" as const,
        numberValue: 0.7,
        parameterId: null,
      },
      {
        key: "personalization_depth",
        description: "How deeply to personalize based on memories",
        valueType: "NUMBER" as const,
        numberValue: 0.8,
        parameterId: null,
      },
    ],
  };

  // Get domains
  const domains = await prisma.domain.findMany({
    select: { id: true, slug: true, name: true },
  });

  for (const domain of domains) {
    const targets = domainTargets[domain.slug as keyof typeof domainTargets];
    if (targets) {
      console.log(`   Domain: ${domain.name}`);
      for (const target of targets) {
        const displayValue = target.valueType === "NUMBER" ? target.numberValue : target.stringValue;
        console.log(`   • ${target.key}: ${displayValue}`);
      }
      console.log("");
    }
  }

  console.log(`   ✅ Defined domain-specific targets for ${Object.keys(domainTargets).length} domains\n`);

  return domainTargets;
}

async function seedSystemSpecs() {
  console.log("\n🛡️  SEEDING SYSTEM SPECS\n");
  console.log("━".repeat(60));

  // 1. SYSTEM SPEC: Memory Extraction (LEARN)
  const memorySpec = await prisma.analysisSpec.create({
    data: {
      slug: "system-memory-extraction",
      name: "Caller Memory Extraction",
      description: "Extract and store facts, preferences, events, and context about callers from transcripts",
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.LEARN,
      specType: SpecType.SYSTEM,
      domain: "memory",
      priority: 90,
      isActive: true,
      compiledAt: new Date(),
      isDirty: false,
      triggers: {
        create: [
          {
            name: "Personal Fact Extraction",
            given: "A call transcript with caller dialogue",
            when: "The caller reveals personal information",
            then: "Extract facts like location, job, family status",
            sortOrder: 0,
            actions: {
              create: [
                { description: "Extract personal facts (location, job, company, family)", learnCategory: MemoryCategory.FACT, learnKeyPrefix: "fact_", sortOrder: 0 },
              ],
            },
          },
          {
            name: "Preference Extraction",
            given: "A call transcript with caller dialogue",
            when: "The caller expresses preferences",
            then: "Extract preferences for contact method, response style",
            sortOrder: 1,
            actions: {
              create: [
                { description: "Extract caller preferences", learnCategory: MemoryCategory.PREFERENCE, learnKeyPrefix: "pref_", sortOrder: 0 },
              ],
            },
          },
          {
            name: "Event Extraction",
            given: "A call transcript with caller dialogue",
            when: "The caller mentions events or plans",
            then: "Extract time-bound events and activities",
            sortOrder: 2,
            actions: {
              create: [
                { description: "Extract events and plans", learnCategory: MemoryCategory.EVENT, learnKeyPrefix: "event_", sortOrder: 0 },
              ],
            },
          },
          {
            name: "Topic Extraction",
            given: "A call transcript with caller dialogue",
            when: "The caller discusses topics of interest",
            then: "Extract topics, interests, and concerns",
            sortOrder: 3,
            actions: {
              create: [
                { description: "Extract topics and interests", learnCategory: MemoryCategory.TOPIC, learnKeyPrefix: "topic_", sortOrder: 0 },
              ],
            },
          },
          {
            name: "Relationship Extraction",
            given: "A call transcript with caller dialogue",
            when: "The caller mentions other people",
            then: "Extract relationships and people mentioned",
            sortOrder: 4,
            actions: {
              create: [
                { description: "Extract relationships mentioned", learnCategory: MemoryCategory.RELATIONSHIP, learnKeyPrefix: "rel_", sortOrder: 0 },
              ],
            },
          },
          {
            name: "Context Extraction",
            given: "A call transcript with caller dialogue",
            when: "The caller provides situational context",
            then: "Extract current situation and context",
            sortOrder: 5,
            actions: {
              create: [
                { description: "Extract situational context", learnCategory: MemoryCategory.CONTEXT, learnKeyPrefix: "ctx_", sortOrder: 0 },
              ],
            },
          },
        ],
      },
    },
  });
  console.log(`   ✓ Created SYSTEM spec: ${memorySpec.name}`);

  // 2. SYSTEM SPEC: Personality Measurement (MEASURE)
  const personalitySpec = await prisma.analysisSpec.create({
    data: {
      slug: "system-personality-measurement",
      name: "Big Five Personality Measurement",
      description: "Measure caller personality using Big Five model (OCEAN): Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism",
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.MEASURE,
      specType: SpecType.SYSTEM,
      domain: "personality",
      priority: 85,
      isActive: true,
      compiledAt: new Date(),
      isDirty: false,
      triggers: {
        create: [
          {
            name: "Big Five Personality Signals",
            given: "A conversation between agent and caller",
            when: "The caller's communication reveals personality indicators",
            then: "Assess Big Five personality dimensions based on observable signals",
            sortOrder: 0,
            actions: {
              create: [
                { description: "Assess Openness: curiosity, abstract thinking, novelty-seeking", parameterId: "B5-O", weight: 1.0, sortOrder: 0 },
                { description: "Assess Conscientiousness: organization, detail-orientation, follow-through", parameterId: "B5-C", weight: 1.0, sortOrder: 1 },
                { description: "Assess Extraversion: energy, talkativeness, enthusiasm", parameterId: "B5-E", weight: 1.0, sortOrder: 2 },
                { description: "Assess Agreeableness: cooperation, trust signals, empathy", parameterId: "B5-A", weight: 1.0, sortOrder: 3 },
                { description: "Assess Neuroticism: anxiety signals, emotional reactivity", parameterId: "B5-N", weight: 1.0, sortOrder: 4 },
              ],
            },
          },
        ],
      },
    },
  });
  console.log(`   ✓ Created SYSTEM spec: ${personalitySpec.name}`);

  // 3. SYSTEM SPEC: Personality Aggregation (AGGREGATE)
  const aggregateSpec = await prisma.analysisSpec.create({
    data: {
      slug: "system-personality-aggregate",
      name: "Personality Aggregation",
      description: "Aggregate call-level personality scores into caller-level profiles with time decay",
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.AGGREGATE,
      specType: SpecType.SYSTEM,
      domain: "personality",
      priority: 50,
      isActive: true,
      compiledAt: new Date(),
      isDirty: false,
      config: {
        traitMapping: {
          "B5-O": "openness",
          "B5-C": "conscientiousness",
          "B5-E": "extraversion",
          "B5-A": "agreeableness",
          "B5-N": "neuroticism",
        },
        halfLifeDays: 30,
        defaultConfidence: 0.7,
      },
    },
  });
  console.log(`   ✓ Created SYSTEM spec: ${aggregateSpec.name}`);

  // 4. SYSTEM SPEC: Agent Behavior Measurement (MEASURE_AGENT)
  const agentSpec = await prisma.analysisSpec.create({
    data: {
      slug: "system-agent-behavior",
      name: "Agent Behavior Measurement",
      description: "Measure agent communication style and behavior across core dimensions",
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.MEASURE_AGENT,
      specType: SpecType.SYSTEM,
      domain: "behavior",
      priority: 80,
      isActive: true,
      compiledAt: new Date(),
      isDirty: false,
      triggers: {
        create: [
          {
            name: "Agent Behavior Signals",
            given: "An agent response in a conversation",
            when: "The agent communicates with the caller",
            then: "Measure agent behavior dimensions",
            sortOrder: 0,
            actions: {
              create: [
                { description: "Measure warmth and friendliness", parameterId: "BEH-WARMTH", weight: 1.0, sortOrder: 0 },
                { description: "Measure empathy and validation", parameterId: "BEH-EMPATHY-RATE", weight: 1.0, sortOrder: 1 },
                { description: "Measure formality level", parameterId: "BEH-FORMALITY", weight: 1.0, sortOrder: 2 },
                { description: "Measure directness of communication", parameterId: "BEH-DIRECTNESS", weight: 1.0, sortOrder: 3 },
                { description: "Measure proactivity in offering help", parameterId: "BEH-PROACTIVE", weight: 1.0, sortOrder: 4 },
                { description: "Measure question vs statement ratio", parameterId: "BEH-QUESTION-RATE", weight: 1.0, sortOrder: 5 },
                { description: "Measure pace matching with caller", parameterId: "BEH-PACE-MATCH", weight: 1.0, sortOrder: 6 },
              ],
            },
          },
        ],
      },
    },
  });
  console.log(`   ✓ Created SYSTEM spec: ${agentSpec.name}`);

  // 5. SYSTEM SPEC: Socratic Tutor Behaviour (MEASURE) - TUT-001
  const tutorSpec = await prisma.analysisSpec.create({
    data: {
      slug: "system-socratic-tutor-behaviour",
      name: "Socratic Tutor Behaviour",
      description: "Measure tutor leadership, probing quality, sequence correctness, and conversation dynamics for Socratic tutoring",
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.MEASURE,
      specType: SpecType.SYSTEM,
      domain: "tutoring",
      priority: 75,
      isActive: true,
      compiledAt: new Date(),
      isDirty: false,
      triggers: {
        create: [
          {
            name: "Tutor Leadership Signals",
            given: "A tutoring session with agent and student",
            when: "The tutor advances the session or introduces content",
            then: "Assess leadership without permission-seeking",
            sortOrder: 0,
            actions: {
              create: [
                { description: "Assess leadership: absence of 'would you like', 'should we', 'do you want to'", parameterId: "LEAD_SCORE", weight: 1.0, sortOrder: 0 },
              ],
            },
          },
          {
            name: "Comprehension Check Quality",
            given: "A tutoring session with concept delivery",
            when: "The tutor checks student understanding",
            then: "Assess whether checks require application vs hollow confirmation",
            sortOrder: 1,
            actions: {
              create: [
                { description: "Assess probe quality: application questions vs 'does that make sense?'", parameterId: "PROBE_QUALITY", weight: 1.0, sortOrder: 0 },
                { description: "Assess probe depth: follow-up on shallow answers to mechanism/cause", parameterId: "PROBE_DEPTH", weight: 1.0, sortOrder: 1 },
              ],
            },
          },
          {
            name: "Teaching Sequence Analysis",
            given: "A tutoring session covering concepts",
            when: "The tutor introduces nuance or complications",
            then: "Verify concept → application → complication sequence",
            sortOrder: 2,
            actions: {
              create: [
                { description: "Verify teaching sequence: concept established before complication", parameterId: "SEQUENCE_CORRECT", weight: 1.0, sortOrder: 0 },
                { description: "Assess topic depth: multiple examples or student application before moving on", parameterId: "TOPIC_DEPTH", weight: 1.0, sortOrder: 1 },
              ],
            },
          },
          {
            name: "Conversation Dynamics",
            given: "A tutoring session in progress",
            when: "The tutor speaks",
            then: "Measure turn length and conversation balance",
            sortOrder: 3,
            actions: {
              create: [
                { description: "Measure turn length: target 30-60 words, max 100", parameterId: "TURN_LENGTH", weight: 1.0, sortOrder: 0 },
                { description: "Measure conversation dominance: tutor's share of words (target 40-55%)", parameterId: "CONV_DOM", weight: 1.0, sortOrder: 1 },
              ],
            },
          },
        ],
      },
    },
  });
  console.log(`   ✓ Created SYSTEM spec: ${tutorSpec.name}`);

  console.log(`\n   ✅ Created 5 SYSTEM specs\n`);

  return { memorySpec, personalitySpec, aggregateSpec, agentSpec, tutorSpec };
}

/**
 * Consolidated WNF Tutor domain - the ONE domain for all callers
 * Combines: IDENTITY (TUT-001 + TUT-WNF-001), CONTENT (WNF-CONTENT-001), VOICE (VOICE-001)
 * With all 12 behavior targets (7 core + 5 voice)
 */
async function seedWNFDomain() {
  console.log("\n📚 SEEDING WNF TUTOR DOMAIN & PLAYBOOK\n");
  console.log("━".repeat(60));

  // Create the ONE domain: WNF Tutor
  const domain = await prisma.domain.create({
    data: {
      slug: "wnf",
      name: "WNF Tutor",
      description: "Why Nations Fail voice tutoring domain with compositional identity and full behavior targets",
    },
  });
  console.log(`   ✓ Created domain: ${domain.name} (${domain.slug})`);

  // Get IDENTITY, VOICE, and CONTENT specs
  const [tutorIdentitySpec, wnfIdentitySpec, voiceSpec, contentSpec] = await Promise.all([
    prisma.analysisSpec.findFirst({ where: { slug: "spec-tut-001" }, select: { id: true, name: true } }),
    prisma.analysisSpec.findFirst({ where: { slug: "spec-tut-wnf-001" }, select: { id: true, name: true } }),
    prisma.analysisSpec.findFirst({ where: { slug: "spec-voice-001" }, select: { id: true, name: true } }),
    prisma.analysisSpec.findFirst({ where: { slug: "spec-wnf-content-001" }, select: { id: true, name: true } }),
  ]);

  if (tutorIdentitySpec) console.log(`   ✓ Found: ${tutorIdentitySpec.name}`);
  if (wnfIdentitySpec) console.log(`   ✓ Found: ${wnfIdentitySpec.name}`);
  if (voiceSpec) console.log(`   ✓ Found: ${voiceSpec.name}`);
  if (contentSpec) console.log(`   ✓ Found: ${contentSpec.name}`);

  // Get all SYSTEM specs for the playbook
  const systemSpecs = await prisma.analysisSpec.findMany({
    where: { specType: SpecType.SYSTEM, isActive: true },
    select: { id: true, slug: true, name: true },
  });

  // Look up the Curriculum entity
  const curriculum = await prisma.curriculum.findUnique({
    where: { slug: "wnf-content-001" },
  });

  if (curriculum) {
    console.log(`   ✓ Found Curriculum: ${curriculum.name}`);
  }

  // Create PUBLISHED playbook
  const playbook = await prisma.playbook.create({
    data: {
      name: "WNF Tutor Playbook",
      description: "Why Nations Fail voice tutoring playbook with TUT-001 identity, WNF content, and voice optimization",
      domainId: domain.id,
      // Note: curriculumId removed - not in current schema
      status: "PUBLISHED",
      version: "1.0.0",
      publishedAt: new Date(),
      publishedBy: "seed",
      validationPassed: true,
      // Counts are for DOMAIN specs only; SYSTEM specs are auto-included
      measureSpecCount: 0, // No domain measure specs in this playbook
      learnSpecCount: 0,
      adaptSpecCount: 0,
      items: {
        create: [
          // Add DOMAIN specs FIRST (higher priority than SYSTEM specs)
          // These will be used for identity and content over generic SYSTEM specs
          ...(wnfIdentitySpec ? [{
            itemType: "SPEC" as const,
            specId: wnfIdentitySpec.id,
            sortOrder: 0,
            isEnabled: true,
          }] : []),
          ...(contentSpec ? [{
            itemType: "SPEC" as const,
            specId: contentSpec.id,
            sortOrder: 1,
            isEnabled: true,
          }] : []),
          // NOTE: SYSTEM specs are auto-included and should NOT be added to items
          // They are managed via PlaybookSystemSpec table for enable/disable toggles
        ],
      },
    },
  });
  const domainSpecCount = (wnfIdentitySpec ? 1 : 0) + (contentSpec ? 1 : 0);
  console.log(`   ✓ Created playbook: ${playbook.name} (PUBLISHED)`);
  console.log(`      └─ Added ${domainSpecCount} DOMAIN specs (TUT-WNF-001, WNF-CONTENT-001)`);
  console.log(`      └─ SYSTEM specs: ${systemSpecs.length} (auto-included, not in items)`);
  if (curriculum) console.log(`      └─ Linked Curriculum: ${curriculum.name}`);

  // Create ALL 12 behavior targets (7 core + 5 voice)
  console.log(`\n   🎯 Creating behavior targets...`);
  const allTargets = [
    // Core behavior targets
    { parameterId: "BEH-WARMTH", targetValue: 0.75, desc: "Warm, supportive tone" },
    { parameterId: "BEH-DIRECTNESS", targetValue: 0.50, desc: "Balanced - guide without dictating" },
    { parameterId: "BEH-FORMALITY", targetValue: 0.35, desc: "Friendly but professional" },
    { parameterId: "BEH-EMPATHY-RATE", targetValue: 0.80, desc: "High empathy for learner emotions" },
    { parameterId: "BEH-QUESTION-RATE", targetValue: 0.75, desc: "Socratic questioning style" },
    { parameterId: "BEH-PROACTIVE", targetValue: 0.65, desc: "Guide actively but allow exploration" },
    { parameterId: "BEH-PACE-MATCH", targetValue: 0.50, desc: "Adapt to learner's pace" },
    // Voice-specific behavior targets (for VAPI)
    { parameterId: "BEH-RESPONSE-LENGTH", targetValue: 0.30, desc: "Short responses (2-3 sentences)" },
    { parameterId: "BEH-PAUSE-TOLERANCE", targetValue: 0.70, desc: "Wait for them to think" },
    { parameterId: "BEH-FILLER-USE", targetValue: 0.60, desc: "Natural speech with fillers" },
    { parameterId: "BEH-BACKCHANNEL", targetValue: 0.65, desc: "Acknowledge with backchannels" },
    { parameterId: "BEH-TURN-LENGTH", targetValue: 0.30, desc: "Short turns, frequent check-ins" },
  ];

  let targetsCreated = 0;
  for (const target of allTargets) {
    const param = await prisma.parameter.findUnique({
      where: { parameterId: target.parameterId },
    });
    if (!param) {
      console.log(`      ⚠️ Parameter '${target.parameterId}' not found, skipping`);
      continue;
    }

    await prisma.behaviorTarget.create({
      data: {
        parameterId: target.parameterId,
        scope: "PLAYBOOK",
        playbookId: playbook.id,
        targetValue: target.targetValue,
        confidence: 0.8,
        source: "SEED",
      },
    });
    targetsCreated++;
    const level = target.targetValue >= 0.7 ? "HIGH" : target.targetValue <= 0.3 ? "LOW" : "MOD";
    console.log(`      ✓ ${param.name}: ${(target.targetValue * 100).toFixed(0)}% (${level})`);
  }
  console.log(`\n      Created ${targetsCreated} behavior targets (7 core + 5 voice)`);

  console.log(`\n   ✅ WNF Tutor domain created - this is THE domain for all callers\n`);

  return { domain, playbook, curriculum };
}

/**
 * Create Companion domain and playbook linking to BDD-backed specs
 * The specs are already created by seed-from-specs.ts from bdd-specs/COMP-*.spec.json
 * This function just creates the domain/playbook and links them
 */
async function seedCompanionDomainFromBDD() {
  console.log("\n🧓 SEEDING COMPANION DOMAIN & PLAYBOOK (BDD-backed)\n");
  console.log("━".repeat(60));

  // Create the Companion domain
  const domain = await prisma.domain.create({
    data: {
      slug: "companion",
      name: "Companion",
      description: "Conversational companion for curious, intelligent older adults - providing intellectual engagement, warm companionship, and meaningful conversation",
      isDefault: false,
      isActive: true,
    },
  });
  console.log(`   ✓ Created domain: ${domain.name} (${domain.slug})`);

  // Find all companion DOMAIN specs (BDD-backed, created by seed-from-specs)
  // These have slugs like: spec-comp-ie-001, spec-comp-ew-001, etc.
  const companionSpecSlugs = [
    "spec-companion-001", // Companion Identity (IDENTITY/COMPOSE) - defines persona
    "spec-comp-ie-001", // Intellectual Engagement (MEASURE)
    "spec-comp-ew-001", // Emotional Wellbeing (MEASURE)
    "spec-comp-lc-001", // Life Context (LEARN)
    "spec-comp-ix-001", // Interests & Expertise (LEARN)
    "spec-comp-cp-001", // Communication Preferences (LEARN)
    "spec-comp-cg-001", // Cognitive Patterns (MEASURE)
    "spec-comp-cd-001", // Conversational Depth (MEASURE_AGENT)
    "spec-comp-re-001", // Respect Experience (MEASURE_AGENT)
    "spec-comp-is-001", // Intellectual Stimulation (MEASURE_AGENT)
    "spec-comp-pp-001", // Patience & Pacing (MEASURE_AGENT)
    "spec-comp-mc-001", // Memory & Continuity (MEASURE_AGENT)
    "spec-comp-gg-001", // Gentle Guidance (MEASURE_AGENT)
  ];

  const companionSpecs = await prisma.analysisSpec.findMany({
    where: { slug: { in: companionSpecSlugs } },
    orderBy: { priority: "desc" },
  });

  console.log(`   ✓ Found ${companionSpecs.length}/${companionSpecSlugs.length} companion specs`);
  for (const spec of companionSpecs) {
    console.log(`      └─ ${spec.slug}: ${spec.name} (${spec.outputType})`);
  }

  // Create the Companion Playbook
  const playbook = await prisma.playbook.create({
    data: {
      name: "Companion Playbook v1",
      description: "Optimized for meaningful conversation with curious, intelligent older adults",
      domainId: domain.id,
      status: "DRAFT",
      version: "1.0",
      measureSpecCount: companionSpecs.filter(s => s.outputType === "MEASURE" || s.outputType === "MEASURE_AGENT").length,
      learnSpecCount: companionSpecs.filter(s => s.outputType === "LEARN").length,
      adaptSpecCount: 0,
    },
  });
  console.log(`   ✓ Created playbook: ${playbook.name}`);

  // Link companion specs to playbook via PlaybookItems
  // NOTE: Only DOMAIN specs should be added here - SYSTEM specs are auto-included
  let sortOrder = 0;
  for (const spec of companionSpecs) {
    await prisma.playbookItem.create({
      data: {
        playbookId: playbook.id,
        itemType: "SPEC",
        specId: spec.id,
        isEnabled: true,
        sortOrder: sortOrder++,
      },
    });
  }
  console.log(`   ✓ Linked ${companionSpecs.length} DOMAIN specs to playbook`);

  // Create PLAYBOOK-level behavior targets (optimized for companion)
  console.log(`\n   🎯 Creating behavior targets...`);
  const companionTargets = [
    // Core behaviors
    { parameterId: "BEH-WARMTH", targetValue: 0.85, desc: "High warmth for companionship" },
    { parameterId: "BEH-EMPATHY-RATE", targetValue: 0.8, desc: "Strong empathy for connection" },
    { parameterId: "BEH-FORMALITY", targetValue: 0.35, desc: "Casual, friendly tone" },
    { parameterId: "BEH-DIRECTNESS", targetValue: 0.55, desc: "Balanced direct/gentle" },
    { parameterId: "BEH-PROACTIVE", targetValue: 0.75, desc: "Actively engage in conversation" },
    { parameterId: "BEH-QUESTION-RATE", targetValue: 0.65, desc: "Ask thoughtful questions" },
    { parameterId: "BEH-PACE-MATCH", targetValue: 0.9, desc: "Match their conversational pace" },
    // Companion-specific behaviors (from COMP-* specs)
    { parameterId: "BEH-CONVERSATIONAL-DEPTH", targetValue: 0.8, desc: "Deep, meaningful exchanges" },
    { parameterId: "BEH-RESPECT-EXPERIENCE", targetValue: 0.95, desc: "Honor their life experience" },
    { parameterId: "BEH-INTELLECTUAL-CHALLENGE", targetValue: 0.7, desc: "Stimulating discussion" },
    { parameterId: "BEH-PATIENCE-LEVEL", targetValue: 0.9, desc: "Unhurried, patient" },
    { parameterId: "BEH-MEMORY-REFERENCE", targetValue: 0.8, desc: "Reference past conversations" },
    { parameterId: "BEH-STORY-INVITATION", targetValue: 0.75, desc: "Invite personal stories" },
  ];

  let targetsCreated = 0;
  for (const target of companionTargets) {
    const param = await prisma.parameter.findUnique({
      where: { parameterId: target.parameterId },
    });
    if (!param) {
      console.log(`      ⚠️ Parameter '${target.parameterId}' not found, skipping`);
      continue;
    }

    await prisma.behaviorTarget.create({
      data: {
        parameterId: target.parameterId,
        playbookId: playbook.id,
        scope: "PLAYBOOK",
        targetValue: target.targetValue,
        confidence: 1.0,
        source: "SEED",
      },
    });
    targetsCreated++;
    const level = target.targetValue >= 0.7 ? "HIGH" : target.targetValue <= 0.3 ? "LOW" : "MOD";
    console.log(`      ✓ ${param.name}: ${(target.targetValue * 100).toFixed(0)}% (${level})`);
  }
  console.log(`\n      Created ${targetsCreated} behavior targets`);

  console.log(`\n   ✅ Companion domain created with ${companionSpecs.length} BDD-backed specs\n`);

  return { domain, playbook };
}

/**
 * Assign specific callers to Companion domain after import
 * Called after all transcripts are imported to reassign domain
 */
async function assignCompanionCallers() {
  console.log("\n🧓 ASSIGNING COMPANION DOMAIN CALLERS\n");
  console.log("━".repeat(60));

  // Get the Companion domain
  const companionDomain = await prisma.domain.findUnique({ where: { slug: "companion" } });
  if (!companionDomain) {
    console.log("   ⚠️  Companion domain not found. Skipping caller assignment.");
    return { assigned: 0 };
  }

  // Callers to assign to Companion domain (by name or phone)
  const companionCallers = [
    { name: "Louis Staal", phone: "+447939590909" },
  ];

  let assigned = 0;

  for (const callerInfo of companionCallers) {
    // Find by phone first, then by name
    const caller = await prisma.caller.findFirst({
      where: {
        OR: [
          { phone: callerInfo.phone },
          { name: callerInfo.name },
        ],
      },
    });

    if (caller) {
      if (caller.domainId !== companionDomain.id) {
        await prisma.caller.update({
          where: { id: caller.id },
          data: { domainId: companionDomain.id },
        });
        console.log(`   ✓ Assigned ${caller.name} (${caller.phone}) to Companion domain`);
        assigned++;
      } else {
        console.log(`   → ${caller.name} already in Companion domain`);
      }
    } else {
      console.log(`   ⚠️  Caller not found: ${callerInfo.name} (${callerInfo.phone})`);
    }
  }

  console.log(`\n   ✅ Assigned ${assigned} caller(s) to Companion domain\n`);
  return { assigned };
}

/**
 * Merge duplicate callers that have the same name but different phone numbers
 * This handles cases like WNF_STUDENT appearing with multiple phone numbers
 */
async function mergeDuplicateCallers() {
  console.log("\n🔗 MERGING DUPLICATE CALLERS\n");
  console.log("━".repeat(60));

  // Find callers with duplicate names
  const duplicateNames = await prisma.$queryRaw<{ name: string; count: bigint }[]>`
    SELECT name, COUNT(*) as count
    FROM "Caller"
    GROUP BY name
    HAVING COUNT(*) > 1
  `;

  if (duplicateNames.length === 0) {
    console.log("   No duplicate callers found\n");
    return;
  }

  for (const { name } of duplicateNames) {
    const callers = await prisma.caller.findMany({
      where: { name },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { calls: true } } },
    });

    if (callers.length <= 1) continue;

    const keepCaller = callers[0];
    const dupes = callers.slice(1);

    console.log(`   Merging "${name}" (${callers.length} instances):`);
    console.log(`     Keeping: ${keepCaller.phone} (${keepCaller._count.calls} calls)`);

    for (const dupe of dupes) {
      // Move calls to kept caller
      const updated = await prisma.call.updateMany({
        where: { callerId: dupe.id },
        data: { callerId: keepCaller.id },
      });
      console.log(`     Merged: ${dupe.phone} (${updated.count} calls)`);

      // Delete duplicate
      await prisma.caller.delete({ where: { id: dupe.id } });
    }

    // Re-sequence calls for merged caller
    const allCalls = await prisma.call.findMany({
      where: { callerId: keepCaller.id },
      orderBy: { createdAt: "asc" },
    });

    let seq = 1;
    let prevId: string | null = null;
    for (const call of allCalls) {
      await prisma.call.update({
        where: { id: call.id },
        data: { callSequence: seq, previousCallId: prevId },
      });
      prevId = call.id;
      seq++;
    }
    console.log(`     Re-sequenced ${seq - 1} calls\n`);
  }

  console.log("   ✅ Duplicate callers merged\n");
}

// VAPI Call Export Types
interface VAPICall {
  id: string;
  transcript: string;
  summary: string;
  customer: { name?: string; number?: string } | null | string;
  startedAt: string | null;
  endedAt: string | null;
  status: string;
  endedReason: string;
  messages: VAPIMessage[] | string;
  createdAt: string;
}

interface VAPIMessage {
  role: string;
  message: string;
  time?: number;
  secondsFromStart?: number;
}

/**
 * Parse a plain text transcript file into a call object
 * Format expected:
 * - "Phone Number: +XXX" at the top
 * - "Transcript" marker
 * - Alternating "Assistant" and "User" sections with content
 * - Log ID in filename
 */
function parseTextTranscript(content: string, filename: string): VAPICall | null {
  try {
    // Extract log ID from filename (e.g., "Session 1 - Log ID 019bf58d-d83d-744f-abf0-6b514299d5f3.txt")
    const logIdMatch = filename.match(/Log ID ([0-9a-f-]+)/i);
    const logId = logIdMatch ? logIdMatch[1] : `txt-${Date.now()}`;

    // Extract phone number
    const phoneMatch = content.match(/Phone Number:\s*\+?\s*([0-9\s]+)/i);
    const phone = phoneMatch ? phoneMatch[1].replace(/\s/g, "") : null;

    // Extract caller name
    const callerMatch = content.match(/Caller:\s*(.+)/i);
    const callerName = callerMatch ? callerMatch[1].trim() : null;

    // Find where transcript starts
    const transcriptStart = content.indexOf("Transcript");
    if (transcriptStart === -1) return null;

    const transcriptContent = content.slice(transcriptStart + "Transcript".length).trim();

    // Parse the alternating Assistant/User sections
    const lines: string[] = [];
    const sections = transcriptContent.split(/\n(?=Assistant|User)/);

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      // Check if it starts with Assistant or User
      if (trimmed.startsWith("Assistant")) {
        const text = trimmed
          .replace(/^Assistant\s*/i, "")
          .replace(/\d+:\d+:\d+\s*(AM|PM)\s*\(\+[\d.:]+\)/gi, "") // Remove timestamps
          .trim();
        if (text) lines.push(`AI: ${text}`);
      } else if (trimmed.startsWith("User")) {
        const text = trimmed
          .replace(/^User\s*/i, "")
          .replace(/\d+:\d+:\d+\s*(AM|PM)\s*\(\+[\d.:]+\)/gi, "") // Remove timestamps
          .trim();
        if (text) lines.push(`User: ${text}`);
      }
    }

    if (lines.length === 0) return null;

    const transcript = lines.join("\n");

    return {
      id: logId,
      transcript,
      summary: "",
      customer: phone
        ? {
            number: `+${phone.startsWith("0") ? "44" + phone.slice(1) : phone}`,
            name: callerName || undefined,
          }
        : callerName
        ? { name: callerName }
        : null,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      status: "ended",
      endedReason: "completed",
      messages: [],
      createdAt: new Date().toISOString(),
    };
  } catch (e) {
    console.log(`   ⚠️  Failed to parse text file: ${filename}`);
    return null;
  }
}

/**
 * Extract caller name from transcript greeting
 * Looks for patterns like "Hi, John" or "Hello, Sarah Mitchell"
 */
function extractNameFromTranscript(transcript: string): string | null {
  if (!transcript) return null;

  // Look for greeting patterns at the start of AI turns
  const patterns = [
    /(?:AI|Agent|Assistant):\s*(?:Hi|Hello|Hey),?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:Hi|Hello|Hey),?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[.!,]/,
    /Nice to (?:meet|talk to|speak with) you,?\s+([A-Z][a-z]+)/i,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Skip generic names like "Caller 1"
      if (!name.toLowerCase().startsWith("caller")) {
        return name;
      }
    }
  }

  return null;
}

/**
 * Recursively find all files with specified extensions in a directory
 */
function findFilesRecursively(
  dir: string,
  extensions: string[],
  results: { filename: string; filePath: string }[] = []
): { filename: string; filePath: string }[] {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findFilesRecursively(fullPath, extensions, results);
      } else if (entry.isFile()) {
        const ext = entry.name.toLowerCase();
        if (extensions.some((e) => ext.endsWith(e))) {
          results.push({ filename: entry.name, filePath: fullPath });
        }
      }
    }
  } catch (e: any) {
    console.log(`   ⚠️  Cannot read directory: ${dir} (${e.message})`);
  }
  return results;
}

/**
 * Load real calls from VAPI transcript exports
 * Supports multiple folders and recursive scanning
 */
async function seedTranscriptsFromFolders(transcriptsFolderPaths: string[]) {
  console.log("\n📞 LOADING CALLS FROM TRANSCRIPTS FOLDERS\n");
  console.log("━".repeat(60));

  // Find all valid folders
  const validFolders = transcriptsFolderPaths.filter((p) => {
    if (!p) return false;
    const exists = fs.existsSync(p);
    console.log(`   ${exists ? "✓" : "✗"} ${p}`);
    return exists;
  });

  if (validFolders.length === 0) {
    console.log(`   ⚠️  No transcript folders found`);
    console.log(`   ℹ️  Skipping transcript loading. Using sample data only.\n`);
    return { callersCreated: 0, callsCreated: 0 };
  }

  console.log(`\n   Scanning ${validFolders.length} folder(s) recursively...\n`);

  // Get domain for callers - use tutoring domain for WNF playbook
  // Use the WNF domain for all callers from transcripts
  const domain = await prisma.domain.findUnique({ where: { slug: "wnf" } });

  // Find all JSON and TXT files recursively across all folders
  const allFoundFiles: { filename: string; filePath: string }[] = [];
  for (const folder of validFolders) {
    const files = findFilesRecursively(folder, [".json", ".txt"]);
    allFoundFiles.push(...files);
  }

  const jsonFiles = allFoundFiles.filter((f) => f.filename.toLowerCase().endsWith(".json"));
  const txtFiles = allFoundFiles.filter((f) => f.filename.toLowerCase().endsWith(".txt"));
  console.log(`   Found ${jsonFiles.length} JSON files, ${txtFiles.length} text files\n`);

  // Collect all calls from all files
  const allCalls: VAPICall[] = [];

  // Process JSON files
  for (const { filename, filePath } of jsonFiles) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const json = JSON.parse(content);
      // Handle both array format and {calls: [...]} format
      const calls = Array.isArray(json) ? json : (json.calls || [json]);
      allCalls.push(...calls);
      console.log(`   ✓ Loaded ${calls.length} calls from ${filename}`);
    } catch (e: any) {
      console.log(`   ⚠️  Failed to parse JSON: ${filename} (${e.message})`);
    }
  }

  // Process text files
  for (const { filename, filePath } of txtFiles) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const call = parseTextTranscript(content, filename);
      if (call) {
        allCalls.push(call);
        console.log(`   ✓ Loaded 1 call from ${filename}`);
      }
    } catch (e: any) {
      console.log(`   ⚠️  Failed to parse TXT: ${filename} (${e.message})`);
    }
  }

  // Filter to calls with actual transcripts
  const validCalls = allCalls.filter(
    (c) => c.transcript && c.transcript.trim().length > 0 && typeof c.customer === "object" && c.customer?.number
  );
  console.log(`\n   Total calls with transcripts: ${validCalls.length}`);

  // Group calls by caller phone number and sort by date
  const callsByPhone = new Map<string, VAPICall[]>();
  for (const call of validCalls) {
    const phone = (call.customer as { number?: string })?.number;
    if (!phone) continue;
    const existing = callsByPhone.get(phone) || [];
    existing.push(call);
    callsByPhone.set(phone, existing);
  }

  // Sort each caller's calls by startedAt/createdAt
  Array.from(callsByPhone.entries()).forEach(([, calls]) => {
    calls.sort((a, b) => {
      const dateA = new Date(a.startedAt || a.createdAt).getTime();
      const dateB = new Date(b.startedAt || b.createdAt).getTime();
      return dateA - dateB;
    });
  });

  console.log(`   Unique callers: ${callsByPhone.size}\n`);

  let callersCreated = 0;
  let callsCreated = 0;

  // Create callers and their calls
  for (const [phone, calls] of Array.from(callsByPhone.entries())) {
    const customerInfo = calls[0].customer as { name?: string; number?: string };

    // Try to get name from: 1) customer.name, 2) transcript greeting, 3) phone fallback
    let callerName = customerInfo?.name?.trim();
    if (!callerName || callerName.toLowerCase().startsWith("caller")) {
      // Try to extract from first call's transcript
      const transcriptName = extractNameFromTranscript(calls[0].transcript);
      callerName = transcriptName || `Caller ${phone.slice(-4)}`;
    }

    // Create or find caller
    let caller = await prisma.caller.findFirst({ where: { phone } });
    if (!caller) {
      caller = await prisma.caller.create({
        data: {
          name: callerName,
          phone,
          domainId: domain?.id,
          externalId: `vapi-${phone}`,
        },
      });
      callersCreated++;
      console.log(`   ✓ Created caller: ${callerName} (${phone})`);
    } else {
      console.log(`   → Found existing caller: ${caller.name} (${phone})`);
    }

    // Create calls with proper sequencing
    let callSequence = 1;
    let previousCallId: string | null = null;

    // Check for existing calls for this caller
    const existingCalls = await prisma.call.findMany({
      where: { callerId: caller.id },
      orderBy: { callSequence: "desc" },
      take: 1,
    });
    if (existingCalls.length > 0 && existingCalls[0].callSequence) {
      callSequence = existingCalls[0].callSequence + 1;
      previousCallId = existingCalls[0].id;
    }

    for (const vapiCall of calls) {
      // Skip if this call already exists (by externalId)
      const existingCall = await prisma.call.findFirst({
        where: { externalId: vapiCall.id },
      });
      if (existingCall) {
        previousCallId = existingCall.id;
        if (existingCall.callSequence) callSequence = existingCall.callSequence + 1;
        continue;
      }

      const createdCall = await prisma.call.create({
        data: {
          source: "vapi-import",
          externalId: vapiCall.id,
          callerId: caller.id,
          transcript: vapiCall.transcript,
          callSequence,
          previousCallId,
          createdAt: new Date(vapiCall.startedAt || vapiCall.createdAt),
        },
      });

      callsCreated++;
      previousCallId = createdCall.id;
      callSequence++;
    }

    console.log(`      └─ Added ${calls.length} call(s)`);
  }

  console.log(`\n   ✅ Imported ${callersCreated} new callers with ${callsCreated} calls\n`);
  return { callersCreated, callsCreated };
}

// Configurable transcript folder paths - will scan all recursively
const TRANSCRIPTS_FOLDERS = [
  "/Volumes/PAWSTAW/Projects/hf_kb/sources/transcripts/raw",
  "/Volumes/PAWSTAW/Projects/hf_kb/sources/transcripts",
  "/Users/paulwander/hf_kb/sources/transcripts",
  path.join(process.cwd(), "transcripts"), // Local transcripts folder (includes WNF)
  process.env.HF_TRANSCRIPTS_PATH, // Allow env override
].filter(Boolean) as string[];

async function main() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         MABEL SEED - SPEC-FIRST ARCHITECTURE              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  let transcriptStats = { callersCreated: 0, callsCreated: 0 };

  try {
    // Step 1: Clear all data
    await clearAllData();

    // Step 2: Load BDD spec files (SINGLE SOURCE OF TRUTH)
    // This derives: Parameters, ScoringAnchors, PromptSlugs, AnalysisSpecs
    // From: PERS-001 (personality), MEM-001 (memory), CA-001 (cognitive activation)
    await seedFromSpecs();

    // Step 2.5: Apply hand-crafted prompt template overrides (enhances auto-compiled templates)
    await updatePromptTemplates();

    // Step 3: Seed additional parameters not yet in spec files
    await seedBehaviorParameters();      // Agent behavior (BEH-*)
    await seedTutoringParameters();      // Tutoring behavior (TUT-*)
    await seedWNFContentParameters();    // WNF content (WNF-*)

    // Step 3.5: Re-link ADAPT spec actions now that BEH-* parameters exist
    await relinkAdaptSpecActions();

    // Step 4-6: ADAPT, SUPERVISE, and COMPOSE specs now loaded from BDD files:
    // - ADAPT-PERS-001: Personality adaptation (Big Five → communication style)
    // - ADAPT-ENG-001: Engagement adaptation (engagement → content depth)
    // - SUPV-001: Agent supervision (quality, safety, progress, consistency)
    // - COMP-001: Prompt composition
    // - INJECT-001: Pre-call data injection
    // - WNF-CONTENT-001: Why Nations Fail curriculum (CONTENT spec)

    // Step 7: Create THE WNF domain (single domain for all callers)
    await seedWNFDomain();

    // Step 7.5: Create Companion domain (for older adults)
    // Uses BDD-backed specs from bdd-specs/COMP-*.spec.json
    await seedCompanionDomainFromBDD();

    // Step 8: Seed target definitions
    await seedSystemTargets();
    await seedDomainTargets();

    // Step 9: Load real transcripts from VAPI exports
    transcriptStats = await seedTranscriptsFromFolders(TRANSCRIPTS_FOLDERS);

    // Step 10: Assign specific callers to Companion domain
    await assignCompanionCallers();

    // Step 11: Merge duplicate callers (same name, different phones)
    await mergeDuplicateCallers();

    // Summary
    console.log("\n");
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║                    SEED COMPLETE                          ║");
    console.log("╠════════════════════════════════════════════════════════════╣");
    console.log("║  ALL SPECS FROM BDD FILES (bdd-specs/):                   ║");
    console.log("║                                                            ║");
    console.log("║  SYSTEM Specs (Always Run):                               ║");
    console.log("║    • PERS-001: Big Five Personality (MEASURE)             ║");
    console.log("║    • CA-001: Cognitive Activation (MEASURE)               ║");
    console.log("║    • MEM-001: Memory Extraction (LEARN)                   ║");
    console.log("║    • GOAL-001: Learner Goals (LEARN)                      ║");
    console.log("║    • CURR-001: Curriculum Tracking (MEASURE)              ║");
    console.log("║    • STYLE-001: Conversation Style (MEASURE_AGENT)        ║");
    console.log("║    • SUPV-001: Agent Supervision (SUPERVISE)              ║");
    console.log("║    • REW-001: Reward Computation (REWARD)                 ║");
    console.log("║    • INJECT-001: Pre-Call Data Injection (INJECT)         ║");
    console.log("║    • SESSION-001: Session Arc Planning (COMPOSE)          ║");
    console.log("║    • COMP-001: Prompt Composition (COMPOSE)               ║");
    console.log("║                                                            ║");
    console.log("║  ADAPT Specs (Compute Targets):                           ║");
    console.log("║    • ADAPT-PERS-001: Personality → Style Targets          ║");
    console.log("║    • ADAPT-ENG-001: Engagement → Pacing/Complexity        ║");
    console.log("║                                                            ║");
    console.log("║  DOMAIN Specs (Playbook Selection):                       ║");
    console.log("║    • TUT-001: Generic Tutor (IDENTITY)                    ║");
    console.log("║    • TUT-WNF-001: WNF Tutor (IDENTITY)                    ║");
    console.log("║    • WNF-CONTENT-001: Why Nations Fail (CONTENT)          ║");
    console.log("║                                                            ║");
    console.log("║  Additional Parameters (manual fallback):                 ║");
    console.log("║    • 7 Agent behavior (BEH-WARMTH, etc.)                   ║");
    console.log("║    • 7 Tutoring behavior (LEAD_SCORE, PROBE_*, etc.)      ║");
    console.log("║    • 5 WNF content (INTRO_COMPLETE, etc. if not in spec) ║");
    console.log("║                                                            ║");
    console.log("║  Domains & Playbooks:                                      ║");
    console.log("║    • WNF Tutor → WNF Tutor Playbook (12 targets)          ║");
    console.log("║    • Companion → Companion Playbook (13 targets)          ║");
    console.log("║      └─ Louis Staal assigned from VAPI imports            ║");
    console.log("║                                                            ║");
    console.log(`║  Calls: ${transcriptStats.callersCreated} callers with ${transcriptStats.callsCreated} calls (VAPI)         ║`);
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log("\n");
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
