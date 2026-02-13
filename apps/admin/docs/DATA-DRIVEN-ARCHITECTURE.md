# DATA-DRIVEN ARCHITECTURE - NO HARDCODING

<!-- @doc-source model:Parameter,CallerPersonalityProfile,AnalysisSpec -->
<!-- @doc-source file:apps/admin/lib/prompt/composition/SectionDataLoader.ts -->
<!-- @doc-source file:apps/admin/lib/prompt/PromptTemplateCompiler.ts -->
<!-- @doc-source route:/api/parameters/display-config -->

**Date:** February 9, 2026
**Status:** ENFORCED

## Core Principle

**THE SYSTEM IS 100% DATA-DRIVEN. ALL PARAMETERS FLOW FROM DATABASE → API → UI.**

**NEVER HARDCODE PARAMETER LISTS, PERSONALITY TRAITS, OR MEASUREMENT TYPES.**

---

## Data Flow

```
Parameter Table (Database)
    ↓
/api/parameters/display-config
    ↓
UI Components (React State: paramConfig)
    ↓
Dynamic Rendering (ALL parameters, grouped by type)
```

---

## ✅ Correct Patterns

### UI Layer
```typescript
// ✅ CORRECT - Dynamic from API
const [paramConfig, setParamConfig] = useState<ParamConfig | null>(null);

useEffect(() => {
  fetch("/api/parameters/display-config")
    .then(r => r.json())
    .then(data => setParamConfig(data));
}, []);

// Render ALL parameters dynamically
{Object.entries(paramConfig.grouped).map(([groupName, params]) => (
  <div key={groupName}>
    <h3>{groupName}</h3>
    {params.map(param => (
      <Parameter key={param.parameterId} {...param} />
    ))}
  </div>
))}
```

### Backend Layer
```typescript
// ✅ CORRECT - Load from CallerPersonalityProfile
const profile = await prisma.callerPersonalityProfile.findUnique({
  where: { callerId },
  select: { parameterValues: true } // Dynamic Record<string, number>
});

// Process ALL parameters dynamically
for (const [parameterId, value] of Object.entries(profile.parameterValues)) {
  // Process each parameter...
}
```

### Transform Layer
```typescript
// ✅ CORRECT - Process all parameters dynamically
export function processPersonality(data: Record<string, number>) {
  const traits: Record<string, TraitInfo> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip non-parameter fields
    if (['preferredTone', ...].includes(key)) continue;

    traits[key] = {
      score: value,
      level: classifyValue(value, thresholds)
    };
  }

  return traits;
}
```

---

## Transform Layer (Composition Pipeline)

The composition pipeline is also fully data-driven. Transforms are registered by name and resolved at runtime from COMP-001 spec sections.

### ✅ Correct: Transform Chains from Spec
```json
// In COMP-001 spec — section defines transform as array
{
  "id": "memories",
  "transform": ["deduplicateMemories", "scoreMemoryRelevance", "groupMemoriesByCategory"],
  "config": { "memoriesPerCategory": 5 }
}
```

The executor chains them sequentially — output of each feeds the next. Adding a new transform = add it to the spec array (zero code changes if already registered).

### ✅ Correct: Spec-Driven Config
```typescript
// ✅ CORRECT - Config comes from spec, not code
const alpha: number = memConfig.relevanceAlpha ?? context.specConfig.relevanceAlpha ?? 1.0;
const categoryWeights: Record<string, number> = memConfig.categoryRelevanceWeights ?? {};
const memoriesPerCategory = sectionDef.config?.memoriesPerCategory || 5;
```

### ✅ Correct: Dynamic Memory Categories
```typescript
// ✅ CORRECT - Render all categories from data
const categories = Object.keys(mem.byCategory);
for (const cat of categories) {
  // render...
}
```

### ✅ Correct: Narrative Templates from Spec
```typescript
// ✅ CORRECT - Templates from COMP-001 spec config
const templates = specConfig.narrativeTemplates || {};
const genericTemplate = specConfig.genericNarrativeTemplate || "Their {key} is {value}";
```

### ❌ FORBIDDEN: Hardcoded Memory Categories
```typescript
// ❌ WRONG - Hardcoded category list
const categories = ["FACT", "PREFERENCE", "TOPIC", "RELATIONSHIP"];
```

### ❌ FORBIDDEN: Hardcoded Relevance Weights
```typescript
// ❌ WRONG - Weights belong in spec config
const alpha = 0.6; // should come from spec
const categoryBoost = { "CONTEXT": 0.15 }; // should come from spec
```

---

## ❌ FORBIDDEN Patterns

### ❌ Hardcoded Parameter Lists
```typescript
// ❌ WRONG - Hardcoded Big Five only
const traits = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];

// ❌ WRONG - Hardcoded VARK only
const learningStyles = ['visual', 'auditory', 'reading', 'kinesthetic'];

// ❌ WRONG - Filtering to specific type
const bigFive = Object.entries(params).filter(([_, p]) => p.group === "Big Five");
```

### ❌ Hardcoded Transform Logic
```typescript
// ❌ WRONG - Hardcoded OCEAN processing
return {
  openness: { score: data.openness, level: classify(data.openness) },
  conscientiousness: { score: data.conscientiousness, level: classify(data.conscientiousness) },
  // ...
};
```

