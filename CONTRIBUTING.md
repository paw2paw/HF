## HF Execution Board – Card Template
  ## Summary
  <1–2 lines in plain English>

  ## BDD Source
  - File: bdd/features/<filename>.feature
  - Status: Draft / Stable / Executable

  ## Scenarios
  - [ ] Scenario: <name>
  - [ ] Scenario: <name>

  ## Service Boundaries
  - PromptComposer
  - CallLifecycle
  - PersonalityAnalysis
  - MemorySynthesiser

  ## Data Touchpoints
  - Call
  - Transcript
  - AnalysisRun
  - Memory

  ## Notes
  - Constraints
  - Open questions





# Contributing to HF (Browser-only workflow)

HF uses GitHub as the source of truth. Contributors work directly in the GitHub web interface.

## The one rule
Never edit `main` directly. Always work on a branch.

---

## 1) Start from `main`
1. Open the repo in GitHub.
2. Confirm the branch selector (top left) is set to `main`.

---

## 2) Create a branch (before editing anything)
1. Click the branch dropdown (it shows `main`).
2. Type a new branch name.
3. Press Enter to create the branch.

### Branch naming (keep it simple)
Use one of these prefixes:
- `docs/…` → documentation
- `bdd/…` → behaviour / tests
- `arch/…` → architecture
- `fix/…` → fixes

Examples:
- `docs/how-we-work`
- `bdd/evaluation-agent`
- `arch/baseline-generator`

---

## 3) Edit files (CRUD) in GitHub

### Edit an existing file
1. Open the file (e.g. `docs/01-system-description.md`).
2. Click the pencil icon (Edit).
3. Make your changes.
4. Scroll to “Commit changes”.

### Create a new file
1. Navigate to the target folder (e.g. `docs/adr/`).
2. Click **Add file → Create new file**.
3. Name the file (e.g. `ADR-002-title.md`).
4. Add content.
5. Commit the change.

### Delete a file (rare)
1. Open the file.
2. Use **… → Delete file**.
3. Commit the change.

---

## 4) Commit changes (required format)
When committing in GitHub:

### Commit message
Use:
`ID: short description`

Examples:
- `ARC-002: clarify runtime vs offline flow`
- `BDD-001: tighten acceptance criteria`
- `ADR-003: decide evaluation scoring model`

### Commit to branch
Always commit to your branch (not `main`).

---

## 5) Open a Pull Request (PR)
When ready for review (or feedback):

1. Go to the repo homepage (GitHub often shows “Compare & pull request”).
2. Create a PR:
   - Base: `main`
   - Compare: your branch
3. Fill in the PR description (a template will appear automatically).

Include:
- What changed
- Why
- Which IDs it relates to

---

## 6) Review and merge
- Reviewer checks that changes match the related artefacts/IDs and do not introduce drift.
- When approved:
  1. Merge the PR into `main` (prefer “Squash and merge”).
  2. Delete the branch.

---

## 7) After merge (required)
Update Notion:
- Set status (Done / In progress).
- Add the GitHub link to the merged file or PR.

That is the “sync”: Notion indexes; GitHub is authoritative.

---

## What NOT to do
- Do not edit `main` directly.
- Do not paste long specs into Notion.
- Do not rename artefact IDs casually.
- Do not work without a branch.

If unsure, ask.
