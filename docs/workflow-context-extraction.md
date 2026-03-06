# HumanFirst Studio — Core Workflow Context Extraction

> **Purpose:** Document the three key GUI workflows being replaced with conversational interfaces (interviews). Every input, default, validation rule, and system-created entity is listed.

---

## 1. Create Institution

### Entry Points

| Path | Entry Point | Description |
|------|-------------|-------------|
| **Institution Wizard** (primary) | `/x/institutions/new` | 6-step WizardShell wizard |
| **Get Started v1** | `/x/get-started` | Step 1 is institution selection/creation |
| **Get Started v2** (AI chat) | `/x/get-started-v2` | AI uses `create_institution` tool call |
| **CreateInstitutionModal** | Inline modal from various pages | Simple 2-field modal |
| **Community Creation** | `POST /api/communities` | Creates a COMMUNITY-kind domain |

### DB Models

**Institution:**

| Column | Type | Required | Default |
|--------|------|----------|---------|
| `id` | UUID | Auto | `uuid()` |
| `name` | String | **Yes** | — |
| `slug` | String (unique) | **Yes** | Derived from name |
| `logoUrl` | String? | No | null |
| `primaryColor` | String? | No | null |
| `secondaryColor` | String? | No | null |
| `welcomeMessage` | String? | No | null |
| `terminology` | Json? | No | null (falls back to type defaults) |
| `isActive` | Boolean | No | true |
| `typeId` | String? (FK → InstitutionType) | No | null |

**Domain** (created alongside Institution):

| Column | Type | Required | Default |
|--------|------|----------|---------|
| `id` | UUID | Auto | `uuid()` |
| `name` | String | **Yes** | Same as Institution name |
| `slug` | String (unique) | **Yes** | Derived from name |
| `kind` | DomainKind enum | No | `INSTITUTION` |
| `description` | String? | No | null |
| `isDefault` | Boolean | No | false |
| `isActive` | Boolean | No | true |
| `onboardingWelcome` | String? | No | null |
| `onboardingIdentitySpecId` | String? (FK) | No | null |
| `onboardingFlowPhases` | Json? | No | null |
| `onboardingDefaultTargets` | Json? | No | null |
| `lessonPlanDefaults` | Json? | No | null |
| `institutionId` | String? (FK) | No | Set to parent Institution |

**DomainKind enum:** `INSTITUTION` | `COMMUNITY`

### Institution Types (6 seeded)

| Slug | Name | Default Kind | Default Archetype | Terminology Preset |
|------|------|-------------|-------------------|-------------------|
| `school` | School | INSTITUTION | TUT-001 | Student, Teacher, Subject, Lesson |
| `corporate` | Corporate | INSTITUTION | COACH-001 | Employee, Trainer, Training Plan, Training Session |
| `community` | Community | COMMUNITY | COMPANION-001 | Member, Facilitator, Programme, Call |
| `coaching` | Coaching | INSTITUTION | COACH-001 | — |
| `healthcare` | Healthcare | INSTITUTION | COACH-001 | — |
| `training` | Training | INSTITUTION | COACH-001 | — |

Type determines: default AI archetype, DomainKind, terminology preset, setup spec slug.

### Primary Wizard Steps (`/x/institutions/new`)

#### Step 1: Identity (required)

| Field | Data Key | Type | Required | Default | Widget | Validation |
|-------|----------|------|----------|---------|--------|------------|
| Institution Type | `typeSlug` / `typeId` | Enum (6 values above) | Yes (explicit or inferred) | Auto-suggested from name keywords | `TypePicker` card grid | Must have either selection or auto-inference |
| Name | `institutionName` | String | **Yes** | — | `hf-input` text | `.trim().length > 0` |
| Slug | (auto-derived) | String | Auto | `toSlug(name)` | Read-only display | `/^[a-z0-9-]+$/` |
| Website URL | `websiteUrl` | String (URL) | No | "" | `hf-input` URL | On blur → `POST /api/institutions/url-import` (scrapes name, logo, colors) |

**Auto-suggestion logic:** `suggestTypeFromName()` matches keywords — e.g. `/school|primary|secondary/i` → `school`, `/gym|fitness|sport/i` → `coaching`.

#### Step 2: Branding (skippable)

