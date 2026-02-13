# Content Trust & Source Authority

<!-- @doc-source model:ContentSource,ContentAssertion,ContentTrustLevel,Curriculum -->
<!-- @doc-source file:apps/admin/lib/content-trust/validate-source-authority.ts -->
<!-- @doc-source file:apps/admin/lib/prompt/composition/transforms/trust.ts -->
<!-- @doc-source file:apps/admin/lib/curriculum/track-progress.ts -->
<!-- @doc-source route:/api/content-sources -->
<!-- @doc-source route:/api/content-sources/available -->
<!-- @doc-source spec:TRUST-001,CONTENT_TRUST_V1 -->

**Date:** February 11, 2026
**Status:** IMPLEMENTED (Phase 1-7 complete)

---

## Purpose

When AI tutors teach regulated qualifications (CII Diploma R01-R06 for IFAs, Highfield Food Safety L2, etc.), the difference between "AI thinks this works like X" and "the CII R04 syllabus says X" has real consequences: exam failure, mis-selling, regulatory sanctions.

This system:

1. **Classifies** content by provenance and authority level (6-tier trust taxonomy)
2. **Traces** every teaching point back to its authoritative source
3. **Weights** learner progress by content trust (certification readiness vs general understanding)
4. **Flags** stale content (tax thresholds change every April, syllabi update annually)
5. **Instructs** the AI to cite sources and refuse to hallucinate

---

## Trust Taxonomy

Six levels, highest to lowest:

| Level | Enum Value | Weight | Example | Who Can Assign |
|-------|-----------|--------|---------|----------------|
| L5 | `REGULATORY_STANDARD` | 1.00 | CII R04 syllabus, FCA Handbook, Ofqual qualification spec | System Admin |
| L4 | `ACCREDITED_MATERIAL` | 0.95 | CII-approved study text (BFT/ActEd), Sprenger handbook | Domain Admin (qualified) |
| L3 | `PUBLISHED_REFERENCE` | 0.80 | Academic textbook, peer-reviewed journal | Domain Admin |
| L2 | `EXPERT_CURATED` | 0.60 | Content by a qualified IFA/instructor | Instructor (qualified) |
| L1 | `AI_ASSISTED` | 0.30 | AI-generated, human-reviewed | Instructor |
| L0 | `UNVERIFIED` | 0.05 | Unreviewed submissions, user notes | Default |

**Rules:**
- Content starts at L0
- Can only move UP through verification
- Moving down requires admin action with reason logged
- AI never auto-promotes content

---

## Schema

### Enum: `ContentTrustLevel`

```prisma
enum ContentTrustLevel {
  REGULATORY_STANDARD   // L5
  ACCREDITED_MATERIAL   // L4
  PUBLISHED_REFERENCE   // L3
  EXPERT_CURATED        // L2
  AI_ASSISTED           // L1
  UNVERIFIED            // L0
}
```

### Model: `ContentSource`

The authority registry. Each record is a specific source (book, syllabus, handbook):

| Field | Type | Description |
|-------|------|-------------|
| `slug` | String (unique) | URL-safe identifier, e.g. `"cii-r04-syllabus-2025"` |
| `name` | String | Display name |
| `trustLevel` | ContentTrustLevel | Authority level |
| `publisherOrg` | String? | Publisher organization |
| `accreditingBody` | String? | Who accredits this (e.g. "Ofqual", "CII") |
| `accreditationRef` | String? | Accreditation number (e.g. "603/4937/2") |
| `authors` | String[] | Author list |
| `isbn` | String? | ISBN for books |
| `doi` | String? | DOI for academic papers |
| `edition` | String? | Edition (e.g. "37th Edition") |
| `publicationYear` | Int? | Year of publication |
| `validFrom` | DateTime? | When this source becomes effective |
| `validUntil` | DateTime? | **Critical**: when this source expires |
| `qualificationRef` | String? | Qualification reference (e.g. "CII R04") |
| `moduleCoverage` | String[] | Which curriculum modules this covers |
| `verifiedBy` | String? | Who verified this source |
| `verifiedAt` | DateTime? | When it was verified |
| `supersededById` | String? | FK to newer version of this source |

