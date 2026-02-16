---
description: Read recent screenshots — pick how many to attach
---

Read recent screenshots and describe what you see.

If `$ARGUMENTS` is a number, use it directly as N and skip the question. Otherwise, ask using AskUserQuestion:

**Question:** "How many screenshots do you want to review?"
**Header:** "Screenshots"
**multiSelect:** false

Options:
1. **Last 1 (Recommended)** — Just the most recent screenshot
2. **Last 3** — Recent context
3. **Last 5** — Broader view

## Steps

1. Use the Glob tool to find screenshots:
   - Pattern: `*.png`
   - Path: `/Users/paulwander/Downloads/@Screens`
   - Glob results are sorted by modification time — take the LAST N entries (most recent).

2. Use the Read tool to read each image file. Claude Code reads images natively. Read all N images in parallel.

3. Describe what you see in each screenshot. If any show the HF project (UI, error, terminal), provide specific context — which page, what's wrong, what to do next. Label each screenshot with its filename and order (e.g. "Screenshot 1 of 3 (most recent)").

IMPORTANT: Do NOT use Bash for this. Use only Glob and Read tools — they require no permissions.
