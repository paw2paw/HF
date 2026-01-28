/**
 * Master Seed - Clear All Data and Seed Everything
 *
 * Run with: npx tsx prisma/seed-master.ts
 *
 * This script:
 * 1. Clears ALL data from the database (in proper FK order)
 * 2. Seeds core/shared parameters (BEH-WARMTH, etc.)
 * 3. Seeds SYSTEM specs (guardrails, safety, quality)
 * 4. Runs the WWII Tutor seed
 * 5. Runs the Companion seed
 * 6. Seeds sample callers and calls with transcripts
 */

import { PrismaClient, ParameterType, BehaviorTargetScope, SpecificationScope, AnalysisOutputType } from "@prisma/client";
import { execSync } from "child_process";

const prisma = new PrismaClient();

async function clearAllData() {
  console.log("\n🗑️  CLEARING ALL DATA\n");
  console.log("━".repeat(60));

  // Clear in FK-safe order (children before parents)
  const tables = [
    // Analysis results
    "analysisResult",
    "analysisRun",

    // Call data
    "callScore",
    "call",

    // Caller data
    "callerMemorySummary",
    "callerMemory",
    "personalityObservation",
    "callerPersonalityProfile",
    "callerPersonality",
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

    // Prompt system
    "promptSlugRange",
    "promptSlugSelection",
    "promptSlug",
    "promptBlock",
    "promptTemplate",

    // Parameters
    "parameterScoringAnchor",
    "parameter",

    // Knowledge
    "knowledgeVector",
    "knowledgeChunk",
    "knowledgeArtifact",
    "knowledgeDoc",
    "processedFile",

    // Transcripts
    "transcript",

    // Agents
    "agentRun",
    "agentInstance",

    // Settings
    "setting",
    "analysisProfile",
  ];

  for (const table of tables) {
    try {
      // @ts-ignore - dynamic table access
      const count = await prisma[table].count();
      if (count > 0) {
        // @ts-ignore
        await prisma[table].deleteMany();
        console.log(`   ✓ Cleared ${table}: ${count} rows`);
      }
    } catch (e: any) {
      // Table might not exist or have different name
      if (!e.message?.includes("does not exist")) {
        console.log(`   ⚠️  ${table}: ${e.message?.substring(0, 50) || 'error'}`);
      }
    }
  }

  console.log("\n   ✅ Database cleared\n");
}

async function seedCoreParameters() {
  console.log("\n📐 SEEDING CORE PARAMETERS\n");
  console.log("━".repeat(60));

  // Core behavior parameters that all playbooks use
  const coreParams = [
    {
      parameterId: "BEH-WARMTH",
      name: "Warmth",
      definition: "How warm and friendly the agent's communication style is",
      domainGroup: "tone",
    },
    {
      parameterId: "BEH-EMPATHY-RATE",
      name: "Empathy Rate",
      definition: "How often the agent acknowledges and validates user emotions",
      domainGroup: "emotional",
    },
    {
      parameterId: "BEH-FORMALITY",
      name: "Formality",
      definition: "How formal vs casual the agent's language is",
      domainGroup: "tone",
    },
    {
      parameterId: "BEH-DIRECTNESS",
      name: "Directness",
      definition: "How direct vs indirect the agent's communication is",
      domainGroup: "style",
    },
    {
      parameterId: "BEH-PROACTIVE",
      name: "Proactivity",
      definition: "How proactively the agent offers information or suggestions",
      domainGroup: "engagement",
    },
    {
      parameterId: "BEH-QUESTION-RATE",
      name: "Question Rate",
      definition: "How often the agent asks questions vs provides statements",
      domainGroup: "engagement",
    },
    {
      parameterId: "BEH-PACE-MATCH",
      name: "Pace Matching",
      definition: "How well the agent adapts to the user's conversation pace",
      domainGroup: "pacing",
    },
  ];

  for (const param of coreParams) {
    await prisma.parameter.create({
      data: {
        parameterId: param.parameterId,
        name: param.name,
        definition: param.definition,
        scaleType: "0-1",
        directionality: "neutral",
        computedBy: "measured",
        sectionId: "core-behavior",
        domainGroup: param.domainGroup,
        parameterType: ParameterType.BEHAVIOR,
        isAdjustable: true,
      },
    });
    console.log(`   ✓ Created: ${param.parameterId}`);

    // Create SYSTEM-level default target
    await prisma.behaviorTarget.create({
      data: {
        parameterId: param.parameterId,
        scope: BehaviorTargetScope.SYSTEM,
        targetValue: 0.5,
        confidence: 1.0,
        source: "SEED",
      },
    });
  }

  console.log(`\n   ✅ Created ${coreParams.length} core behavior parameters\n`);
}

