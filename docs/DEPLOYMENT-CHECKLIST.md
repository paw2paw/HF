# HF Deployment Checklist

Step-by-step checklist for deploying HF to cloud servers.

**Use this with**: [DEPLOYMENT-ENVIRONMENTS.md](DEPLOYMENT-ENVIRONMENTS.md) (full guide)

---

## Pre-Flight Checklist

- [ ] Read [DEPLOYMENT-ENVIRONMENTS.md](DEPLOYMENT-ENVIRONMENTS.md)
- [ ] Have cloud provider account (DigitalOcean, AWS, Hetzner, etc.)
- [ ] Have domain name registered
- [ ] Have OpenAI API key
- [ ] Have Anthropic API key (optional)
- [ ] Local machine has Docker, Git, SSH client

---

## Phase 1: Server Provisioning

### DEV Server

- [ ] Provision server (2 vCPU, 4GB RAM)
- [ ] Note IP address: `___________________`
- [ ] SSH access working: `ssh root@DEV_IP`
- [ ] Update system: `apt update && apt upgrade -y`
- [ ] Install Docker: `curl -fsSL https://get.docker.com | sh`
- [ ] Install Docker Compose: `apt install docker-compose-plugin -y`
- [ ] Create user: `useradd -m -s /bin/bash hf && usermod -aG docker hf`
- [ ] Create directories: `mkdir -p /opt/hf/{backups,knowledge,logs,ssl}`
- [ ] Set ownership: `chown -R hf:hf /opt/hf`
- [ ] Setup firewall: `ufw allow 22,80,443/tcp && ufw --force enable`
- [ ] Copy SSH key: `ssh-copy-id hf@DEV_IP`
- [ ] Test SSH as hf: `ssh hf@DEV_IP`

### TEST Server

- [ ] Provision server (2 vCPU, 4GB RAM)
- [ ] Note IP address: `___________________`
- [ ] Repeat all DEV server steps above

### PROD Server

- [ ] Provision server (4 vCPU, 8GB RAM minimum)
- [ ] Note IP address: `___________________`
- [ ] Repeat all DEV server steps above

---

## Phase 2: DNS Configuration

- [ ] Create A record: `dev.yourdomain.com` → DEV_IP
- [ ] Create A record: `test.yourdomain.com` → TEST_IP
- [ ] Create A record: `app.yourdomain.com` → PROD_IP
- [ ] Wait for DNS propagation (check with `dig dev.yourdomain.com`)

---

## Phase 3: SSL Certificates

### DEV Server

- [ ] SSH into DEV: `ssh hf@dev.yourdomain.com`
- [ ] Install certbot: `sudo apt install certbot -y`
- [ ] Get certificate:
  ```bash
  sudo certbot certonly --standalone \
    -d dev.yourdomain.com \
    --non-interactive --agree-tos \
    --email your-email@example.com
  ```
- [ ] Copy to /opt/hf/ssl:
  ```bash
  sudo mkdir -p /opt/hf/ssl
  sudo cp /etc/letsencrypt/live/dev.yourdomain.com/fullchain.pem /opt/hf/ssl/
  sudo cp /etc/letsencrypt/live/dev.yourdomain.com/privkey.pem /opt/hf/ssl/
  sudo chown -R hf:hf /opt/hf/ssl
  ```
- [ ] Setup auto-renewal cron job

### TEST Server

- [ ] Repeat SSL steps for `test.yourdomain.com`

### PROD Server

- [ ] Repeat SSL steps for `app.yourdomain.com`

---

## Phase 4: Configuration Files

### Generate Secrets

On your **local machine**:

```bash
# For DEV
echo "DEV_POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "DEV_SUPERADMIN_TOKEN=$(openssl rand -hex 32)"

# For TEST
echo "TEST_POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "TEST_SUPERADMIN_TOKEN=$(openssl rand -hex 32)"

# For PROD
echo "PROD_POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "PROD_SUPERADMIN_TOKEN=$(openssl rand -hex 32)"
```

- [ ] Save these values in password manager

### DEV Server Configuration