| Field | Data Key | Type | Required | Default | Widget |
|-------|----------|------|----------|---------|--------|
| Logo URL | `logoUrl` | String (URL) | No | "" (may pre-fill from URL import) | URL input + avatar preview |
| Primary Colour | `primaryColor` | String (hex) | No | "" (may pre-fill) | Color picker + text |
| Secondary Colour | `secondaryColor` | String (hex) | No | "" (may pre-fill) | Color picker + text |

#### Step 3: Welcome Message (skippable)

| Field | Data Key | Type | Required | Default | Widget |
|-------|----------|------|----------|---------|--------|
| Welcome Message | `welcomeMessage` | String | No | "" | `hf-input` textarea (3 rows) |

AI-suggested welcome messages via `POST /api/institutions/suggest-welcome`.

#### Step 4: Terminology (skippable)

5 editable terminology keys, each with chip suggestions and "Other..." custom input:

| Key | UI Label | School Default | Corporate Default | Community Default |
|-----|----------|----------------|-------------------|-------------------|
| `domain` | Institution | School | Organization | Hub |
| `playbook` | Course | Subject | Training Plan | Programme |
| `caller` | Learner | Student | Employee | Member |
| `instructor` | Instructor | Teacher | Trainer | Facilitator |
| `session` | Session | Lesson | Training Session | Call |

#### Step 5: Defaults (skippable)

| Field | Data Key (nested in `lessonPlanDefaults`) | Type | Default | Options |
|-------|-------------------------------------------|------|---------|---------|
| Session Count | `sessionCount` | Number | null | `SessionCountPicker` |
| Session Duration | `durationMins` | Number | null | Chips: 15, 20, 30, 45, 60 min |
| Emphasis | `emphasis` | String | null | Chips: breadth / balanced / depth |
| Assessments | `assessments` | String | null | Chips: formal / light / none |
| Teaching Model | `lessonPlanModel` | LessonPlanModel | "direct_instruction" (visual default) | `LessonPlanModelPicker` |

All stored as single JSON blob in `Domain.lessonPlanDefaults`.

#### Step 6: Launch (commits)

No user input. Shows review summary → "Launch Institution" button → SSE stream to `POST /api/institutions/launch`.

### Server-Side Sequence

1. Resolve InstitutionType (typeSlug → typeId)
2. Merge terminology (type base + user overrides)
3. **CREATE Institution** (name, slug, logo, colors, welcome, typeId, terminology)
4. Sanitize lessonPlanDefaults (5 valid keys only)
5. **CREATE Domain** (name, slug, institutionId, lessonPlanDefaults)
6. **scaffoldDomain(domainId):**
   - Resolve archetype (institution type → `config.specs.defaultArchetype`)
   - CREATE AnalysisSpec (identity overlay, `specRole: IDENTITY`, `extendsAgent: <archetype>`)
   - CREATE Playbook, link identity spec as PlaybookItem
   - Enable all active SYSTEM specs on playbook
   - PUBLISH playbook
   - Configure domain onboarding (identitySpecId, flowPhases)
7. **Link user** → `User.activeInstitutionId`

### Validation Summary

| Rule | Where |
|------|-------|
| Name non-empty after `.trim()` | All paths |
| Slug format: `/^[a-z0-9-]+$/` | API |
| Slug unique (Institution) | DB constraint, 409 on conflict |
| Slug unique (Domain) | DB constraint, 409 on conflict |
| Type required | Wizard Step 1 (explicit or auto-inferred) |
| Auth: `requireAuth("OPERATOR")` | API (level 3+) |

---

## 2. Course Setup

### Entry Points

| Path | Entry Point | Paradigm |
|------|-------------|----------|
| **Get Started v1** | `/x/get-started` | Step wizard with `StepFlowContext` |
| **Get Started v2** (AI chat) | `/x/get-started-v2` | AI conversational with tool-rendered panels |
| **Course Builder v3** | `/x/courses/v3` | Single progressive screen with `WizardShell` |

### v1 → v2 → v3 Evolution

| Aspect | v1 | v2 | v3 |
|--------|----|----|-----|
| UI | 6 separate step components | AI chat + tool-rendered panels | Single screen, 3 zones |
| Orchestration | Manual step navigation | AI controls flow via system prompt | All AI tasks in parallel on "Build" |
| Entity resolution | Typeahead autocomplete | AI auto-resolves from DB | Domain dropdown |
| Content upload | Step 3: PackUploadStep | `show_upload` tool call | Inline in draft zone |
| Creation trigger | `POST /api/courses/setup` | `create_course` tool in chat | `POST /api/courses/setup` |

