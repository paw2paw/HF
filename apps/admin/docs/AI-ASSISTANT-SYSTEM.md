# AI Assistant System Documentation

<!-- @doc-source file:apps/admin/lib/ai/system-context.ts,apps/admin/lib/ai/client.ts -->
<!-- @doc-source file:apps/admin/lib/ai/knowledge-accumulation.ts,apps/admin/lib/ai/assistant-wrapper.ts -->
<!-- @doc-source file:apps/admin/lib/ai/config-loader.ts -->
<!-- @doc-source model:AIConfig,AIInteractionLog,AILearnedPattern -->
<!-- @doc-source route:/api/ai/assistant,/api/chat -->

## Overview

The HumanFirst admin application now has a fully integrated AI assistant system with knowledge accumulation, centralized context, and task guidance capabilities.

## Architecture

### 1. **Centralized Context System** (`/lib/ai/system-context.ts`)

Provides all AI assistants with system-wide knowledge without manual queries in each endpoint.

**Features:**
- Modular context loading (specs, parameters, domains, callers, etc.)
- Preset configurations for different call points
- Parallel async loading for performance
- Location-aware context (page, entity, action)

**Usage:**
```typescript
import { getContextForCallPoint, injectSystemContext } from "@/lib/ai/system-context";

// Load context for a specific call point (uses preset)
const context = await getContextForCallPoint("spec.assistant");

// Inject into system prompt
let systemPrompt = SPEC_ASSISTANT_SYSTEM_PROMPT.replace("{currentSpec}", JSON.stringify(currentSpec));
systemPrompt = injectSystemContext(systemPrompt, context);
```

**Available Presets:**
- `spec.assistant` - Specs, domains, parameters, anchors
- `pipeline.measure` - Specs, parameters, anchors
- `pipeline.compose` - Specs, parameters, callers, personas, targets, playbooks
- `chat.stream` - Personas, knowledge, goals, callers
- `bdd.parse` - Specs, parameters, domains
- `parameter.enrich` - Parameters, domains, knowledge, anchors

### 2. **Knowledge Accumulation** (`/lib/ai/knowledge-accumulation.ts`)

AI learns from user interactions to improve over time.

**Features:**
- Logs all AI interactions (call point, user message, AI response, outcome)
- Extracts patterns from successful interactions
- Builds confidence scores for learned patterns
- Supports corrections to learn what doesn't work

**Usage:**
```typescript
import { logAIInteraction } from "@/lib/ai/knowledge-accumulation";

// Log an interaction
await logAIInteraction({
  callPoint: "spec.assistant",
  userMessage: "I want to measure curiosity",
  aiResponse: "I'll create a spec for measuring curiosity...",
  outcome: "success",
  metadata: {
    entityType: "spec",
    action: "create",
    specId: "PERS-CUR-001",
  },
});

// Log a correction
await logCorrection(
  "spec.assistant",
  "original AI suggestion",
  "user's correction"
);

// Get learned knowledge for a call point
const patterns = await getLearnedKnowledge("spec.assistant");
```

**Database Tables:**
- `AIInteractionLog` - All interactions
- `AILearnedPattern` - Extracted patterns with confidence scores

### 3. **Task Guidance** (`/lib/ai/task-guidance.ts`)

Tracks user tasks and provides contextual guidance through flash sidebars.

**Features:**
- Step-by-step task tracking
- Contextual suggestions based on current step
- Next action recommendations
- Blocker detection and help
- Flash sidebar generation

**Usage:**
```typescript
import {
  startTaskTracking,
  updateTaskProgress,
  completeTask,
  generateFlashSidebar,
} from "@/lib/ai/task-guidance";

// Start tracking a task
const taskId = await startTaskTracking(
  userId,
  "create_spec",
  { intent: "measure personality" }
);

// Update progress
await updateTaskProgress(taskId, {
  currentStep: 2,
  completedSteps: ["basic_info"],
});

// Generate flash sidebar content
const sidebar = await generateFlashSidebar(taskId);
```

**Database Tables:**
- `UserTask` - Task tracking (type, status, steps, blockers, context)

**Task Types:**
- `create_spec` - Creating a new analysis specification
- `configure_caller` - Setting up a caller profile
- `setup_goal` - Defining a new goal

### 4. **Assistant Wrapper** (`/lib/ai/assistant-wrapper.ts`)

Helper utilities for easy integration.

**Usage:**
```typescript
import { logAssistantCall, logCorrection } from "@/lib/ai/assistant-wrapper";

// After getting AI response
logAssistantCall(
  {
    callPoint: "spec.assistant",
    userMessage: message,
    metadata: { entityType: "spec", action: "create" },
  },
  {
    response: result.content,
    success: true,
    fieldUpdates,
  }
);
```

## Integrated AI Endpoints

### 1. **Spec Assistant** (`/api/specs/assistant`)

AI-powered spec creation with auto-fill form fields.

**Features:**
- ✅ Centralized context (specs, parameters, domains, anchors)
- ✅ Knowledge logging
- ✅ Checks for existing specs before creating duplicates
- ✅ Auto-fills form fields via JSON extraction

**UI:** Large AI text box at top of `/x/specs/new` page

### 2. **Chat** (`/api/chat`)

