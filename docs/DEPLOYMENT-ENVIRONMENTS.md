# HF – Multi-Environment Deployment Guide

<!-- @doc-source file:apps/admin/Dockerfile,docker-compose.yml,apps/admin/.env.example -->
<!-- @doc-source file:apps/admin/lib/config.ts,apps/admin/prisma/schema.prisma -->
<!-- @doc-source env:DATABASE_URL,HF_SUPERADMIN_TOKEN,OPENAI_API_KEY,ANTHROPIC_API_KEY -->
<!-- @doc-source env:NEXT_PUBLIC_APP_URL,PORT,NODE_ENV -->

**Purpose**: Guide for setting up DEV, TEST, and PROD environments on cloud servers.

**Audience**: DevOps engineers, deployment automation, Claude AI assistance.

---

## Table of Contents

1. [Environment Strategy](#environment-strategy)
2. [Prerequisites](#prerequisites)
3. [Server Setup](#server-setup)
4. [Environment Configuration](#environment-configuration)
5. [Deployment Procedures](#deployment-procedures)
6. [Testing & Validation](#testing--validation)
7. [Promotion Strategy](#promotion-strategy)
8. [Rollback Procedures](#rollback-procedures)
9. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Environment Strategy

### Environment Purposes

| Environment | Purpose | Data | Uptime | URL Pattern |
|-------------|---------|------|--------|-------------|
| **DEV** | Active development, integration testing | Synthetic/anonymized | Low (can restart) | dev.yourdomain.com |
| **TEST** | QA, staging, pre-production validation | Production-like | Medium | test.yourdomain.com |
| **PROD** | Live production system | Real user data | Critical (99.9%+) | app.yourdomain.com |

### Key Principles

1. **DEV** = Latest code, frequent changes, can break
2. **TEST** = Stable candidate, final validation before production
3. **PROD** = Proven stable code only, change control required

### Branch Strategy

```
main (protected)
  ↓
  └─→ PROD deployment (manual approval)
       ↓
       └─→ TEST deployment (auto after main merge)

develop (integration branch)
  ↓
  └─→ DEV deployment (auto on push)

feature/* (developers)
  ↓
  └─→ PR to develop
```

---

## Prerequisites

### Required Tools

```bash
# On your local machine:
- Node.js 20+
- Docker 24+
- Git
- SSH client
- kubectl (if using Kubernetes)
```

### Cloud Resources Needed

**Per Environment**:
- 1 server (2+ vCPU, 4GB+ RAM minimum)
- PostgreSQL database (15+)
- Domain with SSL certificate
- Object storage (optional, for backups)

**Recommended Providers**:
- **Simple**: DigitalOcean, Hetzner, Linode
- **Scalable**: AWS (ECS/EKS), GCP (Cloud Run), Azure (AKS)
- **Database**: Managed PostgreSQL (RDS, Cloud SQL, etc.)

---

## Server Setup

### Step 1: Provision Servers

**Option A: DigitalOcean Droplets (Recommended for Getting Started)**

```bash
# Install doctl
brew install doctl  # macOS
# OR: snap install doctl  # Linux

# Authenticate
doctl auth init

# Create servers
doctl compute droplet create hf-dev \
  --image docker-20-04 \
  --size s-2vcpu-4gb \
  --region nyc1 \
  --ssh-keys YOUR_SSH_KEY_ID

doctl compute droplet create hf-test \
  --image docker-20-04 \
  --size s-2vcpu-4gb \
  --region nyc1 \
  --ssh-keys YOUR_SSH_KEY_ID

doctl compute droplet create hf-prod \
  --image docker-20-04 \
  --size s-4vcpu-8gb \
  --region nyc1 \
  --ssh-keys YOUR_SSH_KEY_ID

# Get IP addresses
doctl compute droplet list
```

**Option B: AWS EC2**

```bash
# Launch instances
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name your-key \
  --security-group-ids sg-xxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=hf-dev}]'

# Repeat for test and prod
```

**Option C: Hetzner (Cost-Effective)**

```bash
# Via web UI or API
# CX21 (2 vCPU, 4GB RAM) for DEV/TEST
# CX31 (2 vCPU, 8GB RAM) for PROD
```

### Step 2: Initial Server Configuration

Run this on **each server** (dev, test, prod):

```bash
# SSH into server
ssh root@SERVER_IP

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Create application user
useradd -m -s /bin/bash hf
usermod -aG docker hf

# Create directories
mkdir -p /opt/hf
mkdir -p /opt/hf/backups
mkdir -p /opt/hf/knowledge
mkdir -p /opt/hf/logs

# Set ownership
chown -R hf:hf /opt/hf

# Setup firewall
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable

# Exit and reconnect as hf user
exit
ssh-copy-id hf@SERVER_IP
ssh hf@SERVER_IP
```

### Step 3: DNS Configuration

Point your domains to server IPs:

```
A    dev.yourdomain.com   →  DEV_SERVER_IP
A    test.yourdomain.com  →  TEST_SERVER_IP
A    app.yourdomain.com   →  PROD_SERVER_IP
```

---

## Environment Configuration

### Codebase Structure Overview

```
HF/
├── apps/admin/                      # Main Next.js application
│   ├── Dockerfile                   # Multi-target: runner, seed, migrate
│   ├── package.json                 # Dependencies and scripts
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema
│   │   ├── migrations/              # 23 database migrations
│   │   ├── seed-from-specs.ts       # Engine: spec files → DB records
│   │   ├── seed-clean.ts            # Entry point: npm run db:seed
│   │   └── seed-domains.ts          # Creates base domains
│   ├── docs-archive/bdd-specs/      # 51 spec files + 3 contracts (bootstrap only)
│   ├── app/                         # Next.js app directory
│   ├── components/                  # React components
│   ├── lib/                         # Core business logic
│   │   ├── config.ts                # Centralized env config (all spec slugs)
│   │   ├── contracts/registry.ts    # DB-backed contract registry
│   │   └── prompt/composition/      # Prompt composition engine
│   └── .env.example                 # Environment template
├── knowledge/                       # Knowledge base files
├── docs/                            # Documentation
│   ├── CLOUD-DEPLOYMENT.md          # Data architecture & seed guide
│   ├── DEPLOYMENT-CHECKLIST.md      # Step-by-step checklist
│   └── DEPLOYMENT-ENVIRONMENTS.md   # Full deployment guide
└── docker-compose.yml               # Local development (postgres only)
```

### Per-Environment Configuration Files

Create these files on **each server** at `/opt/hf/`:

#### 1. docker-compose.yml (All Environments)

```yaml
# /opt/hf/docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    container_name: hf_postgres
    restart: unless-stopped
    ports:
      - "127.0.0.1:5432:5432"
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-hf}
      POSTGRES_USER: ${POSTGRES_USER:-hf_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-hf_user} -d ${POSTGRES_DB:-hf}"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    image: ${DOCKER_IMAGE:-ghcr.io/your-org/hf-admin:latest}
    container_name: hf_app
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-hf_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-hf}?schema=public
      HF_SUPERADMIN_TOKEN: ${HF_SUPERADMIN_TOKEN}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}
      NODE_ENV: production
      PORT: 8080
      HF_KB_PATH: /app/knowledge
      HF_OPS_ENABLED: "true"
    volumes:
      - ./knowledge:/app/knowledge:ro
      - ./logs:/app/logs
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    container_name: hf_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - app

volumes:
  postgres_data:
  nginx_logs:
```

#### 2. .env (Environment-Specific)

**DEV Environment** (`/opt/hf/.env`):
```bash
# === DEV ENVIRONMENT ===
POSTGRES_DB=hf_dev
POSTGRES_USER=hf_user
POSTGRES_PASSWORD=GENERATE_WITH_openssl_rand_base64_32

HF_SUPERADMIN_TOKEN=GENERATE_WITH_openssl_rand_hex_32

OPENAI_API_KEY=sk-your-dev-key
ANTHROPIC_API_KEY=sk-ant-your-dev-key

NEXT_PUBLIC_APP_URL=https://dev.yourdomain.com

# Docker image (will be updated by CI/CD)
DOCKER_IMAGE=ghcr.io/your-org/hf-admin:develop
```

**TEST Environment** (`/opt/hf/.env`):
```bash
# === TEST ENVIRONMENT ===
POSTGRES_DB=hf_test
POSTGRES_USER=hf_user
POSTGRES_PASSWORD=DIFFERENT_PASSWORD_THAN_DEV

HF_SUPERADMIN_TOKEN=DIFFERENT_TOKEN_THAN_DEV

OPENAI_API_KEY=sk-your-test-key
ANTHROPIC_API_KEY=sk-ant-your-test-key

NEXT_PUBLIC_APP_URL=https://test.yourdomain.com

DOCKER_IMAGE=ghcr.io/your-org/hf-admin:main
```

**PROD Environment** (`/opt/hf/.env`):
```bash
# === PRODUCTION ENVIRONMENT ===
POSTGRES_DB=hf_prod
POSTGRES_USER=hf_user
POSTGRES_PASSWORD=STRONGEST_PASSWORD_HERE

HF_SUPERADMIN_TOKEN=PRODUCTION_TOKEN_64_CHARS

OPENAI_API_KEY=sk-your-prod-key
ANTHROPIC_API_KEY=sk-ant-your-prod-key

NEXT_PUBLIC_APP_URL=https://app.yourdomain.com

DOCKER_IMAGE=ghcr.io/your-org/hf-admin:v1.0.0  # Tagged releases only
```

**Generate Secure Values**:
```bash
# On your local machine, generate values for each environment:
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "HF_SUPERADMIN_TOKEN=$(openssl rand -hex 32)"
```

#### 3. nginx.conf (Same for All)

```nginx
# /opt/hf/nginx.conf
events {
    worker_connections 1024;
}

http {
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    upstream app {
        server app:8080;
    }

    # HTTP → HTTPS redirect
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # HTTPS
    server {
        listen 443 ssl http2;
        server_name _;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # File upload size
        client_max_body_size 50M;

        # Logging
        access_log /var/log/nginx/access.log;
        error_log /var/log/nginx/error.log warn;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # Timeouts for AI operations
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # Rate limit API endpoints
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;

            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }
    }
}
```

#### 4. SSL Certificates

**Option A: Let's Encrypt (Recommended)**

On each server:
```bash
# Install certbot
sudo apt install certbot

# Get certificate (nginx must be stopped first)
sudo docker compose stop nginx

sudo certbot certonly --standalone \
  -d dev.yourdomain.com \
  --non-interactive \
  --agree-tos \
  --email your-email@example.com

# Copy to /opt/hf/ssl
sudo mkdir -p /opt/hf/ssl
sudo cp /etc/letsencrypt/live/dev.yourdomain.com/fullchain.pem /opt/hf/ssl/
sudo cp /etc/letsencrypt/live/dev.yourdomain.com/privkey.pem /opt/hf/ssl/
sudo chown -R hf:hf /opt/hf/ssl

# Start nginx
sudo docker compose start nginx

# Setup auto-renewal
echo "0 2 * * * certbot renew --quiet && cp /etc/letsencrypt/live/dev.yourdomain.com/*.pem /opt/hf/ssl/ && docker compose restart nginx" | sudo crontab -
```

**Option B: Manual Certificate**

If you have certificates from your provider:
```bash
# Copy files to server
scp fullchain.pem hf@SERVER_IP:/opt/hf/ssl/
scp privkey.pem hf@SERVER_IP:/opt/hf/ssl/
```

---

## Deployment Procedures

### Initial Deployment (First Time Setup)

Run these steps **in order** for each environment (DEV → TEST → PROD):

#### Step 1: Prepare Server

```bash
# SSH into server
ssh hf@SERVER_IP

# Navigate to deployment directory
cd /opt/hf

# Verify files exist
ls -la
# Should see: docker-compose.yml, .env, nginx.conf, ssl/
```

#### Step 2: Build or Pull Docker Image

**Option A: Pull Pre-Built Image (Recommended)**

```bash
# Configure GitHub Container Registry access
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Pull image
docker pull ghcr.io/your-org/hf-admin:develop  # or :main, :v1.0.0
```

**Option B: Build Locally on Server (Slower)**

```bash
# Clone repository
git clone https://github.com/your-org/HF.git /tmp/HF
cd /tmp/HF

# Checkout appropriate branch
git checkout develop  # or main for TEST/PROD

# Build image
docker build -t hf-admin:local apps/admin/

# Update .env to use local image
# DOCKER_IMAGE=hf-admin:local
```

#### Step 3: Start Services

```bash
cd /opt/hf

# Start all services
docker compose up -d

# Watch startup logs
docker compose logs -f app

# Wait for "ready on http://0.0.0.0:8080" message
```

#### Step 4: Run Database Migrations

```bash
# Run migrations
docker compose exec app npx prisma migrate deploy

# Verify schema
docker compose exec app npx prisma db pull
```

#### Step 5: Seed Initial Data

> **NOTE**: The production `runner` image cannot run seeds (it only contains
> `server.js`). Use the `seed` Docker target or seed via SSH tunnel from your
> local machine. See [CLOUD-DEPLOYMENT.md](CLOUD-DEPLOYMENT.md) for details.

**Option A: Seed via Docker seed image** (recommended):
```bash
# Build the seed image (once)
docker build --target seed -t hf-admin-seed apps/admin/

# Run migrations
docker build --target migrate -t hf-admin-migrate apps/admin/
docker run --rm --network hf_default \
  -e DATABASE_URL=postgresql://hf_user:PASSWORD@postgres:5432/hf?schema=public \
  hf-admin-migrate

# Seed specs + contracts
docker run --rm --network hf_default \
  -e DATABASE_URL=postgresql://hf_user:PASSWORD@postgres:5432/hf?schema=public \
  hf-admin-seed

# Seed domains
docker run --rm --network hf_default \
  -e DATABASE_URL=postgresql://hf_user:PASSWORD@postgres:5432/hf?schema=public \
  hf-admin-seed npx tsx prisma/seed-domains.ts
```

**Option B: Seed via SSH tunnel from local machine** (simplest for market test):
```bash
# Terminal 1: SSH tunnel
ssh -L 5433:localhost:5432 hf@your-server.com

# Terminal 2: Run seeds locally against remote DB
cd apps/admin
DATABASE_URL="postgresql://hf_user:PASSWORD@localhost:5433/hf?schema=public" \
  npx prisma migrate deploy
DATABASE_URL="postgresql://hf_user:PASSWORD@localhost:5433/hf?schema=public" \
  npx tsx prisma/seed-clean.ts
DATABASE_URL="postgresql://hf_user:PASSWORD@localhost:5433/hf?schema=public" \
  npx tsx prisma/seed-domains.ts
```

#### Step 6: Verify Seed

```bash
# Check seed counts
docker compose exec postgres psql -U hf_user hf -c "
  SELECT 'AnalysisSpec' as t, COUNT(*) as n FROM \"AnalysisSpec\"
  UNION ALL SELECT 'Parameter', COUNT(*) FROM \"Parameter\"
  UNION ALL SELECT 'Domain', COUNT(*) FROM \"Domain\"
  UNION ALL SELECT 'Contracts', COUNT(*) FROM \"SystemSetting\" WHERE key LIKE 'contract:%'
  ORDER BY t;
"
# Expected: ~51 specs, ~200+ params, 4 domains, 3 contracts
```

#### Step 7: Create Admin User

```bash
# Create initial admin user (via seed image or SSH tunnel)
# TODO: implement bootstrap-admin script
```

#### Step 8: Verify Deployment

```bash
# Check health endpoint
curl https://dev.yourdomain.com/api/health

# Check onboarding spec loaded from DB
curl https://dev.yourdomain.com/api/onboarding
# Expected: { "ok": true, "source": "database", ... }

# Check application logs
docker compose logs app --tail 100
```

### Subsequent Deployments (Updates)

#### For DEV Environment (Automated)

Create deployment script `/opt/hf/deploy.sh`:

```bash
#!/bin/bash
# /opt/hf/deploy.sh

set -e  # Exit on error

echo "🚀 Deploying to DEV..."

cd /opt/hf

# Pull latest image
echo "📦 Pulling latest image..."
docker compose pull app

# Stop application (keep database running)
echo "🛑 Stopping app..."
docker compose stop app

# Run migrations
echo "🔄 Running migrations..."
docker compose run --rm app npx prisma migrate deploy

# Start application
echo "✅ Starting app..."
docker compose up -d app

# Wait for health check
echo "🏥 Waiting for health check..."
sleep 10
for i in {1..30}; do
    if curl -f http://localhost:8080/api/health > /dev/null 2>&1; then
        echo "✅ Deployment successful!"
        docker compose logs app --tail 50
        exit 0
    fi
    echo "   Attempt $i/30..."
    sleep 2
done

echo "❌ Deployment failed - health check timeout"
docker compose logs app --tail 100
exit 1
```

Make executable and use:
```bash
chmod +x /opt/hf/deploy.sh
./deploy.sh
```

#### For TEST Environment (Manual Approval)

```bash
# SSH into TEST server
ssh hf@TEST_SERVER_IP

cd /opt/hf

# Update image tag in .env to tested version
nano .env
# Change: DOCKER_IMAGE=ghcr.io/your-org/hf-admin:main

# Deploy
./deploy.sh

# Run smoke tests (manual)
# - Login to UI
# - Create test caller
# - Run pipeline
# - Check prompt composition
```

#### For PROD Environment (Change Control)

```bash
# REQUIRE:
# - Tested in TEST environment
# - Approval from stakeholders
# - Maintenance window scheduled (if breaking changes)
# - Backup completed

# SSH into PROD server
ssh hf@PROD_SERVER_IP

cd /opt/hf

# BACKUP FIRST
./backup.sh  # See backup section below

# Update to specific release tag
nano .env
# Change: DOCKER_IMAGE=ghcr.io/your-org/hf-admin:v1.2.0

# Deploy
./deploy.sh

# Validate
curl https://app.yourdomain.com/api/health
# Test critical user flows

# Monitor for 30 minutes
docker compose logs -f app
```

---

## Testing & Validation

### Health Checks

Create `/opt/hf/health-check.sh`:

```bash
#!/bin/bash
# /opt/hf/health-check.sh

URL="${1:-http://localhost:8080}"

echo "🏥 Running health checks..."

# 1. App health
if curl -f "$URL/api/health" > /dev/null 2>&1; then
    echo "✅ App health OK"
else
    echo "❌ App health FAILED"
    exit 1
fi

# 2. Database connectivity
if docker compose exec -T app npx prisma db pull > /dev/null 2>&1; then
    echo "✅ Database OK"
else
    echo "❌ Database FAILED"
    exit 1
fi

# 3. Container status
if [ "$(docker compose ps app --format json | jq -r '.[0].Health')" = "healthy" ]; then
    echo "✅ Container health OK"
else
    echo "❌ Container unhealthy"
    exit 1
fi

echo "✅ All health checks passed"
```

### Smoke Tests (Manual)

After each deployment, verify:

**DEV**:
- [ ] Can access UI
- [ ] Can login
- [ ] Can view callers page
- [ ] Can trigger pipeline

**TEST**:
- [ ] All DEV tests +
- [ ] Can create new caller
- [ ] Pipeline produces scores
- [ ] Prompt composition works
- [ ] AI assistant responds

**PROD**:
- [ ] All TEST tests +
- [ ] Existing users can login
- [ ] Recent data is visible
- [ ] No errors in logs for 30 minutes
- [ ] Performance metrics normal

### Automated Tests (Future)

```bash
# On deployment server
docker compose exec app npm run test:integration

# Or from CI/CD against environment
TEST_API_URL=https://test.yourdomain.com npm run test:e2e
```

---

## Promotion Strategy

### Code Promotion Flow

```
Developer
   ↓ (push)
feature/branch
   ↓ (PR)
develop branch → AUTO DEPLOY to DEV
   ↓ (tested, PR approved)
main branch → AUTO DEPLOY to TEST
   ↓ (validated, create release tag)
v1.x.x tag → MANUAL DEPLOY to PROD
```

### Database Migration Promotion

**Important**: Migrations flow forward only.

1. **Create Migration (DEV)**:
   ```bash
   # On local machine
   cd apps/admin
   npx prisma migrate dev --name add_new_feature
   git add prisma/migrations/
   git commit -m "migration: add new feature"
   git push origin develop
   ```

2. **Auto-Deploy to DEV**:
   - CI/CD pulls image and deploys
   - Migration runs automatically via `prisma migrate deploy`

3. **Promote to TEST**:
   - Merge `develop` → `main`
   - CI/CD deploys to TEST
   - Migration runs on TEST database

4. **Promote to PROD**:
   - Tag release: `git tag v1.2.0 && git push --tags`
   - Manually update PROD `.env` with new tag
   - Run `./deploy.sh` (includes migration)

### Rollback-Safe Migrations

**DO**:
- Add nullable columns: ✅ Safe
- Add new tables: ✅ Safe
- Add indexes: ✅ Safe (can be slow)
- Expand column types: ✅ Safe (text → text)

**DON'T**:
- Drop columns: ❌ Breaks old code
- Rename columns: ❌ Breaks old code
- Add NOT NULL constraints: ❌ Can fail if data exists

**For Breaking Changes**:
1. Deploy code that works with OLD schema
2. Run migration
3. Deploy code that uses NEW schema

---

## Backup Procedures

### Database Backups

Create `/opt/hf/backup.sh`:

```bash
#!/bin/bash
# /opt/hf/backup.sh

BACKUP_DIR="/opt/hf/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/hf_backup_$TIMESTAMP.sql.gz"

echo "🗄️  Starting backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Dump database
docker compose exec -T postgres pg_dump -U hf_user hf | gzip > "$BACKUP_FILE"

echo "✅ Backup saved: $BACKUP_FILE"

# Keep only last 30 days
find "$BACKUP_DIR" -name "hf_backup_*.sql.gz" -mtime +30 -delete

# Show backup size
ls -lh "$BACKUP_FILE"
```

Make executable:
```bash
chmod +x /opt/hf/backup.sh
```

**Schedule Daily Backups**:
```bash
# Add to crontab
crontab -e

# Add line (runs at 2 AM daily):
0 2 * * * /opt/hf/backup.sh >> /opt/hf/logs/backup.log 2>&1
```

### Restore Procedure

```bash
# Stop application
docker compose stop app

# Restore from backup
gunzip -c /opt/hf/backups/hf_backup_20260210_020000.sql.gz | \
  docker compose exec -T postgres psql -U hf_user hf

# Restart application
docker compose start app

# Verify
curl http://localhost:8080/api/health
```

### Disaster Recovery

**Full Environment Restore**:

1. Provision new server (same specs)
2. Setup Docker and directories (see Server Setup)
3. Copy configuration files:
   ```bash
   scp /opt/hf/.env new-server:/opt/hf/
   scp /opt/hf/docker-compose.yml new-server:/opt/hf/
   scp /opt/hf/nginx.conf new-server:/opt/hf/
   ```
4. Restore database:
   ```bash
   scp /opt/hf/backups/latest.sql.gz new-server:/tmp/
   # On new server:
   docker compose up -d postgres
   gunzip -c /tmp/latest.sql.gz | docker compose exec -T postgres psql -U hf_user hf
   ```
5. Deploy application:
   ```bash
   docker compose up -d
   ```
6. Update DNS to point to new server

---

## Rollback Procedures

### Application Rollback (No Schema Changes)

```bash
# SSH into server
ssh hf@SERVER_IP

cd /opt/hf

# Edit .env to previous image version
nano .env
# Change: DOCKER_IMAGE=ghcr.io/your-org/hf-admin:v1.1.0  (previous version)

# Deploy
docker compose pull app
docker compose up -d app

# Verify
curl http://localhost:8080/api/health
```

### Database Rollback (Migration Issues)

**If migration breaks**:

```bash
# Stop app
docker compose stop app

# Restore from backup (taken before deployment)
gunzip -c /opt/hf/backups/hf_backup_BEFORE_MIGRATION.sql.gz | \
  docker compose exec -T postgres psql -U hf_user hf

# Rollback to previous app version
nano .env  # Previous image tag
docker compose up -d app
```

**If migration partially applied**:

```bash
# Mark migration as rolled back
docker compose exec app npx prisma migrate resolve --rolled-back "migration_name"

# Apply working migrations
docker compose exec app npx prisma migrate deploy
```

---

## Monitoring & Maintenance

### Basic Monitoring Script

Create `/opt/hf/monitor.sh`:

```bash
#!/bin/bash
# /opt/hf/monitor.sh

echo "📊 HF System Status"
echo "===================="

# Disk usage
echo "💾 Disk Usage:"
df -h / | tail -1

# Container status
echo ""
echo "🐳 Containers:"
docker compose ps

# Database size
echo ""
echo "🗄️  Database Size:"
docker compose exec -T postgres psql -U hf_user hf -c "
  SELECT pg_size_pretty(pg_database_size('hf')) as size;
"

# Recent errors in logs
echo ""
echo "❌ Recent Errors (last 24h):"
docker compose logs app --since 24h 2>&1 | grep -i error | tail -5

# Resource usage
echo ""
echo "📈 Resource Usage:"
docker stats --no-stream hf_app hf_postgres
```

### Log Management

```bash
# View real-time logs
docker compose logs -f app

# Search logs
docker compose logs app | grep "ERROR"

# Export logs for analysis
docker compose logs app --since 24h > /tmp/app-logs-24h.log

# Rotate logs (add to crontab)
0 0 * * * docker compose logs app --since 48h > /opt/hf/logs/app-$(date +\%Y\%m\%d).log && docker compose restart app
```

### Resource Alerts

Set up monitoring for:
- Disk usage > 80%
- Memory usage > 85%
- CPU usage sustained > 80%
- Health check failures
- Database connection errors
- 5xx error rate > 1%

**Simple Email Alert** (requires mailutils):
```bash
# Add to crontab (check every 5 minutes)
*/5 * * * * /opt/hf/health-check.sh || echo "Health check failed on $(hostname)" | mail -s "HF Alert" admin@example.com
```

---

## CI/CD Pipeline Setup

### GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml` in your repository:

```yaml
name: Deploy HF

on:
  push:
    branches:
      - develop  # Auto-deploy to DEV
      - main     # Auto-deploy to TEST
    tags:
      - 'v*'     # Manual trigger for PROD

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/hf-admin

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=tag
            type=sha,prefix={{branch}}-

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: apps/admin
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-dev:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest

    steps:
      - name: Deploy to DEV
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.DEV_HOST }}
          username: hf
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/hf
            echo "DOCKER_IMAGE=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:develop" > .env.update
            source .env.update
            ./deploy.sh

  deploy-test:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest

    steps:
      - name: Deploy to TEST
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.TEST_HOST }}
          username: hf
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/hf
            echo "DOCKER_IMAGE=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:main" > .env.update
            source .env.update
            ./deploy.sh

  # PROD deployment is manual - update .env on server with release tag
```

### Required Secrets

Add to GitHub repo settings → Secrets:

```
SSH_PRIVATE_KEY     = Your SSH private key for server access
DEV_HOST           = IP or hostname of DEV server
TEST_HOST          = IP or hostname of TEST server
```

### Deployment Triggers

- **Push to `develop`** → Auto-deploys to DEV
- **Push to `main`** → Auto-deploys to TEST
- **Tag `v1.x.x`** → Builds image, manual deploy to PROD

---

## Quick Reference Commands

### Development Workflow

```bash
# Local development (on your Mac)
cd ~/projects/HF
docker compose up -d postgres
cd apps/admin
npm run dev

# Push to DEV
git push origin develop  # Auto-deploys to DEV

# Promote to TEST
git checkout main
git merge develop
git push origin main  # Auto-deploys to TEST

# Release to PROD
git tag v1.2.0
git push --tags  # Manual deploy required
```

### Server Operations

```bash
# SSH into environment
ssh hf@dev.yourdomain.com   # DEV
ssh hf@test.yourdomain.com  # TEST
ssh hf@app.yourdomain.com   # PROD

# Common operations
cd /opt/hf
docker compose ps              # Status
docker compose logs -f app     # Logs
docker compose restart app     # Restart
./deploy.sh                    # Deploy
./backup.sh                    # Backup
./health-check.sh              # Health check
```

### Troubleshooting

```bash
# View logs
docker compose logs app --tail 100 -f

# Check database
docker compose exec postgres psql -U hf_user hf

# Restart services
docker compose restart

# Full reset (CAUTION)
docker compose down
docker volume rm hf_postgres_data
docker compose up -d
```

---

## Next Steps

1. **Provision servers** (DEV, TEST, PROD)
2. **Configure DNS** records
3. **Setup SSL** certificates
4. **Deploy to DEV** following Initial Deployment steps
5. **Test DEV** thoroughly
6. **Deploy to TEST** and validate
7. **Setup CI/CD** pipeline
8. **Document** your specific configuration
9. **Setup monitoring** and alerts
10. **Schedule backups**

---

**Last Updated**: 2026-02-10
**Maintainer**: DevOps Team
**Related Docs**: [DEV_ENV.md](DEV_ENV.md), [ARCHITECTURE.md](../apps/admin/docs/ARCHITECTURE.md)
