/**
 * registry.ts
 *
 * Contract Registry - loads and validates data contracts
 * Provides runtime access to contract definitions
 */

import * as fs from 'fs';
import * as path from 'path';
import { DataContract, ContractValidationResult, ContractImplementation } from './types';

/**
 * Global contract registry singleton
 */
class ContractRegistryClass {
  private contracts: Map<string, DataContract> = new Map();
  private loaded: boolean = false;

  /**
   * Load all contracts from the contracts directory
   */
  load(): void {
    if (this.loaded) return;

    const contractsDir = this.getContractsDir();
    if (!fs.existsSync(contractsDir)) {
      console.warn(`[contracts] Contracts directory not found: ${contractsDir}`);
      this.loaded = true;
      return;
    }

    const files = fs.readdirSync(contractsDir).filter(f => f.endsWith('.contract.json'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(contractsDir, file), 'utf-8');
        const contract = JSON.parse(content) as DataContract;

        // Validate contract structure
        if (!contract.contractId || !contract.version) {
          console.warn(`[contracts] Invalid contract in ${file}: missing contractId or version`);
          continue;
        }

        this.contracts.set(contract.contractId, contract);
        console.log(`[contracts] Loaded: ${contract.contractId} v${contract.version}`);
      } catch (error: any) {
        console.error(`[contracts] Error loading ${file}:`, error.message);
      }
    }

    this.loaded = true;
    console.log(`[contracts] Loaded ${this.contracts.size} contracts`);
  }

  /**
   * Get contracts directory path
   */
  private getContractsDir(): string {
    // Try process.cwd() first (works in Next.js API routes)
    const cwdPath = path.join(process.cwd(), 'bdd-specs', 'contracts');
    if (fs.existsSync(cwdPath)) {
      return cwdPath;
    }
    // Fallback to relative path
    return path.join(__dirname, '../../bdd-specs/contracts');
  }

  /**
   * Get a specific contract by ID
   */
  getContract(contractId: string, version?: string): DataContract | null {
    if (!this.loaded) this.load();

    const contract = this.contracts.get(contractId);
    if (!contract) return null;

    // If version specified, validate it matches
    if (version && contract.version !== version) {
      console.warn(`[contracts] Version mismatch for ${contractId}: requested ${version}, have ${contract.version}`);
      return null;
    }

    return contract;
  }

  /**
   * List all available contracts
   */
  listContracts(): DataContract[] {
    if (!this.loaded) this.load();
    return Array.from(this.contracts.values());
  }

  /**
   * Validate that a spec correctly implements a contract
   */
  validateSpec(
    specId: string,
    specConfig: any,
    implementation: ContractImplementation
  ): ContractValidationResult {
    const result: ContractValidationResult = {
      valid: true,
      contractId: implementation.contractId,
      specId,
      errors: [],
      warnings: [],
    };

    const contract = this.getContract(implementation.contractId, implementation.version);
    if (!contract) {
      result.valid = false;
      result.errors.push(`Contract not found: ${implementation.contractId}`);
      return result;
    }

    // Validate metadata requirements
    if (contract.metadata) {
      const specMetadata = specConfig?.metadata || {};

      for (const [section, fields] of Object.entries(contract.metadata)) {
        const sectionMeta = specMetadata[section];

        if (!sectionMeta) {
          result.errors.push(`Missing required metadata section: ${section}`);
          result.valid = false;
          continue;
        }

        // Check each required field
        for (const [fieldName, fieldDef] of Object.entries(fields as any)) {
          if (fieldDef.required && sectionMeta[fieldName] === undefined) {
            result.errors.push(`Missing required field: metadata.${section}.${fieldName}`);
            result.valid = false;
          }

          // Validate enum values
          if (fieldDef.enum && sectionMeta[fieldName]) {
            if (!fieldDef.enum.includes(sectionMeta[fieldName])) {
              result.errors.push(
                `Invalid value for ${section}.${fieldName}: "${sectionMeta[fieldName]}" not in [${fieldDef.enum.join(', ')}]`
              );
              result.valid = false;
            }
          }

          // Validate number ranges
          if (fieldDef.type === 'number' && sectionMeta[fieldName] !== undefined) {
            const val = sectionMeta[fieldName];
            if (fieldDef.min !== undefined && val < fieldDef.min) {
              result.errors.push(`${section}.${fieldName} must be >= ${fieldDef.min}`);
              result.valid = false;
            }
            if (fieldDef.max !== undefined && val > fieldDef.max) {
              result.errors.push(`${section}.${fieldName} must be <= ${fieldDef.max}`);
              result.valid = false;
            }
          }
        }
      }
    }

    // Validate producers/consumers
    if (implementation.role === 'producer' || implementation.role === 'both') {
      if (!implementation.produces || implementation.produces.length === 0) {
        result.warnings.push('Spec declares producer role but produces nothing');
      }
    }

    if (implementation.role === 'consumer' || implementation.role === 'both') {
      if (!implementation.consumes || implementation.consumes.length === 0) {
        result.warnings.push('Spec declares consumer role but consumes nothing');
      }
    }

    return result;
  }

  /**
   * Get storage keys for a contract
   */
  getStorageKeys(contractId: string): Record<string, string> | null {
    const contract = this.getContract(contractId);
    return contract?.storage?.keys || null;
  }

  /**
   * Get key pattern for a contract
   */
  getKeyPattern(contractId: string): string | null {
    const contract = this.getContract(contractId);
    return contract?.storage?.keyPattern || null;
  }

  /**
   * Get thresholds for a contract
   */
  getThresholds(contractId: string): Record<string, number> | null {
    const contract = this.getContract(contractId);
    return contract?.thresholds || null;
  }
}

// Export singleton instance
export const ContractRegistry = new ContractRegistryClass();

// Convenience function to ensure contracts are loaded
export function ensureContractsLoaded(): void {
  ContractRegistry.load();
}

// Export type for consumers
export type { DataContract, ContractValidationResult, ContractImplementation };
