# Analysis Pipeline Architecture

## Overview

This document describes how transcript analysis works end-to-end, from raw conversation to actionable insights.

---

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TRANSCRIPT ANALYSIS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │ Raw          │                                                           │
│  │ Transcript   │                                                           │
│  │ (Text/Voice) │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    TRANSCRIPT PROCESSOR AGENT                         │   │
│  │  • Normalize text (speaker turns, timestamps)                         │   │
│  │  • Identify speakers (user vs assistant)                              │   │
│  │  • Store as Call record                                               │   │
│  └──────────────────────────┬───────────────────────────────────────────┘   │
│                             │                                                │
│         ┌───────────────────┼───────────────────┐                           │
│         ▼                   ▼                   ▼                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ PERSONALITY  │    │ MEMORY       │    │ REWARD       │                   │
│  │ ANALYZER     │    │ EXTRACTOR    │    │ SCORER       │                   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                   │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ Personality  │    │ UserMemory   │    │ RewardScore  │                   │
│  │ Observation  │    │ entries      │    │              │                   │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘                   │
│         │                   │                                                │
│         ▼                   ▼                                                │
│  ┌──────────────┐    ┌──────────────┐                                       │
│  │ User         │    │ UserMemory   │                                       │
│  │ Personality  │    │ Summary      │                                       │
│  │ (aggregated) │    │ (aggregated) │                                       │
│  └──────────────┘    └──────────────┘                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Transcript Processor Agent

**Input:** Raw transcript file or API payload
**Output:** Normalized `Call` record

**Process:**
1. Parse transcript format (VTT, SRT, JSON, plain text)
2. Identify speaker turns
3. Normalize timestamps
4. Associate with User (by phone/email/externalId)
5. Create Call record with transcript text

---

### 2. Personality Analyzer Agent

**Input:** Call record
**Dependencies:**
- `AnalysisProfile` (which parameters to score, weights)
- `KnowledgeArtifact` (scoring guides per parameter)
- `Parameter` definitions

**Output:** `PersonalityObservation` record

**Process:**
```
┌───────────────────────────────────────────────────────────────┐
│ PERSONALITY ANALYZER                                          │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Load AnalysisProfile (active parameters + weights)        │
│     └→ Which traits to score? How to weight them?             │
│                                                               │
│  2. For each enabled Parameter:                               │
│     ├→ Retrieve KnowledgeArtifact (SCORING_GUIDE)             │
│     │   └→ "How to score openness from conversation"          │
│     ├→ Retrieve KnowledgeArtifact (EXAMPLES)                  │
│     │   └→ "Examples of high/low openness"                    │
│     └→ Score trait (0-1) with confidence                      │
│                                                               │
│  3. Apply profile weights:                                    │
│     finalScore = rawScore × weight                            │
│                                                               │
│  4. Store PersonalityObservation:                             │
│     {callId, userId, openness, conscientiousness, ...}        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Aggregation (separate process):**
```
PersonalityObservations (time series)
        │
        ▼ (apply decay: older = less weight)
    ┌───────────────┐
    │ UserPersonality │  ← Aggregated profile
    │ (single record) │
    └───────────────────┘
```

---

### 3. Memory Extractor Agent

**Input:** Call record
**Dependencies:**
- Memory extraction prompts
- Entity recognition models (optional)

**Output:** `UserMemory` entries

**Process:**
```
┌───────────────────────────────────────────────────────────────┐
│ MEMORY EXTRACTOR                                              │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Scan transcript for extractable facts:                    │
│                                                               │
│     Category: FACT                                            │
│     ├→ "lives in London"         → {key: location, value: London}
│     ├→ "works at Acme Corp"      → {key: employer, value: Acme Corp}
│     └→ "has 2 kids"              → {key: family_size, value: 2}
│                                                               │
│     Category: PREFERENCE                                      │
│     ├→ "prefers email"           → {key: contact_method, value: email}
│     └→ "likes brief answers"     → {key: response_length, value: brief}
│                                                               │
│     Category: EVENT                                           │
│     ├→ "asked about pricing"     → {key: pricing_inquiry, value: ...}
│     └→ "complained about X"      → {key: complaint, value: X}
│                                                               │
│     Category: TOPIC                                           │
│     ├→ "interested in product Y" → {key: interest, value: product_Y}
│     └→ "mentioned competitor Z"  → {key: competitor_mention, value: Z}
│                                                               │
│  2. For each extraction:                                      │
│     • Store evidence (excerpt)                                │
│     • Assign confidence (0-1)                                 │
│     • Check for contradictions with existing memories         │
│     • If contradiction: supersede old memory                  │
│                                                               │
│  3. Update UserMemorySummary                                  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

