# Feature TODOs — Market Test Phase 2

Three features that transform HF from individual caller tracking into a cohort-aware learning platform.

---

## 1. Artifact & Data Sharing within Domains

**Problem:** Artifacts (KEY_FACT, FORMULA, EXERCISE, etc.) are per-caller only. Callers in the same domain often surface the same valuable content — verified facts, exercises, resources. There's no way to share proven artifacts across the domain, and no domain-level content library emerges from calls.

### 1.1 Domain Artifact Library

- [ ] Add `DomainArtifact` model — curated artifacts promoted from individual calls to domain-level
  - Fields: `domainId`, `sourceArtifactId` (original), `sourceCallerId` (who surfaced it), `title`, `content`, `type`, `trustLevel`, `curatedBy` (admin who promoted it), `tags[]`, `usageCount`
  - Relationship: Domain 1→N DomainArtifact, ConversationArtifact 1→0..1 DomainArtifact
- [ ] API: `POST /api/domains/:domainId/artifacts` — promote a caller artifact to domain library
- [ ] API: `GET /api/domains/:domainId/artifacts` — list domain artifact library (filter by type, trust, tags)
- [ ] API: `DELETE /api/domains/:domainId/artifacts/:id` — remove from library

### 1.2 Artifact Sharing to Callers

- [ ] API: `POST /api/domains/:domainId/artifacts/:id/share` — push a domain artifact to selected callers (or all callers in domain)
  - Creates `ConversationArtifact` copies with `status=PENDING` for each target caller
  - Respects `artifactConsent` flag
- [ ] Track `sharedFromDomainArtifactId` on ConversationArtifact for provenance
- [ ] Delivery: SimChannel picks up shared artifacts same as extracted ones

### 1.3 Auto-Surfacing Common Artifacts

- [ ] Detection job: after artifact extraction, check similarity against existing domain artifacts (Jaccard on content, same as dedup logic in `lib/artifacts/extract-artifacts.ts`)
- [ ] If high similarity → auto-link to existing domain artifact, increment `usageCount`
- [ ] If novel + high confidence + VERIFIED trust → flag for admin review ("Promote to library?")
- [ ] UI: notification badge on Domain Artifacts tab when candidates pending

### 1.4 Domain Artifacts UI

- [ ] New tab on `/x/domains` detail view: **"Library"** — browse, search, filter domain artifacts
- [ ] Artifact card with: source caller, extraction date, usage count, trust badge, share button
- [ ] Bulk share action: select multiple artifacts → share to all/selected callers
- [ ] "Promote" button on caller artifact detail (in Artifacts tab of CallerDetailPage)

### 1.5 Content Assertion Integration

- [ ] Domain artifacts inherit `contentAssertionIds` from source — maintains trust chain
- [ ] When a ContentAssertion is updated, cascade trust recalculation to linked domain artifacts

**Dependencies:** Existing artifact pipeline (`lib/artifacts/`), `ConversationArtifact` model, `ArtifactCard.tsx` component.

---

## 2. Domain Analysis — Cohort Concerns & Patterns

**Problem:** No domain-level analytics exist. Admins can't see what topics callers care about, how concerns cluster, where callers diverge, or how the domain's learner population evolves over time.

### 2.1 Domain Analytics API

- [ ] `GET /api/domains/:domainId/analytics` — aggregated domain stats
  - Total callers (active, archived, by onboarding status)
  - Call volume (total, per week, trend)
  - Average calls per caller
  - Memory category distribution (FACT, PREFERENCE, CONTEXT, EVENT, TOPIC, RELATIONSHIP across all callers)
  - Top extracted topics (from CallerMemory where category=TOPIC, grouped and counted)
  - Personality distribution (Big Five averages + spread, VARK distribution)
  - Goal completion rates (from Goal model: discovered vs achieved)
  - Artifact stats (by type, trust level, volume trend)

### 2.2 Concern Clustering

