---
description: Kill stale processes and clean .next on hf-dev VM
---

Kill any stale Next.js/node processes and clean the `.next` cache on the hf-dev GCP VM.

Run this Bash command:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "killall -9 node 2>/dev/null; fuser -k 3000/tcp 2>/dev/null; fuser -k 3001/tcp 2>/dev/null; fuser -k 3002/tcp 2>/dev/null; fuser -k 3003/tcp 2>/dev/null; fuser -k 3004/tcp 2>/dev/null; sleep 1; rm -rf ~/HF/apps/admin/.next; rm -f /tmp/hf-dev.log; echo CLEANED"
```

Report the result. If the SSH connection fails with exit code 255, wait 3 seconds and retry once. If still failing, suggest the user check IAP:

1. Test connectivity: `gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "echo hello"`
2. Check firewall: `gcloud compute firewall-rules list --filter="name~iap"`
3. If no rule: `gcloud compute firewall-rules create allow-iap-ssh --direction=INGRESS --action=ALLOW --rules=tcp:22 --source-ranges=35.235.240.0/20 --network=default`

On success, tell the user they can now start the dev server with `/vm-dev`.