### Model: `ContentAssertion`

Atomic trusted facts with full provenance (ready for future use):

| Field | Type | Description |
|-------|------|-------------|
| `assertion` | String | The teaching point text |
| `sourceId` | FK → ContentSource | Where this fact comes from |
| `chapter` | String? | Location within source |
| `section` | String? | Sub-location |
| `pageRef` | String? | Page number/range |
| `category` | String? | fact / definition / threshold / rule / process / example |
| `validUntil` | DateTime? | For time-bound facts (tax thresholds) |
| `taxYear` | String? | Fiscal year (e.g. "2024/25") |
| `examRelevance` | Float? | 0-1, how important for exam |
| `learningOutcomeRef` | String? | e.g. "R04-LO2-AC2.3" |

### Extended: `Curriculum`

Added trust fields to existing model:

| Field | Type | Description |
|-------|------|-------------|
| `trustLevel` | ContentTrustLevel? | Overall curriculum trust level |
| `primarySourceId` | FK → ContentSource? | Primary authoritative source |
| `qualificationBody` | String? | e.g. "CII", "Highfield" |
| `qualificationNumber` | String? | e.g. "R04", "603/4937/2" |
| `qualificationLevel` | String? | e.g. "Level 2", "Diploma" |
| `validFrom` | DateTime? | Curriculum effective date |
| `validUntil` | DateTime? | Curriculum expiry date |

---

## Architecture

### Data Flow

```
ContentSource (DB registry)
    ↓ slug references
CONTENT spec sourceAuthority (JSON config)
    ↓ validated & enriched at save time
    ↓ loaded by CompositionExecutor at call time
transforms/trust.ts → injects into LLM system prompt
    ↓ AI uses trust context during conversation
SUPV-001 scores source_citation_score (post-call)
    ↓ module mastery recorded
track-progress.ts → dual-track weighted progress
```

### Prompt Composition Pipeline

```
Learner starts call
    ↓
/api/callers/[callerId]/compose-prompt
    ↓
CompositionExecutor loads content spec + caller data
    ↓
transforms/modules.ts → computeSharedState()
  ├─ Extracts modules from content spec
  ├─ Reads mastery from CallerAttributes
  ├─ Sets moduleToReview = last completed module
  ├─ Sets nextModule = first uncompleted module
  └─ Sets reviewType based on daysSinceLastCall
    ↓
transforms/modules.ts → computeModuleProgress()
  └─ Returns nextModule with full content + sourceRefs
    ↓
transforms/trust.ts → computeTrustContext()
  ├─ Reads sourceAuthority from content spec config
  ├─ Builds CONTENT AUTHORITY header
  ├─ Builds TRUST RULES
  ├─ Builds REFERENCE CARD for current module
  ├─ Checks freshness (enriched _validUntil from DB)
  └─ Injects VALIDITY WARNINGS if expired/expiring
    ↓
renderPromptSummary.ts → assembles final LLM prompt
```

### Validation & Enrichment (Save Time)

When a CONTENT spec with `sourceAuthority` is saved (PATCH, POST, or import):

1. `hasSourceAuthority(config)` checks if config has `sourceAuthority.primarySource.slug`
2. `validateSourceAuthority(config.sourceAuthority)` runs:
   - Queries `ContentSource` table for all referenced slugs (batch query)
   - Returns **errors** if any slug not found: `"Register it at /x/content-sources first."`
   - Returns **warnings** for expired/expiring/superseded sources
   - **Enriches** source refs with DB metadata: `_validUntil`, `_accreditingBody`, `_isbn`, etc.
3. Enriched `sourceAuthority` is saved back to the spec config
4. At prompt composition time, the trust transform reads enriched data (no DB query needed)

---

## CONTENT Spec Structure

A CONTENT spec's config JSON with sourceAuthority:

