# TraitSystem Abstraction Plan

**Goal**: Generalize OCEAN (Big Five) and VARK into a unified TraitSystem architecture so any trait system can be defined via specs, configured per playbook, and rendered/consumed generically.

---

## Key Insight

**Most infrastructure already exists!**
- Specs already follow identical parameter structures with `section` field for grouping
- `CallerPersonalityProfile.parameterValues` is already a generic JSON store
- `VerticalSlider` component is already generic
- Only hardcoded references need refactoring

---

## Architecture: Playbook-Level Trait Configuration

Trait measurement is **optional per playbook** - different playbooks enable different trait systems.

### Playbook Config Schema
```json
// playbooks-config.json or Playbook model
{
  "playbookId": "wwii-tutor",
  "name": "WWII History Tutor",

  "traitSystems": {
    "enabled": ["OCEAN", "VARK"],     // Which systems to measure
    "config": {
      "OCEAN": { "minConfidence": 0.5 },
      "VARK": { "minTurns": 3 }
    }
  },

  "behaviorTargets": { ... }
}
```

### Pipeline Integration
```
EXTRACT stage
    ↓
    Filter MEASURE specs by playbook.traitSystems.enabled
    ↓
    Only run PERS-001 if "OCEAN" enabled
    Only run VARK-001 if "VARK" enabled
    ↓
AGGREGATE stage
    ↓
    Only aggregate enabled trait systems
    ↓
ADAPT stage
    ↓
    Only apply ADAPT-PERS-001 if OCEAN measured
    Only apply ADAPT-VARK-001 if VARK measured
    ↓
COMPOSE stage
    ↓
    Only inject promptGuidance for measured traits
```

### Trait System → Spec Mapping
| System ID | MEASURE Spec | ADAPT Spec | Domain |
|-----------|--------------|------------|--------|
| `OCEAN` | PERS-001 | ADAPT-PERS-001 | personality |
| `VARK` | VARK-001 | ADAPT-VARK-001 | learning |
| `KOLB` | KOLB-001 | ADAPT-KOLB-001 | learning |
| `MINDSET` | MINDSET-001 | ADAPT-MINDSET-001 | motivation |

---

## What's Hardcoded (Needs Refactoring)

| Location | Issue |
|----------|-------|
| `CallerPersonality` model | Fixed OCEAN fields (openness, conscientiousness, etc.) |
| `personality-analyze.ts:88-101` | `DEFAULT_TRAIT_MAPPING` constant |
| `transforms/personality.ts:14-78` | Hardcoded OCEAN trait handling |
| Caller page `TRAIT_INFO` | Hardcoded OCEAN-only constant |

---

## Implementation Phases

### Phase 1: TraitSystem Infrastructure (~3h)

**Goal**: Make trait systems fully data-driven - no code changes to add new systems.

#### 1.1 Extend Spec Schema for Trait System Metadata

**Modify** `docs-archive/bdd-specs/feature-spec-schema.json` - Add trait system fields:
```json
{
  "traitSystem": {
    "id": "OCEAN",                    // System identifier
    "name": "Big Five Personality",   // Display name
    "primaryColor": "#a78bfa",        // System accent color
    "adaptSpec": "ADAPT-PERS-001"     // Linked ADAPT spec
  }
}
```

**Modify** `PERS-001-personality-measurement.spec.json`:
```json
{
  "id": "PERS-001",
  "traitSystem": {
    "id": "OCEAN",
    "name": "Big Five Personality",
    "primaryColor": "#a78bfa",
    "adaptSpec": "ADAPT-PERS-001"
  },
  "parameters": [
    {
      "id": "B5-O",
      "color": "#a78bfa",  // Per-trait color
      ...
    }
  ]
}
```

**Modify** `VARK-001-learning-modality.spec.json`:
```json
{
  "traitSystem": {
    "id": "VARK",
    "name": "Learning Modality",
    "primaryColor": "#818cf8",
    "adaptSpec": "ADAPT-VARK-001"
  }
}
```

#### 1.2 Store Trait System Metadata in DB

