# HF Project TODO List

**Last Updated**: 2026-02-08

---

## CRITICAL - Make.com/VAPI Integration

### 📞 Live Call Integration with Make.com/VAPI
**Status**: NOT STARTED - HIGH PRIORITY
**Priority**: CRITICAL
**Estimated Effort**: 3-5 days

**Goal:** Connect HF Admin to real call transcripts from Make.com/VAPI for live analysis.

**Architecture Overview:**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   VAPI       │────▶│   Make.com   │────▶│  HF Admin    │
│  (Voice AI)  │     │  (Webhook)   │     │  /api/ingest │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │  Pipeline    │
                                          │  (Analyze)   │
                                          └──────────────┘
```

**Phase 1: Webhook Endpoint**
- [ ] Create `POST /api/ingest/vapi` - receive call data from Make.com
- [ ] Parse VAPI transcript format (speaker segments, timestamps)
- [ ] Create Call record with transcript
- [ ] Link to Caller (by phone number or external ID)
- [ ] Handle authentication (API key or webhook signature)

**Phase 2: Auto-Pipeline Trigger**
- [ ] Option to auto-run pipeline on new call ingestion
- [ ] Queue system for high-volume (Bull/BullMQ or simple DB queue)
- [ ] Rate limiting to prevent API cost spikes

**Phase 3: Make.com Scenario Setup**
- [ ] Document Make.com scenario configuration
- [ ] VAPI "Call Ended" trigger → HTTP POST to HF
- [ ] Data mapping (call ID, transcript, caller info, metadata)
- [ ] Error handling and retry logic

**Phase 4: Domain-Specific Processing**
- [ ] Map incoming calls to correct Domain (by phone number, VAPI config, etc.)
- [ ] Apply domain-specific playbook for analysis
- [ ] Route results to appropriate dashboards

**API Contract (Draft):**
```typescript
POST /api/ingest/vapi
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "callId": "vapi_call_123",
  "callerPhone": "+1234567890",
  "agentId": "vapi_agent_xyz",
  "startedAt": "2026-02-08T10:00:00Z",
  "endedAt": "2026-02-08T10:15:00Z",
  "duration": 900,
  "transcript": [
    { "speaker": "agent", "text": "Hello, how can I help?", "start": 0, "end": 2.5 },
    { "speaker": "caller", "text": "I need help with...", "start": 2.8, "end": 5.1 }
  ],
  "metadata": {
    "vapiAssistantId": "...",
    "customFields": {}
  }
}

Response: { "ok": true, "callId": "uuid", "pipelineTriggered": true }
```

**Files to Create:**
- `app/api/ingest/vapi/route.ts` - Main webhook endpoint
- `lib/ingest/vapi-parser.ts` - Parse VAPI transcript format
- `lib/ingest/caller-matcher.ts` - Match caller by phone/ID
- `app/x/integrations/page.tsx` - UI to manage integrations
- `docs/VAPI-INTEGRATION.md` - Setup guide for Make.com

**Environment Variables Needed:**
```
VAPI_WEBHOOK_SECRET=xxx        # Verify webhook signatures
INGEST_AUTO_PIPELINE=true      # Auto-run pipeline on ingest
INGEST_RATE_LIMIT=100          # Max calls per minute
```

**Why This Is Critical:**
- Currently no live data flowing into the system
- All analysis is on manually imported transcripts
- Need real calls to validate and tune the pipeline
- Make.com already in use for other automations

---

## High Priority

### ⚙️ Agent Configuration UI
**Status**: Not Started
**Priority**: High
**Estimated Effort**: 2-3 days

**Requirements:**
- Create UI for admin users to edit playbook configurations
- Allow editing of voice rules (response length, pacing, turn-taking)
- Allow editing of behavior targets (warmth, question rate, formality, etc.)
- Live preview of how changes affect the prompt
- Validation to prevent invalid configurations
- Version history / rollback capability

**Current State:**
- Voice rules defined in `bdd-specs/VOICE-001-voice-guidance.spec.json`
- Behavior targets defined in `bdd-specs/playbooks-config.json`
- Must edit JSON files manually to tune agent behavior

**What Admins Need:**
- Sliders for behavior targets (0.0 - 1.0 range)
- Text inputs for voice rules (sentence counts, timing)
- Dropdowns for constraint severity levels
- "Test prompt" button to see resulting prompt with current settings
- Save/publish workflow (draft → published)

**Files to Create:**
- `app/x/playbooks/[playbookId]/configure/page.tsx` - Main config UI
- `components/playbooks/BehaviorTargetEditor.tsx` - Slider controls
- `components/playbooks/VoiceRulesEditor.tsx` - Voice config
- `app/api/playbooks/[playbookId]/config/route.ts` - Save endpoint

**Acceptance Criteria:**
- [ ] Admin can adjust behavior targets via UI sliders
- [ ] Admin can edit voice rules (max sentences, timing)
- [ ] Changes are validated before saving
- [ ] "Preview Prompt" shows resulting system prompt
- [ ] Changes require explicit save/publish action
- [ ] Version history tracks configuration changes

**Why This Matters:**
User feedback: "this kind of edit is EXACTLY what I want Admin users to be able to do, from UI"
- Currently requires editing JSON specs manually
- Non-technical admins can't tune agent behavior
- No way to preview impact of changes before applying
- Hard to experiment with different configurations

---

### 🔐 Authentication & Admin Users
**Status**: IN PROGRESS (Basic auth implemented 2026-02-08)
**Priority**: High
**Estimated Effort**: 1-2 days

**What's Done:**
- [x] NextAuth v5 with email magic link
- [x] User, Session, Account, Invite models in Prisma
- [x] Login page with magic link flow
- [x] Middleware protecting all routes
- [x] Invite system for controlled signup
- [x] Team management page at `/x/users`

**What's Left:**
- [ ] Email provider configuration (need SMTP or Resend)
- [ ] First user bootstrap (create initial admin)
- [ ] Role-based page restrictions (currently all admins)

**Files Created:**
- `lib/auth.ts` - NextAuth configuration
- `app/api/auth/[...nextauth]/route.ts` - Auth routes
- `app/login/page.tsx` - Login UI
- `app/login/verify/page.tsx` - Magic link sent confirmation
- `middleware.ts` - Route protection
- `app/x/users/page.tsx` - Team management
- `app/api/invites/route.ts` - Invite management API
- `app/api/admin/users/route.ts` - User management API

**Environment Variables Needed:**
```bash
# Add to .env
AUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# For email (choose one):
# Option 1: Resend (easiest)
RESEND_API_KEY="re_xxx"
EMAIL_FROM="HF Admin <noreply@yourdomain.com>"

