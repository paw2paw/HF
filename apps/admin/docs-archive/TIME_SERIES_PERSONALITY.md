# Time-Series Personality System with Decay

> **ARCHIVED DOCUMENTATION**
> This document references the deprecated `ControlSet` model which has been removed.
> Agent behavior targeting is now handled by `BehaviorTarget` (layered: SYSTEM → SEGMENT → CALLER).
> See [ARCHITECTURE.md](../ARCHITECTURE.md) for current documentation.

## Overview

This system tracks user personality over time using:
1. **PersonalityObservation** - Individual measurements from each call (time series)
2. **ControlSet expected values** - Target personality profile for each control configuration
3. **Time-based decay** - Recent observations weighted more heavily than old ones
4. **UserPersonality** - Aggregated profile computed from observations

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ CONTROL SET (Configuration)                                     │
│   - expectedOpenness: 0.75                                      │
│   - expectedConscientiousness: 0.80                             │
│   - expectedExtraversion: 0.60                                  │
│   - ... (target personality profile)                            │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ CALL (using ControlSet)                                         │
│   - transcript: "..."                                           │
│   - userId: user-123                                            │
│   - controlSetId: cs-abc                                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ PERSONALITY OBSERVATION (single call measurement)               │
│   - callId: call-456                                            │
│   - userId: user-123                                            │
│   - controlSetId: cs-abc                                        │
│   - observedAt: 2025-01-10T10:00:00Z                            │
│   - openness: 0.72 (actual value from this call)                │
│   - conscientiousness: 0.85                                     │
│   - extraversion: 0.58                                          │
│   - confidence: 0.8                                             │
│   - decayFactor: 1.0 (will decay over time)                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ USER PERSONALITY (aggregated with decay)                        │
│   - userId: user-123                                            │
│   - openness: 0.71 (weighted average with decay)                │
│   - conscientiousness: 0.82                                     │
│   - extraversion: 0.59                                          │
│   - decayHalfLife: 30 (days)                                    │
│   - lastAggregatedAt: 2025-01-13T14:00:00Z                      │
└─────────────────────────────────────────────────────────────────┘
```

## Time Decay Formula

Recent calls should influence personality more than old calls. We use exponential decay:

```typescript
// Weight for an observation based on age
function calculateWeight(observedAt: Date, now: Date, halfLifeDays: number): number {
  const ageInDays = (now.getTime() - observedAt.getTime()) / (1000 * 60 * 60 * 24);
  const decayConstant = Math.log(2) / halfLifeDays;
  return Math.exp(-decayConstant * ageInDays);
}