**Modify** `prisma/schema.prisma` - Add TraitSystem model:
```prisma
model TraitSystem {
  id            String   @id @default(uuid())
  systemId      String   @unique  // "OCEAN", "VARK"
  name          String             // "Big Five Personality"
  primaryColor  String             // "#a78bfa"
  measureSpecId String?            // "PERS-001"
  adaptSpecId   String?            // "ADAPT-PERS-001"
  domain        String             // "personality", "learning"
  sortOrder     Int      @default(0)

  // Relations
  parameters    Parameter[]
}

model Parameter {
  // ... existing fields
  color           String?          // Per-trait color
  traitSystemId   String?
  traitSystem     TraitSystem?     @relation(fields: [traitSystemId])
}
```

#### 1.3 Update Seed to Create TraitSystem Records

**Modify** `prisma/seed-from-specs.ts`:
- Extract `traitSystem` from spec file
- Create/update TraitSystem record
- Link Parameters to their TraitSystem
- Store per-parameter colors

#### 1.4 Create TraitSystem Loader (Data-Driven)

**Create** `/apps/admin/lib/trait-system/types.ts`:
```typescript
interface TraitSystemDefinition {
  id: string;           // "OCEAN", "VARK"
  systemId: string;     // DB id
  name: string;         // "Big Five Personality"
  primaryColor: string; // "#a78bfa"
  domain: string;       // "personality", "learning"
  measureSpecId: string;
  adaptSpecId: string;
  traits: TraitDefinition[];
}

interface TraitDefinition {
  parameterId: string;  // "B5-O", "VARK-V"
  name: string;         // "openness", "visual_modality"
  label: string;        // "Openness", "Visual"
  description: string;
  color: string;        // "#a78bfa" (from DB, not CSS var)
  interpretationHigh: string;
  interpretationLow: string;
  promptGuidance?: { whenHigh, whenLow, whenMedium };
}
```

**Create** `/apps/admin/lib/trait-system/loader.ts`:
- `loadTraitSystems()`: Query TraitSystem with Parameters, no hardcoded registry
- `getTraitSystemById(id)`: Get single system
- `getAvailableTraitSystems()`: List for UI dropdowns
- Cache results with invalidation

### Phase 2: Backend Refactoring (~5h)

**Modify** `/apps/admin/lib/ops/personality-analyze.ts`
- Remove `DEFAULT_TRAIT_MAPPING` constant (lines 88-101)
- Use `loadTraitSystems()` to build mappings dynamically
- Keep writing to both `CallerPersonality` and `CallerPersonalityProfile.parameterValues`

**Modify** `/apps/admin/lib/prompt/composition/transforms/personality.ts`
- Replace hardcoded OCEAN with loop through all trait systems
- Build output: `{ ocean: { traits: {...} }, vark: { traits: {...} } }`
- Generate adaptations from any system's `promptGuidance`

**Modify** `/apps/admin/lib/prompt/composition/types.ts`
- Add `parameterValues: Record<string, number | null>` to `PersonalityData`
- Keep legacy OCEAN fields for backward compatibility

### Phase 3: Frontend Components (~8h)

#### 3.1 Generic Trait Display Components

**Create** `/apps/admin/components/shared/TraitSystemDisplay.tsx`
```tsx
interface Props {
  system: TraitSystemDefinition;
  values: Record<string, number>;
  compact?: boolean;
  showSparklines?: boolean;
}
// Uses SliderGroup + VerticalSlider, passes colors/labels from system
// Colors come from DB (system.traits[].color), not CSS variables
```

**Create** `/apps/admin/components/shared/TraitSystemsPanel.tsx`
- Fetches trait systems and caller values
- Renders TraitSystemDisplay for each system

**Modify** caller detail page (wherever active version is)
- Remove hardcoded `TRAIT_INFO` constant
- Replace with `TraitSystemsPanel` component

#### 3.2 Playbook Trait System Selector (Admin UI)

**Modify** `/apps/admin/components/playbook/PlaybookBuilder.tsx`:

