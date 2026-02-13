# Role-Based Access Control (RBAC)

## Overview

Every API route is protected by `requireAuth()` from `lib/permissions.ts`. The middleware (`middleware.ts`) checks cookie existence on the edge, but **role enforcement happens per-route** because NextAuth encrypts JWTs and the edge runtime lacks crypto to decode them.

## Role Hierarchy

```
ADMIN (3)  →  Full system access
OPERATOR (2)  →  Read + write operational data
VIEWER (1)  →  Read-only access
```

Higher roles inherit all permissions of lower roles. An ADMIN can do everything an OPERATOR can, etc.

## Usage in Route Handlers

```typescript
import { requireAuth, isAuthError } from "@/lib/permissions";

export async function GET() {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;
  // ... handler logic
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult; // when you need session.user.id
  // ... handler logic
}
```

## Permission Matrix

| Route Pattern | GET | POST | PATCH/PUT | DELETE |
|---|---|---|---|---|
| `/api/admin/*` | ADMIN | ADMIN | ADMIN | ADMIN |
| `/api/x/*` (dev tools) | ADMIN | ADMIN | ADMIN | ADMIN |
| `/api/ai-config` | ADMIN | ADMIN | — | ADMIN |
| `/api/ai-keys` | ADMIN | ADMIN | — | ADMIN |
| `/api/ai-models/*` | ADMIN | — | ADMIN | ADMIN |
| `/api/invites` | ADMIN | ADMIN | — | ADMIN |
| `/api/system-settings` | ADMIN | ADMIN | — | — |
| `/api/subjects` | VIEWER | ADMIN | — | — |
| `/api/callers/*` | VIEWER | OPERATOR | OPERATOR | OPERATOR |
| `/api/calls/*` | VIEWER | OPERATOR | OPERATOR | — |
| `/api/pipeline/*` | VIEWER | OPERATOR | — | — |
| `/api/specs/*` | VIEWER | OPERATOR | OPERATOR | OPERATOR |
| `/api/playbooks/*` | VIEWER | OPERATOR | OPERATOR | OPERATOR |
| `/api/parameters/*` | VIEWER | OPERATOR | OPERATOR | — |
| `/api/analysis-specs/*` | VIEWER | OPERATOR | OPERATOR | ADMIN |
| `/api/domains/*` | VIEWER | OPERATOR | OPERATOR | OPERATOR |
| `/api/agents/*` | VIEWER | OPERATOR | OPERATOR | OPERATOR |
| `/api/content-sources/*` | VIEWER | OPERATOR | OPERATOR | OPERATOR |
| `/api/memories` | VIEWER | OPERATOR | — | — |
| `/api/messages/*` | VIEWER | OPERATOR | OPERATOR | OPERATOR |
| `/api/tickets/*` | VIEWER | OPERATOR | OPERATOR | OPERATOR |
| `/api/tasks` | VIEWER | OPERATOR | — | — |
| `/api/data-dictionary/*` | VIEWER | — | — | — |
| `/api/taxonomy-*` | VIEWER | — | — | — |
| `/api/analytics` | VIEWER | — | — | — |
| `/api/logs/*` | VIEWER | — | — | — |
| `/api/metering/*` | VIEWER | — | — | — |

## Public Routes (No Auth)

These routes are intentionally unprotected:

| Route | Reason |
|---|---|
| `/api/auth/*` | NextAuth sign-in/callback flow |
| `/api/health` | Load balancer health check |
| `/api/ready` | Deployment readiness probe |
| `/api/system/readiness` | System readiness check |
| `/api/invite` | Accept invite (token-based) |
| `/api/invite/verify` | Verify invite token |
| ~~`/api/sim/auth`~~ | ~~Sim access code login~~ (removed Feb 12 — sim uses invite/session auth now) |

## How It Works

1. **`requireAuth(minRole)`** calls NextAuth's `auth()` to get the session from the JWT
2. If no session → returns `{ error: 401 Unauthorized }`
3. If session exists but role level < required → returns `{ error: 403 Forbidden }`
4. If authorized → returns `{ session }` for handler use

The `isAuthError()` type guard uses a discriminated union pattern to provide type-safe access to either the error response or the session.

## Default Role

New users default to **OPERATOR** (changed from ADMIN in `prisma/schema.prisma`). Invited users get the role specified in their invite.

## Tests

- **Unit tests**: `tests/lib/permissions.test.ts` — 17 tests covering role hierarchy, unauthenticated access, edge cases
- **Coverage test**: `tests/lib/route-auth-coverage.test.ts` — scans all route files, verifies every non-public route calls `requireAuth()`, detects ad-hoc role checks

## Adding a New Route

1. Add `import { requireAuth, isAuthError } from "@/lib/permissions"`
2. Add the 2-line guard at the top of each handler
3. Choose the minimum role (VIEWER for reads, OPERATOR for writes, ADMIN for system config)
4. The coverage test will fail if you forget — it scans all route files automatically
