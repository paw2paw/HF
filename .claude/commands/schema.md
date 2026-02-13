---
description: Show Prisma schema — models, relations, migrations
---

Show Prisma schema overview — models, relations, and recent migrations

Read `apps/admin/prisma/schema.prisma` and provide:

## 1. Model Summary
List all models with their field count and key relations in a table:

| Model | Fields | Key Relations |
|-------|--------|---------------|
| User  | 12     | sessions, invites |
| Caller | 15    | calls, memories, personality |

## 2. Enums
List all enum types and their values.

## 3. Recent Migrations
Run `npx prisma migrate status` in `apps/admin/` and report which migrations have been applied.

## 4. Schema Warnings
Flag any potential issues:
- Models without `createdAt`/`updatedAt`
- Missing indexes on foreign keys used in WHERE clauses
- Relations without cascade delete rules

Keep the output scannable — tables and bullet points, no paragraphs.
