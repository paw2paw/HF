# HF Admin Quick Start Guide

## System Overview

HF (Human Factors) is a personality-driven adaptive conversational system that:
1. Processes call transcripts to extract personality insights
2. Builds user personality profiles using Big Five traits
3. Extracts structured memories from conversations
4. Selects appropriate conversational approaches based on personality
5. Continuously adapts as more calls are observed

---

## Prerequisites

- Node.js 18+ installed
- SQLite (default) or PostgreSQL
- Environment variables configured in `.env.local`

### Required Environment Variables

```bash
# .env.local
DATABASE_URL="file:./prisma/dev.db"  # SQLite
HF_KB_PATH="/path/to/your/knowledge/base"
HF_OPS_ENABLED="true"  # Enable ops API
```

---

## Getting Started

### 1. Install Dependencies

```bash
cd apps/admin
npm install
```

### 2. Initialize Database

```bash
# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed all configuration data
npm run db:seed:all
```

### 3. Start the Server

```bash
npm run dev
```

Server runs at [http://localhost:3000](http://localhost:3000)

### 4. Verify Setup

- **Flow Graph**: [http://localhost:3000/flow](http://localhost:3000/flow) - Visual pipeline
- **Ops Dashboard**: [http://localhost:3000/ops](http://localhost:3000/ops) - Run operations
- **Cockpit**: [http://localhost:3000/cockpit](http://localhost:3000/cockpit) - System status

---

## Database Management

### Reset & Reseed (Start Fresh)

```bash
# Clear all data (interactive confirmation)
npm run db:reset

# Or skip confirmation
npm run db:reset -- --confirm

# Then reseed everything
npm run db:seed:all
```

### Individual Seeds

```bash
# Just de-duplicate parameters
npm run prisma:seed

# Run all seeds with verbose output
npm run db:seed:all -- --verbose

# Skip parameter de-duplication
npm run db:seed:all -- --skip-dedupe
```

### What Gets Seeded

| Seed | Purpose |
|------|---------|
| `seed.ts` | De-duplicate existing parameters, ensure Active tags |
| `seed-big-five.ts` | Big Five traits with scoring anchors |
| `seed-memory-specs.ts` | Memory extraction specs |
| `seed-prompts.ts` | Prompt slugs and templates |
| `seed-run-configs.ts` | Agent run configurations |
| `seed-adapt-system.ts` | Adaptive prompting system |
| `seed-analysis.ts` | Create analysis profile from Active parameters |

---

## Running Operations

### Via API

```bash
# Process transcripts
curl -X POST http://localhost:3000/api/ops \
  -H "Content-Type: application/json" \
  -d '{"opid": "transcripts:process"}'

# Analyze personality (mock mode for testing)
curl -X POST http://localhost:3000/api/ops \
  -H "Content-Type: application/json" \
  -d '{"opid": "personality:analyze", "settings": {"mock": true}}'

# Extract memories (mock mode for testing)
curl -X POST http://localhost:3000/api/ops \
  -H "Content-Type: application/json" \
  -d '{"opid": "memory:extract", "settings": {"mock": true}}'

# Ingest knowledge documents
curl -X POST http://localhost:3000/api/ops \
  -H "Content-Type: application/json" \
  -d '{"opid": "knowledge:ingest"}'
```

### Generate Prompts

After processing, generate prompts for a user:

```bash
# Spec-based composition (primary method)
curl -X POST http://localhost:3000/api/prompt/compose-from-specs \
  -H "Content-Type: application/json" \
  -d '{"userId": "<user-id>", "includeMemories": true}'
```

### Available Operations

| opid | Status | Description |
|------|--------|-------------|
| `transcripts:process` | Implemented | Extract calls from transcript files |
| `personality:analyze` | Implemented | Score personality traits from calls |
| `memory:extract` | Implemented | Extract memories from calls |
| `knowledge:ingest` | Implemented | Ingest knowledge documents |
| `kb:links:extract` | Implemented | Extract links from knowledge base |
| `knowledge:embed` | Not implemented | Generate vector embeddings |

### Dry Run Mode

Add `"dryRun": true` to see what would happen without making changes:

```bash
curl -X POST http://localhost:3000/api/ops \
  -H "Content-Type: application/json" \
  -d '{"opid": "personality:analyze", "dryRun": true}'
```

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

---

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Raw Transcripts │────▶│ transcripts:process│────▶│  Call + User    │
│  (JSON files)    │     │                    │     │  (database)     │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              │
                        │ personality:analyze│◀────────────┤
                        │ (spec-driven)     │              │
                        └────────┬─────────┘              │
                                 │                        │
                        ┌────────▼─────────┐     ┌────────▼────────┐
                        │  CallScore +      │     │  memory:extract  │
                        │  UserPersonality  │     │  (spec-driven)   │
                        └──────────────────┘     └────────┬────────┘
                                                          │
                                                 ┌────────▼────────┐
                                                 │  UserMemory +    │
                                                 │  MemorySummary   │
                                                 └─────────────────┘
```

---

## Key Concepts

### AnalysisSpecs
Define how to analyze transcripts:
- **MEASURE specs**: Score personality traits (0-1 scale)
- **LEARN specs**: Extract memories (key-value facts)

### Prompt Composition
The primary method is **spec-based composition** via `/api/prompt/compose-from-specs`:
- Uses AnalysisSpec promptTemplate fields
- Renders Mustache-style templates with parameter values
- Injects memories based on user history

### Time Decay
Personality scores use exponential decay:
- Recent calls weighted higher
- 30-day half-life (configurable)
- Ensures profile reflects current state

---

## File Structure

```
apps/admin/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Parameter de-duplication
│   ├── seed-all.ts        # Master seed runner
│   ├── seed-*.ts          # Individual seeds
│   └── reset.ts           # Database reset script
├── lib/
│   ├── data-paths.ts      # Unified path resolution
│   ├── ops/               # Operation implementations
│   └── prompt/
│       └── PromptTemplateCompiler.ts  # Spec-based composition
├── app/api/
│   ├── ops/               # Ops API endpoint
│   ├── prompt/
│   │   ├── compose-from-specs/  # Primary composition endpoint
│   │   └── post-call/           # Post-call prompt generation
│   └── ...
└── tests/
    ├── setup.ts           # Test configuration
    └── ops/               # Unit tests
```

---

## Team Collaboration

### Fresh Start for New Team Members

```bash
# 1. Clone and install
git clone <repo>
cd apps/admin
npm install

# 2. Set up database
npx prisma migrate deploy
npx prisma generate

# 3. Seed configuration
npm run db:seed:all

# 4. Start developing
npm run dev
```

### Reset to Clean State

```bash
# Clear all data
npm run db:reset -- --confirm

# Reseed configuration
npm run db:seed:all

# Ready to process fresh data
```

---

## Development Scripts

### Server Management Commands

| Command | Database Reset | Server Restart | Cache Clear | Use When |
|---------|---------------|----------------|-------------|----------|
| `npm run dev` | ❌ | ❌ | ❌ | Normal development |
| `npm run devX` | ❌ | ✅ | ✅ | Server stuck, cache issues |
| `npm run devD` | ✅ | ❌ | ❌ | Need fresh data only |
| `npm run devZZZ` | ✅ | ✅ | ✅ | Complete nuclear reset |

### What Each Command Does

**`npm run devX`** - Smart Hard Restart
- Intelligently finds and kills Next.js processes
- Clears `.next` build cache
- Starts fresh dev server
- Use when: Server is stuck or acting weird

**`npm run devD`** - Data Reset Only
1. ✅ Checks dev server is running
2. 🗑️ Clears ALL database data
3. 🔧 Reloads domains, playbooks, specs, parameters
4. 📝 Imports all transcripts (callers + calls)
5. ✨ Keeps server running (no restart)
- Use when: You want fresh data but don't want to restart/rebuild

**`npm run devZZZ`** - Nuclear Reset
1. 🗑️ Clears database
2. 🔪 Kills server + clears cache
3. 🌐 Starts fresh server
4. 🌱 Seeds data
5. 📝 Imports transcripts
6. 📊 Tails logs (stays running)
- Use when: Complete fresh start needed

---

## Troubleshooting

### Ops Disabled Error
```
Operations are disabled. Set HF_OPS_ENABLED=true to enable.
```
Add `HF_OPS_ENABLED=true` to your `.env.local`

### No Parameters Found
```bash
npm run db:seed:all
```

### Database Issues
```bash
# Check migration status
npm run prisma:status

# Reset and recreate
npm run db:reset -- --confirm
npx prisma migrate deploy
npm run db:seed:all
```

### Test Failures
```bash
# Run tests with verbose output
npm test -- --reporter=verbose
```

---

## Quick Reference

```bash
# Development
npm run dev                    # Start dev server
npm run devX                   # Hard restart (kill server + clear cache)
npm run devD                   # Data reset only (keep server running)
npm run devZZZ                 # Nuclear reset (DB + server + data)
npm test                       # Run tests
npm run prisma:studio          # Database GUI

# Database
npm run db:reset               # Clear all data
npm run db:seed:all            # Seed all config
npm run prisma:seed            # De-dupe parameters only

# Ops (via curl)
POST /api/ops { "opid": "transcripts:process" }
POST /api/ops { "opid": "knowledge:ingest" }
POST /api/ops { "opid": "personality:analyze", "settings": {"mock": true} }
POST /api/ops { "opid": "memory:extract", "settings": {"mock": true} }

# Prompt Composition
POST /api/prompt/compose-from-specs { "userId": "...", "includeMemories": true }
```

---

## Further Reading

- [ADMIN_USER_GUIDE.md](ADMIN_USER_GUIDE.md) - Comprehensive admin documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [ANALYSIS_SPECS.md](ANALYSIS_SPECS.md) - Behavior specifications
- [DATA_FLOW_GUIDE.md](DATA_FLOW_GUIDE.md) - Data flow documentation

---

**Version**: 0.3
**Last Updated**: 2026-01-22
