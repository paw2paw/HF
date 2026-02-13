/**
 * Tests for Onboarding API Routes
 *
 * Covers:
 * - GET /api/onboarding - returns 404 when spec not in DB
 * - GET /api/onboarding - returns persona data from DB
 * - GET /api/onboarding/personas - returns 404 when spec not in DB
 * - GET /api/onboarding/personas - lists personas from DB
 * - POST /api/onboarding/personas/manage - creates persona
 * - DELETE /api/onboarding/personas/manage - deletes persona
 * - Uses config.specs.onboarding (not hardcoded slug)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock prisma
const mockPrisma = {
  analysisSpec: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  promptSlug: {
    upsert: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock auth - default to passing
vi.mock('@/lib/permissions', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    session: { user: { id: 'test-user', role: 'ADMIN' } },
  }),
  isAuthError: vi.fn((result) => 'error' in result),
}));

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    specs: {
      onboarding: 'INIT-001',
      onboardingSlugPrefix: 'init.',
    },
  },
}));

// Mock registry (used in onboarding/route.ts)
vi.mock('@/lib/registry', () => ({
  PARAMS: {},
}));

// Test helpers
function createMockGetRequest(url: string = 'http://localhost:3000/api/onboarding'): NextRequest {
  return new NextRequest(url);
}

function createMockPostRequest(body: Record<string, any>): NextRequest {
  return new NextRequest('http://localhost:3000/api/onboarding/personas/manage', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function createMockDeleteRequest(slug: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/onboarding/personas/manage?slug=${slug}`, {
    method: 'DELETE',
  });
}

// Sample spec data
const MOCK_ONBOARDING_SPEC = {
  id: 'spec-123',
  slug: 'init-001-caller-onboarding',
  name: 'Caller Onboarding',
  description: 'Onboarding spec',
  updatedAt: new Date('2026-01-01'),
  config: {
    personas: {
      defaultPersona: 'tutor',
      tutor: {
        name: 'Tutor',
        description: 'A helpful tutor',
        icon: '📚',
        defaultTargets: { knowledge: 0.7 },
        firstCallFlow: {
          phases: [{ phase: 'intro', instructionSlug: 'init.phase.intro.tutor' }],
          successMetrics: ['completed_intro'],
        },
        welcomeSlug: 'init.welcome.tutor',
        welcomeTemplate: 'Hello, I am your tutor!',
      },
      coach: {
        name: 'Coach',
        description: 'A motivating coach',
        icon: '🏋️',
        defaultTargets: { motivation: 0.8 },
        firstCallFlow: { phases: [], successMetrics: [] },
        welcomeSlug: 'init.welcome.coach',
      },
    },
    parameters: [
      { id: 'default_targets_quality', config: { defaultTargets: { overall: 0.5 } } },
    ],
  },
};

describe('GET /api/onboarding', () => {
  let GET: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/app/api/onboarding/route');
    GET = mod.GET;
  });

  it('returns 404 when onboarding spec not found in DB', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue(null);

    const req = createMockGetRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toContain('INIT-001');
    expect(body.error).toContain('spec-sync');
  });

  it('returns persona data from DB', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue(MOCK_ONBOARDING_SPEC);

    const req = createMockGetRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.source).toBe('database');
    expect(body.selectedPersona).toBe('tutor');
    expect(body.availablePersonas).toContain('tutor');
    expect(body.availablePersonas).toContain('coach');
  });

  it('selects requested persona via query param', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue(MOCK_ONBOARDING_SPEC);

    const req = createMockGetRequest('http://localhost:3000/api/onboarding?persona=coach');
    const res = await GET(req);
    const body = await res.json();

    expect(body.selectedPersona).toBe('coach');
    expect(body.personaName).toBe('Coach');
  });

  it('falls back to default persona for unknown slug', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue(MOCK_ONBOARDING_SPEC);

    const req = createMockGetRequest('http://localhost:3000/api/onboarding?persona=nonexistent');
    const res = await GET(req);
    const body = await res.json();

    expect(body.selectedPersona).toBe('tutor');
  });

  it('uses config.specs.onboarding for slug lookup (not hardcoded)', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue(MOCK_ONBOARDING_SPEC);

    const req = createMockGetRequest();
    await GET(req);

    // Verify the query used the config value (lowercased)
    const findFirstCall = mockPrisma.analysisSpec.findFirst.mock.calls[0][0];
    const slugContains = findFirstCall.where.OR[0].slug.contains;
    expect(slugContains).toBe('init-001');
  });
});

describe('GET /api/onboarding/personas', () => {
  let GET: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/app/api/onboarding/personas/route');
    GET = mod.GET;
  });

  it('returns 404 when spec not in DB', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toContain('INIT-001');
  });

  it('lists all personas from DB spec', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue({
      id: 'spec-123',
      slug: 'init-001-caller-onboarding',
      config: MOCK_ONBOARDING_SPEC.config,
      updatedAt: new Date(),
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.source).toBe('database');
    expect(body.defaultPersona).toBe('tutor');
    expect(body.personas).toHaveLength(2);
    expect(body.personas[0].slug).toBe('tutor');
    expect(body.personas[1].slug).toBe('coach');
  });

  it('uses config.specs.onboarding for slug lookup', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue(null);

    await GET();

    const findFirstCall = mockPrisma.analysisSpec.findFirst.mock.calls[0][0];
    expect(findFirstCall.where.OR[0].slug.contains).toBe('init-001');
  });
});

describe('POST /api/onboarding/personas/manage', () => {
  let POST: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/app/api/onboarding/personas/manage/route');
    POST = mod.POST;

    mockPrisma.analysisSpec.update.mockResolvedValue({});
    mockPrisma.promptSlug.upsert.mockResolvedValue({});
  });

  it('returns 400 when slug/name missing', async () => {
    const req = createMockPostRequest({});
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('slug and name are required');
  });

  it('returns 400 for invalid slug format', async () => {
    const req = createMockPostRequest({ slug: 'Invalid Slug!', name: 'Test' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('lowercase');
  });

  it('returns 404 when onboarding spec not found', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue(null);

    const req = createMockPostRequest({ slug: 'mentor', name: 'Mentor' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('INIT-001');
  });

  it('creates a new persona successfully', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue({
      id: 'spec-123',
      config: MOCK_ONBOARDING_SPEC.config,
    });

    const req = createMockPostRequest({ slug: 'mentor', name: 'Mentor' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.persona.slug).toBe('mentor');
    expect(body.persona.name).toBe('Mentor');

    // Should update the spec config in DB
    expect(mockPrisma.analysisSpec.update).toHaveBeenCalled();
    // Should create welcome prompt slug
    expect(mockPrisma.promptSlug.upsert).toHaveBeenCalled();
  });

  it('returns 400 when persona slug already exists', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue({
      id: 'spec-123',
      config: MOCK_ONBOARDING_SPEC.config,
    });

    const req = createMockPostRequest({ slug: 'tutor', name: 'Tutor Again' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("already exists");
  });
});

describe('DELETE /api/onboarding/personas/manage', () => {
  let DELETE: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/app/api/onboarding/personas/manage/route');
    DELETE = mod.DELETE;

    mockPrisma.analysisSpec.update.mockResolvedValue({});
  });

  it('returns 400 when slug param missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/onboarding/personas/manage', {
      method: 'DELETE',
    });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('slug query param is required');
  });

  it('returns 404 when spec not found', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue(null);

    const req = createMockDeleteRequest('coach');
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(404);
  });

  it('returns 400 when trying to delete default persona', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue({
      id: 'spec-123',
      config: MOCK_ONBOARDING_SPEC.config,
    });

    const req = createMockDeleteRequest('tutor');
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('default persona');
  });

  it('deletes a non-default persona successfully', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue({
      id: 'spec-123',
      config: MOCK_ONBOARDING_SPEC.config,
    });

    const req = createMockDeleteRequest('coach');
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.message).toContain('coach');

    // Should update the spec config in DB without the deleted persona
    const updateCall = mockPrisma.analysisSpec.update.mock.calls[0][0];
    expect(updateCall.data.config.personas.coach).toBeUndefined();
    expect(updateCall.data.config.personas.tutor).toBeDefined();
  });

  it('returns 404 when persona does not exist', async () => {
    mockPrisma.analysisSpec.findFirst.mockResolvedValue({
      id: 'spec-123',
      config: MOCK_ONBOARDING_SPEC.config,
    });

    const req = createMockDeleteRequest('nonexistent');
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('not found');
  });
});