### Entity Hierarchy

```
Institution
 └── Domain (1:1 via institutionId)
      └── Playbook (= Course)
           ├── PlaybookItem[] (ordered specs + prompt templates)
           ├── PlaybookSubject[] ──> Subject ──> SubjectSource[] ──> ContentSource
           │                                                          └── ContentAssertion[]
           ├── CallerPlaybook[] (student enrollment)
           ├── CohortPlaybook[] (classroom enrollment)
           ├── BehaviorTarget[] (personality overrides)
           └── config: JSON (all course config)
```

### DB Model: Playbook (= Course)

| Column | Type | Required | Default |
|--------|------|----------|---------|
| `id` | UUID | Auto | — |
| `name` | String | **Yes** | — |
| `description` | String? | No | null |
| `domainId` | String (FK) | **Yes** | — |
| `groupId` | String? (FK → PlaybookGroup) | No | null |
| `sortOrder` | Int | No | 0 |
| `status` | PlaybookStatus | No | `DRAFT` |
| `version` | String | No | "1.0" |
| `config` | Json? | No | null |
| `validationPassed` | Boolean | No | false |
| `publishedAt` | DateTime? | No | null |

**PlaybookStatus enum:** `DRAFT` | `PUBLISHED` | `ARCHIVED`

### Playbook.config JSON Shape

```typescript
{
  interactionPattern?: string;   // "socratic" | "directive" | "advisory" | "coaching" | "companion" | "facilitation" | "reflective" | "open"
  teachingMode?: string;         // "recall" | "comprehension" | "practice" | "syllabus"
  subjectDiscipline?: string;    // "GCSE Biology", "English Language"
  welcomeMessage?: string;
  sessionCount?: number;         // 3, 5, 8, 12
  durationMins?: number;         // 15, 20, 30, 45, 60
  planEmphasis?: string;         // "breadth" | "balanced" | "depth"
  lessonPlanModel?: string;      // "direct" | "5e" | "spiral" | "mastery" | "project"
  systemSpecToggles?: Record<string, { isEnabled: boolean }>;
}
```

### Every User-Provided Field

#### Phase 1: Organisation

See Section 1 above — institution creation is reused.

#### Phase 2: Course Details

| Field | UI Label | DB Location | Type | Required | Default | Options |
|-------|----------|-------------|------|----------|---------|---------|
| `courseName` | "What will the AI tutor teach?" | `Playbook.name` | String | **Yes** | — | Min 3 chars |
| `subjectDiscipline` | "Subject area" | `Subject.name` + `Playbook.config.subjectDiscipline` | String | No | Falls back to `courseName` | Free text; creates/resolves Subject record |
| `interactionPattern` | "Teaching approach" | `Playbook.config.interactionPattern` | Enum | **Yes** (v2) | "directive" (v3) | socratic, directive, advisory, coaching, companion, facilitation, reflective, open |
| `teachingMode` | "Teaching emphasis" | `Playbook.config.teachingMode` | Enum | No | "recall" (v3) / "comprehension" (v1) | recall, comprehension, practice, syllabus |

**interactionPattern determines archetype mapping** — e.g. `socratic` → TUT-001, `coaching` → COACH-001.

#### Phase 3: Content Upload

Handled by `PackUploadStep`. Accepts PDF, Word, text files.

**Flow:**
1. User drops files
2. `POST /api/course-pack/analyze` → AI classifies each file (document type, role, confidence) → returns `PackManifest`
3. User reviews/edits manifest
4. `POST /api/course-pack/ingest` → SSE stream: creates `ContentSource` per file, extracts `ContentAssertion[]` (teaching points)
5. Returns `packSubjectIds` (Subject IDs linked to new ContentSources)

**Content hierarchy within a course:**

```
Playbook → PlaybookSubject[] → Subject → SubjectSource[] → ContentSource
                                                              └── ContentAssertion[]
                                                                   ├── assertion (text)
                                                                   ├── category: fact | definition | threshold | rule | process | example
                                                                   ├── depth (pyramid level)
                                                                   ├── parentId (tree hierarchy)
                                                                   ├── topicSlug
                                                                   └── teachMethod
```

