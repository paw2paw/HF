---
description: Start hf-dev VM dev server with SSH tunnel on localhost:3000
---

Start the Next.js dev server on the hf-dev GCP VM with an SSH tunnel forwarding port 3000 to localhost.

The dev server runs inside a **tmux session** so it survives SSH disconnects (laptop sleep, network blips). The tunnel is a separate connection that can be re-opened with `/vm-tunnel`.

## Step 1: Start dev server in tmux

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "tmux kill-session -t hf 2>/dev/null; pkill -9 -f 'node.*next' 2>/dev/null; rm -rf ~/HF/apps/admin/.next/dev/lock && tmux new-session -d -s hf 'cd ~/HF/apps/admin && npm run dev'"
```

This command:
1. Kills any existing `hf` tmux session and Next.js processes
2. Removes stale lock files
3. Starts the dev server inside a detached tmux session named `hf`

Wait ~3 seconds for the server to start, then proceed to step 2.

## Step 2: Open tunnel

Run this in the background:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- -L 3000:localhost:3000 -N
```

Tell the user:
- Server running at `http://localhost:3000`
- Dev server persists across SSH disconnects — use `/vm-tunnel` to reconnect
- To see server output: `gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "tmux attach -t hf"`
- To stop everything: `/vm-kill`

If port 3000 is still in use and Next.js falls back to 3001, tell the user to run `/vm-kill` first to fully clean up, then retry.

If the SSH connection fails, suggest:
```
gcloud compute ssh hf-dev --project=hf-admin-prod --zone=europe-west2-a --troubleshoot --tunnel-through-iap
```
