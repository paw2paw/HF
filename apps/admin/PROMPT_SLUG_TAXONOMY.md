# Prompt Slug Taxonomy

This document defines the proper classification of specs that modify agent behavior and content selection.

## The Problem

Previously, all "things that modify the prompt" were lumped into `domain: "prompt-slugs"` with `outputType: "COMPOSE"`. This conflated two fundamentally different concepts:

1. **Content Selection** - What topic/content to discuss
2. **Behavioral Adaptation** - How the agent communicates

## Proper Classification

### 1. COMPOSE Specs (True Prompt Slugs)
**Purpose:** Select what content or topic to introduce into the conversation.

**Characteristics:**
- Provides **content templates** (what to say)
- Does NOT modify behavior parameters
- Selected based on caller needs, context, or goals
- Examples: Topic selection, follow-up themes, content modules

**OutputType:** `COMPOSE`
**Domain:** `prompt-slugs`

**Current specs that REMAIN as COMPOSE:**
| Slug | Name | Reason |
|------|------|--------|
| `prompt-slug-memory-elicit-story` | Memory: Elicit Story | Content strategy (ask for stories) |
| `prompt-slug-memory-anchor-identity` | Memory: Anchor Identity | Content strategy (reinforce identity) |
| `prompt-slug-memory-reflect-past` | Memory: Reflect Past | Content strategy (reference past) |
| `prompt-slug-memory-link-events` | Memory: Link Events | Content strategy (connect experiences) |
| `prompt-slug-engage-curiosity` | Engage: Curiosity | Content strategy (ask thought-provoking Qs) |
| `prompt-slug-engage-future-oriented` | Engage: Future Oriented | Content strategy (focus on goals) |

### 2. ADAPT Specs (Behavioral Adaptation)
**Purpose:** Modify HOW the agent communicates by adjusting behavior parameters.

**Characteristics:**
- Has **triggers** with Given/When/Then conditions
- Has **actions** that link to **behavior parameters**
- Produces **BehaviorTarget** adjustments
- Affects measurable dimensions (pace, tone, dominance, etc.)

**OutputType:** `ADAPT`
**Domain:** `behavioral-adaptation` (or `agent-adapt`)

**Current specs that SHOULD BE reclassified to ADAPT:**

#### Emotion Category (All are behavioral adaptations)
| Slug | Name | Parameter Adjustments |
|------|------|----------------------|
| `prompt-slug-emotion-soothing` | Emotion: Soothing | MVP-TONE-ASSERT ↓↓, MVP-CONV-PACE ↓, MVP-CONV-DOM ↓ |
| `prompt-slug-emotion-validating` | Emotion: Validating | MVP-TONE-ASSERT ↓, MVP-ENGAGE ↑ |
| `prompt-slug-emotion-reassuring` | Emotion: Reassuring | MVP-TONE-ASSERT → (balanced), confidence signals |
| `prompt-slug-emotion-deescalate` | Emotion: De-escalate | MVP-TONE-ASSERT ↓↓, MVP-CONV-PACE ↓↓, MVP-CONV-DOM ↓ |
| `prompt-slug-emotion-grounding` | Emotion: Grounding | MVP-CONV-PACE ↓, MVP-CONV-DOM ↓, clarity ↑ |

#### Control Category (All are behavioral adaptations)
| Slug | Name | Parameter Adjustments |
|------|------|----------------------|
| `prompt-slug-control-redirect` | Control: Redirect | MVP-CONV-DOM ↑ (briefly), initiative shift |
| `prompt-slug-control-clarify` | Control: Clarify | MVP-ENGAGE probe, MVP-CONV-DOM balanced |
| `prompt-slug-control-summarise` | Control: Summarise | MVP-CONV-DOM ↑ (briefly), consolidation |
| `prompt-slug-control-slow-down` | Control: Slow Down | MVP-CONV-PACE ↓↓, MVP-TONE-ASSERT ↓ |
| `prompt-slug-control-close-topic` | Control: Close Topic | MVP-CONV-DOM ↑, transition signals |