```json
{
  "sourceAuthority": {
    "primarySource": {
      "slug": "highfield-l2-food-safety-qual-spec",
      "name": "Highfield Level 2 Award in Food Safety (RQF) Qualification Specification",
      "trustLevel": "REGULATORY_STANDARD",
      "publisherOrg": "Highfield Qualifications",
      "_dbId": "uuid-from-db",
      "_validUntil": "2027-08-31T00:00:00.000Z",
      "_accreditingBody": "Ofqual",
      "_accreditationRef": "603/4937/2"
    },
    "secondarySources": [{
      "slug": "sprenger-food-safety-handbook-37th",
      "name": "Sprenger Food Safety Handbook",
      "trustLevel": "ACCREDITED_MATERIAL",
      "publisherOrg": "Highfield Publications",
      "authors": ["Richard A. Sprenger"],
      "edition": "37th Edition",
      "publicationYear": 2022,
      "_dbId": "uuid-from-db",
      "_validUntil": null
    }],
    "contract": "CONTENT_TRUST_V1"
  },
  "metadata": {
    "curriculum": {
      "type": "sequential",
      "moduleSelector": "section=content",
      "moduleOrder": "sortBySequence",
      "masteryThreshold": 0.7
    }
  },
  "modules": [
    {
      "id": "MOD-1",
      "name": "Food Safety Legislation",
      "content": {
        "points": [
          "The Food Safety Act 1990 creates offences...",
          "Due diligence defence requires..."
        ]
      },
      "sourceRefs": [
        {
          "sourceSlug": "sprenger-food-safety-handbook-37th",
          "ref": "Chapter 1: Food Safety Legislation",
          "trustLevel": "ACCREDITED_MATERIAL"
        },
        {
          "sourceSlug": "highfield-l2-food-safety-qual-spec",
          "ref": "Learning Outcome 1",
          "trustLevel": "REGULATORY_STANDARD"
        }
      ]
    }
  ]
}
```

**Fields prefixed with `_` are enriched from DB at save time.** They are not part of the spec's authored content but are merged in for runtime use.

---

## What the AI Sees

The trust transform builds this prompt section:

```
## CONTENT AUTHORITY

You are teaching CERTIFIED MATERIALS for Food Safety Level 2.

PRIMARY SOURCE: Highfield Level 2 Award (RQF) Qualification Specification [REGULATORY STANDARD]
  Publisher: Highfield Qualifications
  Accrediting Body: Ofqual (603/4937/2)
  Qualification: Highfield L2 Award

SECONDARY: Sprenger Food Safety Handbook (Richard A. Sprenger), 37th Edition [ACCREDITED MATERIAL]

TRUST RULES:
1. ONLY teach facts from your certified sources. When stating specific figures, cite the source.
2. If asked about something NOT in your materials, say: "That's outside what I can verify from the Highfield Level 2 Award. I'd recommend checking the official source directly."
3. NEVER invent statistics, thresholds, or regulatory details.
4. If content may be outdated, flag it: "This information may have been updated — always verify current figures."

REFERENCE CARD (Food Safety Legislation):
  Source: sprenger-food-safety-handbook-37th [Accredited Material] — Chapter 1: Food Safety Legislation
  Source: highfield-l2-food-safety-qual-spec [Regulatory Standard] — Learning Outcome 1
```

If sources are expiring:

```
VALIDITY WARNINGS:
  [EXPIRING] Primary source "Highfield Level 2 Award": Content expires in 45 days (2027-08-31).
```

---

## Trust-Weighted Progress

### Dual-Track Scoring

| Track | What Counts | Answers |
|-------|-------------|---------|
| **Certification Readiness** | Only L4+ content (weight ≥ 0.80) | "Is the learner ready for the exam?" |
| **General Understanding** | All content | "How well does the learner understand the topic?" |

### Computation

```typescript
// For each module with mastery recorded:
const weight = TRUST_WEIGHTS[moduleTrustLevel]; // e.g. 1.0 for L5
const countsToCertification = weight >= 0.80;   // L4+ only

// Certification track: weighted average of L4+ modules
certifiedMastery = Σ(mastery × weight) / Σ(weight)  // for L4+ modules only

// General track: weighted average of ALL modules
supplementaryMastery = Σ(mastery × weight) / Σ(weight)  // for all modules
```

### Storage

