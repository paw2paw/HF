# BDD Spec Format Guide

## The Simple Path

```
Write .spec.json  -->  Upload at /lab/upload  -->  Activate  -->  Done
```

---

## Minimal Spec (Copy-Paste Template)

```json
{
  "$schema": "./feature-spec-schema.json",
  "id": "YOUR-001",
  "title": "Your Spec Title",
  "version": "1.0",
  "domain": "your-domain",
  "specType": "DOMAIN",
  "outputType": "MEASURE",

  "story": {
    "asA": "Conversational AI System",
    "iWant": "To measure X",
    "soThat": "I can adapt Y"
  },

  "parameters": [
    {
      "id": "your-param-id",
      "name": "Your Parameter Name",
      "description": "What this measures",
      "scoringAnchors": [
        { "score": 0.2, "example": "Low example quote", "rationale": "Why this is low" },
        { "score": 0.5, "example": "Medium example quote", "rationale": "Why this is medium" },
        { "score": 0.8, "example": "High example quote", "rationale": "Why this is high" }
      ],
      "promptGuidance": {
        "whenHigh": "How to adapt when score is high",
        "whenLow": "How to adapt when score is low"
      }
    }
  ]
}
```

---

## Required Fields

| Field | Description | Example |
|-------|-------------|---------|
| `id` | Unique spec ID | `"PERS-001"`, `"MEM-002"` |
| `title` | Human-readable name | `"Personality Measurement"` |
| `version` | Semver format | `"1.0"` |
| `story` | User story (asA, iWant, soThat) | See above |
| `parameters` | Array of parameters to measure | See below |

---

## Spec Type (When does it run?)

| specType | When it runs | Use for |
|----------|--------------|---------|
| `"SYSTEM"` | Every call, automatically | Core measurements (personality, memory) |
| `"DOMAIN"` | Only when playbook includes it | Domain-specific behaviors |
| `"ADAPT"` | After MEASURE/LEARN phases | Computing rewards, targets |
| `"SUPERVISE"` | Meta-validation | Checking other specs |

**Default**: `"DOMAIN"` - requires adding to a playbook.

---

## Output Type (What runtime data does it produce?)

| outputType | Produces | Use for |
|------------|----------|---------|
| `"MEASURE"` | CallScore records | Scoring caller behaviors (personality, engagement) |
| `"LEARN"` | CallerMemory records | Extracting facts about the caller |
| `"MEASURE_AGENT"` | BehaviorMeasurement records | Scoring agent behaviors |
| `"ADAPT"` | Target computations | Post-measurement adaptation |
| `"REWARD"` | RewardScore records | Performance metrics |
| `"COMPOSE"` | ComposedPrompt records | Prompt generation |

**Default**: `"MEASURE"` - scores caller behaviors.

---

## Parameter Format

```json
{
  "id": "B5-O",                           // REQUIRED: Unique ID
  "name": "openness",                     // REQUIRED: Human name
  "description": "Openness to experience", // REQUIRED: What it measures

  "section": "Big Five",                  // Optional: Grouping
  "targetRange": { "min": 0, "max": 1 },  // Optional: Score range (default 0-1)

  "scoringAnchors": [...],                // CRITICAL for MEASURE specs
  "promptGuidance": {...},                // CRITICAL for prompt adaptation
  "interpretationScale": [...]            // Optional: Score labels
}
```

---

## Scoring Anchors (Most Important!)

These calibrate the LLM on what scores mean:

```json
"scoringAnchors": [
  {
    "score": 0.15,
    "example": "Just tell me what to do. I don't need details.",
    "rationale": "No curiosity, wants only action items",
    "isGold": true
  },
  {
    "score": 0.5,
    "example": "That makes sense. Is there anything else I should know?",
    "rationale": "Moderate interest, functional follow-up",
    "isGold": true
  },
  {
    "score": 0.85,
    "example": "Fascinating! How does this connect to the broader concept of...",
    "rationale": "High curiosity, abstract thinking, explores deeply",
    "isGold": true
  }
]
```

**Tip**: Include 3-5 anchors spanning the full 0-1 range.

---

## Prompt Guidance (How to Adapt)

```json
"promptGuidance": {
  "whenHigh": "This caller is curious. Explain the 'why', offer alternatives.",
  "whenLow": "This caller wants facts. Be direct, skip the theory.",
  "whenMedium": "Balance detail with efficiency."
}
```

These become `PromptSlug` records that inject into prompts based on scores.

---

## Interpretation Scale (Optional Labels)

```json
"interpretationScale": [
  { "min": 0.0, "max": 0.3, "label": "Low", "implication": "Prefers X" },
  { "min": 0.3, "max": 0.7, "label": "Medium", "implication": "Balanced" },
  { "min": 0.7, "max": 1.0, "label": "High", "implication": "Prefers Y" }
]
```

---

## Acceptance Criteria (Optional Documentation)

```json
"acceptanceCriteria": [
  {
    "id": "AC-001",
    "title": "Openness detection",
    "given": "A caller engaged in conversation",
    "when": "The system analyzes linguistic markers",
    "then": "An Openness score is produced",
    "measuredBy": ["B5-O"]
  }
]
```

These are for documentation - they link parameters to behaviors.

---

## File Naming Convention

```
{ID}-{short-description}.spec.json

Examples:
- PERS-001-personality-measurement.spec.json
- MEM-001-caller-memory-extraction.spec.json
- STYLE-001-conversation-style.spec.json
```

---

## Validation

Your spec will be validated against `feature-spec-schema.json` when uploaded.

Common errors:
- Missing required fields (id, title, version, story, parameters)
- Invalid ID format (must be `XXX-001` pattern)
- Missing scoring anchors on MEASURE specs
- Invalid score ranges (must be 0-1)

---

## Quick Reference: What Creates What

| Spec Field | Creates Database Record |
|------------|------------------------|
| `parameters[].id` | `Parameter.parameterId` |
| `parameters[].scoringAnchors[]` | `ParameterScoringAnchor` records |
| `parameters[].promptGuidance` | `PromptSlug` + `PromptSlugRange` records |
| The whole spec | `AnalysisSpec` + `AnalysisTrigger` + `AnalysisAction` |

---

## Example Specs in This Directory

| File | Type | Purpose |
|------|------|---------|
| `PERS-001-personality-measurement.spec.json` | MEASURE | Big Five personality traits |
| `MEM-001-caller-memory-extraction.spec.json` | LEARN | Extract facts about caller |
| `STYLE-001-conversation-style.spec.json` | MEASURE | Conversation preferences |
| `REW-001-reward-computation.spec.json` | REWARD | Performance scoring |
| `TUT-001-tutor-identity.spec.json` | IDENTITY | Tutor agent definition |