Additionally: **Curriculum** (auto-generated) → **CurriculumModule** → **LearningObjective**

#### Phase 4: Welcome & Sessions

| Field | UI Label | DB Location | Type | Required | Default | Options |
|-------|----------|-------------|------|----------|---------|---------|
| `welcomeMessage` | "Welcome message" | `Domain.onboardingWelcome` + `Playbook.config` | String | No | Auto-drafted from outcomes | Free text |
| `sessionCount` | "How many sessions?" | `Playbook.config.sessionCount` | Number | No | 5 (v1) / 6 (v3) | 3, 5, 8, 12 |
| `durationMins` | "Session duration" | `Playbook.config.durationMins` | Number | No | 30 (v1) / 15 (v3) | 15, 20, 30, 45, 60 |
| `planEmphasis` | "Breadth vs depth" | `Playbook.config.planEmphasis` | Enum | No | "balanced" | breadth, balanced, depth |

#### Phase 5: Fine-Tune

| Field | UI Label | DB Location | Type | Required | Default |
|-------|----------|-------------|------|----------|---------|
| `behaviorTargets` | "Personality" | `BehaviorTarget` rows + `Domain.onboardingDefaultTargets` | Object | No | `{ warmth: 0.6, directiveness: 0.5, pace: 0.5, encouragement: 0.7 }` |
| `lessonPlanModel` | "Lesson plan model" | `Playbook.config.lessonPlanModel` | Enum | No | "direct" |

**Personality sliders (4 axes):**

| Key | Low End | High End |
|-----|---------|----------|
| `warmth` | Professional | Warm & friendly |
| `directiveness` | Guided discovery | Direct instruction |
| `pace` | Slower, thorough | Faster, efficient |
| `encouragement` | Measured | Highly encouraging |

**Lesson plan models:**

| Value | Label |
|-------|-------|
| `direct` | Direct Instruction |
| `5e` | 5E Model |
| `spiral` | Spiral |
| `mastery` | Mastery |
| `project` | Project-Based |

### What the System Auto-Creates

When a course is created (any path):

1. **Identity Spec** — `AnalysisSpec` with `specRole: IDENTITY`, `extendsAgent: <archetype>`
2. **Playbook** — DRAFT → PUBLISHED
3. **PlaybookItem** — identity spec → playbook link
4. **System Spec Toggles** — all active SYSTEM specs enabled
5. **Subject** — if not pre-existing, derived from course name
6. **SubjectDomain** + **PlaybookSubject** — scopes content retrieval
7. **Content pack links** — if `packSubjectIds` provided
8. **Onboarding config** — welcome, default targets, flow phases on Domain
9. **BehaviorTarget rows** — via `applyBehaviorTargets()`
10. **Test Caller** (v2 only) — random name, enrolled in playbook
11. **Cohort/Enrollment links** — if `cohortGroupIds` or `selectedCallerIds` provided
12. **Email Invites** — if `studentEmails` provided (30-day expiry)

### "CourseReady Overlay"

Not a separate DB model. Refers to the identity spec overlay auto-created during scaffolding — a domain-specific AnalysisSpec that `extendsAgent` a base archetype. A Playbook is "course-ready" when it has been scaffolded (identity spec + system specs + published).

---

## 3. AI Tutor Configuration

### Architecture: Identity Layers (Base + Overlay)

```
Base Archetype (system spec, e.g. TUT-001)
  └── Domain Overlay (per-institution identity spec)
       └── Group Tone Override (per-classroom, optional)
            └── Per-Caller Targets (runtime adaptation)
```

**Merge logic** (`mergeIdentitySpec`):
- Parameters merge by `param.id` — overlay replaces base parameters with matching IDs
- Config keys merge with overlay overriding base
- Constraints **stack** — base + overlay concatenated (base constraints never removed)

### Identity Spec Config Structure

```typescript
{
  parameters: [{
    id: "agent_role",
    name: "Domain Role Override",
    section: "identity",
    config: {
      roleStatement: string,    // "You are a friendly, supportive tutor..."
      primaryGoal: string,      // "Help people engage with Biology"
    }
  }],
  constraints: [...],           // Stacked from base + overlay
  roleStatement: string,
  primaryGoal: string,
  secondaryGoals: string[],
  techniques: Array<{ name, description, when }>,
  defaults: { warmth, formality, pace },
  styleGuidelines: string[],
  does: string[],
  doesNot: string[],
  opening: { approach, examples[] },
  main: { approach, strategies[] },
  closing: { approach, examples[] },
  sessionStructure: { opening, main, closing },
}
```

