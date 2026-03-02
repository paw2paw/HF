# HF Project TODO List

**Last Updated**: 2026-03-01

---

## ~~CRITICAL - Cloud Deployment (Market Test)~~

### ~~Cloud Deploy to Google Cloud Run~~
**Status**: DONE (Feb 13-14, 2026)

All 3 environments deployed:
- [x] DEV: `dev.humanfirstfoundation.com` → `hf-admin-dev`
- [x] TEST: `test.humanfirstfoundation.com` → `hf-admin-test`
- [x] PROD: `lab.humanfirstfoundation.com` → `hf-admin`
- [x] Cloudflare Tunnel routing
- [x] CI/CD via GitHub Actions with Workload Identity Federation
- [x] Seed/migrate jobs per environment
- [x] Email configured (Resend)
- [x] `/deploy` slash command handles all 3 environments

---

## ~~CRITICAL - Email Configuration~~

### ~~Resend Setup for Invite Emails~~
**Status**: DONE (Feb 2026)

- [x] Resend configured with API key
- [x] Domain verified
- [x] RESEND_API_KEY in Secret Manager
- [x] EMAIL_FROM set on Cloud Run
- [x] Invite email delivery working

---

## CRITICAL - Analytics / Testimony Capture

### Per-Spec Evidence for Market Test
**Status**: NOT STARTED
**Priority**: CRITICAL — needed to prove system works

**Goal:** Capture per-spec evidence that the system produces useful results. For each active spec, collect:
- Pipeline run count (how many calls processed)
- Score distributions (are measurements sensible?)
- Before/after prompt quality (does composition improve?)
- Tester feedback (qualitative)

**Files to create:**
- `app/api/analytics/testimony/route.ts` — aggregate evidence per spec
- `app/x/analytics/page.tsx` — dashboard showing testimony by spec

---

## ~~CRITICAL - VAPI Integration~~

### ~~Live Call Integration with VAPI~~
**Status**: DONE (Feb 2026)

VAPI integration is live with 4 endpoints:
- [x] `POST /api/vapi/assistant-request` — dynamic assistant config
- [x] `POST /api/vapi/webhook` — call lifecycle events
- [x] `POST /api/vapi/knowledge` — per-turn knowledge retrieval
- [x] `POST /api/vapi/tools` — tool use during calls
- [x] All endpoints validated via webhook-secret (`lib/vapi/auth.ts`)
- [x] Auto-pipeline trigger on call end
- [x] Voice prompt uses `renderVoicePrompt()` with narrative memory framing

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
- Voice rules defined in `docs-archive/bdd-specs/VOICE-001-voice-guidance.spec.json`
- Behavior targets defined in `docs-archive/bdd-specs/playbooks-config.json`
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

### 🎭 Persona Slider Tuning Setup
**Status**: NOT STARTED
**Priority**: High
**Estimated Effort**: 2-3 days
**Related**: Agent Configuration UI

**Goal**: Create an interactive UI for tuning persona behavior parameters using sliders, making it easy to adjust personality traits, teaching styles, and response patterns for different agent personas (Tutor, Companion, Coach).

**Current State:**
- Personas defined in specs (TUTOR-001, COMPANION-001, COACH-001)
- Behavior parameters exist in database (warmth, empathy, formality, etc.)
- No UI for adjusting persona-specific behavior targets
- Tuning requires manual JSON editing

**What Admins Need:**
- Per-persona configuration page
- LED-style vertical sliders (like in caller targets) for each behavior parameter
- Real-time preview showing how changes affect agent responses
- Preset templates (e.g., "Warm Tutor", "Professional Coach", "Friendly Companion")
- Compare mode: side-by-side view of different persona configurations
- Save/publish workflow with version history

**Behavior Parameters to Include:**
```typescript
// Teaching/Tutoring Behaviors
- BEH_WARMTH          // Friendliness and approachability
- BEH_EMPATHY_RATE    // Emotional support frequency
- BEH_QUESTION_RATE   // Socratic questioning frequency
- BEH_FORMALITY       // Professional vs casual tone
- BEH_PRAISE_RATE     // Encouragement frequency
- BEH_SCAFFOLDING     // Guidance vs independence

// Conversation Style
- BEH_TURN_LENGTH     // Response length (brief vs detailed)
- BEH_PACING          // Conversation speed
- BEH_ENTHUSIASM      // Energy level
- BEH_HUMOR_RATE      // Appropriate humor usage

// Knowledge Delivery
- BEH_ELABORATION     // Detail depth
- BEH_EXAMPLE_RATE    // How often to give examples
- BEH_CLARIFICATION   // Proactive checking understanding
```

