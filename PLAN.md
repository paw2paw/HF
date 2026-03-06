# Plan: Subject Awareness (3 fixes)

## Key findings from code read

1. `loadedData.playbooks[0]?.config` is already in context — Prisma `include` returns all scalars
   → Feature 1 needs **zero SectionDataLoader changes**; reads from existing loadedData
2. `resolveExtractionConfig` has 11 callers across 6 files (extract, import, ingest, structure, analyze, subjects)
   → Adding optional params is backward-compatible; only primary paths get the new args
3. `getSubjectsForPlaybook` (domain-sources.ts) does not select `name` from Subject
   → Feature 1 can't use Subject.name ("Victorian Britain") as fallback without a domain-sources change
   → Better: Feature 1 reads `subjectDiscipline` from Playbook.config (set by Feature 2)
4. `scaffold.ts` creates a **domain-level** identity spec; `subjectDiscipline` belongs at
   **Playbook (course) level** — the two are correctly separate, no scaffold changes for any feature

**Execution order: Feature 2 → Feature 1 → Feature 3**
Feature 2 writes `subjectDiscipline` to `Playbook.config`. Features 1 and 3 both read it.

---

## Feature 2: Upfront subject picker — do this first

### Problem
Teacher enters course name and picks teaching mode, but never explicitly declares
"this is a History course." `suggestInteractionPattern` infers pattern from the course name
("GCSE History: Victorian Britain") alone — weak signal. No `subjectDiscipline` field exists
anywhere in the data model.

### Where it goes
In the **new course form** in `TeachWizard` (`components/wizards/teachwizard.tsx`),
between "Course name" and "What kind of course is this?".

### UI sketch
```
Course name
┌──────────────────────────────────────────────┐
│ e.g. GCSE History: Victorian Britain...       │
└──────────────────────────────────────────────┘

Subject area  (optional)
 [History] [English] [Maths] [Science] [Geography]
 [Computing] [Business] [PSHE]
┌──────────────────────────────────────────────┐
│ Other subject: e.g. Biology, PE...            │
└──────────────────────────────────────────────┘

What kind of course is this?
 [Directive] [Socratic] [Advisory] …            ← auto-updated by subject chip
```

Chips use compact `tw-intent-card` style (no icon column). Selecting a chip writes the
discipline string to the free-text field. Free text also accepted directly. Field is optional.

### Data flow

**`components/wizards/teachwizard.tsx`**
1. Add state: `const [subjectDiscipline, setSubjectDiscipline] = useState("")`
2. Add UI block in the new course form (chip row + free-text input)
3. Chip click handler: `setSubjectDiscipline(label.toLowerCase())` — sets both chip selection
   state and the text field
4. On chip select: also call `suggestInteractionPattern` with both discipline + course name
   combined to improve the suggested mode (e.g. History → Socratic, Maths → Directive).
   This is a client-side enhancement: `suggestInteractionPattern(subjectDiscipline + " " + newCourseName)`
5. In launch handler at `POST /api/playbooks` (~line 1431): add `subjectDiscipline` to config:
   ```ts
   body: JSON.stringify({
     name: newCourseName.trim(),
     domainId: selectedDomainId,
     config: {
       teachingMode,
       subjectDiscipline: subjectDiscipline.trim().toLowerCase() || null,
     },
   })
   ```
6. Update `courseSummary` to show discipline: `"New: Victorian Britain · History · Directive"`

**`app/api/playbooks/route.ts`** (POST handler)
Verify `config` is stored as-is (no key whitelisting). `Playbook.config` is JSONB — confirm
the POST handler passes `config` through to `prisma.playbook.create`. No change needed if it
already does.

### Scaffold note
Scaffold creates a **domain-level** identity spec using `domain.name`. The `subjectDiscipline`
belongs at the **Playbook (course) level**. A domain can teach History AND English in different
courses — it would be wrong to bake one discipline into the domain identity. No scaffold changes.

### Chips to show (in order)
History, English, Maths, Science, Geography, Computing, Business, PSHE
(8 chips; "Other" is the free-text field label)

### Guards
1. Dead-ends: PASS — `subjectDiscipline` flows into `Playbook.config`, read by Features 1+3
2. Forever spinners: N/A — form field, no async
5. Escape routes: PASS — field optional, teacher skips without consequence
6. Gold UI: PASS — `tw-intent-card` compact; no inline styles; free-text uses `tw-input`
11. Migration: PASS — `Playbook.config` is JSONB, no migration needed

---

## Feature 1: Subject in `you_are` — do this second

### Problem
`quickstart.ts:44-45` fallback writes `"A ${callerDomain.name} tutor and voice assistant"`
when the identity spec is absent or generic. `callerDomain.name` is the **institution** name
("Greenfield Academy"), not the subject ("History").

### Why it fires
`getRoleStatement()` returns "A helpful voice assistant" when:
- No identity spec linked to the playbook, or
- Identity spec exists but has no `tutor_role.roleStatement`, `roleStatement`, or `description`