### Voice Prompt Composition (27 Sections)

Assembled by `CompositionExecutor` through **21 parallel data loaders** and **27 ordered sections**:

| Section | Transform | Priority | What it produces |
|---------|-----------|----------|-----------------|
| preamble | `computePreamble` | -1 | Critical rules, curriculum context |
| quick_start | `computeQuickStart` | 0 | `you_are`, `this_caller`, `this_session`, `key_memories`, `voice_style`, `first_line` |
| caller_info | — | 1 | Caller data |
| personality | `mapPersonalityTraits` | 2 | Big 5 traits |
| learner_profile | `mapLearnerProfile` | 3 | Contract-based profile |
| memories | `deduplicateAndGroupMemories` | 4 | Top memories |
| behavior_targets | `mergeAndGroupTargets` | 5 | Merged target values |
| call_history | `computeCallHistory` | 6 | Call count, recency |
| curriculum | `computeModuleProgress` | 7 | Module progress |
| session_planning | `filterSessionAttributes` | 8 | Session plan |
| learner_goals | `mapGoals` | 9 | Top 3 goals |
| domain_context | `computeDomainContext` | 10 | Domain info |
| identity | `extractIdentitySpec` | 11 | Merged identity |
| content | `extractContentSpec` | 12 | Content spec |
| content_trust | `computeTrustContext` | 12.5 | Trust levels |
| teaching_content | `renderTeachingContent` | 12.6 | Teaching points |
| course_instructions | `renderCourseInstructions` | 12.62 | Tutor instructions |
| visual_aids | `formatVisualAids` | 12.65 | Media references |
| pedagogy_mode | `computePedagogyMode` | 12.7 | Teaching mode |
| activity_toolkit | `computeActivityToolkit` | 12.8 | Activities |
| instructions_pedagogy | `computeSessionPedagogy` | 13 | Session flow |
| instructions_voice | `computeVoiceGuidance` | 14 | Voice behaviour |
| instructions | `computeInstructions` | 15 | Final instructions |

**Rendered voice prompt structure (sent to VAPI):**

```
[IDENTITY]         — you_are, primaryGoal, domain
[STYLE]            — voice_style, response length, fillers, confirmations, style guidelines
[THIS CALLER]      — name, cohort, session plan, call#, top 5 memories, goals, targets
[SESSION PLAN]     — session type, flow steps, curriculum progress
[COURSE RULES]     — from COURSE_REFERENCE documents
[VISUAL AIDS]      — available figures/diagrams
[PEDAGOGY MODE]    — teaching mode + instructions
[ACTIVITIES]       — recommended activities
[RETRIEVAL]        — knowledge base availability
[OPENING]          — first_line greeting
[RULES]            — critical rules + boundaries
```

### Conversation Flow / Onboarding

**Default 4-phase first-call flow** (stored on `Domain.onboardingFlowPhases`):

| Phase | Duration | Goals |
|-------|----------|-------|
| `welcome` | 2-3 min | Greet warmly, introduce self, set expectations |
| `discovery` | 3-5 min | Learn background, understand goals, assess knowledge |
| `first-topic` | 5-8 min | Introduce first concept, check understanding, adapt pace |
| `wrap-up` | 2-3 min | Summarise, preview next, end encouragingly |

**Resolution chain:** Playbook config → Domain config → INIT-001 spec → hardcoded fallback.

**Session types** (determined at runtime):

| Type | When | Flow |
|------|------|------|
| `FIRST_CALL` | First call for this caller | Onboarding phases |
| `INTRODUCE` | Lesson plan type | Preview → introduce → check → summarize |
| `DEEPEN` | Lesson plan type | Recall → explore edge cases → practice |
| `REVIEW` | Lesson plan type | Spaced retrieval → reinforce → application |
| `ASSESS` | Lesson plan type | Diagnostic → gauge mastery → feedback |
| `CONSOLIDATE` | Lesson plan type | Synthesize → big picture → reflect |
| `RETURNING_CALLER` | Default with curriculum | Review → bridge → new material → integrate |
| `OPEN_CONVERSATION` | No curriculum | Follow caller's lead |

