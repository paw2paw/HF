/**
 * Complete Specs Seed - Adds missing prompt templates to all specs
 *
 * This seed ensures ALL specs have fully populated promptTemplate fields.
 * Run this AFTER seed-mvp-cognitive-activation.ts and seed-system-specs.ts
 *
 * Specs that need prompt templates:
 * - system-personality-aggregate (AGGREGATE)
 * - system-reward-compute (REWARD)
 * - system-target-learn (ADAPT)
 * - system-slug-select (COMPOSE)
 * - system-compose-next-prompt (COMPOSE)
 * - system-memory-taxonomy (LEARN)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Complete prompt templates for all system specs
const specPromptTemplates: Record<string, string> = {
  // ============================================
  // AGGREGATE: Personality Aggregation
  // ============================================
  "system-personality-aggregate": `You are an expert at aggregating personality observations into a coherent profile.

## Task
Analyze the provided personality observations and create an aggregated personality profile.

## Input Data
### Recent Observations
{{#observations}}
- Call: {{callId}} ({{callDate}})
  - Openness: {{openness}} (confidence: {{opennessConfidence}})
  - Conscientiousness: {{conscientiousness}} (confidence: {{conscientiousnessConfidence}})
  - Extraversion: {{extraversion}} (confidence: {{extraversionConfidence}})
  - Agreeableness: {{agreeableness}} (confidence: {{agreeablenessConfidence}})
  - Neuroticism: {{neuroticism}} (confidence: {{neuroticismConfidence}})
{{/observations}}

### Current Profile (if exists)
{{#currentProfile}}
- Openness: {{openness}}
- Conscientiousness: {{conscientiousness}}
- Extraversion: {{extraversion}}
- Agreeableness: {{agreeableness}}
- Neuroticism: {{neuroticism}}
- Observation Count: {{observationCount}}
{{/currentProfile}}
{{^currentProfile}}
No existing profile - this is the first aggregation.
{{/currentProfile}}

## Aggregation Rules
1. Weight recent observations more heavily than older ones (half-life: {{halfLifeDays}} days)
2. Higher confidence observations should have more influence
3. Look for consistent patterns vs one-off outliers
4. Flag any significant changes from the current profile

## Output Format
Respond with a JSON object:
{
  "aggregatedProfile": {
    "openness": <0.0-1.0>,
    "conscientiousness": <0.0-1.0>,
    "extraversion": <0.0-1.0>,
    "agreeableness": <0.0-1.0>,
    "neuroticism": <0.0-1.0>
  },
  "confidence": <0.0-1.0>,
  "observationCount": <total observations considered>,
  "reasoning": "<brief explanation of aggregation decisions>",
  "significantChanges": ["<any notable shifts from previous profile>"]
}`,

  // ============================================
  // REWARD: Reward Computation
  // ============================================
  "system-reward-compute": `You are an expert at evaluating agent performance based on behavior measurements.

## Task
Compute a reward score that reflects how well the agent performed in this conversation.

## Input Data
### Behavior Measurements
{{#measurements}}
- {{parameterId}}: {{score}} (target: {{targetValue}}, confidence: {{confidence}})
  - Delta from target: {{delta}}
  - Within tolerance: {{withinTolerance}}
{{/measurements}}

### Call Outcome Signals
- Resolution indicators: {{resolutionIndicators}}
- Escalation indicators: {{escalationIndicators}}
- Sentiment trajectory: {{sentimentTrajectory}}
- Final user sentiment: {{finalSentiment}}

### Configuration
- Behavior weight: {{behaviorWeight}}
- Outcome weight: {{outcomeWeight}}
- Tolerance: {{tolerance}}

## Reward Computation Rules
1. Behavior Score = Average of (1 - |actual - target| / tolerance) for each parameter, capped at [0, 1]
2. Outcome Score = Weighted sum of outcome signals
3. Final Reward = (behaviorWeight × behaviorScore) + (outcomeWeight × outcomeScore)

## Scoring Guidelines
- Perfect match to target = 1.0 for that parameter
- Within tolerance = partial credit (linear decay)
- Outside tolerance = 0.0 for that parameter
- Positive outcome signals add to reward
- Negative outcome signals subtract from reward

## Output Format
Respond with a JSON object:
{
  "behaviorScore": <0.0-1.0>,
  "outcomeScore": <-1.0 to 1.0>,
  "finalReward": <0.0-1.0>,
  "parameterScores": {
    "<parameterId>": {
      "score": <0.0-1.0>,
      "delta": <actual - target>,
      "reward": <contribution to behavior score>
    }
  },
  "outcomeBreakdown": {
    "resolved": <boolean>,
    "escalated": <boolean>,
    "sentimentImproved": <boolean>
  },
  "reasoning": "<explanation of reward computation>"
}`,

  // ============================================
  // ADAPT: Target Learning
  // ============================================
  "system-target-learn": `You are an expert at adjusting behavior targets based on outcome feedback.

## Task
Recommend adjustments to behavior targets based on this call's outcome and measurements.

## Input Data
### Current Targets
{{#targets}}
- {{parameterId}}: {{targetValue}} (confidence: {{confidence}})
  - Source: {{source}}
  - Effective since: {{effectiveFrom}}
{{/targets}}

### This Call's Results
- Reward score: {{rewardScore}}
- Outcome: {{outcome}} ({{outcomeQuality}})

### Measurements vs Targets
{{#comparisons}}
- {{parameterId}}:
  - Target: {{targetValue}}
  - Actual: {{actualValue}}
  - Hit target: {{hitTarget}}
  - Good outcome: {{goodOutcome}}
{{/comparisons}}

### Learning Configuration
- Learning rate: {{learningRate}}
- Tolerance: {{tolerance}}
- Min confidence: {{minConfidence}}
- Max confidence: {{maxConfidence}}

## Adjustment Logic
For each parameter, evaluate:
1. Good outcome + Hit target → Reinforce (increase confidence)
2. Good outcome + Missed target → Adjust target toward actual
3. Bad outcome + Hit target → Re-evaluate target (decrease confidence)
4. Bad outcome + Missed target → Adjust target away from actual

## Output Format
Respond with a JSON object:
{
  "adjustments": [
    {
      "parameterId": "<parameter>",
      "currentTarget": <current value>,
      "newTarget": <adjusted value or null if no change>,
      "currentConfidence": <current>,
      "newConfidence": <adjusted>,
      "scenario": "reinforce|adjust_toward|reevaluate|adjust_away",
      "reasoning": "<why this adjustment>"
    }
  ],
  "summary": "<overall learning summary>",
  "totalAdjustments": <count of changes>
}`,

  // ============================================
  // COMPOSE: Slug Selection
  // ============================================
  "system-slug-select": `You are an expert at selecting the optimal prompt slug for a conversation.

## Task
Select the most appropriate prompt slug based on the caller's personality profile and current context.

## Input Data
### Caller Personality
{{#personality}}
- Openness: {{openness}}
- Conscientiousness: {{conscientiousness}}
- Extraversion: {{extraversion}}
- Agreeableness: {{agreeableness}}
- Neuroticism: {{neuroticism}}
{{/personality}}

### Recent Context
{{#recentContext}}
- Last call: {{lastCallDate}}
- Topics discussed: {{topics}}
- Emotional state: {{emotionalState}}
- Unresolved issues: {{unresolvedIssues}}
{{/recentContext}}

### Available Slugs by Category
{{#categories}}
#### {{category}}
{{#slugs}}
- {{slugId}}: {{description}}
{{/slugs}}
{{/categories}}

### Recently Used Slugs (avoid repetition)
{{#recentSlugs}}
- {{slugId}} (used {{usedAt}})
{{/recentSlugs}}

## Selection Rules
1. High neuroticism (>{{thresholds.highNeuroticism}}) → Prefer emotion category slugs
2. High extraversion (>{{thresholds.highExtraversion}}) → Prefer engage category slugs
3. High conscientiousness (>{{thresholds.highConscientiousness}}) → Prefer control category slugs
4. High openness (>{{thresholds.highOpenness}}) → Prefer engage.curiosity
5. Low openness + High agreeableness → Prefer memory category slugs
6. Avoid slugs used in last {{maxRecentSlugs}} calls

## Output Format
Respond with a JSON object:
{
  "selectedSlug": "<slug.id>",
  "category": "<category>",
  "confidence": <0.0-1.0>,
  "reasoning": "<why this slug fits>",
  "alternatives": [
    {
      "slug": "<alternative.slug>",
      "confidence": <0.0-1.0>,
      "reason": "<why this is a good alternative>"
    }
  ]
}`,

  // ============================================
  // COMPOSE: Compose Next Prompt
  // ============================================
  "system-compose-next-prompt": `You are an expert at composing personalized agent guidance prompts.

## Task
Compose a complete agent guidance prompt for the next conversation with this caller.

## Input Data
### Caller Profile
{{#caller}}
- Name: {{name}}
- Calls to date: {{callCount}}
- Last call: {{lastCallDate}}
{{/caller}}

### Personality Profile
{{#personality}}
- Openness: {{openness}} ({{opennessLabel}})
- Conscientiousness: {{conscientiousness}} ({{conscientiousnessLabel}})
- Extraversion: {{extraversion}} ({{extraversionLabel}})
- Agreeableness: {{agreeableness}} ({{agreeablenessLabel}})
- Neuroticism: {{neuroticism}} ({{neuroticismLabel}})
{{/personality}}

### Behavior Targets
{{#targets}}
#### Communication Style
{{#communicationStyle}}
- {{name}}: {{level}} {{qualifier}}
{{/communicationStyle}}

#### Engagement Approach
{{#engagementApproach}}
- {{name}}: {{level}} {{qualifier}}
{{/engagementApproach}}

#### Adaptability
{{#adaptability}}
- {{name}}: {{level}} {{qualifier}}
{{/adaptability}}
{{/targets}}

### Relevant Memories
{{#memories}}
#### Facts
{{#facts}}
- {{key}}: {{value}}
{{/facts}}

#### Preferences
{{#preferences}}
- {{key}}: {{value}}
{{/preferences}}

#### Recent Events
{{#events}}
- {{summary}} ({{date}})
{{/events}}
{{/memories}}

### Selected Prompt Slug
{{#slug}}
- Slug: {{slugId}}
- Category: {{category}}
- Template: {{template}}
{{/slug}}

## Composition Guidelines
1. Write as direct instructions to an AI agent
2. Incorporate personality insights naturally
3. Reference specific memories where relevant
4. Follow the behavior targets for communication style
5. Include the prompt slug guidance appropriately
6. Be actionable and specific (200-500 words)

## Output Format
Generate a well-structured agent guidance prompt with these sections:
- Opening context (who this caller is)
- Communication style guidance
- Personality-informed approach
- Specific things to remember/reference
- Conversation goals`,

  // ============================================
  // LEARN: Memory Taxonomy
  // ============================================
  "system-memory-taxonomy": `You are an expert at extracting and categorizing memories from conversations.

## Task
Extract memorable facts, preferences, events, and context from the transcript.

## Transcript
{{transcript}}

## Extraction Guidelines
Look for and extract:

### Facts (FACT)
- Personal information (name, age, location, occupation)
- Family details (spouse, children, relatives)
- Professional details (employer, role, industry)

### Preferences (PREFERENCE)
- Likes and dislikes
- Communication preferences
- Product/service preferences
- Scheduling preferences

### Events (EVENT)
- Appointments mentioned
- Past events referenced
- Upcoming plans
- Life changes

### Topics (TOPIC)
- Subjects of interest
- Discussion themes
- Areas of expertise
- Hobbies and activities

### Relationships (RELATIONSHIP)
- People mentioned by name
- Relationship types
- Important contacts

### Context (CONTEXT)
- Current situation
- Temporary circumstances
- Mood/emotional state
- Urgency indicators

## Key Normalization
Use these canonical keys where applicable:
- Location: city, town, residence → "location"
- Work: job, occupation, profession → "occupation"
- Employer: works_at, company → "employer"
- Family: spouse, wife, husband → "spouse"
- Contact: preferred contact method → "preferred_contact"

## Output Format
Respond with a JSON object:
{
  "memories": [
    {
      "category": "FACT|PREFERENCE|EVENT|TOPIC|RELATIONSHIP|CONTEXT",
      "key": "<normalized_key>",
      "value": "<extracted_value>",
      "confidence": <0.0-1.0>,
      "evidence": "<quote from transcript>",
      "isUpdate": <true if this updates existing knowledge>
    }
  ],
  "summary": "<brief summary of what was learned>",
  "memoryCount": <total memories extracted>
}`
};

async function main() {
  console.log("🌱 Adding prompt templates to all system specs...\n");

  let updated = 0;
  let skipped = 0;

  for (const [slug, promptTemplate] of Object.entries(specPromptTemplates)) {
    // Check if spec exists
    const spec = await prisma.analysisSpec.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, promptTemplate: true },
    });

    if (!spec) {
      console.log(`   ⚠ Spec not found: ${slug} - will create`);
      // The spec doesn't exist - this shouldn't happen if seeds ran correctly
      skipped++;
      continue;
    }

    // Update the spec with the prompt template
    await prisma.analysisSpec.update({
      where: { slug },
      data: {
        promptTemplate,
        isDirty: false,
      },
    });

    console.log(`   ✓ Updated: ${slug}`);
    updated++;
  }

  console.log("\n✅ Prompt template update complete!");
  console.log(`   Updated: ${updated} specs`);
  console.log(`   Skipped: ${skipped} specs`);

  // Verify all specs have templates
  console.log("\n📊 Verification - specs without templates:");
  const specsWithoutTemplates = await prisma.analysisSpec.findMany({
    where: {
      isActive: true,
      promptTemplate: null,
    },
    select: { slug: true, name: true, outputType: true },
    orderBy: { outputType: "asc" },
  });

  if (specsWithoutTemplates.length === 0) {
    console.log("   ✓ All active specs have prompt templates!");
  } else {
    console.log(`   ⚠ ${specsWithoutTemplates.length} specs still missing templates:`);
    for (const spec of specsWithoutTemplates) {
      console.log(`      - ${spec.slug} (${spec.outputType})`);
    }
  }
}

main()
  .catch((e) => {
    console.error("Error updating specs:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
