# General Import Wizard - Implementation Plan

## Overview

Split the `/x/import` BDD Specs tab into two modes:
1. **Schema Ready** - Direct upload of `.spec.json` files (existing functionality)
2. **General Import** - AI-assisted wizard for converting handwritten specs (markdown, plaintext, Word docs) into structured `.spec.json` format

---

## User Journey

### Entry Points
```
/x/import?tab=specs
  ├── Schema Ready (existing)
  │   └── Drop .spec.json files → validate → import
  │
  └── General Import (new)
      └── Drop any file (md, txt, docx, pdf) → wizard flow → spec.json
```

---

## Wizard Flow

### Step 1: Upload & Parse
**UI**: Drop zone accepting `.md`, `.txt`, `.docx`, `.pdf`

**Actions**:
1. User drops file(s)
2. System extracts raw text
3. AI analyzes content structure and suggests spec type

**AI Prompt (background)**:
```
Analyze this document and determine:
1. What type of spec this should be (CURRICULUM, MEASURE, IDENTITY, etc.)
2. Key structural elements found (modules, parameters, learning outcomes, etc.)
3. Suggested spec ID based on content

Document:
{raw_text}
```

**Output to next step**:
- Detected spec type
- Extracted structural elements
- Confidence score

---

### Step 2: Confirm Spec Type
**UI**: Card selection with detected type highlighted

**Options**:
| Type | Description | Best For |
|------|-------------|----------|
| CURRICULUM | Module-based learning content | Course materials, training guides |
| MEASURE | Behavioral parameters | Personality traits, engagement metrics |
| IDENTITY | Agent persona definition | Character sheets, role definitions |
| CONTENT | Book/source knowledge | Reference materials, textbooks |
| ADAPT | Behavior adaptation rules | Teaching style adjustments |
| GUARDRAIL | Safety constraints | Compliance rules, boundaries |

**User action**: Confirm or change detected type

---

### Step 3: Structure Mapping
**UI**: Two-column layout
- Left: Source document with highlighted sections
- Right: Target schema fields with drag-drop zones

**For CURRICULUM type**:
```
Source Document             →    Target Schema
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Title section]             →    spec.title
[Learning Outcomes]         →    spec.learningOutcomes[]
[Module 1 content]          →    spec.modules[0]
  - Objectives              →      .learningObjectives[]
  - Content                 →      .content[]
  - Key Terms               →      .keyTerms[]
  - Exam Topics             →      .examTopics[]
[Assessment info]           →    spec.assessment
[Misconceptions]            →    spec.misconceptionBank[]
```

**AI assistance**: Auto-map sections based on headings and content patterns

---

### Step 4: Content Extraction
**UI**: Form for each major section with AI-populated values

**For each module** (CURRICULUM example):
```typescript
interface ModuleForm {
  id: string;           // Auto-generated: "MOD-1"
  title: string;        // Extracted from heading
  durationMinutes: number;
  learningObjectives: string[];
  content: ContentSection[];
  keyTerms: KeyTerm[];
  examTopics: string[];
  tutoringGuidance: {
    scaffolding: string;
    commonMisconceptions: string[];
    readinessIndicator: string;
  };
}
```

**AI assistance**:
- Extract bullet points into arrays
- Identify key terms with definitions
- Generate tutoringGuidance from "AI Tutoring Guidance" sections

**User actions**:
- Edit extracted values
- Add/remove items
- Reorder sections

---

### Step 5: Metadata & Configuration
**UI**: Form for spec-level configuration

**Fields**:
```typescript
interface SpecMetadata {
  id: string;           // e.g., "CURR-FS-L2-001"
  title: string;        // Full spec title
  version: string;      // Default "1.0"
  status: "Draft" | "Review" | "Approved";
  domain: string;       // e.g., "curriculum"

  // For CURRICULUM
  qualification?: {
    name: string;
    number: string;
    tqt: number;
    glh: number;
    passMarkPercent: number;
  };

  // For MEASURE
  parameters?: ParameterConfig[];

  // Story (auto-generated)
  story: {
    asA: string;
    iWant: string;
    soThat: string;
  };
}
```

**AI assistance**: Generate story based on spec type and content

---

### Step 6: Review & Export
**UI**:
- Full JSON preview (formatted, syntax highlighted)
- Validation results
- Export options

**Validation checks**:
- [ ] Required fields present
- [ ] ID format valid (e.g., `CURR-FS-L2-001`)
- [ ] All modules have required sections
- [ ] No orphan references