### Behavior Targets (Personality)

**Two Boston Matrices:**

**Matrix 1: Communication Style**
- X: Warmth (`BEH-WARMTH`): Cool ↔ Warm
- Y: Formality (`BEH-FORMALITY`): Casual ↔ Formal
- Derived: `BEH-EMPATHY-EXPRESSION`, `BEH-RESPONSE-LEN`, `BEH-CONVERSATIONAL-TONE`
- Presets: Friendly Professor (0.8, 0.7), Socratic Mentor (0.7, 0.4), Drill Instructor (0.3, 0.8), Casual Peer (0.4, 0.2)

**Matrix 2: Teaching Approach**
- X: Directness (`BEH-DIRECTNESS`): Facilitative ↔ Directive
- Y: Challenge (`BEH-CHALLENGE-LEVEL`): Gentle ↔ Demanding
- Derived: `BEH-PRODUCTIVE-STRUGGLE`, `BEH-SCAFFOLDING`, `BEH-PROBING-QUESTIONS`
- Presets: Discovery Guide (0.2, 0.3), Stretch Mentor (0.2, 0.8), Clear Instructor (0.8, 0.3), Tough Love Coach (0.8, 0.8)

**Derivation formula:** `value = clamp01(x * wx + y * wy + bias)` (inverted: `1 - value`)

**Target merge priority:**
1. `CallerTarget` (per-caller, highest)
2. `BehaviorTarget` scope `PLAYBOOK`
3. `BehaviorTarget` scope `DOMAIN`
4. `BehaviorTarget` scope `SYSTEM`
5. `Domain.onboardingDefaultTargets` (first call only)

**In prompt:** Targets classified as HIGH (≥ 0.65) / MODERATE / LOW (≤ 0.35). Appear as `voice_style` ("HIGH warmth, MODERATE questions") and `critical_voice` (sentences per turn, max seconds, silence wait).

### Guardrails (GUARD-001)

| Group | Parameter | Default | Purpose |
|-------|-----------|---------|---------|
| targetClamp | `minValue` | 0.2 | Minimum allowed target value |
| targetClamp | `maxValue` | 0.8 | Maximum allowed target value |
| confidenceBounds | `minConfidence` | 0.3 | Floor for confidence scores |
| confidenceBounds | `maxConfidence` | 0.95 | Ceiling for confidence |
| confidenceBounds | `defaultConfidence` | 0.7 | Default when no data |
| aiSettings | `temperature` | 0.3 | AI temperature in pipeline |
| aiSettings | `maxRetries` | 2 | Retry limit |
| aggregation | `decayHalfLifeDays` | 30 | Personality score decay |
| aggregation | `confidenceGrowthPerCall` | 0.1 | Confidence growth rate |

**Critical rules** (from preamble, not GUARD-001):
- With curriculum: always review before new material; if review fails, re-teach foundation; if struggling, back up
- Without curriculum: do NOT invent academic topics; follow caller's lead

### Voice Settings

| Parameter | Type | Default | DB Key |
|-----------|------|---------|--------|
| `provider` | string | "openai" | `voice.provider` |
| `model` | string | config-based | `voice.model` |
| `knowledgePlanEnabled` | boolean | false | `voice.knowledge_plan_enabled` |
| `autoPipeline` | boolean | true | `voice.auto_pipeline` |
| `toolLookupTeachingPoint` | boolean | true | `voice.tool_lookup_teaching_point` |
| `toolCheckMastery` | boolean | true | `voice.tool_check_mastery` |
| `toolRecordObservation` | boolean | true | `voice.tool_record_observation` |
| `toolGetPracticeQuestion` | boolean | true | `voice.tool_get_practice_question` |
| `toolGetNextModule` | boolean | true | `voice.tool_get_next_module` |
| `toolLogActivityResult` | boolean | true | `voice.tool_log_activity_result` |
| `toolSendText` | boolean | true | `voice.tool_send_text` |
| `toolRequestArtifact` | boolean | true | `voice.tool_request_artifact` |
| `toolShareContent` | boolean | true | `voice.tool_share_content` |
| `unknownCallerPrompt` | string | Friendly default | `voice.unknown_caller_prompt` |
| `noActivePromptFallback` | string | Friendly default | `voice.no_active_prompt_fallback` |

