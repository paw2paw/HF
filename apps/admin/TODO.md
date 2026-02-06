# HF Project TODO List

**Last Updated**: 2026-02-05

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
**Status**: Not Started  
**Priority**: High  
**Estimated Effort**: 1-2 days

**Requirements:**
- Implement authentication system (NextAuth.js or similar)
- Create admin user registration/login flow
- Use new `User` model with `UserRole` enum (ADMIN, OPERATOR, VIEWER)
- Add RBAC (Role-Based Access Control) middleware
- Protect sensitive routes (/x/*, /api/*)

**Files to Create/Update:**
- `app/api/auth/[...nextauth]/route.ts` - NextAuth config
- `app/login/page.tsx` - Login UI
- `middleware.ts` - Route protection
- `lib/auth.ts` - Auth utilities

**Acceptance Criteria:**
- [ ] Admin users can register with email/password
- [ ] Login/logout flow works
- [ ] RBAC prevents non-admins from accessing admin pages
- [ ] Current session shows in UI (user name, role)
- [ ] Password hashing with bcrypt

---

## Medium Priority

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

### 🧪 Testing
- [ ] Add unit tests for critical business logic (per CLAUDE.md requirements)
- [ ] 80% test coverage minimum
- [ ] Tests for all lib/ functions

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

**Quick Commands:**
```bash
npm run devZZZ          # Nuclear reset
npx prisma studio       # View DB
```