- [ ] SSH into DEV: `ssh hf@dev.yourdomain.com`
- [ ] Create `/opt/hf/.env`:
  ```bash
  nano /opt/hf/.env
  ```
  ```env
  POSTGRES_DB=hf_dev
  POSTGRES_USER=hf_user
  POSTGRES_PASSWORD=PASTE_DEV_PASSWORD_HERE
  HF_SUPERADMIN_TOKEN=PASTE_DEV_TOKEN_HERE
  OPENAI_API_KEY=sk-your-openai-key
  ANTHROPIC_API_KEY=sk-ant-your-key
  NEXT_PUBLIC_APP_URL=https://dev.yourdomain.com
  DOCKER_IMAGE=ghcr.io/YOUR_ORG/hf-admin:develop
  ```
- [ ] Create `/opt/hf/docker-compose.yml` (copy from DEPLOYMENT-ENVIRONMENTS.md)
- [ ] Create `/opt/hf/nginx.conf` (copy from DEPLOYMENT-ENVIRONMENTS.md)
- [ ] Verify files exist: `ls -la /opt/hf/`

### TEST Server Configuration

- [ ] Repeat for TEST with:
  - TEST passwords/tokens
  - `NEXT_PUBLIC_APP_URL=https://test.yourdomain.com`
  - `DOCKER_IMAGE=ghcr.io/YOUR_ORG/hf-admin:main`

### PROD Server Configuration

- [ ] Repeat for PROD with:
  - PROD passwords/tokens
  - `NEXT_PUBLIC_APP_URL=https://app.yourdomain.com`
  - `DOCKER_IMAGE=ghcr.io/YOUR_ORG/hf-admin:v1.0.0`

---

## Phase 5: Container Registry Setup

- [ ] Create GitHub Container Registry token:
  1. GitHub → Settings → Developer settings → Personal access tokens
  2. Generate new token (classic)
  3. Select scope: `write:packages`, `read:packages`
  4. Save token

- [ ] Login to registry on each server:
  ```bash
  echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
  ```

---

## Phase 6: Initial Deployment - DEV

> **IMPORTANT**: The production Docker image (`runner` target) cannot run seeds.
> Use the separate `seed` and `migrate` Docker targets, or seed via SSH tunnel.
> See [CLOUD-DEPLOYMENT.md](CLOUD-DEPLOYMENT.md) for full data architecture details.

- [ ] SSH into DEV: `ssh hf@dev.yourdomain.com && cd /opt/hf`
- [ ] Pull Docker images: `docker compose pull`
- [ ] Start services: `docker compose up -d`
- [ ] Wait for startup: `docker compose logs -f app` (wait for "ready on...")
- [ ] Run migrations (choose one):
  - Via migrate image: `docker run --rm --network hf_default --env DATABASE_URL=... hf-admin-migrate`
  - Via SSH tunnel from local: `DATABASE_URL=... npx prisma migrate deploy`
- [ ] Seed database (choose one):
  - Via seed image: `docker run --rm --network hf_default --env DATABASE_URL=... hf-admin-seed`
  - Via SSH tunnel from local: `DATABASE_URL=... npx tsx prisma/seed-clean.ts`
- [ ] Seed domains:
  - Via seed image: `docker run --rm --network hf_default --env DATABASE_URL=... hf-admin-seed npx tsx prisma/seed-domains.ts`
  - Via SSH tunnel from local: `DATABASE_URL=... npx tsx prisma/seed-domains.ts`
- [ ] Verify seed counts (see CLOUD-DEPLOYMENT.md verification checklist)
- [ ] Create admin user
- [ ] Save admin credentials in password manager
- [ ] Test health: `curl https://dev.yourdomain.com/api/health`
- [ ] Test onboarding: `curl https://dev.yourdomain.com/api/onboarding` (should return `source: "database"`)
- [ ] Test UI: Open `https://dev.yourdomain.com` in browser
- [ ] Login with admin credentials
- [ ] Verify callers page loads
- [ ] Verify data dictionary shows parameters

### Create Deployment Script

