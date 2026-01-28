# Hash Strategy for Knowledge Ingestion

## Problem

When ingesting large document sets (500+ PDFs), you need:
1. **Deduplication** - don't reprocess same document
2. **Testability** - run with limits (max 10 docs) for testing
3. **Resumability** - handle crashes, continue from where you left off
4. **Overwrite option** - force reprocess when needed

## Solution: Doc-Level Hash + Status Tracking

### Hash Strategy

```typescript
// 1. Hash document content (SHA256)
const contentHash = crypto.createHash("sha256").update(fullText).digest("hex");

// 2. Check if already processed
const existing = await prisma.knowledgeDoc.findFirst({
  where: { contentSha: contentHash }
});

if (existing) {
  // Document already seen - check status
  if (existing.status === "COMPLETED") {
    // Skip - already done
  } else if (existing.status === "IN_PROGRESS") {
    if (resumePartial) {
      // Resume: continue chunking from last created chunk
      const lastChunk = await prisma.knowledgeChunk.findFirst({
        where: { docId: existing.id },
        orderBy: { chunkIndex: 'desc' }
      });
      startChunkingFrom = lastChunk ? lastChunk.chunkIndex + 1 : 0;
    } else {
      // Skip - don't touch partial work
    }
  } else if (existing.status === "FAILED") {
    if (forceReprocess) {
      // Delete failed doc and start over
    } else {
      // Skip - leave failed state for investigation
    }
  }
}
```

### Status Flow

```
PENDING → IN_PROGRESS → COMPLETED
            ↓
          FAILED (on error)
```

### Modes

**1. Normal Mode** (default)
- Hash check before processing
- Skip if status = COMPLETED
- Resume if status = IN_PROGRESS (continue chunking)
- Skip if status = FAILED

**2. Force Mode** (--force flag)
- Delete existing KnowledgeDoc and all chunks
- Reprocess from scratch
- Use when: document content changed, chunk size changed, need fresh start

**3. Test Mode** (maxDocuments > 0)
- Process only first N documents
- Still tracks status (COMPLETED) for processed docs
- Subsequent runs continue from N+1 (resume behavior)

## Database Schema

```prisma
enum IngestionStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
}

model KnowledgeDoc {
  contentSha      String           // Hash for deduplication
  status          IngestionStatus  @default(PENDING)
  chunksExpected  Int?             // Total chunks document should have
  chunksCreated   Int              @default(0)  // Actual chunks created
  errorMessage    String?          // Error if status = FAILED

  @@index([contentSha])
  @@index([status])
}
```

## Examples

### Example 1: First Run (Test with 10 docs)

```bash
# Settings: maxDocuments=10, resumePartial=true
npm run agent knowledge_ingestor

# Result:
# - Scans all files in sources/knowledge
# - Processes first 10 documents
# - Creates 10 KnowledgeDoc records (status=COMPLETED)
# - Creates ~100 KnowledgeChunk records (10 chunks per doc avg)
```

**Database State:**
```
KnowledgeDoc:
  id=1, contentSha=abc123, status=COMPLETED, chunksCreated=12
  id=2, contentSha=def456, status=COMPLETED, chunksCreated=8
  ...
  id=10, contentSha=xyz789, status=COMPLETED, chunksCreated=15
```

### Example 2: Second Run (Process more)

```bash
# Settings: maxDocuments=10 (still testing)
npm run agent knowledge_ingestor

# Result:
# - Scans all files
# - Skips first 10 (hash match, status=COMPLETED)
# - Processes next 10 documents
# - Total: 20 documents ingested
```

**Database State:**
```
KnowledgeDoc: 20 records (all COMPLETED)
KnowledgeChunk: ~200 records
```

### Example 3: Crash During Processing

```bash
# Settings: maxDocuments=50
npm run agent knowledge_ingestor
# ... crashes after 25 docs, doc #26 partially chunked
```

**Database State:**
```
KnowledgeDoc:
  id=1-25: status=COMPLETED
  id=26: status=IN_PROGRESS, chunksExpected=10, chunksCreated=4
```

**Resume:**
```bash
# Same settings: maxDocuments=50, resumePartial=true
npm run agent knowledge_ingestor

# Result:
# - Skips docs 1-25 (COMPLETED)
# - Resumes doc 26 from chunk index 4
# - Completes doc 26
# - Processes docs 27-50
```

### Example 4: Force Reprocess

```bash
# Settings: forceReprocess=true
npm run agent knowledge_ingestor

# Result:
# - Deletes ALL existing KnowledgeDoc + KnowledgeChunk records
# - Starts fresh from scratch
# - Use when: chunk size changed, need clean slate
```

## Recommendations

### For Testing
```json
{
  "maxDocuments": 10,
  "maxCharsPerChunk": 1500,
  "forceReprocess": false,
  "resumePartial": true
}
```

**Why:**
- Process small batch to test quickly
- Don't waste time reprocessing
- Can resume if crash
- Incremental testing: run multiple times with same limit

### For Production
```json
{
  "maxDocuments": 0,  // unlimited
  "maxCharsPerChunk": 1500,
  "forceReprocess": false,
  "resumePartial": true
}
```

**Why:**
- Process all documents
- Skip already-processed (fast dedup via hash)
- Resume on crash
- Idempotent: can run repeatedly

### For Clean Restart
```json
{
  "maxDocuments": 0,
  "forceReprocess": true,
  "resumePartial": false
}
```

**Why:**
- Delete everything and start over
- Use when schema changed
- Use when chunk strategy changed

## Performance

**Hash Check:**
- O(1) lookup via contentSha index
- ~1ms per document

**Skip vs Reprocess:**
- Skip (hash match): ~1ms
- Reprocess: 100-1000ms (PDF extraction + chunking + DB writes)

**Example: 500 PDFs**
- First run: ~10 minutes (extract + chunk all)
- Second run: ~500ms (hash check all, skip all)
- Third run with maxDocuments=10: ~1 minute (process 10 new, skip 500 old)

## Migration Path

If you already have KnowledgeDoc records without status tracking:

```sql
-- Set all existing docs to COMPLETED
UPDATE "KnowledgeDoc"
SET status = 'COMPLETED',
    chunksCreated = (
      SELECT COUNT(*)
      FROM "KnowledgeChunk"
      WHERE "KnowledgeChunk"."docId" = "KnowledgeDoc"."id"
    ),
    ingestedAt = NOW()
WHERE status IS NULL;
```
