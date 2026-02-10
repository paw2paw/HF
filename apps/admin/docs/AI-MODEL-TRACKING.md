# AI Model Tracking

## Overview

The AI Knowledge system now tracks **which AI models** generated each response, allowing you to analyze performance across different models (Claude Sonnet, Haiku, GPT-4, etc.).

## What's Tracked

**Captured for Every AI Interaction:**
- **Model**: The specific model used (e.g., "claude-sonnet-4.5", "gpt-4-turbo", "claude-haiku-4.5")
- **Provider**: The AI provider (e.g., "anthropic", "openai")
- **Call Point**: Where the AI was used (e.g., "spec.assistant", "chat.data")
- **Outcome**: Success/failure of the interaction
- **Timestamp**: When the interaction occurred

## Database Storage

**AIInteractionLog Table:**
```prisma
model AIInteractionLog {
  id           String   @id @default(uuid())
  callPoint    String
  userMessage  String   @db.Text
  aiResponse   String   @db.Text
  outcome      String   // 'success', 'correction', 'failure'
  metadata     Json?    // Contains: model, provider, entityType, action, etc.
  createdAt    DateTime @default(now())
}
```

**Metadata Structure:**
```typescript
metadata: {
  model: "claude-sonnet-4.5",
  provider: "anthropic",
  entityType: "spec",
  action: "create",
  // ... other context
}
```

## Integration Points

### ✅ Currently Tracking Models

**1. Spec Assistant** (`/api/specs/assistant`)
```typescript
metadata: {
  model: aiConfig.model,      // e.g., "claude-sonnet-4.5"
  provider: aiConfig.provider, // e.g., "anthropic"
  entityType: "spec",
  action: "create",
}
```

**2. Chat** (`/api/chat`)
```typescript
metadata: {
  model: selectedEngine,
  provider: selectedEngine,
  mode: "CHAT" | "DATA" | "SPEC" | "CALL",
  entityType: "caller",
}
```

### 🔄 Need to Add (Future)

- Extract Structure (`/api/specs/extract-structure`)
- Parse Document (`/api/specs/parse-document`)
- Pipeline endpoints (`/api/pipeline/*`)
- Custom AI endpoints

## Dashboard Display

**AI Knowledge Dashboard** (`/x/ai-knowledge`)

**Stats Card:**
```
┌─────────────────────────┐
│ AI MODELS USED          │
│                         │
│ claude-sonnet-4.5,      │
│ gpt-4-turbo, haiku-4.5  │
└─────────────────────────┘
```

Shows comma-separated list of all unique models used across all interactions.

## Usage Examples

### Check Which Models Are Being Used

```typescript
// In backend or API route
const knowledge = await exportKnowledge();
console.log("Models used:", knowledge.stats.modelsUsed);
// Output: "claude-sonnet-4.5, gpt-4-turbo"
```

### Query Interactions by Model

```sql
-- Find all interactions with Sonnet 4.5
SELECT * FROM "AIInteractionLog"
WHERE metadata->>'model' = 'claude-sonnet-4.5'
ORDER BY "createdAt" DESC;

-- Compare success rates by model
SELECT
  metadata->>'model' as model,
  COUNT(*) as total,
  SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successes,
  ROUND(AVG(CASE WHEN outcome = 'success' THEN 1.0 ELSE 0.0 END) * 100, 2) as success_rate
FROM "AIInteractionLog"
WHERE metadata->>'model' IS NOT NULL
GROUP BY metadata->>'model'
ORDER BY success_rate DESC;
```

### Filter Patterns by Model

```sql
-- Find patterns learned from specific model
SELECT
  p.*,
  COUNT(DISTINCT l."id") as interactions
FROM "AILearnedPattern" p
LEFT JOIN "AIInteractionLog" l
  ON l."callPoint" = p."callPoint"
  AND l.metadata->>'model' = 'claude-sonnet-4.5'
GROUP BY p."id"
ORDER BY p."confidence" DESC;
```

## Benefits

### 1. **Model Performance Comparison**
- Compare success rates across different models
- Identify which models work best for specific tasks
- Optimize cost by using appropriate model for each use case

### 2. **Pattern Attribution**
- Know which model generated learned patterns
- Understand model-specific strengths
- Avoid mixing patterns from different model generations

### 3. **Debugging & Analysis**
- Track down issues to specific model versions
- Identify when model changes affect outcomes
- Historical analysis of model performance

### 4. **Cost Optimization**
- See which models are used most
- Identify opportunities to use cheaper models
- Balance cost vs. performance

## Future Enhancements

### Model Analytics Dashboard
Create dedicated view showing:
- Model usage breakdown (pie chart)
- Success rate by model (bar chart)
- Cost per model over time
- Response time by model

### Smart Model Selection
- AI automatically chooses model based on task complexity
- Learn which models perform best for specific patterns
- Cost-aware model selection

### A/B Testing
- Test new models against baseline
- Automatically switch to better performing models
- Track improvement metrics

### Model Version Tracking
- Track exact model versions (e.g., "claude-sonnet-4.5-20250929")
- Compare performance across version updates
- Alert on model version changes

## Migration Notes

**Existing Data:**
- Old interactions without model info show "—" in dashboard
- No retroactive tracking (model info starts from this update)
- Historical patterns remain valid (model-agnostic)

**Adding to New Endpoints:**
Always include model and provider in metadata:
```typescript
logAssistantCall(
  {
    callPoint: "your.endpoint",
    userMessage: message,
    metadata: {
      model: aiConfig.model,        // ← Add this
      provider: aiConfig.provider,  // ← Add this
      // ... other metadata
    },
  },
  { response, success: true }
);
```

## Testing

**Verify Model Tracking:**
1. Use AI assistant (spec creation, chat, etc.)
2. Visit `/x/ai-knowledge`
3. Check "AI MODELS USED" card shows your model
4. Verify in database:
```sql
SELECT
  metadata->>'model' as model,
  COUNT(*) as count
FROM "AIInteractionLog"
GROUP BY metadata->>'model';
```

## Configuration

**Set Default Model:**
Visit `/x/ai-config` to configure which models are used for each call point.

**Available Models:**
- Claude: sonnet-4.5, opus-4.6, haiku-4.5
- OpenAI: gpt-4-turbo, gpt-4, gpt-3.5-turbo
- Custom: Configure in AI Config

---

**Model tracking is now active!** 📊🤖
