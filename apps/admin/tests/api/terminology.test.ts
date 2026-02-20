import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET } from '@/app/api/admin/terminology/route';

// Mock dependencies
vi.mock('@/lib/access-control', () => ({
  requireEntityAccess: vi.fn(),
  isEntityAuthError: vi.fn((r: any) => 'error' in r),
  invalidateAccessCache: vi.fn(),
}));

vi.mock('@/lib/terminology', () => ({
  getTerminologyContract: vi.fn(),
  invalidateTerminologyCache: vi.fn(),
}));

vi.mock('@/lib/contracts/registry', () => ({
  ContractRegistry: {
    getContract: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    systemSetting: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/audit', () => ({
  auditLog: vi.fn(),
  AuditAction: {
    UPDATED_TERMINOLOGY: 'updated_terminology',
  },
}));

import { requireEntityAccess, isEntityAuthError } from '@/lib/access-control';
import { getTerminologyContract, invalidateTerminologyCache } from '@/lib/terminology';
import { ContractRegistry } from '@/lib/contracts/registry';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';

describe('POST /api/admin/terminology', () => {
  const mockSession = {
    user: { id: 'user-123', email: 'admin@test.com', role: 'ADMIN' },
  };

  const mockTerms = {
    domain: {
      ADMIN: 'Domain',
      OPERATOR: 'Course',
      EDUCATOR: 'Institution',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject unauthorized users', async () => {
    vi.mocked(requireEntityAccess).mockResolvedValue({
      error: new Response('Forbidden', { status: 403 }),
    } as any);
    vi.mocked(isEntityAuthError).mockReturnValue(true);

    const req = new Request('http://localhost/api/admin/terminology', {
      method: 'POST',
      body: JSON.stringify({ terms: mockTerms }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('should validate required terms field', async () => {
    vi.mocked(requireEntityAccess).mockResolvedValue({
      session: mockSession,
      scope: 'ALL',
    } as any);
    vi.mocked(isEntityAuthError).mockReturnValue(false);

    const req = new Request('http://localhost/api/admin/terminology', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('should successfully update terminology and audit log', async () => {
    vi.mocked(requireEntityAccess).mockResolvedValue({
      session: mockSession,
      scope: 'ALL',
    } as any);
    vi.mocked(isEntityAuthError).mockReturnValue(false);
    vi.mocked(ContractRegistry.getContract).mockResolvedValue({
      contractId: 'TERMINOLOGY_V1',
      terms: mockTerms,
    } as any);

    const req = new Request('http://localhost/api/admin/terminology', {
      method: 'POST',
      body: JSON.stringify({ terms: mockTerms }),
    });

    await POST(req);

    expect(prisma.systemSetting.upsert).toHaveBeenCalled();
    expect(invalidateTerminologyCache).toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        userEmail: mockSession.user.email,
        action: 'updated_terminology',
      })
    );
  });
});

describe('GET /api/admin/terminology', () => {
  const mockContract = {
    contractId: 'TERMINOLOGY_V1',
    terms: { domain: { ADMIN: 'Domain' } },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject unauthorized users', async () => {
    vi.mocked(requireEntityAccess).mockResolvedValue({
      error: new Response('Forbidden', { status: 403 }),
    } as any);
    vi.mocked(isEntityAuthError).mockReturnValue(true);

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('should return contract on success', async () => {
    vi.mocked(requireEntityAccess).mockResolvedValue({
      session: { user: { role: 'OPERATOR' } },
      scope: 'ALL',
    } as any);
    vi.mocked(isEntityAuthError).mockReturnValue(false);
    vi.mocked(getTerminologyContract).mockResolvedValue(mockContract as any);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.contract).toBeDefined();
  });
});
