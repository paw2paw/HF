# Adaptive System Trace

## Scenario 1: QM Tutor Domain - Learning Progression

### Call #1: First Interaction
**Caller**: Sarah (new to Quantum Mechanics)

**What Happens**:
```
1. IDENTITY: "You are QM-Tutor, a patient quantum mechanics teacher"
2. CONTENT: Curriculum loaded (Wave Functions, Superposition, Entanglement...)
3. No memories yet
4. No learner profile yet
5. Default behavior targets
```

**Prompt Sent to AI**:
```markdown
## Caller Information
- Name: Sarah

## Domain Context
- Domain: QM Tutor
- Curriculum: Quantum Mechanics Fundamentals
- Total Modules: 8
- Progress: 0%

## Agent Identity (WHO)
- Core Role: Patient quantum mechanics teacher
- Primary Goal: Build intuition before formalism
- Teaching Techniques:
  - Use analogies from everyday life
  - Start with observable phenomena
  - Defer math until concepts are clear

## Curriculum/Content (WHAT)
- Next Module: wave-functions-001
- Learning Objectives: Understand wave-particle duality
- Key Concepts: probability amplitude, wave collapse, measurement
```

**Sarah's Message**: "I've heard quantum mechanics is really weird. Where should I start?"

**AI Response**: Generic, curriculum-aware but not personalized

---

### Call #2: After First Lesson
**What Changed**:

**MEASURE Phase** (LEARN-STYLE-001 ran):
```json
CallScore {
  parameterId: "question_asking_rate",
  score: 0.85,
  // Sarah asked lots of clarifying questions
}

CallScore {
  parameterId: "engagement_with_examples",
  score: 0.9,
  // Sarah loved the "Schrödinger's cat" analogy
}

CallScore {
  parameterId: "pace_indicators",
  score: 0.3,
  // Sarah said "slow down" twice
}
```

**AGGREGATE Phase** (LEARN-PROF-001 ran):
```
Reads recent CallScores
Applies aggregationRules:
  - question_asking_rate (0.85) → questionFrequency: "frequent"
  - engagement_with_examples (0.9) → learningStyle: "visual"
  - pace_indicators (0.3) → pacePreference: "slow"

Writes to CallerAttribute:
  - learner_profile:question_frequency = "frequent" (confidence: 0.8)
  - learner_profile:learning_style = "visual" (confidence: 0.9)
  - learner_profile:pace_preference = "slow" (confidence: 0.8)
```

**MEMORY Phase** (from call analysis):
```json
CallerMemory {
  category: "TOPIC",
  key: "favorite_analogy",
  value: "Schrödinger's cat",
  confidence: 0.9
}

CallerMemory {
  category: "FACT",
  key: "background",
  value: "no physics background, works in marketing",
  confidence: 0.85
}
```

**CURRICULUM Phase**:
```json
CallerAttribute {
  key: "curriculum:wave-functions-001:status",
  scope: "CURRICULUM",
  stringValue: "in_progress",
  confidence: 1.0
}

CallerAttribute {
  key: "curriculum:wave-functions-001:mastery",
  scope: "CURRICULUM",
  numberValue: 0.4,
  confidence: 0.7
}
```

**Prompt Sent to AI** (NEXT CALL):
```markdown
## Caller Information
- Name: Sarah

## Personality Profile
- Preferred Tone: casual
- Technical Level: beginner

## Learner Profile ⭐ NEW!
- Learning Style: visual
- Pace Preference: slow
- Interaction Style: conversational
- Question Frequency: frequent

## Key Memories ⭐ NEW!
### FACT
- background: no physics background, works in marketing

### TOPIC
- favorite_analogy: Schrödinger's cat

## Curriculum Progress ⭐ UPDATED!
- Curriculum: Quantum Mechanics Fundamentals
- Progress: 5%
- Completed: 0/8 modules
- **NEXT MODULE**: Wave Functions (in progress, 40% mastery)

## Agent Behavior Targets
- socratic-questioning: 0.8 (high) ⭐ ADAPTED based on questionFrequency!
- example-richness: 0.9 (high) ⭐ ADAPTED based on visual learning!
- pacing-speed: 0.3 (slow) ⭐ ADAPTED based on pace preference!
```

