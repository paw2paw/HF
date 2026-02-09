# Registry Migration Guide

## Overview

The parameter registry is being migrated from a JSON file (`bdd-specs/behavior-parameters.registry.json`) to the database (`Parameter` table) as the single source of truth.

**Benefits:**
- ✅ No more sync scripts
- ✅ No gap between canonical definitions and database
- ✅ Single source of truth
- ✅ UI-manageable (admin API)
- ✅ Full audit trail in database
- ✅ Type-safe at build time

## Migration Steps

### Step 1: Apply Database Migration

```bash
npx prisma migrate dev
# This adds: isCanonical, deprecatedAt, replacedBy, aliases, defaultTarget to Parameter table
```

### Step 2: Migrate Existing Parameters

```bash
npm run registry:migrate-from-json
# This script:
# 1. Reads bdd-specs/behavior-parameters.registry.json
# 2. Updates existing parameters in database with registry values
# 3. Marks all as canonical (isCanonical=true)
# 4. Backs up old JSON file as registry.json.bak
```

### Step 3: Generate TypeScript Constants

```bash
npm run registry:generate
# This creates lib/registry/index.ts from database
# Generated file contains all PARAMS.*, TRAITS.*, SPECS.* constants
```

### Step 4: Validate Registry

```bash
npm run registry:validate
# Checks:
# - No orphaned parameters
# - No deprecated params in use
# - All aliases are unique
# - All replacedBy references exist
```

### Step 5: Update Build Process

Registry generation now runs automatically at build time:

```bash
npm run build
# Runs: prebuild (registry:generate + registry:validate) → next build
```

## After Migration

### Adding a New Parameter

**Before:**
1. Manually edit `bdd-specs/behavior-parameters.registry.json`
2. Run spec activation
3. Run `npm run registry:sync`

**After:**
1. Create/activate spec that declares the parameter
2. Parameter is created in database automatically
3. Done! (rebuild will auto-generate TypeScript constants)

### Deprecating a Parameter

**Before:**
- Manually edit JSON file
- Pray nothing breaks

**After:**
```bash
# Via API
curl -X PUT http://localhost:3000/api/admin/registry \
  -H "Content-Type: application/json" \
  -d '{
    "parameterId": "OLD-PARAM",
    "deprecatedAt": "2026-02-09T00:00:00Z",
    "replacedBy": "NEW-PARAM"
  }'

# Validation will warn if deprecated param is still in use
npm run registry:validate
```

### Viewing Registry Status

```bash
# View all active parameters
curl http://localhost:3000/api/admin/registry

# View deprecated parameters
curl http://localhost:3000/api/admin/registry?deprecated=true

# View orphaned parameters (not used anywhere)
curl http://localhost:3000/api/admin/registry?orphaned=true
```

## Scripts Reference

### npm run registry:generate
- Reads all canonical parameters from database
- Generates `lib/registry/index.ts` with type-safe constants
- Generates `bdd-specs/behavior-parameters.registry.json` (for reference only)
- Run after activating specs or modifying parameters

### npm run registry:validate
- Checks registry consistency
- Reports errors: deprecated params in use, duplicate aliases, missing replacements
- Reports warnings: orphaned parameters
- Fails build if errors found

### npm run registry:migrate-from-json (One-time)
- Reads old `bdd-specs/behavior-parameters.registry.json`
- Updates existing Parameter records with registry values
- Backs up old file
- Can only be run once per database

### npm run prebuild
- Runs `registry:generate` then `registry:validate`
- Runs automatically before `npm run build`
- Fails if validation errors occur

## Rollback (if needed)

If you need to revert to JSON-based registry:

```bash
# Restore backed up JSON file
cp bdd-specs/behavior-parameters.registry.json.bak bdd-specs/behavior-parameters.registry.json

# Revert schema changes
npx prisma migrate resolve --rolled-back <migration-name>

# Rebuild with old lib/registry/index.ts
git restore lib/registry/index.ts
npm run build
```

## FAQ

**Q: What happens to old registry.json?**
A: It's backed up as `registry.json.bak` and becomes read-only documentation. The database is now the source.

**Q: Can I still edit the JSON?**
A: You can, but changes won't be used. Always update via the database (UI or API).

**Q: What if I have custom parameters?**
A: If you've manually added parameters to the database, mark them `isCanonical: false` to exclude from generated constants.

**Q: How do I add parameters not in a spec?**
A: Either:
1. Create a spec that declares them
2. Manually add to Parameter table and mark `isCanonical: true`

**Q: What about version control?**
A: The generated `lib/registry/index.ts` should be committed. The JSON is for reference only.

## Timeline

- **Phase 1 (Now)**: Dual mode with migration script
- **Phase 2 (After successful migration)**: JSON becomes read-only documentation
- **Phase 3 (Later)**: Remove JSON file entirely once comfortable with DB-first approach