- [ ] Extract and aggregate `TOPIC` memories across all callers in a domain
- [ ] Group by semantic similarity (start with exact-match + simple stemming; vector clustering later when RAG lands)
- [ ] API: `GET /api/domains/:domainId/concerns` — returns topic clusters with:
  - Topic label, caller count, mention count, recency, trend (growing/stable/declining)
  - Representative callers per cluster
  - Sample memory excerpts
- [ ] Track concern evolution over time (weekly snapshots for trend analysis)

### 2.3 Caller Comparison / Grouping

- [ ] API: `GET /api/domains/:domainId/segments` — leverage existing `Segment` model (type=COHORT)
  - Auto-generate behavioral cohorts based on: personality clusters, engagement level, goal patterns
  - Manual cohort assignment by admin
- [ ] API: `GET /api/domains/:domainId/compare?callerIds=a,b,c` — side-by-side comparison
  - Personality radar overlay
  - Shared vs unique memories
  - Call frequency comparison
  - Goal progress comparison

### 2.4 Domain Dashboard UI

- [ ] New page: `/x/domains/:domainId/analysis` (or new tab on domains detail)
- [ ] **Overview cards:** caller count, call volume, active rate, avg calls/caller
- [ ] **Concern map:** visual representation of topic clusters (bubble chart or treemap)
  - Size = mention count, color = trend direction, click to see callers
- [ ] **Personality distribution:** Big Five radar chart with domain average + spread shading
- [ ] **Engagement heatmap:** callers x weeks grid showing call activity
- [ ] **Goal funnel:** discovered → in-progress → achieved rates
- [ ] **Artifact summary:** pie chart by type, trend line over time

### 2.5 Concern Alerts

- [ ] Configurable alerts when a new topic emerges across N+ callers (threshold setting)
- [ ] Surface in admin notifications / supervisor page
- [ ] Link alert to concern cluster detail for drill-down

**Dependencies:** CallerMemory, CallerPersonality, Goal models, existing domain-caller relationship. Segment model already exists for cohort grouping.

---

## 3. Caller Types — Teachers, Tutors & Pupil Cohorts

**Problem:** All callers are treated identically. In reality, a human teacher or 1-1 tutor has pupils using the system. The teacher needs a cohort dashboard showing their pupils' activity, progress, and concerns — without being a full admin.

### Open items (require Feature 1 or 2)

These are deferred until the dependency feature lands. Build everything below first.

**Needs Feature 1 (Artifact Sharing):**
- [ ] Pupil detail view: show shared domain-library artifacts for each pupil
- [ ] Teacher dashboard: "Shared Resources" tab showing domain artifacts pushed to cohort members
- [ ] Teacher can promote a pupil's artifact to the domain library directly from cohort view

**Needs Feature 2 (Domain Analysis):**
- [ ] Cohort dashboard: concern clustering scoped to cohort (reuse domain concern API with cohort filter)
- [ ] Cohort concern summary: aggregated topic map across cohort pupils
- [ ] Cohort-level personality distribution chart (reuse domain analysis radar with cohort scope)
- [ ] Alerts: surface emerging concerns when a topic appears across N+ pupils in the cohort

---

### 3.1 Schema: Caller Roles & Cohort Links

- [ ] Add `role` enum to Caller: `LEARNER` (default), `TEACHER`, `TUTOR`, `PARENT`, `MENTOR`
  - Non-breaking: default `LEARNER`, all existing callers unaffected
- [ ] Add `CohortGroup` model:
  - `id`, `name`, `description`, `domainId`, `ownerId` (teacher/tutor Caller), `createdAt`
  - Relationship: CohortGroup 1→N Caller (via `cohortGroupId` on Caller)
  - A caller can belong to one cohort group (their class/tutoring group)
- [ ] Add `cohortGroupId` to Caller — nullable FK to CohortGroup
- [ ] Add `supervisorCallerId` to Caller — direct FK for 1-1 tutor relationships (no group needed)
- [ ] Teachers/tutors are themselves Callers — they can call the system too (e.g., for lesson prep, reflection)

### 3.2 Cohort Management API

