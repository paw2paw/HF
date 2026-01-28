import { PrismaClient, AnalysisOutputType, SpecificationScope } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed script for System-level Analysis Specs
 * Creates configurable specs for:
 * - AGGREGATE: Personality aggregation with configurable trait mappings
 * - COMPOSE: Prompt composition with configurable templates
 * - REWARD: Reward computation with configurable weights
 */

async function main() {
  console.log("🌱 Seeding System Analysis Specs...\n");

  // ============================================
  // 1. AGGREGATE SPEC - Personality Aggregation
  // ============================================
  console.log("📊 Creating AGGREGATE spec for personality...");

  const aggregateSpec = await prisma.analysisSpec.upsert({
    where: { slug: "system-personality-aggregate" },
    update: {
      name: "Personality Aggregation",
      description: `Aggregates call-level scores into caller personality profiles.

This spec runs after MEASURE specs to:
1. Create PersonalityObservation records for each call (Big Five snapshot)
2. Aggregate all scores into CallerPersonality (time-weighted average)
3. Update CallerPersonalityProfile with all parameter values

The trait mapping defines which parameter IDs map to personality fields.
The half-life controls how quickly older scores decay in importance.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "AGGREGATE" as AnalysisOutputType,
      domain: "personality",
      priority: 100,
      isActive: true,
      isDirty: false,
      config: {
        // Maps parameter IDs to personality trait field names
        traitMapping: {
          "B5-O": "openness",
          "B5-C": "conscientiousness",
          "B5-E": "extraversion",
          "B5-A": "agreeableness",
          "B5-N": "neuroticism",
        },
        // How many days until a score's weight drops to 50%
        halfLifeDays: 30,
        // Default confidence for PersonalityObservation
        defaultConfidence: 0.7,
        // Default decay factor for new observations
        defaultDecayFactor: 1.0,
      },
    },
    create: {
      slug: "system-personality-aggregate",
      name: "Personality Aggregation",
      description: `Aggregates call-level scores into caller personality profiles.

This spec runs after MEASURE specs to:
1. Create PersonalityObservation records for each call (Big Five snapshot)
2. Aggregate all scores into CallerPersonality (time-weighted average)
3. Update CallerPersonalityProfile with all parameter values

The trait mapping defines which parameter IDs map to personality fields.
The half-life controls how quickly older scores decay in importance.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "AGGREGATE" as AnalysisOutputType,
      domain: "personality",
      priority: 100,
      isActive: true,
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
        defaultDecayFactor: 1.0,
      },
    },
  });

  console.log(`   ✓ Created: ${aggregateSpec.slug}`);

  // ============================================
  // 2. COMPOSE SPEC - Prompt Composition
  // ============================================
  console.log("📝 Creating COMPOSE spec for prompt generation...");

  const composeSpec = await prisma.analysisSpec.upsert({
    where: { slug: "system-prompt-compose" },
    update: {
      name: "Prompt Composition",
      description: `Composes personalized agent guidance prompts for callers.

This spec gathers context and generates a prompt to guide the AI agent:
1. Fetches caller memories (facts, preferences, events)
2. Fetches personality profile (Big Five traits)
3. Fetches behavior targets (how agent should communicate)
4. Generates structured prompt using AI

The prompt template uses Mustache syntax for variable interpolation.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "COMPOSE" as AnalysisOutputType,
      domain: "prompt",
      priority: 100,
      isActive: true,
      isDirty: false,
      promptTemplate: `You are an expert at creating personalized agent guidance prompts.
Your task is to compose a prompt that will guide a conversational AI agent on how to best communicate with a specific caller.

The prompt should:
1. Be written as direct instructions to an AI agent (e.g., "Use a warm, friendly tone...")
2. Incorporate the caller's personality traits and adapt communication style accordingly
3. Reference specific memories and facts about the caller naturally
4. Follow the behavior targets for tone, length, formality, etc.
5. Be actionable and specific, not vague
6. Be between 200-500 words

Format the output as a clean, well-structured agent guidance prompt with clear sections.

---

Based on the following caller context, compose a personalized agent guidance prompt for the next conversation with this caller.

{{callerContext}}

Generate a complete agent guidance prompt that will help the AI agent provide the best possible experience for this specific caller.`,
      config: {
        // Thresholds for converting scores to labels (high/moderate/low)
        thresholds: {
          high: 0.7,
          low: 0.3,
        },
        // LLM configuration
        maxTokens: 1500,
        temperature: 0.7,
        // Context limits
        memoriesLimit: 50,
        memoriesPerCategory: 5,
        recentCallsLimit: 5,
        // What to include in context
        includePersonality: true,
        includeMemories: true,
        includeBehaviorTargets: true,
        includeRecentCalls: true,
      },
    },
    create: {
      slug: "system-prompt-compose",
      name: "Prompt Composition",
      description: `Composes personalized agent guidance prompts for callers.

This spec gathers context and generates a prompt to guide the AI agent:
1. Fetches caller memories (facts, preferences, events)
2. Fetches personality profile (Big Five traits)
3. Fetches behavior targets (how agent should communicate)
4. Generates structured prompt using AI

The prompt template uses Mustache syntax for variable interpolation.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "COMPOSE" as AnalysisOutputType,
      domain: "prompt",
      priority: 100,
      isActive: true,
      isDirty: false,
      promptTemplate: `You are an expert at creating personalized agent guidance prompts.
Your task is to compose a prompt that will guide a conversational AI agent on how to best communicate with a specific caller.

The prompt should:
1. Be written as direct instructions to an AI agent (e.g., "Use a warm, friendly tone...")
2. Incorporate the caller's personality traits and adapt communication style accordingly
3. Reference specific memories and facts about the caller naturally
4. Follow the behavior targets for tone, length, formality, etc.
5. Be actionable and specific, not vague
6. Be between 200-500 words

Format the output as a clean, well-structured agent guidance prompt with clear sections.

---

Based on the following caller context, compose a personalized agent guidance prompt for the next conversation with this caller.

{{callerContext}}

Generate a complete agent guidance prompt that will help the AI agent provide the best possible experience for this specific caller.`,
      config: {
        thresholds: {
          high: 0.7,
          low: 0.3,
        },
        maxTokens: 1500,
        temperature: 0.7,
        memoriesLimit: 50,
        memoriesPerCategory: 5,
        recentCallsLimit: 5,
        includePersonality: true,
        includeMemories: true,
        includeBehaviorTargets: true,
        includeRecentCalls: true,
      },
    },
  });

  console.log(`   ✓ Created: ${composeSpec.slug}`);

  // ============================================
  // 3. REWARD SPEC - Reward Computation
  // ============================================
  console.log("🎯 Creating REWARD spec for reward computation...");

  const rewardSpec = await prisma.analysisSpec.upsert({
    where: { slug: "system-reward-compute" },
    update: {
      name: "Reward Computation",
      description: `Computes reward scores from agent behavior measurements.

This spec evaluates how well the agent performed:
1. Compares actual behavior measurements to target values
2. Computes weighted differences per parameter
3. Generates overall reward score (0-1)

The tolerance controls how close a measurement must be to target to be "on-target".
The weights control how behavior vs outcome signals contribute to final score.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "REWARD" as AnalysisOutputType,
      domain: "reward",
      priority: 100,
      isActive: true,
      isDirty: false,
      config: {
        // Default target value when no BehaviorTarget exists
        defaultTargetValue: 0.5,
        // How close measurement must be to target (0.15 = 15%)
        tolerance: 0.15,
        // Outcome signal weights
        outcomeWeights: {
          resolved: 0.5,       // Bonus for resolved task
          notResolved: -0.3,   // Penalty for unresolved
          escalated: -0.5,     // Penalty for escalation
          notEscalated: 0.2,   // Bonus for no escalation
        },
        // Overall weighting between behavior score and outcome signals
        behaviorWeight: 0.4,
        outcomeWeight: 0.6,
        // Keywords for outcome detection
        resolutionMarkers: ["thank you", "solved", "resolved", "that helps", "perfect", "great"],
        escalationMarkers: ["supervisor", "manager", "escalate", "complaint"],
        positiveWords: ["thank", "great", "perfect", "happy", "excellent", "wonderful"],
        negativeWords: ["frustrated", "angry", "annoyed", "disappointed", "terrible"],
      },
    },
    create: {
      slug: "system-reward-compute",
      name: "Reward Computation",
      description: `Computes reward scores from agent behavior measurements.

This spec evaluates how well the agent performed:
1. Compares actual behavior measurements to target values
2. Computes weighted differences per parameter
3. Generates overall reward score (0-1)

The tolerance controls how close a measurement must be to target to be "on-target".
The weights control how behavior vs outcome signals contribute to final score.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "REWARD" as AnalysisOutputType,
      domain: "reward",
      priority: 100,
      isActive: true,
      isDirty: false,
      config: {
        defaultTargetValue: 0.5,
        tolerance: 0.15,
        outcomeWeights: {
          resolved: 0.5,
          notResolved: -0.3,
          escalated: -0.5,
          notEscalated: 0.2,
        },
        behaviorWeight: 0.4,
        outcomeWeight: 0.6,
        resolutionMarkers: ["thank you", "solved", "resolved", "that helps", "perfect", "great"],
        escalationMarkers: ["supervisor", "manager", "escalate", "complaint"],
        positiveWords: ["thank", "great", "perfect", "happy", "excellent", "wonderful"],
        negativeWords: ["frustrated", "angry", "annoyed", "disappointed", "terrible"],
      },
    },
  });

  console.log(`   ✓ Created: ${rewardSpec.slug}`);

  // ============================================
  // 4. ADDITIONAL CONFIG SPECS
  // ============================================
  console.log("⚙️ Creating additional config specs...");

  // LLM Configuration spec (for pipeline AI calls)
  const llmConfigSpec = await prisma.analysisSpec.upsert({
    where: { slug: "system-llm-config" },
    update: {
      name: "LLM Configuration",
      description: `Default LLM configuration for analysis operations.

Controls model parameters for AI calls in the pipeline:
- maxTokens: Maximum tokens for response
- temperature: Creativity level (0=deterministic, 1=creative)
- transcriptLimit: Max characters of transcript to include`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "MEASURE" as AnalysisOutputType, // Using MEASURE as a placeholder
      domain: "config",
      priority: 0,
      isActive: true,
      isDirty: false,
      config: {
        // Caller analysis (MEASURE + LEARN)
        callerAnalysis: {
          maxTokens: 2048,
          temperature: 0.3,
          transcriptLimit: 6000,
        },
        // Agent analysis (MEASURE_AGENT)
        agentAnalysis: {
          baseMaxTokens: 2048,
          tokensPerParameter: 120,
          temperature: 0.3,
          transcriptLimit: 6000,
        },
        // Prompt composition (COMPOSE)
        promptComposition: {
          maxTokens: 1500,
          temperature: 0.7,
        },
        // Mock generation parameters
        mock: {
          scoreRange: { min: 0.4, max: 0.8 },
          confidenceRange: { min: 0.6, max: 0.9 },
        },
      },
    },
    create: {
      slug: "system-llm-config",
      name: "LLM Configuration",
      description: `Default LLM configuration for analysis operations.

Controls model parameters for AI calls in the pipeline:
- maxTokens: Maximum tokens for response
- temperature: Creativity level (0=deterministic, 1=creative)
- transcriptLimit: Max characters of transcript to include`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "MEASURE" as AnalysisOutputType,
      domain: "config",
      priority: 0,
      isActive: true,
      isDirty: false,
      config: {
        callerAnalysis: {
          maxTokens: 2048,
          temperature: 0.3,
          transcriptLimit: 6000,
        },
        agentAnalysis: {
          baseMaxTokens: 2048,
          tokensPerParameter: 120,
          temperature: 0.3,
          transcriptLimit: 6000,
        },
        promptComposition: {
          maxTokens: 1500,
          temperature: 0.7,
        },
        mock: {
          scoreRange: { min: 0.4, max: 0.8 },
          confidenceRange: { min: 0.6, max: 0.9 },
        },
      },
    },
  });

  console.log(`   ✓ Created: ${llmConfigSpec.slug}`);

  // ============================================
  // 5. TARGET LEARN SPEC - Learning Loop Config
  // ============================================
  console.log("🎓 Creating TARGET_LEARN spec for learning loop...");

  const targetLearnSpec = await prisma.analysisSpec.upsert({
    where: { slug: "system-target-learn" },
    update: {
      name: "Target Learning",
      description: `Configures the learning loop for BehaviorTarget adjustments.

Controls how targets are adjusted based on reward signals:
- Good outcome + hit target → reinforce (increase confidence)
- Good outcome + missed target → adjust target toward actual
- Bad outcome + hit target → re-evaluate target
- Bad outcome + missed target → adjust target away from actual

All rates and thresholds are configurable.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "ADAPT" as AnalysisOutputType,
      domain: "targets",
      priority: 100,
      isActive: true,
      isDirty: false,
      config: {
        // How close measurement must be to target to be "hit"
        tolerance: 0.15,
        // How much to adjust per learning iteration
        learningRate: 0.1,
        // Confidence bounds
        minConfidence: 0.1,
        maxConfidence: 0.95,
        // Adjustment multipliers for different scenarios
        reinforceConfidenceBoost: 0.5,      // Good + hit → confidence boost
        goodMissedConfidenceBoost: 0.2,     // Good + missed → small confidence boost
        badHitConfidencePenalty: 0.3,       // Bad + hit → confidence drop
        badMissedConfidencePenalty: 0.2,    // Bad + missed → confidence drop
        badHitTargetAdjust: 0.3,            // Bad + hit → small target adjust
        badMissedTargetAdjust: 0.5,         // Bad + missed → larger target adjust
      },
    },
    create: {
      slug: "system-target-learn",
      name: "Target Learning",
      description: `Configures the learning loop for BehaviorTarget adjustments.

Controls how targets are adjusted based on reward signals:
- Good outcome + hit target → reinforce (increase confidence)
- Good outcome + missed target → adjust target toward actual
- Bad outcome + hit target → re-evaluate target
- Bad outcome + missed target → adjust target away from actual

All rates and thresholds are configurable.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "ADAPT" as AnalysisOutputType,
      domain: "targets",
      priority: 100,
      isActive: true,
      isDirty: false,
      config: {
        tolerance: 0.15,
        learningRate: 0.1,
        minConfidence: 0.1,
        maxConfidence: 0.95,
        reinforceConfidenceBoost: 0.5,
        goodMissedConfidenceBoost: 0.2,
        badHitConfidencePenalty: 0.3,
        badMissedConfidencePenalty: 0.2,
        badHitTargetAdjust: 0.3,
        badMissedTargetAdjust: 0.5,
      },
    },
  });

  console.log(`   ✓ Created: ${targetLearnSpec.slug}`);

  // ============================================
  // 6. SLUG SELECT SPEC - Prompt Slug Selection
  // ============================================
  console.log("🎯 Creating SLUG_SELECT spec for prompt slug selection...");

  const slugSelectSpec = await prisma.analysisSpec.upsert({
    where: { slug: "system-slug-select" },
    update: {
      name: "Slug Selection Rules",
      description: `Configures thresholds and confidences for prompt slug selection.

Maps personality traits to prompt categories:
- High neuroticism → Emotional support slugs
- High extraversion → Engagement/encouragement slugs
- High conscientiousness → Action-oriented slugs
- High openness → Curiosity-based slugs
- Low openness + High agreeableness → Memory/narrative slugs

All thresholds are configurable.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "COMPOSE" as AnalysisOutputType,
      domain: "slug-select",
      priority: 100,
      isActive: true,
      isDirty: false,
      config: {
        // Personality trait thresholds
        thresholds: {
          highNeuroticism: 0.6,
          moderateNeuroticism: 0.4,
          lowOpenness: 0.4,
          highAgreeableness: 0.6,
          highExtraversion: 0.7,
          highConscientiousness: 0.6,
          highOpenness: 0.6,
        },
        // Confidence levels for each rule
        confidences: {
          highNeuroticism: 0.85,
          moderateNeuroticism: 0.75,
          memoryNarrative: 0.8,
          highExtraversion: 0.8,
          highConscientiousness: 0.75,
          highOpenness: 0.7,
          fallback: 0.5,
        },
        // How many recent slugs to check for repetition avoidance
        maxRecentSlugs: 3,
      },
    },
    create: {
      slug: "system-slug-select",
      name: "Slug Selection Rules",
      description: `Configures thresholds and confidences for prompt slug selection.

Maps personality traits to prompt categories:
- High neuroticism → Emotional support slugs
- High extraversion → Engagement/encouragement slugs
- High conscientiousness → Action-oriented slugs
- High openness → Curiosity-based slugs
- Low openness + High agreeableness → Memory/narrative slugs

All thresholds are configurable.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "COMPOSE" as AnalysisOutputType,
      domain: "slug-select",
      priority: 100,
      isActive: true,
      isDirty: false,
      config: {
        thresholds: {
          highNeuroticism: 0.6,
          moderateNeuroticism: 0.4,
          lowOpenness: 0.4,
          highAgreeableness: 0.6,
          highExtraversion: 0.7,
          highConscientiousness: 0.6,
          highOpenness: 0.6,
        },
        confidences: {
          highNeuroticism: 0.85,
          moderateNeuroticism: 0.75,
          memoryNarrative: 0.8,
          highExtraversion: 0.8,
          highConscientiousness: 0.75,
          highOpenness: 0.7,
          fallback: 0.5,
        },
        maxRecentSlugs: 3,
      },
    },
  });

  console.log(`   ✓ Created: ${slugSelectSpec.slug}`);

  // ============================================
  // 7. PROMPT SLUG TEMPLATES - Actual prompt content for each slug
  // ============================================
  console.log("📝 Creating Prompt Slug Templates...");

  // Define all prompt slugs with their templates
  const promptSlugTemplates = [
    // EMOTION category - for callers showing emotional distress
    {
      slug: "prompt-slug-emotion-soothing",
      name: "Emotion: Soothing",
      category: "emotion",
      slugId: "emotion.soothing",
      description: "Use when caller shows high distress or anxiety. Provides calm, reassuring responses.",
      promptTemplate: `You are speaking with someone who may be feeling anxious or distressed.

Your approach should be:
- Use a calm, gentle tone throughout the conversation
- Acknowledge their feelings without minimizing them
- Speak at a measured pace, avoiding rushed responses
- Use phrases like "I understand", "That sounds difficult", "Take your time"
- Avoid jumping to solutions - let them feel heard first
- If appropriate, suggest a brief pause or breathing exercise

Remember: Your primary goal is to help them feel safe and heard, not to immediately solve the problem.`,
    },
    {
      slug: "prompt-slug-emotion-validating",
      name: "Emotion: Validating",
      category: "emotion",
      slugId: "emotion.validating",
      description: "Use for moderate emotional states. Validates feelings while maintaining forward momentum.",
      promptTemplate: `You are speaking with someone who is experiencing some emotional response to their situation.

Your approach should be:
- Acknowledge their feelings as valid and understandable
- Use reflective statements: "It makes sense that you'd feel that way"
- Show you've heard them before moving to next steps
- Balance empathy with gentle progression toward resolution
- Avoid dismissive phrases like "don't worry" or "it's fine"

Remember: Validation builds trust and helps the conversation move forward productively.`,
    },
    {
      slug: "prompt-slug-emotion-reassuring",
      name: "Emotion: Reassuring",
      category: "emotion",
      slugId: "emotion.reassuring",
      description: "Use when caller needs confidence boost. Provides supportive, encouraging tone.",
      promptTemplate: `You are speaking with someone who may be feeling uncertain or lacking confidence.

Your approach should be:
- Provide clear, confident guidance
- Affirm their ability to handle the situation
- Use supportive language: "You've got this", "That's a great question"
- Share relevant information that builds their confidence
- Celebrate small wins and progress
- Be patient with questions they might feel are "obvious"

Remember: Your confidence and support can help them feel more capable.`,
    },
    {
      slug: "prompt-slug-emotion-deescalate",
      name: "Emotion: De-escalate",
      category: "emotion",
      slugId: "emotion.deescalate",
      description: "Use when caller is frustrated or angry. Focuses on lowering emotional temperature.",
      promptTemplate: `You are speaking with someone who is frustrated or upset.

Your approach should be:
- Stay calm and professional regardless of their tone
- Do NOT match their energy - remain steady and grounded
- Acknowledge their frustration explicitly: "I can hear you're frustrated"
- Avoid defensive language or making excuses
- Focus on what you CAN do, not what you can't
- If needed, pause and say "Let me make sure I understand correctly"
- Look for common ground and shared goals

Remember: De-escalation requires you to be the calm anchor in the conversation.`,
    },
    {
      slug: "prompt-slug-emotion-grounding",
      name: "Emotion: Grounding",
      category: "emotion",
      slugId: "emotion.grounding",
      description: "Use when caller seems overwhelmed. Helps bring them back to the present moment.",
      promptTemplate: `You are speaking with someone who seems overwhelmed or scattered.

Your approach should be:
- Help them focus on one thing at a time
- Use concrete, specific language
- Gently redirect if they spiral into multiple concerns
- Offer to break things down: "Let's take this one step at a time"
- Use present-tense, action-oriented phrases
- Summarize and confirm before moving forward

Remember: Your clarity and structure can help them feel more in control.`,
    },

    // CONTROL category - for managing conversation flow
    {
      slug: "prompt-slug-control-redirect",
      name: "Control: Redirect",
      category: "control",
      slugId: "control.redirect",
      description: "Use to gently steer conversation back on track without being dismissive.",
      promptTemplate: `The conversation may need gentle redirection to stay productive.

Your approach should be:
- Acknowledge what they've said briefly before redirecting
- Use bridging phrases: "That's interesting, and related to that..."
- Keep the redirect natural, not abrupt
- Connect back to their original goal or question
- If they persist off-topic, be more direct but kind

Example: "I appreciate you sharing that. To make sure we address your main concern today, let's focus on..."`,
    },
    {
      slug: "prompt-slug-control-clarify",
      name: "Control: Clarify",
      category: "control",
      slugId: "control.clarify",
      description: "Use when you need more information or the request is ambiguous.",
      promptTemplate: `You need to gather more information to help effectively.

Your approach should be:
- Ask clear, specific questions
- Avoid asking multiple questions at once
- Use open-ended questions when exploring, closed when confirming
- Summarize your understanding and ask if it's correct
- Be patient - some people need time to articulate their needs

Example: "Just to make sure I understand - you're looking for X, is that right?"`,
    },
    {
      slug: "prompt-slug-control-summarise",
      name: "Control: Summarise",
      category: "control",
      slugId: "control.summarise",
      description: "Use to consolidate discussion and confirm shared understanding.",
      promptTemplate: `It's time to consolidate what's been discussed.

Your approach should be:
- Provide a clear, concise summary of key points
- Highlight any decisions or agreements made
- Note any outstanding questions or next steps
- Ask for confirmation: "Does that capture everything?"
- Correct any misunderstandings before proceeding

Example: "Let me make sure I've got this right. You need X by Y, and we've agreed to Z. Is there anything I've missed?"`,
    },
    {
      slug: "prompt-slug-control-slow-down",
      name: "Control: Slow Down",
      category: "control",
      slugId: "control.slow_down",
      description: "Use when conversation is moving too fast or caller seems rushed.",
      promptTemplate: `The conversation pace may need to slow down.

Your approach should be:
- Gently pump the brakes without being patronizing
- Take deliberate pauses in your responses
- Break complex information into smaller pieces
- Check understanding before moving forward
- Use phrases like "Let's make sure we're on the same page"

Remember: It's better to go slow and get it right than rush and create confusion.`,
    },
    {
      slug: "prompt-slug-control-close-topic",
      name: "Control: Close Topic",
      category: "control",
      slugId: "control.close_topic",
      description: "Use to wrap up a topic and transition to the next.",
      promptTemplate: `It's time to close this topic and potentially move on.

Your approach should be:
- Signal that the topic is wrapping up
- Summarize any conclusions or actions
- Ask if there's anything else on this topic
- Provide a clear transition to the next topic or end
- Make sure they feel the topic was adequately addressed

Example: "I think we've covered X thoroughly. Is there anything else you'd like to discuss about this, or shall we move on?"`,
    },

    // MEMORY category - for eliciting stories and connecting to past
    {
      slug: "prompt-slug-memory-elicit-story",
      name: "Memory: Elicit Story",
      category: "memory",
      slugId: "memory.elicit_story",
      description: "Use to draw out personal narratives and experiences.",
      promptTemplate: `You have an opportunity to learn more about this person through their stories.

Your approach should be:
- Show genuine curiosity about their experiences
- Ask open-ended questions about specific events
- Use prompts like "Tell me about a time when..." or "What was that like?"
- Listen actively and ask follow-up questions
- Connect their stories to the current conversation when relevant
- Remember details they share for future reference

Remember: Stories reveal values, preferences, and personality. They're gold for personalization.`,
    },
    {
      slug: "prompt-slug-memory-anchor-identity",
      name: "Memory: Anchor Identity",
      category: "memory",
      slugId: "memory.anchor_identity",
      description: "Use to reinforce positive aspects of their self-image.",
      promptTemplate: `You can help reinforce positive aspects of this person's identity.

Your approach should be:
- Reference things they've shared about themselves
- Acknowledge their strengths, skills, or values
- Connect their current situation to positive past experiences
- Use phrases like "As someone who values X, you might..."
- Help them see themselves as capable and resourceful

Remember: People respond well when they feel seen and understood.`,
    },
    {
      slug: "prompt-slug-memory-reflect-past",
      name: "Memory: Reflect Past",
      category: "memory",
      slugId: "memory.reflect_past",
      description: "Use to help them draw insights from past experiences.",
      promptTemplate: `Help them connect past experiences to current insights.

Your approach should be:
- Reference past situations they've navigated successfully
- Ask what they learned from previous experiences
- Help them see patterns in their own history
- Use phrases like "You mentioned before that..." or "Last time this came up..."
- Draw parallels between past and present constructively

Remember: Past experience is a valuable resource for current challenges.`,
    },
    {
      slug: "prompt-slug-memory-link-events",
      name: "Memory: Link Events",
      category: "memory",
      slugId: "memory.link_events",
      description: "Use to help them see connections between different experiences.",
      promptTemplate: `Help them see meaningful connections between events or experiences.

Your approach should be:
- Point out patterns you've noticed across their stories
- Ask if they see connections between different experiences
- Help them build a coherent narrative
- Use phrases like "This reminds me of when you mentioned..."
- Be tentative - let them confirm or correct your observations

Remember: Making connections helps people feel understood and builds insight.`,
    },

    // ENGAGE category - for encouraging action and participation
    {
      slug: "prompt-slug-engage-encourage",
      name: "Engage: Encourage",
      category: "engage",
      slugId: "engage.encourage",
      description: "Use to motivate and energize the conversation.",
      promptTemplate: `This person could benefit from encouragement and positive energy.

Your approach should be:
- Be warm and enthusiastic (but genuine, not fake)
- Celebrate their progress, however small
- Express confidence in their abilities
- Use energizing language: "That's great!", "You're making progress"
- Share relevant positive examples or outcomes
- Avoid over-the-top enthusiasm that feels inauthentic

Remember: Genuine encouragement builds confidence and momentum.`,
    },
    {
      slug: "prompt-slug-engage-prompt-action",
      name: "Engage: Prompt Action",
      category: "engage",
      slugId: "engage.prompt_action",
      description: "Use to move from discussion to concrete next steps.",
      promptTemplate: `It's time to translate discussion into action.

Your approach should be:
- Be specific about what actions could be taken
- Break larger goals into manageable steps
- Ask about their preferences for how to proceed
- Set clear expectations about timelines and outcomes
- Offer support for the action: "Would it help if I..."
- Follow up on commitments made

Example: "Based on what we've discussed, the next step would be X. Would you like to do that now, or would you prefer to..."`,
    },
    {
      slug: "prompt-slug-engage-curiosity",
      name: "Engage: Curiosity",
      category: "engage",
      slugId: "engage.curiosity",
      description: "Use to spark intellectual engagement and exploration.",
      promptTemplate: `This person responds well to intellectual stimulation and exploration.

Your approach should be:
- Ask thought-provoking questions
- Explore "what if" scenarios together
- Share interesting related information or perspectives
- Encourage them to think through implications
- Be genuinely curious yourself - it's contagious
- Avoid being pedantic or showing off

Remember: Curiosity-driven conversations are engaging and memorable.`,
    },
    {
      slug: "prompt-slug-engage-future-oriented",
      name: "Engage: Future Oriented",
      category: "engage",
      slugId: "engage.future_oriented",
      description: "Use to focus on goals, possibilities, and positive outcomes.",
      promptTemplate: `Help them focus on future possibilities and positive outcomes.

Your approach should be:
- Ask about their goals and aspirations
- Paint a picture of positive future states
- Help them envision success
- Use future-tense language: "When you achieve X..."
- Connect current actions to future benefits
- Be realistic but optimistic

Remember: A future-oriented mindset can be motivating and energizing.`,
    },
  ];

  // Create all prompt slug templates
  let slugsCreated = 0;
  for (const template of promptSlugTemplates) {
    await prisma.analysisSpec.upsert({
      where: { slug: template.slug },
      update: {
        name: template.name,
        description: template.description,
        scope: "SYSTEM" as SpecificationScope,
        outputType: "COMPOSE" as AnalysisOutputType,
        domain: "prompt-slugs",
        priority: 50,
        isActive: true,
        isDirty: false,
        promptTemplate: template.promptTemplate,
        config: {
          category: template.category,
          slugId: template.slugId,
        },
      },
      create: {
        slug: template.slug,
        name: template.name,
        description: template.description,
        scope: "SYSTEM" as SpecificationScope,
        outputType: "COMPOSE" as AnalysisOutputType,
        domain: "prompt-slugs",
        priority: 50,
        isActive: true,
        isDirty: false,
        promptTemplate: template.promptTemplate,
        config: {
          category: template.category,
          slugId: template.slugId,
        },
      },
    });
    slugsCreated++;
  }

  console.log(`   ✓ Created ${slugsCreated} prompt slug templates`);

  // ============================================
  // 8. COMPOSE_NEXT_PROMPT SPEC - Structured prompt composition
  // ============================================
  console.log("📋 Creating COMPOSE_NEXT_PROMPT spec for structured prompt generation...");

  const composeNextPromptSpec = await prisma.analysisSpec.upsert({
    where: { slug: "system-compose-next-prompt" },
    update: {
      name: "Compose Next Prompt",
      description: `Configures the structured prompt composition for agent guidance.

Defines:
- Threshold levels for interpreting target values (high/moderate-high/balanced/moderate-low/low)
- Confidence thresholds for qualifier text
- Parameter groupings by category (style, engagement, adaptability)
- Time windows for recent activity

All values are configurable to allow tuning without code changes.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "COMPOSE" as AnalysisOutputType,
      domain: "compose-next-prompt",
      priority: 100,
      isActive: true,
      isDirty: false,
      config: {
        // Threshold levels for interpreting target values (0-1 scale)
        targetLevelThresholds: {
          high: 0.8,           // >= 0.8 = high
          moderateHigh: 0.6,   // >= 0.6 = moderate-high
          balanced: 0.4,       // >= 0.4 = balanced
          moderateLow: 0.2,    // >= 0.2 = moderate-low
          // < 0.2 = low
        },
        // Confidence thresholds for qualifier text
        confidenceThresholds: {
          stillLearning: 0.4,      // < 0.4 = "(still learning - be flexible)"
          wellEstablished: 0.7,   // > 0.7 = "(well-established preference)"
          // between = no qualifier
        },
        // Parameter groupings by category (for prompt sections)
        parameterGroups: {
          communicationStyle: [
            "BEH-FORMALITY",
            "BEH-RESPONSE-LEN",
            "BEH-WARMTH",
            "BEH-DIRECTNESS",
          ],
          engagementApproach: [
            "BEH-EMPATHY-RATE",
            "BEH-QUESTION-RATE",
            "BEH-ACTIVE-LISTEN",
            "BEH-PROACTIVE",
          ],
          adaptability: [
            "BEH-MIRROR-STYLE",
            "BEH-PACE-MATCH",
            "BEH-ROLE-SWITCH",
            "BEH-PERSONALIZATION",
          ],
        },
        // Personality traits for Big Five display
        personalityTraits: {
          thresholdHigh: 0.7,
          thresholdLow: 0.3,
          traitIds: ["B5-O", "B5-C", "B5-E", "B5-A", "B5-N"],
          traitNames: {
            "B5-O": "Openness",
            "B5-C": "Conscientiousness",
            "B5-E": "Extraversion",
            "B5-A": "Agreeableness",
            "B5-N": "Neuroticism",
          },
        },
        // Time windows
        timeWindows: {
          maxAgeHours: 24,           // Max hours since last call for "recent" context
          recentActivityDays: 30,    // Days to consider for recent activity check
        },
      },
    },
    create: {
      slug: "system-compose-next-prompt",
      name: "Compose Next Prompt",
      description: `Configures the structured prompt composition for agent guidance.

Defines:
- Threshold levels for interpreting target values (high/moderate-high/balanced/moderate-low/low)
- Confidence thresholds for qualifier text
- Parameter groupings by category (style, engagement, adaptability)
- Time windows for recent activity

All values are configurable to allow tuning without code changes.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "COMPOSE" as AnalysisOutputType,
      domain: "compose-next-prompt",
      priority: 100,
      isActive: true,
      isDirty: false,
      config: {
        targetLevelThresholds: {
          high: 0.8,
          moderateHigh: 0.6,
          balanced: 0.4,
          moderateLow: 0.2,
        },
        confidenceThresholds: {
          stillLearning: 0.4,
          wellEstablished: 0.7,
        },
        parameterGroups: {
          communicationStyle: [
            "BEH-FORMALITY",
            "BEH-RESPONSE-LEN",
            "BEH-WARMTH",
            "BEH-DIRECTNESS",
          ],
          engagementApproach: [
            "BEH-EMPATHY-RATE",
            "BEH-QUESTION-RATE",
            "BEH-ACTIVE-LISTEN",
            "BEH-PROACTIVE",
          ],
          adaptability: [
            "BEH-MIRROR-STYLE",
            "BEH-PACE-MATCH",
            "BEH-ROLE-SWITCH",
            "BEH-PERSONALIZATION",
          ],
        },
        personalityTraits: {
          thresholdHigh: 0.7,
          thresholdLow: 0.3,
          traitIds: ["B5-O", "B5-C", "B5-E", "B5-A", "B5-N"],
          traitNames: {
            "B5-O": "Openness",
            "B5-C": "Conscientiousness",
            "B5-E": "Extraversion",
            "B5-A": "Agreeableness",
            "B5-N": "Neuroticism",
          },
        },
        timeWindows: {
          maxAgeHours: 24,
          recentActivityDays: 30,
        },
      },
    },
  });

  console.log(`   ✓ Created: ${composeNextPromptSpec.slug}`);

  // ============================================
  // 9. MEASURE_AGENT SPEC - Agent behavior measurement
  // ============================================
  console.log("📏 Creating MEASURE_AGENT spec for agent behavior measurement...");

  const measureAgentSpec = await prisma.analysisSpec.upsert({
    where: { slug: "system-measure-agent" },
    update: {
      name: "Agent Behavior Measurement",
      description: `Measures agent behavior from transcripts using LLM analysis.

Analyzes conversation transcripts to score agent behavior on various dimensions:
- Empathy and emotional responsiveness
- Question asking and engagement
- Response length and verbosity
- Warmth and tone
- Active listening indicators

The promptTemplate guides the LLM on how to analyze and score behaviors.
The config contains scoring calibration and evidence markers.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "MEASURE_AGENT" as AnalysisOutputType,
      domain: "agent-behavior",
      priority: 100,
      isActive: true,
      isDirty: false,
      promptTemplate: `You are an expert at analyzing conversation transcripts to measure agent behavior.

Analyze the following transcript and score the agent on the specified behavior parameter.

## Parameter to Score
Parameter ID: {{parameterId}}
Parameter Name: {{parameterName}}
Definition: {{parameterDefinition}}

## Scoring Guidelines
- Score on a 0.0 to 1.0 scale where:
  - 0.0-0.2: Very low/absent
  - 0.2-0.4: Below average
  - 0.4-0.6: Average/moderate
  - 0.6-0.8: Above average
  - 0.8-1.0: Very high/excellent

## Evidence Markers to Look For
{{#evidenceMarkers}}
- {{.}}
{{/evidenceMarkers}}

## Transcript
{{transcript}}

## Response Format
Respond with a JSON object:
{
  "score": <number between 0.0 and 1.0>,
  "confidence": <number between 0.0 and 1.0>,
  "evidence": ["<specific quote or observation>", ...],
  "reasoning": "<brief explanation of the score>"
}`,
      config: {
        // Scoring calibration
        scoring: {
          minScore: 0.0,
          maxScore: 1.0,
          defaultConfidence: 0.7,
          confidenceRange: { min: 0.5, max: 0.95 },
        },
        // Evidence markers by parameter type
        evidenceMarkers: {
          empathy: [
            "I understand",
            "That sounds difficult",
            "I hear you",
            "It makes sense that",
            "I appreciate",
            "Thank you for sharing",
          ],
          warmth: [
            "Thank you",
            "Please",
            "Happy to help",
            "Glad",
            "Wonderful",
            "Great",
            "Appreciate",
          ],
          questionAsking: [
            "?",
            "Could you tell me",
            "What would",
            "How can I",
            "Would you like",
          ],
          activeListening: [
            "So what you're saying",
            "If I understand correctly",
            "Let me make sure",
            "You mentioned",
            "Earlier you said",
          ],
        },
        // Mock scoring config (for development)
        mockScoring: {
          baseScoreRange: { min: 0.3, max: 0.8 },
          empathyDivisor: 10,
          responseLengthMax: 100,
          questionRateDivisor: 3,
          warmthDivisor: 8,
          confidenceRange: { min: 0.6, max: 0.9 },
        },
      },
    },
    create: {
      slug: "system-measure-agent",
      name: "Agent Behavior Measurement",
      description: `Measures agent behavior from transcripts using LLM analysis.

Analyzes conversation transcripts to score agent behavior on various dimensions:
- Empathy and emotional responsiveness
- Question asking and engagement
- Response length and verbosity
- Warmth and tone
- Active listening indicators

The promptTemplate guides the LLM on how to analyze and score behaviors.
The config contains scoring calibration and evidence markers.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "MEASURE_AGENT" as AnalysisOutputType,
      domain: "agent-behavior",
      priority: 100,
      isActive: true,
      isDirty: false,
      promptTemplate: `You are an expert at analyzing conversation transcripts to measure agent behavior.

Analyze the following transcript and score the agent on the specified behavior parameter.

## Parameter to Score
Parameter ID: {{parameterId}}
Parameter Name: {{parameterName}}
Definition: {{parameterDefinition}}

## Scoring Guidelines
- Score on a 0.0 to 1.0 scale where:
  - 0.0-0.2: Very low/absent
  - 0.2-0.4: Below average
  - 0.4-0.6: Average/moderate
  - 0.6-0.8: Above average
  - 0.8-1.0: Very high/excellent

## Evidence Markers to Look For
{{#evidenceMarkers}}
- {{.}}
{{/evidenceMarkers}}

## Transcript
{{transcript}}

## Response Format
Respond with a JSON object:
{
  "score": <number between 0.0 and 1.0>,
  "confidence": <number between 0.0 and 1.0>,
  "evidence": ["<specific quote or observation>", ...],
  "reasoning": "<brief explanation of the score>"
}`,
      config: {
        scoring: {
          minScore: 0.0,
          maxScore: 1.0,
          defaultConfidence: 0.7,
          confidenceRange: { min: 0.5, max: 0.95 },
        },
        evidenceMarkers: {
          empathy: [
            "I understand",
            "That sounds difficult",
            "I hear you",
            "It makes sense that",
            "I appreciate",
            "Thank you for sharing",
          ],
          warmth: [
            "Thank you",
            "Please",
            "Happy to help",
            "Glad",
            "Wonderful",
            "Great",
            "Appreciate",
          ],
          questionAsking: [
            "?",
            "Could you tell me",
            "What would",
            "How can I",
            "Would you like",
          ],
          activeListening: [
            "So what you're saying",
            "If I understand correctly",
            "Let me make sure",
            "You mentioned",
            "Earlier you said",
          ],
        },
        mockScoring: {
          baseScoreRange: { min: 0.3, max: 0.8 },
          empathyDivisor: 10,
          responseLengthMax: 100,
          questionRateDivisor: 3,
          warmthDivisor: 8,
          confidenceRange: { min: 0.6, max: 0.9 },
        },
      },
    },
  });

  console.log(`   ✓ Created: ${measureAgentSpec.slug}`);

  // ============================================
  // 10. MEMORY TAXONOMY SPEC - Memory key normalization and category mapping
  // ============================================
  console.log("🧠 Creating MEMORY_TAXONOMY spec for memory extraction...");

  const memoryTaxonomySpec = await prisma.analysisSpec.upsert({
    where: { slug: "system-memory-taxonomy" },
    update: {
      name: "Memory Taxonomy",
      description: `Defines the taxonomy for memory extraction and normalization.

Contains:
- Key normalization mappings (e.g., "city" -> "location", "job" -> "occupation")
- Category mappings (e.g., "BIOGRAPHICAL" -> "FACT")
- Domain to category mappings for LEARN specs
- Confidence thresholds for memory creation

All memory extraction uses this taxonomy for consistent key naming and categorization.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "LEARN" as AnalysisOutputType,
      domain: "memory-taxonomy",
      priority: 100,
      isActive: true,
      isDirty: false,
      config: {
        // Key normalization mappings - canonical keys for deduplication
        keyNormalization: {
          // Location variants
          location: "location",
          city: "location",
          town: "location",
          lives_in: "location",
          residence: "location",
          home_city: "location",
          home_location: "location",
          // Job variants
          job: "occupation",
          job_title: "occupation",
          occupation: "occupation",
          profession: "occupation",
          work: "occupation",
          role: "occupation",
          position: "occupation",
          works_at: "employer",
          employer: "employer",
          company: "employer",
          organization: "employer",
          // Family variants
          spouse: "spouse",
          wife: "spouse",
          husband: "spouse",
          partner: "spouse",
          kids: "children_count",
          children: "children_count",
          children_count: "children_count",
          number_of_kids: "children_count",
          // Contact preferences
          contact_method: "preferred_contact",
          preferred_contact: "preferred_contact",
          contact_preference: "preferred_contact",
          best_way_to_reach: "preferred_contact",
          response_length: "response_length_preference",
          preferred_length: "response_length_preference",
          // Name variants
          name: "name",
          full_name: "name",
          first_name: "first_name",
          last_name: "last_name",
          nickname: "nickname",
          // Age/Birthday
          age: "age",
          birthday: "birthday",
          date_of_birth: "birthday",
          dob: "birthday",
        },
        // Category mappings - normalize various category names to MemoryCategory enum
        categoryMappings: {
          // Map to FACT
          BIOGRAPHICAL: "FACT",
          PERSONAL: "FACT",
          DEMOGRAPHIC: "FACT",
          FACTS: "FACT",
          INFO: "FACT",
          // Map to PREFERENCE
          LIKE: "PREFERENCE",
          DISLIKE: "PREFERENCE",
          PREFER: "PREFERENCE",
          PREFERENCES: "PREFERENCE",
          LIKES: "PREFERENCE",
          DISLIKES: "PREFERENCE",
          // Map to EVENT
          APPOINTMENT: "EVENT",
          MEETING: "EVENT",
          HISTORY: "EVENT",
          EVENTS: "EVENT",
          TIMELINE: "EVENT",
          // Map to TOPIC
          INTEREST: "TOPIC",
          DISCUSSION: "TOPIC",
          TOPICS: "TOPIC",
          INTERESTS: "TOPIC",
          // Map to RELATIONSHIP
          FAMILY: "RELATIONSHIP",
          FRIEND: "RELATIONSHIP",
          COLLEAGUE: "RELATIONSHIP",
          RELATIONSHIPS: "RELATIONSHIP",
          PEOPLE: "RELATIONSHIP",
          // Map to CONTEXT
          SITUATION: "CONTEXT",
          TEMPORARY: "CONTEXT",
          CURRENT: "CONTEXT",
        },
        // Domain to category mappings for LEARN specs
        domainCategoryMappings: {
          fact: "FACT",
          personal: "FACT",
          preference: "PREFERENCE",
          like: "PREFERENCE",
          event: "EVENT",
          history: "EVENT",
          topic: "TOPIC",
          interest: "TOPIC",
          relationship: "RELATIONSHIP",
          family: "RELATIONSHIP",
          context: "CONTEXT",
          situation: "CONTEXT",
        },
        // Confidence thresholds
        confidenceThresholds: {
          default: 0.5,
          highConfidence: 0.8,
          lowConfidence: 0.3,
        },
        // Default category when no mapping found
        defaultCategory: "FACT",
      },
    },
    create: {
      slug: "system-memory-taxonomy",
      name: "Memory Taxonomy",
      description: `Defines the taxonomy for memory extraction and normalization.

Contains:
- Key normalization mappings (e.g., "city" -> "location", "job" -> "occupation")
- Category mappings (e.g., "BIOGRAPHICAL" -> "FACT")
- Domain to category mappings for LEARN specs
- Confidence thresholds for memory creation

All memory extraction uses this taxonomy for consistent key naming and categorization.`,
      scope: "SYSTEM" as SpecificationScope,
      outputType: "LEARN" as AnalysisOutputType,
      domain: "memory-taxonomy",
      priority: 100,
      isActive: true,
      isDirty: false,
      config: {
        keyNormalization: {
          location: "location",
          city: "location",
          town: "location",
          lives_in: "location",
          residence: "location",
          home_city: "location",
          home_location: "location",
          job: "occupation",
          job_title: "occupation",
          occupation: "occupation",
          profession: "occupation",
          work: "occupation",
          role: "occupation",
          position: "occupation",
          works_at: "employer",
          employer: "employer",
          company: "employer",
          organization: "employer",
          spouse: "spouse",
          wife: "spouse",
          husband: "spouse",
          partner: "spouse",
          kids: "children_count",
          children: "children_count",
          children_count: "children_count",
          number_of_kids: "children_count",
          contact_method: "preferred_contact",
          preferred_contact: "preferred_contact",
          contact_preference: "preferred_contact",
          best_way_to_reach: "preferred_contact",
          response_length: "response_length_preference",
          preferred_length: "response_length_preference",
          name: "name",
          full_name: "name",
          first_name: "first_name",
          last_name: "last_name",
          nickname: "nickname",
          age: "age",
          birthday: "birthday",
          date_of_birth: "birthday",
          dob: "birthday",
        },
        categoryMappings: {
          BIOGRAPHICAL: "FACT",
          PERSONAL: "FACT",
          DEMOGRAPHIC: "FACT",
          FACTS: "FACT",
          INFO: "FACT",
          LIKE: "PREFERENCE",
          DISLIKE: "PREFERENCE",
          PREFER: "PREFERENCE",
          PREFERENCES: "PREFERENCE",
          LIKES: "PREFERENCE",
          DISLIKES: "PREFERENCE",
          APPOINTMENT: "EVENT",
          MEETING: "EVENT",
          HISTORY: "EVENT",
          EVENTS: "EVENT",
          TIMELINE: "EVENT",
          INTEREST: "TOPIC",
          DISCUSSION: "TOPIC",
          TOPICS: "TOPIC",
          INTERESTS: "TOPIC",
          FAMILY: "RELATIONSHIP",
          FRIEND: "RELATIONSHIP",
          COLLEAGUE: "RELATIONSHIP",
          RELATIONSHIPS: "RELATIONSHIP",
          PEOPLE: "RELATIONSHIP",
          SITUATION: "CONTEXT",
          TEMPORARY: "CONTEXT",
          CURRENT: "CONTEXT",
        },
        domainCategoryMappings: {
          fact: "FACT",
          personal: "FACT",
          preference: "PREFERENCE",
          like: "PREFERENCE",
          event: "EVENT",
          history: "EVENT",
          topic: "TOPIC",
          interest: "TOPIC",
          relationship: "RELATIONSHIP",
          family: "RELATIONSHIP",
          context: "CONTEXT",
          situation: "CONTEXT",
        },
        confidenceThresholds: {
          default: 0.5,
          highConfidence: 0.8,
          lowConfidence: 0.3,
        },
        defaultCategory: "FACT",
      },
    },
  });

  console.log(`   ✓ Created: ${memoryTaxonomySpec.slug}`);

  console.log("\n✅ System specs seeding complete!\n");
  console.log("Created specs:");
  console.log(`  - ${aggregateSpec.slug} (AGGREGATE)`);
  console.log(`  - ${composeSpec.slug} (COMPOSE)`);
  console.log(`  - ${rewardSpec.slug} (REWARD)`);
  console.log(`  - ${llmConfigSpec.slug} (config)`);
  console.log(`  - ${targetLearnSpec.slug} (ADAPT/targets)`);
  console.log(`  - ${slugSelectSpec.slug} (COMPOSE/slug-select)`);
  console.log(`  - ${slugsCreated} prompt slug templates (COMPOSE/prompt-slugs)`);
  console.log(`  - ${composeNextPromptSpec.slug} (COMPOSE/compose-next-prompt)`);
  console.log(`  - ${measureAgentSpec.slug} (MEASURE_AGENT/agent-behavior)`);
  console.log(`  - ${memoryTaxonomySpec.slug} (LEARN/memory-taxonomy)`);
}

main()
  .catch((e) => {
    console.error("Error seeding system specs:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
