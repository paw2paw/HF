# Knowledge Artifact + Vector System for Parameter Analysis

## Overview

This system enhances personality/parameter scoring by using a knowledge base of research documents, scoring guides, and examples. It creates a RAG (Retrieval-Augmented Generation) pipeline.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. KNOWLEDGE SOURCES                                            │
│    ~/hf_kb/sources/knowledge/**/*.pdf                           │
│    ~/hf_kb/sources/parameters/guides/*.md                       │
│    - Research papers on personality, prosody, affect            │
│    - Parameter definitions and scoring guides                   │
│    - Examples of high/low trait indicators                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. INGESTION AGENT (knowledge:ingest)                           │
│    - Extract text from PDFs, markdown, etc.                     │
│    - Create KnowledgeDoc records (full text + metadata)         │
│    - Chunk documents (overlap for context)                      │
│    - Store in KnowledgeChunk table                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. VECTOR EMBEDDING AGENT (knowledge:embed)                     │
│    - Generate embeddings for each chunk                         │
│    - Use OpenAI text-embedding-3-small                          │
│    - Store in VectorEmbedding table with pgvector               │
│    - Link to KnowledgeChunk                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. ARTIFACT CREATION (knowledge:artifacts)                      │
│    - Create KnowledgeArtifact records per Parameter             │
│    - Link relevant chunks to each parameter                     │
│    - Store condensed "scoring guides" per parameter             │
│    - Tag artifacts: "openness_scoring", "empathy_examples"      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. PERSONALITY ANALYZER (ENHANCED WITH RAG)                     │
│    - For each Parameter being scored:                           │
│      1. Query vector DB for relevant chunks                     │
│      2. Retrieve KnowledgeArtifact for this parameter           │
│      3. Build enriched prompt with:                             │
│         - Parameter definition (from DB)                        │
│         - Retrieved knowledge chunks (from vector search)       │
│         - Scoring examples (from artifacts)                     │
│      4. Score transcript using LLM                              │
│      5. Create PersonalityObservation with evidence links       │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema Extensions

### KnowledgeDoc (already exists)
Stores full document text and metadata.

### KnowledgeChunk (already exists)
Stores chunked text for retrieval.

### NEW: VectorEmbedding
```prisma
model VectorEmbedding {
  id              String   @id @default(uuid())
  chunkId         String   @unique

  // Vector data (use pgvector extension)
  embedding       Unsupported("vector(1536)") // OpenAI embedding dimensions
  model           String   // "text-embedding-3-small"

  // Metadata
  createdAt       DateTime @default(now())

  chunk           KnowledgeChunk @relation(fields: [chunkId], references: [id], onDelete: Cascade)

  @@index([chunkId])
}
```

### NEW: KnowledgeArtifact
```prisma
model KnowledgeArtifact {
  id              String   @id @default(uuid())
  parameterId     String?  // Link to specific parameter

  // Artifact type and content
  type            ArtifactType  // SCORING_GUIDE, EXAMPLES, RESEARCH_SUMMARY
  title           String
  content         String   @db.Text  // Condensed, curated content

  // Source tracking
  sourceChunkIds  String[]  // Which chunks contributed to this artifact
  confidence      Float?    // How confident are we in this artifact?

  // Metadata
  tags            String[]  // ["openness", "high_indicators", "conversational"]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  parameter       Parameter? @relation(fields: [parameterId], references: [id])

  @@index([parameterId])
  @@index([type])
}

enum ArtifactType {
  SCORING_GUIDE      // "How to score openness from conversation"
  EXAMPLES           // "Examples of high/low openness in calls"
  RESEARCH_SUMMARY   // "Research findings on openness indicators"
  PROMPT_TEMPLATE    // "LLM prompt template for scoring openness"
  CALIBRATION_DATA   // "Benchmark examples with known scores"
}
```

### NEW: ParameterKnowledgeLink
Junction table linking Parameters to relevant knowledge chunks.

```prisma
model ParameterKnowledgeLink {
  id              String   @id @default(uuid())
  parameterId     String
  chunkId         String
  relevanceScore  Float    // How relevant is this chunk? (from vector similarity)

  parameter       Parameter      @relation(fields: [parameterId], references: [id])
  chunk           KnowledgeChunk @relation(fields: [chunkId], references: [id])

  createdAt       DateTime @default(now())

  @@unique([parameterId, chunkId])
  @@index([parameterId])
  @@index([chunkId])
  @@index([relevanceScore])
}
```

## Pipeline Stages

### Stage 1: Ingest Knowledge Documents

```bash
# Scan knowledge sources and create KnowledgeDoc + KnowledgeChunk records
npx tsx lib/ops/knowledge-ingest.ts --verbose

# Output:
# - KnowledgeDoc records (1 per PDF/markdown file)
# - KnowledgeChunk records (many per doc, with overlap)
```

**What it does:**
- Extract text from PDFs using pdf-parse or similar
- Split into chunks (1500 chars, 200 char overlap)
- Store in KnowledgeDoc and KnowledgeChunk tables
- Calculate content hash for deduplication

### Stage 2: Generate Vector Embeddings

```bash
# Generate embeddings for all chunks without embeddings
npx tsx lib/ops/knowledge-embed.ts --model text-embedding-3-small --batch-size 100

# Output:
# - VectorEmbedding records linked to KnowledgeChunk
# - Stored as pgvector type for fast similarity search
```

**What it does:**
- Query chunks without embeddings
- Batch process with OpenAI embeddings API
- Store vectors in PostgreSQL with pgvector extension
- Enable semantic search via cosine similarity

### Stage 3: Create Parameter Artifacts

```bash
# For each Parameter, find relevant knowledge and create artifacts
npx tsx lib/ops/knowledge-artifacts.ts --parameter-id <id>

# Output:
# - KnowledgeArtifact records per parameter
# - ParameterKnowledgeLink records (top-N most relevant chunks)
```

**What it does:**
- For each Parameter (e.g., "openness"):
  1. Create vector embedding of parameter definition
  2. Query vector DB for top 20 most similar chunks
  3. Use LLM to synthesize:
     - Scoring guide artifact
     - Examples artifact
     - Research summary artifact
  4. Create ParameterKnowledgeLink records
  5. Store artifacts in KnowledgeArtifact table

### Stage 4: Enhanced Personality Analysis (RAG)

```typescript
async function scorePersonalityTraitWithRAG(
  transcriptText: string,
  parameter: Parameter,
  verbose: boolean
): Promise<{ score: number; evidence: string[] }> {

  // 1. Retrieve relevant knowledge chunks
  const relevantChunks = await retrieveRelevantKnowledge(parameter.id, transcriptText);

  // 2. Get pre-created artifacts for this parameter
  const artifacts = await prisma.knowledgeArtifact.findMany({
    where: { parameterId: parameter.id },
    orderBy: { confidence: 'desc' }
  });

  // 3. Build enriched prompt
  const scoringGuide = artifacts.find(a => a.type === 'SCORING_GUIDE')?.content;
  const examples = artifacts.find(a => a.type === 'EXAMPLES')?.content;

  const prompt = `
You are scoring a customer's ${parameter.name} based on their call transcript.

## Parameter Definition
${parameter.definition}

## Scoring Guide (from knowledge base)
${scoringGuide}

## Research-Backed Indicators
${relevantChunks.map(c => c.content).join('\n\n')}

## Examples of High/Low ${parameter.name}
${examples}

## Transcript to Analyze
${transcriptText.substring(0, 4000)}

## Your Task
Score this person's ${parameter.name} from 0.0 (very low) to 1.0 (very high).
Provide your score and cite specific evidence from the transcript.

Return JSON: { "score": 0.75, "evidence": ["quote 1", "quote 2"] }
  `;

  // 4. Call LLM
  const response = await callLLM(prompt);
  const result = JSON.parse(response);

  return result;
}
```

## Vector Search Implementation

Using pgvector extension for PostgreSQL:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create vector column
ALTER TABLE "VectorEmbedding"
ADD COLUMN embedding vector(1536);

-- Create index for fast similarity search
CREATE INDEX ON "VectorEmbedding"
USING ivfflat (embedding vector_cosine_ops);

-- Query similar chunks
SELECT
  c.id,
  c.content,
  1 - (v.embedding <=> $1::vector) as similarity
FROM "KnowledgeChunk" c
JOIN "VectorEmbedding" v ON v."chunkId" = c.id
WHERE v.embedding <=> $1::vector < 0.3  -- Similarity threshold
ORDER BY v.embedding <=> $1::vector
LIMIT 10;
```

## Example Flow

### Setup Phase (Run Once)

```bash
# 1. Ingest all knowledge documents
npm run op knowledge:ingest --verbose

# 2. Generate embeddings
npm run op knowledge:embed --batch-size 100

# 3. Create artifacts for all parameters
npm run op knowledge:artifacts --all
```

**Result:**
- 500+ PDFs → 5000+ KnowledgeChunk records
- 5000+ VectorEmbedding records
- 50 Parameters × 3 artifacts = 150 KnowledgeArtifact records

### Analysis Phase (Every Call)

```bash
# Analyze personality with RAG enhancement
npm run op personality:analyze --use-rag --verbose
```

**What happens:**
1. For each call without PersonalityObservation:
2. For each personality trait (openness, conscientiousness, etc.):
   - Embed the transcript excerpt
   - Query vector DB for relevant knowledge chunks
   - Retrieve parameter's artifacts (scoring guide, examples)
   - Build enriched prompt with research context
   - Score using LLM with enhanced knowledge
   - Create PersonalityObservation with evidence field

## Benefits

1. **Research-Backed Scoring**: Use academic papers on prosody, affect, personality
2. **Consistent Definitions**: All scorers use same knowledge base
3. **Explainable Results**: Evidence field links back to knowledge chunks
4. **Continuous Learning**: Add new research → re-embed → improved scoring
5. **Parameter Calibration**: Use artifacts to create benchmark datasets

## Database Sizing

**Example for 500 PDFs:**
- KnowledgeDoc: 500 records (~1MB)
- KnowledgeChunk: 5,000 records (~50MB text)
- VectorEmbedding: 5,000 records (~30MB vectors)
- KnowledgeArtifact: 150 records (~5MB)
- ParameterKnowledgeLink: 1,000 records (~100KB)

**Total: ~86MB** for comprehensive knowledge base

## Implementation Priority

1. ✅ Schema extensions (VectorEmbedding, KnowledgeArtifact, ParameterKnowledgeLink)
2. 🔨 knowledge:ingest operation (PDF → chunks)
3. 🔨 knowledge:embed operation (chunks → vectors)
4. 🔨 knowledge:artifacts operation (create scoring guides per parameter)
5. 🔨 personality:analyze enhancement (add RAG retrieval)

## API Endpoints

```typescript
// Search knowledge base
GET /api/knowledge/search?q=openness+indicators&limit=10

// Get artifacts for parameter
GET /api/knowledge/artifacts?parameterId=abc-123

// Trigger re-embedding
POST /api/ops/knowledge:embed { batchSize: 100 }
```

---

**Key Insight:** The knowledge base becomes your "expert system" for scoring. Instead of relying only on Parameter definitions in the DB, you pull in relevant research and examples dynamically using vector search.