**Sarah's Message**: "Can you explain wave functions again?"

**AI Response**:
- ✅ Uses LOTS of visual analogies (learningStyle: visual)
- ✅ Goes SLOW, breaks into small steps (pacePreference: slow)
- ✅ References Schrödinger's cat again (memory: favorite_analogy)
- ✅ Uses conversational tone (interactionStyle: conversational)
- ✅ Stays on Wave Functions module (curriculum state)

---

## Scenario 2: Companion Domain - Memory Persistence

### Call #1: Meeting Alice
**Caller**: John (lonely senior)

**Prompt Sent to AI**:
```markdown
## Agent Identity
- Core Role: Empathetic companion for seniors
- Primary Goal: Provide emotional support and conversation

## Domain Context
- Domain: Companion
```

**John**: "Hi, I'm John. My wife passed away last year. It's been hard."

**AI**: "I'm so sorry for your loss, John. That must be incredibly difficult."

**MEMORY Phase** (after call):
```json
CallerMemory {
  category: "FACT",
  key: "spouse_status",
  value: "wife passed away last year",
  confidence: 0.95,
  evidence: "My wife passed away last year"
}

CallerMemory {
  category: "EVENT",
  key: "loss_event",
  value: "experiencing grief from recent loss",
  confidence: 0.9
}

CallerMemory {
  category: "PREFERENCE",
  key: "needs_support",
  value: "emotional support for grief",
  confidence: 0.85
}
```

---

### Call #2: Three Days Later
**What Changed**:

**Prompt Sent to AI**:
```markdown
## Caller Information
- Name: John

## Key Memories ⭐ CRITICAL!
### FACT
- spouse_status: wife passed away last year

### EVENT
- loss_event: experiencing grief from recent loss

### PREFERENCE
- needs_support: emotional support for grief

## Recent Interaction Summary
- 1 previous call on record
- Most recent call: 3 days ago
```

**John**: "Hi again."

**AI Response**:
- ✅ "Hi John, how have you been since we last spoke?"
- ✅ Doesn't ask about wife again (already knows)
- ✅ Shows continuity: "I remember you mentioned..."
- ✅ Offers appropriate emotional support

---

### Call #5: Two Weeks Later
**More Memories Accumulated**:
```markdown
## Key Memories
### FACT
- spouse_status: wife passed away last year
- name: prefers to be called "Johnny"
- location: lives in Denver
- hobby: used to garden with wife

### TOPIC
- roses: grew prize-winning roses with wife
- grandchildren: has 3 grandchildren in California

### PREFERENCE
- conversation_style: likes to reminisce about good times
- topics_to_avoid: doesn't want pity
```

**John**: "I was thinking about the rose garden today."

**AI Response**:
- ✅ "The rose garden you and your wife grew together?"
- ✅ References specific memory (prize-winning roses)
- ✅ Warm, nostalgic tone (not pitying)
- ✅ Knows his preferences for conversation style

---

## ✅ Is This System Actually Adaptive?

### For QM Tutor (Learning Domain):
**YES! Adapts on multiple dimensions:**

1. **Curriculum Progression** - Knows exactly where learner is
2. **Learning Style** - Adapts explanations to visual/auditory/reading preferences
3. **Pacing** - Adjusts speed based on observed struggle
4. **Interaction** - More/less Socratic based on question frequency
5. **Memory** - Remembers favorite analogies, struggles, background

### For Companion (Relationship Domain):
**YES! Creates genuine continuity:**

1. **Life Context** - Remembers major life events (spouse, children, location)
2. **Preferences** - Learns how they like to be addressed, what to avoid
3. **Topics** - Tracks interests and conversation history
4. **Tone** - Adapts emotional register over time
5. **Relationship** - Builds on previous conversations, not starting fresh

---

## 🔍 The Adaptive Loop (How It All Works)

