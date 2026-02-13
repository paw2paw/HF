# Agent Model Deprecation TODO

**Status:** Completed (Archived)
**Started:** 2026-02-01
**Completed:** 2026-02-01
**Branch:** feature/pipeline-solidify

---

## Summary

The `Agent` Prisma model is being deprecated. Identity data should be stored in `AnalysisSpec.config` or inline in Playbook. The manifest-based agent system (`AgentInstance`/`AgentRun`) handles operational pipeline agents and is NOT being deprecated.

---

## Completed Steps

### 1. Sidebar Navigation
- [x] Removed `/agents` entry from `src/components/shared/SidebarNav.tsx`

### 2. Schema Changes (`prisma/schema.prisma`)
- [x] Added deprecation warning to Agent model (lines 280-286)
- [x] Removed `Playbook -> Agent` FK relation
- [x] `agentId` is now just a string reference (no FK constraint)
- [x] Removed `playbooks Playbook[]` array from Agent model

### 3. API Route Updates
- [x] `app/api/callers/[callerId]/compose-prompt/route.ts` - Removed agent include, updated priority comments
- [x] `app/api/chat/system-prompts.ts` - Removed agent include and usage
- [x] `app/api/playbooks/[playbookId]/route.ts` - Removed agent includes (2 places)
- [x] `app/api/playbooks/[playbookId]/tree/route.ts` - Removed agent include, updated meta

### 4. Seed Scripts
- [x] `prisma/seed-from-specs.ts` - Disabled Agent creation from IDENTITY specs

### 5. Verification
- [x] `npx prisma generate` - Success
- [x] TypeScript check - No agent-related errors

---

## Completed Steps (continued)

### 6. Database Migration
- [x] Ran `npx prisma migrate reset --force` to apply all migrations
- [x] Ran `npx prisma db push --accept-data-loss` to sync remaining schema changes
- [x] Ran `npm run db:seed:all` - 8/10 seeds completed (2 missing files: seed-big-five.ts, seed-bdd.ts)

**Date completed:** 2026-02-01

### 7. Future Consolidation (Optional - Not Started)
When ready to fully merge Agents into Playbooks:
- [ ] Move identity fields (`roleStatement`, `primaryGoal`, etc.) inline into Playbook model
- [ ] Migrate existing Playbooks that reference agents via `agentId`
- [ ] Drop the Agent table entirely from schema
- [ ] Remove any remaining Agent-related code

---

## What Still Works

| Component | Status | Notes |
|-----------|--------|-------|
| `/agents` page | Works | Uses manifest-based agents, not Prisma Agent |
| `AgentInstance` | Works | Unaffected - operational pipeline agents |
| `AgentRun` | Works | Unaffected - execution history |
| `Playbook.agentId` | Works | Preserved as string for historical data |

---

## Files Modified

```
apps/admin/
├── prisma/
│   ├── schema.prisma                    # Agent model deprecated, Playbook FK removed
│   └── seed-from-specs.ts               # Agent creation disabled
├── src/components/shared/
│   └── SidebarNav.tsx                   # Agents removed from nav
└── app/api/
    ├── callers/[callerId]/compose-prompt/route.ts
    ├── chat/system-prompts.ts
    └── playbooks/[playbookId]/
        ├── route.ts
        └── tree/route.ts
```

---

## Decision: Consolidation Path

**Chosen:** Option C - Hybrid Deprecation (lowest risk)

1. Stop writing to Agent table (done)
2. Convert Playbook FK to string reference (done)
3. Hide from nav (done)
4. Keep table read-only for historical reference

**Future:** When ready, can fully consolidate identity into Playbook model.
