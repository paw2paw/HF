# HF Admin TODO

## Lab Feature (TBD)

**Status:** Not Started
**Priority:** Medium
**Location:** `/x/lab`

### Overview
The Lab is a sandbox environment for testing specs, comparing results, and experimenting with prompts before deploying to production.

### Planned Features

- [ ] **Test Specs Against Sample Text**
  - Input text box for pasting sample transcript/text
  - Select spec(s) to test
  - Run analysis and display results
  - Show raw LLM response alongside parsed output

- [ ] **Compare Results Across Spec Versions**
  - Side-by-side diff view
  - Run same input through multiple spec versions
  - Highlight differences in output

- [ ] **Preview Generated Prompts**
  - Show full composed prompt for a caller
  - Display variable substitutions
  - Test prompt templates with sample data

- [ ] **A/B Test Playbook Configurations**
  - Select two playbooks to compare
  - Run same call through both
  - Compare scores, memories, and composed prompts

### Technical Notes

- May need batch processing for comparing multiple specs
- Consider caching LLM responses for comparison runs
- Need snapshot/export of comparison results

---

## Other TODOs

### System Spec Toggles (Deferred)
**Status:** Not Implemented
**Priority:** Low
**Related Files:**
- `app/api/playbooks/[playbookId]/route.ts`
- `app/api/playbooks/[playbookId]/parameters/route.ts`
- `app/api/calls/[callId]/pipeline/route.ts`

#### Current Behavior
- All SYSTEM specs (scope="SYSTEM") are **always enabled** for all playbooks
- DOMAIN specs (scope="DOMAIN") can be toggled per playbook via PlaybookItems

#### Desired Behavior
- Add ability to selectively disable specific SYSTEM specs per playbook
- Requires creating a `PlaybookSpec` model in Prisma schema:
  ```prisma
  model PlaybookSpec {
    id         String   @id @default(uuid())
    playbookId String
    specId     String
    isEnabled  Boolean  @default(true)
    configOverride Json? // Optional config overrides

    playbook Playbook     @relation(fields: [playbookId], references: [id])
    spec     AnalysisSpec @relation(fields: [specId], references: [id])

    @@unique([playbookId, specId])
  }
  ```
- Update API routes to query PlaybookSpec for overrides
- Default to enabled if no PlaybookSpec record exists

#### Why Deferred
- Current behavior (all system specs always on) works fine for MVP
- Can add toggle functionality later when there's a real use case
- Avoids premature complexity

---

### Import Improvements
- [ ] Support more transcript formats (Zoom, Teams, Google Meet exports)
- [ ] Bulk import with progress indicator
- [ ] Import preview before committing

### Chat Enhancements
- [ ] Add context-aware suggestions based on current page
- [ ] Quick commands palette (Cmd+K menu)
- [ ] Export chat history

---

## Voice Agent for Call Chat

**Status:** Not Started
**Priority:** TBD
**Idea:** Replace typing in the Call chat with voice input/output (STT + TTS)

### Approach Options

#### Option 1: Browser APIs (Free, Quick MVP)
- **STT**: `webkitSpeechRecognition` / Web Speech API
- **TTS**: `SpeechSynthesis` API
- **Pros**:
  - Zero cost
  - Works immediately, ~50 lines of code
  - No external dependencies
- **Cons**:
  - Robotic TTS voice quality
  - Inconsistent STT accuracy
  - Browser-dependent (Chrome best, Safari limited)
- **Effort**: 1-2 days for basic working version

#### Option 2: Cloud APIs (Better Quality)
- **STT Options**:
  - OpenAI Whisper API (~$0.006/min)
  - Deepgram (~$0.0043/min, real-time capable)
  - AssemblyAI (~$0.01/min)
- **TTS Options**:
  - ElevenLabs (best quality, ~$0.30/1k chars)
  - OpenAI TTS (~$0.015/1k chars)
  - PlayHT, Azure Speech Services
- **Pros**:
  - Much more natural voices
  - Reliable accuracy
  - Language support
- **Cons**:
  - Per-minute/character costs
  - 100-500ms latency per request
- **Effort**: 3-5 days

#### Option 3: Real-time Voice AI (Best UX)
- **Options**:
  - OpenAI Realtime API - STT + LLM + TTS in one streaming call
  - LiveKit Agents - open source, self-hostable
  - Vapi.ai - managed voice agent platform
  - Retell.ai - managed, good for call center use cases
- **Pros**:
  - True conversational feel
  - Interruption handling
  - Sub-200ms latency
  - Voice activity detection built-in
- **Cons**:
  - Higher cost (~$0.10-0.20/min)
  - More complex integration
  - May require WebRTC/WebSocket infrastructure
- **Effort**: 1-2 weeks

### Recommended Approach

**Hybrid MVP**: Add voice as an I/O layer on existing chat
1. Add 🎤 microphone button to Call chat input
2. Use browser STT (or Whisper API) to transcribe user speech
3. Send transcribed text through existing pipeline (no changes needed)
4. Play AI response with OpenAI TTS or ElevenLabs
5. Optional: Add "auto-listen" mode for continuous conversation

This reuses all existing chat/LLM logic and adds voice incrementally.

### Technical Considerations

- [ ] Voice Activity Detection (VAD) for knowing when user stops speaking
- [ ] Audio playback queue for long responses
- [ ] Visual feedback (waveform, listening indicator)
- [ ] Fallback to text input if mic permission denied
- [ ] Mobile browser compatibility testing
- [ ] Consider WebRTC for lowest latency in Option 3

### UI Polish
- [ ] Dark mode support
- [ ] Responsive mobile layout
- [ ] Keyboard shortcuts guide