Uses CallerAttribute with `TRUST_PROGRESS` scope:

```
trust_progress:{specSlug}:certified_mastery = 0.72
trust_progress:{specSlug}:supplementary_mastery = 0.85
trust_progress:{specSlug}:certification_readiness = 0.68
```

---

## Supervision

### source_citation_score (SUPV-001)

Measures whether the AI cites sources when stating facts from L4+ content.

| Score | Meaning |
|-------|---------|
| 0.9-1.0 | Consistently cites sources when stating specific facts, figures, or rules |
| 0.7-0.8 | Usually cites sources for key facts, occasionally misses |
| 0.4-0.6 | Inconsistent citation; states facts without attribution |
| 0.0-0.3 | Rarely or never cites sources; presents information without provenance |

### TRUST-001 Spec (CONSTRAIN)

Acceptance criteria:

| ID | Criterion |
|----|-----------|
| AC-TRUST-1 | AI cites source when stating facts from L4+ content |
| AC-TRUST-2 | AI acknowledges gaps when content is outside curriculum |
| AC-TRUST-3 | AI flags potentially outdated content |
| AC-TRUST-4 | AI distinguishes supplementary (L1/L0) from certified (L4/L5) content |
| AC-TRUST-5 | AI refuses to invent facts outside curriculum |

Constraints:

| ID | Severity | Rule |
|----|----------|------|
| C-TRUST-1 | critical | Never invent regulatory facts, thresholds, or statistics |
| C-TRUST-2 | warning | Cite source slug when quoting specific figures |
| C-TRUST-3 | warning | Flag content approaching validity expiry |
| C-TRUST-4 | warning | Distinguish certified vs supplementary when both exist |

---

## User Journey

### 1. Admin: Register Sources

**Where:** `/x/content-sources` (sidebar → Configure → Sources)

Create `ContentSource` records for each authoritative material. Set trust level, publisher, validity dates, accreditation info. The page shows trust badges (color-coded L5→L0) and freshness indicators.

### 2. Admin: Configure CONTENT Spec

**Where:** `/x/specs` → select a CONTENT spec

The **Source Authority** panel (visible only for CONTENT specs) appears below the config JSON editor:

- **Primary Source** dropdown: select from registered ContentSource records
- **Secondary Sources** list: add/remove from registered sources
- Trust badges show next to each source
- "Manage sources in registry →" link to `/x/content-sources`

Selecting sources updates the config JSON. Saving validates against the DB.

### 3. Admin: Add sourceRefs to Modules

In the config JSON, add `sourceRefs` to each module that pin teaching points to specific chapters, sections, or learning outcomes of the registered sources.

### 4. Runtime: Learner Calls

The composition pipeline automatically:
- Loads the CONTENT spec with its sourceAuthority
- Determines the next module based on progress
- Builds trust context (authority header, rules, reference card)
- Injects into the LLM system prompt

### 5. Post-Call: Supervision & Progress

- Supervision scores `source_citation_score` and `tutor_fidelity_score`
- Module mastery is recorded in CallerAttributes
- Trust-weighted progress is computed (dual-track)

### 6. Ongoing: Freshness Management

When sources approach expiry (`validUntil` within 60 days):
- Admin sees amber/red indicators on `/x/content-sources`
- Trust transform injects VALIDITY WARNINGS into prompts
- Admin registers new source version, marks old as superseded, updates spec

---

## File Reference

