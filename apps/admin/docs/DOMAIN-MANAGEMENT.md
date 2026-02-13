# Domain Management

## Overview

Domains group callers and their associated playbooks. Each domain can have multiple playbooks stacked by priority, with only published playbooks active in the pipeline.

**UI**: `/x/domains`
**API**: `/api/domains`, `/api/domains/[domainId]`

---

## Domain Lifecycle

```
Create → Active → Deactivated (soft-delete)
```

Domains are never hard-deleted. The DELETE operation sets `isActive = false`.

---

## Delete Domain

**Endpoint**: `DELETE /api/domains/:domainId`

### Business Rules

| Condition | Result |
|-----------|--------|
| Domain has callers (> 0) | **Blocked** — reassign callers first |
| Domain is the default | **Blocked** — cannot delete default domain |
| Domain has 0 callers, not default | **Allowed** — soft-deletes (sets `isActive = false`) |

### UI Behavior

- "Delete Domain" button appears in the detail header for non-default domains
- Inline confirmation banner shows:
  - **If callers exist**: blocking message with caller count, "Reassign callers first"
  - **If deletable**: warning with "Yes, Delete" / "Cancel" buttons
- On success: navigates back to domain list, refreshes data

### API Response Examples

```json
// Success
{ "ok": true, "message": "Domain deactivated" }

// Blocked — has callers
{ "ok": false, "error": "Cannot delete domain with 5 callers assigned. Reassign callers first." }

// Blocked — default domain
{ "ok": false, "error": "Cannot delete the default domain" }
```

---

## Remove Playbook from Domain

Playbooks have a required `domainId` (non-nullable in schema). Removing a playbook from a domain means deleting the playbook record.

**Endpoint**: `DELETE /api/playbooks/:playbookId`

### Business Rules

| Playbook Status | Result |
|----------------|--------|
| `PUBLISHED` | **Blocked** — must archive first |
| `DRAFT` | **Allowed** — deletes playbook and its items |
| `ARCHIVED` | **Allowed** — deletes playbook and its items |

### UI Behavior

- Each playbook row in the domain detail has a `x` remove button
- Inline confirmation appears on the row:
  - **Published**: shows "Archive first" with dismiss button
  - **Draft/Archived**: shows "Remove?" with "Yes" / "No" buttons
- On success: domain detail refreshes, domain list updates counts

### API Response Examples

```json
// Success
{ "ok": true, "message": "Playbook deleted" }

// Blocked — published
{ "ok": false, "error": "Cannot delete a published playbook. Archive it instead." }
```

---

## Data Model

```
Domain (1) ──→ (N) Caller
Domain (1) ──→ (N) Playbook
Playbook (1) ──→ (N) PlaybookItem ──→ AnalysisSpec
```

- `Domain.isActive` — soft-delete flag
- `Domain.isDefault` — exactly one domain is default (protected from deletion)
- `Playbook.domainId` — required FK, non-nullable
- `Playbook.status` — `DRAFT | PUBLISHED | ARCHIVED`

---

## Domain Readiness

Readiness evaluates whether a domain is ready to receive live calls. All checks are **spec-driven** — defined in `DOMAIN-READY-001` spec, not hardcoded.

**UI**: ReadinessBadge component on domain cards
**API**: `GET /api/domains/[domainId]/readiness`
**Runtime**: `lib/domain/readiness.ts`
**Spec**: `docs-archive/bdd-specs/DOMAIN-READY-001-domain-readiness.spec.json`

### How It Works

1. `loadReadinessChecks()` loads checks from the `DOMAIN-READY-001` spec's `readiness_checks` parameter
2. Falls back to 3 hardcoded defaults if spec isn't seeded yet (bootstrap only)
3. Each check has a `query` type mapped to an executor in `checkExecutors`
4. All checks run in parallel, results aggregated into pass/fail with scoring

### Check Query Types

| Query | Executor | Description |
|-------|----------|-------------|
| `playbook` | `playbook` | Domain has a PUBLISHED playbook |
| `playbook_spec_role` | `playbook_spec_role` | Playbook includes spec with given `specRole` (checks both PlaybookItems AND `config.systemSpecToggles`) |
| `content_sources` | `content_sources` | Domain subjects have linked content sources |
| `assertions` | `assertions` | ContentAssertions extracted from domain's content sources |
| `onboarding` | `onboarding` | Domain has identity spec + flow phases configured |
| `system_spec` | `system_spec` | Named system spec is active and compiled |
| `ai_keys` | `ai_keys` | At least one AI provider API key configured |
| `test_caller` | `test_caller` | Domain has at least one caller assigned |