# Option 2: Generic SMTP
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="user"
SMTP_PASSWORD="pass"
```

---

## Medium Priority

### 🧠 Additional Learner Profiling Specs
**Status**: NOT STARTED
**Priority**: Medium
**Estimated Effort**: 1 day per spec

**Context:** VARK-001 and ADAPT-VARK-001 created 2026-02-08. Need additional learner profiling specs to complement Big Five personality and VARK modality.

**Specs to Create:**

1. **KOLB-001: Kolb Learning Cycle Assessment**
   - Measures: Concrete Experience ↔ Abstract Conceptualization, Active Experimentation ↔ Reflective Observation
   - Learner types: Diverger, Assimilator, Converger, Accommodator
   - Detection: How learner approaches new concepts (theory-first vs dive-in, reflect vs try)

2. **MINDSET-001: Growth Mindset Assessment**
   - Measures: Fixed vs Growth mindset orientation
   - Submetrics: challenge_response, failure_attribution, effort_belief, feedback_receptivity
   - Detection: Response to difficulty, attribution of success/failure, belief about ability

3. **MOTIV-001: Learning Motivation Type**
   - Measures: Intrinsic vs Extrinsic motivation, Mastery vs Performance orientation
   - Submetrics: curiosity_driven, goal_orientation, social_comparison, reward_sensitivity
   - Detection: Why they're learning, what success looks like to them

4. **PRIOR-001: Prior Knowledge Assessment**
   - Measures: Domain expertise level (novice → expert)
   - Submetrics: vocabulary_sophistication, concept_familiarity, misconception_density
   - Detection: Use of technical terms, ability to connect concepts, where they struggle

**For Each Spec:**
- [ ] Create `{ID}-*.spec.json` with full parameters, scoring anchors, promptGuidance
- [ ] Create `ADAPT-{ID}-*.spec.json` for behavior target adaptation
- [ ] Add behavior parameters to `behavior-parameters.registry.json`
- [ ] Add to playbooks-config.json for relevant domains

**Integration Points:**
- All feed into CallerPersonalityProfile.parameterValues
- All consumed by compose-prompt.ts for prompt injection
- UI display in caller page under Learning Profile section

---

### 📊 Run Analysis on Existing Callers
**Status**: Not Started  
**Priority**: Medium

**What to do:**
1. Go to http://localhost:3000/analyze
2. Select a caller (e.g., Paul)
3. Choose analysis specs (MEASURE for personality, LEARN for memories)
4. Run analysis to populate personality profiles and memories

**Or via API:**
```bash
# Analyze all callers
curl -X POST http://localhost:3000/api/callers/analyze-all
```

---

## Technical Debt

### 🔧 Refactoring
- [x] Separate User (admin) from Caller (end-user) models - **COMPLETED 2026-02-05**
- [ ] Migrate remaining UserMemory → CallerMemory table names
- [ ] Update ARCHITECTURE.md with new User/Caller distinction

### 🌱 Spec Sync UI (Seed from Browser)
**Status**: NOT STARTED
**Priority**: Medium
**Estimated Effort**: 0.5 days

**Problem:** Currently must run `npm run db:seed` from CLI to load new specs into database.

**Solution:** Add UI to detect unseeded specs and sync them:

**Files to Create/Enhance:**
- `app/x/specs/sync/page.tsx` - UI showing spec sync status
- `app/api/admin/spec-sync/route.ts` - API to trigger sync (exists, enhance)

**UI Features:**
- [ ] Show list of `.spec.json` files in `bdd-specs/` folder
- [ ] Compare against `AnalysisSpec` table records
- [ ] Status indicators: ✅ Synced, ⚠️ Modified, ❌ Not in DB
- [ ] "Sync All" button to load missing specs
- [ ] "Sync Selected" for individual specs
- [ ] Show diff for modified specs before syncing

**API Enhancement:**
```typescript
// GET /api/admin/spec-sync
// Returns: { synced: [...], missing: [...], modified: [...] }

