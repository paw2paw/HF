import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock auth
vi.mock('@/lib/permissions', () => ({
  requireAuth: vi.fn(),
  isAuthError: vi.fn((r: any) => 'error' in r),
}));

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    institutionType: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock terminology cache
vi.mock('@/lib/terminology', () => ({
  invalidateTerminologyCache: vi.fn(),
}));

import { requireAuth, isAuthError } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { invalidateTerminologyCache } from '@/lib/terminology';
import { GET, POST } from '@/app/api/admin/institution-types/route';
import { PATCH, DELETE } from '@/app/api/admin/institution-types/[id]/route';

const mockAdminAuth = {
  session: { user: { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' } },
};

const VALID_TERMINOLOGY = {
  domain: 'School',
  playbook: 'Lesson Plan',
  spec: 'Content',
  caller: 'Student',
  cohort: 'Class',
  instructor: 'Teacher',
  session: 'Lesson',
};

describe('GET /api/admin/institution-types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(mockAdminAuth as any);
    vi.mocked(isAuthError).mockReturnValue(false);
  });

  it('should reject non-admin users', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      error: new Response('Forbidden', { status: 403 }),
    } as any);
    vi.mocked(isAuthError).mockReturnValue(true);

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('should return list of institution types', async () => {
    vi.mocked(prisma.institutionType.findMany).mockResolvedValue([
      {
        id: 'type-1',
        slug: 'school',
        name: 'School',
        terminology: VALID_TERMINOLOGY,
        _count: { institutions: 3 },
      },
    ] as any);

    const res = await GET();
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.types).toHaveLength(1);
    expect(data.types[0].slug).toBe('school');
  });
});

describe('POST /api/admin/institution-types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(mockAdminAuth as any);
    vi.mocked(isAuthError).mockReturnValue(false);
  });

  it('should require name', async () => {
    const req = new Request('http://localhost/api/admin/institution-types', {
      method: 'POST',
      body: JSON.stringify({ slug: 'test', terminology: VALID_TERMINOLOGY }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Name');
  });

  it('should require slug', async () => {
    const req = new Request('http://localhost/api/admin/institution-types', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', terminology: VALID_TERMINOLOGY }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Slug');
  });

  it('should validate slug format', async () => {
    const req = new Request('http://localhost/api/admin/institution-types', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test',
        slug: 'INVALID SLUG!',
        terminology: VALID_TERMINOLOGY,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('lowercase');
  });

  it('should require all 7 terminology keys', async () => {
    const req = new Request('http://localhost/api/admin/institution-types', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test',
        slug: 'test',
        terminology: { domain: 'School' }, // missing 6 keys
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Missing terminology keys');
  });

  it('should reject duplicate slug', async () => {
    vi.mocked(prisma.institutionType.findUnique).mockResolvedValue({ id: 'existing' } as any);

    const req = new Request('http://localhost/api/admin/institution-types', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Duplicate',
        slug: 'existing',
        terminology: VALID_TERMINOLOGY,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain('already exists');
  });

  it('should create institution type successfully', async () => {
    vi.mocked(prisma.institutionType.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.institutionType.create).mockResolvedValue({
      id: 'new-type',
      slug: 'university',
      name: 'University',
      terminology: VALID_TERMINOLOGY,
    } as any);

    const req = new Request('http://localhost/api/admin/institution-types', {
      method: 'POST',
      body: JSON.stringify({
        name: 'University',
        slug: 'university',
        terminology: VALID_TERMINOLOGY,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.type.name).toBe('University');
  });
});

describe('PATCH /api/admin/institution-types/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(mockAdminAuth as any);
    vi.mocked(isAuthError).mockReturnValue(false);
  });

  it('should return 404 for non-existent type', async () => {
    vi.mocked(prisma.institutionType.findUnique).mockResolvedValue(null);

    const req = new Request('http://localhost/api/admin/institution-types/nonexistent', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'nonexistent' }) });
    expect(res.status).toBe(404);
  });

  it('should update name and terminology', async () => {
    vi.mocked(prisma.institutionType.findUnique).mockResolvedValue({ id: 'type-1' } as any);
    vi.mocked(prisma.institutionType.update).mockResolvedValue({
      id: 'type-1',
      name: 'Updated School',
      terminology: VALID_TERMINOLOGY,
    } as any);

    const req = new Request('http://localhost/api/admin/institution-types/type-1', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Updated School',
        terminology: VALID_TERMINOLOGY,
      }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'type-1' }) });
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.type.name).toBe('Updated School');
    expect(invalidateTerminologyCache).toHaveBeenCalled();
  });
});

describe('DELETE /api/admin/institution-types/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(mockAdminAuth as any);
    vi.mocked(isAuthError).mockReturnValue(false);
  });

  it('should soft-delete (deactivate) the type', async () => {
    vi.mocked(prisma.institutionType.findUnique).mockResolvedValue({ id: 'type-1' } as any);
    vi.mocked(prisma.institutionType.update).mockResolvedValue({ id: 'type-1', isActive: false } as any);

    const req = new Request('http://localhost/api/admin/institution-types/type-1', {
      method: 'DELETE',
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: 'type-1' }) });
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(prisma.institutionType.update).toHaveBeenCalledWith({
      where: { id: 'type-1' },
      data: { isActive: false },
    });
    expect(invalidateTerminologyCache).toHaveBeenCalled();
  });
});
