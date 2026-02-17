---
description: Commit locally + push + pull on VM
---

Commit local changes, push to remote, then pull on the hf-dev VM.

## 1. Check local status

```bash
git status --short
```

Show the user what's changed. If there are no changes, tell them and stop.

## 2. Auto version bump

```bash
cd apps/admin && npx tsx scripts/bump-version.ts
```

Report the version change (e.g. `Version: 0.5.0 -> 0.5.1`). Stage the bumped `package.json`.

## 3. Stage and commit

Show the diff summary (`git diff --stat`) so the user can see what's being committed.

Ask the user for a commit message using AskUserQuestion if none was provided as an argument ($ARGUMENTS).

Stage relevant files (avoid playwright-report, .env, credentials). Then commit:

```bash
git commit -m '<message>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>'
```

## 4. Push

```bash
git push
```

If the push is rejected, suggest `git pull --rebase` first.

## 5. Pull on VM

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "cd ~/HF && git pull --rebase && cd apps/admin && npm install --prefer-offline"
```

If the SSH command fails with exit code 255, wait 3 seconds and retry once.

Report what changed on the VM. Suggest `/vm-dev` if they want to restart the dev server.
