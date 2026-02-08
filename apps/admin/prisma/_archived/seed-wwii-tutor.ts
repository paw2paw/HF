/**
 * WWII History Tutor - Complete Seed
 *
 * Run with: npx tsx prisma/seed-wwii-tutor.ts
 *
 * Creates a complete tutoring domain with:
 * - Domain: wwii-tutor
 * - Playbook with behavior targets optimized for tutoring
 * - CALLER specs for measuring learner engagement, comprehension, curiosity
 * - DOMAIN specs for tutoring-specific behaviors (Socratic questioning, scaffolding)
 * - Prompt template for the tutor persona
 */

import {
  PrismaClient,
  SpecificationScope,
  AnalysisOutputType,
  MemoryCategory,
  ParameterType,
  BehaviorTargetScope,
  PlaybookStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n📚 WWII HISTORY TUTOR - COMPLETE SEED\n");
  console.log("━".repeat(60));

  // ============================================
  // STEP 1: CLEANUP
  // ============================================
  console.log("\nSTEP 1: Cleanup existing WWII tutor data\n");

  // Delete existing domain and related data
  const existingDomain = await prisma.domain.findUnique({
    where: { slug: "wwii-tutor" },
  });

  if (existingDomain) {
    // Delete playbooks
    const playbooks = await prisma.playbook.findMany({
      where: { domainId: existingDomain.id },
    });
    for (const pb of playbooks) {
      await prisma.behaviorTarget.deleteMany({ where: { playbookId: pb.id } });
      await prisma.playbookItem.deleteMany({ where: { playbookId: pb.id } });
      await prisma.playbook.delete({ where: { id: pb.id } });
    }
    await prisma.domain.delete({ where: { id: existingDomain.id } });
    console.log("   🗑️  Deleted existing wwii-tutor domain");
  }

  // Delete existing specs
  const specSlugs = [
    // CALLER specs
    "tutor-learner-engagement",
    "tutor-comprehension-level",
    "tutor-curiosity-indicators",
    "tutor-learning-style",
    "tutor-knowledge-gaps",
    "tutor-emotional-state",
    // DOMAIN specs
    "tutor-socratic-method",
    "tutor-scaffolding",
    "tutor-explanation-clarity",
    "tutor-encouragement",
    "tutor-misconception-handling",
    "tutor-pace-adaptation",
  ];

  for (const slug of specSlugs) {
    const spec = await prisma.analysisSpec.findUnique({ where: { slug } });
    if (spec) {
      const triggers = await prisma.analysisTrigger.findMany({
        where: { specId: spec.id },
      });
      for (const t of triggers) {
        await prisma.analysisAction.deleteMany({ where: { triggerId: t.id } });
      }
      await prisma.analysisTrigger.deleteMany({ where: { specId: spec.id } });
      await prisma.analysisSpec.delete({ where: { id: spec.id } });
      console.log(`   🗑️  Deleted spec: ${slug}`);
    }
  }

  // Delete tutor prompt template
  const existingTemplate = await prisma.promptTemplate.findUnique({
    where: { slug: "wwii-tutor-persona" },
  });
  if (existingTemplate) {
    await prisma.promptTemplate.delete({ where: { id: existingTemplate.id } });
    console.log("   🗑️  Deleted existing prompt template");
  }

  // ============================================
  // STEP 2: TUTOR-SPECIFIC PARAMETERS
  // ============================================
  console.log("\n" + "━".repeat(60));
  console.log("STEP 2: Create tutor-specific parameters\n");

  // STATE parameters (measured per call)
  const stateParams = [
    {
      parameterId: "TUTOR-ENGAGEMENT",
      name: "Learner Engagement",
      definition: "How engaged and attentive the learner is during the tutoring session",
      interpretationHigh: "Learner is highly engaged, asking questions, making connections",
      interpretationLow: "Learner seems distracted, giving minimal responses, not invested",
      domainGroup: "learning",
    },
    {
      parameterId: "TUTOR-COMPREHENSION",
      name: "Comprehension Level",
      definition: "How well the learner understands the material being discussed",
      interpretationHigh: "Learner demonstrates clear understanding, can explain concepts back",
      interpretationLow: "Learner shows confusion, asks basic questions, makes errors",
      domainGroup: "learning",
    },
    {
      parameterId: "TUTOR-CURIOSITY",
      name: "Curiosity Level",
      definition: "How curious and eager to learn more the learner appears",
      interpretationHigh: "Asks probing questions, wants to explore tangents, seeks deeper understanding",
      interpretationLow: "Only answers direct questions, no initiative to explore further",
      domainGroup: "learning",
    },
    {
      parameterId: "TUTOR-FRUSTRATION",
      name: "Frustration Level",
      definition: "Signs of frustration or discouragement in the learner",
      interpretationHigh: "Shows signs of frustration, self-doubt, wanting to give up",
      interpretationLow: "Calm, patient, accepting of challenges as part of learning",
      domainGroup: "emotional",
    },
    {
      parameterId: "TUTOR-CONFIDENCE",
      name: "Learner Confidence",
      definition: "How confident the learner feels about the material",
      interpretationHigh: "Answers confidently, willing to take intellectual risks",
      interpretationLow: "Hesitant, unsure, seeks constant validation",
      domainGroup: "emotional",
    },
  ];

  for (const param of stateParams) {
    const existing = await prisma.parameter.findUnique({
      where: { parameterId: param.parameterId },
    });
    if (!existing) {
      await prisma.parameter.create({
        data: {
          parameterId: param.parameterId,
          name: param.name,
          definition: param.definition,
          interpretationHigh: param.interpretationHigh,
          interpretationLow: param.interpretationLow,
          scaleType: "0-1",
          directionality: param.parameterId === "TUTOR-FRUSTRATION" ? "lower_better" : "higher_better",
          computedBy: "measured",
          sectionId: "tutor",
          domainGroup: param.domainGroup,
          parameterType: ParameterType.STATE,
          isAdjustable: false,
        },
      });
      console.log(`   ✓ Created STATE param: ${param.parameterId}`);
    } else {
      console.log(`   ⏭️  Param exists: ${param.parameterId}`);
    }
  }

  // BEHAVIOR parameters for tutoring (some may already exist from architecture seed)
  const tutorBehaviorParams = [
    {
      parameterId: "BEH-SOCRATIC",
      name: "Socratic Questioning",
      definition: "How much the tutor uses questions to guide learning vs direct explanation",
      domainGroup: "pedagogy",
    },
    {
      parameterId: "BEH-SCAFFOLDING",
      name: "Scaffolding Level",
      definition: "How much support and structure the tutor provides",
      domainGroup: "pedagogy",
    },
    {
      parameterId: "BEH-ENCOURAGEMENT",
      name: "Encouragement Rate",
      definition: "How often the tutor provides positive reinforcement and encouragement",
      domainGroup: "emotional-support",
    },
    {
      parameterId: "BEH-DETAIL-LEVEL",
      name: "Explanation Detail",
      definition: "How detailed and thorough explanations are",
      domainGroup: "communication",
    },
    {
      parameterId: "BEH-HISTORICAL-CONTEXT",
      name: "Historical Context Depth",
      definition: "How much broader historical context is provided around specific events",
      domainGroup: "content",
    },
  ];

  for (const param of tutorBehaviorParams) {
    const existing = await prisma.parameter.findUnique({
      where: { parameterId: param.parameterId },
    });
    if (!existing) {
      await prisma.parameter.create({
        data: {
          parameterId: param.parameterId,
          name: param.name,
          definition: param.definition,
          scaleType: "0-1",
          directionality: "neutral",
          computedBy: "measured",
          sectionId: "tutor-behavior",
          domainGroup: param.domainGroup,
          parameterType: ParameterType.BEHAVIOR,
          isAdjustable: true,
        },
      });
      console.log(`   ✓ Created BEHAVIOR param: ${param.parameterId}`);

      // Create SYSTEM-level target for new behavior params
      await prisma.behaviorTarget.create({
        data: {
          parameterId: param.parameterId,
          scope: BehaviorTargetScope.SYSTEM,
          targetValue: 0.5,
          confidence: 1.0,
          source: "SEED",
        },
      });
      console.log(`   ✓ Created SYSTEM target: ${param.parameterId} = 0.5`);
    } else {
      console.log(`   ⏭️  Param exists: ${param.parameterId}`);
    }
  }

  // ============================================
  // STEP 3: DOMAIN SPECS (Measure Learner)
  // ============================================
  // Note: These are DOMAIN-scoped, not CALLER-scoped. CALLER specs are
  // auto-generated by the learning system only, never manually created.
  console.log("\n" + "━".repeat(60));
  console.log("STEP 3: Create DOMAIN specs (measure the learner)\n");

  const callerSpecs = [
    {
      slug: "tutor-learner-engagement",
      name: "Learner Engagement Analysis",
      description: "Measures how engaged and invested the learner is in the tutoring session",
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.MEASURE,
      domain: "learning",
      priority: 90,
      triggers: [
        {
          name: "Engagement indicators",
          given: "A learner is participating in a WWII history tutoring session",
          when: "The learner responds to tutor questions or prompts",
          then: "Measure engagement level based on response quality and initiative",
          actions: [
            {
              description: "Measure overall engagement: Are they asking follow-up questions? Showing interest? Making connections to other knowledge?",
              parameterId: "TUTOR-ENGAGEMENT",
              weight: 1.0,
            },
          ],
        },
      ],
    },
    {
      slug: "tutor-comprehension-level",
      name: "Comprehension Assessment",
      description: "Evaluates how well the learner understands the WWII concepts being discussed",
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.MEASURE,
      domain: "learning",
      priority: 95,
      triggers: [
        {
          name: "Comprehension check",
          given: "The tutor has explained a WWII concept or event",
          when: "The learner demonstrates understanding or asks clarifying questions",
          then: "Assess comprehension depth",
          actions: [
            {
              description: "Measure comprehension: Can they summarize? Do they ask relevant questions? Are their responses accurate?",
              parameterId: "TUTOR-COMPREHENSION",
              weight: 1.0,
            },
          ],
        },
      ],
    },
    {
      slug: "tutor-curiosity-indicators",
      name: "Curiosity & Initiative Tracking",
      description: "Tracks learner curiosity and self-directed learning behaviors",
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.MEASURE,
      domain: "learning",
      priority: 80,
      triggers: [
        {
          name: "Curiosity signals",
          given: "A learner is exploring WWII topics",
          when: "The learner asks questions beyond the immediate topic or seeks connections",
          then: "Measure curiosity and intellectual initiative",
          actions: [
            {
              description: "Measure curiosity: Do they want to know 'why'? Do they ask about related topics? Do they make hypotheses?",
              parameterId: "TUTOR-CURIOSITY",
              weight: 1.0,
            },
          ],
        },
      ],
    },
    {
      slug: "tutor-emotional-state",
      name: "Learner Emotional State",
      description: "Monitors frustration, confidence, and emotional engagement",
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.MEASURE,
      domain: "emotional",
      priority: 85,
      triggers: [
        {
          name: "Emotional assessment",
          given: "A learner is working through challenging WWII material",
          when: "The learner shows emotional signals in their responses",
          then: "Assess emotional state to guide tutoring approach",
          actions: [
            {
              description: "Measure frustration: Signs of giving up, self-deprecation, impatience",
              parameterId: "TUTOR-FRUSTRATION",
              weight: 1.0,
            },
            {
              description: "Measure confidence: Willingness to guess, certainty in answers, intellectual risk-taking",
              parameterId: "TUTOR-CONFIDENCE",
              weight: 1.0,
            },
          ],
        },
      ],
    },
    {
      slug: "tutor-knowledge-gaps",
      name: "Knowledge Gap Detection",
      description: "Identifies specific areas where the learner lacks knowledge or has misconceptions",
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.LEARN,
      domain: "learning",
      priority: 88,
      triggers: [
        {
          name: "Gap identification",
          given: "A learner is discussing WWII topics",
          when: "The learner reveals gaps in knowledge or misconceptions",
          then: "Record the knowledge gap for targeted instruction",
          actions: [
            {
              description: "Extract knowledge gap: What specific fact, concept, or connection is the learner missing?",
              learnCategory: MemoryCategory.FACT,
              learnKeyPrefix: "knowledge_gap_",
              weight: 1.0,
            },
            {
              description: "Extract misconception: What incorrect belief does the learner hold about WWII?",
              learnCategory: MemoryCategory.FACT,
              learnKeyPrefix: "misconception_",
              weight: 1.0,
            },
          ],
        },
      ],
    },
    {
      slug: "tutor-learning-style",
      name: "Learning Style Preferences",
      description: "Detects learner preferences for how information is presented",
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.LEARN,
      domain: "learning",
      priority: 70,
      triggers: [
        {
          name: "Style detection",
          given: "A learner engages with different types of explanations",
          when: "The learner shows preference for certain explanation styles",
          then: "Record learning style preference",
          actions: [
            {
              description: "Extract preference: Does learner prefer stories/narratives, timelines, cause-effect analysis, or character studies?",
              learnCategory: MemoryCategory.PREFERENCE,
              learnKeyPrefix: "learning_style_",
              weight: 1.0,
            },
            {
              description: "Extract topic interests: Which WWII topics excite this learner most?",
              learnCategory: MemoryCategory.TOPIC,
              learnKeyPrefix: "wwii_interest_",
              weight: 0.8,
            },
          ],
        },
      ],
    },
  ];

  for (const spec of callerSpecs) {
    const created = await prisma.analysisSpec.create({
      data: {
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        scope: spec.scope,
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
              create: t.actions.map((a: any, aIdx) => ({
                description: a.description,
                parameterId: a.parameterId || null,
                learnCategory: a.learnCategory || null,
                learnKeyPrefix: a.learnKeyPrefix || null,
                weight: a.weight,
                sortOrder: aIdx,
              })),
            },
          })),
        },
      },
    });
    console.log(`   ✓ Created CALLER spec: ${spec.name}`);
  }

  // ============================================
  // STEP 4: DOMAIN SPECS (Measure/Guide Tutor)
  // ============================================
  console.log("\n" + "━".repeat(60));
  console.log("STEP 4: Create DOMAIN specs (guide tutor behavior)\n");

  const domainSpecs = [
    {
      slug: "tutor-socratic-method",
      name: "Socratic Method Application",
      description: "Measures how well the tutor uses Socratic questioning to guide learning",
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.MEASURE_AGENT,
      domain: "pedagogy",
      priority: 95,
      triggers: [
        {
          name: "Socratic questioning assessment",
          given: "The tutor is helping a learner understand a WWII concept",
          when: "The tutor responds to learner questions or introduces new material",
          then: "Evaluate use of Socratic method vs direct explanation",
          actions: [
            {
              description: "Measure Socratic questioning: Does the tutor ask guiding questions instead of giving answers directly? Does the tutor help the learner discover insights?",
              parameterId: "BEH-SOCRATIC",
              weight: 1.0,
            },
            {
              description: "Measure question rate: How often does the tutor ask questions to check understanding or prompt thinking?",
              parameterId: "BEH-QUESTION-RATE",
              weight: 0.8,
            },
          ],
        },
      ],
    },
    {
      slug: "tutor-scaffolding",
      name: "Scaffolding & Support Level",
      description: "Evaluates appropriate scaffolding based on learner needs",
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.MEASURE_AGENT,
      domain: "pedagogy",
      priority: 90,
      triggers: [
        {
          name: "Scaffolding assessment",
          given: "The learner is working through challenging WWII material",
          when: "The tutor provides support or breaks down complex topics",
          then: "Evaluate scaffolding appropriateness",
          actions: [
            {
              description: "Measure scaffolding: Does the tutor break down complex events into manageable pieces? Does support match learner level?",
              parameterId: "BEH-SCAFFOLDING",
              weight: 1.0,
            },
            {
              description: "Measure detail level: Are explanations appropriately detailed for this learner's level?",
              parameterId: "BEH-DETAIL-LEVEL",
              weight: 0.8,
            },
          ],
        },
      ],
    },
    {
      slug: "tutor-explanation-clarity",
      name: "Explanation Clarity",
      description: "Measures how clearly the tutor explains WWII events and concepts",
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.MEASURE_AGENT,
      domain: "communication",
      priority: 85,
      triggers: [
        {
          name: "Clarity assessment",
          given: "The tutor is explaining WWII events, causes, or consequences",
          when: "The tutor provides explanations or answers questions",
          then: "Evaluate explanation clarity and appropriateness",
          actions: [
            {
              description: "Measure directness: Are explanations clear and to the point while remaining age-appropriate?",
              parameterId: "BEH-DIRECTNESS",
              weight: 1.0,
            },
            {
              description: "Measure historical context: Does the tutor provide enough background to make events meaningful?",
              parameterId: "BEH-HISTORICAL-CONTEXT",
              weight: 0.9,
            },
          ],
        },
      ],
    },
    {
      slug: "tutor-encouragement",
      name: "Encouragement & Motivation",
      description: "Evaluates how well the tutor encourages and motivates the learner",
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.MEASURE_AGENT,
      domain: "emotional-support",
      priority: 88,
      triggers: [
        {
          name: "Encouragement assessment",
          given: "The learner attempts to answer questions or engage with difficult material",
          when: "The tutor responds to learner efforts",
          then: "Evaluate encouragement and positive reinforcement",
          actions: [
            {
              description: "Measure encouragement: Does the tutor praise effort and progress? Does the tutor help build confidence?",
              parameterId: "BEH-ENCOURAGEMENT",
              weight: 1.0,
            },
            {
              description: "Measure warmth: Is the tutor warm and supportive in their communication style?",
              parameterId: "BEH-WARMTH",
              weight: 0.8,
            },
            {
              description: "Measure empathy: Does the tutor acknowledge when material is challenging?",
              parameterId: "BEH-EMPATHY-RATE",
              weight: 0.7,
            },
          ],
        },
      ],
    },
    {
      slug: "tutor-misconception-handling",
      name: "Misconception Correction",
      description: "Evaluates how the tutor addresses learner misconceptions about WWII",
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.MEASURE_AGENT,
      domain: "pedagogy",
      priority: 92,
      triggers: [
        {
          name: "Misconception handling",
          given: "The learner expresses a misconception about WWII events or causes",
          when: "The tutor addresses the misconception",
          then: "Evaluate correction approach - gentle guidance vs direct correction",
          actions: [
            {
              description: "Measure proactivity: Does the tutor gently guide toward correct understanding rather than bluntly correcting?",
              parameterId: "BEH-PROACTIVE",
              weight: 1.0,
            },
            {
              description: "Measure Socratic approach: Does the tutor use questions to help learner discover the error themselves?",
              parameterId: "BEH-SOCRATIC",
              weight: 0.9,
            },
          ],
        },
      ],
    },
    {
      slug: "tutor-pace-adaptation",
      name: "Pace Adaptation",
      description: "Evaluates how well the tutor adapts pace to learner needs",
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.MEASURE_AGENT,
      domain: "adaptability",
      priority: 80,
      triggers: [
        {
          name: "Pace assessment",
          given: "The tutoring session progresses through WWII topics",
          when: "The tutor moves between topics or adjusts depth of coverage",
          then: "Evaluate pace matching to learner comprehension and engagement",
          actions: [
            {
              description: "Measure pace matching: Does the tutor slow down when learner struggles? Speed up when mastery is shown?",
              parameterId: "BEH-PACE-MATCH",
              weight: 1.0,
            },
          ],
        },
      ],
    },
  ];

  for (const spec of domainSpecs) {
    const created = await prisma.analysisSpec.create({
      data: {
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        scope: spec.scope,
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
              create: t.actions.map((a: any, aIdx) => ({
                description: a.description,
                parameterId: a.parameterId || null,
                weight: a.weight,
                sortOrder: aIdx,
              })),
            },
          })),
        },
      },
    });
    console.log(`   ✓ Created DOMAIN spec: ${spec.name}`);
  }

  // ============================================
  // STEP 5: PROMPT TEMPLATE
  // ============================================
  console.log("\n" + "━".repeat(60));
  console.log("STEP 5: Create WWII Tutor prompt template\n");

  const promptTemplate = await prisma.promptTemplate.create({
    data: {
      slug: "wwii-tutor-persona",
      name: "WWII History Tutor",
      version: "1.0",
      description: "A patient, knowledgeable WWII history tutor that adapts to learner needs",
      systemPrompt: `You are an expert World War II history tutor. Your role is to help learners understand this pivotal period in human history through engaging, educational conversations.

## Your Approach

**Teaching Philosophy:**
- Use the Socratic method when appropriate - guide learners to discover insights rather than simply telling them
- Break complex events into understandable pieces
- Connect events to their causes and consequences
- Use stories and human experiences to make history come alive
- Acknowledge the moral complexity of this period while remaining educational

**Content Expertise:**
You have deep knowledge of:
- Major theaters: European, Pacific, North African, Eastern Front
- Key events: Rise of fascism, major battles, D-Day, Holocaust, atomic bombs
- Important figures: Political leaders, military commanders, resistance fighters
- Home front: Rationing, propaganda, women in workforce, internment
- Causes and consequences: Treaty of Versailles, Cold War origins

**Adaptation:**
{{#if personality.openness_high}}
This learner is curious and open - feel free to explore tangents and deeper context.
{{/if}}
{{#if personality.openness_low}}
This learner prefers focused, structured information - stay on topic and be direct.
{{/if}}

{{#if memories.knowledge_gaps}}
**Known gaps to address:** {{memories.knowledge_gaps}}
{{/if}}

{{#if memories.misconceptions}}
**Misconceptions to gently correct:** {{memories.misconceptions}}
{{/if}}

{{#if memories.wwii_interests}}
**Topics this learner finds engaging:** {{memories.wwii_interests}}
{{/if}}

## Communication Style

- Be warm and encouraging, especially when learners struggle
- Celebrate curiosity and good questions
- Use age-appropriate language
- Include specific dates, names, and details to build historical literacy
- When correcting misconceptions, be gentle and guide toward understanding
- Ask questions to check comprehension before moving on`,
      personalityModifiers: {
        openness: {
          high: "Encourage exploration of related topics, historiographical debates, and primary sources",
          low: "Keep explanations structured and focused on core facts",
        },
        conscientiousness: {
          high: "Provide detailed timelines and organized frameworks for understanding events",
          low: "Use more narrative and story-based approaches",
        },
        extraversion: {
          high: "Engage in more dialogue, ask more questions, discuss different perspectives",
          low: "Provide clear explanations with space for reflection",
        },
        agreeableness: {
          high: "Emphasize human stories, sacrifices, and moral dimensions",
          low: "Focus more on strategic and analytical aspects",
        },
        neuroticism: {
          high: "Be extra encouraging, break material into smaller pieces, celebrate progress",
          low: "Can handle more challenging material and direct feedback",
        },
      },
      isActive: true,
    },
  });
  console.log(`   ✓ Created prompt template: ${promptTemplate.name}`);

  // ============================================
  // STEP 6: DOMAIN + PLAYBOOK
  // ============================================
  console.log("\n" + "━".repeat(60));
  console.log("STEP 6: Create Domain and Playbook with targets\n");

  // Create domain
  const domain = await prisma.domain.create({
    data: {
      slug: "wwii-tutor",
      name: "WWII History Tutor",
      description: "An engaging history tutor specialized in World War II education",
      isDefault: false,
      isActive: true,
    },
  });
  console.log(`   ✓ Created domain: ${domain.name}`);

  // Create playbook
  const playbook = await prisma.playbook.create({
    data: {
      name: "WWII Tutor Playbook v1",
      description: "Optimized for educational tutoring with Socratic method, scaffolding, and learner adaptation",
      domainId: domain.id,
      status: PlaybookStatus.DRAFT,
      version: "1.0",
    },
  });
  console.log(`   ✓ Created playbook: ${playbook.name}`);

  // Add all CALLER specs to playbook
  const createdCallerSpecs = await prisma.analysisSpec.findMany({
    where: { slug: { in: callerSpecs.map(s => s.slug) } },
    orderBy: { priority: "desc" },
  });

  // Add all DOMAIN specs to playbook
  const createdDomainSpecs = await prisma.analysisSpec.findMany({
    where: { slug: { in: domainSpecs.map(s => s.slug) } },
    orderBy: { priority: "desc" },
  });

  // Add specs and template as playbook items
  let sortOrder = 0;

  // Add CALLER specs first (measure learner)
  for (const spec of createdCallerSpecs) {
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
  console.log(`   ✓ Added ${createdCallerSpecs.length} CALLER specs to playbook`);

  // Add DOMAIN specs (guide tutor)
  for (const spec of createdDomainSpecs) {
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
  console.log(`   ✓ Added ${createdDomainSpecs.length} DOMAIN specs to playbook`);

  // Add prompt template
  await prisma.playbookItem.create({
    data: {
      playbookId: playbook.id,
      itemType: "PROMPT_TEMPLATE",
      promptTemplateId: promptTemplate.id,
      isEnabled: true,
      sortOrder: sortOrder++,
    },
  });
  console.log(`   ✓ Added prompt template to playbook`);

  // Set PLAYBOOK-level behavior targets (optimized for tutoring)
  const tutorTargets = [
    // Core behavior from architecture seed
    { parameterId: "BEH-WARMTH", targetValue: 0.75 },          // Warm and supportive
    { parameterId: "BEH-EMPATHY-RATE", targetValue: 0.7 },     // Empathetic to struggles
    { parameterId: "BEH-FORMALITY", targetValue: 0.4 },        // Conversational, not stiff
    { parameterId: "BEH-DIRECTNESS", targetValue: 0.5 },       // Balanced - not too indirect
    { parameterId: "BEH-PROACTIVE", targetValue: 0.7 },        // Proactive guidance
    { parameterId: "BEH-QUESTION-RATE", targetValue: 0.8 },    // High - Socratic method
    { parameterId: "BEH-PACE-MATCH", targetValue: 0.85 },      // Very responsive to learner pace

    // Tutor-specific behavior
    { parameterId: "BEH-SOCRATIC", targetValue: 0.75 },        // Strong Socratic approach
    { parameterId: "BEH-SCAFFOLDING", targetValue: 0.7 },      // Good scaffolding
    { parameterId: "BEH-ENCOURAGEMENT", targetValue: 0.8 },    // High encouragement
    { parameterId: "BEH-DETAIL-LEVEL", targetValue: 0.65 },    // Moderately detailed
    { parameterId: "BEH-HISTORICAL-CONTEXT", targetValue: 0.7 }, // Good context
  ];

  for (const target of tutorTargets) {
    // Check if parameter exists
    const param = await prisma.parameter.findUnique({
      where: { parameterId: target.parameterId },
    });

    if (param) {
      await prisma.behaviorTarget.create({
        data: {
          parameterId: target.parameterId,
          playbookId: playbook.id,
          scope: BehaviorTargetScope.PLAYBOOK,
          targetValue: target.targetValue,
          confidence: 1.0,
          source: "SEED",
        },
      });
      console.log(`   ✓ PLAYBOOK target: ${target.parameterId} = ${(target.targetValue * 100).toFixed(0)}%`);
    }
  }

  // ============================================
  // STEP 7: SCORING ANCHORS
  // ============================================
  console.log("\n" + "━".repeat(60));
  console.log("STEP 7: Create scoring anchors for tutor parameters\n");

  const tutorAnchors: Record<string, Array<{
    score: number;
    example: string;
    rationale: string;
    positiveSignals: string[];
    negativeSignals: string[];
  }>> = {
    "BEH-SOCRATIC": [
      {
        score: 0.9,
        example: "That's an interesting point about D-Day. What do you think the Allied commanders were most worried about? And why might they have chosen Normandy specifically?",
        rationale: "Highly Socratic - uses questions to guide thinking, doesn't give answers directly",
        positiveSignals: ["guiding_questions", "discovery_based", "builds_on_learner"],
        negativeSignals: [],
      },
      {
        score: 0.5,
        example: "D-Day was risky because of the weather and defenses. What do you already know about the beach landings?",
        rationale: "Mixed approach - provides some information then asks question",
        positiveSignals: ["includes_question"],
        negativeSignals: ["gives_answer_first"],
      },
      {
        score: 0.1,
        example: "D-Day was June 6, 1944. The Allies landed on five beaches in Normandy. Over 150,000 troops participated in the largest amphibious invasion in history.",
        rationale: "Pure lecture - no questions, no engagement with learner thinking",
        positiveSignals: [],
        negativeSignals: ["lecture_mode", "no_questions", "no_engagement"],
      },
    ],
    "BEH-SCAFFOLDING": [
      {
        score: 0.9,
        example: "Let's break this down step by step. First, let's understand what Europe looked like in 1938. Can you picture the map? Germany is here, and they just took over Austria. Now, what country is right next to Austria?",
        rationale: "Excellent scaffolding - breaks into steps, provides visual anchors, builds sequentially",
        positiveSignals: ["step_by_step", "visual_anchors", "checks_understanding"],
        negativeSignals: [],
      },
      {
        score: 0.5,
        example: "The appeasement policy was when Britain and France let Hitler take over territories hoping to avoid war. Does that make sense?",
        rationale: "Some structure but could break down further for struggling learners",
        positiveSignals: ["clear_explanation", "checks_in"],
        negativeSignals: ["could_scaffold_more"],
      },
      {
        score: 0.1,
        example: "Appeasement failed because it emboldened Hitler who then invaded Poland triggering mutual defense treaties which brought Britain and France into the war.",
        rationale: "No scaffolding - complex run-on with multiple concepts, no support structure",
        positiveSignals: [],
        negativeSignals: ["no_structure", "too_dense", "no_pacing"],
      },
    ],
    "BEH-ENCOURAGEMENT": [
      {
        score: 0.9,
        example: "Excellent thinking! You're making a really important connection there between the Treaty of Versailles and German resentment. Historians have debated this exact point for decades. What else do you notice about that period?",
        rationale: "Strong encouragement - validates thinking, elevates to expert level, invites more",
        positiveSignals: ["praises_thinking", "validates_insight", "encourages_more"],
        negativeSignals: [],
      },
      {
        score: 0.5,
        example: "Good. Yes, that's part of it. What else contributed to the rise of the Nazi party?",
        rationale: "Basic acknowledgment but minimal encouragement",
        positiveSignals: ["acknowledges_correct"],
        negativeSignals: ["minimal_praise", "moves_on_quickly"],
      },
      {
        score: 0.1,
        example: "Not quite. The economic factors were more important than political ones.",
        rationale: "Discouraging - dismissive correction without building on learner's attempt",
        positiveSignals: [],
        negativeSignals: ["dismissive", "no_encouragement", "abrupt_correction"],
      },
    ],
    "TUTOR-ENGAGEMENT": [
      {
        score: 0.9,
        example: "Learner: 'Oh wow, I never thought about how the Treaty of Versailles connected to Hitler's rise! What about Italy? Did they have similar grievances? And wait - is that why they allied with Germany?'",
        rationale: "Highly engaged - making connections, asking follow-ups, showing excitement",
        positiveSignals: ["making_connections", "asking_questions", "shows_excitement"],
        negativeSignals: [],
      },
      {
        score: 0.5,
        example: "Learner: 'Okay, so Germany was angry about the treaty. What happened next?'",
        rationale: "Moderate engagement - following along but not deeply connecting",
        positiveSignals: ["following_along", "asks_basic_question"],
        negativeSignals: ["passive", "no_connections"],
      },
      {
        score: 0.1,
        example: "Learner: 'Okay.' / 'Sure.' / 'I guess.'",
        rationale: "Low engagement - minimal responses, no questions, no interest signals",
        positiveSignals: [],
        negativeSignals: ["minimal_response", "no_questions", "disengaged"],
      },
    ],
    "TUTOR-COMPREHENSION": [
      {
        score: 0.9,
        example: "Learner: 'So if I understand correctly, the blitzkrieg worked because it combined fast-moving tanks with air support, which meant traditional defensive lines couldn't hold. It's like they changed the rules of the game!'",
        rationale: "High comprehension - can summarize, explains cause-effect, uses analogy",
        positiveSignals: ["accurate_summary", "cause_effect", "uses_analogy"],
        negativeSignals: [],
      },
      {
        score: 0.5,
        example: "Learner: 'So blitzkrieg means they attacked really fast?'",
        rationale: "Partial comprehension - understands surface level, missing deeper mechanics",
        positiveSignals: ["basic_understanding"],
        negativeSignals: ["surface_level", "missing_details"],
      },
      {
        score: 0.1,
        example: "Learner: 'Wait, so who was fighting who again? I thought Germany and Russia were allies?'",
        rationale: "Low comprehension - confused about basic facts, significant misconception",
        positiveSignals: ["asking_for_help"],
        negativeSignals: ["confused", "misconception", "lost"],
      },
    ],
  };

  for (const [parameterId, anchors] of Object.entries(tutorAnchors)) {
    const param = await prisma.parameter.findUnique({
      where: { parameterId },
    });

    if (!param) {
      console.log(`   ⚠️  Parameter not found: ${parameterId}`);
      continue;
    }

    // Delete existing anchors
    await prisma.parameterScoringAnchor.deleteMany({
      where: { parameterId },
    });

    // Create new anchors
    for (const anchor of anchors) {
      await prisma.parameterScoringAnchor.create({
        data: {
          parameterId,
          score: anchor.score,
          example: anchor.example,
          rationale: anchor.rationale,
          positiveSignals: anchor.positiveSignals,
          negativeSignals: anchor.negativeSignals,
          isGold: true,
          source: "seed",
        },
      });
    }
    console.log(`   ✓ ${parameterId}: ${anchors.length} anchors`);
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "━".repeat(60));
  console.log("SUMMARY\n");

  const callerSpecCount = await prisma.analysisSpec.count({
    where: { slug: { in: callerSpecs.map(s => s.slug) } },
  });
  const domainSpecCount = await prisma.analysisSpec.count({
    where: { slug: { in: domainSpecs.map(s => s.slug) } },
  });
  const playbookTargetCount = await prisma.behaviorTarget.count({
    where: { playbookId: playbook.id },
  });

  console.log("Created WWII History Tutor with:\n");
  console.log(`   📖 Domain: wwii-tutor`);
  console.log(`   📋 Playbook: ${playbook.name}`);
  console.log(`   👤 ${callerSpecCount} CALLER specs (measure learner)`);
  console.log(`   🎯 ${domainSpecCount} DOMAIN specs (guide tutor)`);
  console.log(`   🎚️  ${playbookTargetCount} behavior targets`);
  console.log(`   📝 1 prompt template`);
  console.log(`   ⚓ ${Object.keys(tutorAnchors).length} parameters with scoring anchors`);

  console.log("\n" + "━".repeat(60));
  console.log("TUTOR BEHAVIOR CONFIGURATION\n");

  console.log("Optimized for educational tutoring:");
  console.log("   • Socratic Method: 75% (guide discovery, don't lecture)");
  console.log("   • Question Rate: 80% (ask questions to check understanding)");
  console.log("   • Encouragement: 80% (celebrate effort and progress)");
  console.log("   • Pace Matching: 85% (adapt to learner speed)");
  console.log("   • Warmth: 75% (supportive and approachable)");
  console.log("   • Scaffolding: 70% (break down complex topics)");

  console.log("\n✅ WWII Tutor seed complete!\n");
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
