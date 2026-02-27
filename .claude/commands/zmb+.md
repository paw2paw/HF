---
description: Kill zombies + restart dev server + open SSH tunnel
---

Full nuclear reset: kill all zombie processes on hf-dev VM, restart the Next.js dev server, and open the SSH tunnel — all in one go.

**IMPORTANT:** Do NOT use `pkill` anywhere in this command. Use `killall` + `fuser` for process cleanup.

## Step 1: Kill + clean + restart (single SSH call)

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- bash -c '
  echo "==> Killing zombies..."
  killall -9 node 2>/dev/null || true
  fuser -k 3000/tcp 2>/dev/null || true
  fuser -k 3001/tcp 2>/dev/null || true
  fuser -k 3002/tcp 2>/dev/null || true
  fuser -k 3003/tcp 2>/dev/null || true
  fuser -k 3004/tcp 2>/dev/null || true
  sleep 1
  rm -rf ~/HF/apps/admin/.next
  rm -f /tmp/hf-dev.log

  echo "==> Starting dev server..."
  nohup bash -c "cd ~/HF/apps/admin && npx next dev --port 3000" > /tmp/hf-dev.log 2>&1 &
  sleep 2
  echo "==> READY"
'
```

Using `--port 3000` ensures it fails loudly instead of silently falling back to 3001+.

If exit code 255, wait 3 seconds and retry once. If still failing, stop and suggest IAP troubleshooting (see bottom).

## Step 2: Kill stale tunnels and open new tunnel

Kill any existing SSH tunnels using `lsof` (NOT pkill), then open a fresh one:

```bash
lsof -ti:3000 | xargs kill 2>/dev/null; sleep 1
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- -L 3000:localhost:3000 -N
```

Run the tunnel in the background.

Tell the user:
- All zombies killed, ports freed, cache cleaned, dev server restarted
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