Add trait system configuration section:
```tsx
// New section in PlaybookBuilder
<Section title="Caller Understanding">
  <Label>Enabled Trait Systems</Label>
  <Description>
    Select which trait systems to measure for callers using this playbook.
  </Description>
  <TraitSystemSelector
    available={availableTraitSystems}  // From /api/trait-systems
    selected={playbook.traitSystems?.enabled || ["OCEAN"]}
    onChange={(enabled) => updatePlaybook({ traitSystems: { enabled } })}
  />
</Section>
```

**Create** `/apps/admin/components/playbook/TraitSystemSelector.tsx`:
```tsx
interface Props {
  available: TraitSystemDefinition[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

// Multi-select with checkboxes showing:
// [x] OCEAN - Big Five Personality
// [x] VARK - Learning Modality
// [ ] KOLB - Learning Cycle (if available)
```

#### 3.3 Trait System Admin Page (Optional but nice)

**Create** `/apps/admin/app/x/trait-systems/page.tsx`:
- List all registered trait systems
- Show: systemId, name, color swatch, measureSpec, adaptSpec, parameter count
- Read-only view (systems come from specs via seed)
- Helps admin see what's available

### Phase 4: API Endpoints (~2h)

**Create** `/apps/admin/app/api/trait-systems/route.ts`
- GET returns all trait system definitions

**Create** `/apps/admin/app/api/callers/[callerId]/trait-values/route.ts`
- GET returns caller's values grouped by system

### Phase 5: Pipeline Integration (~4h)

**Goal**: Make trait measurement optional per playbook.

#### 5.1 Add `traitSystems` to Playbook Model

**Modify** `prisma/schema.prisma`:
```prisma
model Playbook {
  // ... existing fields
  traitSystems     Json?   // { enabled: ["OCEAN", "VARK"], config: {...} }
}
```

**Modify** `docs-archive/bdd-specs/playbooks-config.json` (or wherever playbook config lives):
```json
{
  "playbookId": "wwii-tutor",
  "traitSystems": {
    "enabled": ["OCEAN", "VARK"]
  }
}
```

#### 5.2 Create Data-Driven Spec Lookup (No Hardcoded Registry)

**Create** `/apps/admin/lib/trait-system/pipeline-helpers.ts`:
```typescript
// Get specs to run for a playbook - reads from TraitSystem DB table
async function getEnabledMeasureSpecs(playbook: Playbook): Promise<string[]> {
  const enabled = playbook.traitSystems?.enabled || ["OCEAN"]; // default

  // Query TraitSystem table for spec IDs
  const systems = await prisma.traitSystem.findMany({
    where: { systemId: { in: enabled } },
    select: { measureSpecId: true }
  });

  return systems.map(s => s.measureSpecId).filter(Boolean);
}

async function getEnabledAdaptSpecs(playbook: Playbook): Promise<string[]> {
  const enabled = playbook.traitSystems?.enabled || ["OCEAN"];

  const systems = await prisma.traitSystem.findMany({
    where: { systemId: { in: enabled } },
    select: { adaptSpecId: true }
  });

  return systems.map(s => s.adaptSpecId).filter(Boolean);
}
```

#### 5.3 Modify Pipeline EXTRACT Stage

**Modify** `/apps/admin/app/api/calls/[callId]/pipeline/route.ts`:

```typescript
// In EXTRACT stage (around line 50-80)
async function runExtractStage(call: Call, playbook: Playbook) {
  // Get enabled trait specs for this playbook
  const enabledMeasureSpecs = getEnabledMeasureSpecs(playbook);

  // Filter MEASURE specs to only enabled ones
  const measureSpecs = allMeasureSpecs.filter(spec =>
    enabledMeasureSpecs.includes(spec.specId)
  );

  // Run only enabled specs
  for (const spec of measureSpecs) {
    await runMeasureSpec(spec, call);
  }
}
```

#### 5.4 Modify Pipeline ADAPT Stage