**UI Components Needed:**
```
app/x/personas/
├── page.tsx                          # Persona list/selector
├── [personaId]/
│   ├── configure/
│   │   ├── page.tsx                  # Main config interface
│   │   └── components/
│   │       ├── BehaviorSliders.tsx   # Grouped sliders by category
│   │       ├── PresetSelector.tsx    # Load preset configs
│   │       ├── CompareView.tsx       # Side-by-side comparison
│   │       └── PromptPreview.tsx     # Live prompt rendering
│   └── test/
│       └── page.tsx                  # Test persona with sample scenarios

components/persona/
├── PersonaCard.tsx                   # Display persona summary
├── BehaviorSliderGroup.tsx           # Reuse from VerticalSlider
└── PresetLibrary.tsx                 # Preset configuration templates
```

**Features:**
1. **Slider Interface**
   - Use existing VerticalSlider component from `/components/shared/VerticalSlider.tsx`
   - Group sliders by category (Teaching, Conversation, Knowledge)
   - Color-coded by behavior type (warmth=pink, formality=blue, etc.)
   - Show current value, target range, and description

2. **Preset Templates**
   ```typescript
   const TUTOR_PRESETS = {
     "warm-supportive": {
       BEH_WARMTH: 0.8,
       BEH_EMPATHY_RATE: 0.7,
       BEH_FORMALITY: 0.4,
       BEH_SCAFFOLDING: 0.8,
       ...
     },
     "professional-direct": {
       BEH_WARMTH: 0.5,
       BEH_FORMALITY: 0.8,
       BEH_SCAFFOLDING: 0.5,
       ...
     },
     // More presets...
   };
   ```

3. **Live Preview**
   - Show sample conversation with current settings
   - "Test Response" button sends sample prompt with current config
   - Display how parameters affect actual agent behavior
   - Side-by-side before/after comparison

4. **Version History**
   - Track configuration changes over time
   - Rollback to previous versions
   - Compare different versions
   - Export/import configurations

**Database Schema Updates:**
```prisma
model PersonaConfig {
  id              String   @id @default(uuid())
  personaSlug     String   // "tutor", "companion", "coach"
  version         String   // "1.0", "1.1", etc.
  status          String   // "draft", "published", "archived"

  behaviorTargets Json     // { "BEH_WARMTH": 0.7, ... }
  voiceRules      Json?    // Optional voice-specific rules

  createdBy       String
  createdAt       DateTime @default(now())
  publishedAt     DateTime?

  @@unique([personaSlug, version])
}
```

**API Endpoints:**
```typescript
// GET /api/personas - List all personas
// GET /api/personas/[slug] - Get persona details
// GET /api/personas/[slug]/config - Get current config
// PUT /api/personas/[slug]/config - Update config
// POST /api/personas/[slug]/test - Test with sample scenario
// GET /api/personas/[slug]/presets - Get preset templates
```

**Acceptance Criteria:**
- [ ] Admin can view list of all personas (Tutor, Companion, Coach)
- [ ] Admin can adjust behavior parameters via sliders for each persona
- [ ] Changes update in real-time with visual feedback
- [ ] Preset templates can be loaded with one click
- [ ] Live preview shows how config affects agent responses
- [ ] Compare mode shows side-by-side persona differences
- [ ] Configurations can be saved as drafts or published
- [ ] Version history tracks all changes with rollback capability
- [ ] Export/import persona configs for sharing

**Why This Matters:**
- Enables rapid iteration on persona behavior without code changes
- Visual, intuitive interface for non-technical admins
- Easy A/B testing of different configurations
- Consistent behavior across all agents using the same persona
- Reduces time from "I want to change X" to "change is live"

---

### 🔐 Authentication & Admin Users
**Status**: ✅ COMPLETE (2026-02-12)
**Priority**: High

**What's Done:**
- [x] NextAuth v5 with Credentials + Email magic link
- [x] User, Session, Account, Invite models in Prisma
- [x] Login page with magic link flow
- [x] Middleware protecting all routes (edge cookie check)
- [x] Invite system for controlled signup (domain-locked)
- [x] Team management page at `/x/users`
- [x] `lib/permissions.ts`: `requireAuth(role)` + `isAuthError()` discriminated union
- [x] ~315 API routes call `requireAuth()`, 12 intentionally public (incl. VAPI webhook-secret)
- [x] 8-role hierarchy: SUPERADMIN > ADMIN > OPERATOR/EDUCATOR > SUPER_TESTER > TESTER/STUDENT/VIEWER > DEMO
- [x] Coverage test: `tests/lib/route-auth-coverage.test.ts` (fails CI if any route missing auth)
- [x] 17 unit tests for permissions helper
- [x] Sim auth integrated: access code system removed, invite → user → session flow
- [x] OPERATOR sees only own callers in sim conversation list
- [x] Default new user role: OPERATOR (changed from ADMIN)

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

### 🎯 User Guidance System - Multi-Step Missions
**Status**: Phase 1 & 2 COMPLETE | Phases 3-6 NOT STARTED
**Priority**: Medium
**Estimated Effort**: 5-6 days total
**Plan File**: `.claude/plans/declarative-swimming-kettle.md`

**What's Done (Feb 2026):**
- [x] Phase 1: Sidebar highlight system (pulse/flash/glow animations)
- [x] Phase 2: AI Chat guidance integration (AI can highlight sidebar items)
- [x] GuidanceContext, GuidanceBridge, CSS animations, ChatContext parsing

