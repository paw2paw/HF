# Personality-Driven Prompt Modification System

> **ARCHIVED DOCUMENTATION**
> This document references the deprecated `ControlSet` model which has been removed.
> Agent behavior targeting is now handled by `BehaviorTarget` (layered: SYSTEM → SEGMENT → CALLER).
> See [ARCHITECTURE.md](../ARCHITECTURE.md) for current documentation.

## Overview

This system creates personalized conversation experiences by:
1. **Extracting personality** from call transcripts using knowledge bank parameters
2. **Scoring calls** using those parameters as evaluation criteria
3. **Modifying prompts** for next calls based on user personality profile

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. RAW TRANSCRIPT FILE                                          │
│    ~/hf_kb/sources/transcripts/raw/*.json                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. IMPORT AGENT (transcripts:import)                            │
│    - Extract Call records                                       │
│    - Link to User (create if needed)                            │
│    - Link to ControlSet used                                    │
│    - Store full transcript                                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. PERSONALITY ANALYZER (personality:analyze)                   │
│    - Query knowledge bank for personality Parameters            │
│    - Example: "openness", "extraversion", "agreeableness"       │
│    - Score transcript against each parameter definition         │
│    - Store in UserPersonality model (0-1 scale per trait)       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. REWARD SCORER (calls:score)                                  │
│    - Use Parameters as scoring dimensions                       │
│    - Calculate clarity, empathy, resolution, efficiency         │
│    - Store in RewardScore model                                 │
│    - Link score to ControlSet used                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. NEXT CALL ARRIVES for same User                              │
│    - Retrieve UserPersonality profile                           │
│    - Retrieve active ControlSet                                 │
│    - Retrieve PromptTemplate from ControlSet                    │
│    - MODIFY prompt based on personality scores                  │
└─────────────────────────────────────────────────────────────────┘
```

## Example: Two Users with Different Openness

### User A: High Openness (0.85)

**Personality Profile (from knowledge bank scoring):**
```json
{
  "userId": "user-a",
  "openness": 0.85,
  "conscientiousness": 0.72,
  "extraversion": 0.68,
  "preferredTone": "exploratory",
  "technicalLevel": "intermediate"
}
```

**Base PromptTemplate:**
```
You are a customer service agent for Acme Corp.
{{PERSONALITY_INSTRUCTIONS}}
{{CONVERSATION_CONTEXT}}
```

**Modified Prompt (High Openness Instructions Injected):**
```
You are a customer service agent for Acme Corp.

This customer has high openness (0.85). They appreciate:
- Exploring new solutions and innovative approaches
- Understanding the "why" behind solutions
- Open-ended discussions about possibilities
- Learning about new features they might not know

Based on your last interaction on Jan 10th, they enjoyed when you
explained the technical reasoning behind the billing cycle.

Current issue: Account setup question
```

**Agent Behavior:** Offers multiple solution paths, explains technical details, suggests advanced features

---

### User B: Low Openness (0.22)

**Personality Profile:**
```json
{
  "userId": "user-b",
  "openness": 0.22,
  "conscientiousness": 0.88,
  "extraversion": 0.45,
  "preferredTone": "direct",
  "technicalLevel": "novice"
}
```

**Modified Prompt (Low Openness Instructions Injected):**
```
You are a customer service agent for Acme Corp.

This customer has low openness (0.22). They prefer:
- Familiar, proven solutions over new approaches
- Step-by-step clarity with minimal ambiguity
- Direct answers without exploring alternatives
- Reference to their past successful interactions

Based on your last interaction on Jan 10th, they appreciated the
straightforward resolution process you used.

Current issue: Account setup question
```

**Agent Behavior:** Provides one clear solution path, step-by-step instructions, minimal options

---

## How Personality Parameters Are Used

### 1. As Scoring Rubric

Each Parameter in the knowledge bank defines:
- `name`: e.g., "openness"
- `definition`: "Willingness to try new experiences..."
- `measurementMvp`: "Look for questions about alternatives, exploration..."
- `interpretationHigh`: "Curious, asks 'why', explores options"
- `interpretationLow`: "Prefers routine, sticks to known solutions"

The analyzer agent uses these to score transcripts:

```typescript
async function scorePersonalityTrait(
  transcript: string,
  parameter: Parameter
): Promise<number> {
  // Use AI with parameter definition as rubric
  const prompt = `
    Analyze this transcript and score the customer's ${parameter.name}.

    Definition: ${parameter.definition}

    High indicators: ${parameter.interpretationHigh}
    Low indicators: ${parameter.interpretationLow}

    Transcript: ${transcript}

    Return a score from 0.0 (very low) to 1.0 (very high).
  `;

  const score = await callAI(prompt);
  return score;
}
```

### 2. As Prompt Modifiers

The PromptTemplate stores personality-specific instructions:

```json
{
  "personalityModifiers": {
    "openness": {
      "high": "Explore solutions, explain reasoning, suggest innovations",
      "low": "Stick to proven methods, provide step-by-step clarity"
    },
    "conscientiousness": {
      "high": "Be thorough, document everything, follow up",
      "low": "Be flexible, focus on outcomes over process"
    }
  }
}
```

When generating a prompt for a specific user:

```typescript
function generatePersonalizedPrompt(
  user: User,
  template: PromptTemplate
): string {
  let prompt = template.systemPrompt;

  // Inject personality-specific instructions
  const personality = user.personality;
  const modifiers = template.personalityModifiers;

  for (const trait of ['openness', 'conscientiousness', 'extraversion']) {
    const score = personality[trait];
    const instruction = score > 0.5
      ? modifiers[trait].high
      : modifiers[trait].low;

    prompt += `\n\n${instruction}`;
  }

  return prompt;
}
```

## Database Schema Summary

```prisma
User
  ↓ 1:1
UserPersonality (openness, conscientiousness, etc.)

User
  ↓ 1:many
Call
  ↓ 1:1
RewardScore (overallScore, dimensions)

ControlSet (bundle of Parameters)
  ↓ 1:1
PromptTemplate (personalityModifiers)

Call
  ↓ many:1
ControlSet (which config was used)
```

## Implementation Status

✅ Schema models added:
- User
- UserPersonality
- ControlSet
- ControlSetParameter
- PromptTemplate
- RewardScore

⏳ Next steps:
1. Build personality analyzer agent
2. Build reward scorer agent
3. Build prompt generation service
4. Wire up to transcript processing pipeline

## Usage Example

```typescript
// When a new call comes in for an existing user
const user = await prisma.user.findUnique({
  where: { phone: incomingPhone },
  include: { personality: true }
});

const activeControlSet = await prisma.controlSet.findFirst({
  where: { isActive: true },
  include: { promptTemplate: true }
});

const personalizedPrompt = generatePersonalizedPrompt(
  user,
  activeControlSet.promptTemplate
);

// Use personalizedPrompt to initialize the AI agent for this call
await startCallWithPrompt(personalizedPrompt);
```

---

**Key Insight:** The Parameters serve a dual purpose:
1. **Evaluation rubric** for analyzing past calls
2. **Behavioral instructions** for modifying future calls

This creates a closed-loop learning system!