- [ ] `POST /api/cohorts` — create cohort group (auth: teacher/tutor caller or admin)
- [ ] `GET /api/cohorts/:id` — cohort detail with member list
- [ ] `PUT /api/cohorts/:id` — update name, description
- [ ] `POST /api/cohorts/:id/members` — add pupils to cohort
- [ ] `DELETE /api/cohorts/:id/members/:callerId` — remove pupil
- [ ] `GET /api/callers/:callerId/cohorts` — list cohorts a teacher owns

### 3.3 Cohort Dashboard API (Teacher View)

- [ ] `GET /api/cohorts/:id/dashboard` — aggregated view for cohort owner:
  - Per-pupil summary: name, last call date, total calls, call trend, onboarding status
  - Per-pupil engagement: calls this week/month, streak, engagement score
  - Per-pupil progress: goals (discovered/in-progress/achieved), personality snapshot
  - Cohort-level: average engagement, personality distribution
- [ ] `GET /api/cohorts/:id/activity` — recent activity feed:
  - New calls, goal achievements, new memories, artifacts created
  - Filterable by pupil, date range, activity type

### 3.4 Pupil Detail View (Teacher-Scoped)

- [ ] `GET /api/cohorts/:id/members/:callerId/summary` — teacher-safe pupil view:
  - Call history (dates + duration, NOT full transcripts — privacy boundary)
  - Goal progress
  - Personality snapshot (Big Five, VARK)
  - Engagement metrics
- [ ] Privacy controls: teachers see summaries and progress, NOT raw transcripts or private memories
  - Configurable per-domain: `domainSettings.teacherTranscriptAccess: boolean`

### 3.5 Teacher/Tutor Onboarding

- [ ] Extend invite flow: invite as `TEACHER` or `TUTOR` role (new field on Invite model)
- [ ] Teacher onboarding creates Caller with role + auto-creates empty CohortGroup
- [ ] Teacher can generate pupil invite links scoped to their cohort
- [ ] Pupil accepts invite → auto-assigned to teacher's cohort

### 3.6 Teacher Dashboard UI

- [ ] New page: `/x/cohorts/:id` — teacher's cohort dashboard
  - **Roster:** pupil list with status indicators (active/inactive/needs-attention)
  - **Activity feed:** chronological stream of pupil activity
  - **Progress grid:** pupils x goals matrix with RAG status
  - **Engagement chart:** per-pupil bar chart of call frequency
- [ ] **Pupil detail drawer/page:** click pupil → see their summary (scoped view, not full admin detail)
- [ ] **Alerts:** highlight pupils with declining engagement or stalled goals

### 3.7 RBAC Integration

- [ ] New permission level or scope: `COHORT_OWNER` — sees only their cohort's callers
  - Between VIEWER and OPERATOR in capability
  - Can view cohort dashboard, pupil summaries
  - Cannot access admin features, other domains, system settings
- [ ] `requireAuth` extension: `requireAuth("VIEWER", { cohortId })` — scoped to cohort ownership
- [ ] Route protection: cohort routes verify ownership (caller.id === cohortGroup.ownerId)

### 3.8 Agent Awareness

- [ ] Voice prompt includes cohort context when available: "This learner is in [Teacher Name]'s group"
- [ ] Teacher callers get a different agent persona (from Identity layer): focus on lesson planning, cohort insights, reflection prompts
- [ ] Separate prompt composition path for teacher vs learner callers (based on `caller.role`)

**Dependencies (standalone):** Caller model, Domain model, Invite flow (`lib/auth.ts`), RBAC (`lib/permissions.ts`), Identity Layers system, prompt composition pipeline.

---

## 4. Action Notifications — SMS/Push to Callers

**Problem:** Actions extracted from calls (homework, reminders, follow-ups) are visible to operators and to the AI agent on next call, but callers receive no notification between calls. A learner assigned homework doesn't know about it until the next session.

### 4.1 Notification Channel — SMS via Twilio

