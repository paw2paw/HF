# User Preferences and Multi-User Isolation

This document describes the user preference and data isolation system implemented in the HumanFirst admin application.

## Overview

The admin application supports multiple users with isolated preferences. Each user's UI customizations are stored separately in localStorage using user-specific keys derived from their authenticated session.

## Architecture

### Session-Based Isolation

All preference storage uses the `next-auth` session to identify the current user:

```typescript
import { useSession } from "next-auth/react";

const { data: session } = useSession();
const userId = session?.user?.id;

// Storage key pattern: ${PREFIX}.${userId}
const storageKey = userId ? `${PREFIX}.${userId}` : PREFIX;
```

### Components with User Isolation

| Component | Storage Key Pattern | Data Stored |
|-----------|---------------------|-------------|
| ChatContext | `hf.chat.history.${userId}` | Chat messages per mode (CHAT, DATA, SPEC) |
| ChatContext | `hf.chat.settings.${userId}` | Panel state, active mode, layout preference |
| DraggableTabs | `tab-order:${storageKey}.${userId}` | Custom tab ordering per tab set |
| SimpleSidebarNav | `hf.sidebar.section-order.${userId}` | Sidebar section ordering |

### Fallback Behavior

When no user is authenticated (anonymous session):
- Preferences fall back to the base key without userId suffix
- This allows the app to function without authentication
- When a user logs in, their preferences are loaded from user-specific keys

## Feature Details

### Chat History Isolation

**Location**: `contexts/ChatContext.tsx`

The chat system maintains separate message histories and settings per user:

- **Messages**: Stored by mode (CHAT, DATA, SPEC), max 50 per mode
- **Settings**: Panel open state, active mode, layout (vertical/horizontal/popout)
- **Reload on Login**: When userId changes, the system reloads user-specific data

```typescript
// User change detection
useEffect(() => {
  if (session === undefined) return;
  if (userId !== lastUserId) {
    const persistedMessages = loadPersistedMessages(userId);
    const settings = loadSettings(userId);
    // ... apply to state
    setLastUserId(userId);
  }
}, [userId, lastUserId, session]);
```

### Draggable Tab Ordering

**Location**: `components/shared/DraggableTabs.tsx`

Users can drag tabs to reorder them. The order is persisted per-user:

- **Drag-and-Drop**: HTML5 Drag and Drop API
- **Storage**: Tab IDs stored as JSON array
- **Reset**: Arrow button appears when custom order differs from default
- **Migration**: Handles new/removed tabs gracefully

Usage:
```tsx
<DraggableTabs
  storageKey="my-tabs"
  tabs={[{ id: "tab1", label: "First" }, { id: "tab2", label: "Second" }]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  showReset={true}
/>
```

### Sidebar Section Ordering

**Location**: `src/components/shared/SimpleSidebarNav.tsx`

The simplified sidebar (`/x/*` routes) allows dragging sections:

- **Sections**: Prompts, Playbooks, History, Data, Configure, Operations
- **Reset Button**: Appears in header when custom order active
- **Per-User Storage**: Uses session userId for isolation

## Tab Storage Keys Reference

| Page | Storage Key |
|------|-------------|
| `/x/pipeline` | `pipeline-tabs` |
| `/x/domains` | `domain-detail-tabs-${domainId}` |
| `/x/specs` | `spec-detail-tabs-${specId}` |
| `/x/import` | `import-tabs` |
| `/analysis-specs` | `analysis-specs-tabs` |
| `/domains/[id]` | `domain-detail-${domainId}` |
| `/settings-library` | `settings-library-tabs` |
| `/data-dictionary` | `data-dictionary-tabs` |
| `/lab/features/[id]` | `lab-feature-${featureId}` |
| `/callers/[id]` | `call-detail-tabs-${callId}` |

## Testing Considerations

### Unit Tests

See `__tests__/ui/user-preferences.test.ts` for:
- Storage key generation with/without userId
- User change detection
- Reset functionality
- Drag-and-drop ordering

### Integration Tests

See `features/user-preferences.feature` for BDD scenarios covering:
- Multi-user isolation
- Preference persistence across sessions
- Reset to defaults
- Anonymous user fallback

## Security Notes

1. **No Sensitive Data**: Only UI preferences are stored (no auth tokens, no PII)
2. **Client-Side Only**: localStorage is never synced to server
3. **User Scope**: Each user can only access their own preferences
4. **Graceful Degradation**: Works without authentication using anonymous storage