```
┌─────────────────────────────────────────────────────────────┐
│ CALL N: Caller interacts with AI                           │
│  - AI uses CURRENT context (memories, profile, curriculum) │
│  - Feels personalized based on PAST interactions           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ MEASURE Phase (immediately after call)                      │
│  - LEARN-STYLE-001: Observes learning behaviors            │
│  - CURRICULUM-PROGRESS: Updates module mastery             │
│  - MEMORY-EXTRACT: Extracts facts, preferences, topics     │
│  - PERSONALITY-OBSERVE: Updates personality profile        │
│  → Writes CallScores and CallerMemories                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ AGGREGATE Phase (periodic or on-demand)                     │
│  - LEARN-PROF-001: Aggregates scores → learner profile     │
│  - Computes mastery thresholds → curriculum progress       │
│  → Writes CallerAttributes (profile, progress)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ COMPOSE Phase (before next call)                            │
│  - Reads CallerAttributes (profile, curriculum)            │
│  - Reads CallerMemories (facts, preferences, topics)       │
│  - Reads CallerPersonality                                 │
│  - Reads BehaviorTargets/CallerTargets                     │
│  → Builds context for AI                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ CALL N+1: Next interaction                                 │
│  - AI receives RICHER context                              │
│  - Responds MORE adaptively                                │
│  - Learner/caller feels UNDERSTOOD                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 What Makes This Truly Adaptive?

### 1. **Multi-Dimensional Adaptation**
Not just one thing - adapts:
- Content (what to teach/discuss)
- Style (how to teach/communicate)
- Tone (formality, warmth)
- Pacing (speed of progression)
- Examples (type and complexity)

### 2. **Memory Persistence** ✅
- YES, memories persist across calls
- Memories have expiration dates (can fade)
- Memories can be superseded (updated beliefs)
- Memories are categorized (FACT, PREFERENCE, TOPIC, EVENT)

### 3. **Behavioral Learning** ✅
- System OBSERVES behavior (doesn't just ask)
- Infers preferences from patterns
- Adapts without explicit input

### 4. **Curriculum-Aware** ✅
- Knows where learner is in journey
- Doesn't repeat completed material
- Focuses on current module
- Tracks mastery per topic

### 5. **Confidence-Weighted** ✅
- All adaptations have confidence scores
- Low confidence = tentative adaptation
- High confidence = strong adaptation
- Can override with explicit preferences

---

## ⚠️ Current Gaps (What's Missing)

### 1. **ADAPT Specs Not Yet Created**
- Learner profile exists but doesn't YET adjust behavior targets
- Need ADAPT spec that reads profile and modifies targets
- Example: IF learningStyle=visual THEN increase example-richness to 0.9

### 2. **Aggregate Phase Not Auto-Triggered**
- Currently manual: `POST /api/callers/[callerId]/aggregate`
- Should run after every N calls or on schedule
- Gap: Profile updates lag behind behavior changes

### 3. **Memory Extraction Depends on Specs**
- Need MEASURE specs seeded for each domain
- Without specs, memories won't be extracted
- Gap: Manual spec creation required per domain

### 4. **No Feedback Loop**
- Can't yet detect if adaptations are working
- No "was this helpful?" signal
- Gap: Can't self-correct bad adaptations

---

## 🚀 To Make It FEEL Fully Adaptive:

### Quick Wins:
1. **Seed LEARN-PROF-001** → Enable learner profile aggregation
2. **Create ADAPT-001** → Profile influences behavior targets
3. **Auto-run aggregate** → After every 3 calls or daily
4. **Test with real transcript** → Import a multi-call conversation

### Medium Term:
5. **Memory extraction specs** → Per domain (Companion, Tutor, etc.)
6. **Curriculum update triggers** → Auto-advance on mastery
7. **Feedback mechanism** → Detect when learner is frustrated/engaged

### Long Term:
8. **Cross-domain learning** → Transfer learning styles between domains
9. **Meta-learning** → Learn how to learn about the learner
10. **Proactive adaptation** → Anticipate needs before expressed
