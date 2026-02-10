# Flash Sidebar & Task Tracking Integration

## What Was Built

A complete **task guidance system** with a beautiful flash sidebar that helps users complete complex tasks.

## Components

### 1. **FlashSidebar Component** (`/components/shared/FlashSidebar.tsx`)

A slide-in sidebar that shows:
- **Progress tracking**: Visual progress bar showing current step
- **Contextual tips**: Based on what step user is on
- **Next actions**: Prioritized list of what to do next
- **Warnings**: If user is stuck or has blockers

**Features:**
- Smooth slide-in animation
- Auto-loads guidance from task API
- Backdrop with blur effect
- Responsive and accessible

### 2. **Integrated into Spec Creation** (`/app/x/specs/new/page.tsx`)

**Task Flow:**
1. User opens page → Task starts automatically
2. User moves through steps → Progress updates in real-time
3. User completes spec → Task marked complete

**UI Elements:**
- "✨ Show Guidance" button in AI header
- Flash sidebar slides in from right
- Shows step-by-step guidance as user works

### 3. **Task API** (`/app/api/tasks/route.ts`)

**Endpoints:**
- `POST /api/tasks` - Start new task
- `PUT /api/tasks` - Update progress
- `GET /api/tasks?taskId=xxx` - Get guidance
- `DELETE /api/tasks?taskId=xxx` - Complete task

## How It Works

### Example: Creating a Spec

```
┌─────────────────────────────────────────────────┐
│ User Opens /x/specs/new                         │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Task System: Start "create_spec" task          │
│ • taskId = "abc123"                             │
│ • currentStep = 1                               │
│ • totalSteps = 4                                │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ User Clicks "✨ Show Guidance"                  │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Flash Sidebar Appears                           │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ ✨ Task Guidance                        │   │
│ │ Basic Information                        │   │
│ │                                          │   │
│ │ PROGRESS                                 │   │
│ │ Step 1 of 4                              │   │
│ │ ████░░░░ 25%                             │   │
│ │                                          │   │
│ │ Define the core identity: ID, title,    │   │
│ │ domain, and classification              │   │
│ │                                          │   │
│ │ 💡 Tips                                  │   │
│ │ • Use AI to auto-fill fields            │   │
│ │ • Check for existing specs first        │   │
│ │                                          │   │
│ │ 📋 Next Steps                            │   │
│ │ 1. Fill in basic info (2 min)           │   │
│ │ 2. Write user story (3 min)             │   │
│ │                                          │   │
│ └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ User Fills Basic Info → Moves to Step 2        │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Task System: Update currentStep = 2            │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Flash Sidebar Auto-Updates                      │
│ • New step title: "User Story"                 │
│ • New tips for step 2                          │
│ • Progress bar: 50%                            │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ User Completes Spec → Clicks "Create"          │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Task System: Mark task complete                │
│ DELETE /api/tasks?taskId=abc123                │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Redirect to new spec page                      │
└─────────────────────────────────────────────────┘
```

## Task Definitions

Tasks are defined in [lib/ai/task-guidance.ts](../lib/ai/task-guidance.ts):

### create_spec
- **Step 1**: Basic Information (2 min)
- **Step 2**: User Story (3 min)
- **Step 3**: Parameters (5 min)
- **Step 4**: Review & Create (1 min)

### configure_caller
- **Step 1**: Caller Profile (2 min)
- **Step 2**: Personality Settings (5 min)
- **Step 3**: Goals & Learning (5 min)

## AI Learning Integration

The flash sidebar works together with knowledge accumulation:

**User stuck on step → Warning appears:**
```
⚠️ You've been on this step for 30 min - need help?
```

**AI learns patterns:**
- Users who spend >20 min on step 3 usually need parameter examples
- After seeing this 5 times, AI proactively suggests examples on step 3

## Visual Design

### Colors & Styling

**Primary Gradient:**
```css
background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)
```

**Progress Bar:**
```css
background: linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)
```

**Animations:**
- Slide in: `cubic-bezier(0.16, 1, 0.3, 1)` - Smooth, bouncy
- Fade backdrop: `0.2s ease-out`
- Spin loader: `1s linear infinite`