### ❌ Hardcoded UI Sections
```typescript
// ❌ WRONG - Only showing Big Five
<div>
  <h3>Big Five Traits</h3>
  {renderOCEAN(data)}
</div>
```

---

## Models & Schema

### ✅ Dynamic Models (Use These)
- **`CallerPersonalityProfile`** - Has `parameterValues: Json` (stores ANY parameters)
- **`Parameter`** - Database table defining all parameters
- **`CallScore`** - Uses `parameterId: String` (foreign key, not hardcoded)
- **`BehaviorMeasurement`** - Uses `parameterId: String`

### ⚠️ Legacy Models (Being Phased Out)
- **`PersonalityObservation`** - Has hardcoded OCEAN fields (DEPRECATED Feb 2026)
  - Now also has `parameterValues: Json` field
  - Legacy fields marked DEPRECATED in schema
  - Migration: `/prisma/migrations/20260209231230_add_parameter_values_to_observation/`
- **`CallerPersonality`** - Has hardcoded OCEAN + preference fields (backward compat only)

---

## Migration Status (Feb 9, 2026)

### ✅ Fully Dynamic (Complete)
1. **UI Layer**
   - `app/_archived/legacy-pages/callers/[callerId]/page.tsx` - Uses `paramConfig.grouped`
   - `app/api/parameters/display-config/route.ts` - Serves dynamic parameter metadata
   - Compact personality profile - Shows first 6 parameters (not just Big Five)

2. **Backend Logic**
   - `lib/prompt/composition/SectionDataLoader.ts` - Loads `parameterValues` dynamically
   - `lib/prompt/composition/transforms/personality.ts` - Processes ALL parameters dynamically
   - `lib/ops/personality-analyze.ts` - Updates `CallerPersonalityProfile.parameterValues`

3. **API Routes**
   - `/api/callers/[callerId]/route.ts` - Uses `CallerPersonalityProfile`
   - `/api/calls/[callId]/pipeline/route.ts` - Uses dynamic parameter loading

### ⚠️ Legacy (Backward Compatibility)
- `PersonalityObservation` OCEAN fields - Kept for old data, use `parameterValues` for new records
- `lib/registry/index.ts` TRAITS constants - Only for backward compat with old code

---

## Adding New Parameters

### Before (❌ Old Way - Required Code Changes)
1. Add column to `PersonalityObservation` table
2. Update UI hardcoded lists
3. Update transform logic
4. Update every file that processes personality
5. Deploy code changes

### After (✅ New Way - Zero Code Changes)
1. Create BDD spec file: `docs-archive/bdd-specs/NEW-PARAM-001.spec.json`
2. Upload via `/x/import` UI
3. Activate spec
4. **Done!** Parameter appears everywhere automatically:
   - UI shows it (from `paramConfig.grouped`)
   - Pipeline measures it (from `Parameter` table)
   - Prompts use it (from `CallerPersonalityProfile.parameterValues`)
   - Reports display it (dynamic grouping)

---

## Enforcement

### Code Review Checklist
- [ ] No hardcoded `['openness', 'conscientiousness', ...]` arrays
- [ ] No `filter(p => p.group === "Big Five")` filters
- [ ] Uses `paramConfig.grouped` or `parameterValues` for rendering
- [ ] Loops through ALL parameters, not subset
- [ ] No switch/case on specific parameter IDs

### Pre-Commit Hook (Future)
```bash
# Reject commits with hardcoded personality parameters
git grep -E "(openness|conscientiousness|extraversion|agreeableness|neuroticism)" -- '*.ts' '*.tsx' ':!*.test.ts' ':!**/legacy-**' && exit 1
```

---

## Examples in Codebase

### ✅ Good Example: PersonalitySection
**File:** `app/_archived/legacy-pages/callers/[callerId]/page.tsx:4238`

```typescript
{Object.entries(paramConfig.grouped).map(([groupName, params]) => {
  const hasValues = params.some(param =>
    personality.parameterValues[param.parameterId] !== undefined
  );
  if (!hasValues) return null;

  return (
    <div key={groupName}>
      <div>{groupName}</div>
      {params.map(param => {
        const value = personality.parameterValues[param.parameterId];
        return <ParameterBar key={param.parameterId} {...param} value={value} />;
      })}
    </div>
  );
})}
```

### ✅ Good Example: personality.ts Transform
**File:** `lib/prompt/composition/transforms/personality.ts:33`

```typescript
for (const [key, value] of Object.entries(personality)) {
  if (['preferredTone', 'preferredLength', ...].includes(key)) continue;

  if (typeof value === 'number' || value === null) {
    traits[key] = {
      score: value,
      level: value !== null ? classifyValue(value, thresholds) : null,
      parameterId: key,
    };
  }
}
```

---

## Contact / Questions

If you find hardcoded parameter references in production code:
1. **DO NOT MERGE** - This violates the data-driven architecture
2. Refactor to use dynamic parameter loading
3. Test with VARK, Big Five, and custom parameters
4. Update this document if needed

**System is DATA-DRIVEN. Period.** 🎯
