---
description: Start hf-dev VM dev server with SSH tunnel on localhost:3000
---

Start the Next.js dev server on the hf-dev GCP VM with an SSH tunnel forwarding port 3000 to localhost.

Run this Bash command:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a -- -L 3000:localhost:3000 "cd ~/HF/apps/admin && pkill -9 -f 'node.*next' 2>/dev/null; rm -rf .next/dev/lock && npm run dev"
```

This command:
1. Kills any existing Next.js processes (targeted pattern to avoid killing the SSH session)
2. Removes stale lock files
3. Starts the dev server
4. Forwards port 3000 so Safari can access it at `http://localhost:3000`

If port 3000 is still in use and Next.js falls back to 3001, tell the user to run `/vm-kill` first to fully clean up, then retry.

If the SSH connection fails, suggest:
```
gcloud compute ssh hf-dev --project=hf-admin-prod --zone=europe-west2-a --troubleshoot --tunnel-through-iap
```