**Remaining Phases:**

**Phase 3: Mission Framework (2 days)**
- [ ] `lib/guidance/missions.ts` - Define multi-step workflow missions
- [ ] `components/guidance/MissionPanel.tsx` - Floating progress panel
- [ ] `lib/guidance/mission-checks.ts` - Step completion detection
- [ ] AI can trigger missions via `{"action":"mission","id":"first-onboarding-setup"}`

Example missions:
- "Setup First Onboarding Call" → Create caller → Assign persona → Generate prompt
- "Import Your First Spec" → Go to import → Upload spec → Activate

**Phase 4: Persona-Caller Connection (1 day)**
- [ ] Add `personaSlug` field to Caller model (tutor/companion/coach)
- [ ] Update caller create UI with persona selector
- [ ] Pass persona to prompt composition for welcome messages

**Phase 5: Contextual Help Tooltips (1 day)**
- [ ] Show tooltip with guidance message near highlighted item
- [ ] "Got it" dismiss button, link to docs

**Phase 6: Onboarding Checklist Widget (2 days)**
- [ ] Dashboard widget showing setup progress for new users
- [ ] "Continue Setup" button starts relevant mission

---

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
- [ ] Show list of `.spec.json` files in `docs-archive/bdd-specs/` folder
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

### 🎨 UI Styling Consistency & Design System Extraction
**Status**: NOT STARTED
**Priority**: Medium
**Estimated Effort**: 3-4 days
**Context**: After improving taxonomy-graph contrast (2026-02-09), established patterns that should be extracted and applied app-wide.

**Goal**: Extract the improved UI patterns from taxonomy-graph into reusable components and apply consistent styling across the entire app.

**Established Patterns** (from taxonomy-graph improvements):
1. **Border weights**: 2px borders for emphasis, 1px for subtle
2. **Panel styling**: Solid backgrounds with `backdrop-blur-sm`, shadow-xl for depth
3. **Button states**: 30% opacity backgrounds, 2px borders, hover scale effects
4. **Typography**: Bold headers, semibold labels, medium body text
5. **Dark mode**: Proper contrast ratios (WCAG AA standard: 4.5:1)
6. **Spacing**: Consistent padding (px-3, py-2 for buttons, px-4, py-3 for panels)
7. **Interactive feedback**: Hover states, transitions, scale animations

**Files That Need Updates**:
- [ ] `/x/specs` page - Apply panel and button patterns
- [ ] `/x/playbooks` page - Consistent form controls
- [ ] `/x/domains` page - Better contrast on cards
- [ ] Caller detail page - Improved panel hierarchy
- [ ] Data dictionary - Enhanced readability
- [ ] Settings pages - Unified form styling
- [ ] Modal dialogs - Consistent overlay patterns

**Components to Extract**:
```typescript
// Proposed new shared components
components/shared/
├── Panel.tsx              // Styled panel with consistent borders/shadows
├── Button.tsx             // Primary/secondary/destructive variants
├── ToggleGroup.tsx        // 2D/3D style segmented control
├── FilterButton.tsx       // Type filter button pattern
├── StatusBadge.tsx        // Unified badge styling (enhance existing)
└── FormSection.tsx        // Consistent form section wrapper
```

**CSS Variables to Add** (globals.css):
```css
/* Interactive element scales */
--hover-scale: 1.02;
--active-scale: 0.98;

/* Panel elevations */
--panel-border-default: 2px;
--panel-border-subtle: 1px;
--shadow-panel: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-panel-hover: 0 20px 25px -5px rgb(0 0 0 / 0.1);

/* Button backgrounds */
--button-bg-opacity: 30%;  // For colored backgrounds
--button-disabled-opacity: 0.6;
```

**Implementation Phases**:
1. **Extract Components** (1 day)
   - Create reusable Panel, Button, ToggleGroup components
   - Use entityColors and CSS variables
   - Document usage patterns

2. **Update Core Pages** (1.5 days)
   - Apply to specs, playbooks, domains, callers
   - Ensure dark mode consistency
   - Test contrast ratios

3. **Form Standardization** (1 day)
   - Unified form controls (inputs, selects, checkboxes)
   - Consistent validation styling
   - Better error states

4. **Documentation** (0.5 days)
   - Add design system guide to `/docs/DESIGN-SYSTEM.md`
   - Component usage examples
   - Color palette reference

**Success Criteria**:
- [ ] All major pages use consistent panel styling
- [ ] Buttons follow unified design patterns
- [ ] Dark mode contrast meets WCAG AA standards across app
- [ ] No more than 3 button variants (primary/secondary/destructive)
- [ ] Hover/focus states are consistent
- [ ] Design system documented for future reference

**Why This Matters**:
- Improved accessibility and readability
- Faster development (reusable components)
- Professional, polished appearance
- Easier onboarding for new developers
- Better user experience across all pages

---

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
