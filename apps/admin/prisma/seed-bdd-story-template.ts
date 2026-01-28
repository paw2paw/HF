/**
 * Add prompt template to the BDD Story spec
 * Run with: npx tsx prisma/seed-bdd-story-template.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const bddStoryTemplate = `You are analyzing a conversation transcript against the MVP Cognitive Activation story requirements.

## BDD Story: STORY-COG-ACT-001
AS A user
I WANT to be mentally active and involved as the conversation advances
SO THAT the session feels participatory rather than like a lecture

## Time Window
This analysis applies to the mid_session window:
- Start: After explicit topic framing by system
- End: Before system signals session is nearing completion
- Exclusions: Minimal acknowledgements (mm-hmm, okay) do not count as turns

## Acceptance Criteria to Evaluate

### AC-1: Cognitive Activation Cadence
- GIVEN: The user is mid-session
- WHEN: The system advances the conversation
- THEN: The system introduces at least one cognitively activating prompt every 120-180 seconds
- Thresholds: Max prompt gap ≤240 seconds; Min engagement ≥0.65

### AC-2: Prompt Quality Constraints
- GIVEN: The system introduces a cognitively activating prompt
- WHEN: The user is invited to respond
- THEN: The prompt requires explanation, reflection, imagination, or opinion (not yes/no)
- Thresholds: Min user response words ≥15

### AC-3: Turn-Taking Constraints
- GIVEN: The session is mid-session
- WHEN: The system communicates
- THEN: Max 2 consecutive system turns; max 120 words per monologue; max 40 seconds voice
- Thresholds: Conversation dominance 0.40-0.55

### AC-4: Advancement Requires User Input
- GIVEN: The system is about to introduce the next idea
- WHEN: Advancing content
- THEN: System asks for user input and waits for response before proceeding

### AC-5: Non-Lecture Delivery
- GIVEN: The session is mid-session
- WHEN: The system explains concepts
- THEN: Explanations interleaved with prompts; participation opportunity within ≤2 turns

## Transcript
{{transcript}}

## Analysis Output
Provide a JSON response:
{
  "storyCompliance": {
    "overall": <0.0-1.0 compliance score>,
    "timeWindowApplied": <boolean - was mid_session detected?>,
    "acceptanceCriteria": {
      "AC-1": { "pass": <boolean>, "score": <0.0-1.0>, "evidence": "<specific evidence>" },
      "AC-2": { "pass": <boolean>, "score": <0.0-1.0>, "evidence": "<specific evidence>" },
      "AC-3": { "pass": <boolean>, "score": <0.0-1.0>, "evidence": "<specific evidence>" },
      "AC-4": { "pass": <boolean>, "score": <0.0-1.0>, "evidence": "<specific evidence>" },
      "AC-5": { "pass": <boolean>, "score": <0.0-1.0>, "evidence": "<specific evidence>" }
    }
  },
  "constraintViolations": [
    { "id": "<C-1 through C-5>", "description": "<violation description>", "severity": "critical|warning" }
  ],
  "recommendations": ["<specific improvement suggestions>"],
  "reasoning": "<overall analysis summary>"
}`;

async function main() {
  console.log("Adding prompt template to BDD Story spec...");

  await prisma.analysisSpec.update({
    where: { slug: "mvp-story-cognitive-activation" },
    data: { promptTemplate: bddStoryTemplate }
  });

  console.log("✓ Updated mvp-story-cognitive-activation with prompt template");

  // Verify
  const spec = await prisma.analysisSpec.findUnique({
    where: { slug: "mvp-story-cognitive-activation" },
    select: { slug: true, promptTemplate: true }
  });

  console.log(`  Template length: ${spec?.promptTemplate?.length || 0} chars`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
