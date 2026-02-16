---
description: Full VM workflow — pull, commit, push, tunnel, start dev server (interactive menu)
---

Interactive hf-dev VM management. Ask the user what they want to do using AskUserQuestion:

**Question:** "What do you need on hf-dev?"

Options (multiSelect: true):
1. **Pull latest** — Pull from remote + npm install
2. **Start dev server** — Kill stale processes, start fresh with tunnel
3. **Commit & push** — Stage, commit, and push changes on VM
4. **Status check** — Show CPU, RAM, disk, running processes

Then execute the selected actions **in this order** (dependencies matter):

### If "Pull latest" selected:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "cd ~/HF && git pull --rebase && cd apps/admin && npm install --prefer-offline"
```

Report what changed. If there are merge conflicts, STOP and show them. If SSH fails with exit code 255, wait 3 seconds and retry once.

### If "Commit & push" selected:

First show status:
```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "cd ~/HF && git status --short"
```

If there are changes, ask for a commit message (AskUserQuestion), then:
```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "cd ~/HF && git add -A && git commit -m '<message>' && git push -u origin \$(git branch --show-current)"
```

### If "Status check" selected:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "echo '=== MEMORY ===' && free -h && echo '=== DISK ===' && df -h / && echo '=== LOAD ===' && uptime && echo '=== NODE PROCESSES ===' && pgrep -af node 2>/dev/null || echo 'No node processes running' && echo '=== DEV LOG (last 5) ===' && tail -5 /tmp/hf-dev.log 2>/dev/null || echo 'No log'"
```

Print a compact dashboard.

### If "Start dev server" selected (always run LAST):

**Step A:** Kill stale processes (use `pgrep` + `kill`, NOT `pkill -f` which can match and kill the SSH session itself):

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- 'pids=$(pgrep -f "next-server" 2>/dev/null); [ -n "$pids" ] && kill -9 $pids; rm -rf ~/HF/apps/admin/.next/dev/lock; echo CLEANED'
```

Wait 5 seconds for IAP cooldown.

**Step B:** Start dev server via nohup (survives SSH disconnects):

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "nohup bash -c 'cd ~/HF/apps/admin && npm run dev' > /tmp/hf-dev.log 2>&1 & echo STARTED"
```

Wait 5 seconds, then open tunnel in the background:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- -L 3000:localhost:3000 -N
```

Tell the user:
- Server running at `http://localhost:3000`
- Dev server persists across SSH disconnects — use `/vm-tunnel` to reconnect
- To see server output: `gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "tail -50 /tmp/hf-dev.log"`

### IAP troubleshooting

If SSH fails with exit code 255:
1. Wait 3-5 seconds and retry (IAP rate-limits rapid connections)
2. Test: `gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "echo hello"`
3. Check firewall: `gcloud compute firewall-rules list --filter="name~iap"`
4. If no rule: `gcloud compute firewall-rules create allow-iap-ssh --direction=INGRESS --action=ALLOW --rules=tcp:22 --source-ranges=35.235.240.0/20 --network=default`

### Common combo

If the user selects both "Pull latest" AND "Start dev server", run pull first, then start. This is the typical deploy-latest-and-go workflow.