**Voice guidance** (from VOICE-001 spec):

| Config | Default | Effect |
|--------|---------|--------|
| `response_length.target` | "2-3 sentences per turn" | Turn length |
| `response_length.max_seconds` | 15 | Max response duration |
| `pacing.pauses_after_questions` | "2-3 seconds" | Thinking time |
| `natural_speech.use_fillers` | ["So...", "Now...", "Right, so..."] | Natural markers |
| `natural_speech.use_backchannels` | ["Mm-hmm", "I see", "Right"] | Active listening |
| `turn_taking.avoid_monologues` | "If 10+ seconds without question, stop" | Anti-lecture |

**Personality-driven voice adaptation:**
- LOW extraversion → shorter turns, more pauses, don't fill silence
- HIGH neuroticism → extra warmth, slower pace, more reassurance
- HIGH openness → can explore tangents
- LOW agreeableness → skip pleasantries, get to the point

### AI Model Configuration

**Cascade** (highest priority first):
1. **DB AIConfig** — admin overrides via `/x/ai-config`
2. **SystemSettings** — `fallback:ai.default_models`
3. **Compiled defaults** — hardcoded in `call-points.ts` (61 call points)

Per call point: `provider`, `model`, `temperature`, `maxTokens`, `timeoutMs`

### Assessment / Measurement

**Pipeline stages** (run after each call):

| Stage | Call Point | What It Does |
|-------|-----------|--------------|
| MEASURE | `pipeline.measure` | Scores caller parameters (Big 5 personality, engagement) |
| LEARN | `pipeline.learn` | Extracts facts/memories about the caller |
| SCORE_AGENT | `pipeline.score_agent` | Evaluates agent behaviour against targets |
| ADAPT | `pipeline.adapt` | Computes personalised behaviour targets |
| EXTRACT_GOALS | `pipeline.extract_goals` | Extracts learner goals from transcript |
| ARTIFACTS | `pipeline.artifacts` | Extracts summaries, facts, exercises |
| ACTIONS | `pipeline.actions` | Extracts homework, follow-ups, tasks |

**Personality traits measured:** extraversion, neuroticism, openness, agreeableness, conscientiousness.

**Learner profile** is contract-driven (MEASURE → AGGREGATE → COMPOSE). Zero code changes to add new parameters.

---

## 4. Gaps

| # | Unknown | Source to Resolve |
|---|---------|-------------------|
| 1 | **Exact `SessionCountPicker` options** — numeric values offered in the session count widget | Read `SessionCountPicker` component source |
| 2 | **Full terminology map** — InstitutionType has 14 terminology keys but only 5 are editable in the wizard | Read `seed-institution-types.ts` for full 14-key `TermMap` typedef |
| 3 | **`LessonPlanModelPicker` visual layout** — whether it's cards, radio, or chips; and the display labels for each model | Read `LessonPlanModelPicker` component source |
| 4 | **Community-specific wizard fields** — exact fields for `communityKind`, `hubPattern`, `topics[]` in `POST /api/communities` | Read `app/api/communities/route.ts` + community wizard UI |
| 5 | **INIT-001 spec contents** — exact `firstCallFlow` configuration stored in DB vs generated | Read `INIT-001` spec JSON in `docs-archive/bdd-specs/` |
| 6 | **Full archetype configs** — exact parameters, constraints, and session structure for TUT-001 vs COACH-001 vs COMPANION-001 | Read archetype spec JSONs in `docs-archive/bdd-specs/` |
| 7 | **Wizard v2 `interactionPattern` → archetype mapping** — the exact mapping table (which pattern maps to which archetype) | Read `resolveArchetype` or pattern-to-archetype logic in `wizard-tools.ts` or `scaffold.ts` |
| 8 | **Group tone slider UI** — where and how the 5-axis tone sliders (formality, warmth, pace, encourage, precision) are exposed in the admin UI | Read `PlaybookGroup` edit page or classroom settings UI |
| 9 | **Content trust level assignment** — how trust levels (L0–L5) are assigned to uploads during course setup vs post-hoc | Read `content-trust/resolve-config.ts` classification logic |
| 10 | **Curriculum auto-generation** — exact trigger and API for generating `Curriculum` + `CurriculumModule` + `LearningObjective` from a course plan | Read `POST /api/courses/generate-plan/route.ts` implementation |
