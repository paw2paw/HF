import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed script for Prompt System
 * Creates realistic data for:
 * - PromptBlocks (static prompts)
 * - PromptSlugs (dynamic prompts with parameter ranges)
 * - PromptStacks (composed prompt configurations)
 * - Sample Callers
 */

async function main() {
  console.log("🌱 Seeding Prompt System...\n");

  // ============================================
  // 1. PROMPT BLOCKS (Static Prompts)
  // ============================================
  console.log("📦 Creating Prompt Blocks...");

  const blocks = [
    // System prompts
    {
      slug: "system-base",
      name: "Base System Prompt",
      category: "system",
      description: "Foundation system prompt establishing AI identity and core behavior",
      content: `You are a helpful, conversational AI assistant. Your role is to engage naturally with users while providing accurate, thoughtful responses.

Core principles:
- Be helpful and informative
- Maintain a warm, professional tone
- Acknowledge uncertainty when appropriate
- Respect user privacy and boundaries
- Ask clarifying questions when needed`,
    },
    {
      slug: "system-coaching",
      name: "Coaching System Prompt",
      category: "system",
      description: "System prompt for coaching-focused interactions",
      content: `You are an empathetic life coach and conversational partner. Your goal is to help users reflect on their thoughts, feelings, and goals through thoughtful dialogue.

Coaching approach:
- Listen actively and reflect back what you hear
- Ask open-ended questions that promote self-discovery
- Celebrate progress and acknowledge challenges
- Provide gentle accountability without judgment
- Focus on the user's strengths and potential`,
    },

    // Safety prompts
    {
      slug: "safety-guardrails",
      name: "Safety Guardrails",
      category: "safety",
      description: "Core safety and ethical guidelines",
      content: `Safety guidelines:
- Never provide advice that could cause harm
- Redirect conversations about self-harm to professional resources
- Maintain appropriate professional boundaries
- Do not engage with illegal or unethical requests
- Protect user privacy and confidentiality`,
    },
    {
      slug: "safety-crisis",
      name: "Crisis Protocol",
      category: "safety",
      description: "Guidelines for handling crisis situations",
      content: `If the user indicates they are in crisis or mentions thoughts of self-harm:
1. Express genuine concern and empathy
2. Gently suggest professional resources: "It sounds like you're going through a difficult time. Would you consider reaching out to a crisis helpline? In the US, you can call 988 for the Suicide & Crisis Lifeline."
3. Stay calm and supportive
4. Do not minimize their feelings
5. Encourage connection with trusted people in their life`,
    },

    // Persona prompts
    {
      slug: "persona-friendly",
      name: "Friendly Persona",
      category: "persona",
      description: "Warm, approachable communication style",
      content: `Communication style:
- Use warm, conversational language
- Include appropriate humor when fitting
- Show genuine interest in the user's life
- Use encouraging and supportive phrasing
- Be relatable and down-to-earth`,
    },
    {
      slug: "persona-professional",
      name: "Professional Persona",
      category: "persona",
      description: "Polished, business-appropriate communication style",
      content: `Communication style:
- Maintain professional, polished language
- Be concise and focused
- Use clear, direct communication
- Avoid casual slang or excessive informality
- Demonstrate expertise and confidence`,
    },
    {
      slug: "persona-empathetic",
      name: "Empathetic Persona",
      category: "persona",
      description: "Deeply caring and emotionally attuned communication style",
      content: `Communication style:
- Lead with empathy and understanding
- Validate emotions before problem-solving
- Use reflective listening techniques
- Be patient and non-judgmental
- Create space for the user to process feelings`,
    },

    // Instruction prompts
    {
      slug: "instruction-brevity",
      name: "Brevity Instructions",
      category: "instruction",
      description: "Keep responses concise",
      content: `Response guidelines:
- Keep responses brief and focused (2-3 paragraphs max)
- Get to the point quickly
- Avoid unnecessary elaboration
- Use bullet points when listing multiple items
- Summarize rather than explain in detail`,
    },
    {
      slug: "instruction-verbose",
      name: "Detailed Response Instructions",
      category: "instruction",
      description: "Provide thorough, detailed responses",
      content: `Response guidelines:
- Provide comprehensive, detailed responses
- Explain reasoning and context thoroughly
- Include relevant examples and analogies
- Anticipate follow-up questions
- Offer multiple perspectives when appropriate`,
    },
    {
      slug: "instruction-questions",
      name: "Question-First Approach",
      category: "instruction",
      description: "Prioritize asking questions before giving advice",
      content: `Response guidelines:
- Ask at least one clarifying question before providing advice
- Ensure you understand the full context
- Avoid assumptions about the user's situation
- Let the user guide the direction of conversation
- Use questions to help the user think through their own solutions`,
    },
  ];

  for (const block of blocks) {
    await prisma.promptBlock.upsert({
      where: { slug: block.slug },
      create: block,
      update: block,
    });
  }
  console.log(`   ✓ Created ${blocks.length} prompt blocks\n`);

  // ============================================
  // 2. PROMPT SLUGS (Dynamic Prompts)
  // ============================================
  console.log("🎯 Creating Dynamic Prompts (Slugs)...");

  // First, get available parameters
  const parameters = await prisma.parameter.findMany({
    take: 20,
    orderBy: { parameterId: "asc" },
  });

  if (parameters.length === 0) {
    console.log("   ⚠️ No parameters found. Run seed.ts first to import parameters.\n");
  }

  // Map parameters by looking for key terms in their IDs/names
  // Actual IDs from database: B5-O (openness), B5-E (extraversion), B5-A (agreeableness),
  // BF_C (conscientiousness), CP-004 (engagement_level), CONV_EMO (emotional intensity), etc.
  const findParam = (keywords: string[]): string | null => {
    for (const p of parameters) {
      const searchStr = (p.parameterId + " " + (p.name || "")).toLowerCase();
      for (const kw of keywords) {
        if (searchStr.includes(kw.toLowerCase())) {
          return p.parameterId;
        }
      }
    }
    return null;
  };

  // Create dynamic prompts linked to parameters
  const dynamicPrompts = [
    // Big Five personality-based prompts
    {
      slug: "openness-communication-style",
      name: "Openness Communication Style",
      description: "Adapts communication based on caller's openness to experience",
      sourceType: "PARAMETER" as const,
      parameterId: findParam(["B5-O", "BF_O", "openness"]),
      priority: 10,
      ranges: [
        {
          minValue: 0,
          maxValue: 0.35,
          label: "Low Openness",
          prompt: `This caller prefers practical, concrete information. Avoid abstract concepts and stick to proven, conventional approaches. Focus on clear, step-by-step guidance.`,
        },
        {
          minValue: 0.35,
          maxValue: 0.65,
          label: "Moderate Openness",
          prompt: `Balance practical advice with occasional creative suggestions. Be willing to explore new ideas while maintaining a grounded approach.`,
        },
        {
          minValue: 0.65,
          maxValue: 1.0,
          label: "High Openness",
          prompt: `This caller appreciates creative, unconventional thinking. Feel free to explore abstract ideas, make unexpected connections, and suggest innovative approaches.`,
        },
      ],
      fallbackPrompt: "Adapt your communication style to match the caller's apparent comfort with new ideas and abstract thinking.",
    },
    {
      slug: "conscientiousness-structure",
      name: "Conscientiousness Structure Level",
      description: "Adjusts response structure based on caller's conscientiousness",
      sourceType: "PARAMETER" as const,
      parameterId: findParam(["BF_C", "B5-C", "conscientiousness"]),
      priority: 8,
      ranges: [
        {
          minValue: 0,
          maxValue: 0.35,
          label: "Low Conscientiousness",
          prompt: `Keep responses flexible and avoid overwhelming with details. Focus on the big picture rather than rigid plans. Be patient with tangents and loose timelines.`,
        },
        {
          minValue: 0.35,
          maxValue: 0.65,
          label: "Moderate Conscientiousness",
          prompt: `Provide a balanced mix of structure and flexibility. Offer plans but remain adaptable to changes in direction.`,
        },
        {
          minValue: 0.65,
          maxValue: 1.0,
          label: "High Conscientiousness",
          prompt: `Provide well-organized, detailed responses. Use clear structure, timelines, and action items. This caller appreciates thoroughness and follow-through.`,
        },
      ],
      fallbackPrompt: "Match your response structure to the caller's apparent preference for organization.",
    },
    {
      slug: "extraversion-engagement",
      name: "Extraversion Engagement Style",
      description: "Adapts engagement level based on caller's extraversion",
      sourceType: "PARAMETER" as const,
      parameterId: findParam(["B5-E", "BF_E", "extraversion", "MBTI_EI"]),
      priority: 7,
      ranges: [
        {
          minValue: 0,
          maxValue: 0.35,
          label: "Introverted",
          prompt: `Give this caller space to process. Avoid rapid-fire questions. Be comfortable with pauses. Focus on depth over breadth in conversation.`,
        },
        {
          minValue: 0.35,
          maxValue: 0.65,
          label: "Ambivert",
          prompt: `Balance energetic engagement with quieter moments. Follow the caller's lead on conversation pace and energy.`,
        },
        {
          minValue: 0.65,
          maxValue: 1.0,
          label: "Extraverted",
          prompt: `Match this caller's energy with enthusiastic engagement. Be responsive to their desire for interaction. Feel free to be more animated and expressive.`,
        },
      ],
      fallbackPrompt: "Adapt your energy level to match the caller's apparent social engagement preference.",
    },
    {
      slug: "agreeableness-tone",
      name: "Agreeableness Communication Tone",
      description: "Adjusts directness based on caller's agreeableness",
      sourceType: "PARAMETER" as const,
      parameterId: findParam(["B5-A", "BF_A", "agreeableness"]),
      priority: 6,
      ranges: [
        {
          minValue: 0,
          maxValue: 0.35,
          label: "Low Agreeableness",
          prompt: `This caller can handle direct, straightforward feedback. Don't over-soften your words. Be willing to respectfully push back when appropriate.`,
        },
        {
          minValue: 0.35,
          maxValue: 0.65,
          label: "Moderate Agreeableness",
          prompt: `Balance honesty with tact. Be direct when needed but maintain a collaborative tone.`,
        },
        {
          minValue: 0.65,
          maxValue: 1.0,
          label: "High Agreeableness",
          prompt: `Frame feedback gently and collaboratively. Emphasize shared goals and positive aspects. Be warm and supportive in your communication.`,
        },
      ],
      fallbackPrompt: "Adjust your directness to match the caller's apparent preference for harmonious communication.",
    },
    {
      slug: "neuroticism-support",
      name: "Emotional Stability Support",
      description: "Adjusts emotional support based on caller's neuroticism level",
      sourceType: "PARAMETER" as const,
      parameterId: findParam(["B5-N", "BF_N", "neuroticism", "CONV_EMO", "emotional"]),
      priority: 9,
      ranges: [
        {
          minValue: 0,
          maxValue: 0.35,
          label: "Emotionally Stable",
          prompt: `This caller is generally resilient. You can discuss challenges directly without excessive reassurance. Focus on practical solutions.`,
        },
        {
          minValue: 0.35,
          maxValue: 0.65,
          label: "Moderate Neuroticism",
          prompt: `Balance problem-solving with emotional support. Acknowledge feelings while also offering practical guidance.`,
        },
        {
          minValue: 0.65,
          maxValue: 1.0,
          label: "High Neuroticism",
          prompt: `This caller may need extra emotional support. Validate feelings before problem-solving. Be patient with worry or anxiety. Offer reassurance and stability.`,
        },
      ],
      fallbackPrompt: "Provide appropriate emotional support based on the caller's apparent emotional state.",
    },

    // Engagement-based prompts
    {
      slug: "engagement-depth",
      name: "Engagement Depth Adaptation",
      description: "Adjusts conversation depth based on engagement score",
      sourceType: "PARAMETER" as const,
      parameterId: findParam(["CP-004", "engagement"]),
      priority: 5,
      ranges: [
        {
          minValue: 0,
          maxValue: 0.3,
          label: "Low Engagement",
          prompt: `The caller seems disengaged. Keep responses brief and try to find topics that spark their interest. Ask what they'd like to discuss.`,
        },
        {
          minValue: 0.3,
          maxValue: 0.7,
          label: "Moderate Engagement",
          prompt: `Maintain steady engagement. Balance informative content with interactive elements.`,
        },
        {
          minValue: 0.7,
          maxValue: 1.0,
          label: "High Engagement",
          prompt: `The caller is highly engaged! Feel free to go deeper into topics. They're ready for substantial, meaningful conversation.`,
        },
      ],
      fallbackPrompt: "Adjust conversation depth based on the caller's apparent interest level.",
    },

    // Delta-based prompts (react to changes)
    {
      slug: "mood-shift-response",
      name: "Mood Shift Response",
      description: "Responds to changes in caller mood",
      sourceType: "PARAMETER" as const,
      parameterId: findParam(["CONV_EMO", "mood", "sentiment", "emotional"]),
      priority: 15,
      mode: "DELTA",
      ranges: [
        {
          minValue: null,
          maxValue: -0.2,
          label: "Mood Dropped",
          prompt: `The caller's mood seems to have dropped. Gently check in: "I noticed your energy shifted a bit. Is everything okay?" Be supportive and attentive.`,
        },
        {
          minValue: -0.2,
          maxValue: 0.2,
          label: "Stable Mood",
          prompt: `Mood is stable. Continue the conversation naturally.`,
        },
        {
          minValue: 0.2,
          maxValue: null,
          label: "Mood Improved",
          prompt: `The caller's mood seems brighter! Acknowledge the positive shift: "You sound more upbeat!" Build on this positive momentum.`,
        },
      ],
      fallbackPrompt: "Be attentive to shifts in the caller's emotional state.",
    },
  ];

  for (const dp of dynamicPrompts) {
    // Check if parameter exists
    const paramExists = dp.parameterId
      ? await prisma.parameter.findUnique({ where: { parameterId: dp.parameterId } })
      : null;

    // Create the slug
    const slug = await prisma.promptSlug.upsert({
      where: { slug: dp.slug },
      create: {
        slug: dp.slug,
        name: dp.name,
        description: dp.description,
        sourceType: dp.sourceType,
        priority: dp.priority,
        fallbackPrompt: dp.fallbackPrompt,
        isActive: true,
      },
      update: {
        name: dp.name,
        description: dp.description,
        sourceType: dp.sourceType,
        priority: dp.priority,
        fallbackPrompt: dp.fallbackPrompt,
      },
    });

    // Link to parameter if it exists
    if (paramExists && dp.parameterId) {
      await prisma.promptSlugParameter.upsert({
        where: {
          slugId_parameterId: {
            slugId: slug.id,
            parameterId: dp.parameterId,
          },
        },
        create: {
          slugId: slug.id,
          parameterId: dp.parameterId,
          weight: 1.0,
          mode: (dp as any).mode === "DELTA" ? "DELTA" : "ABSOLUTE",
          sortOrder: 0,
        },
        update: {
          weight: 1.0,
          mode: (dp as any).mode === "DELTA" ? "DELTA" : "ABSOLUTE",
        },
      });
    }

    // Create ranges
    await prisma.promptSlugRange.deleteMany({ where: { slugId: slug.id } });
    for (let i = 0; i < dp.ranges.length; i++) {
      const range = dp.ranges[i];
      await prisma.promptSlugRange.create({
        data: {
          slugId: slug.id,
          minValue: range.minValue,
          maxValue: range.maxValue,
          label: range.label,
          prompt: range.prompt,
          sortOrder: i,
        },
      });
    }
  }

  // Create a COMPOSITE slug example
  const compositeSlug = await prisma.promptSlug.upsert({
    where: { slug: "personality-blend" },
    create: {
      slug: "personality-blend",
      name: "Personality Blend Score",
      description: "Composite score from multiple personality factors",
      sourceType: "COMPOSITE",
      priority: 12,
      fallbackPrompt: "Adapt your style to the caller's overall personality profile.",
      isActive: true,
    },
    update: {
      name: "Personality Blend Score",
      description: "Composite score from multiple personality factors",
      priority: 12,
    },
  });

  // Link composite to multiple parameters
  const compositeParams = [
    { paramId: findParam(["B5-O", "BF_O", "openness"]), weight: 0.3 },
    { paramId: findParam(["B5-E", "BF_E", "extraversion"]), weight: 0.3 },
    { paramId: findParam(["B5-A", "BF_A", "agreeableness"]), weight: 0.4 },
  ].filter(cp => cp.paramId !== null) as { paramId: string; weight: number }[];

  for (let i = 0; i < compositeParams.length; i++) {
    const cp = compositeParams[i];
    const paramExists = await prisma.parameter.findUnique({ where: { parameterId: cp.paramId } });
    if (paramExists) {
      await prisma.promptSlugParameter.upsert({
        where: {
          slugId_parameterId: {
            slugId: compositeSlug.id,
            parameterId: cp.paramId,
          },
        },
        create: {
          slugId: compositeSlug.id,
          parameterId: cp.paramId,
          weight: cp.weight,
          mode: "ABSOLUTE",
          sortOrder: i,
        },
        update: {
          weight: cp.weight,
        },
      });
    }
  }

  // Add ranges for composite
  await prisma.promptSlugRange.deleteMany({ where: { slugId: compositeSlug.id } });
  const compositeRanges = [
    {
      minValue: 0,
      maxValue: 0.4,
      label: "Reserved Profile",
      prompt: "This caller has a reserved personality profile. Approach with patience, allow processing time, and build trust gradually.",
    },
    {
      minValue: 0.4,
      maxValue: 0.6,
      label: "Balanced Profile",
      prompt: "This caller has a balanced personality profile. Adapt fluidly to their cues and maintain a versatile approach.",
    },
    {
      minValue: 0.6,
      maxValue: 1.0,
      label: "Expressive Profile",
      prompt: "This caller has an expressive personality profile. Match their energy, be engaging, and don't hold back on warmth.",
    },
  ];

  for (let i = 0; i < compositeRanges.length; i++) {
    await prisma.promptSlugRange.create({
      data: {
        slugId: compositeSlug.id,
        ...compositeRanges[i],
        sortOrder: i,
      },
    });
  }

  console.log(`   ✓ Created ${dynamicPrompts.length + 1} dynamic prompts\n`);

  // ============================================
  // 3. PROMPT STACKS
  // ============================================
  console.log("📚 Creating Prompt Stacks...");

  // Get created blocks and slugs
  const allBlocks = await prisma.promptBlock.findMany();
  const allSlugs = await prisma.promptSlug.findMany();

  const blockBySlug = Object.fromEntries(allBlocks.map((b) => [b.slug, b]));
  const slugBySlug = Object.fromEntries(allSlugs.map((s) => [s.slug, s]));

  // Stack 1: Default conversational stack
  const defaultStack = await prisma.promptStack.upsert({
    where: { id: "default-conversational-stack" },
    create: {
      id: "default-conversational-stack",
      name: "Default Conversational",
      description: "Standard conversational AI stack with personality adaptation",
      status: "PUBLISHED",
      isDefault: true,
      version: "1.0",
      publishedAt: new Date(),
    },
    update: {
      name: "Default Conversational",
      description: "Standard conversational AI stack with personality adaptation",
    },
  });

  // Clear existing items
  await prisma.promptStackItem.deleteMany({ where: { stackId: defaultStack.id } });

  // Add items to default stack
  const defaultStackItems = [
    { itemType: "BLOCK", blockId: blockBySlug["system-base"]?.id },
    { itemType: "BLOCK", blockId: blockBySlug["safety-guardrails"]?.id },
    { itemType: "BLOCK", blockId: blockBySlug["persona-friendly"]?.id },
    { itemType: "AUTO_SLUGS", autoSlugSourceTypes: ["PARAMETER", "COMPOSITE"], autoSlugOrderBy: "priority" },
    { itemType: "CALLER", callerMemoryCategories: ["FACT", "PREFERENCE"], callerMemoryLimit: 10 },
    { itemType: "BLOCK", blockId: blockBySlug["instruction-brevity"]?.id },
  ];

  for (let i = 0; i < defaultStackItems.length; i++) {
    const item = defaultStackItems[i];
    await prisma.promptStackItem.create({
      data: {
        stackId: defaultStack.id,
        itemType: item.itemType as any,
        blockId: item.itemType === "BLOCK" ? item.blockId : null,
        callerMemoryCategories: item.callerMemoryCategories || [],
        callerMemoryLimit: item.callerMemoryLimit || null,
        autoSlugSourceTypes: item.autoSlugSourceTypes || [],
        autoSlugOrderBy: item.autoSlugOrderBy || null,
        autoSlugLimit: null,
        autoSlugDomainFilter: [],
        isEnabled: true,
        sortOrder: i,
      },
    });
  }

  // Stack 2: Coaching stack
  const coachingStack = await prisma.promptStack.upsert({
    where: { id: "coaching-focused-stack" },
    create: {
      id: "coaching-focused-stack",
      name: "Coaching Focused",
      description: "Stack optimized for life coaching conversations",
      status: "PUBLISHED",
      isDefault: false,
      version: "1.0",
      publishedAt: new Date(),
    },
    update: {
      name: "Coaching Focused",
      description: "Stack optimized for life coaching conversations",
    },
  });

  await prisma.promptStackItem.deleteMany({ where: { stackId: coachingStack.id } });

  const coachingStackItems = [
    { itemType: "BLOCK", blockId: blockBySlug["system-coaching"]?.id },
    { itemType: "BLOCK", blockId: blockBySlug["safety-guardrails"]?.id },
    { itemType: "BLOCK", blockId: blockBySlug["safety-crisis"]?.id },
    { itemType: "BLOCK", blockId: blockBySlug["persona-empathetic"]?.id },
    { itemType: "SLUG", slugId: slugBySlug["neuroticism-support"]?.id },
    { itemType: "SLUG", slugId: slugBySlug["agreeableness-tone"]?.id },
    { itemType: "SLUG", slugId: slugBySlug["mood-shift-response"]?.id },
    { itemType: "CALLER", callerMemoryCategories: ["FACT", "PREFERENCE", "EVENT", "TOPIC"], callerMemoryLimit: 15 },
    { itemType: "BLOCK", blockId: blockBySlug["instruction-questions"]?.id },
  ];

  for (let i = 0; i < coachingStackItems.length; i++) {
    const item = coachingStackItems[i];
    await prisma.promptStackItem.create({
      data: {
        stackId: coachingStack.id,
        itemType: item.itemType as any,
        blockId: item.itemType === "BLOCK" ? item.blockId : null,
        slugId: item.itemType === "SLUG" ? item.slugId : null,
        callerMemoryCategories: item.callerMemoryCategories || [],
        callerMemoryLimit: item.callerMemoryLimit || null,
        autoSlugSourceTypes: [],
        autoSlugOrderBy: null,
        autoSlugLimit: null,
        autoSlugDomainFilter: [],
        isEnabled: true,
        sortOrder: i,
      },
    });
  }

  // Stack 3: Professional/Business stack
  const professionalStack = await prisma.promptStack.upsert({
    where: { id: "professional-business-stack" },
    create: {
      id: "professional-business-stack",
      name: "Professional Business",
      description: "Stack for business and professional contexts",
      status: "DRAFT",
      isDefault: false,
      version: "1.0",
    },
    update: {
      name: "Professional Business",
      description: "Stack for business and professional contexts",
    },
  });

  await prisma.promptStackItem.deleteMany({ where: { stackId: professionalStack.id } });

  const professionalStackItems = [
    { itemType: "BLOCK", blockId: blockBySlug["system-base"]?.id },
    { itemType: "BLOCK", blockId: blockBySlug["safety-guardrails"]?.id },
    { itemType: "BLOCK", blockId: blockBySlug["persona-professional"]?.id },
    { itemType: "SLUG", slugId: slugBySlug["conscientiousness-structure"]?.id },
    { itemType: "SLUG", slugId: slugBySlug["engagement-depth"]?.id },
    { itemType: "CALLER", callerMemoryCategories: ["FACT", "TOPIC"], callerMemoryLimit: 5 },
  ];

  for (let i = 0; i < professionalStackItems.length; i++) {
    const item = professionalStackItems[i];
    await prisma.promptStackItem.create({
      data: {
        stackId: professionalStack.id,
        itemType: item.itemType as any,
        blockId: item.itemType === "BLOCK" ? item.blockId : null,
        slugId: item.itemType === "SLUG" ? item.slugId : null,
        callerMemoryCategories: item.callerMemoryCategories || [],
        callerMemoryLimit: item.callerMemoryLimit || null,
        autoSlugSourceTypes: [],
        autoSlugOrderBy: null,
        autoSlugLimit: null,
        autoSlugDomainFilter: [],
        isEnabled: true,
        sortOrder: i,
      },
    });
  }

  console.log(`   ✓ Created 3 prompt stacks\n`);

  // ============================================
  // 4. SAMPLE CALLERS + CALLER IDENTITIES
  // ============================================
  console.log("👤 Creating Sample Callers and Identities...");

  const callerData = [
    {
      callerId: "caller-sarah-001",
      callerIdentityId: "identity-sarah-001",
      name: "Sarah Mitchell",
      externalId: "+1-555-0101",
      promptStackId: defaultStack.id,
    },
    {
      callerId: "caller-james-002",
      callerIdentityId: "identity-james-002",
      name: "James Chen",
      externalId: "+1-555-0102",
      promptStackId: coachingStack.id,
    },
    {
      callerId: "caller-maria-003",
      callerIdentityId: "identity-maria-003",
      name: "Maria Rodriguez",
      externalId: "+1-555-0103",
      promptStackId: defaultStack.id,
    },
    {
      callerId: "caller-alex-004",
      callerIdentityId: "identity-alex-004",
      name: "Alex Thompson",
      externalId: "+1-555-0104",
      promptStackId: professionalStack.id,
    },
    {
      callerId: "caller-emma-005",
      callerIdentityId: "identity-emma-005",
      name: "Emma Wilson",
      externalId: "+1-555-0105",
      promptStackId: coachingStack.id,
    },
  ];

  for (const data of callerData) {
    // Create or update Caller (the person)
    await prisma.caller.upsert({
      where: { id: data.callerId },
      create: {
        id: data.callerId,
        name: data.name,
      },
      update: {
        name: data.name,
      },
    });

    // Create or update CallerIdentity (the phone/contact identifier)
    await prisma.callerIdentity.upsert({
      where: { id: data.callerIdentityId },
      create: {
        id: data.callerIdentityId,
        name: data.name,
        externalId: data.externalId,
        callerId: data.callerId,
        promptStackId: data.promptStackId,
      },
      update: {
        name: data.name,
        promptStackId: data.promptStackId,
      },
    });
  }

  console.log(`   ✓ Created ${callerData.length} sample callers and identities\n`);

  // ============================================
  // 5. SAMPLE CALLER MEMORIES (for CALLER items)
  // ============================================
  console.log("🧠 Creating Sample Caller Memories...");

  // Create a sample caller if needed
  let sampleCaller = await prisma.caller.findFirst({ where: { email: "sample@example.com" } });
  if (!sampleCaller) {
    sampleCaller = await prisma.caller.create({
      data: {
        email: "sample@example.com",
        name: "Sample Caller",
      },
    });
  }

  // Link caller identity to caller
  await prisma.callerIdentity.update({
    where: { id: "caller-sarah-001" },
    data: { callerId: sampleCaller.id },
  });

  // Create memories for the sample caller
  // MemorySource enum: EXTRACTED, INFERRED, STATED, CORRECTED
  const memories = [
    { category: "FACT" as const, key: "occupation", value: "Software engineer at a startup", confidence: 0.95, source: "STATED" as const },
    { category: "FACT" as const, key: "location", value: "Lives in San Francisco", confidence: 0.9, source: "STATED" as const },
    { category: "PREFERENCE" as const, key: "communication_style", value: "Prefers direct, concise responses", confidence: 0.85, source: "INFERRED" as const },
    { category: "PREFERENCE" as const, key: "topics_of_interest", value: "Interested in AI, productivity, career growth", confidence: 0.8, source: "EXTRACTED" as const },
    { category: "EVENT" as const, key: "recent_life_event", value: "Recently got promoted to senior engineer", confidence: 0.9, source: "STATED" as const },
    { category: "TOPIC" as const, key: "ongoing_discussion", value: "Working on work-life balance", confidence: 0.75, source: "EXTRACTED" as const },
    { category: "RELATIONSHIP" as const, key: "family_situation", value: "Has a supportive partner", confidence: 0.7, source: "INFERRED" as const },
    { category: "CONTEXT" as const, key: "current_goal", value: "Wants to improve leadership skills", confidence: 0.85, source: "STATED" as const },
  ];

  // Clear existing memories for this caller
  await prisma.callerMemory.deleteMany({ where: { callerId: sampleCaller.id } });

  for (const mem of memories) {
    await prisma.callerMemory.create({
      data: {
        callerId: sampleCaller.id,
        category: mem.category,
        key: mem.key,
        value: mem.value,
        confidence: mem.confidence,
        source: mem.source,
        extractedAt: new Date(),
      },
    });
  }

  console.log(`   ✓ Created ${memories.length} sample memories\n`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log("✅ Prompt System Seeding Complete!\n");
  console.log("Summary:");
  console.log(`   • ${blocks.length} Prompt Blocks (static prompts)`);
  console.log(`   • ${dynamicPrompts.length + 1} Dynamic Prompts (parameter-driven)`);
  console.log(`   • 3 Prompt Stacks`);
  console.log(`   • ${callerData.length} Sample Callers`);
  console.log(`   • ${memories.length} Sample Memories\n`);
  console.log("You can now:");
  console.log("   1. View blocks at /prompt-blocks");
  console.log("   2. View dynamic prompts at /prompt-slugs");
  console.log("   3. Configure stacks at /prompt-stacks");
  console.log("   4. Test composition via POST /api/prompt-stacks/compose\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
