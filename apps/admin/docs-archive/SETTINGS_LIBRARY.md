# Settings Library System

## Overview

The **Settings Library** provides reusable field definitions that agents can reference, eliminating duplication and ensuring consistency across agent configurations.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ SETTINGS LIBRARY                                             │
│ ~/hf_kb/.hf/settings-library.json                           │
├──────────────────────────────────────────────────────────────┤
│ {                                                            │
│   "version": 1,                                              │
│   "settings": {                                              │
│     "scanLimit": {                                           │
│       "type": "number",                                      │
│       "title": "Scan Limit",                                 │
│       "description": "Maximum records to process per run",   │
│       "default": 200,                                        │
│       "minimum": 0,                                          │
│       "maximum": 10000,                                      │
│       "category": "batch",                                   │
│       "tags": ["ingestion", "batch-processing"]              │
│     },                                                       │
│     "chunkSize": { ... },                                    │
│     "sourcesDir": { ... }                                    │
│   }                                                          │
│ }                                                            │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ AGENT MANIFEST (References Library)                         │
│ lib/agents.json                                              │
├──────────────────────────────────────────────────────────────┤
│ {                                                            │
│   "agents": [                                                │
│     {                                                        │
│       "id": "knowledge_ingestor",                           │
│       "settingsSchema": {                                    │
│         "type": "object",                                    │
│         "properties": {                                      │
│           "maxDocuments": { "$ref": "#/settings/scanLimit" },│
│           "maxCharsPerChunk": { "$ref": "#/settings/chunkSize" },│
│           "sourcesDir": { "$ref": "#/settings/sourcesDir" } │
│         }                                                    │
│       }                                                      │
│     }                                                        │
│   ]                                                          │
│ }                                                            │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ RUNTIME RESOLUTION                                           │
├──────────────────────────────────────────────────────────────┤
│ When API loads agents, it:                                   │
│ 1. Loads settings-library.json                               │
│ 2. Resolves all $ref → actual definitions                    │
│ 3. Returns resolved schemas to UI                            │
│                                                              │
│ UI renders:                                                  │
│ - Number inputs with min/max from library                    │
│ - Path inputs with relative/absolute resolution             │
│ - Consistent validation across all agents                    │
└──────────────────────────────────────────────────────────────┘
```

## Benefits

### 1. DRY (Don't Repeat Yourself)
Define "scan limit" once, use in multiple agents:
- `knowledge_ingestor.maxDocuments`
- `knowledge_embedder.maxChunks`
- `transcript_processor.limit`

All reference the same `scanLimit` definition.

### 2. Consistency
All agents using `$ref: "#/settings/scanLimit"` get:
- Same min/max validation (0-10000)
- Same default value (200)
- Same description and help text
- Same UI rendering

### 3. Centralized Updates
Change `scanLimit.maximum` from 10000 to 50000 in one place:
```json
{
  "settings": {
    "scanLimit": {
      "maximum": 50000  // Now applies to all agents
    }
  }
}
```

All agents automatically get the new limit.

### 4. Path Management
Define paths once with kbRoot-relative resolution:
```json
{
  "sourcesDir": {
    "type": "path",
    "default": "sources",
    "relative": true,
    "pathType": "directory"
  }
}
```

Agents get resolved absolute paths at runtime:
- Manifest: `"sources"`
- Runtime: `/Users/paulwander/hf_kb/sources`

### 5. Categorization & Discovery
Browse settings by category in UI:
- **Batch**: scanLimit, batchSize
- **Paths**: sourcesDir, transcriptsDir, derivedDir
- **Chunking**: chunkSize, overlapChars
- **Embedding**: embeddingModel, dimensions

### 6. Documentation Built-In
Each setting carries:
- Title (display name)
- Description (help text)
- Tags (searchable metadata)
- Usage examples (in UI)

## Setting Types

### Number
```json
{
  "scanLimit": {
    "type": "number",
    "title": "Scan Limit",
    "default": 200,
    "minimum": 0,
    "maximum": 10000
  }
}
```

### String
```json
{
  "modelName": {
    "type": "string",
    "title": "Model Name",
    "default": "gpt-4",
    "pattern": "^gpt-"
  }
}
```

### Boolean
```json
{
  "forceReprocess": {
    "type": "boolean",
    "title": "Force Reprocess",
    "default": false
  }
}
```

### Enum
```json
{
  "embeddingModel": {
    "type": "enum",
    "title": "Embedding Model",
    "enum": ["text-embedding-3-small", "text-embedding-3-large"],
    "default": "text-embedding-3-small"
  }
}
```

### Path
```json
{
  "sourcesDir": {
    "type": "path",
    "title": "Sources Directory",
    "default": "sources",
    "pathType": "directory",
    "relative": true  // Relative to kbRoot
  }
}
```

### Array
```json
{
  "allowedTypes": {
    "type": "array",
    "title": "Allowed File Types",
    "items": {
      "type": "string",
      "enum": ["pdf", "md", "txt"]
    },
    "default": ["pdf", "md"]
  }
}
```

## Usage

### 1. Initialize Library (First Time)

Visit `/settings-library` in the UI and click **Initialize Library**.

This creates `~/hf_kb/.hf/settings-library.json` with defaults.

### 2. Browse & Edit Settings

Settings Library page shows:
- All defined settings
- Search by name/description
- Filter by category
- Edit inline
- Delete unused settings
- Add new settings

### 3. Reference in Agent Manifest

In `lib/agents.json`:

```json
{
  "agents": [
    {
      "id": "my_agent",
      "settingsSchema": {
        "type": "object",
        "properties": {
          "limit": { "$ref": "#/settings/scanLimit" },
          "chunkSize": { "$ref": "#/settings/chunkSize" },
          "sourceDir": { "$ref": "#/settings/sourcesDir" }
        }
      }
    }
  ]
}
```

### 4. Runtime Resolution

When the agents API loads, it:
1. Reads `lib/agents.json`
2. Loads `~/hf_kb/.hf/settings-library.json`
3. Resolves all `$ref` references
4. Returns fully resolved schemas to UI

The UI renders proper form fields automatically.

### 5. Runtime Overrides

Agents can still override defaults per-instance:

**Manifest (default):**
```json
{
  "settings": {},
  "settingsSchema": {
    "properties": {
      "limit": { "$ref": "#/settings/scanLimit" }
    }
  }
}
```

**Runtime override (per agent instance):**
```json
{
  "overrides": {
    "agents": {
      "transcript_processor": {
        "settings": {
          "createBatches": false  // Override default for this agent
        }
      }
    }
  }
}
```

Stored in `~/hf_kb/.hf/agents.json`.

## Example Workflow

### Scenario: Change Default Scan Limit

**Problem**: Default scan limit (200) is too low for production runs.

**Solution**:

1. Visit `/settings-library`
2. Find `scanLimit` setting
3. Click "Edit"
4. Change `default: 200` → `default: 500`
5. Click "Save Library"

**Result**:
- All agents using `$ref: "#/settings/scanLimit"` now default to 500
- Existing agent overrides are preserved
- No need to edit multiple agent definitions

### Scenario: Add New Path Setting

**Problem**: Need to add a new `outputDir` setting for multiple agents.

**Solution**:

1. Visit `/settings-library`
2. Click "Add Setting" (future feature)
3. Define:
   - Key: `outputDir`
   - Type: `path`
   - Default: `output`
   - Relative: `true`
4. Save

5. Edit `lib/agents.json`:
```json
{
  "agents": [
    {
      "id": "report_generator",
      "settingsSchema": {
        "properties": {
          "outputDir": { "$ref": "#/settings/outputDir" }
        }
      }
    }
  ]
}
```

**Result**:
- New setting available to all agents
- Consistent path resolution
- Can change default output dir in one place

## Version History & Audit Trail

Every time you save the settings library, a **version snapshot** is automatically created. This provides:

### 1. Automatic Versioning
Every save creates a new version with:
- **Version number** (auto-incremented)
- **Timestamp** (when the change was made)
- **Full library snapshot** (all settings at that point in time)
- **Metadata** (source, user, notes)

### 2. Audit Trail
Track what changed and when:
```json
{
  "version": 5,
  "timestamp": "2026-01-14T12:34:56Z",
  "metadata": {
    "source": "ui",
    "user": "admin",
    "note": "Increased scanLimit to 500"
  },
  "library": { ... }
}
```

### 3. Revert Capability
Click "Revert to this version" to roll back changes. The system:
1. Saves current state as a new version (before reverting)
2. Writes the target version to the active library
3. Creates another version entry for the revert action

**Example revert flow:**
```
v1: Initial (scanLimit: 200)
v2: Updated (scanLimit: 500)  ← Current
v3: Updated (scanLimit: 1000)

