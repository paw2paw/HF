---
description: Check hf-dev VM resources — CPU, RAM, disk, processes
---

Check the hf-dev GCP VM health and resource usage.

## 1. GCP Instance Info

Run these in parallel:

```bash
gcloud compute instances describe hf-dev --zone=europe-west2-a --project=hf-admin-prod --format="table(name,machineType.basename(),status,disks[0].diskSizeGb,scheduling.preemptible)"
```

```bash
gcloud compute disks describe hf-dev --zone=europe-west2-a --project=hf-admin-prod --format="yaml(name,sizeGb,type.basename(),status)"
```

## 2. Live VM Stats

Then SSH in to check live stats:

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "echo '=== MEMORY ===' && free -h && echo '=== DISK ===' && df -h / && echo '=== LOAD ===' && uptime && echo '=== TMUX ===' && tmux list-sessions 2>/dev/null || echo 'No tmux sessions' && echo '=== NODE PROCESSES ===' && pgrep -af node 2>/dev/null || echo 'No node processes running'"
```

## Output

Print a compact dashboard:

```
VM:        hf-dev (e2-standard-4)
Status:    RUNNING
vCPUs:     4
RAM:       16 GB (XX% used)
Disk:      200 GB SSD (XX% used)
Load:      X.XX
Tmux:      hf (running) / No sessions
Node:      Running / Not running
```

If memory > 80% or disk > 80%, flag it as a warning. If no node processes are running, suggest `/vm-dev` to start the server.