- [ ] Create `/opt/hf/deploy.sh` (copy from DEPLOYMENT-ENVIRONMENTS.md)
- [ ] Make executable: `chmod +x /opt/hf/deploy.sh`
- [ ] Test deployment: `./deploy.sh`

### Create Backup Script

- [ ] Create `/opt/hf/backup.sh` (copy from DEPLOYMENT-ENVIRONMENTS.md)
- [ ] Make executable: `chmod +x /opt/hf/backup.sh`
- [ ] Test backup: `./backup.sh`
- [ ] Setup cron: `crontab -e`
  ```
  0 2 * * * /opt/hf/backup.sh >> /opt/hf/logs/backup.log 2>&1
  ```

### Create Health Check Script

- [ ] Create `/opt/hf/health-check.sh` (copy from DEPLOYMENT-ENVIRONMENTS.md)
- [ ] Make executable: `chmod +x /opt/hf/health-check.sh`
- [ ] Test: `./health-check.sh`

---

## Phase 7: Initial Deployment - TEST

- [ ] Repeat all Phase 6 steps on TEST server
- [ ] Use TEST configuration values
- [ ] Import production-like data instead of seed

---

## Phase 8: Initial Deployment - PROD

- [ ] **TAKE EXTRA CARE** - This is production!
- [ ] Repeat all Phase 6 steps on PROD server
- [ ] Use PROD configuration values
- [ ] Import actual production data (if migrating)
- [ ] OR start fresh with `npm run bootstrap-admin`
- [ ] Verify ALL health checks pass
- [ ] Monitor logs for 30 minutes: `docker compose logs -f app`

---

## Phase 9: CI/CD Setup

### GitHub Repository Secrets

- [ ] Go to GitHub repo → Settings → Secrets and variables → Actions
- [ ] Add secrets:
  - [ ] `SSH_PRIVATE_KEY` (your SSH private key)
  - [ ] `DEV_HOST` (dev.yourdomain.com or IP)
  - [ ] `TEST_HOST` (test.yourdomain.com or IP)

### GitHub Actions Workflow

- [ ] Create `.github/workflows/deploy.yml` in your repository
- [ ] Copy workflow from DEPLOYMENT-ENVIRONMENTS.md
- [ ] Update `IMAGE_NAME` to match your org/repo
- [ ] Commit and push

### Test CI/CD

- [ ] Make a small change on `develop` branch
- [ ] Push: `git push origin develop`
- [ ] Check GitHub Actions tab
- [ ] Verify auto-deployment to DEV works
- [ ] Check DEV server: `ssh hf@dev.yourdomain.com 'docker compose logs app --tail 50'`

---

## Phase 10: Monitoring & Alerts

### Basic Monitoring

- [ ] Create `/opt/hf/monitor.sh` (copy from DEPLOYMENT-ENVIRONMENTS.md)
- [ ] Make executable: `chmod +x /opt/hf/monitor.sh`
- [ ] Test: `./monitor.sh`

### Email Alerts (Optional)

- [ ] Install mailutils: `sudo apt install mailutils -y`
- [ ] Configure for your email provider
- [ ] Setup health check alerts:
  ```bash
  crontab -e
  # Add:
  */5 * * * * /opt/hf/health-check.sh || echo "Health check failed on $(hostname)" | mail -s "HF Alert" admin@example.com
  ```

### External Monitoring (Recommended)

- [ ] Setup UptimeRobot or similar for:
  - [ ] `https://dev.yourdomain.com/api/health`
  - [ ] `https://test.yourdomain.com/api/health`
  - [ ] `https://app.yourdomain.com/api/health`

---

## Phase 11: Documentation

- [ ] Document your specific configuration
- [ ] Update this checklist with any deviations
- [ ] Document admin credentials location
- [ ] Document backup procedure
- [ ] Document rollback procedure
- [ ] Share with team

---

## Phase 12: Testing & Validation

### DEV Environment

- [ ] Create test caller
- [ ] Upload test transcript
- [ ] Run pipeline
- [ ] Verify scores generated
- [ ] Check prompt composition
- [ ] Test AI assistant

### TEST Environment