### Icons
- ✨ Task Guidance
- 💡 Tips
- ⚡ Shortcuts
- ⚠️ Warnings
- 📋 Next Steps

## Testing It Out

1. **Start the app:**
   ```bash
   npm run dev
   ```

2. **Navigate to spec creation:**
   ```
   http://localhost:3000/x/specs/new
   ```

3. **Click "✨ Show Guidance"**
   - Flash sidebar slides in
   - Shows step 1 guidance
   - Progress bar at 0%

4. **Fill in basic info, move to step 2**
   - Progress updates to 25%
   - New guidance appears

5. **Complete the spec**
   - Task marked complete
   - Redirect to new spec

## Database Schema

### UserTask Table
```prisma
model UserTask {
  id              String     @id @default(uuid())
  userId          String
  user            User       @relation("UserTasks", fields: [userId], references: [id])
  taskType        String     // "create_spec", "configure_caller", etc.
  status          TaskStatus @default(in_progress)
  currentStep     Int        @default(1)
  totalSteps      Int
  completedSteps  String[]   // Array of completed step IDs
  blockers        String[]   // Array of blocker descriptions
  context         Json?      // Task-specific context
  startedAt       DateTime   @default(now())
  completedAt     DateTime?
  updatedAt       DateTime   @updatedAt
}
```

## Future Enhancements

### Smart Suggestions
- Detect when user is stuck (no progress for 30+ min)
- Suggest AI assistance automatically
- Learn common blockers and prevent them

### Multi-User Collaboration
- Show when other users are working on similar tasks
- Share tips between users
- Collaborative task completion

### Task Templates
- Allow users to create custom task flows
- Share task templates across team
- Import/export task definitions

### Analytics
- Track which steps users get stuck on
- Measure average completion time
- Identify improvement opportunities

## Integration Checklist

To add flash sidebar to a new page:

- [ ] Add task tracking state
  ```tsx
  const [taskId, setTaskId] = useState<string | null>(null);
  const [showFlashSidebar, setShowFlashSidebar] = useState(false);
  ```

- [ ] Start task on mount
  ```tsx
  useEffect(() => {
    async function startTask() {
      const res = await fetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ taskType: "your_task", userId: "default" }),
      });
      const data = await res.json();
      if (data.ok) setTaskId(data.taskId);
    }
    startTask();
  }, []);
  ```

- [ ] Update progress when step changes
  ```tsx
  useEffect(() => {
    if (!taskId) return;
    fetch("/api/tasks", {
      method: "PUT",
      body: JSON.stringify({ taskId, updates: { currentStep } }),
    });
  }, [currentStep, taskId]);
  ```

- [ ] Add FlashSidebar component
  ```tsx
  <FlashSidebar
    taskId={taskId || undefined}
    visible={showFlashSidebar}
    onClose={() => setShowFlashSidebar(false)}
  />
  ```

- [ ] Add toggle button
  ```tsx
  <button onClick={() => setShowFlashSidebar(!showFlashSidebar)}>
    ✨ {showFlashSidebar ? "Hide" : "Show"} Guidance
  </button>
  ```

- [ ] Complete task on success
  ```tsx
  if (taskId) {
    await fetch(`/api/tasks?taskId=${taskId}`, { method: "DELETE" });
  }
  ```

## Files Modified

**Created:**
- [components/shared/FlashSidebar.tsx](../components/shared/FlashSidebar.tsx) - Flash sidebar component
- [app/api/tasks/route.ts](../app/api/tasks/route.ts) - Task management API
- [docs/FLASH-SIDEBAR-INTEGRATION.md](./FLASH-SIDEBAR-INTEGRATION.md) - This file

**Updated:**
- [app/x/specs/new/page.tsx](../app/x/specs/new/page.tsx) - Integrated task tracking

**Dependencies (Already Exist):**
- [lib/ai/task-guidance.ts](../lib/ai/task-guidance.ts) - Task guidance logic
- [lib/ai/knowledge-accumulation.ts](../lib/ai/knowledge-accumulation.ts) - AI learning
- Database tables: `UserTask`, `AIInteractionLog`, `AILearnedPattern`