// Aggregate personality trait with decay
function aggregateTrait(
  observations: PersonalityObservation[],
  trait: 'openness' | 'conscientiousness' | ...,
  halfLifeDays: number
): number {
  const now = new Date();
  let weightedSum = 0;
  let totalWeight = 0;

  for (const obs of observations) {
    const traitValue = obs[trait];
    if (traitValue === null) continue;

    const weight = calculateWeight(obs.observedAt, now, halfLifeDays) * (obs.confidence ?? 1.0);
    weightedSum += traitValue * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}
```

### Example Timeline

```
Day 0:  Call 1 → openness: 0.8, weight: 1.0
Day 10: Call 2 → openness: 0.7, weight: 1.0
Day 20: Call 3 → openness: 0.6, weight: 1.0
Day 30: (today)
  - Call 1: weight = 0.5 (half-life reached)
  - Call 2: weight = 0.7
  - Call 3: weight = 0.87

Aggregated openness:
  (0.8 * 0.5 + 0.7 * 0.7 + 0.6 * 0.87) / (0.5 + 0.7 + 0.87)
  = (0.4 + 0.49 + 0.52) / 2.07
  = 0.68
```

## Expected vs Actual Comparison

Each ControlSet defines **expected** personality values (target profile). After calls, we can compare:

```typescript
interface PersonalityComparison {
  trait: string;
  expected: number;    // From ControlSet
  actual: number;      // Aggregated from observations
  delta: number;       // actual - expected
  variance: number;    // How much actual values fluctuate
}

async function comparePersonality(
  userId: string,
  controlSetId: string
): Promise<PersonalityComparison[]> {
  const controlSet = await prisma.controlSet.findUnique({
    where: { id: controlSetId }
  });

  const userPersonality = await prisma.userPersonality.findUnique({
    where: { userId }
  });

  return [
    {
      trait: 'openness',
      expected: controlSet.expectedOpenness,
      actual: userPersonality.openness,
      delta: userPersonality.openness - controlSet.expectedOpenness,
      variance: calculateVariance(userId, 'openness')
    },
    // ... other traits
  ];
}
```

## Use Cases

### 1. Adaptive Prompts Based on Actual Personality

When a user calls:
1. Retrieve their aggregated `UserPersonality` (with decay applied)
2. Retrieve the active `ControlSet`
3. Compare expected vs actual personality
4. Modify prompt based on **actual** values (not expected)

```typescript
// Generate personalized prompt
const userPersonality = await getAggregatedPersonality(userId);
const controlSet = await getActiveControlSet();

if (userPersonality.openness > 0.7) {
  // User is actually high openness → use exploratory approach
  prompt += "\n\nThis customer enjoys exploring new solutions. Offer multiple approaches.";
} else {
  // User is actually low openness → use direct approach
  prompt += "\n\nThis customer prefers direct, step-by-step guidance. Stick to one solution.";
}
```

### 2. Measure ControlSet Effectiveness

Did the ControlSet achieve its target personality engagement?

```sql
-- Average delta between expected and actual personality
SELECT
  cs.name,
  cs.expectedOpenness,
  AVG(po.openness) as actualOpenness,
  AVG(po.openness - cs.expectedOpenness) as avgDelta
FROM ControlSet cs
JOIN PersonalityObservation po ON po.controlSetId = cs.id
WHERE cs.id = 'cs-abc'
GROUP BY cs.id, cs.name, cs.expectedOpenness;
```

### 3. Track Personality Drift Over Time

Is the user's personality changing?

```sql
-- Plot openness over time
SELECT
  observedAt,
  openness,
  controlSetId
FROM PersonalityObservation
WHERE userId = 'user-123'
ORDER BY observedAt DESC;
```

## Database Models

### PersonalityObservation

**Purpose**: Single measurement from one call (time series data point)

**Fields**:
- `callId` - Which call this observation came from
- `userId` - Which user
- `controlSetId` - Which ControlSet was active during this call
- `openness`, `conscientiousness`, etc. - Observed trait values (0-1)
- `observedAt` - When this observation was made
- `confidence` - How confident is this observation? (0-1)
- `decayFactor` - Multiplier for time-based decay (default 1.0)

### UserPersonality

**Purpose**: Aggregated personality profile (computed from observations)

**Fields**:
- `userId` - Which user
- `openness`, `conscientiousness`, etc. - Aggregated trait values (0-1)
- `lastAggregatedAt` - When aggregation was last computed
- `observationsUsed` - How many observations went into this aggregate
- `confidenceScore` - Overall confidence in the profile (0-1)
- `decayHalfLife` - Days until observation weight halves (default 30)

### ControlSet

**Purpose**: Configuration bundle with target personality profile

**New Fields**:
- `expectedOpenness` - Target openness for this control set
- `expectedConscientiousness` - Target conscientiousness
- `expectedExtraversion` - Target extraversion
- `expectedAgreeableness` - Target agreeableness
- `expectedNeuroticism` - Target neuroticism

## Implementation Pipeline

```
1. CALL ARRIVES
   ↓
2. PERSONALITY ANALYZER
   - Extract traits from transcript
   - Create PersonalityObservation
   - Link to Call, User, ControlSet
   ↓
3. AGGREGATOR (runs periodically or on-demand)
   - Query all PersonalityObservations for user
   - Apply time decay weights
   - Compute aggregated UserPersonality
   ↓
4. PROMPT GENERATOR
   - Retrieve UserPersonality (actual values)
   - Retrieve ControlSet (expected values, prompt template)
   - Modify prompt based on actual personality
   - Return personalized prompt for next call
```

## Example: User Journey

**Day 1 - First Call**
- User calls with ControlSet "Professional_v1"
- ControlSet expects: `{ openness: 0.75, conscientiousness: 0.80 }`
- Personality analyzer creates observation: `{ openness: 0.72, conscientiousness: 0.85 }`
- UserPersonality aggregated: `{ openness: 0.72, conscientiousness: 0.85 }`

**Day 15 - Second Call**
- User calls with same ControlSet
- New observation: `{ openness: 0.68, conscientiousness: 0.82 }`
- UserPersonality re-aggregated with decay:
  - Call 1: weight = 0.7 (14 days old, half-life 30)
  - Call 2: weight = 1.0 (new)
  - Openness: (0.72 * 0.7 + 0.68 * 1.0) / (0.7 + 1.0) = 0.69
  - Conscientiousness: (0.85 * 0.7 + 0.82 * 1.0) / 1.7 = 0.83

**Day 45 - Third Call**
- Call 1 now has weight 0.35 (45 days old)
- Call 2 now has weight 0.5 (30 days old)
- Call 3: weight = 1.0 (new)
- Recent calls dominate the aggregated personality

**Prompt Modification**
- Actual openness (0.69) < Expected openness (0.75)
- → User prefers slightly less exploration than ControlSet targets
- → Adjust prompt: "Offer 2-3 solutions instead of many options"

## Benefits

1. **Adaptive**: Personality profile evolves with each call
2. **Recency-weighted**: Recent behavior matters more
3. **Traceable**: Full history preserved in PersonalityObservation
4. **Comparable**: Can measure expected vs actual personality
5. **Explainable**: Can show user "Your profile based on last 10 calls"
6. **Tunable**: Adjust `decayHalfLife` to control how fast personality updates

---

**Next Steps**:
1. Implement aggregation function with decay
2. Build personality analyzer that creates PersonalityObservation
3. Build prompt generator that uses UserPersonality
4. Create dashboard to visualize personality drift over time