**Modify** ADAPT stage to only apply enabled adapt specs:
```typescript
async function runAdaptStage(call: Call, playbook: Playbook) {
  const enabledAdaptSpecs = getEnabledAdaptSpecs(playbook);

  const adaptSpecs = allAdaptSpecs.filter(spec =>
    enabledAdaptSpecs.includes(spec.specId)
  );

  // Only apply adaptations for enabled systems
  for (const spec of adaptSpecs) {
    await applyAdaptSpec(spec, call);
  }
}
```

#### 5.5 Modify Pipeline COMPOSE Stage

**Modify** COMPOSE to only inject guidance for measured traits:
```typescript
async function runComposeStage(call: Call, playbook: Playbook) {
  const enabledSystems = playbook.traitSystems?.enabled || ["OCEAN"];

  // Load trait values from CallerPersonalityProfile
  const profile = await loadCallerProfile(call.callerId);

  // Filter to only enabled systems
  const traitGuidance = buildTraitGuidance(profile, enabledSystems);

  // Inject into prompt
  return composePrompt({ ...context, traitGuidance });
}
```

### Phase 6: Migration & Compatibility (~1.5h)

**Create** `/apps/admin/scripts/migrate-to-trait-system.ts`
- Sync existing `CallerPersonality` → `CallerPersonalityProfile.parameterValues`
- Set default `traitSystems: { enabled: ["OCEAN"] }` on existing playbooks

**Create** `/apps/admin/lib/trait-system/compat.ts`
- `getLegacyPersonality()`: Extract OCEAN from parameterValues
- `syncPersonalityToLegacy()`: Write to both models

---

## Critical Files

| File | Action | Notes |
|------|--------|-------|
| `prisma/schema.prisma` | MODIFY | Add TraitSystem model, traitSystems to Playbook, color to Parameter |
| `docs-archive/bdd-specs/feature-spec-schema.json` | MODIFY | Add traitSystem metadata fields |
| `docs-archive/bdd-specs/PERS-001-*.spec.json` | MODIFY | Add traitSystem block with id, name, color |
| `docs-archive/bdd-specs/VARK-001-*.spec.json` | MODIFY | Add traitSystem block |
| `prisma/seed-from-specs.ts` | MODIFY | Extract traitSystem, create TraitSystem records |
| `lib/trait-system/types.ts` | CREATE | Core type definitions |
| `lib/trait-system/loader.ts` | CREATE | Load from DB (data-driven, no hardcoded registry) |
| `lib/trait-system/pipeline-helpers.ts` | CREATE | getEnabledMeasureSpecs, getEnabledAdaptSpecs |
| `lib/ops/personality-analyze.ts` | REFACTOR | Remove DEFAULT_TRAIT_MAPPING |
| `lib/prompt/composition/transforms/personality.ts` | REFACTOR | Dynamic trait loading |
| `app/api/calls/[callId]/pipeline/route.ts` | REFACTOR | Filter specs by playbook.traitSystems |
| `components/shared/TraitSystemDisplay.tsx` | CREATE | Generic trait renderer |
| `components/playbook/PlaybookBuilder.tsx` | MODIFY | Add TraitSystemSelector section |
| `components/playbook/TraitSystemSelector.tsx` | CREATE | Multi-select for enabled systems |
| `app/x/trait-systems/page.tsx` | CREATE | Admin view of registered systems |
| Caller detail page | REFACTOR | Remove TRAIT_INFO, use generic component |

---

## Verification

1. **Unit Tests**: `lib/trait-system/loader.test.ts`
   - Load OCEAN and VARK systems from Parameters
   - Verify grouping by section works
   - Verify registry returns correct specs for enabled systems

2. **Integration Tests**: `__tests__/api/trait-systems.test.ts`
   - Verify API returns both systems
   - Verify caller trait values endpoint

3. **Pipeline Tests**: `tests/api/pipeline.test.ts`
   - Playbook with `["OCEAN"]` only runs PERS-001
   - Playbook with `["OCEAN", "VARK"]` runs both PERS-001 and VARK-001
   - Playbook with `[]` skips all trait measurement
   - COMPOSE only injects guidance for measured traits