User reverts to v2:
v4: Snapshot before revert (scanLimit: 1000)
v5: Reverted to v2 (scanLimit: 500) ← New current
```

### 4. UI Access
Visit `/settings-library` and click the **"Version History"** tab to:
- See last 20 versions
- View timestamps and metadata
- Revert to any previous version
- Compare settings between versions (future)

### 5. History Retention
- Keeps last **50 versions** (configurable)
- Older versions automatically pruned
- Manual export/import for archival (future)

### 6. Safety Guarantees
- **No data loss**: Reverting saves current state first
- **Undo available**: Can revert the revert
- **Full auditability**: Every change tracked
- **Blame-free**: Focus on what changed, not who

## File Locations

- **Settings Library**: `~/hf_kb/.hf/settings-library.json`
- **Version History**: `~/hf_kb/.hf/settings-library-history.json`
- **Agent Manifest**: `<repo>/lib/agents.json`
- **Agent Overrides**: `~/hf_kb/.hf/agents.json`

## API Endpoints

### GET /api/settings-library
Returns current settings library (or defaults if not initialized).

**Query params:**
- `?version=N` - Get a specific version from history
- `?history=true&limit=20` - Get version history (last N versions)
- `?compare=true&from=1&to=3` - Compare two versions

### POST /api/settings-library
Saves settings library and automatically creates a version in history.

**Body:**
```json
{
  "library": { ... },
  "source": "ui",  // Optional: ui, api, script
  "user": "admin",  // Optional
  "note": "Updated scanLimit"  // Optional
}
```

**Response:**
```json
{
  "ok": true,
  "library": { ... },
  "version": 5  // Version number created
}
```

### PUT /api/settings-library
Initializes library with defaults (if it doesn't exist).

### PATCH /api/settings-library
Reverts to a specific version.

**Body:**
```json
{
  "version": 3  // Version to revert to
}
```

This automatically:
1. Saves current state as a new version
2. Writes the target version to library file
3. Creates another version for the revert action

## Future Enhancements

1. **Add Setting UI**: Click "Add Setting" button to create new definitions
2. **Usage Tracking**: Show which agents use each setting
3. **Validation**: Warn if deleting a setting that's still referenced
4. **Import/Export**: Share settings libraries across projects
5. **Versioning**: Track changes to settings over time
6. **Namespaces**: Group settings by domain (ingestion, embedding, etc.)

---

**Key Insight**: The settings library makes your agent configuration DRY, consistent, and maintainable. Define common settings once, reference everywhere, update in one place.
