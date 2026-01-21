# HF MVP Quick Start Guide

## System Overview

HF (Human Factors) is a personality-driven adaptive conversational system that:
1. Processes call transcripts to extract personality insights
2. Builds user personality profiles using Big Five traits
3. Selects appropriate conversational approaches based on personality
4. Continuously adapts as more calls are observed

---

## Prerequisites

- PostgreSQL running (Docker or Homebrew)
- Node.js 18+ installed
- Environment variables configured in `.env.local`

### Check System Health

Visit [http://localhost:3000/ops](http://localhost:3000/ops) to see the health check dashboard:
- ✅ Database connection
- ✅ Knowledge base path accessibility
- ✅ Environment variables
- ✅ File system permissions

---

## Getting Started (5 Minutes)

### 1. Start the Server

```bash
cd apps/admin
npm run dev
```

Server runs at [http://localhost:3000](http://localhost:3000)

### 2. Initialize Database (First Time Only)

```bash
# Run migrations to create tables
npx prisma migrate deploy

# Seed baseline parameters (44 personality/quality dimensions)
npx prisma db seed
```

**Or use the Ops UI:**
- Go to [http://localhost:3000/ops](http://localhost:3000/ops)
- Click "Schema & migrations" section → "Migration status"
- Click "Data" section → "Seed baseline data"

### 3. Verify Setup

Navigate to:
- **Parameters**: [http://localhost:3000/admin#/parameters](http://localhost:3000/admin#/parameters)
  - Should show 44 parameters (Big Five traits, quality dimensions)
- **Ops Dashboard**: [http://localhost:3000/ops](http://localhost:3000/ops)
  - Health check should show all green

---

## Complete End-to-End Workflow

### Step 1: Process Transcripts

**Place raw transcript files** in:
```
/Volumes/PAWSTAW/Projects/hf_kb/transcripts/raw/
```

**Transcript format** (JSON):
```json
{
  "call": {
    "id": "call_123",
    "customer": {
      "id": "cust_456",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "transcript": "Full conversation text here...",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

Or batch format:
```json
{
  "calls": [
    { "id": "call_1", "transcript": "...", ... },
    { "id": "call_2", "transcript": "...", ... }
  ]
}
```

**Run processor:**
- **Via Ops UI**: Go to [http://localhost:3000/ops](http://localhost:3000/ops) → "Data" section → Click "Process transcripts"
- **Via API**:
  ```bash
  curl -X POST http://localhost:3000/api/ops \
    -H "Content-Type: application/json" \
    -d '{
      "opid": "transcripts:process",
      "settings": {
        "autoDetectType": true,
        "createUsers": true,
        "createBatches": true
      }
    }'
  ```

**What happens:**
- Deduplication via file hash (same file = skip)
- Extracts user records from customer data
- Groups into batches by date/source
- Tracks processing status (PENDING → PROCESSING → COMPLETED)

### Step 2: Create Control Set Snapshot

**Control Sets** are immutable snapshots of parameter definitions used for analysis.

**Run snapshot:**
- **Via Ops UI**: [http://localhost:3000/ops](http://localhost:3000/ops) → "Analysis" section → "Snapshot Active controls"
- **Via API**:
  ```bash
  curl -X POST http://localhost:3000/api/ops/analysis:snapshot:active \
    -H "Content-Type: application/json" \
    -d '{"dryRun": false}'
  ```

**What happens:**
- Creates ParameterSet from all parameters tagged "Active"
- Snapshot is immutable and versioned
- All future analyses reference this control set

**View control sets:**
- **Via Ops UI**: "Analysis" section → "Inspect Control Sets"

### Step 3: Run Personality Analysis

**Coming soon** - This operation exists but isn't yet wired to the Ops UI.

When implemented, it will:
1. Load unprocessed Call records
2. Use Parameter definitions as scoring rubrics
3. Extract Big Five traits from transcript text via LLM
4. Create PersonalityObservation records (time-series data)
5. Aggregate into UserPersonality profiles with time decay (30-day half-life)

### Step 4: View Results

Navigate through the admin interface:
- **Users**: View personality profiles and call history
- **Parameters**: [http://localhost:3000/admin#/parameters](http://localhost:3000/admin#/parameters)
- **Prompt Slugs**: [http://localhost:3000/admin#/prompt-slugs](http://localhost:3000/admin#/prompt-slugs)

---

## Key Concepts Explained

### Parameters
Scoring dimensions that define what to measure:
- **Big Five Personality**: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism
- **Quality Dimensions**: Clarity, Empathy, Resolution, Efficiency
- **Guardrails**: Boundary conditions and safety checks

Each parameter has:
- `definition`: What this trait means
- `interpretationHigh`: What high scores indicate
- `interpretationLow`: What low scores indicate
- `scaleType`: continuous (0-1) or categorical
- Tags: "Active", "MVP", etc.

### Control Sets (Parameter Snapshots)
Immutable versioned snapshots of parameters:
- Created via "Snapshot Active controls" operation
- Linked to every analysis run for auditability
- Never modified after creation (new settings = new snapshot)
- Enables reproducibility and rollback

### Personality Observations
Time-series personality scores from individual calls:
- One observation per call
- Scores for each Big Five trait (0-1 scale)
- Confidence score based on transcript quality
- Links to the control set used

### User Personality Profiles
Aggregated personality across all observations:
- Exponential time decay (recent calls weighted higher)
- 30-day half-life by default
- Confidence score for the overall profile
- Recomputed after each new observation

### Prompt Slugs
Conversational approaches selected based on personality:

**Categories:**
- `emotion.*` - For high neuroticism (soothing, validating, reassuring)
- `control.*` - Conversation management (redirect, clarify, summarize)
- `memory.*` - For low openness + high agreeableness (story elicitation, identity anchoring)
- `engage.*` - For high extraversion/conscientiousness (encourage, prompt action, curiosity)

**Selection Rules (MVP):**
- High neuroticism (>0.6) → `emotion.soothing`
- Low openness + High agreeableness → `memory.elicit_story`
- High extraversion (>0.7) → `engage.encourage`
- High conscientiousness (>0.6) → `engage.prompt_action`
- Default → `control.clarify`

---

## Operations Reference

### Database Operations
- **`prisma:migrate:status`** - Check migration status
- **`prisma:migrate:dev`** - Create/apply new migration
- **`prisma:generate`** - Regenerate Prisma client
- **`prisma:seed`** - Load baseline parameters

### Data Operations
- **`transcripts:process`** - Process raw transcript files
- **`transcripts:raw:list`** - List available raw transcripts

### Analysis Operations
- **`analysis:ensure-active-tags`** - Tag parameters as "Active"
- **`analysis:snapshot:active`** - Create control set snapshot
- **`analysis:inspect:sets`** - View available control sets
- **`personality:analyze`** - Score personality from transcripts (coming soon)

### Service Operations
- **`service:db:status`** - Check PostgreSQL status
- **`service:db:start`** - Start PostgreSQL (Homebrew)
- **`service:db:stop`** - Stop PostgreSQL
- **`service:db:restart`** - Restart PostgreSQL
- **`service:server:status`** - Check Next.js dev server

---

## File System Structure

```
/Volumes/PAWSTAW/Projects/hf_kb/
├── sources/
│   └── knowledge/          # Documentation for knowledge base
├── transcripts/
│   └── raw/               # Raw transcript JSON files (input)
├── parameters/
│   └── raw/               # Parameter definitions (optional)
├── derived/               # Generated artifacts
└── .hf/                   # System metadata
```

---

## Database Schema Overview

### Core Data Flow
```
ProcessedFile (file metadata)
    ↓
TranscriptBatch (grouped by date/source)
    ↓
Call (individual conversation)
    ├─→ User (customer/participant)
    ├─→ ControlSet (parameters used)
    ├─→ PersonalityObservation (scores from this call)
    └─→ PromptSlugSelection (approach selected)
```

### Personality Flow
```
Parameter (scoring dimension)
    ↓
ParameterSet (versioned snapshot)
    ↓
PersonalityObservation (single call scores)
    ↓
UserPersonality (aggregated profile with time decay)
```

---

## Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL status
brew services list | grep postgresql

# Start PostgreSQL
brew services start postgresql@14

# Or via Ops UI: Services section → "DB Start"
```

### No Parameters Found
```bash
# Run seed script
cd apps/admin
npx prisma db seed

# Or via Ops UI: Data section → "Seed baseline data"
```

### Health Check Warnings
Check the health dashboard at [http://localhost:3000/ops](http://localhost:3000/ops):
- **Database error**: PostgreSQL not running
- **KB Path warning**: Missing subdirectories (auto-created)
- **Environment error**: Missing required variables in `.env.local`
- **File system error**: No write permissions to KB path

### Transcript Processing Fails
- Check file format (valid JSON)
- Verify file is in `HF_KB_PATH/transcripts/raw/`
- Check operation logs in Ops UI → "Last run" or "History"

---

## Development Tips

### Dry-Run Mode
Enable "Dry-run" checkbox in Ops UI to see what commands will execute without running them.

### Verbose Logs
Enable "Verbose logs" checkbox to see detailed execution output.

### Plan Before Execute
Click "More" button next to any operation to see execution plan before running.

### History Tracking
All operation runs are logged in "History" section with timestamps and outputs.

---

## What's Next

### Immediate Next Steps
1. Add sample transcript files to test processing
2. Wire up personality analysis operation to Ops UI
3. Build dashboard to visualize user personality profiles
4. Implement prompt slug selection UI

### Future Enhancements
- Real LLM-based personality scoring (replace mock)
- Vector embeddings for knowledge retrieval
- ML-based prompt selection (replace rule-based)
- Real-time analysis pipeline
- A/B testing framework for prompt effectiveness

---

## Architecture Principles

1. **Immutability**: Control sets never change (new settings = new snapshot)
2. **Auditability**: Every call links to control set used
3. **Time Decay**: Recent observations weighted higher (30-day half-life)
4. **Deduplication**: Hash-based to prevent reprocessing
5. **Resumability**: Interrupted operations continue from checkpoint
6. **Reproducibility**: Same control set + same data = same results

---

## Support & Documentation

- **Ops Dashboard**: [http://localhost:3000/ops](http://localhost:3000/ops)
- **Admin UI**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Health Check**: Built into Ops page (auto-refresh every 30s)
- **Code Documentation**: See inline comments in `/apps/admin/lib/ops/`

---

## Quick Reference Card

```bash
# Start server
npm run dev

# Database setup
npx prisma migrate deploy
npx prisma db seed

# Process transcripts
curl -X POST http://localhost:3000/api/ops \
  -d '{"opid": "transcripts:process"}'

# Create control set
curl -X POST http://localhost:3000/api/ops/analysis:snapshot:active

# Check health
curl http://localhost:3000/api/health | jq .

# View parameters
open http://localhost:3000/admin#/parameters

# Ops dashboard
open http://localhost:3000/ops
```

---

**Version**: MVP 0.1
**Last Updated**: 2026-01-14
**Environment**: Development (local-only operations enabled)