### Key finding
`loadedData.playbooks` is loaded by the `playbooks` loader in `SectionDataLoader` using
`prisma.playbook.findMany({ include: { ... } })`. Prisma `include` returns **all scalar fields**
including `config`. So `loadedData.playbooks[0]?.config?.subjectDiscipline` is **already
available** — zero SectionDataLoader or domain-sources changes required.

### Fix (2 lines in quickstart.ts)

**`lib/prompt/composition/transforms/quickstart.ts:42-46`**

```ts
// Before:
if (callerDomain?.name && (role === "A helpful voice assistant" || role.toLowerCase().includes("generic"))) {
  role = `A ${callerDomain.name} tutor and voice assistant`;
}

// After:
const subjectDiscipline = (loadedData.playbooks?.[0]?.config as any)?.subjectDiscipline as string | undefined;
if (callerDomain?.name && (role === "A helpful voice assistant" || role.toLowerCase().includes("generic"))) {
  role = `A ${subjectDiscipline || callerDomain.name} tutor and voice assistant`;
}
```

That's 1 new line (the `subjectDiscipline` extraction) + 1 changed line (the fallback string).

### Result
- Before Feature 2 done: still says "Greenfield Academy tutor" (no regression)
- After Feature 2 done: says "History tutor" for callers on History courses

### Scaffold note
Scaffold creates identity spec with `roleStatement: "You are a friendly, supportive tut
specializing in ${domain.name}."` — this is NOT "A helpful voice assistant" so the fallback at
line 44 does NOT fire for scaffolded domains. The fix only helps when the fallback IS triggered
(unscaffolded domain, or identity spec with no roleStatement). No scaffold changes needed.

### Guards
1. Dead-ends: PASS — value flows into `you_are` prompt field
6. Gold UI: N/A — prompt text, not UI
10. Pipeline integrity: PASS — `_quickStart` section only

---

## Feature 3: Subject-aware extraction prompt — do this third

### Problem
`DEFAULT_CONFIG.extraction.systemPrompt` in `resolve-config.ts` is finance-flavoured: examples
reference ISA allowances, tax years, and financial thresholds. A History textbook or English
reading passage gets the same generic prompt. The old `TEACHING_MODE_KEYWORDS` map (history→recall,
english→comprehension) was deprecated and never injected into extraction prompts.

### Architecture
`resolveExtractionConfig` merges in this order:
1. System spec (DB) → DEFAULT_CONFIG
2. Domain override spec (if exists)
3. Type overrides (`applyTypeOverrides` — CURRICULUM, WORKSHEET, etc.)
4. Pattern overrides (`applyPatternOverrides` — SOCRATIC, DIRECTIVE, etc.) ← prepends to prompt

New step 3.5 (between type and pattern): `applySubjectPreamble` prepends a subject-specific
paragraph. Pattern preamble stays outermost (most urgent instruction for the LLM).

**Final prompt order:**
```
INTERACTION PATTERN: SOCRATIC…   ← step 4 prepend  (top — how to run the session)
SUBJECT: HISTORY. Focus on…      ← step 3.5 prepend (middle — what to look for)
[base systemPrompt with categories]              (bottom — generic extraction rules)
```

### Changes

**`lib/content-trust/resolve-config.ts`**

Add `SUBJECT_PREAMBLES: Record<string, string>` (keyed by lowercase discipline keyword):

```ts
const SUBJECT_PREAMBLES: Record<string, string> = {
  history:   "SUBJECT: HISTORY. Prioritise dates, periods, events, people, causes/consequences, \
               historiographical significance. 'threshold' means a date-range, NOT a financial limit. \
               Omit tax years.",
  english:   "SUBJECT: ENGLISH / LITERACY. Prioritise vocabulary, themes, language techniques, \
               character analysis, and textual evidence. Mark examRelevance high for essay-worthy quotes.",
  maths:     "SUBJECT: MATHEMATICS. Prioritise formulas, theorems, worked procedures, number types. \
               Categories: steps → 'process', theorems → 'rule', formulas → 'fact'. Omit currency values.",
  science:   "SUBJECT: SCIENCE. Prioritise concepts, terminology, hypotheses, lab procedures, \
               observations. State units precisely.",
  geography: "SUBJECT: GEOGRAPHY. Prioritise physical/human processes, case studies, location facts, \
               statistics. Tag case study names as 'example'.",
  computing: "SUBJECT: COMPUTING. Prioritise algorithms, data structures, concepts, patterns. \
               Mark code as 'process'.",
  business:  "SUBJECT: BUSINESS STUDIES. Prioritise concepts, models, financial ratios, case studies.",
  pshe:      "SUBJECT: PSHE / WELLBEING. Prefer 'discussion_prompt' and 'example' over bare facts.",
  finance:   "SUBJECT: FINANCIAL SERVICES (default). Focus on thresholds, product rules, tax years, \
               compliance, suitability.",
};
```

