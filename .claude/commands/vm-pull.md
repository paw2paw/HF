---
description: Pull latest code on hf-dev VM, optionally restart dev server
---

Pull the latest code on the hf-dev GCP VM and optionally restart the dev server.

## 1. Pull

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "cd ~/HF && git pull --rebase && cd apps/admin && npm install --prefer-offline"
```

Report what changed (new commits, updated packages).

## 2. Ask about restart

Use AskUserQuestion to ask: "Restart the dev server?"

Options:
- **Yes** — Kill existing server and start fresh (runs `/vm-dev` flow)
- **No** — Just pull, don't restart

If yes, start dev server in tmux (survives disconnects):

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "tmux kill-session -t hf 2>/dev/null; pkill -9 -f 'node.*next' 2>/dev/null; rm -rf ~/HF/apps/admin/.next/dev/lock && tmux new-session -d -s hf 'cd ~/HF/apps/admin && npm run dev'"
```

Then open tunnel in the background:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- -L 3000:localhost:3000 -N
```

If there are merge conflicts, show them and stop — do NOT force resolve.
