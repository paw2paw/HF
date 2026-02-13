---
description: Show all HF Control CLI commands from cli/control.ts
---

List all CLI commands from `apps/admin/cli/control.ts`. Use a **single Bash call**:

```bash
grep -E '^\s*\.(command|description)\(' apps/admin/cli/control.ts | paste - - | sed "s/.*\.command('\([^']*\)').*/\1/" | sed "s/.*\.description('\([^']*\)'.*/\t\1/" | awk -F'\t' '{printf "  %-20s %s\n", $1, $2}'
```

Print the output as a compact table with header:

```
HF Control CLI (apps/admin/cli/control.ts)
Usage: npx tsx cli/control.ts <command>
```

Do NOT include the `menu` command (it's the default interactive mode).
