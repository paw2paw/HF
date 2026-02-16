-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- VectorEmbedding: add native vector column alongside legacy BYTEA
ALTER TABLE "VectorEmbedding" ADD COLUMN "embedding" vector(1536);
ALTER TABLE "VectorEmbedding" ALTER COLUMN "embeddingData" DROP NOT NULL;

-- ContentAssertion: add vector column for semantic search
ALTER TABLE "ContentAssertion" ADD COLUMN "embedding" vector(1536);

-- HNSW indexes for fast cosine similarity search
CREATE INDEX "VectorEmbedding_embedding_cosine_idx"
  ON "VectorEmbedding" USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX "ContentAssertion_embedding_cosine_idx"
  ON "ContentAssertion" USING hnsw ("embedding" vector_cosine_ops);