// POST /api/admin/spec-sync
// Body: { specIds: ["VARK-001"] } or { all: true }
// Action: Seeds specified specs into database
```

**Why This Matters:**
- Non-technical users can load new specs without CLI access
- Easier to iterate on spec development
- Visual feedback on what's in DB vs what's in files

---

### 🧪 Testing
- [ ] Add unit tests for critical business logic (per CLAUDE.md requirements)
- [ ] 80% test coverage minimum
- [ ] Tests for all lib/ functions
- [ ] **Headless Browser E2E Tests** for key user flows:
  - [ ] Set up Playwright or Cypress for E2E testing
  - [ ] Caller profile page flow (view caller → view calls → run analysis)
  - [ ] Playbook builder flow (create playbook → add specs → activate)
  - [ ] Prompt composition flow (select caller → compose prompt → verify output)
  - [ ] Data dictionary navigation (search parameters → view cross-references)
  - [ ] Pipeline execution flow (trigger pipeline → view logs → verify results)
  - [ ] Analyze workflow (select caller → select specs → run analysis → view results)

---

## UI/UX Enhancements

### 📈 Advanced Behaviour Measurement Visualization
**Status**: Future Enhancement
**Priority**: Low
**Estimated Effort**: 1-2 days

**Current State:**
- Behaviour tab now uses same LED slider visualization as Targets tab (✅ Completed 2026-02-05)
- Shows measurements vs targets side-by-side

**Future Enhancement (Option 2):**
Create a dedicated measurement visualization that goes beyond simple sliders:
- **Trend over time**: Show measurements across multiple calls with line chart
- **Target reference line**: Visual indicator of where the target is
- **Trend indicators**: Arrows showing improvement/decline (↗️ improving, ↘️ declining, → stable)
- **Statistical insights**: Show min/max/avg/std deviation
- **Call-level drill-down**: Click a measurement to see which call it came from
- **Anomaly detection**: Highlight measurements that are significantly outside normal range

**Benefits:**
- More actionable insights for understanding agent behavior over time
- Easier to spot patterns and anomalies
- Better understanding of whether behavior is improving or regressing

**Files to Create:**
- `components/measurements/TrendChart.tsx` - Time-series visualization
- `components/measurements/MeasurementTimeline.tsx` - Call-by-call view

---

---

## Demo Setup (ngrok)

### 🌐 Share via ngrok for Demo
**For quick sharing with colleagues without deployment**

**Setup:**
```bash
# 1. Install ngrok (if not installed)
brew install ngrok

# 2. Authenticate (one time)
ngrok config add-authtoken YOUR_TOKEN  # Get from ngrok.com

# 3. Start your app
cd apps/admin && npm run dev

# 4. In another terminal, expose port 3000
ngrok http 3000
```

**What You Get:**
- Public URL like `https://abc123.ngrok-free.app`
- Share this URL with colleagues
- They hit the login page, need invite to sign up

**First Admin Bootstrap:**
Since auth is required, you need to create the first user manually:

```bash
# Option 1: Use Prisma Studio
npx prisma studio
# Navigate to User table, add: email, name, role=ADMIN

# Option 2: Quick script (run once)
npx ts-node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.create({
  data: {
    email: 'paul@example.com',
    name: 'Paul',
    role: 'ADMIN',
    emailVerified: new Date()
  }
}).then(console.log).finally(() => prisma.\$disconnect());
"
```

**Caveats:**
- ngrok free tier: URL changes each restart
- Paid ngrok ($8/mo): Get static subdomain
- All colleagues hit YOUR local database
- If your laptop sleeps, everyone loses access

**For Production:** Deploy to Vercel/Railway with Neon/Supabase DB

---

**Quick Commands:**
```bash
npm run devZZZ          # Nuclear reset
npx prisma studio       # View DB
ngrok http 3000         # Expose for demo
```
