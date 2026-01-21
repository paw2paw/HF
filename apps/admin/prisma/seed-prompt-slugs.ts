/**
 * seed-prompt-slugs.ts
 *
 * Parses the slugLinks column from the parameters CSV export and creates:
 * 1. PromptSlug records
 * 2. PromptSlugParameter links to the parent parameter
 * 3. PromptSlugRange records with high/medium/low value ranges
 *
 * CSV slugLinks format: {slug}:{weight}:{mode}|{slug2}:{weight2}:{mode2}
 * Example: "Be_More_Open:1:ABSOLUTE|openness-communication-style:1:ABSOLUTE"
 *
 * Run with: npx ts-node prisma/seed-prompt-slugs.ts
 */

import { PrismaClient, PromptSlugSource, PromptSlugMode } from "@prisma/client";

const prisma = new PrismaClient();

// Parsed slug link from CSV
interface SlugLink {
  slug: string;
  weight: number;
  mode: "ABSOLUTE" | "DELTA" | "GOAL";
}

// Slug definition with prompt ranges
interface SlugDefinition {
  slug: string;
  name: string;
  description: string;
  sourceType: PromptSlugSource;
  priority: number;
  ranges: {
    label: string;
    minValue: number | null;
    maxValue: number | null;
    prompt: string;
  }[];
  fallbackPrompt?: string;
}

// Parameter data from CSV with parsed slugLinks
const parametersWithSlugs: {
  parameterId: string;
  name: string;
  interpretationHigh: string;
  interpretationLow: string;
  slugLinks: SlugLink[];
}[] = [
  {
    parameterId: "B5-A",
    name: "agreeableness",
    interpretationHigh: "Warm / cooperative",
    interpretationLow: "Sceptical / challenging",
    slugLinks: [
      { slug: "agreeableness-tone", weight: 1, mode: "ABSOLUTE" },
      { slug: "personality-blend", weight: 0.4, mode: "ABSOLUTE" },
    ],
  },
  {
    parameterId: "B5-C",
    name: "conscientiousness",
    interpretationHigh: "Highly structured / diligent",
    interpretationLow: "Spontaneous / low structure",
    slugLinks: [
      { slug: "conscientiousness-structure", weight: 1, mode: "ABSOLUTE" },
    ],
  },
  {
    parameterId: "B5-E",
    name: "extraversion",
    interpretationHigh: "High stimulation",
    interpretationLow: "Low stimulation",
    slugLinks: [
      { slug: "extraversion-engagement", weight: 1, mode: "ABSOLUTE" },
      { slug: "personality-blend", weight: 0.3, mode: "ABSOLUTE" },
    ],
  },
  {
    parameterId: "B5-N",
    name: "neuroticism",
    interpretationHigh: "Stress-sensitive",
    interpretationLow: "Calm / resilient",
    slugLinks: [{ slug: "neuroticism-support", weight: 1, mode: "ABSOLUTE" }],
  },
  {
    parameterId: "B5-O",
    name: "openness",
    interpretationHigh: "Curious / imaginative",
    interpretationLow: "Conventional / concrete",
    slugLinks: [
      { slug: "Be_More_Open", weight: 1, mode: "ABSOLUTE" },
      { slug: "openness-communication-style", weight: 1, mode: "ABSOLUTE" },
      { slug: "personality-blend", weight: 0.3, mode: "ABSOLUTE" },
    ],
  },
  {
    parameterId: "CONV_EMO",
    name: "Emotional Intensity",
    interpretationHigh: "Higher Emotional Intensity",
    interpretationLow: "Lower Emotional Intensity",
    slugLinks: [{ slug: "mood-shift-response", weight: 1, mode: "DELTA" }],
  },
  {
    parameterId: "CP-004",
    name: "engagement_level",
    interpretationHigh: "Highly engaged / invested",
    interpretationLow: "Low engagement / minimal responses",
    slugLinks: [{ slug: "engagement-depth", weight: 1, mode: "ABSOLUTE" }],
  },
];