**Actions**:
1. **Download JSON** - Save `.spec.json` to disk
2. **Import Now** - Send to existing import flow
3. **Save to bdd-specs/** - Write directly to repo (requires server action)
4. **Copy to Clipboard** - Copy JSON for manual paste

---

## Technical Implementation

### New API Endpoints

```typescript
// POST /api/specs/parse-document
// Accepts file upload, returns extracted text and structure hints
interface ParseDocumentRequest {
  file: File;
}
interface ParseDocumentResponse {
  ok: boolean;
  rawText: string;
  suggestedType: SpecType;
  detectedSections: Section[];
  confidence: number;
}

// POST /api/specs/extract-structure
// AI-powered structure extraction for specific spec type
interface ExtractStructureRequest {
  rawText: string;
  specType: SpecType;
  hints?: Record<string, string>;
}
interface ExtractStructureResponse {
  ok: boolean;
  spec: Partial<JsonFeatureSpec>;
  warnings: string[];
  needsReview: string[]; // Fields that need human review
}

// POST /api/specs/validate-spec
// Validates spec against schema
interface ValidateSpecRequest {
  spec: JsonFeatureSpec;
}
interface ValidateSpecResponse {
  ok: boolean;
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
```

### New Components

```
components/import/
├── GeneralImportWizard.tsx       # Main wizard container
├── steps/
│   ├── UploadStep.tsx            # File upload with parsing
│   ├── TypeSelectionStep.tsx     # Spec type confirmation
│   ├── StructureMappingStep.tsx  # Section-to-schema mapping
│   ├── ContentExtractionStep.tsx # Per-section editing
│   ├── MetadataStep.tsx          # Spec-level config
│   └── ReviewStep.tsx            # Preview and export
├── editors/
│   ├── ModuleEditor.tsx          # Edit CURRICULUM modules
│   ├── ParameterEditor.tsx       # Edit MEASURE parameters
│   ├── ContentSectionEditor.tsx  # Generic section editor
│   └── KeyTermEditor.tsx         # Term + definition pairs
└── shared/
    ├── DocumentPreview.tsx       # Left panel with highlighting
    ├── SchemaDropZone.tsx        # Right panel drop targets
    └── AIAssistButton.tsx        # "Ask AI to fill" button
```

### State Management

```typescript
interface WizardState {
  step: 1 | 2 | 3 | 4 | 5 | 6;

  // Step 1
  uploadedFile: File | null;
  rawText: string;

  // Step 2
  detectedType: SpecType;
  selectedType: SpecType;

  // Step 3-4
  mappedSections: Record<string, string>;
  extractedSpec: Partial<JsonFeatureSpec>;

  // Step 5
  metadata: SpecMetadata;

  // Step 6
  finalSpec: JsonFeatureSpec;
  validationResult: ValidationResult;

  // Progress
  isDirty: boolean;
  lastSaved: Date | null;
}
```

---

## AI Prompts

### Document Analysis Prompt
```
You are analyzing a document to convert it into a structured spec.

Document content:
{content}

Respond with JSON:
{
  "suggestedType": "CURRICULUM" | "MEASURE" | "IDENTITY" | "CONTENT" | "ADAPT" | "GUARDRAIL",
  "confidence": 0.0-1.0,
  "reasoning": "Why this type was chosen",
  "detectedSections": [
    { "heading": "...", "content": "first 200 chars...", "suggestedMapping": "spec.field.path" }
  ],
  "suggestedId": "ID-FORMAT-001"
}
```

### Structure Extraction Prompt (CURRICULUM)
```
Extract a CURRICULUM spec from this document.

Required output structure:
{
  "modules": [
    {
      "id": "MOD-N",
      "title": "...",
      "durationMinutes": N,
      "learningOutcome": "LO1",
      "assessmentCriteria": ["1.1", "1.2"],
      "learningObjectives": ["..."],
      "content": [
        { "id": "NA", "title": "...", "points": ["..."] }
      ],
      "keyTerms": [
        { "term": "...", "definition": "..." }
      ],
      "examTopics": ["..."],
      "tutoringGuidance": {
        "scaffolding": "...",
        "commonMisconceptions": ["..."],
        "readinessIndicator": "..."
      }
    }
  ],
  "learningOutcomes": [
    {
      "id": "LO1",
      "title": "...",
      "criteria": [
        { "id": "1.1", "text": "...", "bloomsLevel": "Knowledge" }
      ]
    }
  ],
  "qualification": {...},
  "assessment": {...},
  "misconceptionBank": [...]
}

Document:
{content}
```

---

## Phased Rollout

### Phase 1: Core Wizard (MVP)
- Upload markdown files
- AI-detect spec type
- Basic structure extraction for CURRICULUM type
- JSON preview and download

### Phase 2: Enhanced Editing
- Drag-drop section mapping
- In-place editing of all fields
- Validation with detailed error messages

### Phase 3: Multi-Format Support
- Word document parsing (.docx)
- PDF text extraction
- Rich text paste

### Phase 4: Advanced Features
- Version comparison (diff against existing specs)
- Template library (start from common patterns)
- Collaborative editing (multiple users)

---

## File Structure After Implementation

```
app/x/import/
├── page.tsx                      # Updated with two-mode UI
├── components/
│   ├── SchemaReadyImport.tsx     # Existing .spec.json upload
│   └── GeneralImport/
│       ├── Wizard.tsx
│       ├── steps/...
│       └── editors/...
└── api/
    ├── parse-document/route.ts
    ├── extract-structure/route.ts
    └── validate-spec/route.ts
```

---

## Success Criteria

1. User can upload a markdown curriculum doc and get valid `.spec.json` in < 5 minutes
2. AI extraction accuracy > 80% (measured by fields that need manual correction)
3. All extracted specs pass schema validation
4. Clear progress indication through wizard steps
5. Easy to correct/override AI suggestions
