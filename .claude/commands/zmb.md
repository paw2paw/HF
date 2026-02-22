---
description: Kill zombie processes on hf-dev VM
---

Kill all zombie/stale node processes on the hf-dev VM and clean the .next cache. That's it — no restart, no tunnel.

## Kill zombies and clean cache

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "killall -9 node 2>/dev/null; rm -rf ~/HF/apps/admin/.next; rm -f /tmp/hf-dev.log; echo ZOMBIES_KILLED"
```

If exit code 255, wait 5 seconds and retry once.

Tell the user:
- All node processes killed, .next cache and dev log cleared
- To restart the dev server: `/zmb+` or `/vm-dev`
- To just open a tunnel: `/vm-tunnel`
