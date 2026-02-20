import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTerminologyForRole, getTermLabel, getTerminologyContract } from '@/lib/terminology';

vi.mock('@/lib/contracts/registry', () => ({
  ContractRegistry: {
    getContract: vi.fn(),
  },
}));

import { ContractRegistry } from '@/lib/contracts/registry';

describe('lib/terminology', () => {
  const mockContract = {
    contractId: 'TERMINOLOGY_V1',
    version: '1.0',
    status: 'active',
    terms: {
      domain: {
        ADMIN: 'Domain',
        OPERATOR: 'Domain',
        EDUCATOR: 'Institution',
        TESTER: 'Institution',
      },
      playbook: {
        ADMIN: 'Playbook',
        OPERATOR: 'Course',
        EDUCATOR: 'Course',
        TESTER: 'Course',
      },
      spec: {
        ADMIN: 'Spec',
        OPERATOR: 'Content',
        EDUCATOR: 'Content',
        TESTER: 'Content',
      },
      caller: {
        ADMIN: 'Caller',
        OPERATOR: 'Student',
        EDUCATOR: 'Student',
        STUDENT: 'Learner',
        TESTER: 'Student',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTerminologyForRole', () => {
    it('should return terminology for ADMIN role', async () => {
      vi.mocked(ContractRegistry.getContract).mockResolvedValue(mockContract as any);

      const terms = await getTerminologyForRole('ADMIN');

      expect(terms.domain).toBe('Domain');
      expect(terms.playbook).toBe('Playbook');
      expect(terms.spec).toBe('Spec');
      expect(terms.caller).toBe('Caller');
    });

    it('should return terminology for EDUCATOR role', async () => {
      vi.mocked(ContractRegistry.getContract).mockResolvedValue(mockContract as any);

      const terms = await getTerminologyForRole('EDUCATOR');

      expect(terms.domain).toBe('Institution');
      expect(terms.playbook).toBe('Course');
      expect(terms.spec).toBe('Content');
      expect(terms.caller).toBe('Student');
    });

    it('should use ADMIN terms for SUPERADMIN', async () => {
      vi.mocked(ContractRegistry.getContract).mockResolvedValue(mockContract as any);

      const terms = await getTerminologyForRole('SUPERADMIN');

      expect(terms.domain).toBe('Domain');
      expect(terms.playbook).toBe('Playbook');
    });

    it('should use TESTER for VIEWER (alias)', async () => {
      vi.mocked(ContractRegistry.getContract).mockResolvedValue(mockContract as any);

      const terms = await getTerminologyForRole('VIEWER');

      expect(terms.domain).toBe('Institution');
      expect(terms.playbook).toBe('Course');
    });
  });

  describe('getTermLabel', () => {
    it('should return singular label', async () => {
      vi.mocked(ContractRegistry.getContract).mockResolvedValue(mockContract as any);

      const label = await getTermLabel('domain', 'EDUCATOR');

      expect(label).toBe('Institution');
    });

    it('should return plural label', async () => {
      vi.mocked(ContractRegistry.getContract).mockResolvedValue(mockContract as any);

      const label = await getTermLabel('domain', 'EDUCATOR', true);

      expect(label).toBe('Institutions');
    });
  });

  describe('getTerminologyContract', () => {
    it('should return full contract', async () => {
      vi.mocked(ContractRegistry.getContract).mockResolvedValue(mockContract as any);

      const contract = await getTerminologyContract();

      expect(contract.contractId).toBe('TERMINOLOGY_V1');
      expect(contract.terms).toBeDefined();
    });

    it('should use defaults if contract not found', async () => {
      vi.mocked(ContractRegistry.getContract).mockResolvedValue(null);

      const contract = await getTerminologyContract();

      expect(contract.contractId).toBe('TERMINOLOGY_V1');
      expect(contract.terms).toBeDefined();
    });
  });
});
