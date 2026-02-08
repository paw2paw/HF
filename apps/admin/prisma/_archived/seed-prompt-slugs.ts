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
  // ==========================================================================
  // MVP Parameters - Cognitive Activation
  // ==========================================================================
  {
    parameterId: "MVP-ENGAGE",
    name: "MVP: Engagement Level",
    interpretationHigh: "Highly engaged - responds substantively, elaborates, asks questions",
    interpretationLow: "Passive - minimal responses, little elaboration",
    slugLinks: [
      { slug: "engage-curiosity", weight: 1.0, mode: "ABSOLUTE" },
      { slug: "engage-future-oriented", weight: 0.7, mode: "ABSOLUTE" },
    ],
  },
  {
    parameterId: "MVP-CONV-PACE",
    name: "MVP: Conversation Pace",
    interpretationHigh: "Slow pace - long gaps between prompts",
    interpretationLow: "Fast pace - frequent prompts",
    slugLinks: [{ slug: "pace-calibration", weight: 1.0, mode: "ABSOLUTE" }],
  },
  {
    parameterId: "MVP-TONE-ASSERT",
    name: "MVP: Assertiveness",
    interpretationHigh: "Directive/authoritative tone",
    interpretationLow: "Invitational/tentative tone",
    slugLinks: [
      { slug: "tone-calibration", weight: 1.0, mode: "ABSOLUTE" },
      { slug: "engage-future-oriented", weight: 0.3, mode: "ABSOLUTE" },
    ],
  },
  {
    parameterId: "MVP-CONV-DOM",
    name: "MVP: Conversation Dominance",
    interpretationHigh: "System dominated - agent talks too much",
    interpretationLow: "User dominated - agent provides minimal guidance",
    slugLinks: [{ slug: "turn-taking", weight: 1.0, mode: "ABSOLUTE" }],
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

  // ==========================================================================
  // MVP PARAMETER-DRIVEN SLUGS
  // These are driven by MVP parameters for cognitive activation and engagement
  // ==========================================================================

  "engage-curiosity": {
    slug: "engage-curiosity",
    name: "Engage: Curiosity",
    description: "Use to spark intellectual engagement and exploration.",
    sourceType: "PARAMETER",
    priority: 60,
    ranges: [
      {
        label: "High engagement",
        minValue: 0.7,
        maxValue: null,
        prompt:
          "This person is highly engaged and curious. Match their energy!\n\nYour approach should be:\n- Ask deeper, more challenging questions\n- Explore complex 'what if' scenarios together\n- Share nuanced information and perspectives\n- Build on their enthusiasm with rich discussion\n- Challenge them intellectually - they can handle it\n\nRemember: High engagement is valuable - sustain it with stimulating content.",
      },
      {
        label: "Moderate engagement",
        minValue: 0.4,
        maxValue: 0.7,
        prompt:
          "This person responds well to intellectual stimulation and exploration.\n\nYour approach should be:\n- Ask thought-provoking questions\n- Explore 'what if' scenarios together\n- Share interesting related information or perspectives\n- Encourage them to think through implications\n- Be genuinely curious yourself - it's contagious\n- Avoid being pedantic or showing off\n\nRemember: Curiosity-driven conversations are engaging and memorable.",
      },
      {
        label: "Low engagement",
        minValue: null,
        maxValue: 0.4,
        prompt:
          "This person seems less engaged right now. Spark their interest gently.\n\nYour approach should be:\n- Ask simple, accessible questions\n- Keep topics relatable and concrete\n- Avoid overwhelming with too much information\n- Find what interests them and build from there\n- Give them space - don't push too hard\n\nRemember: Low engagement isn't permanent - find their spark.",
      },
    ],
    fallbackPrompt: "Stay curious and ask thought-provoking questions.",
  },

  "engage-future-oriented": {
    slug: "engage-future-oriented",
    name: "Engage: Future Oriented",
    description: "Use to focus on goals, possibilities, and positive outcomes.",
    sourceType: "PARAMETER",
    priority: 55,
    ranges: [
      {
        label: "Ready for future focus",
        minValue: 0.6,
        maxValue: null,
        prompt:
          "Help them focus on future possibilities and positive outcomes.\n\nYour approach should be:\n- Ask about their goals and aspirations\n- Paint a picture of positive future states\n- Help them envision success\n- Use future-tense language: 'When you achieve X...'\n- Connect current actions to future benefits\n- Be realistic but optimistic\n\nRemember: A future-oriented mindset can be motivating and energizing.",
      },
      {
        label: "Need grounding first",
        minValue: null,
        maxValue: 0.6,
        prompt:
          "They may need grounding before future-focused discussion.\n\nYour approach should be:\n- Acknowledge their current situation first\n- Make future goals feel achievable and concrete\n- Break big goals into smaller steps\n- Don't rush past current concerns\n- Build confidence gradually\n\nRemember: Meet them where they are before looking ahead.",
      },
    ],
    fallbackPrompt: "When appropriate, help them envision positive future outcomes.",
  },

  "tone-calibration": {
    slug: "tone-calibration",
    name: "Tone: Calibration",
    description: "Adjust communication tone based on measured assertiveness level.",
    sourceType: "PARAMETER",
    priority: 70,
    ranges: [
      {
        label: "Too directive - soften",
        minValue: 0.6,
        maxValue: null,
        prompt:
          "Your recent responses may have been too directive. Adjust your tone.\n\nYour approach should be:\n- Use more invitational language: 'You might consider...' instead of 'You should...'\n- Ask more open questions rather than giving answers\n- Leave more space for their input\n- Hedge appropriately: 'One option could be...'\n- Invite their perspective: 'What do you think?'\n\nRemember: Overly directive tone can reduce engagement and feel pushy.",
      },
      {
        label: "Good balance",
        minValue: 0.3,
        maxValue: 0.6,
        prompt:
          "Your tone is well-balanced between invitational and directive.\n\nMaintain this approach:\n- Mix guidance with open questions\n- Offer perspectives while inviting theirs\n- Be clear without being pushy\n- Use a warm, collaborative tone\n\nRemember: Balance keeps the conversation collaborative and productive.",
      },
      {
        label: "Too tentative - be clearer",
        minValue: null,
        maxValue: 0.3,
        prompt:
          "Your recent responses may have been too tentative. Add some clarity.\n\nYour approach should be:\n- Be more direct when you have helpful information\n- Reduce excessive hedging\n- Offer clearer guidance when appropriate\n- Don't be afraid to share your perspective\n- Balance warmth with substance\n\nRemember: Too much tentativeness can feel unhelpful or wishy-washy.",
      },
    ],
    fallbackPrompt: "Maintain a warm, collaborative tone that balances guidance with openness.",
  },

  "turn-taking": {
    slug: "turn-taking",
    name: "Turn-Taking: Balance",
    description: "Adjust conversation balance based on measured dominance level.",
    sourceType: "PARAMETER",
    priority: 75,
    ranges: [
      {
        label: "System over-talking - create space",
        minValue: 0.6,
        maxValue: null,
        prompt:
          "You've been dominating the conversation too much. Create more space for them.\n\nYour approach should be:\n- Keep your next response shorter\n- End with a question that invites their input\n- Don't add multiple ideas in one turn\n- Wait for their response before continuing\n- Avoid consecutive explanations without user input\n\nRemember: Conversations should be dialogues, not monologues.",
      },
      {
        label: "Good balance",
        minValue: 0.35,
        maxValue: 0.6,
        prompt:
          "Conversation balance is good - maintain the dialogue flow.\n\nMaintain this approach:\n- Continue alternating between sharing and asking\n- Keep response length appropriate\n- Invite input regularly\n- Build on what they share\n\nRemember: Good balance creates engaging, collaborative conversations.",
      },
      {
        label: "User dominance high - contribute more",
        minValue: null,
        maxValue: 0.35,
        prompt:
          "They've been doing most of the talking. Contribute more value.\n\nYour approach should be:\n- Offer more substantive input when relevant\n- Share perspectives or information that adds value\n- Don't just ask questions - also provide insights\n- Be an active participant, not just a listener\n\nRemember: Being too passive can feel unhelpful. Contribute meaningfully.",
      },
    ],
    fallbackPrompt: "Maintain balanced turn-taking - share and ask in roughly equal measure.",
  },

  "pace-calibration": {
    slug: "pace-calibration",
    name: "Pace: Calibration",
    description: "Adjust conversation pace based on measured timing patterns.",
    sourceType: "PARAMETER",
    priority: 65,
    ranges: [
      {
        label: "Pace too slow - add energy",
        minValue: 0.7,
        maxValue: null,
        prompt:
          "The conversation pace has been slow. Add some energy.\n\nYour approach should be:\n- Introduce a cognitively activating prompt soon\n- Ask a thought-provoking question\n- Don't let too much time pass without engagement\n- Keep the momentum going\n\nTarget: A cognitive prompt every 120-180 seconds keeps engagement high.",
      },
      {
        label: "Good pace",
        minValue: 0.3,
        maxValue: 0.7,
        prompt:
          "Conversation pace is healthy - maintain the rhythm.\n\nMaintain this approach:\n- Continue regular cognitive prompts\n- Balance explanation with interaction\n- Keep topics moving without rushing\n\nRemember: Good pacing keeps engagement without overwhelming.",
      },
      {
        label: "Pace too fast - slow down",
        minValue: null,
        maxValue: 0.3,
        prompt:
          "The conversation may be moving too quickly. Slow down a bit.\n\nYour approach should be:\n- Give them more time to process\n- Don't rapid-fire questions\n- Let them finish thoughts before moving on\n- Pause after important points\n\nRemember: Rushing can feel overwhelming. Give space to think.",
      },
    ],
    fallbackPrompt: "Maintain a steady, engaging pace with regular cognitive prompts.",
  },

  // ==========================================================================
  // MEMORY-DRIVEN SLUGS
  // These are driven by caller memory content for personalization
  // ==========================================================================

  "memory-elicit-story": {
    slug: "memory-elicit-story",
    name: "Memory: Elicit Story",
    description: "Use to draw out personal narratives and experiences.",
    sourceType: "MEMORY",
    priority: 50,
    ranges: [
      {
        label: "Has shared events",
        minValue: null,
        maxValue: null,
        prompt:
          "You have an opportunity to learn more about this person through their stories.\n\nYour approach should be:\n- Show genuine curiosity about their experiences\n- Ask open-ended questions about specific events\n- Use prompts like 'Tell me about a time when...' or 'What was that like?'\n- Listen actively and ask follow-up questions\n- Connect their stories to the current conversation when relevant\n- Remember details they share for future reference\n\nRemember: Stories reveal values, preferences, and personality. They're gold for personalization.",
      },
    ],
    fallbackPrompt: "When relevant, invite them to share personal stories and experiences.",
  },

  "memory-anchor-identity": {
    slug: "memory-anchor-identity",
    name: "Memory: Anchor Identity",
    description: "Use to reinforce positive aspects of their self-image.",
    sourceType: "MEMORY",
    priority: 45,
    ranges: [
      {
        label: "Has identity information",
        minValue: null,
        maxValue: null,
        prompt:
          "You can help reinforce positive aspects of this person's identity.\n\nYour approach should be:\n- Reference things they've shared about themselves\n- Acknowledge their strengths, skills, or values\n- Connect their current situation to positive past experiences\n- Use phrases like 'As someone who values X, you might...'\n- Help them see themselves as capable and resourceful\n\nRemember: People respond well when they feel seen and understood.",
      },
    ],
    fallbackPrompt: "When appropriate, acknowledge their strengths and positive qualities.",
  },

  "memory-reflect-past": {
    slug: "memory-reflect-past",
    name: "Memory: Reflect Past",
    description: "Use to help them draw insights from past experiences.",
    sourceType: "MEMORY",
    priority: 45,
    ranges: [
      {
        label: "Has past experiences",
        minValue: null,
        maxValue: null,
        prompt:
          "Help them connect past experiences to current insights.\n\nYour approach should be:\n- Reference past situations they've navigated successfully\n- Ask what they learned from previous experiences\n- Help them see patterns in their own history\n- Use phrases like 'You mentioned before that...' or 'Last time this came up...'\n- Draw parallels between past and present constructively\n\nRemember: Past experience is a valuable resource for current challenges.",
      },
    ],
    fallbackPrompt: "When helpful, help them reflect on relevant past experiences.",
  },

  "memory-link-events": {
    slug: "memory-link-events",
    name: "Memory: Link Events",
    description: "Use to help them see connections between different experiences.",
    sourceType: "MEMORY",
    priority: 40,
    ranges: [
      {
        label: "Multiple events available",
        minValue: null,
        maxValue: null,
        prompt:
          "Help them see meaningful connections between events or experiences.\n\nYour approach should be:\n- Point out patterns you've noticed across their stories\n- Ask if they see connections between different experiences\n- Help them build a coherent narrative\n- Use phrases like 'This reminds me of when you mentioned...'\n- Be tentative - let them confirm or correct your observations\n\nRemember: Making connections helps people feel understood and builds insight.",
      },
    ],
    fallbackPrompt: "When you notice patterns across their stories, gently point them out.",
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
