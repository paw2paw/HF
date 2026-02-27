# Voice Recording Analysis — Implementation Plan

## Context

The HF platform is transcript-only today. VAPI sends a webhook with text after each call — no audio. This captures *what* the student said but not *how*: were they answering fluently or guessing? Engaged or going through the motions?

Voice analysis adds a second channel. The core insight is **retrieval fluency**: the same correct answer means something very different when given after 300ms of confident speech vs. after 4 seconds of "um... uh... I think it's..." — the second student hasn't consolidated the knowledge even though the transcript looks identical.

The key signals are **temporal**, not acoustic. Research by Goldman-Eisler (1972) and subsequent retrieval fluency literature establishes that pause duration and disfluency patterns are the most validated indicators of cognitive load and knowledge consolidation. These are computable from ASR word timestamps — no pitch analysis, no Python audio libraries, no raw audio processing needed.

> **Note on what voice analysis does NOT include:** Pitch analysis, intonation (up-speak), voice quality (breathiness/tension), and emotion labels like "anxious" or "sad" require raw F0 extraction via Python libraries (librosa, parselmouth/Praat). There is no mature Node.js equivalent. AssemblyAI provides word timestamps + speaker diarization + utterance sentiment — which is what this plan uses. Hume AI provides high-level emotion interpretations but costs ~$3.83/audio-hour (31× more) and adds marginal value over what timestamps already give us. This plan avoids over-promising.

---

## Settings: Provider Table + System + Per-Institution

Voice analysis providers are **data**, not code. No provider is hardcoded. The system resolves the active provider from a `VoiceAnalysisProvider` DB table at runtime — same pattern as `AIModel` / `AIConfig` for LLM providers.

### Provider Table (new Prisma model)

```prisma
model VoiceAnalysisProvider {
  id           String   @id @default(uuid())
  slug         String   @unique  // "assemblyai" | "google-speech" | "mock"
  label        String            // "AssemblyAI" | "Google Cloud Speech-to-Text"
  description  String?  @db.Text

  // API key lives in env var — NOT stored in DB (same as AI providers)
  apiKeyEnvVar String?           // "ASSEMBLYAI_API_KEY" — reference only, for UI key-status check

  // What this provider supports
  capabilities Json              // { wordTimestamps: bool, diarization: bool, sentiment: bool, disfluency: bool }

  // Cost estimate metadata (displayed in UI)
  costPerMinuteUsd Float?        // ~0.04 for AssemblyAI, ~0.016 for Google

  isActive   Boolean @default(true)
  isDefault  Boolean @default(false)  // Which provider the system uses
  sortOrder  Int     @default(0)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([isActive])
}
```

Seeded providers (on first `db:seed`):

| slug | label | apiKeyEnvVar | isDefault |
|------|-------|-------------|-----------|
| `assemblyai` | AssemblyAI | `ASSEMBLYAI_API_KEY` | true |
| `google-speech` | Google Cloud Speech | `GOOGLE_SPEECH_API_KEY` | false |
| `mock` | Mock (Testing) | — | false |

Admins can enable a non-default provider by: (1) setting its env var in Cloud Run, (2) flipping `isDefault` in the provider list UI. The factory maps slug → implementation — adding a new provider never requires code changes to the pipeline.

### Provider Factory (`lib/voice/providers/`)

```
lib/voice/providers/
├── interface.ts      — VoiceAnalysisProviderAdapter interface
├── registry.ts       — slug → implementation lookup, resolves active provider
├── assemblyai.ts     — AssemblyAI implementation
├── google-speech.ts  — Google Cloud Speech (stub — implement when needed)
└── mock.ts           — deterministic fake for dev/test
```

`resolveActiveVoiceProvider()` in `registry.ts`:
1. Load `VoiceAnalysisProvider` where `isDefault = true` from DB (30s cache)
2. Check env var for that provider's `apiKeyEnvVar` — if missing, fall back to `mock`
3. Return implementation instance

### Settings Levels

| Setting | Level | Default | Notes |
|---------|-------|---------|-------|
| Provider registry | DB (`VoiceAnalysisProvider` table) | AssemblyAI seeded as default | Swappable without code changes |
| API keys | Env vars (Cloud Run secrets) | — | Never stored in DB, same as LLM keys |
| `voice_analysis.enabled` | SystemSettings (kill-switch) | `false` | Global off |
| `voice_analysis.min_call_duration_seconds` | SystemSettings | `30` | System default |
| `Domain.voiceAnalysisEnabled` | **Per-institution** | **`false`** | **Privacy/consent — GDPR** |

**Consent logic**: voice analysis runs only if system `voice_analysis.enabled = true` AND `Domain.voiceAnalysisEnabled = true` AND active provider has its API key configured.

**Backfill**: all seeded institutions get `voiceAnalysisEnabled = true` in seed scripts.

