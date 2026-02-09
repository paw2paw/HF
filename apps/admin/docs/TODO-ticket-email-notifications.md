# TODO: Ticket Email Notifications

## Overview
Add email notification preferences to Users for the Tickets system. Users can choose to receive emails when assigned to tickets or mentioned in comments, with configurable frequency (immediate or daily digest).

---

## Phase 1: Database Schema Changes

### 1.1 Add NotificationFrequency enum
**File**: `prisma/schema.prisma`

```prisma
enum NotificationFrequency {
  IMMEDIATE   // Send email right away
  DAILY       // Aggregate into daily digest (8am)
}
```

### 1.2 Add notification fields to User model
**File**: `prisma/schema.prisma` (User model, ~line 489)

```prisma
// Notification preferences
notifyOnAssigned    Boolean               @default(true)
notifyOnMentioned   Boolean               @default(true)
notifyFrequency     NotificationFrequency @default(IMMEDIATE)
lastDigestSentAt    DateTime?             // Track last digest send time
```

### 1.3 (Optional) Add NotificationEvent model for tracking
```prisma
model NotificationEvent {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  type        String   // "ASSIGNED" | "MENTIONED"
  ticketId    String
  ticket      Ticket   @relation(fields: [ticketId], references: [id])
  commentId   String?  // If triggered by a comment
  emailSent   Boolean  @default(false)
  emailSentAt DateTime?
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([ticketId])
  @@index([emailSent, createdAt])
}
```

### 1.4 Run migration
```bash
cd apps/admin
npx prisma migrate dev --name add-notification-preferences
```

---

## Phase 2: Email Service

### 2.1 Create Resend email client
**File**: `lib/email/resend.ts`

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'HF Admin <noreply@example.com>',
    to,
    subject,
    html,
  });
}
```

### 2.2 Create email templates
**File**: `lib/email/templates/ticket-assigned.ts`
- Subject: "You've been assigned to Ticket #{{ticketNumber}}"
- Body: Ticket title, description preview, link to ticket

**File**: `lib/email/templates/ticket-mentioned.ts`
- Subject: "You were mentioned in Ticket #{{ticketNumber}}"
- Body: Comment excerpt, commenter name, link to ticket

**File**: `lib/email/templates/daily-digest.ts`
- Subject: "Your Daily Ticket Summary"
- Body: List of assignments/mentions since last digest

### 2.3 Create notification service
**File**: `lib/email/notification-service.ts`

```typescript
export async function notifyTicketAssigned(ticketId: string, assigneeId: string): Promise<void>
export async function notifyTicketMention(ticketId: string, commentId: string, mentionedUserIds: string[]): Promise<void>
export async function sendDailyDigest(userId: string): Promise<void>
```

Logic:
1. Check user's `notifyOnAssigned` / `notifyOnMentioned` preference
2. Check user's `notifyFrequency` preference
3. If IMMEDIATE → send email now
4. If DAILY → create NotificationEvent record (will be sent in digest)

---

## Phase 3: API Endpoints

### 3.1 Get notification preferences
**File**: `app/api/user/notifications/preferences/route.ts`

```typescript
// GET /api/user/notifications/preferences
// Returns: { notifyOnAssigned, notifyOnMentioned, notifyFrequency }
```

### 3.2 Update notification preferences
**File**: `app/api/user/notifications/preferences/route.ts`

```typescript
// PATCH /api/user/notifications/preferences
// Body: { notifyOnAssigned?, notifyOnMentioned?, notifyFrequency? }
// Returns: updated preferences
```

---

## Phase 4: Integration Hooks

### 4.1 Ticket assignment notification
**File**: `app/api/tickets/[ticketId]/route.ts` (PATCH handler)

When `assigneeId` changes:
```typescript
if (data.assigneeId && data.assigneeId !== existingTicket.assigneeId) {
  await notifyTicketAssigned(ticketId, data.assigneeId);
}
```

### 4.2 Mention detection in comments
**File**: `app/api/tickets/[ticketId]/comments/route.ts` (POST handler)

Parse `@username` or `@email` mentions from comment content:
```typescript
const mentions = parseMentions(content); // Returns user IDs
if (mentions.length > 0) {
  await notifyTicketMention(ticketId, newComment.id, mentions);
}
```

### 4.3 Mention parser utility
**File**: `lib/email/parse-mentions.ts`

```typescript
// Regex patterns to detect:
// @john.doe → lookup by name
// @john@example.com → lookup by email
export function parseMentions(content: string): Promise<string[]> // Returns user IDs
```

---

## Phase 5: Daily Digest Cron Job

### 5.1 Create digest endpoint
**File**: `app/api/cron/send-digests/route.ts`

```typescript
// POST /api/cron/send-digests
// Protected by CRON_SECRET header
// Queries NotificationEvents where emailSent=false, grouped by user
// For users with notifyFrequency=DAILY, sends digest email
// Marks events as emailSent=true
```

### 5.2 Configure Vercel Cron
**File**: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/send-digests",
      "schedule": "0 8 * * *"
    }
  ]
}
```

---

## Phase 6: Settings UI

### 6.1 Add notifications tab to user settings
**Location**: User profile/settings page (TBD - may need to create)

UI Elements:
- [ ] Toggle: "Email me when assigned to a ticket" (`notifyOnAssigned`)
- [ ] Toggle: "Email me when mentioned in a comment" (`notifyOnMentioned`)
- [ ] Radio group: "Send frequency"
  - [ ] "Immediately" (`IMMEDIATE`)
  - [ ] "Daily digest at 8am" (`DAILY`)
- [ ] Save button → calls PATCH /api/user/notifications/preferences

### 6.2 Visual design
- Use existing form/toggle components from the design system
- Group under "Notifications" section
- Show email address that notifications will be sent to (from User.email)

---

## Testing Checklist

- [ ] Migration runs without errors
- [ ] GET preferences returns defaults for new users
- [ ] PATCH preferences updates correctly
- [ ] Assigning a ticket sends email (when IMMEDIATE)
- [ ] Assigning a ticket creates event (when DAILY)
- [ ] @mention in comment triggers notification
- [ ] Daily digest includes pending events
- [ ] Daily digest marks events as sent
- [ ] Preferences toggles disable notifications correctly
- [ ] UI reflects current preferences
- [ ] UI saves changes successfully

---

## Dependencies

**Already installed**:
- `resend` - Email API (configured in .env.local)
- `nodemailer` - Backup option if needed

**May need**:
- `@vercel/cron` - For scheduled digest jobs (or use Vercel dashboard)

---

## Environment Variables

Already configured:
```
EMAIL_FROM="HF Admin <hfadmin@contact.thewanders.com>"
RESEND_API_KEY="re_xxx..." (in .env.local)
```

May need to add:
```
CRON_SECRET="..." (for securing cron endpoint)
```

---

## File Summary

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add enum + User fields + NotificationEvent model |
| `lib/email/resend.ts` | Create - Resend client wrapper |
| `lib/email/notification-service.ts` | Create - Core notification logic |
| `lib/email/parse-mentions.ts` | Create - @mention parser |
| `lib/email/templates/*.ts` | Create - Email HTML templates |
| `app/api/user/notifications/preferences/route.ts` | Create - GET/PATCH preferences |
| `app/api/tickets/[ticketId]/route.ts` | Modify - Add assignment hook |
| `app/api/tickets/[ticketId]/comments/route.ts` | Modify - Add mention hook |
| `app/api/cron/send-digests/route.ts` | Create - Daily digest job |
| `vercel.json` | Modify - Add cron schedule |
| User settings UI (TBD) | Create - Notification preferences UI |
