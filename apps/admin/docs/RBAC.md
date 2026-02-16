# Role-Based Access Control (RBAC)

> Last updated: February 2026. For full security model, see [SECURITY.md](SECURITY.md).

## Overview

Every API route is protected by `requireAuth()` from `lib/permissions.ts`. The middleware (`middleware.ts`) checks cookie existence on the edge, but **role enforcement happens per-route** because NextAuth encrypts JWTs and the edge runtime lacks crypto to decode them.

## Role Hierarchy

```
SUPERADMIN (5)   Full system access, institution management, seed-only creation
ADMIN (4)        Operational admin, invites, user management, broad access
OPERATOR (3)     Read + write operational data (specs, callers, pipeline)
EDUCATOR (3)     Educator portal — own cohorts + students only (same level as OPERATOR, different scope)
SUPER_TESTER (2) Enhanced testing, domain-scoped data
TESTER (1)       Basic testing, own data only
STUDENT (1)      Student portal, own data only (same level as TESTER, different scope)
VIEWER (1)       Read-only access (@deprecated — alias for TESTER level)
DEMO (0)         Guided demo experience, read-only subset
```

Higher roles inherit all permissions of lower roles. An ADMIN can do everything an OPERATOR can, etc.

**Invite escalation protection:** Users can only invite roles with a **strictly lower** level than their own. SUPERADMIN cannot be created via invite — only via seed scripts with infrastructure access. See [SECURITY.md](SECURITY.md) for details.

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
| `/api/institutions/*` | SUPERADMIN | SUPERADMIN | SUPERADMIN | SUPERADMIN |
| `/api/invites` | ADMIN | ADMIN | — | ADMIN |
| `/api/x/*` (dev tools) | ADMIN | ADMIN | ADMIN | ADMIN |
| `/api/ai-config` | ADMIN | ADMIN | — | ADMIN |
| `/api/ai-keys` | ADMIN | ADMIN | — | ADMIN |
| `/api/ai-models/*` | ADMIN | — | ADMIN | ADMIN |
| `/api/system-settings` | ADMIN | ADMIN | — | — |
| `/api/educator/*` | EDUCATOR | EDUCATOR | EDUCATOR | EDUCATOR |
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

| Route | Reason | Protection |
|---|---|---|
| `/api/auth/*` | NextAuth sign-in/callback flow | Framework-managed |
| `/api/health` | Load balancer health check | Read-only |
| `/api/ready` | Deployment readiness probe | Read-only |
| `/api/system/readiness` | System readiness check | Read-only |
| `/api/invite/verify` | Verify invite token | Rate-limited |
| `/api/invite/accept` | Accept invite | Rate-limited, token-validated |
| `/api/join/[token]` | Classroom join flow | Rate-limited, token-validated, 30-day expiry |
| `/api/vapi/*` | VAPI webhook endpoints | HMAC-SHA256 signature verification |

## Masquerade (Step In)

ADMIN+ users can impersonate lower-role users via cookie-based masquerade (`lib/masquerade.ts`).

- Only ADMIN (4) and SUPERADMIN (5) can masquerade
- **Role escalation is blocked** — cannot masquerade as equal or higher role
- 8-hour max duration
- `skipMasquerade` option for masquerade management routes
- Purple border + banner indicates active masquerade

## How It Works

1. **`requireAuth(minRole)`** calls NextAuth's `auth()` to get the session from the JWT
2. If no session -> returns `{ error: 401 Unauthorized }`
3. If masquerade cookie present and user is ADMIN+ -> swaps session identity (role escalation blocked)
4. If session role level < required -> returns `{ error: 403 Forbidden }`
5. If authorized -> returns `{ session }` for handler use

The `isAuthError()` type guard uses a discriminated union pattern to provide type-safe access to either the error response or the session.

## Default Role

New users default to **OPERATOR** (`prisma/schema.prisma`). Invited users get the role specified in their invite. Students created via join links get **STUDENT**.

## Tests

- **Unit tests**: `tests/lib/permissions.test.ts` — role hierarchy, unauthenticated access, edge cases
- **Coverage test**: `tests/lib/route-auth-coverage.test.ts` — scans all route files, verifies every non-public route calls `requireAuth()`, detects ad-hoc role checks. CI fails if any route lacks auth.

## Adding a New Route

1. Add `import { requireAuth, isAuthError } from "@/lib/permissions"`
2. Add the 2-line guard at the top of each handler
3. Choose the minimum role (VIEWER for reads, OPERATOR for writes, ADMIN for system config, SUPERADMIN for institution management)
4. The coverage test will fail if you forget — it scans all route files automatically