### Severity Levels

| Level | Effect |
|-------|--------|
| `critical` | Blocks go-live — domain marked NOT READY |
| `recommended` | Warning — domain marked ALMOST READY |
| `optional` | Informational — does not block |

### Adding New Checks

1. Add the check definition to `DOMAIN-READY-001` spec (`parameters[0].config.checks`)
2. If using a new `query` type, add an executor to `checkExecutors` in `readiness.ts`
3. Add the new query type to `KNOWN_EXECUTORS` in `tests/lib/domain-readiness.test.ts`
4. Re-seed: the spec-validation test will fail if a check references an unknown query type

### Readiness Result Shape

```typescript
{
  domainId: string;
  domainName: string;
  ready: boolean;          // All critical checks pass
  score: number;           // 0-100 percentage
  level: "ready" | "almost" | "incomplete";
  checks: ReadinessCheckResult[];
  criticalPassed: number;
  criticalTotal: number;
  recommendedPassed: number;
  recommendedTotal: number;
}
```

---

## Auto-Scaffold

When a domain is created, it starts at ~0% readiness — no playbook, no specs, no onboarding config. Auto-scaffold creates the minimum viable setup in one call.

**API**: `POST /api/domains/:domainId/scaffold`
**Auth**: OPERATOR
**Runtime**: `lib/domain/scaffold.ts`

### What It Creates

| Step | Resource | Details |
|------|----------|---------|
| 1 | **Identity Spec** | `AnalysisSpec` with slug `{domain.slug}-identity`, specRole `IDENTITY`, outputType `COMPOSE`. Includes a default trigger for identity establishment. |
| 2 | **Playbook** | Creates a `DRAFT` playbook (or reuses an existing draft). Adds the identity spec as a `PlaybookItem`. |
| 3 | **System Specs** | Enables all active `SYSTEM`-type specs via `config.systemSpecToggles` on the playbook. |
| 4 | **Publish** | Archives any other published playbooks for this domain, publishes the new one. |
| 5 | **Onboarding** | Sets `onboardingIdentitySpecId` and `onboardingFlowPhases` (4-phase default: welcome → discovery → first-topic → wrap-up). |

### Idempotency

- **Published playbook already exists** → returns immediately with `skipped` message
- **Identity spec already exists** (by slug) → reuses it
- **Draft playbook already exists** → reuses it
- Safe to call multiple times on the same domain

### When It Runs

1. **Launchpad**: `DomainStepForm` auto-calls scaffold after domain creation (best-effort)
2. **Quick Setup**: `ReadinessBadge` "Quick Setup" button calls scaffold as step 1
3. **Direct API**: `POST /api/domains/:domainId/scaffold`

### Result Shape

```typescript
{
  identitySpec: { id, slug, name } | null;
  playbook: { id, name } | null;
  published: boolean;
  onboardingConfigured: boolean;
  skipped: string[];
}
```

---

## Content Spec Generation

After scaffold, the domain has infrastructure (playbook, identity) but no teaching content. If the domain has content sources with extracted assertions, a **Content Spec** can be auto-generated using AI.

**API**: `POST /api/domains/:domainId/generate-content-spec`
**Auth**: OPERATOR
**Runtime**: `lib/domain/generate-content-spec.ts`
**AI Function**: `lib/content-trust/extract-curriculum.ts` → `extractCurriculumFromAssertions()`

### Prerequisites

Content spec generation requires assertions in the database. The prerequisite chain:

```
Upload PDF/document → ContentSource
       ↓
Link source to Subject → SubjectSource
       ↓
Link subject to Domain → SubjectDomain
       ↓
Extract assertions → ContentAssertion (via content-trust pipeline)
       ↓
Generate content spec → AnalysisSpec (specRole: CONTENT)
```

If **no assertions exist**, the function returns early with a descriptive `skipped` message — no error, no spec created.

### What It Creates

| Step | Action |
|------|--------|
| 1 | Loads domain and checks for existing content spec (slug: `{domain.slug}-content`) |
| 2 | Loads all `ContentAssertion` records linked via `SubjectSource → SubjectDomain` |
| 3 | Calls `extractCurriculumFromAssertions()` — AI organises assertions into modules with learning outcomes, assessment criteria, key terms |
| 4 | Creates `AnalysisSpec` with specRole `CONTENT`, outputType `COMPOSE`, config containing the curriculum modules |
| 5 | Adds spec to published playbook as a `PlaybookItem`, re-publishes playbook |

