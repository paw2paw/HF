/**
 * Settings Library Schema
 *
 * Reusable field definitions that agents can reference.
 * Stored in ~/hf_kb/.hf/settings-library.json
 */

export interface SettingsLibrary {
  version: number;
  updatedAt?: string;
  settings: Record<string, SettingDefinition>;
}

export type SettingDefinition =
  | NumberSetting
  | StringSetting
  | BooleanSetting
  | EnumSetting
  | PathSetting
  | ArraySetting;

export interface BaseSetting {
  type: 'number' | 'string' | 'boolean' | 'enum' | 'path' | 'array';
  title: string;
  description?: string;
  tags?: string[];
  category?: 'ingestion' | 'embedding' | 'paths' | 'processing' | 'batch' | 'misc';
}

export interface NumberSetting extends BaseSetting {
  type: 'number';
  default: number;
  minimum?: number;
  maximum?: number;
  step?: number;
}

export interface StringSetting extends BaseSetting {
  type: 'string';
  default: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface BooleanSetting extends BaseSetting {
  type: 'boolean';
  default: boolean;
}

export interface EnumSetting extends BaseSetting {
  type: 'enum';
  enum: string[];
  default: string;
}

export interface PathSetting extends BaseSetting {
  type: 'path';
  default: string;
  pathType: 'file' | 'directory';
  relative?: boolean; // Relative to kbRoot?
}

export interface ArraySetting extends BaseSetting {
  type: 'array';
  items: {
    type: 'string' | 'number';
    enum?: string[];
  };
  default: any[];
  minItems?: number;
  maxItems?: number;
}

/**
 * Default settings library with common field definitions
 */
export const DEFAULT_SETTINGS_LIBRARY: SettingsLibrary = {
  version: 1,
  settings: {
    // Batch processing limits
    scanLimit: {
      type: 'number',
      title: 'Scan Limit',
      description: 'Maximum records to process per run (0 = unlimited)',
      default: 200,
      minimum: 0,
      maximum: 10000,
      category: 'batch',
      tags: ['ingestion', 'batch-processing', 'limit'],
    },

    // Chunking parameters
    chunkSize: {
      type: 'number',
      title: 'Chunk Size (chars)',
      description: 'Maximum characters per chunk',
      default: 1500,
      minimum: 500,
      maximum: 4000,
      category: 'processing',
      tags: ['chunking', 'text-processing'],
    },

    overlapChars: {
      type: 'number',
      title: 'Overlap (chars)',
      description: 'Character overlap between chunks for context',
      default: 200,
      minimum: 0,
      maximum: 1000,
      category: 'processing',
      tags: ['chunking'],
    },

    // Force reprocess flag
    forceReprocess: {
      type: 'boolean',
      title: 'Force Reprocess',
      description: 'Delete existing data and reprocess from scratch',
      default: false,
      category: 'processing',
      tags: ['ingestion', 'dangerous', 'force'],
    },

    resumePartial: {
      type: 'boolean',
      title: 'Resume Partial',
      description: 'Resume partially-processed items instead of skipping',
      default: true,
      category: 'processing',
      tags: ['ingestion', 'resume'],
    },

    // Embedding parameters
    embeddingModel: {
      type: 'enum',
      title: 'Embedding Model',
      description: 'OpenAI embedding model to use',
      enum: ['text-embedding-3-small', 'text-embedding-3-large'],
      default: 'text-embedding-3-small',
      category: 'embedding',
      tags: ['embedding', 'openai', 'model'],
    },

    batchSize: {
      type: 'number',
      title: 'Batch Size',
      description: 'Number of items to process per API call',
      default: 50,
      minimum: 1,
      maximum: 100,
      category: 'batch',
      tags: ['embedding', 'batch-processing'],
    },

    // Path settings (relative to kbRoot)
    sourcesDir: {
      type: 'path',
      title: 'Sources Directory',
      description: 'Directory containing source documents for ingestion',
      default: 'sources',
      pathType: 'directory',
      relative: true,
      category: 'paths',
      tags: ['paths', 'ingestion'],
    },

    transcriptsDir: {
      type: 'path',
      title: 'Transcripts Directory',
      description: 'Directory containing raw call transcripts',
      default: 'sources/transcripts',
      pathType: 'directory',
      relative: true,
      category: 'paths',
      tags: ['paths', 'transcripts'],
    },

    derivedDir: {
      type: 'path',
      title: 'Derived Directory',
      description: 'Directory for derived/processed data',
      default: 'derived',
      pathType: 'directory',
      relative: true,
      category: 'paths',
      tags: ['paths', 'output'],
    },

    vectorsDir: {
      type: 'path',
      title: 'Vectors Directory',
      description: 'Directory for vector embeddings',
      default: 'vectors',
      pathType: 'directory',
      relative: true,
      category: 'paths',
      tags: ['paths', 'vectors'],
    },

    parametersRawPath: {
      type: 'path',
      title: 'Parameters CSV Path',
      description: 'Path to raw parameters CSV file',
      default: 'sources/parameters/parameters.csv',
      pathType: 'file',
      relative: true,
      category: 'paths',
      tags: ['paths', 'parameters'],
    },

    // Agent-specific source/output directories
    knowledgeSourceDir: {
      type: 'path',
      title: 'Knowledge Source Dir',
      description: 'Source directory for knowledge documents (PDFs, markdown)',
      default: 'sources/knowledge',
      pathType: 'directory',
      relative: true,
      category: 'paths',
      tags: ['paths', 'knowledge', 'agent'],
    },

    knowledgeOutputDir: {
      type: 'path',
      title: 'Knowledge Output Dir',
      description: 'Output directory for processed knowledge artifacts',
      default: 'derived/knowledge',
      pathType: 'directory',
      relative: true,
      category: 'paths',
      tags: ['paths', 'knowledge', 'agent'],
    },

    transcriptsSourceDir: {
      type: 'path',
      title: 'Transcripts Source Dir',
      description: 'Source directory for raw transcript JSON files',
      default: 'sources/transcripts',
      pathType: 'directory',
      relative: true,
      category: 'paths',
      tags: ['paths', 'transcripts', 'agent'],
    },

    transcriptsOutputDir: {
      type: 'path',
      title: 'Transcripts Output Dir',
      description: 'Output directory for processed transcript data',
      default: 'derived/transcripts',
      pathType: 'directory',
      relative: true,
      category: 'paths',
      tags: ['paths', 'transcripts', 'agent'],
    },

    embeddingsOutputDir: {
      type: 'path',
      title: 'Embeddings Output Dir',
      description: 'Output directory for vector embeddings',
      default: 'derived/embeddings',
      pathType: 'directory',
      relative: true,
      category: 'paths',
      tags: ['paths', 'embeddings', 'agent'],
    },

    parametersSourceDir: {
      type: 'path',
      title: 'Parameters Source Dir',
      description: 'Source directory for parameters CSV files',
      default: 'sources/parameters',
      pathType: 'directory',
      relative: true,
      category: 'paths',
      tags: ['paths', 'parameters', 'agent'],
    },

    parametersOutputDir: {
      type: 'path',
      title: 'Parameters Output Dir',
      description: 'Output directory for processed parameters',
      default: 'derived/parameters',
      pathType: 'directory',
      relative: true,
      category: 'paths',
      tags: ['paths', 'parameters', 'agent'],
    },

    // Personality analysis
    decayHalfLifeDays: {
      type: 'number',
      title: 'Decay Half-life (days)',
      description: 'Number of days until observation weight is halved',
      default: 30,
      minimum: 1,
      maximum: 365,
      category: 'processing',
      tags: ['personality', 'time-series', 'decay'],
    },

    // Auto-detection flags
    autoDetect: {
      type: 'boolean',
      title: 'Auto-detect',
      description: 'Automatically detect file type/format',
      default: true,
      category: 'processing',
      tags: ['detection', 'auto'],
    },
  },
};
