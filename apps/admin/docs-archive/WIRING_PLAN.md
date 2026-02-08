# HF System Wiring Plan

## Problem Statement

The current system has well-designed components that aren't fully connected:

```
CURRENT STATE (Disconnected):
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ AnalysisSpec│    │ personality- │    │ PromptSlug  │
│ (templates) │    │ analyze.ts   │    │ Composer    │
│             │    │ (hardcoded)  │    │ (working)   │
└─────────────┘    └──────────────┘    └─────────────┘
       ↓                   ↓                   ↓
  Not used by        Uses Parameter       Reads from
  any agent          name matching        PromptSlug DB
```

**Target State (Wired)**:
```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ AnalysisSpec│───→│ personality- │───→│ PersonalityObs
│ MEASURE     │    │ analyze.ts   │    │ + UserPersonality
│ + templates │    │ (spec-driven)│    └─────────────┘
└─────────────┘    └──────────────┘           │
                                              ↓
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ AnalysisSpec│───→│ memory-      │───→│ UserMemory  │
│ LEARN       │    │ extract.ts   │    │ + Summary   │
│ + templates │    │ (spec-driven)│    └─────────────┘
└─────────────┘    └──────────────┘           │
                                              ↓
                                       ┌─────────────┐
                   Parameter Values ──→│ PromptSlug  │
                   + UserMemories  ───→│ Composer    │
                                       │ (working)   │
                                       └─────────────┘
                                              ↓
                                       ┌─────────────┐
                                       │ Composed    │
                                       │ Prompt      │
                                       └─────────────┘
```

---

## Phase 1: Fix personality-analyze.ts to Use AnalysisSpecs

### Current Issues
- Uses hardcoded `PERSONALITY_TRAIT_MAPPING` instead of AnalysisSpec
- Searches Parameters by name pattern instead of using spec linkage
- Mock scoring doesn't use spec's `promptTemplate`
- Doesn't use `scoringAnchors` for calibration

### Changes Required

**File: `lib/ops/personality-analyze.ts`**

1. **Query AnalysisSpecs instead of Parameters directly**
```typescript
// BEFORE (line 96-106):
const personalityParams = await prisma.parameter.findMany({
  where: {
    OR: [
      { name: { contains: "openness", mode: "insensitive" } },
      // ... hardcoded names
    ],
  },
});

// AFTER:
const measureSpecs = await prisma.analysisSpec.findMany({
  where: {
    outputType: "MEASURE",
    isActive: true,
  },
  include: {
    parameter: true,
    adaptPromptSlug: true,
    scoringAnchors: {
      orderBy: { anchorValue: "asc" },
    },
  },
});
```

2. **Use spec's promptTemplate for scoring**
```typescript
// BEFORE (line 278-312): Mock implementation

// AFTER: Use spec template
async function scoreWithSpec(
  transcript: string,
  spec: AnalysisSpecWithRelations,
  verbose: boolean
): Promise<{ score: number; confidence: number; evidence: string[] }> {
  // Get anchors for calibration examples
  const anchors = spec.scoringAnchors || [];
  const anchorExamples = anchors
    .map((a) => `Score ${a.anchorValue}: "${a.sampleText}"`)
    .join("\n");

  // Build prompt from spec template
  const prompt = spec.promptTemplate
    .replace("{{transcript}}", transcript.substring(0, 4000))
    .replace("{{parameter.name}}", spec.parameter?.name || spec.name)
    .replace("{{parameter.description}}", spec.parameter?.definition || spec.description || "")
    .replace("{{anchors}}", anchorExamples)
    .replace("{{scale_min}}", "0")
    .replace("{{scale_max}}", "1");

  // Call LLM (or mock for now)
  // TODO: Replace with actual LLM call
  return {
    score: 0.3 + Math.random() * 0.4,
    confidence: 0.7,
    evidence: ["[Mock scoring - LLM call needed]"],
  };
}
```

3. **Store spec reference in PersonalityObservation**
```typescript
// Add analysisSpecId to observation
await prisma.personalityObservation.create({
  data: {
    callId: call.id,
    userId: call.userId,
    analysisSpecId: spec.id,  // NEW: Link to spec
    // ... rest of data
  },
});
```

---

## Phase 2: Fix memory-extract.ts to Use AnalysisSpecs

### Current Issues
- Uses hardcoded regex patterns for extraction
- Doesn't use LEARN-type AnalysisSpecs
- Memory categories are hardcoded

