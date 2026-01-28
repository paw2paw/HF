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

## Interactive Guide

Navigate to `/guide` in the admin UI for an interactive browser-embedded documentation.

## Key Pages

- `/cockpit` - System status dashboard
- `/flow` - Visual pipeline
- `/ops` - Operations execution
- `/guide` - Interactive documentation

## Environment Variables

```bash
DATABASE_URL="postgresql://..."     # Database connection
HF_KB_PATH="/path/to/kb"            # Knowledge base root
HF_OPS_ENABLED="true"               # Enable ops API
```