// Slug definitions with behavioral prompts for each range
const slugDefinitions: Record<string, SlugDefinition> = {
  "agreeableness-tone": {
    slug: "agreeableness-tone",
    name: "Agreeableness Tone Adjustment",
    description:
      "Adjusts conversational warmth and challenge intensity based on agreeableness",
    sourceType: "PARAMETER",
    priority: 10,
    ranges: [
      {
        label: "High agreeableness",
        minValue: 0.7,
        maxValue: null,
        prompt:
          "This caller is warm and cooperative. Match their warmth - use affirming language, validate their feelings, and maintain a supportive tone. Avoid being overly challenging or critical.",
      },
      {
        label: "Medium agreeableness",
        minValue: 0.3,
        maxValue: 0.7,
        prompt:
          "This caller has balanced agreeableness. Be friendly but direct. You can gently challenge ideas when appropriate while maintaining rapport.",
      },
      {
        label: "Low agreeableness",
        minValue: null,
        maxValue: 0.3,
        prompt:
          "This caller is more sceptical and challenging. They may push back on ideas - don't take it personally. Be direct and factual. Skip excessive warmth; they prefer efficiency and substance over pleasantries.",
      },
    ],
    fallbackPrompt:
      "Maintain a balanced, professional tone appropriate for the conversation.",
  },

  "conscientiousness-structure": {
    slug: "conscientiousness-structure",
    name: "Conscientiousness Structure Adjustment",
    description:
      "Adjusts how much structure, planning, and follow-through emphasis to provide",
    sourceType: "PARAMETER",
    priority: 10,
    ranges: [
      {
        label: "High conscientiousness",
        minValue: 0.7,
        maxValue: null,
        prompt:
          "This caller is highly organised and detail-oriented. Provide structured responses with clear steps. Offer to set reminders or follow-up plans. They appreciate thoroughness and reliability.",
      },
      {
        label: "Medium conscientiousness",
        minValue: 0.3,
        maxValue: 0.7,
        prompt:
          "Balance structure with flexibility. Offer plans when helpful but don't over-engineer. Check if they want more detail or prefer to keep things loose.",
      },
      {
        label: "Low conscientiousness",
        minValue: null,
        maxValue: 0.3,
        prompt:
          "This caller is more spontaneous and may resist rigid structure. Keep plans light and adaptable. Don't push for commitments they're unlikely to keep. Focus on the immediate rather than long-term planning.",
      },
    ],
  },

  "extraversion-engagement": {
    slug: "extraversion-engagement",
    name: "Extraversion Engagement Style",
    description:
      "Adjusts interaction energy and stimulation based on extraversion level",
    sourceType: "PARAMETER",
    priority: 10,
    ranges: [
      {
        label: "High extraversion",
        minValue: 0.7,
        maxValue: null,
        prompt:
          "This caller is energetic and sociable. Match their energy - be enthusiastic and conversational. They enjoy back-and-forth dialogue and may want to explore tangents. Don't be too brief or transactional.",
      },
      {
        label: "Medium extraversion",
        minValue: 0.3,
        maxValue: 0.7,
        prompt:
          "Balance between engaging conversation and efficient task completion. Follow their lead on how much small talk they want.",
      },
      {
        label: "Low extraversion",
        minValue: null,
        maxValue: 0.3,
        prompt:
          "This caller prefers lower stimulation. Be calm and measured. Give them space to think - don't fill every silence. Keep interactions efficient without being cold. They may prefer written follow-ups over live calls.",
      },
    ],
  },

  "neuroticism-support": {
    slug: "neuroticism-support",
    name: "Neuroticism Support Level",
    description:
      "Adjusts reassurance, pacing, and emotional check-ins based on stress sensitivity",
    sourceType: "PARAMETER",
    priority: 15, // Higher priority - emotional support is important
    ranges: [
      {
        label: "High neuroticism",
        minValue: 0.7,
        maxValue: null,
        prompt:
          "This caller is more sensitive to stress and negative emotions. Be extra reassuring and patient. Acknowledge their concerns before problem-solving. Check in on how they're feeling. Pace the conversation carefully - don't overwhelm with information.",
      },
      {
        label: "Medium neuroticism",
        minValue: 0.3,
        maxValue: 0.7,
        prompt:
          "Provide normal levels of emotional support. Acknowledge feelings when appropriate but don't over-emphasise them.",
      },
      {
        label: "Low neuroticism",
        minValue: null,
        maxValue: 0.3,
        prompt:
          "This caller is calm and resilient. They don't need extra reassurance - excessive emotional checking may feel patronising. Focus on solutions and next steps. They can handle direct feedback.",
      },
    ],
  },

  Be_More_Open: {
    slug: "Be_More_Open",
    name: "Openness Adaptation",
    description:
      "Legacy slug for openness - adjusts creativity vs concreteness",
    sourceType: "PARAMETER",
    priority: 5,
    ranges: [
      {
        label: "High openness",
        minValue: 0.7,
        maxValue: null,
        prompt:
          "This caller is curious and imaginative. Explore ideas with them - they enjoy abstract discussions and novel perspectives. Use metaphors and creative framing.",
      },
      {
        label: "Low openness",
        minValue: null,
        maxValue: 0.3,
        prompt:
          "This caller prefers concrete, practical information. Stick to facts and proven approaches. Avoid abstract theorising - focus on what works.",
      },
    ],
  },

  "openness-communication-style": {
    slug: "openness-communication-style",
    name: "Openness Communication Style",
    description:
      "Adjusts communication style based on openness to experience",
    sourceType: "PARAMETER",
    priority: 10,
    ranges: [
      {
        label: "High openness",
        minValue: 0.7,
        maxValue: null,
        prompt:
          "This caller enjoys exploring ideas and new perspectives. Feel free to suggest novel approaches, use creative analogies, and explore tangents when relevant. They appreciate intellectual curiosity.",
      },
      {
        label: "Medium openness",
        minValue: 0.3,
        maxValue: 0.7,
        prompt:
          "Balance novel ideas with practical solutions. Introduce new concepts when clearly beneficial, but anchor them in concrete examples.",
      },
      {
        label: "Low openness",
        minValue: null,
        maxValue: 0.3,
        prompt:
          "This caller prefers conventional, proven approaches. Focus on practical, concrete advice. Avoid abstract concepts or untested ideas. Reference established methods and common practices.",
      },
    ],
  },

  "personality-blend": {
    slug: "personality-blend",
    name: "Personality Blend Summary",
    description:
      "Composite slug that blends multiple personality traits for overall style guidance",
    sourceType: "COMPOSITE",
    priority: 20, // High priority - overall personality summary
    ranges: [
      {
        label: "Analytical profile",
        minValue: null,
        maxValue: 0.4,
        prompt:
          "This caller has a more analytical, reserved personality profile. Be efficient, factual, and structured. They value substance over style.",
      },
      {
        label: "Balanced profile",
        minValue: 0.4,
        maxValue: 0.6,
        prompt:
          "This caller has a balanced personality profile. Adapt to the flow of conversation - they can engage on multiple levels.",
      },
      {
        label: "Expressive profile",
        minValue: 0.6,
        maxValue: null,
        prompt:
          "This caller has an expressive, open personality profile. Be warm, engaging, and creative. They enjoy connection and exploration.",
      },
    ],
  },

  "mood-shift-response": {
    slug: "mood-shift-response",
    name: "Mood Shift Response",
    description:
      "Responds to changes in emotional intensity during conversation (DELTA mode)",
    sourceType: "ADAPT",
    priority: 25, // Very high - immediate response to mood changes
    ranges: [
      {
        label: "Mood increasing",
        minValue: 0.2,
        maxValue: null,
        prompt:
          "The caller's emotional intensity is increasing. Acknowledge this shift. If positive, match their energy. If negative, slow down and address what's happening.",
      },
      {
        label: "Mood stable",
        minValue: -0.2,
        maxValue: 0.2,
        prompt: "", // No special instruction for stable mood
      },
      {
        label: "Mood decreasing",
        minValue: null,
        maxValue: -0.2,
        prompt:
          "The caller's emotional intensity is dropping. They may be withdrawing or becoming disengaged. Check in gently - ask if everything is okay or if they need something different from this conversation.",
      },
    ],
  },

  "engagement-depth": {
    slug: "engagement-depth",
    name: "Engagement Depth Adjustment",
    description: "Adjusts response depth based on engagement level",
    sourceType: "PARAMETER",
    priority: 10,
    ranges: [
      {
        label: "High engagement",
        minValue: 0.7,
        maxValue: null,
        prompt:
          "This caller is highly engaged and invested. Provide detailed, thorough responses. They want depth - don't oversimplify. Encourage their curiosity with follow-up questions.",
      },
      {
        label: "Medium engagement",
        minValue: 0.3,
        maxValue: 0.7,
        prompt:
          "Provide moderate detail. Watch for cues about whether they want more or less depth.",
      },
      {
        label: "Low engagement",
        minValue: null,
        maxValue: 0.3,
        prompt:
          "This caller shows low engagement. Keep responses brief and focused. Ask clarifying questions to understand what they actually need. Consider if the conversation is meeting their needs.",
      },
    ],
  },
};