### Changes Required

**File: `lib/ops/memory-extract.ts`**

1. **Query LEARN-type AnalysisSpecs**
```typescript
// BEFORE: Uses hardcoded patterns array (line 459-496)

// AFTER:
const learnSpecs = await prisma.analysisSpec.findMany({
  where: {
    outputType: "LEARN",
    isActive: true,
  },
  orderBy: { priority: "desc" },
});
```

2. **Use spec's promptTemplate for extraction**
```typescript
async function extractWithSpec(
  transcript: string,
  spec: AnalysisSpec,
  verbose: boolean
): Promise<ExtractedMemory[]> {
  // Build extraction prompt from spec template
  const prompt = spec.promptTemplate
    .replace("{{transcript}}", transcript.substring(0, 8000))
    .replace("{{category}}", spec.learnCategory || "FACT")
    .replace("{{description}}", spec.description || "");

  // Call LLM
  // TODO: Replace with actual LLM call

  // For now, fall back to pattern matching
  return extractMemoriesFromPatterns(transcript, spec.learnCategory);
}
```

3. **Map spec's learnCategory to MemoryCategory**
```typescript
// Use spec.learnCategory instead of hardcoded category mapping
const category = spec.learnCategory || mapCategory(extracted.category);
```

---

## Phase 3: Add Prompt Composition to Flow Graph

### Changes Required

**File: `lib/agents.json`**

Add new data node for prompt composition:
```json
{
  "id": "data:composed_prompts",
  "label": "Composed Prompts",
  "description": "Final prompts composed from parameter values and memories",
  "storageType": "virtual",
  "role": "output",
  "resources": [
    {
      "type": "table",
      "table": "PromptSlug",
      "link": "/prompt-slugs",
      "label": "Active Slugs"
    },
    {
      "type": "table",
      "table": "PromptCompositionConfig",
      "link": "/memories",
      "label": "Composition Config"
    }
  ]
}
```

Add edges from profiles and memories to composition:
```json
// In personality_analyzer outputs:
{
  "node": "data:composed_prompts",
  "edgeType": "dashed",
  "label": "feeds"
}

// In memory_extractor outputs:
{
  "node": "data:composed_prompts",
  "edgeType": "dashed",
  "label": "feeds"
}
```

**File: `app/api/flow/graph/route.ts`**

Ensure the composed_prompts node is rendered.

---

## Phase 4: Enable Disabled Agents

**File: `lib/agents.json`**

Change `enabled: false` to `enabled: true` for:
- `knowledge_ingestor`
- `knowledge_embedder`
- `personality_analyzer`
- `memory_extractor`

Add prerequisite checks for proper sequencing.

---

## Phase 5: Schema Updates (if needed)

**File: `prisma/schema.prisma`**

Add `analysisSpecId` to PersonalityObservation:
```prisma
model PersonalityObservation {
  // ... existing fields
  analysisSpecId  String?
  analysisSpec    AnalysisSpec? @relation(fields: [analysisSpecId], references: [id])
}
```

Add `learnCategory` to AnalysisSpec if not present:
```prisma
model AnalysisSpec {
  // ... existing fields
  learnCategory   String?  // For LEARN specs: FACT, PREFERENCE, EVENT, etc.
}
```

---

## Implementation Order

1. **Schema first** - Add any missing fields
2. **personality-analyze.ts** - Wire to MEASURE specs
3. **memory-extract.ts** - Wire to LEARN specs
4. **agents.json** - Add composition node, enable agents
5. **Flow UI** - Verify new nodes appear correctly
6. **End-to-end test** - Run full pipeline

---

## Testing Checklist

- [ ] Create MEASURE AnalysisSpec with promptTemplate for openness
- [ ] Create LEARN AnalysisSpec with promptTemplate for facts
- [ ] Run personality_analyzer agent
- [ ] Verify PersonalityObservation created with analysisSpecId
- [ ] Run memory_extractor agent
- [ ] Verify UserMemory created with correct category
- [ ] Test prompt composition with `/api/prompt/compose-from-slugs`
- [ ] Verify composed prompt includes personality adaptations + memories

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing analysis | Keep fallback to hardcoded behavior if no specs exist |
| LLM costs during testing | Keep mock scoring option with `--mock` flag |
| Schema migration issues | Make new fields optional with defaults |
| Agent run failures | Add detailed error logging and partial success handling |
