# HF – Ways of Working

## 1) Purpose
Define where artefacts live, how changes are made, and how we avoid drift between Notion and Git.

## 2) Sources of truth
**Git is authoritative** for anything that defines the system:
- System description, architecture, data model
- BDD specs, tests, fixtures
- Code, scripts, infra
- Interfaces/contracts with external services
- Architectural decisions (ADRs)

**Notion is an index + collaboration layer**:
- Roadmap, priorities, ownership, status
- Meeting notes and lightweight decisions
- Links to Git artefacts and summaries

Rule: if it’s implementation-defining, it must be in Git.

## 3) Artefact IDs
All major artefacts have stable IDs:
- SYS-### System
- ARC-### Architecture
- DAT-### Data
- BDD-### BDD/features
- ADR-### Decisions
- OPS-### Operations

Notion items must include **Artifact ID + Git Path**.

## 4) Git workflow
- Default: trunk-based (`main`)
- Work in short-lived branches and merge via PR where possible
- Commit messages: `ID: short description` (e.g. `SYS-001: define system scope`)
- Changes that alter architecture/contracts require an ADR

## 5) Notion workflow
Notion tracks:
- Status (Proposed / In progress / Blocked / Done)
- Owner
- Priority (P0/P1/P2)
- Links to Git paths and PRs
- Short summaries only

Notion does not replace Git; discrepancies resolve in favour of Git.

## 6) Definition of Done
A story is Done when:
- Acceptance criteria are met
- Relevant BDD scenario(s) exist and pass (where applicable)
- Code merged to `main`
- Notion updated (status + links)
- ADR added if a decision was made

## 7) Cadence
- Update Notion at end of each work session (or daily).
- Keep Git artefacts current as you work; do not defer core specs.