4. **Manual Testing**:
   - Caller page shows OCEAN (regression)
   - Caller page shows VARK (new, only if measured)
   - Prompt composition includes only enabled systems
   - Create call with different playbooks, verify correct specs run

---

## Adding Future Trait Systems (Admin-Friendly - No Code Changes!)

To add a new trait system (e.g., KOLB, MINDSET):

| Step | How | UI Location |
|------|-----|-------------|
| 1. Create MEASURE spec | Upload `KOLB-001.spec.json` with `traitSystem` metadata | `/x/import` |
| 2. Create ADAPT spec | Upload `ADAPT-KOLB-001.spec.json` | `/x/import` |
| 3. Sync to database | Click "Sync All" | `/x/admin/spec-sync` |
| 4. Enable in playbook | Check "KOLB" in trait systems selector | PlaybookBuilder |

**That's it! No code changes, no CSS edits, no registry files.**

### Example: Adding KOLB Learning Styles

**Step 1**: Create `KOLB-001-learning-cycle.spec.json`:
```json
{
  "id": "KOLB-001",
  "title": "Kolb Learning Cycle Assessment",
  "domain": "learning",
  "specType": "SYSTEM",
  "outputType": "MEASURE",

  "traitSystem": {
    "id": "KOLB",
    "name": "Kolb Learning Cycle",
    "primaryColor": "#10b981",
    "adaptSpec": "ADAPT-KOLB-001"
  },

  "parameters": [
    {
      "id": "KOLB-CE",
      "name": "concrete_experience",
      "color": "#10b981",
      "section": "Kolb Learning Styles",
      ...
    },
    {
      "id": "KOLB-RO",
      "name": "reflective_observation",
      "color": "#3b82f6",
      ...
    }
  ]
}
```

**Step 2**: Upload via `/x/import`
**Step 3**: Sync via `/x/admin/spec-sync`
**Step 4**: Enable in playbook via PlaybookBuilder UI

---

## Example Playbook Configurations

```json
// Education Tutor - measures learning style + personality
{
  "playbookId": "wwii-tutor",
  "traitSystems": { "enabled": ["OCEAN", "VARK"] }
}

// Elderly Companion - personality only (no learning modality needed)
{
  "playbookId": "mabel-companion",
  "traitSystems": { "enabled": ["OCEAN"] }
}

// Sales Agent - minimal trait tracking
{
  "playbookId": "sales-support",
  "traitSystems": { "enabled": [] }  // No trait measurement
}

// Future: Full learner profiling
{
  "playbookId": "adaptive-tutor",
  "traitSystems": { "enabled": ["OCEAN", "VARK", "KOLB", "MINDSET"] }
}
```

---

## Estimated Effort: ~25 hours

| Phase | Hours | Key Deliverables |
|-------|-------|------------------|
| 1. Infrastructure | 3h | TraitSystem model, spec schema, seed updates |
| 2. Backend | 5h | Remove hardcoded mappings, dynamic loading |
| 3. Frontend | 8h | TraitSystemDisplay, PlaybookBuilder selector, admin page |
| 4. API | 2h | /api/trait-systems, /api/callers/.../trait-values |
| 5. Pipeline Integration | 5h | Data-driven spec filtering, all stages |
| 6. Migration | 2h | Existing data, default playbook config |

---

## Dependency Order

```
Phase 1 (Schema + Seed)
    ↓
Phase 2 (Backend) + Phase 5 (Pipeline) ─── can run in parallel
    ↓
Phase 3 (Frontend) + Phase 4 (API) ─── can run in parallel
    ↓
Phase 6 (Migration) ─── last
```

---

## Admin Experience Summary

After implementation, adding a new trait system requires:

| Task | UI | Code Change? |
|------|-----|--------------|
| Create MEASURE spec | `/x/import` | No |
| Create ADAPT spec | `/x/import` | No |
| Sync to DB | `/x/admin/spec-sync` | No |
| Enable in playbook | PlaybookBuilder | No |

**Zero code changes for new trait systems.**
