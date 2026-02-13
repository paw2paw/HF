/**
 * registry.ts
 *
 * Contract Registry - loads and validates data contracts
 * Provides runtime access to contract definitions.
 *
 * Source of truth: SystemSetting table (key pattern: "contract:{contractId}")
 * Contracts are seeded from docs-archive/bdd-specs/contracts/*.contract.json during db:seed,
 * then served from DB at runtime. No filesystem reads at runtime.
 */

import { prisma } from "@/lib/prisma";
import { DataContract, ContractValidationResult, ContractImplementation } from './types';

const CACHE_TTL_MS = 30_000;

/**
 * Global contract registry singleton (DB-backed)
 */
class ContractRegistryClass {
  private contracts: Map<string, DataContract> = new Map();
  private loadPromise: Promise<void> | null = null;
  private loadedAt: number = 0;

  /**
   * Load all contracts from SystemSettings (DB)
   */
  async load(): Promise<void> {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: { key: { startsWith: 'contract:' } },
      });

      this.contracts.clear();
      for (const setting of settings) {
        try {
          const contract = JSON.parse(setting.value) as DataContract;
          if (!contract.contractId || !contract.version) {
            console.warn(`[contracts] Invalid contract in setting ${setting.key}: missing contractId or version`);
            continue;
          }
          this.contracts.set(contract.contractId, contract);
        } catch (error: any) {
          console.error(`[contracts] Error parsing ${setting.key}:`, error.message);
        }
      }

      this.loadedAt = Date.now();
      console.log(`[contracts] Loaded ${this.contracts.size} contracts from DB`);
    } catch (error: any) {
      console.error('[contracts] Failed to load from DB:', error.message);
    }
  }

  /**
   * Ensure contracts are loaded (with dedup and TTL refresh)
   */
  private async ensureLoaded(): Promise<void> {
    const now = Date.now();
    if (this.contracts.size > 0 && (now - this.loadedAt) < CACHE_TTL_MS) {
      return;
    }
    if (!this.loadPromise) {
      this.loadPromise = this.load().finally(() => {
        this.loadPromise = null;
      });
    }
    await this.loadPromise;
  }

  /**
   * Get a specific contract by ID
   */
  async getContract(contractId: string, version?: string): Promise<DataContract | null> {
    await this.ensureLoaded();

    const contract = this.contracts.get(contractId);
    if (!contract) return null;

    if (version && contract.version !== version) {
      console.warn(`[contracts] Version mismatch for ${contractId}: requested ${version}, have ${contract.version}`);
      return null;
    }

    return contract;
  }

  /**
   * List all available contracts
   */
  async listContracts(): Promise<DataContract[]> {
    await this.ensureLoaded();
    return Array.from(this.contracts.values());
  }

  /**
   * Validate that a spec correctly implements a contract
   */
  async validateSpec(
    specId: string,
    specConfig: any,
    implementation: ContractImplementation
  ): Promise<ContractValidationResult> {
    const result: ContractValidationResult = {
      valid: true,
      contractId: implementation.contractId,
      specId,
      errors: [],
      warnings: [],
    };

    const contract = await this.getContract(implementation.contractId, implementation.version);
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

        for (const [fieldName, fieldDef] of Object.entries(fields as any)) {
          if ((fieldDef as any).required && sectionMeta[fieldName] === undefined) {
            result.errors.push(`Missing required field: metadata.${section}.${fieldName}`);
            result.valid = false;
          }

          if ((fieldDef as any).enum && sectionMeta[fieldName]) {
            if (!(fieldDef as any).enum.includes(sectionMeta[fieldName])) {
              result.errors.push(
                `Invalid value for ${section}.${fieldName}: "${sectionMeta[fieldName]}" not in [${(fieldDef as any).enum.join(', ')}]`
              );
              result.valid = false;
            }
          }

          const fd = fieldDef as any;
          if (fd.type === 'number' && sectionMeta[fieldName] !== undefined) {
            const val = sectionMeta[fieldName];
            if (fd.min !== undefined && val < fd.min) {
              result.errors.push(`${section}.${fieldName} must be >= ${fd.min}`);
              result.valid = false;
            }
            if (fd.max !== undefined && val > fd.max) {
              result.errors.push(`${section}.${fieldName} must be <= ${fd.max}`);
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
  async getStorageKeys(contractId: string): Promise<Record<string, string> | null> {
    const contract = await this.getContract(contractId);
    return contract?.storage?.keys || null;
  }

  /**
   * Get key pattern for a contract
   */
  async getKeyPattern(contractId: string): Promise<string | null> {
    const contract = await this.getContract(contractId);
    return contract?.storage?.keyPattern || null;
  }

  /**
   * Get thresholds for a contract
   */
  async getThresholds(contractId: string): Promise<Record<string, number> | null> {
    const contract = await this.getContract(contractId);
    return contract?.thresholds || null;
  }
}

// Export singleton instance
export const ContractRegistry = new ContractRegistryClass();

// Convenience function to ensure contracts are loaded
export async function ensureContractsLoaded(): Promise<void> {
  await ContractRegistry.load();
}

// Export type for consumers
export type { DataContract, ContractValidationResult, ContractImplementation };
