---
description: Read N most recent screenshots (default 1)
---

Read the N most recent screenshots and describe what you see. N = $ARGUMENTS (default 1).

1. Parse the argument: if "$ARGUMENTS" is a number, use it as N. If blank or non-numeric, default to N=1.

2. Use the Glob tool to find screenshots:
   - Pattern: `*.png`
   - Path: `/Users/paulwander/Downloads/@Screens`
   - Glob results are sorted by modification time — take the LAST N entries (most recent).

3. Use the Read tool to read each image file. Claude Code reads images natively. Read all N images in parallel.

4. Describe what you see in each screenshot. If any show the HF project (UI, error, terminal), provide specific context — which page, what's wrong, what to do next. Label each screenshot with its filename and order (e.g. "Screenshot 1 of 3 (most recent)").

IMPORTANT: Do NOT use Bash for this. Use only Glob and Read tools — they require no permissions.
