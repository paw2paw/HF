---
description: Kill zombies + restart dev server + open SSH tunnel
---

Full nuclear reset: kill all zombie processes on hf-dev VM, restart the Next.js dev server, and open the SSH tunnel — all in one go.

**IMPORTANT:** Do NOT use `pkill` anywhere in this command. Use `killall` for process cleanup.

## Step 1: Kill zombies and clean cache

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "killall -9 node 2>/dev/null; fuser -k 3000/tcp 2>/dev/null; fuser -k 3001/tcp 2>/dev/null; sleep 1; rm -rf ~/HF/apps/admin/.next; rm -f /tmp/hf-dev.log; echo ZOMBIES_KILLED"
```

If exit code 255, wait 5 seconds and retry once. If still failing, stop and suggest IAP troubleshooting (see bottom).

Wait 5 seconds for IAP cooldown before the next SSH connection.

## Step 2: Start dev server

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "nohup bash -c 'cd ~/HF/apps/admin && npm run dev' > /tmp/hf-dev.log 2>&1 & echo DEV_STARTED"
```

Wait ~5 seconds for the server to start, then proceed to step 3.

## Step 3: Kill stale tunnels and open new tunnel

Kill any existing SSH tunnels using `lsof` (NOT pkill), then open a fresh one:

```bash
lsof -ti:3000 | xargs kill 2>/dev/null; sleep 1
```

Then open the tunnel:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- -L 3000:localhost:3000 -N
```

Tell the user:
- All zombies killed, cache cleaned, dev server restarted
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
