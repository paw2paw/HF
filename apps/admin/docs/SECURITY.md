# Security Model

> Last updated: February 2026

This document covers the trust bootstrap, authentication flows, secrets management, and security hardening for the HF platform.

## Trust Bootstrap: The First User

The first trusted user enters the system via infrastructure access — not through any public endpoint.

```
Infrastructure Access (SSH / Docker)
  └─ Run seed container with SEED_ADMIN_PASSWORD
       └─ Creates SUPERADMIN user (admin@test.com)
            └─ First login with password
                 └─ Password auto-cleared (one-time use)
                      └─ All future logins via magic-link (email)
                           └─ SUPERADMIN invites ADMINs
                                └─ ADMINs invite EDUCATORs, OPERATORs
                                     └─ EDUCATORs invite TEACHERs
                                          └─ TEACHERs share join links for STUDENTs
```

**Trust root:** Whoever has SSH/Docker access to run the seed script and knows `SEED_ADMIN_PASSWORD` controls the first SUPERADMIN account. This is the correct shape — the trust anchor is infrastructure access, not an open endpoint.

## Authentication Methods

### 1. Password (Bootstrap Only)

- Seed scripts create users with `passwordHash = bcrypt(SEED_ADMIN_PASSWORD)`
- **Passwords are single-use bootstrap credentials.** After successful login, the `passwordHash` is automatically cleared (`lib/auth.ts`)
- Next login attempt with password fails — must use magic-link
- Production seed scripts **refuse to run** without `SEED_ADMIN_PASSWORD` set (`NODE_ENV=production` guard)

**Files:** `lib/auth.ts` (CredentialsProvider), `prisma/seed-clean.ts`, `prisma/seed-educator-demo.ts`

### 2. Magic Link (Primary)

- User enters email on `/login`
- NextAuth `EmailProvider` sends a signed magic link via SMTP/Resend
- Clicking the link creates a JWT session
- No password involved — email ownership is the trust factor

**Files:** `lib/auth.ts` (EmailProvider), `lib/email.ts` (sendMagicLinkEmail)

### 3. Invite Token

- ADMIN+ creates an invite via `POST /api/invites`
- UUID token (122 bits entropy) emailed to recipient, expires in 7 days
- Recipient clicks link, fills name, gets a User + JWT session
- Invite is consumed (marked `usedAt`) — single-use

**Security controls:**
- Role validation: invite role must be a valid `UserRole` enum value
- SUPERADMIN can never be created via invite (`INVITABLE_ROLES` excludes it)
- Privilege escalation blocked: invite role level must be **strictly less than** creator's role level
- An ADMIN (level 4) can invite OPERATOR (3) and below, never another ADMIN or SUPERADMIN

**Files:** `app/api/invites/route.ts`, `app/api/invite/accept/route.ts`

### 4. Classroom Join Link

- Educators generate a join link for their classroom
- Token: 32 hex characters (128 bits entropy via `randomBytes(16)`)
- Mandatory 30-day expiry set on creation
- Students click link, enter name + email, get STUDENT role + JWT session
- Rate-limited on both GET (token verification) and POST (account creation)

**Files:** `app/api/join/[token]/route.ts`, `app/api/educator/classrooms/[id]/invite-link/route.ts`, `app/api/cohorts/[cohortId]/join-link/route.ts`

### 5. Future: OIDC / LDAP (Not Yet Implemented)

For enterprise customers. NextAuth supports additional providers:

