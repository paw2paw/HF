# HF

HF is the working repo for the HumanFirst project (clean restart).

## What this repo contains (source of truth)
All technical artefacts live here:
- System definition and architecture (`docs/`)
- Decisions (`docs/adr/`)
- Notion mapping (`notion/`)
- Backlog export (`backlog/`)

## Where collaboration happens
- Notion is used for planning, status, meeting notes, and links.
- Git is the single source of truth for specs, diagrams, data models, tests, and code.

## Quick links
- Ways of Working: `WORKING-AGREEMENT.md`
- System Description: `docs/01-system-description.md`
- Business Context: `docs/02-business-context.md`
- Notion Schema: `notion/notion-schema.md`
- Backlog Export: `backlog/backlog.csv`



HF – Collaborator Guide

What This Repository Is

HF is a behaviour-driven, memory-adaptive conversational system.

The system is defined by behaviour first, not by infrastructure or UI.

BDD is the source of truth.

If behaviour is correct, the system is correct.

⸻

What This Repository Is NOT
	•	Not UI-first
	•	Not infra-first
	•	Not database-driven
	•	Not a place to add logic without tests

⸻

Source of Truth

All behaviour lives in:

bdd/features/

These feature files define what the system does.

If a feature passes, behaviour is preserved.
If a feature fails, behaviour is broken — even if the app “looks fine”.

⸻

How to Work in This Repo

Rule 1 — Start With Behaviour

If you want to change or add functionality:
	1.	Add or update a BDD feature
	2.	Make the feature pass
	3.	Only then adjust services or infra if needed

No feature = no change.

⸻

Rule 2 — Services Must Be Pure

Core services must:
	•	Have no database access
	•	Have no HTTP calls
	•	Have no framework dependencies
	•	Be deterministic and testable in memory

Input → Output only.

⸻

Rule 3 — Infrastructure Is Optional

Docker and Postgres exist only for integration work.

BDD tests:
	•	Do NOT require Docker
	•	Do NOT require Postgres
	•	Do NOT require external services

If logic requires infra to test, it’s in the wrong place.

⸻

The HF Adaptive Loop (Do Not Break This)

The system always flows like this:

Call
→ Transcript
→ Analysis
→ Memory
→ Next Prompt

Every feature, service, and change must respect this loop.

⸻

Repository Structure (High Level)

bdd/
Defines behaviour (source of truth)

packages/core/services/
Pure domain logic

apps/
Optional UI / admin tools

.runtime/
Local machine state (ignored by git)

scripts/
Dev helpers

⸻

How to Add a New Feature (Correct Process)
	1.	Write a BDD scenario describing behaviour
	2.	Make the scenario executable
	3.	Implement or modify pure services to satisfy behaviour
	4.	Ensure all BDD tests pass

If BDD is green, the change is valid.

⸻

CI Expectations
	•	CI runs BDD tests only
	•	No infrastructure in CI
	•	All pull requests must pass BDD

⸻

Common Mistakes
	•	Adding logic without BDD coverage
	•	Mixing database logic into services
	•	Relying on infra for basic behaviour
	•	“Temporary” shortcuts

⸻

Guiding Principle

HF evolves by behaviour, not by accident.

If you respect the contracts, you can refactor aggressively and safely.

⸻
