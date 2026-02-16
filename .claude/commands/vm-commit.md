---
description: Commit changes on hf-dev VM
---

Commit changes on the hf-dev GCP VM. First show the status, then commit with the user's message.

## 1. Check status

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a -- "cd ~/HF && git status --short"
```

Show the user what's changed. If there are no changes, tell them and stop.

## 2. Stage and commit

Ask the user for a commit message using AskUserQuestion if none was provided as an argument ($ARGUMENTS).

Then run:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a -- "cd ~/HF && git add -A && git commit -m '<message>'"
```

Report the result. Suggest `/vm-push` to push to remote.
