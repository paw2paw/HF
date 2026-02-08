/**
 * types.ts
 *
 * Type definitions for Data Contracts
 * Contracts define shared data schemas and conventions between specs
 */

/**
 * Data Contract - defines how specs share data
 */
export interface DataContract {
  contractId: string;
  version: string;
  description: string;
  status: 'draft' | 'active' | 'deprecated';

  // What domains/roles this contract applies to
  appliesTo?: {
    specRoles?: string[];
    domains?: string[];
  };

  // Storage conventions (where data lives)
  storage?: {
    keyPattern: string;  // e.g., "curriculum:{specSlug}:{key}"
    keys: Record<string, string>;  // Named keys like "currentModule": "current_module"
  };

  // Data schemas (what shape data has)
  dataSchema?: Record<string, DataSchemaField>;

  // Thresholds and constants
  thresholds?: Record<string, number>;

  // Configuration parameters
  config?: Record<string, any>;

  // Metadata about spec behavior
  metadata?: Record<string, any>;
}

export interface DataSchemaField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  default?: any;
  pattern?: string;  // For string validation
  min?: number;      // For number validation
  max?: number;
}

/**
 * Contract Implementation - how a spec declares it uses a contract
 */
export interface ContractImplementation {
  contractId: string;
  version?: string;  // If not specified, uses latest
  role: 'producer' | 'consumer' | 'both';

  // What data this spec produces (for producers)
  produces?: {
    field: string;  // Which field in contract schema
    source: string;  // Where in spec config (e.g., "parameters[section=content]")
    transform?: string;  // Optional transform function
  }[];

  // What data this spec consumes (for consumers)
  consumes?: {
    field: string;  // Which field in contract schema
    required: boolean;
  }[];
}

/**
 * Contract Validation Result
 */
export interface ContractValidationResult {
  valid: boolean;
  contractId: string;
  specId: string;
  errors: string[];
  warnings: string[];
}

/**
 * Contract Registry - manages all contracts
 */
export interface ContractRegistry {
  contracts: Map<string, DataContract>;
  getContract(contractId: string, version?: string): DataContract | null;
  validateSpec(specId: string, implementation: ContractImplementation): ContractValidationResult;
  listContracts(): DataContract[];
}
