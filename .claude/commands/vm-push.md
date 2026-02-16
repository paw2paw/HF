---
description: Push commits from hf-dev VM to remote
---

Push commits from the hf-dev GCP VM to the remote repository.

## 1. Show what will be pushed

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a -- "cd ~/HF && git log --oneline origin/\$(git branch --show-current)..\$(git branch --show-current) 2>/dev/null || echo 'No upstream branch yet'"
```

Show the user the commits that will be pushed.

## 2. Push

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a -- "cd ~/HF && git push -u origin \$(git branch --show-current)"
```

Report success or failure. If the push is rejected, suggest `git pull --rebase` first (via `/vm-pull`).