Main chat interface for helping users navigate and understand the system.

**Features:**
- ✅ Knowledge logging
- ✅ Mode-specific prompts (CHAT, DATA, SPEC, CALL)
- ✅ Entity-aware context
- ✅ Streaming responses with metering

**Modes:**
- `CHAT` - General help and navigation
- `DATA` - Data analysis and insights
- `SPEC` - Spec development assistance
- `CALL` - Call simulation with caller's composed prompt

### 3. **Extract Structure** (`/api/specs/extract-structure`)

Converts uploaded documents into structured spec JSON.

**Features:**
- ✅ Knowledge logging
- ✅ Supports CURRICULUM, MEASURE, IDENTITY, CONTENT, ADAPT, GUARDRAIL
- ✅ Extracts all fields: modules, parameters, user stories, etc.

### 4. **Parse Document** (`/api/specs/parse-document`)

Detects what type of spec a document should be.

**Features:**
- ✅ Knowledge logging
- ✅ AI-powered type detection with confidence scores
- ✅ Suggests spec ID based on content

## Task Tracking API

**Endpoint:** `/api/tasks`

### Start a Task
```http
POST /api/tasks
{
  "taskType": "create_spec",
  "userId": "user-id",
  "context": { "intent": "measure curiosity" }
}
```

### Update Progress
```http
PUT /api/tasks
{
  "taskId": "task-id",
  "updates": {
    "currentStep": 2,
    "completedSteps": ["basic_info"],
    "blockers": ["unsure about parameters"]
  }
}
```

### Get Guidance
```http
GET /api/tasks?taskId=task-id
```

### Complete Task
```http
DELETE /api/tasks?taskId=task-id
```

## How the Systems Work Together

### Example: Creating a Spec

1. **User Opens Spec Creation Page**
   - Frontend starts task tracking: `create_spec`
   - Task guidance shows step 1: "Basic Information"

2. **User Types in AI Chat**
   - "I want to measure how curious someone is during conversations"

3. **AI Assistant Processes**
   - Loads centralized context (existing specs, parameters, domains, anchors)
   - Checks if "curiosity" spec already exists
   - Generates structured response with JSON field updates

4. **Frontend Auto-Fills Form**
   - Extracts JSON from AI response
   - Updates form fields with glowing animation
   - Shows toast notification: "AI filled in 5 fields"

5. **User Reviews & Edits**
   - If user changes AI-filled value, frontend logs correction
   - Knowledge accumulation learns user's preference

6. **User Completes Spec**
   - Frontend marks task as complete
   - Knowledge accumulation logs successful creation
   - Pattern extracted: "create_spec_for_curiosity"

7. **Next Time**
   - AI has learned from this interaction
   - Will suggest similar structure for related specs
   - Higher confidence in curiosity-related parameters

## Adding New AI Endpoints

To add knowledge logging to a new AI endpoint:

```typescript
import { logAssistantCall } from "@/lib/ai/assistant-wrapper";

// After AI call
logAssistantCall(
  {
    callPoint: "your.endpoint",
    userMessage: userInput,
    metadata: { /* context */ },
  },
  {
    response: aiResponse,
    success: true,
    fieldUpdates: extractedData,
  }
);
```

To use centralized context:

```typescript
import { getContextForCallPoint, injectSystemContext } from "@/lib/ai/system-context";

const context = await getContextForCallPoint("your.callpoint");
systemPrompt = injectSystemContext(systemPrompt, context);
```

## Database Schema

### AIInteractionLog
- `callPoint` - Where the interaction happened
- `userMessage` - What user asked
- `aiResponse` - What AI responded
- `outcome` - "success" | "correction" | "failure"
- `metadata` - Additional context (entity type, action, etc.)

### AILearnedPattern
- `pattern` - Learned pattern identifier
- `callPoint` - Where pattern applies
- `confidence` - 0-1 confidence score
- `occurrences` - Number of times seen
- `examples` - Example interactions

### UserTask
- `taskType` - Type of task (create_spec, configure_caller, etc.)
- `status` - "in_progress" | "completed" | "abandoned"
- `currentStep` / `totalSteps` - Progress tracking
- `completedSteps` - Array of completed step IDs
- `blockers` - Array of blocker descriptions
- `context` - Task-specific context

## Benefits

1. **AI Gets Smarter Over Time**
   - Learns from successful interactions
   - Builds confidence in patterns
   - Improves suggestions based on corrections

2. **Consistent Context Across System**
   - All AI calls have access to system knowledge
   - No duplicate context loading code
   - Easy to add new context modules

3. **Better User Guidance**
   - Step-by-step task tracking
   - Contextual suggestions
   - Blocker detection and help

4. **Faster Development**
   - Wrapper utilities for easy integration
   - Preset configurations for common use cases
   - Automatic pattern learning

## Future Enhancements

- **Flash Sidebar UI Component** - Visual sidebar for task guidance
- **Knowledge Export/Import** - Share learned patterns across instances
- **Advanced Pattern Matching** - More sophisticated pattern extraction
- **Multi-step Task Flows** - Complex workflows with branching
- **User Preference Learning** - Per-user customization
- **Real-time Suggestions** - Proactive help based on learned patterns