| Directory Type | Integration Path | Status |
|---|---|---|
| Azure AD, Okta, Google Workspace | OIDC provider in NextAuth | Planned (TODO #10) |
| On-prem Active Directory (LDAP) | Custom CredentialsProvider with `ldapjs` | Future |

See MEMORY.md TODO #10 for OIDC implementation plan.

## Role Hierarchy

```
SUPERADMIN (5)  Full system access, institution management
ADMIN (4)       Operational admin, invites, broad access
OPERATOR (3)    Read + write operational data
EDUCATOR (3)    Educator portal, own cohorts + students only
SUPER_TESTER (2) Enhanced testing, domain-scoped data
TESTER (1)      Basic testing, own data only
STUDENT (1)     Student portal, own data only
VIEWER (1)      Read-only access (deprecated alias for TESTER)
DEMO (0)        Guided demo experience, read-only subset
```

Higher roles inherit all permissions of lower roles. Enforcement is per-route via `requireAuth("ROLE")` in `lib/permissions.ts`.

**Invite escalation protection:** An ADMIN (4) can only create invites for roles with level < 4 (i.e., OPERATOR and below). SUPERADMIN cannot be invited — only created via seed scripts with infrastructure access.

## Secrets Management

### Where Secrets Live

| Context | Location | Persistence |
|---|---|---|
| Local dev | `.env.local` (gitignored) | Developer machine only |
| Cloud Run (runtime) | GCP env vars or Secret Manager | Persists across deploys |
| Seed (one-off) | Passed as env var to Docker seed container | Ephemeral — not in runtime config |
| CI/tests | `.env.test` + `e2e/fixtures/` | Committed (test-only values) |

### Required Secrets

| Secret | Where | Purpose | When Needed |
|---|---|---|---|
| `DATABASE_URL` | Runtime + Seed | PostgreSQL connection | Always |
| `AUTH_SECRET` | Runtime | JWT session encryption | Always |
| `HF_SUPERADMIN_TOKEN` | Runtime | Programmatic API access | Always |
| `SEED_ADMIN_PASSWORD` | Seed only | Bootstrap SUPERADMIN password | Seed time only |
| `RESEND_API_KEY` or SMTP creds | Runtime | Magic-link emails, invites | When email is configured |
| `OPENAI_API_KEY` | Runtime | AI completions + embeddings | For AI features |
| `VAPI_WEBHOOK_SECRET` | Runtime | VAPI webhook HMAC verification | For voice integration |

### Secret Lifecycle

```
SEED_ADMIN_PASSWORD:
  Set → Seed runs → SUPERADMIN created with bcrypt hash → First login → Hash auto-cleared → Secret no longer needed

AUTH_SECRET:
  Set once → Used for all JWT encryption → Rotate by setting new value + restarting (invalidates all sessions)

HF_SUPERADMIN_TOKEN:
  Set once → Used for programmatic /api/auth/login → Rotate by updating env var
```

## Rate Limiting

In-memory rate limiter (`lib/rate-limit.ts`). 5 attempts per 15-minute window per IP.

| Endpoint | Rate Limit Key | Applied To |
|---|---|---|
| `POST /api/invite/accept` | `invite-accept` | Account creation via invite |
| `GET /api/invite/verify` | `invite-verify` | Invite token verification |
| `GET /api/join/[token]` | `join-verify` | Join token verification (prevents enumeration) |
| `POST /api/join/[token]` | `join` | Account creation via join link |
| `POST /api/auth/login` | `auth-login` | Programmatic API login |

**Limitation:** In-memory, not shared across Cloud Run instances. Adequate for market test (100 users). Upgrade path: Redis backend.

## Public Endpoints (No Auth Required)

| Route | Purpose | Protection |
|---|---|---|
| `/api/auth/*` | NextAuth sign-in/callback | Framework-managed |
| `/api/health` | Load balancer health check | Read-only, no data |
| `/api/ready` | Deployment readiness probe | Read-only, no data |
| `/api/system/readiness` | System readiness check | Read-only, no data |
| `/api/invite/verify` | Verify invite token | Rate-limited |
| `/api/invite/accept` | Accept invite | Rate-limited, token-validated |
| `/api/join/[token]` | Classroom join flow | Rate-limited, token-validated, expiry-checked |
| `/api/vapi/*` | VAPI webhook endpoints | HMAC signature verification (`lib/vapi/auth.ts`) |

All other routes require `requireAuth()`. CI enforces this via `tests/lib/route-auth-coverage.test.ts`.

## Security Hardening (February 2026)

### Fixes Applied

| Issue | Severity | Fix | File(s) |
|---|---|---|---|
| Invite role injection — ADMIN could create SUPERADMIN invites | **HIGH** | Role enum validation + `requestedLevel >= creatorLevel` check | `app/api/invites/route.ts` |
| Join token low entropy (48 bits) | **MEDIUM** | Increased to 128 bits (`randomBytes(16).toString("hex")`) | `invite-link/route.ts`, `join-link/route.ts` |
| Join tokens never expire | **MEDIUM** | Mandatory 30-day expiry on creation | `invite-link/route.ts`, `join-link/route.ts` |
| GET /api/join/[token] not rate-limited | **MEDIUM** | Added `checkRateLimit()` to GET handler | `app/api/join/[token]/route.ts` |
| Join POST missing expiry check | **MEDIUM** | Added `joinTokenExp` check to POST handler | `app/api/join/[token]/route.ts` |
| 409 response leaked email+classroom association | **LOW** | Generic message: "An account with this email already exists" | `app/api/join/[token]/route.ts` |
| Default seed password `admin123` in production | **LOW** | Fail-fast if `SEED_ADMIN_PASSWORD` not set when `NODE_ENV=production` | `prisma/seed-clean.ts`, `prisma/seed-educator-demo.ts` |
| Seed script logged plaintext password | **LOW** | Always prints `(SEED_ADMIN_PASSWORD)`, never the actual value | `prisma/seed-educator-demo.ts` |
| Seed password persists after first use | **LOW** | Auto-clear `passwordHash` after successful credentials login | `lib/auth.ts` |

### What's Solid

- **Institution CRUD:** Locked to SUPERADMIN (level 5)
- **Masquerade:** Anti-escalation check prevents masquerading as a higher role (`lib/masquerade.ts`)
- **Invite tokens (UUID):** 122 bits of entropy, 7-day expiry, single-use
- **RBAC enforcement:** Per-route `requireAuth()`, CI-enforced coverage scanner
- **VAPI webhooks:** HMAC-SHA256 signature verification (`lib/vapi/auth.ts`)
- **Email enumeration prevention:** Invite verify/accept return identical errors for "not found" vs "already used"

### Known Limitations (Acceptable for Market Test)

| Item | Risk | Mitigation |
|---|---|---|
| Rate limiter is in-memory | Not shared across instances | Adequate for 100 users; upgrade to Redis at scale |
| No institution scoping on admin invites | Multi-tenant data separation | Only relevant when multiple institutions share a deployment |
| Email verification bypassed on invite accept | Email ownership assumed from invite token delivery | Token was sent to that email, so ownership is implied |
| Join flow accepts unverified email | Student could claim another's email | Low risk in classroom context; teacher manages roster |
| No forced password rotation | Bootstrap password could persist | Mitigated by auto-clear on first login |

## Middleware

`middleware.ts` runs on the edge and provides:

1. **Session cookie check** — redirects unauthenticated requests to `/login` for page routes
2. **API token bypass** — routes with matching `x-internal-secret` header skip the cookie check (per-route `requireAuth()` still enforces role)
3. **CORS** — configured for allowed origins

**Important:** Middleware is a convenience gate, not the security boundary. The actual enforcement is `requireAuth()` in each route handler, which validates the JWT and checks role level.

## Adding a New Secure Endpoint

```typescript
import { requireAuth, isAuthError } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  // 1. Auth guard — choose minimum role
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

  // 2. Use session.user.id, session.user.role, etc.
  // 3. Validate all user input
  // 4. Return response
}
```

The CI coverage scanner (`tests/lib/route-auth-coverage.test.ts`) will fail if any route file is missing `requireAuth()`.
