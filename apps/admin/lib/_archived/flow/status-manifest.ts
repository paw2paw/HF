/**
 * Flow Status Manifest
 *
 * Defines RAG status rules for each node type in the pipeline flow.
 * Status is computed based on counts from DB/filesystem.
 */

export type RagStatus = "red" | "amber" | "green";

export type NodeStats = {
  // Common
  status: RagStatus;
  statusLabel: string;

  // Source-specific stats
  directories?: number;
  files?: number;

  // Derived counts
  derived?: {
    label: string;
    count: number;
    link?: string;
  }[];

  // Processing stats
  processed?: number;
  pending?: number;
  total?: number;
  percentComplete?: number;

  // Last activity
  lastUpdated?: string;
};

export type FlowStatus = {
  nodes: Record<string, NodeStats>;
  fetchedAt: string;
};

/**
 * Status rule definitions per source type.
 * Used by the API to compute current status.
 */
export const STATUS_RULES = {
  "src:knowledge": {
    id: "src:knowledge",
    label: "Knowledge Base",
    table: "KnowledgeDoc",
    derivedTables: [
      { table: "KnowledgeChunk", label: "Chunks", link: "/knowledge-docs" },
      { table: "VectorEmbedding", label: "Vectors", link: "/vectors" },
    ],
    // Status logic:
    // red = 0 docs
    // amber = docs exist but not all have chunks/vectors
    // green = all docs have chunks and vectors
    statusLogic: "knowledge",
  },

  "src:transcripts": {
    id: "src:transcripts",
    label: "Transcripts",
    table: "ProcessedFile",
    derivedTables: [
      { table: "Call", label: "Calls", link: "/calls" },
      { table: "User", label: "Users", link: "/people" },
      { table: "TranscriptBatch", label: "Batches", link: "/transcript-batches" },
    ],
    statusLogic: "transcripts",
  },

  "src:parameters": {
    id: "src:parameters",
    label: "Parameters",
    table: "Parameter",
    derivedTables: [
      { table: "ParameterSet", label: "Snapshots", link: "/parameter-sets" },
    ],
    statusLogic: "parameters",
  },
} as const;

export type SourceNodeId = keyof typeof STATUS_RULES;
