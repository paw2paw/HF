## Deployment

### Cloud (managed)

The managed HF instance is available at `https://api.hf.app`. No setup
required -- create an account, generate an API key, and start making calls.

### Self-hosted

HF can be deployed in your own infrastructure for full data sovereignty.

#### Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Runtime** | Node.js 20+ | Node.js 22 LTS |
| **Database** | PostgreSQL 15 | PostgreSQL 16 |
| **Memory** | 2 GB RAM | 4 GB RAM |
| **Storage** | 10 GB | 50 GB (for transcript storage) |

#### Docker Compose

```yaml
version: "3.8"
services:
  hf:
    image: ghcr.io/hf-platform/hf:latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://hf_user:password@postgres:5432/hf
      HF_SUPERADMIN_TOKEN: your-secret-token
      OPENAI_API_KEY: sk-...
      NEXTAUTH_SECRET: your-nextauth-secret
      NEXTAUTH_URL: https://your-domain.com
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: hf_user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: hf
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

#### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `HF_SUPERADMIN_TOKEN` | Yes | Admin API token |
| `OPENAI_API_KEY` | Yes | OpenAI key for analysis pipeline |
| `NEXTAUTH_SECRET` | Yes | Session encryption secret |
| `NEXTAUTH_URL` | Yes | Public URL of the instance |
| `HF_KB_PATH` | No | Path to knowledge base files |
| `HF_LOG_LEVEL` | No | Logging level (default: `info`) |

#### Initial setup

```bash
# Run database migrations
docker exec hf npx prisma migrate deploy

# Seed the system with default specs and parameters
docker exec hf npm run db:seed

# Verify the instance is healthy
curl https://your-domain.com/api/health
```
