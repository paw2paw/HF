---
description: Open SSH tunnel to hf-dev VM on localhost:3000
---

Open an SSH tunnel to the hf-dev GCP VM, forwarding port 3000 to localhost. Does NOT start or restart the dev server — just connects to whatever is already running.

Run this Bash command in the background:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- -L 3000:localhost:3000 -N
```

The `-N` flag means no remote command — just the tunnel.

Tell the user:
- Tunnel open at `http://localhost:3000`
- If nothing is running on the VM, use `/vm-dev` to start the dev server
- To check what's running: `gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "pgrep -af node 2>/dev/null || echo 'No node processes'"`

If the SSH connection fails with exit code 255, wait 3 seconds and retry once. If still failing, check the IAP firewall rule: `gcloud compute firewall-rules list --filter="name~iap"`