- [ ] Add Twilio SDK dependency (`twilio`)
- [ ] Config: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` in `lib/config.ts`
- [ ] Config: `notifications.sms.enabled` (env: `SMS_NOTIFICATIONS_ENABLED`, default `false`)
- [ ] Create `lib/notifications/sms.ts` — `sendSMS(to: string, body: string): Promise<{ sid: string }>`
  - Metered wrapper (log all sends for audit)
  - Phone number validation (E.164 format)
  - Rate limiting: max 3 SMS per caller per day

### 4.2 Action Notification Service

- [ ] Create `lib/notifications/notify-actions.ts`
  - `notifyCallerActions(callerId: string, actions: CallAction[], log): Promise<NotificationResult>`
  - Filter: only notify for `assignee=CALLER` actions (homework, reminders)
  - Template: friendly summary — "Hi {name}, after our session: {action list}. — {agent name}"
  - Respect caller opt-in: check `CallerAttribute` for `notification.sms.enabled` (default opt-in, can opt out)
- [ ] Dedup: don't re-notify for actions already notified (add `notifiedAt` field to CallAction?)
- [ ] Batch: combine multiple actions from same call into one SMS

### 4.3 Pipeline Integration

- [ ] Wire `notifyCallerActions()` after `extractActions()` in pipeline EXTRACT stage
- [ ] Only fire when `config.notifications.sms.enabled` and caller has valid phone
- [ ] Non-blocking: failures logged but don't break pipeline

### 4.4 Operator-Triggered Notifications

- [ ] API: `POST /api/callers/:callerId/actions/:actionId/notify` — manually trigger notification for any action
- [ ] UI: "Send to caller" button on action cards (CallerDetailPage + Sim sidebar)
- [ ] Support OPERATOR-assigned actions too (e.g., "We've sent your study guide")

### 4.5 Notification History & UI

- [ ] Add `NotificationLog` model (or `notifiedAt`/`notifiedVia` fields on CallAction)
- [ ] Show notification status on action cards: "SMS sent Feb 14" or "Not notified"
- [ ] Admin UI: notification history per caller

### 4.6 Future Channels (post-market-test)

- [ ] WhatsApp Business API (richer formatting, media attachments)
- [ ] Email (for detailed action summaries, attached resources)
- [ ] VAPI outbound call (automated voice reminder)
- [ ] Learner portal push notifications (when/if portal exists)

**Dependencies:** CallAction model (done), Caller.phone field (exists), `lib/config.ts`, pipeline route.

---

## Cross-Feature Dependencies

All four features are **independently buildable**. Optional enhancements layer on when multiple are present:

```
Feature 1 (Artifacts)       ←  Feature 2 (Analysis) can include artifact stats (optional)
Feature 2 (Analysis)        ←  Feature 3 (Cohorts) can scope analysis to cohort level (optional)
Feature 3 (Cohorts)         →  Feature 1 (Artifacts) teacher could see shared domain artifacts (optional)
Feature 4 (Notifications)   →  Feature 1 (Artifacts) could notify callers of shared artifacts too
Feature 4 (Notifications)   →  Feature 3 (Cohorts) teacher could get SMS summary of cohort activity
```

Feature 3 is fully standalone — its core (roles, cohort groups, dashboard, RBAC, onboarding) depends only on existing models. Feature 4 depends on CallAction model (already built).

**Build in any order.** Pick whichever delivers the most value first.

## Schema Changes Summary

| Change | Model | Type |
|--------|-------|------|
| `DomainArtifact` | New model | Feature 1 |
| `sharedFromDomainArtifactId` | New field on ConversationArtifact | Feature 1 |
| `role` enum | New field on Caller | Feature 3 |
| `CohortGroup` | New model | Feature 3 |
| `cohortGroupId` | New field on Caller | Feature 3 |
| `supervisorCallerId` | New field on Caller | Feature 3 |
| `role` field on Invite | New field on Invite | Feature 3 |
| `teacherTranscriptAccess` | Domain settings (JSON or new field) | Feature 3 |
