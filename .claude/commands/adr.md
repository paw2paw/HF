---
description: Record an Architecture Decision — creates a structured ADR in docs/decisions/. Use when making a significant technical choice that future-you should understand. Pass a title or describe the decision.
---

Record an Architecture Decision Record (ADR).

Ask the user using AskUserQuestion:

**Question:** "What decision are you recording?"
**Header:** "ADR"
**Options:**
1. **Technology choice** — Choosing a library, framework, or service (e.g. "use promptfoo for evals")
2. **Architectural pattern** — How components relate (e.g. "contract-based curriculum loading")
3. **Process decision** — How the team works (e.g. "one concern per commit")
4. **Rejection record** — Documenting what was NOT chosen and why

Gather from the user:
- **Title** — short imperative phrase (e.g. "Use contract-based curriculum over hardcoded spec loading")
- **Context** — what situation or problem led to this decision?
- **Decision** — what was decided, in one sentence
- **Consequences** — what becomes easier? what becomes harder?
- **Alternatives considered** — what else was evaluated and why rejected?

## Create the ADR file

Filename: `docs/decisions/YYYY-MM-DD-[kebab-title].md`

```bash
mkdir -p /Users/paulwander/projects/HF/docs/decisions
```

File format:
```markdown
# ADR: [Title]

**Date:** YYYY-MM-DD
**Status:** Accepted
**Deciders:** [names or "HF team"]

## Context

[What situation, problem, or constraint led to this decision?
What forces are at play? What were the constraints?]

## Decision

[The decision made, in one clear sentence.]

[2-3 sentences expanding on the reasoning.]

## Consequences

**Positive:**
- [What becomes easier or better]
- [What problems this solves]

**Negative / Trade-offs:**
- [What becomes harder]
- [What this commits us to]
- [What we give up]

## Alternatives considered

| Alternative | Why rejected |
|-------------|-------------|
| [option 1] | [reason] |
| [option 2] | [reason] |

## Related

- [Links to relevant code, issues, or other ADRs]
```

After creating the file:
```bash
git add docs/decisions/[filename].md
```

Tell the user: "ADR created at `docs/decisions/[filename].md`. Stage it with your next commit or run `git add docs/decisions/[filename].md` now."

If a `docs/decisions/` directory already has ADRs, list them briefly so the user can see the decision log building up.