async function seedSystemSpecs() {
  console.log("\n🛡️  SEEDING SYSTEM SPECS\n");
  console.log("━".repeat(60));

  // SYSTEM specs - global guardrails and safety rules
  const systemSpecs = [
    {
      slug: "system-safety-guardrails",
      name: "Safety Guardrails",
      description: "Monitor for unsafe content, harmful requests, or policy violations",
      outputType: AnalysisOutputType.MEASURE_AGENT,
      domain: "safety",
      priority: 100,
      triggers: [
        {
          name: "Harmful Content Detection",
          given: "A conversation turn from the agent",
          when: "The agent responds to a potentially harmful request",
          then: "Evaluate if the agent properly declined or redirected",
          actions: [
            {
              description: "Score the agent's handling of potentially harmful content",
              parameterId: "BEH-SAFETY-COMPLIANCE",
              weight: 1.0,
            },
          ],
        },
        {
          name: "Policy Adherence",
          given: "Agent response in any context",
          when: "Agent communicates with the caller",
          then: "Verify the response adheres to organizational policies",
          actions: [
            {
              description: "Score policy compliance in agent response",
              parameterId: "BEH-POLICY-ADHERENCE",
              weight: 1.0,
            },
          ],
        },
      ],
    },
    {
      slug: "system-response-quality",
      name: "Response Quality Standards",
      description: "Measure overall response quality, coherence, and helpfulness",
      outputType: AnalysisOutputType.MEASURE_AGENT,
      domain: "quality",
      priority: 90,
      triggers: [
        {
          name: "Response Coherence",
          given: "An agent response to a caller message",
          when: "The agent provides any response",
          then: "Evaluate the coherence and clarity of the response",
          actions: [
            {
              description: "Score response coherence and logical flow",
              parameterId: "BEH-RESPONSE-COHERENCE",
              weight: 1.0,
            },
          ],
        },
        {
          name: "Helpfulness Assessment",
          given: "A complete interaction turn",
          when: "The agent attempts to help the caller",
          then: "Measure how helpful the response actually was",
          actions: [
            {
              description: "Score the helpfulness of the agent response",
              parameterId: "BEH-HELPFULNESS",
              weight: 1.0,
            },
          ],
        },
      ],
    },
    {
      slug: "system-context-awareness",
      name: "Context Awareness",
      description: "Measure how well the agent maintains and uses conversation context",
      outputType: AnalysisOutputType.MEASURE_AGENT,
      domain: "quality",
      priority: 80,
      triggers: [
        {
          name: "Context Continuity",
          given: "A multi-turn conversation",
          when: "The agent responds after previous exchanges",
          then: "Evaluate if the agent properly references and uses context",
          actions: [
            {
              description: "Score context awareness and continuity",
              parameterId: "BEH-CONTEXT-AWARENESS",
              weight: 1.0,
            },
          ],
        },
      ],
    },
    {
      slug: "system-emotional-safety",
      name: "Emotional Safety",
      description: "Monitor for appropriate emotional boundaries and support",
      outputType: AnalysisOutputType.MEASURE_AGENT,
      domain: "safety",
      priority: 95,
      triggers: [
        {
          name: "Emotional Boundary Respect",
          given: "A caller expressing strong emotions",
          when: "The caller shares distressing or sensitive information",
          then: "Evaluate if the agent responds with appropriate boundaries",
          actions: [
            {
              description: "Score emotional boundary management",
              parameterId: "BEH-EMOTIONAL-SAFETY",
              weight: 1.0,
            },
          ],
        },
      ],
    },
  ];

  // Create SYSTEM parameters first
  const systemParams = [
    { parameterId: "BEH-SAFETY-COMPLIANCE", name: "Safety Compliance", definition: "How well the agent adheres to safety guidelines", domainGroup: "safety" },
    { parameterId: "BEH-POLICY-ADHERENCE", name: "Policy Adherence", definition: "How well the agent follows organizational policies", domainGroup: "safety" },
    { parameterId: "BEH-RESPONSE-COHERENCE", name: "Response Coherence", definition: "How coherent and logically structured responses are", domainGroup: "quality" },
    { parameterId: "BEH-HELPFULNESS", name: "Helpfulness", definition: "How helpful the agent's responses are to the caller", domainGroup: "quality" },
    { parameterId: "BEH-CONTEXT-AWARENESS", name: "Context Awareness", definition: "How well the agent maintains conversation context", domainGroup: "quality" },
    { parameterId: "BEH-EMOTIONAL-SAFETY", name: "Emotional Safety", definition: "How appropriately the agent handles emotional content", domainGroup: "safety" },
  ];

  for (const param of systemParams) {
    await prisma.parameter.create({
      data: {
        parameterId: param.parameterId,
        name: param.name,
        definition: param.definition,
        scaleType: "0-1",
        directionality: "neutral",
        computedBy: "measured",
        sectionId: "system-behavior",
        domainGroup: param.domainGroup,
        parameterType: ParameterType.BEHAVIOR,
        isAdjustable: true,
      },
    });
    console.log(`   ✓ Created system parameter: ${param.parameterId}`);

    // Create SYSTEM-level target (high standards for system specs)
    await prisma.behaviorTarget.create({
      data: {
        parameterId: param.parameterId,
        scope: BehaviorTargetScope.SYSTEM,
        targetValue: 0.9, // High standard for system-level behaviors
        confidence: 1.0,
        source: "SEED",
      },
    });
  }

  // Create the SYSTEM specs
  for (const spec of systemSpecs) {
    await prisma.analysisSpec.create({
      data: {
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        scope: SpecificationScope.SYSTEM,
        outputType: spec.outputType,
        domain: spec.domain,
        priority: spec.priority,
        isActive: true,
        compiledAt: new Date(),
        isDirty: false,
        triggers: {
          create: spec.triggers.map((t, tIdx) => ({
            name: t.name,
            given: t.given,
            when: t.when,
            then: t.then,
            sortOrder: tIdx,
            actions: {
              create: t.actions.map((a, aIdx) => ({
                description: a.description,
                parameterId: a.parameterId,
                weight: a.weight,
                sortOrder: aIdx,
              })),
            },
          })),
        },
      },
    });
    console.log(`   ✓ Created SYSTEM spec: ${spec.name}`);
  }

  console.log(`\n   ✅ Created ${systemSpecs.length} SYSTEM specs\n`);

  // ============================================
  // SYSTEM PERSONALITY OBSERVATION (OCEAN)
  // ============================================
  console.log("\n🧠 SEEDING OCEAN PERSONALITY SYSTEM SPEC\n");
  console.log("━".repeat(60));

  // Create PERS-* parameters for Big Five personality traits
  const personalityParams = [
    {
      parameterId: "PERS-OPENNESS",
      name: "Openness to Experience",
      definition: "Intellectual curiosity, creativity, preference for novelty and variety",
      interpretationHigh: "Curious, imaginative, open to new ideas and experiences, enjoys abstract thinking",
      interpretationLow: "Practical, conventional, prefers routine and familiar approaches, concrete thinking",
      domainGroup: "big-five",
    },
    {
      parameterId: "PERS-CONSCIENTIOUSNESS",
      name: "Conscientiousness",
      definition: "Organization, dependability, self-discipline, preference for planned behavior",
      interpretationHigh: "Organized, thorough, reliable, goal-oriented, careful and deliberate",
      interpretationLow: "Flexible, spontaneous, may procrastinate, adaptable to changing circumstances",
      domainGroup: "big-five",
    },
    {
      parameterId: "PERS-EXTRAVERSION",
      name: "Extraversion",
      definition: "Sociability, assertiveness, positive emotionality, energy from social interaction",
      interpretationHigh: "Outgoing, energetic, talkative, assertive, enjoys social interaction",
      interpretationLow: "Reserved, reflective, prefers solitary activities, thinks before speaking",
      domainGroup: "big-five",
    },
    {
      parameterId: "PERS-AGREEABLENESS",
      name: "Agreeableness",
      definition: "Cooperation, trust, empathy, concern for social harmony",
      interpretationHigh: "Cooperative, trusting, helpful, empathetic, values getting along with others",
      interpretationLow: "Competitive, skeptical, challenges others, prioritizes self-interest",
      domainGroup: "big-five",
    },
    {
      parameterId: "PERS-NEUROTICISM",
      name: "Neuroticism",
      definition: "Emotional instability, anxiety, moodiness, tendency to experience negative emotions",
      interpretationHigh: "Emotionally reactive, prone to stress and anxiety, experiences mood swings",
      interpretationLow: "Emotionally stable, calm under pressure, resilient to stress",
      domainGroup: "big-five",
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
        domainGroup: param.domainGroup,
        parameterType: ParameterType.TRAIT,
        isAdjustable: false,
      },
    });
    console.log(`   ✓ Created personality parameter: ${param.parameterId}`);
  }

  // Create the OCEAN system spec
  await prisma.analysisSpec.create({
    data: {
      slug: "system-personality-ocean",
      name: "OCEAN Personality Observation",
      description: "Observe Big Five personality traits from conversation: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism",
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.MEASURE,
      domain: "personality",
      priority: 85,
      isActive: true,
      compiledAt: new Date(),
      isDirty: false,
      triggers: {
        create: [
          {
            name: "Personality Signal Detection",
            given: "A conversation between agent and caller",
            when: "The caller's communication reveals personality indicators",
            then: "Assess Big Five personality dimensions based on observable signals",
            sortOrder: 0,
            actions: {
              create: [
                {
                  description: "Assess Openness: curiosity, abstract thinking, novelty-seeking, creativity in responses",
                  parameterId: "PERS-OPENNESS",
                  weight: 1.0,
                  sortOrder: 0,
                },
                {
                  description: "Assess Conscientiousness: organization, detail-orientation, follow-through, planning language",
                  parameterId: "PERS-CONSCIENTIOUSNESS",
                  weight: 1.0,
                  sortOrder: 1,
                },
                {
                  description: "Assess Extraversion: energy, talkativeness, enthusiasm, social engagement style",
                  parameterId: "PERS-EXTRAVERSION",
                  weight: 1.0,
                  sortOrder: 2,
                },
                {
                  description: "Assess Agreeableness: cooperation, trust signals, empathy, conflict avoidance",
                  parameterId: "PERS-AGREEABLENESS",
                  weight: 1.0,
                  sortOrder: 3,
                },
                {
                  description: "Assess Neuroticism: anxiety signals, emotional reactivity, stress indicators, mood stability",
                  parameterId: "PERS-NEUROTICISM",
                  weight: 1.0,
                  sortOrder: 4,
                },
              ],
            },
          },
        ],
      },
    },
  });
  console.log(`   ✓ Created SYSTEM spec: OCEAN Personality Observation`);

  console.log(`\n   ✅ Created OCEAN personality spec with 5 parameters\n`);
}