### Core Implementation

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | ContentTrustLevel enum, ContentSource model, ContentAssertion model, Curriculum extensions |
| `lib/content-trust/validate-source-authority.ts` | Validation + enrichment of sourceAuthority against ContentSource DB |
| `lib/prompt/composition/transforms/trust.ts` | `computeTrustContext` transform (CONTENT AUTHORITY, reference cards, freshness) |
| `lib/prompt/composition/CompositionExecutor.ts` | `content_trust` section definition (priority 12.5, dependsOn: curriculum) |
| `lib/prompt/composition/renderPromptSummary.ts` | Renders trust section into final prompt text |
| `lib/curriculum/track-progress.ts` | `computeTrustWeightedProgress()`, `extractModuleTrustLevels()`, `storeTrustWeightedProgress()` |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/content-sources` | GET | List sources (with filtering by trustLevel, qualificationRef) |
| `/api/content-sources` | POST | Create new source |
| `/api/content-sources/available` | GET | Lightweight source list for picker UI |
| `/api/analysis-specs/[specId]` | PATCH | Validates + enriches sourceAuthority on config save |
| `/api/specs/create` | POST | Validates sourceAuthority on spec creation |
| `/api/specs/import` | POST | Validates sourceAuthority on spec import |

### Specs & Contracts

| File | Purpose |
|------|---------|
| `docs-archive/bdd-specs/contracts/CONTENT_TRUST_V1.contract.json` | Defines trust levels, weights, storage conventions, freshness rules |
| `docs-archive/bdd-specs/TRUST-001-content-trust.spec.json` | CONSTRAIN spec with acceptance criteria and constraints |
| `docs-archive/bdd-specs/SUPV-001-agent-supervision.spec.json` | Added `source_citation_score` parameter |
| `docs-archive/bdd-specs/CURR-FS-L2-001-food-safety-level2.spec.json` | Reference implementation (Food Safety L2 with sourceAuthority) |

### UI

| File | Purpose |
|------|---------|
| `app/x/content-sources/page.tsx` | Source registry admin page |
| `app/x/specs/page.tsx` | SourceAuthorityPanel component (CONTENT spec editor) |
| `lib/sidebar/sidebar-manifest.json` | "Sources" nav item in Configure section |
| `lib/sidebar/icons.ts` | ShieldCheck icon for Sources |

---

## Contracts

### CONTENT_TRUST_V1

Defines the trust system's conventions:

- **Trust levels**: 6 levels with weights and verification rules
- **Storage**: CallerAttribute key patterns for trust-weighted progress
- **Freshness**: Warning thresholds (60 days), expiry handling
- **Certification threshold**: weight ≥ 0.80 counts toward certification readiness

### CURRICULUM_PROGRESS_V1

Pre-existing contract that defines curriculum progress storage:

- Key pattern: `curriculum:{specSlug}:{key}`
- Storage keys: `currentModule`, `mastery:{moduleId}`, `lastAccessed`
- Used by `track-progress.ts` for standard progress tracking

Trust-weighted progress uses a separate scope (`TRUST_PROGRESS`) and key pattern (`trust_progress:{specSlug}:{key}`).

---

## Pending Work

### Phase 6: Admin UI Enhancements (COMPLETE)
- ✅ Freshness dashboard widget on `/x/specs` page (expired/expiring source alerts with link to manage)
- ✅ Trust-weighted progress display on caller page (dual bars: Certification Readiness + General Understanding, expandable module breakdown)
- ✅ `/api/callers/[callerId]/trust-progress` endpoint (computes dual-track progress across all curricula)
- ✅ Content verification queue at `/x/content-review` (review, promote/demote trust levels with audit trail)
- ✅ `/api/content-sources/[sourceId]` endpoint (GET detail, PATCH trust promotion with verification notes)

### Phase 7: Document Import (COMPLETE)
- ✅ PDF/text/markdown upload via `/api/content-sources/[sourceId]/import` (multipart form)
- ✅ AI-assisted extraction pipeline: text extraction → chunking → LLM assertion extraction → dedup
- ✅ `lib/content-trust/extract-assertions.ts` — text extraction (pdf-parse), chunking, AI prompting, hash dedup
- ✅ Preview mode (dry run) and import mode (saves to DB)
- ✅ Import tab on `/x/content-review` page with source selector, file upload, preview grid, and one-click import
- ✅ Assertions list endpoint: `/api/content-sources/[sourceId]/assertions` with filtering and pagination
- ✅ Bulk trust via source promotion — assertions inherit source trust level (null = inherit)

### Future
- ContentAssertion query at prompt composition time (specific verified facts in reference cards)
- Auto-detection of content changes when source is updated
- Cross-spec source sharing (multiple curricula referencing same source)
- Learner-facing "Certification Readiness" score (progressive disclosure)
