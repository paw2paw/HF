---
description: List all custom slash commands with descriptions
---

List all custom slash commands. Use a **single Bash call**:

```bash
for f in .claude/commands/*.md; do name=$(basename "$f" .md); [ "$name" = "qq" ] && continue; desc=$(sed -n 's/^description: *//p' "$f"); printf "%-16s %s\n" "/$name" "$desc"; done | sort
```

Print the output as a compact table. Do NOT include `/qq` itself.