- [ ] Repeat all DEV tests
- [ ] Import production-like data
- [ ] Run full regression tests
- [ ] Performance testing
- [ ] Security scan

### PROD Environment

- [ ] Smoke tests only (don't create test data)
- [ ] Verify existing users can login
- [ ] Verify existing data loads correctly
- [ ] Monitor for 24 hours

---

## Ongoing Maintenance Checklist

### Daily

- [ ] Check health endpoints
- [ ] Review error logs
- [ ] Monitor disk usage

### Weekly

- [ ] Review backup logs
- [ ] Test backup restore (on DEV)
- [ ] Review security updates

### Monthly

- [ ] Rotate API keys (if required)
- [ ] Review and prune old backups
- [ ] Update SSL certificates (if not auto-renewing)
- [ ] Security audit

---

## Deployment Workflow Going Forward

### Making Changes

1. **Develop locally**:
   ```bash
   cd ~/projects/HF/apps/admin
   npm run dev
   ```

2. **Push to DEV**:
   ```bash
   git push origin develop  # Auto-deploys to DEV
   ```

3. **Test on DEV**:
   - Verify changes work
   - Run tests
   - Check logs

4. **Promote to TEST**:
   ```bash
   git checkout main
   git merge develop
   git push origin main  # Auto-deploys to TEST
   ```

5. **Validate on TEST**:
   - Full regression testing
   - Performance testing
   - Security checks

6. **Release to PROD**:
   ```bash
   git tag v1.x.x
   git push --tags  # Builds image
   ```
   Then manually deploy:
   ```bash
   ssh hf@app.yourdomain.com
   cd /opt/hf
   # Update .env with new tag
   ./backup.sh  # Backup first!
   ./deploy.sh
   # Monitor for 30 minutes
   ```

---

## Rollback Procedure

If deployment fails:

1. **Stop app**:
   ```bash
   docker compose stop app
   ```

2. **Restore database** (if migration failed):
   ```bash
   gunzip -c /opt/hf/backups/LATEST_BACKUP.sql.gz | \
     docker compose exec -T postgres psql -U hf_user hf
   ```

3. **Rollback to previous image**:
   ```bash
   nano /opt/hf/.env  # Change DOCKER_IMAGE to previous version
   docker compose up -d app
   ```

4. **Verify**:
   ```bash
   ./health-check.sh
   docker compose logs -f app
   ```

---

## Troubleshooting Quick Reference

**Service won't start**:
```bash
docker compose logs app
docker compose restart app
```

**Database connection error**:
```bash
docker compose exec postgres pg_isready -U hf_user
docker compose restart postgres
```

**SSL certificate expired**:
```bash
sudo certbot renew
sudo cp /etc/letsencrypt/live/DOMAIN/*.pem /opt/hf/ssl/
docker compose restart nginx
```

**Out of disk space**:
```bash
df -h
docker system prune -a  # CAUTION: removes unused images
find /opt/hf/backups -mtime +30 -delete
```

**High memory usage**:
```bash
docker stats
docker compose restart app
# Consider upgrading server specs
```

---

## Success Criteria

✅ **Deployment is successful when**:

- [ ] All environments (DEV, TEST, PROD) are running
- [ ] Health checks pass on all environments
- [ ] SSL certificates valid and auto-renewing
- [ ] Backups running daily
- [ ] CI/CD pipeline working for DEV and TEST
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] Team trained on deployment process
- [ ] Rollback procedure tested on DEV

---

## Support Contacts

- **Cloud Provider Support**: ___________________
- **Domain Registrar**: ___________________
- **Email Alerts**: ___________________
- **On-Call Person**: ___________________

---

**Deployment Date**: ___________________
**Deployed By**: ___________________
**Environment**: DEV / TEST / PROD *(circle one)*

---

**Related Documentation**:
- Full Guide: [DEPLOYMENT-ENVIRONMENTS.md](DEPLOYMENT-ENVIRONMENTS.md)
- Local Dev: [DEV_ENV.md](DEV_ENV.md)
- Architecture: [apps/admin/docs/ARCHITECTURE.md](../apps/admin/docs/ARCHITECTURE.md)