#### Engage Category (Mixed - some are content, some are behavioral)
| Slug | Name | Classification | Reason |
|------|------|---------------|--------|
| `prompt-slug-engage-encourage` | Engage: Encourage | **ADAPT** | Adjusts tone/energy (behavioral) |
| `prompt-slug-engage-prompt-action` | Engage: Prompt Action | **ADAPT** | Adjusts directiveness (behavioral) |
| `prompt-slug-engage-curiosity` | Engage: Curiosity | COMPOSE | Selects curious questioning content |
| `prompt-slug-engage-future-oriented` | Engage: Future Oriented | COMPOSE | Selects future-focused content |

### 3. MEASURE Specs
**Purpose:** Measure observable qualities from transcripts.

**Characteristics:**
- Has triggers and actions with parameter links
- Produces **CallScore** records
- Used for post-call analysis

**Current examples:** `mvp-measure-engagement`, `mvp-measure-conversation-pace`, etc.

### 4. LEARN Specs
**Purpose:** Extract information to store as memories.

**Characteristics:**
- Has triggers and actions with `learnCategory`, `learnKeyPrefix`
- Produces **CallerMemory** records
- Used for post-call extraction

**Current examples:** `caller-memory-extraction`, fact/preference extractors

---

## Implementation Requirements

### For ADAPT Specs
Each ADAPT spec needs:

1. **AnalysisTrigger** defining when to activate:
   ```
   Given: Caller shows frustration signals
   When: Agent responds
   Then: Apply de-escalation behavior adjustments
   ```

2. **AnalysisAction(s)** linking to behavior parameters:
   ```
   Action: Reduce assertiveness
   Parameter: MVP-TONE-ASSERT
   TargetAdjustment: -0.20 (relative) or 0.25 (absolute)
   ```

3. **Detection criteria** (how to know when to apply):
   - Caller emotional state (from analysis)
   - Conversation signals
   - Explicit triggers

### For COMPOSE Specs
Each COMPOSE spec needs:

1. **Selection criteria** (when to use this content):
   - Caller profile conditions
   - Conversation context
   - Explicit selection

2. **promptTemplate** with the actual content guidance

3. **config.category** and **config.slugId** for organization

---

## Migration Plan

1. Create new `behavioral-adaptation` domain
2. Add `outputType: "ADAPT"` if not already in enum
3. Create proper triggers and actions for emotional/control specs
4. Link actions to MVP parameters with target adjustments
5. Update seed scripts
6. Remove old prompt-slug entries for reclassified specs

---

## Visual Summary

```
                    ┌─────────────────────────────────────────┐
                    │           AnalysisSpec                  │
                    └────────────────┬────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           ▼                         ▼                         ▼
    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
    │   MEASURE    │         │    ADAPT     │         │   COMPOSE    │
    │              │         │              │         │              │
    │ What to      │         │ How to       │         │ What to      │
    │ observe      │         │ behave       │         │ talk about   │
    │              │         │              │         │              │
    │ → CallScore  │         │ → BehaviorT. │         │ → Template   │
    └──────────────┘         └──────────────┘         └──────────────┘
           │                         │                         │
           │                         │                         │
    ┌──────┴──────┐           ┌──────┴──────┐           ┌──────┴──────┐
    │ Examples:   │           │ Examples:   │           │ Examples:   │
    │ Engagement  │           │ De-escalate │           │ Elicit Story│
    │ Pace        │           │ Slow Down   │           │ Curiosity Q │
    │ Assertive   │           │ Soothing    │           │ Future Focus│
    └─────────────┘           └─────────────┘           └─────────────┘
```

---

## Related Files

- Schema: `prisma/schema.prisma` (AnalysisSpec, AnalysisOutputType enum)
- Seed: `prisma/seed-system-specs.ts` (prompt slug templates)
- Compose: `app/api/callers/[callerId]/compose-prompt/route.ts`
- Analysis: `app/api/analysis/run/route.ts`
