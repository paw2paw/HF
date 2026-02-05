# HF Project TODO List

**Last Updated**: 2026-02-05

---

## High Priority

### 🔐 Authentication & Admin Users
**Status**: Not Started  
**Priority**: High  
**Estimated Effort**: 1-2 days

**Requirements:**
- Implement authentication system (NextAuth.js or similar)
- Create admin user registration/login flow
- Use new `User` model with `UserRole` enum (ADMIN, OPERATOR, VIEWER)
- Add RBAC (Role-Based Access Control) middleware
- Protect sensitive routes (/x/*, /api/*)

**Files to Create/Update:**
- `app/api/auth/[...nextauth]/route.ts` - NextAuth config
- `app/login/page.tsx` - Login UI
- `middleware.ts` - Route protection
- `lib/auth.ts` - Auth utilities

**Acceptance Criteria:**
- [ ] Admin users can register with email/password
- [ ] Login/logout flow works
- [ ] RBAC prevents non-admins from accessing admin pages
- [ ] Current session shows in UI (user name, role)
- [ ] Password hashing with bcrypt

---

## Medium Priority

### 📊 Run Analysis on Existing Callers
**Status**: Not Started  
**Priority**: Medium

**What to do:**
1. Go to http://localhost:3000/analyze
2. Select a caller (e.g., Paul)
3. Choose analysis specs (MEASURE for personality, LEARN for memories)
4. Run analysis to populate personality profiles and memories

**Or via API:**
```bash
# Analyze all callers
curl -X POST http://localhost:3000/api/callers/analyze-all
```

---

## Technical Debt

### 🔧 Refactoring
- [x] Separate User (admin) from Caller (end-user) models - **COMPLETED 2026-02-05**
- [ ] Migrate remaining UserMemory → CallerMemory table names
- [ ] Update ARCHITECTURE.md with new User/Caller distinction

### 🧪 Testing
- [ ] Add unit tests for critical business logic (per CLAUDE.md requirements)
- [ ] 80% test coverage minimum
- [ ] Tests for all lib/ functions

---

**Quick Commands:**
```bash
npm run devZZZ          # Nuclear reset
npx prisma studio       # View DB
```