### 4. Reward Scorer Agent

**Input:** Call record (completed call)
**Output:** `RewardScore` record

**Process:**
- Analyze call outcome signals
- Score dimensions: clarity, empathy, resolution, efficiency
- Link to PromptSlugSelection for prompt optimization

---

## Knowledge System Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KNOWLEDGE SYSTEM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │ Raw Docs     │ ──► │ Knowledge    │ ──► │ Vector       │                 │
│  │ (MD, TXT)    │     │ Chunks       │     │ Embeddings   │                 │
│  └──────────────┘     └──────────────┘     └──────────────┘                 │
│                              │                    │                          │
│                              ▼                    ▼                          │
│                       ┌──────────────────────────────┐                      │
│                       │    KNOWLEDGE CURATOR AGENT    │                      │
│                       └──────────────────────────────┘                       │
│                              │                                               │
│                              ▼                                               │
│                       ┌──────────────┐                                       │
│                       │ Knowledge    │                                       │
│                       │ Artifacts    │ ← Per-parameter curated content       │
│                       └──────────────┘                                       │
│                              │                                               │
│                              │                                               │
│         ┌────────────────────┼────────────────────┐                          │
│         │                    │                    │                          │
│         ▼                    ▼                    ▼                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ SCORING_GUIDE│    │ EXAMPLES     │    │ CALIBRATION  │                   │
│  │ How to score │    │ High/low     │    │ Benchmark    │                   │
│  │ this trait   │    │ examples     │    │ scores       │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Artifact Types:**
- `SCORING_GUIDE`: Instructions for scoring a parameter (e.g., "How to score openness")
- `EXAMPLES`: Concrete examples of high/low scores
- `RESEARCH_SUMMARY`: Academic/research findings about the trait
- `PROMPT_TEMPLATE`: LLM prompt for scoring
- `CALIBRATION_DATA`: Benchmark examples with known scores

---

## Prompt Selection Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROMPT SELECTION                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  New call comes in for User X                                               │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Load UserPersonality for User X                                    │   │
│  │    {openness: 0.7, conscientiousness: 0.5, ...}                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 2. Load UserMemorySummary for User X                                  │   │
│  │    {keyFacts: [...], preferences: {...}, topTopics: [...]}            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 3. Match to PromptSlug based on personality profile                   │   │
│  │    • High openness + high N → "empathetic_explorer"                   │   │
│  │    • High conscientiousness + low N → "efficient_structured"          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 4. Record PromptSlugSelection                                         │   │
│  │    {callId, userId, promptSlug, confidence, personalitySnapshot}      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 5. After call: Score reward → Update PromptSlugStats                  │   │
│  │    • Track which slugs work for which personality profiles            │   │
│  │    • Learn optimal slug selection over time                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Summary

| Stage | Input | Process | Output | Agent |
|-------|-------|---------|--------|-------|
| 1 | Raw transcript | Parse, normalize | Call | transcript_processor |
| 2a | Call | Score personality traits | PersonalityObservation | personality_analyzer |
| 2b | Call | Extract facts/prefs | UserMemory[] | memory_extractor |
| 2c | Call (completed) | Score outcomes | RewardScore | reward_scorer |
| 3a | PersonalityObservations | Aggregate with decay | UserPersonality | personality_aggregator |
| 3b | UserMemory[] | Summarize | UserMemorySummary | memory_aggregator |
| 4 | UserPersonality + Context | Select prompt | PromptSlugSelection | prompt_selector |
| 5 | PromptSlugSelection + Reward | Update stats | PromptSlugStats | stats_updater |

---

## Analysis Profile Role

The **AnalysisProfile** (formerly ParameterSet) controls:

1. **Which parameters are active** - enabled/disabled toggle
2. **Weight per parameter** - 0.0 to 2.0 multiplier
3. **Bias adjustments** - shift scores up/down
4. **Thresholds** - custom low/high boundaries

Different profiles for different use cases:
- "Empathy Focus" → higher weights on emotional intelligence parameters
- "Cognitive Focus" → higher weights on cognitive style parameters
- "Minimal" → only 10 key parameters enabled

---

## Implementation Priority

1. **Knowledge System** (foundation)
   - Ingest docs → chunks → embeddings
   - Create KnowledgeArtifacts per parameter

2. **Personality Analyzer** (core scoring)
   - Use AnalysisProfile + KnowledgeArtifacts
   - Score calls → PersonalityObservation
   - Aggregate → UserPersonality

3. **Memory Extractor** (caller context)
   - Extract facts/preferences from calls
   - Build UserMemory → UserMemorySummary

4. **Prompt Selection** (optimization)
   - Match personality to prompt slugs
   - Track rewards → learn optimal selections
