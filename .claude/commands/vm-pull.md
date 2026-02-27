---
description: Pull latest code on hf-dev VM, optionally restart dev server
---

Pull the latest code on the hf-dev GCP VM and optionally restart the dev server.

## 1. Pull + install (single SSH call)

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- bash -c '
  cd ~/HF && git pull --rebase && cd apps/admin && npm install --prefer-offline
'
```

Report what changed (new commits, updated packages). If the SSH command fails with exit code 255, wait 3 seconds and retry once.

If there are merge conflicts, show them and stop — do NOT force resolve.

## 2. Ask about restart

Use AskUserQuestion to ask: "Restart the dev server?"

Options:
- **Yes** — Kill existing server and start fresh
- **No** — Just pull, don't restart

If **No**, stop here.

If **Yes**, kill + restart + tunnel in **one SSH call + tunnel**:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- bash -c '
  echo "==> Restarting dev server..."
  killall -9 node 2>/dev/null || true
  fuser -k 3000/tcp 2>/dev/null || true
  fuser -k 3001/tcp 2>/dev/null || true
  fuser -k 3002/tcp 2>/dev/null || true
  sleep 1
  rm -rf ~/HF/apps/admin/.next/dev/lock
  nohup bash -c "cd ~/HF/apps/admin && npm run dev" > /tmp/hf-dev.log 2>&1 &
  sleep 2
  echo "==> STARTED"
'
```

Then open tunnel in the background:

```bash
lsof -ti:3000 | xargs kill 2>/dev/null; sleep 1
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- -L 3000:localhost:3000 -N
```
