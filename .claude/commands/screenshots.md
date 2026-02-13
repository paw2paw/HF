---
description: Read recent screenshots and describe what you see
---

Grab the most recent screenshots and describe what you see

Find the 3 most recent screenshots from ~/Desktop or ~/Downloads (whichever has newer files), read them, and describe what you see. If they appear to be from this project (UI pages, terminal output, error messages), provide relevant context.

## Steps

1. Find recent screenshots:
```bash
ls -t ~/Desktop/Screenshot*.png ~/Desktop/Screen*.png ~/Downloads/Screenshot*.png ~/Downloads/Screen*.png 2>/dev/null | head -5
```

2. Read each image file using the Read tool (Claude Code can read images natively).

3. For each screenshot, describe:
   - What it shows (UI page, error, terminal, browser)
   - If it's from the HF project, identify the page/component
   - Any errors, warnings, or issues visible
   - Suggested next action if a problem is visible

The user may also specify a folder path or number of screenshots as arguments.