async function main() {
  console.log("Seeding PromptSlugs from parameter slugLinks...\n");

  // Track created slugs to avoid duplicates
  const createdSlugs = new Set<string>();

  // First, create all the slug definitions
  for (const [slugKey, def] of Object.entries(slugDefinitions)) {
    console.log(`Creating slug: ${def.slug}`);

    try {
      // Upsert the slug
      const slug = await prisma.promptSlug.upsert({
        where: { slug: def.slug },
        create: {
          slug: def.slug,
          name: def.name,
          description: def.description,
          sourceType: def.sourceType,
          priority: def.priority,
          fallbackPrompt: def.fallbackPrompt,
          isActive: true,
          version: "1.0",
        },
        update: {
          name: def.name,
          description: def.description,
          sourceType: def.sourceType,
          priority: def.priority,
          fallbackPrompt: def.fallbackPrompt,
        },
      });

      // Delete existing ranges and recreate
      await prisma.promptSlugRange.deleteMany({
        where: { slugId: slug.id },
      });

      // Create ranges
      for (let i = 0; i < def.ranges.length; i++) {
        const range = def.ranges[i];
        if (range.prompt) {
          // Only create if there's actual prompt text
          await prisma.promptSlugRange.create({
            data: {
              slugId: slug.id,
              label: range.label,
              minValue: range.minValue,
              maxValue: range.maxValue,
              prompt: range.prompt,
              sortOrder: i,
            },
          });
        }
      }

      createdSlugs.add(def.slug);
      console.log(`  ✓ Created with ${def.ranges.filter((r) => r.prompt).length} ranges`);
    } catch (err: any) {
      console.error(`  ✗ Error: ${err.message}`);
    }
  }

  console.log("\nLinking slugs to parameters...\n");

  // Now link slugs to parameters
  for (const param of parametersWithSlugs) {
    console.log(`Processing parameter: ${param.parameterId} (${param.name})`);

    // Check if parameter exists
    const dbParam = await prisma.parameter.findUnique({
      where: { parameterId: param.parameterId },
    });

    if (!dbParam) {
      console.log(`  ⚠ Parameter not found in DB, skipping links`);
      continue;
    }

    for (const link of param.slugLinks) {
      const slug = await prisma.promptSlug.findUnique({
        where: { slug: link.slug },
      });

      if (!slug) {
        console.log(`  ⚠ Slug ${link.slug} not found, skipping`);
        continue;
      }

      try {
        // Upsert the link
        await prisma.promptSlugParameter.upsert({
          where: {
            slugId_parameterId: {
              slugId: slug.id,
              parameterId: param.parameterId,
            },
          },
          create: {
            slugId: slug.id,
            parameterId: param.parameterId,
            weight: link.weight,
            mode: link.mode as PromptSlugMode,
            sortOrder: 0,
          },
          update: {
            weight: link.weight,
            mode: link.mode as PromptSlugMode,
          },
        });
        console.log(`  ✓ Linked to ${link.slug} (weight: ${link.weight}, mode: ${link.mode})`);
      } catch (err: any) {
        console.error(`  ✗ Error linking to ${link.slug}: ${err.message}`);
      }
    }
  }

  console.log("\n✓ Seed complete!");
  console.log(`  Slugs created: ${createdSlugs.size}`);
  console.log(`  Parameters processed: ${parametersWithSlugs.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
