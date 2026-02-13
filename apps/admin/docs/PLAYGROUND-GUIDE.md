# Prompt Engineering Tools

> Tools for developing, comparing, and validating prompts

---

## Overview

Three specialized tools for different stages of prompt engineering:

| Tool | Purpose | Primary Entity |
|------|---------|----------------|
| **Prompt Tuner** | Tune prompt output for one caller | Caller-first |
| **Compare Configs** | A/B compare two playbook configurations | Caller + 2 configs |
| **Validate Playbook** | Test playbook across multiple callers | Playbook-first |

Plus **Run History** to inspect past composition runs.

---

## Prompt Tuner

Your workbench for testing and refining AI prompts. It lets you:

- **Select any caller** and see their full context
- **Generate prompts** using the current playbook configuration
- **Toggle specs on/off** and instantly see how the prompt changes
- **Compare versions** with a built-in diff viewer
- **Review transcripts** to understand caller history

The goal: **tight iteration loops** so you can quickly experiment with spec combinations and see results.

---

## The Core Loop

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│    Select      Generate      Review       Toggle Specs      │
│    Caller  ──▶  Prompt   ──▶ Output  ──▶  (auto-regen)     │
│       ▲                                        │            │
│       │                                        │            │
│       └────────────────────────────────────────┘            │
│                    Iterate                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Screen Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HEADER                                                                  │
│  [Search callers...]     [Domain ▾]     [Playbook ▾]     [Generate]     │
├───────────────────┬──────────────────────────────────────────────────────┤
│                   │                                                      │
│  SPECS PANEL      │  OUTPUT PANEL                                        │
│                   │                                                      │
│  🔒 System        │  Quick Start preview                                 │
│   • Core specs    │  Generated prompt sections                           │
│   • Always on     │  Diff viewer (what changed)                          │
│                   │                                                      │
│  ✏️ Playbook      │                                                      │
│   ◉ Enabled       │                                                      │
│   ○ Disabled      │                                                      │
│                   │                                                      │
├───────────────────┴──────────────────────────────────────────────────────┤
│  TRANSCRIPT DRAWER                                              [▲ Hide] │
│  Call history with full conversation view                                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Guide

### 1. Select a Caller

Click the **search box** in the header and start typing. You can search by:
- Name
- Email
- Phone number
- External ID

The dropdown shows each caller's **call count** and **domain** (if assigned).

**Tip:** The most recent callers with the most calls are good test subjects.

---

### 2. Check Domain Assignment

If a caller has **no domain**, you'll see a yellow warning:

```
⚠️ This caller has no domain assigned. Attach one to use playbook specs.
   [Attach to domain... ▾]
```

Select a domain to enable playbook-based prompt generation. This also auto-assigns goals from the domain's published playbook.

---

### 3. Generate a Prompt

Click the purple **Generate** button. The system will:

1. Load caller context (memories, personality, targets, recent calls)
2. Run the composition pipeline with all enabled specs
3. Display the result in the output panel

**Loading time:** Usually 2-5 seconds depending on caller complexity.

---

### 4. Review the Output

The output panel has two view modes (toggle in top-right):

| Mode | Shows |
|------|-------|
| **Sections** | Formatted view with `_quickStart`, prose prompt, and key sections |
| **Raw** | Full JSON structure sent to the AI |

#### Quick Start Preview

The `_quickStart` section gives a snapshot:
- **you_are** — The agent's identity
- **this_caller** — Who they're talking to
- **this_session** — What this conversation is about
- **learner_goals** — What the caller is working toward

#### Copy Button

Click **Copy** to copy the current output to your clipboard.

---

### 5. Toggle Specs

The left panel shows all available specs in two groups:

#### System Specs (🔒)
These are **always enabled** and cannot be toggled. They provide core functionality like safety rails and base context.

#### Playbook Specs (✏️)
These can be **toggled on/off**. Click any spec to toggle it.

**Auto-regenerate:** When you toggle a spec, the prompt automatically regenerates after a 400ms delay. This lets you rapidly experiment.

---

### 6. Compare with Diff View

After your first generation, subsequent generations show a **Diff panel**:

```
┌─ 🔄 Changes (2) ────────────────────────┐
│  + personalityAnalysis (added)          │
│  ~ behaviorTargets (modified)           │
│  - advancedContent (removed)            │
└─────────────────────────────────────────┘
```

Color coding:
- 🟢 **Green (+)** — Section was added
- 🟡 **Yellow (~)** — Section was modified
- 🔴 **Red (-)** — Section was removed

Toggle the **Diff** button to show/hide this panel.

---

### 7. Review Transcripts

Click the **Transcript** bar at the bottom to expand the drawer.

#### Features:
- **Call tabs** — Switch between recent calls (shows last 5)
- **Chat view** — User messages on left (gray), AI messages on right (blue)
- **Resize** — Drag the top edge to adjust height

#### Why review transcripts?

Transcripts help you understand:
- What topics this caller discusses
- How the AI has been responding
- Whether the generated prompt matches the conversation style

---

## Workflow Tips

### Testing a New Spec

1. Find a caller with several calls (good test data)
2. Generate a baseline prompt with current settings
3. Toggle your new spec ON
4. Compare the diff to see what changed
5. Review if the changes align with spec intent
6. Toggle OFF to confirm it reverts correctly

### Finding Edge Cases

1. Search for callers with unusual characteristics:
   - No domain assigned
   - Very few calls (cold start)
   - Many calls (lots of context)
2. Generate prompts for each
3. Check if the prompt handles edge cases gracefully

### Comparing Playbooks

1. Select a caller
2. Generate with Playbook A
3. Switch to Playbook B in the dropdown
4. Generate again
5. Review the diff to see differences

---

## Spec Types Reference

| Badge | Type | Purpose |
|-------|------|---------|
| 🎭 Identity | IDENTITY | Defines WHO the agent is |
| 📖 Content | CONTENT | Defines WHAT the agent knows |
| 👤 Context | CONTEXT | Caller-specific context |
| 🗣️ Voice | VOICE | Defines HOW the agent speaks |
| 🧠 Learn | LEARN | Extracts caller data |
| 📊 Measure | MEASURE | Scores behavior |
| 🔄 Adapt | ADAPT | Computes personalized targets |
| ✍️ Compose | COMPOSE | Builds prompt sections |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close caller dropdown |
| `Enter` | Select highlighted caller |

---

## Troubleshooting

### "No prompt generated yet"
You need to select a caller AND click Generate.

### "This caller has no domain"
Attach a domain using the dropdown in the warning message.

### Prompt looks incomplete
Check that the relevant specs are enabled in the left panel.

### Diff shows many changes
This is normal if you toggled multiple specs or switched playbooks.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│  PLAYGROUND QUICK REFERENCE                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Search & select a caller                                │
│  2. Click Generate                                          │
│  3. Toggle specs → auto-regenerates in 400ms                │
│  4. Check Diff panel for changes                            │
│  5. Expand transcript drawer for context                    │
│                                                             │
│  View modes: Sections | Raw                                 │
│  Copy button: Top-right of output panel                     │
│  Drawer resize: Drag the top edge                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

*Last updated: February 2026*
