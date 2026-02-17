---
description: Commit locally + push + migrate + pull + restart on VM
---

Commit local changes, push to remote, then pull on the hf-dev VM with database migration and dev server restart. The full deploy-to-dev cycle.

## 1. Check local status

```bash
git status --short
```

Show the user what's changed. If there are no changes, tell them and stop.

## 2. Stage and commit

Show the diff summary (`git diff --stat`) so the user can see what's being committed.

Ask the user for a commit message using AskUserQuestion if none was provided as an argument ($ARGUMENTS).

Stage relevant files (avoid playwright-report, .env, credentials). Then commit:

```bash
git commit -m '<message>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>'
```

## 3. Push

```bash
git push
```

If the push is rejected, suggest `git pull --rebase` first.

## 4. Pull + install on VM

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "cd ~/HF && git pull --rebase && cd apps/admin && npm install --prefer-offline"
```

If the SSH command fails with exit code 255, wait 3 seconds and retry once. Report what changed.

## 5. Run migrations on VM

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "cd ~/HF/apps/admin && npx prisma migrate deploy"
```

Report migration results. If migrations fail, show the error and stop — do NOT proceed to restart.

## 6. Restart dev server

Kill existing server and start fresh:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "pkill -9 -f '[n]ext dev' 2>/dev/null; rm -rf ~/HF/apps/admin/.next/dev/lock; echo CLEANED"
```

Wait 5 seconds for IAP cooldown, then start the server:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "nohup bash -c 'cd ~/HF/apps/admin && npm run dev' > /tmp/hf-dev.log 2>&1 & echo STARTED"
```

Then open tunnel in the background:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- -L 3000:localhost:3000 -N
```

Report success. The full cycle is complete: committed, pushed, pulled, migrated, restarted.
