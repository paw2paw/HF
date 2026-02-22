# Unified AI Assistant

A consolidated AI assistant system that combines chat, task tracking, data exploration, and spec assistance into a single, flexible component.

## Features

- **4 Tabs**: Chat, Tasks, Data, Spec
- **3 Layouts**: Popout (slide-in), Embedded, Sidebar
- **Clear & Copy**: Per-tab functionality
- **Context-Aware**: Knows what entity you're viewing
- **Location-Aware**: Knows what page you're on
- **Mode-Specific**: AI behavior adapts to current tab

## Quick Start

### Basic Usage (Popout)

```tsx
import { UnifiedAssistantPanel } from "@/components/shared/UnifiedAssistantPanel";
import { useAssistant } from "@/hooks/useAssistant";

function MyPage() {
  const assistant = useAssistant({
    defaultTab: "chat",
    layout: "popout",
  });

  return (
    <>
      <button onClick={assistant.toggle}>
        Open AI Assistant
      </button>

      <UnifiedAssistantPanel
        visible={assistant.isOpen}
        onClose={assistant.close}
        context={assistant.context}
        location={assistant.location}
        {...assistant.options}
      />
    </>
  );
}
```

### With Context (Spec Example)

```tsx
function SpecDetailPage({ spec }: { spec: Spec }) {
  const assistant = useAssistant({
    defaultTab: "spec",
    layout: "popout",
  });

  const handleAskAI = () => {
    assistant.openWithSpec(spec);
  };

  return (
    <>
      <button onClick={handleAskAI}>
        Ask AI about this spec
      </button>

      <UnifiedAssistantPanel
        visible={assistant.isOpen}
        onClose={assistant.close}
        context={assistant.context}
        location={assistant.location}
        {...assistant.options}
      />
    </>
  );
}
```

### Embedded in Page

```tsx
function SpecEditorPage() {
  const assistant = useAssistant({
    layout: "embedded",
    enabledTabs: ["chat", "spec"], // Only show relevant tabs
  });

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Main content */}
      <div style={{ flex: 1 }}>
        <SpecEditor />
      </div>

      {/* Embedded assistant */}
      <div style={{ width: 400, borderLeft: "1px solid var(--border-default)" }}>
        <UnifiedAssistantPanel
          visible={true} // Always visible when embedded
          context={{ type: "spec", data: currentSpec }}
          location={{ page: "/x/specs/new", action: "create" }}
          {...assistant.options}
        />
      </div>
    </div>
  );
}
```

### Sidebar Layout

```tsx
function DashboardPage() {
  const assistant = useAssistant({
    layout: "sidebar",
    defaultTab: "jobs",
  });

  return (
    <>
      <Dashboard />

      {/* Floating sidebar */}
      <UnifiedAssistantPanel
        visible={assistant.isOpen}
        onClose={assistant.close}
        {...assistant.options}
      />

      {/* Toggle button */}
      <button
        onClick={assistant.toggle}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 998,
        }}
      >
        AI Assistant
      </button>
    </>
  );
}
```

## Props

### UnifiedAssistantPanel

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `visible` | `boolean` | `false` | Whether the panel is visible |
| `onClose` | `() => void` | - | Callback when panel is closed |
| `context` | `AssistantContext` | - | Entity context (spec, caller, etc.) |
| `location` | `AssistantLocation` | - | Current page/route context |
| `defaultTab` | `AssistantTab` | `"chat"` | Initial tab to show |
| `layout` | `AssistantLayout` | `"popout"` | Layout mode |
| `enabledTabs` | `AssistantTab[]` | `["chat", "jobs", "data", "spec"]` | Which tabs to show |
| `endpoint` | `string` | `"/api/ai/assistant"` | API endpoint |

### AssistantContext

```typescript
{
  type: "spec" | "parameter" | "domain" | "caller";
  data: any; // The actual entity data
}
```

### AssistantLocation

```typescript
{
  page: string;           // Current route (e.g., "/x/specs")
  section?: string;       // Section within page
  entityType?: string;    // Type of entity being viewed
  entityId?: string;      // ID of entity being viewed
  action?: string;        // Action being performed
}
```

## Tabs

### Chat Tab
General conversational AI assistant with full system knowledge.

### Tasks Tab
Shows active tasks and guidance (integrates with FlashSidebar).

### Data Tab
Data exploration and queries.

### Spec Tab
Spec-specific assistance (creation, understanding, troubleshooting).

## Actions

Each tab has two actions:

- **Clear**: Clears all messages/content for that tab
- **Copy**: Copies tab content to clipboard

## Layouts

### Popout (Default)
- Slides in from right side
- Full height
- Backdrop overlay
- Close button

### Embedded
- Inline component
- No backdrop
- No close button (parent controls visibility)
- Fits container size

### Sidebar
- Floating panel (top-right)
- Smaller size (360px wide)
- No backdrop
- Close button

## Backend Integration

The assistant calls `/api/ai/assistant` with:

```typescript
{
  message: string;
  context?: AssistantContext;
  location?: AssistantLocation;
  mode: "chat" | "jobs" | "data" | "spec"; // Current tab
  history: Array<{ role: string; content: string }>;
}
```

The backend adapts its behavior based on the `mode` parameter.

## Migration from Old Systems

### From AIAssistantPanel

```diff
- import { AIAssistantPanel } from "@/components/shared/AIAssistantPanel";
+ import { UnifiedAssistantPanel } from "@/components/shared/UnifiedAssistantPanel";
+ import { useAssistant } from "@/hooks/useAssistant";

- const [visible, setVisible] = useState(false);
+ const assistant = useAssistant();

- <AIAssistantPanel
-   visible={visible}
-   onClose={() => setVisible(false)}
+ <UnifiedAssistantPanel
+   visible={assistant.isOpen}
+   onClose={assistant.close}
+   {...assistant.options}
  />
```

### From ChatPanel

The `UnifiedAssistantPanel` replaces `ChatPanel` with a simpler API. Use the `mode` parameter to switch between chat modes.

### From FlashSidebar

Tasks now appear in the "Tasks" tab. The `UnifiedAssistantPanel` automatically loads and displays active tasks.

## Examples

See `/apps/admin/app/x/specs/page.tsx` for a full working example.
