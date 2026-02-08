# HumanFirst Control CLI

A powerful command-line interface for managing the HumanFirst Admin application.

## Quick Start

### Interactive Menu (Recommended)
```bash
npm run control
```

This opens an interactive menu where you can:
- Run migrations with optional tests
- Manage database (reset, seed)
- Run tests (unit, integration, E2E)
- Start dev server
- Build application

### Command Line Usage
```bash
npm run ctl <command> [options]
```

---

## Commands

### 📦 Database Management

#### Run Migrations
```bash
# Basic migration
npm run ctl migrate

# Migrate + run tests
npm run ctl migrate --test

# Migrate + seed database
npm run ctl migrate --seed

# Reset + migrate (destructive!)
npm run ctl migrate --reset --seed
```

#### Database Operations
```bash
# Reset database (with confirmation)
npm run ctl db:reset

# Reset + seed
npm run ctl db:reset --seed

# Seed database
npm run ctl db:seed

# Seed specific datasets
npm run ctl db:seed --mabel   # Full Mabel dataset
npm run ctl db:seed --wnf     # WNF domain only
npm run ctl db:seed --safe    # SAFE dataset

# Open Prisma Studio
npm run ctl db:studio
```

#### Migration Utilities
```bash
# Check migration status
npm run ctl migrate:status

# Create new migration
npm run ctl migrate:create add-new-field
```

---

### 🧪 Testing

#### Run Tests
```bash
# Run all tests (unit + integration + E2E)
npm run ctl test

# Run specific test types
npm run ctl test --unit           # Unit tests only
npm run ctl test --integration    # Integration tests only (auto-starts dev server)
npm run ctl test --e2e            # E2E tests only (auto-starts dev server)

# With coverage
npm run ctl test --coverage

# Watch mode
npm run ctl test --watch

# E2E with UI
npm run ctl test:ui
```

**Note:** Integration and E2E tests automatically start the dev server, wait for it to be ready, run the tests, and then stop the server. No manual server management required!

---

### 🚀 Development

#### Start Development Server
```bash
# Start dev server
npm run ctl dev

# Start with Docker
npm run ctl dev --docker

# Stop dev server
npm run ctl dev:stop

# Check status
npm run ctl dev:status
```

#### Build & Deploy
```bash
# Build for production
npm run ctl build

# Build + run all tests
npm run ctl build:test
```

---

### 🔍 Quality Checks

#### Linting
```bash
# Run linter
npm run ctl lint

# Auto-fix issues
npm run ctl lint --fix
```

#### Run All Checks
```bash
# Lint + Type check + Tests
npm run ctl check
```

---

### 🛠️ Utilities

#### Clean Build Artifacts
```bash
npm run ctl clean
```
Removes `.next`, `node_modules`, `coverage`, and test artifacts.

---

## Common Workflows

### 1. Fresh Start
```bash
npm run ctl migrate --reset --seed --test
```
Resets database, runs migrations, seeds data, and runs tests.

### 2. Pre-Commit Check
```bash
npm run ctl check
```
Runs lint, type check, and all tests.

### 3. Deploy Preparation
```bash
npm run ctl build:test
```
Runs full test suite then builds for production.

### 4. Daily Development
```bash
# Option 1: Interactive menu
npm run control

# Option 2: Direct commands
npm run ctl migrate --seed
npm run ctl dev
```

---

## Interactive Menu

The interactive menu provides a visual interface for all operations:

```
╔═══════════════════════════════════════════════════╗
║       HumanFirst Admin - Control Panel          ║
╚═══════════════════════════════════════════════════╝

📦 Database
  1. Run migrations
  2. Run migrations + tests
  3. Reset database
  4. Seed database
  5. Open Prisma Studio

🧪 Testing
  6. Run all tests
  7. Run unit tests
  8. Run integration tests
  9. Run E2E tests
  10. Run E2E tests (UI mode)

🚀 Development
  11. Start dev server
  12. Build application
  13. Build + Test pipeline
  14. Run all checks

  0. Exit
```

Just select a number and press Enter!

---

## Examples

### Scenario: New Feature Branch
```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Reset database with fresh seed
npm run ctl migrate --reset --seed

# Run tests to ensure everything works
npm run ctl test

# Start development
npm run ctl dev
```

### Scenario: Before Creating PR
```bash
# Run all quality checks
npm run ctl check

# Run E2E tests
npm run ctl test --e2e

# Build to ensure no build errors
npm run ctl build
```

### Scenario: Migration Changes
```bash
# Create migration
npm run ctl migrate:create add-user-preferences

# Run migration + tests
npm run ctl migrate --test

# If tests pass, seed dev data
npm run ctl db:seed
```

---

## Tips

1. **Use Interactive Menu for Exploration**
   - Great when you're not sure what command you need
   - Easy to try different operations

2. **Use CLI Commands for Automation**
   - Faster for repeated workflows
   - Can be scripted or aliased

3. **Always Test After Migrations**
   ```bash
   npm run ctl migrate --test
   ```

4. **Use Specific Seeds for Focused Work**
   ```bash
   npm run ctl db:seed --wnf  # Only WNF data
   ```

5. **Check Status Before Migrating**
   ```bash
   npm run ctl migrate:status
   ```

---

## Troubleshooting

### Command Not Found
```bash
# Install dependencies first
npm install

# Verify commander is installed
npm list commander
```

### Permission Denied
```bash
chmod +x cli/control.ts
```

### Database Connection Error
```bash
# Check if PostgreSQL is running
npm run ctl dev:status

# Start Docker containers if using Docker
npm run ctl dev --docker
```

---

## Adding Custom Commands

Edit `cli/control.ts` to add your own commands:

```typescript
program
  .command('my-command')
  .description('My custom command')
  .action(() => {
    exec('my-script.sh', 'Running my script...');
  });
```

---

## Keyboard Shortcuts

When in interactive menu:
- **0** - Exit
- **Enter** - Execute selected option
- **Ctrl+C** - Force quit

---

Happy controlling! 🎮