async function seedSampleData() {
  console.log("\n👥 SEEDING SAMPLE CALLERS & CALLS\n");
  console.log("━".repeat(60));

  // Get domains for assigning callers
  const tutorDomain = await prisma.domain.findUnique({ where: { slug: "wwii-tutor" } });
  const companionDomain = await prisma.domain.findUnique({ where: { slug: "companion" } });

  // Sample callers
  const callers: Array<{ name: string; email: string; domainId: string | undefined; calls: Array<{ transcript: string }> }> = [
    {
      name: "Alex Thompson",
      email: "alex.thompson@example.com",
      domainId: tutorDomain?.id,
      calls: [
        {
          transcript: `Caller: Hi, I'm studying for my history exam and I need help understanding the causes of World War II.
Agent: I'd be happy to help you understand the causes of WWII! This is a fascinating and complex topic. Let's start with the major factors. What do you already know about the lead-up to the war?
Caller: I know it started in 1939 when Germany invaded Poland, but I'm not sure why that happened.
Agent: Good starting point! The invasion of Poland was indeed the immediate trigger, but the underlying causes go much deeper. Think of it like layers of an onion. The Treaty of Versailles in 1919 left Germany economically devastated and humiliated. How do you think that might have affected the German people?
Caller: I guess they would have been angry and resentful?
Agent: Exactly! That resentment created fertile ground for extremist ideologies. Hitler and the Nazi Party promised to restore German pride and reverse the "unfair" treaty terms. Can you see how economic hardship and national humiliation might make people more receptive to radical solutions?
Caller: Yes, that makes sense. So it wasn't just one thing but many factors building up?
Agent: Precisely! You're grasping the complexity well. The Great Depression, the failure of the League of Nations, appeasement policies, and territorial expansion all played roles. Would you like me to explain any of these in more detail?`,
        },
        {
          transcript: `Caller: Can you help me understand the difference between the European and Pacific theaters of WWII?
Agent: Absolutely! This is a great question because WWII was truly a global conflict with distinct characteristics in different regions. Let me paint a picture for you. When you hear "European theater," what images come to mind?
Caller: Trenches? Like WWI?
Agent: Interesting association! Actually, WWII in Europe was quite different from WWI. It was characterized by "Blitzkrieg" or lightning war - fast-moving tank divisions and air support. The static trench warfare of WWI gave way to rapid mechanized movement. The Pacific theater was even more different. Can you guess how fighting across thousands of ocean miles might be different?
Caller: Ships and planes I guess? Island hopping?
Agent: You've got it! The Pacific war was dominated by naval and air power. The "island hopping" strategy you mentioned was key - capturing strategic islands to build airbases closer to Japan. The terrain, climate, and logistics were completely different challenges. What aspect would you like to explore further?`,
        },
      ],
    },
    {
      name: "Maria Garcia",
      email: "maria.garcia@example.com",
      domainId: companionDomain?.id,
      calls: [
        {
          transcript: `Caller: Good morning! I was just thinking about my garden this morning. The tomatoes are finally turning red.
Agent: Good morning! Oh, how wonderful - there's something so satisfying about watching tomatoes ripen, isn't there? That moment when they finally start showing color after all that waiting. Do you have a particular variety you're growing this year?
Caller: I've got some beefsteaks and cherry tomatoes. My husband Bill always used to handle the garden, but since he passed two years ago, I've been learning as I go.
Agent: That's quite a journey you've been on, Maria. Taking on something that was Bill's domain and making it your own - that takes real courage. I imagine the garden holds a lot of memories. How does it feel to be tending it now?
Caller: It's bittersweet, honestly. Sometimes I feel closer to him out there. He had his own way of doing things that I'm still figuring out.
Agent: That makes so much sense. The garden becomes a place of connection, doesn't it? Learning his rhythms, his methods - it's like having a conversation with his memory. The beefsteaks sound wonderful. Those take patience to grow well. Were those Bill's favorites too?
Caller: Yes! He loved a good BLT with thick slices of beefsteak tomato. I might make one this week in his honor.
Agent: What a beautiful way to honor him - through something you've grown with your own hands, in the garden he loved. There's something profound about that connection through food and growing things.`,
        },
      ],
    },
    {
      name: "James Chen",
      email: "james.chen@example.com",
      domainId: tutorDomain?.id,
      calls: [
        {
          transcript: `Caller: I have a paper due on the role of technology in WWII. Where should I start?
Agent: Great topic! Technology transformed warfare in WWII in ways that still affect us today. Before we dive in, let me ask - what's the main argument or thesis you're considering for your paper?
Caller: I was thinking about how technology made the war more destructive, but I'm not sure if that's too obvious.
Agent: That's actually a solid foundation, but you're right that it could be developed further. What if we explored not just the destructive aspects, but how technology shaped the strategies and outcomes? For instance, radar didn't just create new weapons - it fundamentally changed how battles were planned and fought. Does that angle interest you?
Caller: Yes! I hadn't thought about the strategic impact.
Agent: Perfect. Let's think about key technologies: radar, encryption (like Enigma), aircraft carriers, tanks, and of course, the atomic bomb. Each one didn't just add firepower - it changed the rules of engagement. Which of these would you like to explore for your paper?
Caller: The Enigma and codebreaking sounds fascinating.
Agent: Excellent choice! The intelligence war is sometimes called the "invisible battlefield." Alan Turing's work at Bletchley Park is estimated to have shortened the war by years. What do you know about how codebreaking actually worked?`,
        },
      ],
    },
    {
      name: "Eleanor Wright",
      email: "eleanor.wright@example.com",
      domainId: companionDomain?.id,
      calls: [
        {
          transcript: `Caller: I've been feeling a bit isolated lately. My children live across the country and I don't get to see them often.
Agent: I hear you, Eleanor. That physical distance from family can create such a profound sense of absence, especially when you're used to having them closer. When did you last see them in person?
Caller: My daughter visited for Thanksgiving, so it's been about eight months now. We video call, but it's not quite the same.
Agent: No, it really isn't the same, is it? There's something about being in the same room - sharing a meal, the casual touch on the shoulder, the unplanned conversations that happen when you're just existing together. Video calls are wonderful for staying connected, but they can also highlight what we're missing. How are you feeling about the upcoming holidays?
Caller: Anxious, honestly. They can't make it this year. Work commitments.
Agent: That's a hard thing to sit with - the anticipation of a holiday that won't have the people you most want to be with. Your feelings make complete sense. Have you thought about what might make the season meaningful for you, even without them physically present?
Caller: I hadn't really thought about it. I've just been dreading it.
Agent: That's understandable. Sometimes acknowledging the dread is the first step. You know, many people in similar situations find ways to create new traditions or connections. It doesn't replace family, but it can add different kinds of warmth. Would you be open to exploring some possibilities together?`,
        },
        {
          transcript: `Caller: Remember we talked about the holidays? I ended up volunteering at the community center for their Christmas dinner.
Agent: Eleanor! That's wonderful to hear! How did it go? I remember you were feeling anxious about the season.
Caller: It was actually lovely. I met the most interesting woman named Dorothy - she's 82 and she's been traveling solo since her 70th birthday. Can you imagine?
Agent: What a remarkable person to meet! There's something inspiring about someone who chooses adventure at any age. It sounds like Dorothy made quite an impression on you. What was it about her stories that resonated?
Caller: She just has this zest for life. She told me about hiking in Scotland last year. Made me think maybe I've been too cautious.
Agent: That's a powerful reflection. Sometimes meeting someone who lives differently can hold up a mirror to our own choices. The word "cautious" is interesting - it can mean wise and protective, but it can also mean holding back from things we might enjoy. What do you think you've been cautious about?
Caller: Everything, really. Since George died, I've been just... existing. Not really living.
Agent: That's a profound and honest recognition, Eleanor. Grief can create a kind of protective shell - it makes sense as a way to survive the hardest parts. But it sounds like something in you is ready to peek out from that shell. Dorothy's stories might be showing you a possibility. What would "living" look like for you, if you let yourself imagine it?`,
        },
      ],
    },
  ];

  for (const callerData of callers) {
    // Create caller
    const caller = await prisma.caller.create({
      data: {
        name: callerData.name,
        email: callerData.email,
        domainId: callerData.domainId || null,
      },
    });
    console.log(`   ✓ Created caller: ${callerData.name}`);

    // Create calls for this caller
    let callSequence = 1;
    let previousCallId: string | null = null;

    for (const callData of callerData.calls) {
      const createdCall: { id: string } = await prisma.call.create({
        data: {
          source: "seed",
          externalId: `seed-${caller.id}-${callSequence}`,
          callerId: caller.id,
          transcript: callData.transcript,
          callSequence: callSequence,
          previousCallId: previousCallId,
        },
      });
      console.log(`      ✓ Created call ${callSequence} for ${callerData.name}`);

      previousCallId = createdCall.id;
      callSequence++;
    }
  }

  const totalCallers = callers.length;
  const totalCalls = callers.reduce((sum, c) => sum + c.calls.length, 0);
  console.log(`\n   ✅ Created ${totalCallers} callers with ${totalCalls} calls\n`);
}

