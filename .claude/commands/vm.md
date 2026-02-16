---
description: Full VM workflow — pull, commit, push, tunnel, start dev server (interactive menu)
---

Interactive hf-dev VM management. Ask the user what they want to do using AskUserQuestion:

**Question:** "What do you need on hf-dev?"

Options (multiSelect: true):
1. **Pull latest** — Pull from remote + npm install
2. **Start dev server** — Kill stale processes, clean .next, start fresh with tunnel
3. **Commit & push** — Stage, commit, and push changes on VM
4. **Status check** — Show CPU, RAM, disk, running processes

Then execute the selected actions **in this order** (dependencies matter):

### If "Pull latest" selected:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a -- "cd ~/HF && git pull --rebase && cd apps/admin && npm install --prefer-offline"
```

Report what changed. If there are merge conflicts, STOP and show them.

### If "Commit & push" selected:

First show status:
```bash
gcloud compute ssh hf-dev --zone=europe-west2-a -- "cd ~/HF && git status --short"
```

If there are changes, ask for a commit message (AskUserQuestion), then:
```bash
gcloud compute ssh hf-dev --zone=europe-west2-a -- "cd ~/HF && git add -A && git commit -m '<message>' && git push -u origin \$(git branch --show-current)"
```

### If "Status check" selected:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a -- "echo '=== MEMORY ===' && free -h && echo '=== DISK ===' && df -h / && echo '=== LOAD ===' && uptime && echo '=== NODE PROCESSES ===' && pgrep -af node 2>/dev/null || echo 'No node processes running'"
```

Print a compact dashboard.

### If "Start dev server" selected (always run LAST):

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a -- -L 3000:localhost:3000 "cd ~/HF/apps/admin && pkill -9 -f 'node.*next' 2>/dev/null; rm -rf .next/dev/lock && npm run dev"
```

This keeps the tunnel open — tell the user the server is at `http://localhost:3000`.

### Common combo

If the user selects both "Pull latest" AND "Start dev server", run pull first, then start. This is the typical deploy-latest-and-go workflow.