### Spec Config Structure

The generated content spec stores curriculum data in its `config` field:

```json
{
  "modules": [
    {
      "id": "MOD-1",
      "title": "Module title",
      "description": "What this module covers",
      "learningOutcomes": ["LO1: Identify...", "LO2: Explain..."],
      "assessmentCriteria": ["Can define X", "Can list Y"],
      "keyTerms": ["term1", "term2"],
      "estimatedDurationMinutes": 30,
      "sortOrder": 1
    }
  ],
  "deliveryConfig": {
    "sessionStructure": ["Opening review", "New content", "Practice", "Summary"],
    "assessmentStrategy": "Spaced repetition with formative checks",
    "pedagogicalNotes": ["Start with real-world examples"]
  },
  "sourceCount": 2,
  "assertionCount": 87,
  "generatedAt": "2026-02-12T..."
}
```

### Idempotency

- **Content spec already exists** (by slug `{domain.slug}-content`) → returns existing spec, skips generation
- **No assertions** → returns with `skipped` message, no error
- **AI extraction fails** → returns with `error` field, HTTP 422
- Safe to call multiple times

### Result Shape

```typescript
{
  contentSpec: { id, slug, name } | null;
  moduleCount: number;
  assertionCount: number;
  addedToPlaybook: boolean;
  skipped: string[];
  error?: string;
}
```

---

## Quick Setup

The "Quick Setup" button on the `ReadinessBadge` component combines scaffold + content spec generation into a single user action.

**Component**: `components/shared/ReadinessBadge.tsx`
**Visibility**: Shown when readiness level is `incomplete` and the checklist is expanded

### Flow

```
User clicks "Quick Setup"
       ↓
Step 1: POST /api/domains/:domainId/scaffold
       → Creates identity spec, playbook, onboarding
       ↓
Step 2: POST /api/domains/:domainId/generate-content-spec
       → Creates content spec from assertions (if any exist)
       ↓
Step 3: Refresh readiness data
       → Badge updates to reflect new readiness level
       ↓
Step 4: Call onScaffold() callback (optional)
       → Parent component can refresh its own data
```

Both API calls are best-effort — if scaffold succeeds but content spec generation fails (e.g. no assertions yet), the domain still gets the scaffold benefits.

### User Flows

**Path A — Launchpad (new domain)**
1. Go to `/x/launchpad`
2. AI plans a setup workflow
3. Domain step creates domain + auto-scaffolds
4. Upload step lets user upload content (or skip)
5. Readiness check shows current state

**Path B — Existing domain**
1. Go to `/x/domains`
2. Click readiness badge (shows "Not Ready" / "Almost Ready")
3. Badge expands to show checklist
4. Click "Quick Setup" button
5. Badge refreshes to show new readiness level

**Path C — API-only**
```bash
# Scaffold
curl -X POST /api/domains/{domainId}/scaffold

# Generate content spec (after uploading content + extracting assertions)
curl -X POST /api/domains/{domainId}/generate-content-spec
```

---

## Test Coverage

Tests: `tests/api/domains.test.ts`

- Domain DELETE: 404, default-blocked, callers-blocked, soft-delete success
- Playbook DELETE: 404, published-blocked, draft delete, archived delete

Tests: `tests/lib/domain-readiness.test.ts`

- `playbook_spec_role` executor: system toggles, domain items, combined, disabled, missing
- Overall scoring: critical fail → incomplete, critical pass → ready, domain not found
- Spec-driven loading: loads from DOMAIN-READY-001 spec, falls back to defaults
- Spec-file validation: every query type in DOMAIN-READY-001 has a matching executor, unique IDs, valid fields

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/domain/scaffold.ts` | Auto-scaffold function (identity spec, playbook, publish, onboarding) |
| `lib/domain/generate-content-spec.ts` | AI-powered content spec generation from assertions |
| `lib/domain/readiness.ts` | Readiness check runner (spec-driven) |
| `lib/content-trust/extract-curriculum.ts` | AI curriculum extraction (reused by generate-content-spec) |
| `app/api/domains/[domainId]/scaffold/route.ts` | POST endpoint for scaffold |
| `app/api/domains/[domainId]/generate-content-spec/route.ts` | POST endpoint for content spec generation |
| `app/api/domains/[domainId]/readiness/route.ts` | GET endpoint for readiness checks |
| `components/shared/ReadinessBadge.tsx` | Badge + Quick Setup button UI |
| `components/workflow/steps/DomainStepForm.tsx` | Launchpad domain creation (auto-scaffolds) |
