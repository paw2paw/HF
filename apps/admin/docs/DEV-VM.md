# Dev VM (GCP)

Cloud-based development environment on a GCE VM in the same VPC as Cloud SQL.

## Resources

| Resource | Detail |
|----------|--------|
| VM | `hf-dev` (e2-standard-4, 4 vCPU, 16 GB RAM) |
| Disk | 200 GB pd-ssd |
| Zone | europe-west2-a |
| Network | Private IP only (`--no-address`), same VPC as Cloud SQL |
| NAT | `hf-nat` on `hf-router` for outbound internet |
| DB | Cloud SQL `hf-db` at `172.23.0.3:5432` |
| Project | `hf-admin-prod` |

## Daily Commands

```bash
# Start VM (~10s boot)
gcloud compute instances start hf-dev --zone=europe-west2-a

# SSH in
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap

# SSH with port forwarding (for browser access to localhost:3000)
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap \
  -- -L 3000:localhost:3000

# Start dev server (on the VM)
cd ~/HF/apps/admin && npm run dev

# Stop VM when done (~$0.28/day stopped, ~$0.17/hr running)
gcloud compute instances stop hf-dev --zone=europe-west2-a
```

## VS Code Remote SSH

Add to `~/.ssh/config` on your Mac:

```
Host hf-dev
  HostName hf-dev
  User paul_thewanders_com
  ProxyCommand gcloud compute start-iap-tunnel %h %p --listen-on-stdin --zone=europe-west2-a --project=hf-admin-prod
  IdentityFile ~/.ssh/google_compute_engine
```

Then in VS Code: **Remote-SSH: Connect to Host...** → `hf-dev` → open `~/HF`.

## File Locations (on VM)

| Path | Content |
|------|---------|
| `~/HF/` | Repository clone |
| `~/HF/apps/admin/.env.local` | Secrets (DATABASE_URL, API keys) |
| `~/HF/apps/admin/.env` | Defaults (committed) |

## Pulling Latest Code

```bash
cd ~/HF
git pull origin NGLOAF-2-13   # or whatever branch
cd apps/admin && npm install   # if dependencies changed
```

## Secrets

DATABASE_URL and other secrets are stored in GCP Secret Manager. To refresh:

```bash
# View available secrets
gcloud secrets list --project=hf-admin-prod

# Read a secret
gcloud secrets versions access latest --secret=DATABASE_URL --project=hf-admin-prod

# Update .env.local with latest DATABASE_URL
echo "DATABASE_URL=\"$(gcloud secrets versions access latest --secret=DATABASE_URL --project=hf-admin-prod)\"" >> ~/HF/apps/admin/.env.local
```

## Infrastructure Setup (one-time, already done)

```bash
# VM
gcloud compute instances create hf-dev \
  --zone=europe-west2-a \
  --machine-type=e2-standard-4 \
  --boot-disk-size=200GB \
  --boot-disk-type=pd-ssd \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --no-address \
  --tags=hf-dev

# Cloud NAT (for outbound internet without external IP)
gcloud compute routers create hf-router \
  --region=europe-west2 --network=default --project=hf-admin-prod
gcloud compute routers nats create hf-nat \
  --router=hf-router --region=europe-west2 \
  --auto-allocate-nat-external-ips \
  --nat-all-subnet-ip-ranges --project=hf-admin-prod

# Node.js (on the VM)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Git auth (on the VM)
gcloud auth login
git config --global credential.helper gcloud
```

## Cost

| State | Cost |
|-------|------|
| Running (e2-standard-4) | ~$0.17/hr |
| Stopped (200GB SSD disk) | ~$0.56/day |
| Monthly (8hr/day, 20 days) | ~$44 |