Add `inferSubjectDiscipline(subjectDiscipline?: string, subjectName?: string): string | null`:
- Check `subjectDiscipline` first (explicit — from Playbook.config)
- Fallback: scan `subjectName` for SUBJECT_PREAMBLES keys as substrings
- Returns the matched key (e.g. `"history"`) or null

Add `applySubjectPreamble(config: ExtractionConfig, discipline: string | null): ExtractionConfig`:
- If null, returns unchanged config
- Prepends `SUBJECT_PREAMBLES[discipline]` to `extraction.systemPrompt`
- Same pattern as `applyPatternOverrides`

Update `resolveExtractionConfig` signature + body:
```ts
export async function resolveExtractionConfig(
  sourceId?: string,
  documentType?: DocumentType,
  interactionPattern?: InteractionPattern,
  subjectDiscipline?: string,   // NEW — from Playbook.config (explicit)
  subjectName?: string,          // NEW — Subject.name (fallback keyword match)
): Promise<ExtractionConfig>
```

Insert between step 3 and step 4:
```ts
// 3.5 Apply subject preamble
const discipline = inferSubjectDiscipline(subjectDiscipline, subjectName);
resolved = applySubjectPreamble(resolved, discipline);
```

**`app/api/content-sources/[sourceId]/extract/route.ts`**

Already has (lines ~90–110):
- `interactionPattern` from `pbConfig.interactionPattern`
- `subjectName = source.subjects[0]?.subject?.name || source.name`
- `const pbConfig = playbook?.config as Record<string, any> | null`

Add one line:
```ts
const subjectDiscipline = pbConfig?.subjectDiscipline as string | undefined;
```

Update the `resolveExtractionConfig` call at line ~300 to pass both new args:
```ts
const extractionConfig = await resolveExtractionConfig(
  opts.sourceId,
  opts.documentType,
  opts.interactionPattern,
  opts.subjectDiscipline,   // NEW
  opts.subjectName,          // NEW
);
```

Also update the `opts` object where it's assembled to include `subjectDiscipline` and `subjectName`.

**`app/api/course-pack/ingest/route.ts`**

At line ~468, already passes `interactionPattern`. Add `subjectDiscipline` from the playbook
config. The playbook is available at this point — load `pbConfig.subjectDiscipline`.

**Other callers** (structure-assertions.ts, extract-assertions.ts, analyze/route.ts, import/route.ts):
No change needed — they don't have subject context. Optional params default to undefined
(no discipline preamble applied). Zero breakage.

### Cleanup
Remove deprecated `TEACHING_MODE_KEYWORDS` constant from `resolve-config.ts` (it maps
"history"→"recall" etc. but is never called). Check with Grep first to confirm no callers.

### Tests to update
- `tests/lib/resolve-config-types.test.ts` — add test for `applySubjectPreamble` with history
- `tests/api/content-source-upload.test.ts` — mock still works (optional new params)
- `tests/api/content-source-import-classify.test.ts` — same

### Scaffold note
Extraction config is resolved at extraction-trigger time (runtime). `subjectDiscipline` is read
from `Playbook.config` at that point. No scaffold involvement. No schema changes.

### Guards
1. Dead-ends: PASS — preamble injected into systemPrompt used by extract-assertions.ts
8. Hardcoded: PASS — no slug literals; discipline from DB/user input
10. Pipeline integrity: PASS — EXTRACT stage only; no pipeline structural changes
11. Migration: PASS — no schema changes
13. Orphan cleanup: `TEACHING_MODE_KEYWORDS` removed after confirming 0 callers

---

## Dependency graph

```
Feature 2 (subject picker)
  → writes subjectDiscipline to Playbook.config
  → enables Feature 1 to produce "a History tutor" (not just "a Greenfield Academy tutor")
  → enables Feature 3 to receive explicit discipline (not just keyword inference)

Feature 1 (you_are fix)
  → 2-line change to quickstart.ts
  → reads loadedData.playbooks[0].config.subjectDiscipline (already in context)
  → independent of SectionDataLoader / domain-sources changes

Feature 3 (extraction prompt)
  → reads subjectDiscipline from Playbook.config at extract time
  → keyword fallback via inferSubjectDiscipline(undefined, subjectName) still works
    without Feature 2 (partial benefit)
```

## File summary

| Feature | File | Change size |
|---------|------|-------------|
| 2 | `components/wizards/teachwizard.tsx` | ~50 lines |
| 2 | `app/api/playbooks/route.ts` | verify only |
| 1 | `lib/prompt/composition/transforms/quickstart.ts` | 2 lines |
| 3 | `lib/content-trust/resolve-config.ts` | ~50 lines |
| 3 | `app/api/content-sources/[sourceId]/extract/route.ts` | ~5 lines |
| 3 | `app/api/course-pack/ingest/route.ts` | ~5 lines |
| 3 | `tests/lib/resolve-config-types.test.ts` | ~10 lines |

**No schema migration. All changes: `/vm-cp` after commit.**
