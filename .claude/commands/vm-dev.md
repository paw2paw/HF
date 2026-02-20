---
description: Start hf-dev VM dev server with SSH tunnel on localhost:3000
---

Start the Next.js dev server on the hf-dev GCP VM with an SSH tunnel forwarding port 3000 to localhost.

The dev server runs via **nohup** so it survives SSH disconnects (laptop sleep, network blips). Logs go to `/tmp/hf-dev.log` on the VM. The tunnel is a separate connection that can be re-opened with `/vm-tunnel`.

## Step 1: Kill stale processes

**IMPORTANT:** Use the `[b]racket` trick in `pkill -f` patterns — without it, the pattern matches the SSH session's own command string and kills the connection (exit 255). `[n]ext` matches "next" but not the literal string "[n]ext" in the command line.

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "pkill -9 -f '[n]ext dev' 2>/dev/null; rm -rf ~/HF/apps/admin/.next/dev/lock; echo CLEANED"
```

Wait 5 seconds for IAP cooldown before the next SSH connection.

## Step 2: Start dev server

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "nohup bash -c 'cd ~/HF/apps/admin && npm run dev' > /tmp/hf-dev.log 2>&1 & echo STARTED"
```

This starts the dev server via nohup (survives SSH disconnect), logging to `/tmp/hf-dev.log`.

Wait ~5 seconds for the server to start, then proceed to step 3.

## Step 3: Kill stale tunnels and open new tunnel

**Always** kill any existing SSH tunnels before opening a new one — stale tunnels hold port 3000 and cause "address already in use" errors:

```bash
pkill -f "ssh.*hf-dev.*3000" 2>/dev/null; sleep 1
```

Then open the tunnel in the background:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- -L 3000:localhost:3000 -N
```

Tell the user:
- Server running at `http://localhost:3000`
- Dev server persists across SSH disconnects — use `/vm-tunnel` to reconnect
- To see server output: `gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "tail -50 /tmp/hf-dev.log"`
- To stop everything: `/vm-kill`

## IAP troubleshooting

IAP tunneling can be flaky with rapid consecutive SSH connections. If a command fails with exit code 255:
1. Wait 3-5 seconds and retry once
2. If still failing, try a simple test: `gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "echo hello"`
3. Check the IAP firewall rule exists: `gcloud compute firewall-rules list --filter="name~iap"`
4. If no rule, create one: `gcloud compute firewall-rules create allow-iap-ssh --direction=INGRESS --action=ALLOW --rules=tcp:22 --source-ranges=35.235.240.0/20 --network=default`

If port 3000 is still in use and Next.js falls back to 3001, tell the user to run `/vm-kill` first to fully clean up, then retry.
