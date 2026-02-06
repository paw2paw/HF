# Development Scripts Guide

Quick reference for all npm scripts in the HF Admin project.

## Development Workflows

### Starting Fresh
```bash
npm run devZZZ     # 💣 Nuclear reset - wipe everything and reload + auto-share
```
Use when:
- Starting a new development session
- Testing with completely fresh data
- After major schema changes

**What it does:**
1. Drops and recreates database
2. Kills running servers and clears cache
3. Starts fresh dev server
4. Seeds all specs and domains
5. Imports transcripts
6. **Creates public ngrok tunnel** (auto-sharing enabled!)

---

### Reload Specs Only
```bash
npm run devS       # 🌱 Reload specs - keep all data + auto-share
```
Use when:
- You edit BDD specs (voice rules, behavior targets)
- You modify playbook configurations
- You want to test new prompt settings

**What it does:**
- ✅ Reloads voice rules and behavior targets
- ✅ Updates playbook configurations
- ✅ **PRESERVES** all caller data, measurements, memories
- ✅ **Creates/reuses public ngrok tunnel** (auto-sharing enabled!)

**What it DOESN'T affect:**
- Existing callers and their profiles
- Call history and transcripts
- Measurements and targets
- Memories and personality data

**Important:** New prompts generated after `devS` will use updated configs, but existing call data remains unchanged.

---

### Regular Development
```bash
npm run dev        # Standard Next.js dev server (local only)
npm run dev:share  # Dev server + ngrok tunnel (public URL)
npm run devX       # Hard restart (kill processes, clear cache)
```

#### Sharing with Colleagues
```bash
npm run dev:share
```
This will:
1. Start the dev server
2. Create an ngrok tunnel
3. Display a public URL like `https://abc123.ngrok.io`
4. Anyone with the URL can access your app

**Security Warning:** No authentication is enabled yet! Be careful who you share the URL with.

---

## Database Operations

### View Database
```bash
npm run prisma:studio    # Open Prisma Studio in browser
```

### Migrations
```bash
npm run prisma:status    # Check migration status
npm run prisma:dev       # Create and run new migration
npm run prisma:generate  # Regenerate Prisma client
```

### Manual Seeding
```bash
npm run prisma:seed      # Run default seed
npm run db:seed:all      # Seed all data
npm run db:reset         # Reset database schema
```

---

## Monitoring

### Live Logs
```bash
npm run logs             # Open positioned terminal with live server logs
```
Opens a terminal window on the right 1/4 of your screen showing live dev server output.

### Server Status
```bash
npm run dev:status       # Check if server is running
npm run dev:stop         # Stop background servers
```

---

## Testing

### Quick Validation
```bash
npm run tests            # Run unit tests + build (TypeScript check)
```
Use this before committing to catch both test failures and type errors.

### Unit Tests
```bash
npm run test             # Run all unit tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
```

### Integration Tests
```bash
npm run test:integration # Run integration tests
```

### E2E Tests (Playwright)
```bash
npm run test:e2e         # Run E2E tests
npm run test:e2e:ui      # Run with Playwright UI
npm run test:e2e:debug   # Run in debug mode
```

### All Tests
```bash
npm run test:all         # Run unit + integration + E2E
```

---

## Production

```bash
npm run build            # Build for production
npm run start            # Start production server
```

---

## Utilities

```bash
npm run lint             # Run ESLint
npm run ctl              # CLI control tool
npm run control          # CLI control menu
npm run help             # Show this guide in terminal
```

---

## Quick Decision Tree

**"I need to..."**

- **Start fresh** → `npm run devZZZ`
- **Reload configs after editing specs** → `npm run devS`
- **Fix a stuck server** → `npm run devX`
- **View database** → `npm run prisma:studio`
- **Watch logs** → `npm run logs`
- **Quick validation before commit** → `npm run tests`
- **Run unit tests only** → `npm run test`
- **See all commands** → `npm run help`

---

## What Each "dev" Command Does

| Command | Database | Specs | Caller Data | Server | Cache |
|---------|----------|-------|-------------|--------|-------|
| `dev` | - | - | - | ▶️ Start | - |
| `devX` | - | - | - | 🔄 Restart | 🗑️ Clear |
| `devS` | - | ♻️ Reload | ✅ Keep | - | - |
| `devZZZ` | 💣 Wipe | ♻️ Reload | 💣 Wipe | 🔄 Restart | 🗑️ Clear |

---

## Common Scenarios

### Scenario: "I edited voice rules and want to test them"
```bash
npm run devS           # Reload specs only
# Then generate a new prompt to see changes
```

### Scenario: "My server is stuck or behaving weird"
```bash
npm run devX           # Hard restart with cache clear
```

### Scenario: "I want to test with fresh data"
```bash
npm run devZZZ         # Full nuclear reset
```

### Scenario: "I want to see what's in the database"
```bash
npm run prisma:studio  # Open DB viewer
```

### Scenario: "I changed the Prisma schema"
```bash
npm run prisma:dev     # Create migration
npm run devZZZ         # Reload everything
```

---

## Notes

- All `dev*` scripts are bash scripts in `scripts/` directory
- Server logs are written to `/tmp/dev-server.log` or `/tmp/nextjs-dev.log`
- Port 3000 is used by default
- Most scripts will check if server is running before proceeding