**Institution creation wizard**: voice toggle surfaced prominently — shown OFF by default, with `<FieldHint>` explaining privacy/consent implications.

---

## Who Uses This and How

| Role | What they need | Where they see it |
|------|---------------|-------------------|
| **ADMIN** | Configure provider, API key, cost control | `/x/settings` Voice Analysis card |
| **ADMIN** | Per-institution consent toggle | Institution creation wizard + Domain settings |
| **EDUCATOR (OPERATOR)** | Per-student retrieval fluency trends, false mastery flags, confusion by topic | Caller detail → **Assess tab** → Voice Intelligence card |
| **EDUCATOR** | Cohort-level: who needs support? Which topics are hardest to recall? | `/x/cohorts` → Voice Intelligence panel |
| **AI Tutor (VAPI)** | Temporal voice signals from last call injected into prompt | Composed voice prompt `[VOICE SIGNALS]` section |
| **Student (future portal)** | "Your response time on Photosynthesis has dropped from 4.1s to 0.9s — fluent recall!" | `/my` learner portal (TODO #15) |

---

## The 3 Lifecycle Phases

### Setup (ADMIN)
- Enter `ASSEMBLYAI_API_KEY` env var in Cloud Run secrets
- Enable `voice_analysis.enabled` in `/x/settings` (off by default — safe to deploy first)
- Set provider (`assemblyai` or `mock` for dev), min call duration threshold
- "Test Connection" button verifies API key and shows cost estimate
- First-run: no impact on existing calls. Only new calls after enabling get analysis.

### Maintenance (ADMIN/EDUCATOR)
- Per-call: voice analysis status pill (COMPLETE / PENDING / FAILED / NO_RECORDING)
- ADMIN: "Re-analyze audio" button on call detail for failed/stale analysis
- Metering: `voice-analysis` appears as a cost source in `/x/metering`
- Settings card shows coverage % (calls with recordings vs total) and estimated monthly cost
- False mastery alerts visible from cohort view — students needing follow-up

### Runtime Usage

**AI Tutor (per-call context):**
Next call prompt receives:
```
[VOICE SIGNALS — from last session]
Retrieval fluency: Slow (avg 3.8s latency, target <1.5s).
Confusion indicators: Elevated pause density (28/min) + disfluency rate (12/min).
FALSE MASTERY RISK (71%) — probed Mitosis, answered correctly but heavily disfluent.
Suggestion: revisit Mitosis before advancing. Check understanding with variation questions.
```

**Educator (between sessions):**
Opens student profile. Sees response latency on "DNA Structure" has been consistently high over 4 calls despite correct answers. Flags for revision before next test.

**Educator (cohort):**
Sees "Cell Division" generating highest disfluency rates across 9 students — flags curriculum module for redesign.

---

## Audio Access: How We Get It

VAPI webhooks don't include audio. After the webhook creates the Call record, a fire-and-forget fetch retrieves recording metadata from the VAPI REST API:

```
POST /api/vapi/webhook (end-of-call-report)
  → Create Call record (transcript only, as today)
  → fetchAndPersistRecordingMetadata(callId, vapiCallId)  ← NEW, fire-and-forget
      GET https://api.vapi.ai/call/{vapiCallId}
      → extract recordingUrl, stereoRecordingUrl, durationSeconds
      → prisma.call.update({ recordingUrl, durationSeconds, recordingFetchedAt })
  → autoPipeline trigger (as today)
```

**Privacy**: We store the URL (expiring signed pointer), never the audio binary. URLs not served to frontend unless ADMIN+ explicitly requests playback.

**Stereo recordings**: VAPI likely records AI and student on separate channels. If stereo is available, AssemblyAI's speaker diarization from the mixed track also works well. Stereo is preferred but not required.

---

## Provider: AssemblyAI

**What AssemblyAI gives us (all we need):**
- **Word-level timestamps** — exact when each word was spoken → compute response latency, pause durations, speech rate, disfluency timing
- **Speaker diarization** — who said what and when → separate student from AI tutor
- **Utterance sentiment** — positive/neutral/negative per sentence, with confidence → sentiment arc
- **Disfluency detection** — um/uh/repeats flagged in transcript with timestamps

**Cost**: ~$0.12/audio-hour base + $0.02/hr sentiment + ~$0.01/min diarization
→ ~$0.03-0.05/minute. At 1,000 calls/month, avg 5 min: **~$150-250/month**

**Why not Hume AI**: $0.0639/min = $3.83/hour. 31× more expensive. Provides high-level emotion interpretations (not raw pitch), without the temporal precision timestamps give us. Not worth it — our best signals come from latency computation, which Hume doesn't improve.

**Why not raw Whisper + pitch analysis**: OpenAI Whisper gives word timestamps but no sentiment, no diarization. Pitch analysis (the "interesting" prosodic features) requires Python librosa/parselmouth — no Node.js equivalent, significant infrastructure overhead, and the research shows temporal signals outperform pitch for learning-specific inference anyway.

**`mock` provider** returns deterministic fake scores for dev/test — no API key needed.

---

## The Signal Taxonomy: What We Actually Measure

### Primary Temporal Signals (Goldman-Eisler backed — most validated)

**Response latency** (ms from end of AI question to start of student answer)
- Computed from: diarization timestamps (AI turn end) + word timestamps (student first word)
- Validated: Short latency (< 1.5s) = fluent recall (well-consolidated knowledge). Long latency (> 3s) = effortful retrieval or guessing.
- Key insight: *correct answer + long latency = retrieval effort, not mastery*

**Pause density** (count of pauses >250ms per minute of student speech)
- Computed from: gaps between consecutive word timestamps within a student turn
- Validated: Goldman-Eisler (1972) — pauses >250ms reflect cognitive processes (word-finding, semantic planning), not just articulation.
- High density → cognitive load, difficulty with content being discussed

**Disfluency rate** (um/uh count per minute, normalized)
- Computed from: disfluency-flagged tokens in AssemblyAI transcript + timing
- Validated: Fillers indicate content is still being *planned* (retrieval difficulty), not yet retrieved. Distinct from confidence — even knowledgeable speakers are disfluent under uncertainty.

### Engagement Temporal Signals (well-supported)

**Speech rate** (student WPM, student channel only from diarization)
- Computed from: word count / speaking duration from timestamps
- Decreases with cognitive load and confusion; increases with excitement/engagement

**Talk ratio** (student speaking time / total call duration)
- Computed from: diarization
- Low ratio = passive learner, not engaging with the AI; high = active engagement
- Trend matters: declining talk ratio across a session → disengagement signal

**Sentiment valence** (session average, from AssemblyAI per-utterance sentiment)
- Range: -1 (negative) to +1 (positive)
- Less validated for learning than temporal signals, but useful for wellbeing/motivation monitoring

**Sentiment arc** (linear trend of sentiment through the session)
- Positive arc = student ended more positively than they started (good session)
- Negative arc = session deteriorated emotionally
- Sudden negative spike on a topic → possible difficulty or frustration

### Composite Derived Scores (0-1 scale, for ADAPT and UI)

These are computed from combinations of the primary signals above. Each is explicit about its derivation.

| Score | Derivation | Behavioral meaning |
|-------|-----------|-------------------|
| `VOICE-CONFIDENCE` | Inverted(avg latency) + inverted(disfluency) + sentiment consistency | How fluently and steadily the student spoke |
| `VOICE-CONFUSION` | pause density + disfluency rate + negative sentiment spikes on specific turns | Content difficulty / retrieval problems |
| `VOICE-ENGAGEMENT` | talk ratio + speech rate trend + sentiment arc | Active participation vs. passive compliance |
| `VOICE-DISCOMFORT` | negative sentiment trend + disfluency elevation + declining talk ratio | Session is going poorly / student struggling emotionally |
| `VOICE-FALSE_MASTERY_RISK` | **See below — the highest-value signal** | |

### False Mastery Risk — The Primary Educator Signal

The core insight: transcript-level correctness (LEARN-ASSESS score) combined with temporal voice evidence of difficulty.

```
Per-topic, per-turn:
  correctness     = LEARN-ASSESS CallScore for that topic (0-1)
  retrievalEffort = normalize(responseLatency) × normalize(disfluencyOnThatTurn)

falseMasteryRisk = correctness × retrievalEffort

High risk (> 0.6): student gave correct answer but voice signals the retrieval was laboured
→ They likely know the words but haven't consolidated the concept
→ Will likely fail on variation questions, or forget by next session
```

This is Goldman-Eisler validated: disfluency + long latency specifically flags retrieval difficulty, not just general nervousness. The combination with correct-answer scoring distinguishes false mastery from genuine confusion.

---

## Data Model

### Schema Migration (`/vm-cpp` required)

**New field on `Domain` model:**
```prisma
voiceAnalysisEnabled Boolean @default(false)
// Seed backfill: all seeded domains set to true
// New institutions: OFF by default — explicit opt-in in creation wizard
```

**New fields on `Call` model:**
```prisma
recordingUrl         String?
stereoRecordingUrl   String?
durationSeconds      Float?
recordingFetchedAt   DateTime?
voiceAnalysis        VoiceAnalysis?
```

**New `VoiceAnalysis` model:**
```prisma
model VoiceAnalysis {
  id       String              @id @default(uuid())
  callId   String              @unique
  call     Call                @relation(fields: [callId], references: [id], onDelete: Cascade)
  callerId String?
  status   VoiceAnalysisStatus @default(PENDING)
  provider String              // "assemblyai" | "mock"
  errorMessage String?

  // --- PRIMARY TEMPORAL SIGNALS (raw measurements) ---
  // Response latency: time from end of AI question to student first word
  responseLatencyAvgMs    Float?  // average across all question-answer turns
  responseLatencyMedianMs Float?  // median (more robust to outliers)
  responseLatencyTrendMs  Float?  // positive = slowing down (content getting harder)

  // Pause density: cognitive load indicator
  pauseDensityPerMin   Float?  // pauses >250ms per minute of student speech
  avgPauseDurationMs   Float?  // average pause length
  pauseCount           Int?    // total pauses >250ms

  // Disfluency: retrieval difficulty indicator
  disfluencyRatePerMin Float?  // um/uh count per minute of student speech
  disfluencyCount      Int?    // total raw count

  // Speech rate & participation
  speechRateWpm Float?  // student WPM (from timestamps, student channel)
  talkRatio     Float?  // student speaking fraction of total call (0-1)
  silenceRatio  Float?  // fraction of call in silence (neither speaker)

  // --- SENTIMENT SIGNALS (AssemblyAI per-utterance) ---
  sentimentValence     Float?  // -1..+1 session average
  sentimentArc         Float?  // positive = improved through session
  sentimentConsistency Float?  // 0-1 (1 = stable, 0 = highly variable)

  // --- COMPOSITE DERIVED SCORES (0-1 scale, feeds Parameter system) ---
  confidenceScore    Float?  // inverted latency + inverted disfluency + sentiment consistency
  confusionScore     Float?  // pause density + disfluency rate + negative sentiment spikes
  engagementScore    Float?  // talk ratio + speech rate trend + sentiment arc
  discomfortScore    Float?  // negative sentiment trend + disfluency elevation + declining talk ratio
  falseMasteryRisk   Float?  // correct answers (LEARN-ASSESS) × retrieval effort (latency × disfluency)

  // Per-turn detail for UI and fine-grained analysis
  perTurnMetrics Json?  // array of { turnId, speakerLabel, latencyMs, disfluencies, sentimentScore }

  // Raw provider output stored for reprocessing
  rawFeatures Json?  // full AssemblyAI response

  processedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([callerId])
  @@index([status])
  @@index([createdAt])
}

enum VoiceAnalysisStatus {
  PENDING
  PROCESSING
  COMPLETE
  FAILED
  NO_RECORDING
}
```

---

## Data Flow: Audio → Adaptive Loop

```
Phase 0: Audio Access
─────────────────────
VAPI Webhook → Create Call → fetchAndPersistRecordingMetadata() [fire-and-forget]
                                   ↓
                          call.recordingUrl, call.durationSeconds populated

Phase 1: Voice Extraction (new EXTRACT sub-stage, parallel with existing)
──────────────────────────────────────────────────────────────────────────
Pipeline EXTRACT: if (call.recordingUrl && voiceAnalysis.enabled)
  → extractVoiceFeatures(callId, recordingUrl)
  → AssemblyAI: submit audio, enable sentiment + diarization + disfluency
  → Poll to completion (bounded — timeout at 5 min)
  → computeTemporalSignals() from word timestamps + diarization
      - Per-turn response latency (AI end → student start)
      - Pause density within student turns
      - Disfluency rate from disfluency-flagged tokens
      - Speech rate (WPM), talk ratio, silence ratio
  → computeSentimentSignals() from utterance sentiments
  → computeCompositeScores() → confidence, confusion, engagement, discomfort
  → computeFalseMasteryRisk() — cross-ref with LEARN-ASSESS CallScore
  → Store VoiceAnalysis (status: COMPLETE)
  → Create CallScore for each VOICE-* parameter

Phase 2: MEASURE → AGGREGATE
─────────────────────────────
CallScore(VOICE-CONFIDENCE, 0.52) + CallScore(VOICE-CONFUSION, 0.68) + ...
  → AGGREGATE: folds into CallerPersonalityProfile.parameterValues
    { "VOICE-CONFIDENCE": 0.52, "VOICE-CONFUSION": 0.68, ... }
  → Short half-life (10 calls) — voice signals are session state, not stable trait
  → CallerPersonalityProfile.parameterValues updated

Phase 3: ADAPT Rules Fire
──────────────────────────
ADAPT-VOICE-001 spec conditions on CallerPersonalityProfile.parameterValues:
  VOICE-CONFUSION > 0.65 → challenge_level ↓, scaffolding_detail ↑, check_in_frequency ↑
  VOICE-FALSE_MASTERY_RISK > 0.60 → verification_depth ↑, challenge_level ↑
  VOICE-DISCOMFORT > 0.65 → empathy_rate ↑, session_start = reassurance_framing
  VOICE-ENGAGEMENT < 0.35 → activity_variety ↑, pacing = vary

Phase 4: Prompt Injection
──────────────────────────
voiceContext SectionDataLoader → loads latest VoiceAnalysis for caller
renderVoicePrompt() → [VOICE SIGNALS] section:
  "Retrieval fluency: Slow (avg 3.8s). Confusion: High (0.68).
   FALSE MASTERY RISK (71%) — revisit Mitosis before advancing."

CALL N+1: AI Tutor calibrated for this student's temporal voice patterns
```

---

## VOICE-001 Spec — 7 Composite Parameters

Seeded as `docs-archive/bdd-specs/VOICE-001-voice-measurement.spec.json`.

| parameterId | Name | Derived From |
|-------------|------|-------------|
| `VOICE-CONFIDENCE` | Voice Confidence | Inverted response latency + inverted disfluency rate + sentiment consistency |
| `VOICE-CONFUSION` | Voice Confusion | Pause density + disfluency rate + negative sentiment on specific turns |
| `VOICE-ENGAGEMENT` | Voice Engagement | Talk ratio + speech rate trend + sentiment arc |
| `VOICE-DISCOMFORT` | Voice Discomfort | Negative sentiment trend + disfluency elevation + declining talk ratio |
| `VOICE-RESPONSE_LATENCY` | Response Latency | Normalized avg latency (0=very slow, 1=fluent/fast) |
| `VOICE-DISFLUENCY_RATE` | Disfluency Rate | Normalized um/uh rate (0=heavy, 1=fluent) |
| `VOICE-FALSE_MASTERY_RISK` | False Mastery Risk | Correctness (LEARN-ASSESS) × retrieval effort (latency × disfluency per turn) |

These are `parameterType: STATE` — short decay (10 calls), not stable traits. Spec `promptTemplate` = `"VOICE_DERIVED"` — scores are written directly by `extractVoiceFeatures()`, not via LLM batching. Seeder skips LLM call for this spec type.

Config registry entry in `lib/config.ts`:
```typescript
get voiceAnalysis(): string {
  return optional("VOICE_ANALYSIS_SPEC_SLUG", "VOICE-001");
}
```

---

## ADAPT-VOICE-001 Spec

Seeded as `docs-archive/bdd-specs/ADAPT-VOICE-001-voice-adaptation.spec.json`.

```
VOICE-CONFUSION > 0.65 →
  challenge_level: -0.15
  scaffolding_detail: +0.20
  check_in_frequency: +0.15
  rationale: "High pause density + disfluency rate — content is too hard or retrieval is laboured"

VOICE-FALSE_MASTERY_RISK > 0.60 →
  verification_depth: +0.30
  challenge_level: +0.10
  rationale: "Correct answers but slow/disfluent retrieval — guessing, not fluent knowledge"

VOICE-DISCOMFORT > 0.65 →
  empathy_rate: +0.20
  session_start: "reassurance_framing"
  rationale: "Negative sentiment trend + elevated disfluency — student struggling emotionally"

VOICE-ENGAGEMENT < 0.35 →
  activity_variety: increase
  pacing: vary
  rationale: "Low talk ratio + declining speech rate — student passive or disengaging"

VOICE-RESPONSE_LATENCY < 0.3 (normalized — i.e., very fast retrieval) →
  challenge_level: +0.10
  rationale: "Fluent fast recall — ready for harder content"
```

No code changes to `adapt-runner.ts` — `runRuleBasedAdapt()` handles these automatically.

---

## Voice Prompt Injection (`[VOICE SIGNALS]` section)

In `lib/prompt/composition/renderPromptSummary.ts`, new section after `[THIS CALLER]`:

```
[VOICE SIGNALS — last session temporal analysis]
Retrieval fluency: {SLOW|MODERATE|FLUENT} (avg {N}s response latency)
{if confusion > 0.65} Confusion elevated ({score}) — high pause density + disfluency
{if falseMasteryRisk > 0.6} ⚠ FALSE MASTERY RISK ({score}%) — answered correctly but retrieval was laboured on: {topics}. Probe before advancing.
{if discomfort > 0.65} Student showing discomfort signals — lead with reassurance
{if engagement < 0.35} Low engagement last session (talk ratio {N}%) — actively prompt participation
```

Rendered example:
```
[VOICE SIGNALS — last session]
Retrieval fluency: SLOW (avg 3.8s). Confusion elevated (0.71).
⚠ FALSE MASTERY RISK (68%) — Mitosis, Cell Division: correct answers but retrieval was laboured. Probe before advancing.
```

Omitted entirely if `voiceContext` loader returns null (no analysis yet or feature disabled).

---

## UI Surfaces

### Caller Detail — Assess Tab (Voice Intelligence as a section within)

Voice Intelligence lives inside the existing **Assess tab**, not as a new tab (preserving the 5-tab structure from the tab consolidation):

```
Assess tab:
├─ Learning Outcomes  (existing)
├─ Voice Intelligence ← NEW — trend card across all calls
├─ Personality        (existing — B5, VARK)
└─ Behaviour Targets  (existing)
```

Voice Intelligence section:

```
┌─────────────────────────────────────────────────────────────┐
│  Voice Intelligence                  [i]  [last 6 calls ▾] │
├──────────────────┬──────────────────┬───────────────────────┤
│ Response Latency │ Disfluency Rate  │ Engagement            │
│ avg 3.8s → 1.2s  │ 18/min → 6/min  │ ████████░░  78%       │
│ ↓ improving ✓    │ ↓ improving ✓   │ ↑ +14%                │
├──────────────────┴──────────────────┴───────────────────────┤
│ ⚠  False Mastery Risk: 68%  (last call)                     │
│ Student answered Mitosis questions correctly but response    │
│ latency was 4.1s with 11 disfluencies — retrieval laboured. │
│ Suggest: open next session revisiting Mitosis with a        │
│ variation question.                                         │
└─────────────────────────────────────────────────────────────┘
```

If `Domain.voiceAnalysisEnabled = false`, section shows a muted banner: "Voice analysis is not enabled for this institution."

Component: `components/callers/caller-detail/VoiceIntelligenceSection.tsx`
Data: `GET /api/callers/[callerId]/voice-summary` — `requireAuth("OPERATOR")`

### Call Detail — Voice Tab (4th tab in call accordion)

```
┌─────────────────────────────────────────────────────────────┐
│  Transcript │ Extraction │ Behaviour │ [Voice]              │
├─────────────────────────────────────────────────────────────┤
│  ● COMPLETE  (AssemblyAI)                        4m 32s     │
│  Provider resolved from: VoiceAnalysisProvider.isDefault   │
├────────────────────────────┬────────────────────────────────┤
│  Student Speech             │  Temporal Signals             │
│  Talk ratio:  61%           │  Avg response latency: 3.8s   │
│  Speech rate: 127 wpm       │  Pause density: 28/min        │
│  Sentiment:   +0.42 (pos)   │  Disfluency rate: 14/min      │
│  Sentiment arc: ↑ improving │                               │
├────────────────────────────┴────────────────────────────────┤
│  Per-topic breakdown:                                        │
│  Photosynthesis  latency 0.9s  disfluency 3/min  ✓ fluent   │
│  Mitosis         latency 4.1s  disfluency 11/min ⚠ laboured │
│  Cell Division   latency 2.3s  disfluency 7/min  ~ moderate │
├─────────────────────────────────────────────────────────────┤
│  ⚠ False Mastery Risk: 68%  (Mitosis — answered correctly   │
│    but retrieval was laboured)               [Re-analyze ↺] │
└─────────────────────────────────────────────────────────────┘
```

Status states:
- `PENDING/PROCESSING` → `◌ Audio analysis in progress...`
- `NO_RECORDING` → `— No recording available for this call`
- `FAILED` → `✗ Analysis failed: {errorMessage}  [Retry ↺]`

### Cohort Page — Voice Intelligence Panel (OPERATOR+)

```
┌─────────────────────────────────────────────────────────────┐
│  Class Voice Pulse                                   [i]    │
│  Year 9 Science — 12 students · last 7 days                 │
├──────────────────────┬──────────────────────────────────────┤
│  Avg response latency│  Students with high false mastery:   │
│  2.1s  ↓ improving   │  ● Emma T.   Mitosis         72%    │
│                      │  ● James K.  Cell Division   65%    │
│  Avg disfluency rate │                    [View Profiles →] │
│  8/min  ↓ improving  │                                      │
├──────────────────────┴──────────────────────────────────────┤
│  Topics with highest avg latency + disfluency:              │
│  1. Mitosis             3.9s latency  21/min disfluency     │
│  2. DNA Replication     3.1s latency  16/min disfluency     │
│  3. Cell Division       2.7s latency  12/min disfluency     │
│              (these topics are hardest to recall — consider │
│               adding spaced repetition in next sessions)    │
└─────────────────────────────────────────────────────────────┘
```

"Topics with highest avg latency" = aggregate `perTurnMetrics` across all calls, grouped by `curriculumModuleId`. This surfaces curriculum insights no transcript analysis can reveal.

### Settings Page — Voice Analysis

Two sections, following the AI Config pattern:

**Section 1 — Global settings** (SystemSettings):
```
┌─────────────────────────────────────────────────────────────┐
│  Voice Analysis                                             │
├─────────────────────────────────────────────────────────────┤
│  Enabled                   ○ Off  ● On                      │
│  Skip calls shorter than   [30] seconds                     │
│                                                             │
│  Coverage: 847 / 1,203 calls have recordings  (70%)        │
│  Analysis: 831 complete · 12 failed · 4 pending            │
│  [Save]                                                     │
└─────────────────────────────────────────────────────────────┘
```

**Section 2 — Provider list** (VoiceAnalysisProvider table, like AI Config provider rows):
```
┌─────────────────────────────────────────────────────────────┐
│  Voice Analysis Providers                                   │
├──────────────────────┬────────┬──────────┬──────────────────┤
│  Provider            │ Key    │ Cost/min │ Status           │
├──────────────────────┼────────┼──────────┼──────────────────┤
│  ● AssemblyAI        │ ✓ Set  │ $0.04    │ [Default] [Test] │
│  ○ Google Speech     │ ✗ None │ $0.016   │ [Set as default] │
│  ○ Mock (Testing)    │ n/a    │ free     │ [Set as default] │
└──────────────────────┴────────┴──────────┴──────────────────┘
│  ℹ API keys are set as environment variables (Cloud Run     │
│    secrets) — not stored in the database.                   │
│    Set ASSEMBLYAI_API_KEY to enable AssemblyAI.             │
└─────────────────────────────────────────────────────────────┘
```

Key status ("✓ Set" / "✗ None") checks `process.env[provider.apiKeyEnvVar]` server-side — same as `keyStatus` in `/api/ai-config`. "Test" button calls `POST /api/voice-analysis/test` with the provider slug. "Set as default" flips `isDefault` in the DB.

All `hf-*` CSS classes. Route: `GET/POST /api/voice-analysis/providers` — `requireAuth("ADMIN")`.

---

## New Files

| File | Purpose |
|------|---------|
| `lib/vapi/recording-metadata.ts` | Fetch recording URL from VAPI API after call ends |
| `lib/voice/analyze.ts` | Orchestrates: resolve provider → submit → poll → compute signals |
| `lib/voice/temporal-signals.ts` | Compute latency, pause density, disfluency from word timestamps |
| `lib/voice/sentiment-signals.ts` | Compute valence, arc, consistency from utterance sentiments |
| `lib/voice/composite-scores.ts` | Derive confidence, confusion, engagement, discomfort |
| `lib/voice/false-mastery.ts` | Cross-ref voice retrieval effort with LEARN-ASSESS scores |
| `lib/voice/providers/interface.ts` | `VoiceAnalysisProviderAdapter` interface |
| `lib/voice/providers/registry.ts` | `resolveActiveVoiceProvider()` — DB lookup + 30s cache |
| `lib/voice/providers/assemblyai.ts` | AssemblyAI implementation |
| `lib/voice/providers/google-speech.ts` | Google Cloud Speech stub (future) |
| `lib/voice/providers/mock.ts` | Deterministic mock for dev/test |
| `docs-archive/bdd-specs/VOICE-001-voice-measurement.spec.json` | MEASURE spec |
| `docs-archive/bdd-specs/ADAPT-VOICE-001-voice-adaptation.spec.json` | ADAPT spec |
| `components/callers/caller-detail/VoiceIntelligenceSection.tsx` | UI card |
| `app/api/callers/[callerId]/voice-summary/route.ts` | `requireAuth("OPERATOR")` |
| `app/api/cohorts/[cohortId]/voice-summary/route.ts` | `requireAuth("OPERATOR")` |
| `app/api/calls/[callId]/voice-analysis/route.ts` | `requireAuth("OPERATOR")` |
| `app/api/calls/[callId]/voice-analysis/trigger/route.ts` | `requireAuth("ADMIN")` |
| `app/api/voice-analysis/providers/route.ts` | GET list + POST set-default — `requireAuth("ADMIN")` |
| `app/api/voice-analysis/test/route.ts` | Test provider connection — `requireAuth("ADMIN")` |

## Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | VoiceAnalysisProvider + VoiceAnalysis models, enum, 4 Call fields, Domain.voiceAnalysisEnabled |
| `app/api/vapi/webhook/route.ts` | Fire-and-forget recording metadata fetch |
| `app/api/calls/[callId]/pipeline/route.ts` | extractVoiceFeatures() in EXTRACT stage |
| `lib/prompt/composition/sectiondataloader.ts` | voiceContext loader |
| `lib/prompt/composition/renderPromptSummary.ts` | [VOICE SIGNALS] section |
| `lib/system-settings.ts` | VoiceAnalysisSettings group (enabled + minCallDuration only) |
| `lib/config.ts` | config.specs.voiceAnalysis |
| `components/callers/CallerDetailPage.tsx` | VoiceIntelligenceSection in Assess tab |
| `components/callers/caller-detail/callstab.tsx` | Voice tab in call detail accordion |
| `app/x/cohorts/page.tsx` | Voice pulse panel |
| `app/x/settings/settingsclient.tsx` | Voice Analysis settings + provider list |
| Institution creation wizard | Voice toggle — prominent, OFF by default, `<FieldHint>` |
| Domain seed script | Backfill: `voiceAnalysisEnabled: true` for all seeded domains |
| Domain settings page | Add voice toggle |

## New Dependency

```bash
npm install assemblyai   # Official AssemblyAI TypeScript SDK
# google-speech: npm install @google-cloud/speech  (when needed — stub now)
```

---

## Phasing

| Phase | What | Deploy |
|-------|------|--------|
| **0: Audio access** | Recording metadata fetch, Call schema fields, VoiceAnalysis model | `/vm-cpp` (migration) |
| **1: Pipeline stage** | AssemblyAI integration, temporal + sentiment signals, VoiceAnalysis population | `/vm-cp` + seed |
| **2: MEASURE spec** | VOICE-001 spec JSON, Parameters + ADAPT-VOICE-001 seeded, CallScores written | `db:seed` |
| **3: Adaptive loop** | voiceContext SectionDataLoader, [VOICE SIGNALS] in prompt | `/vm-cp` |
| **4: UI surfaces** | VoiceIntelligenceSection, Voice tab, cohort panel, settings card | `/vm-cp` |
| **5: Future** | Per-topic cohort analytics, student growth view in learner portal (TODO #15) | TBD |

Feature is **off by default** (`voice_analysis.enabled = false`). Phases 0-3 can deploy to PROD silently before UI. Safe to deploy before API key configured.

---

## Verification

1. Add `ASSEMBLYAI_API_KEY` env var, enable via settings card, click "Test connection"
2. Make a test call via `/x/sim` → webhook handler fetches recording URL post-call
3. Trigger pipeline → `VoiceAnalysis` record COMPLETE with temporal signals populated
4. Verify `CallScore` records for `VOICE-*` parameters exist
5. Verify `CallerPersonalityProfile.parameterValues` updated with voice scores
6. Run pipeline `mode: "prompt"` → `[VOICE SIGNALS]` section appears in rendered prompt
7. ADAPT rules fire: set VOICE-CONFUSION high in parameterValues → check CallerTarget `challenge_level` decreases
8. Open caller detail → Voice Intelligence card shows latency/disfluency trends
9. Open a call → Voice tab shows COMPLETE with per-topic breakdown
10. Open cohort → Voice pulse shows aggregate + false mastery flagged students
11. Disable `voice_analysis.enabled` → pipeline runs normally, no voice section in prompt

---

## Plan Guards

1. **Dead-ends**: PASS — VoiceAnalysis signals → CallScores → parameterValues → ADAPT rules → CallerTargets → [VOICE SIGNALS] in prompt + Voice Intelligence card. Every computed value has a surface.
2. **Forever spinners**: PASS — `VoiceAnalysisStatus` covers PENDING/PROCESSING/COMPLETE/FAILED/NO_RECORDING. AssemblyAI polling is bounded (5 min timeout → FAILED). UI shows status pill on Voice tab. No unbounded wait.
3. **API dead ends**: PASS — All 5 routes have callers: `/voice-summary` → VoiceIntelligenceSection; `/cohorts/[id]/voice-summary` → cohort panel; `/calls/[id]/voice-analysis` → Voice tab; `/trigger` → Re-analyze button; `/test` → Settings test button.
4. **Routes good**: PASS — All new routes: `requireAuth("OPERATOR")` on read routes, `requireAuth("ADMIN")` on trigger/test. No public endpoints. HTTP methods correct (GET for reads, POST for triggers).
5. **Escape routes**: PASS — No new modals or wizards. Settings card has standard Save. Voice tab is read-only display. Re-analyze button returns immediate status update.
6. **Gold UI**: PASS — VoiceIntelligenceSection uses `hf-card`, `hf-section-title`, `hf-label`. Settings card uses `hf-input`, `hf-btn`, `hf-btn-primary`, `hf-banner-info`. No hardcoded hex. No inline `style={{}}` for static properties.
7. **Missing await**: FLAG (verify in impl) — `fetchAndPersistRecordingMetadata` must `await prisma.call.update()`. `extractVoiceFeatures()` must `await` VoiceAnalysis upsert before creating CallScores.
8. **Hardcoded slugs**: PASS — `VOICE-001` via `config.specs.voiceAnalysis`. ADAPT-VOICE-001 picked up by `findMany({ outputType: "ADAPT" })`.
9. **TDZ shadows**: PASS — New files use `appConfig` (not `config`) for imported config object.
10. **Pipeline integrity**: PASS — Voice extraction is parallel non-blocking in EXTRACT. Flows: EXTRACT → AGGREGATE → ADAPT → COMPOSE. No stage skipped. Gracefully omitted if no recording.
11. **Seed / Migration**: PASS — Migration: VoiceAnalysis model + VoiceAnalysisStatus enum + 4 Call fields. Seed: VOICE-001 + ADAPT-VOICE-001 JSON + `ASSEMBLYAI_API_KEY` in Cloud Run secrets. Deploy: `/vm-cpp`.
12. **API docs**: FLAG — New routes need `@api` JSDoc. Run generator after implementation.
13. **Orphan cleanup**: PASS — Additive only. voiceContext loader returns null when disabled — prompt section omits silently. No dead code introduced.
