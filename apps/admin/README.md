# HF Admin

Personality-driven adaptive conversational AI administration system.

## Quick Start

```bash
# Install dependencies
npm install

# Initialize database
npx prisma migrate deploy
npx prisma generate
npm run db:seed:all

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the admin UI.

## Documentation

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](QUICKSTART.md) | Getting started guide |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Complete system architecture |
| [ADMIN_USER_GUIDE.md](ADMIN_USER_GUIDE.md) | Comprehensive admin guide |
| [ANALYSIS_SPECS.md](ANALYSIS_SPECS.md) | Behavior specifications |
| [STATUS.md](STATUS.md) | Current status and roadmap |

## Key Pages

All admin pages are served under the `/x/` prefix:

- `/x/domains` - Institution/domain management
- `/x/courses` - Course setup wizard
- `/x/specs` - Spec browser and editor
- `/x/pipeline` - Pipeline execution and monitoring
- `/x/callers` - Caller profiles and personality data
- `/x/content-sources` - Content source management (trust levels, extraction)
- `/x/sim` - Call simulator
- `/x/settings` - System settings
- `/x/ai-config` - AI provider configuration and cascade inspector

## Environment Variables

```bash
DATABASE_URL="postgresql://..."     # Database connection
AUTH_SECRET="..."                   # NextAuth session encryption
HF_SUPERADMIN_TOKEN="..."          # Admin auth token
AUTH_TRUST_HOST=true                # Required for production
```