async function runSeed(seedFile: string) {
  console.log(`\n▶️  Running ${seedFile}\n`);
  console.log("━".repeat(60));

  try {
    execSync(`npx tsx prisma/${seedFile}`, {
      cwd: "/Users/paulwander/projects/HF/apps/admin",
      stdio: "inherit",
    });
  } catch (e: any) {
    console.error(`   ❌ Error running ${seedFile}: ${e.message}`);
    throw e;
  }
}

async function main() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║           MASTER SEED - COMPLETE DATA SETUP               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // Step 1: Clear all data
  await clearAllData();

  // Step 2: Seed core parameters
  await seedCoreParameters();

  // Step 3: Seed SYSTEM specs (guardrails, safety, quality)
  await seedSystemSpecs();

  // Step 4: Run WWII Tutor seed (DOMAIN specs for tutor domain)
  await runSeed("seed-wwii-tutor.ts");

  // Step 5: Run Companion seed (DOMAIN specs for companion domain)
  await runSeed("seed-companion.ts");

  // Step 6: Seed sample callers and calls
  await seedSampleData();

  // Final summary
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                    SEED COMPLETE                           ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const domainCount = await prisma.domain.count();
  const playbookCount = await prisma.playbook.count();
  const specCount = await prisma.analysisSpec.count();
  const callerSpecCount = await prisma.analysisSpec.count({ where: { scope: "CALLER" } });
  const domainSpecCount = await prisma.analysisSpec.count({ where: { scope: "DOMAIN" } });
  const systemSpecCount = await prisma.analysisSpec.count({ where: { scope: "SYSTEM" } });
  const paramCount = await prisma.parameter.count();
  const templateCount = await prisma.promptTemplate.count();
  const targetCount = await prisma.behaviorTarget.count();
  const callerCount = await prisma.caller.count();
  const callCount = await prisma.call.count();

  console.log("\nFinal database state:\n");
  console.log(`   🌐 Domains: ${domainCount}`);
  console.log(`   📚 Playbooks: ${playbookCount}`);
  console.log(`   🎯 Analysis Specs: ${specCount} total`);
  console.log(`      └─ CALLER: ${callerSpecCount}`);
  console.log(`      └─ DOMAIN: ${domainSpecCount}`);
  console.log(`      └─ SYSTEM: ${systemSpecCount}`);
  console.log(`   📐 Parameters: ${paramCount}`);
  console.log(`   📝 Prompt Templates: ${templateCount}`);
  console.log(`   🎚️  Behavior Targets: ${targetCount}`);
  console.log(`   👥 Callers: ${callerCount}`);
  console.log(`   📞 Calls: ${callCount}`);

  console.log("\n✅ All seeds complete!\n");
  console.log("View at: http://localhost:3000/playbooks\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
