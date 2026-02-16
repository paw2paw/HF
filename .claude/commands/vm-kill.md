---
description: Kill stale processes and clean .next on hf-dev VM
---

Kill any stale Next.js/node processes and clean the `.next` cache on the hf-dev GCP VM.

Run this Bash command:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a -- "killall -9 node 2>/dev/null; rm -rf ~/HF/apps/admin/.next"
```

Report the result. If the SSH connection fails with exit code 255, suggest the user check IAP tunneling with:

```
gcloud compute ssh hf-dev --project=hf-admin-prod --zone=europe-west2-a --troubleshoot --tunnel-through-iap
```

On success, tell the user they can now start the dev server with `/vm-dev`.
