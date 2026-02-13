/**
 * Domain Readiness Checker
 *
 * Loads DOMAIN-READY-001 ORCHESTRATE spec and evaluates each check
 * against the database for a given domain.
 *
 * Spec-driven: checks are defined in the spec config, not hardcoded here.
 * Adding/removing/reordering checks = edit the spec, zero code changes.
 */

import { prisma } from "@/lib/prisma";
import { CURRICULUM_REQUIRED_FIELDS } from "@/lib/curriculum/constants";

// =====================================================
// TYPES
// =====================================================

export interface ReadinessCheck {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "recommended" | "optional";
  query: string;
  queryArgs?: Record<string, any>;
  fixAction?: { label: string; href: string };
}

export interface ReadinessCheckResult {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "recommended" | "optional";
  passed: boolean;
  detail: string;
  fixAction?: { label: string; href: string };
}

export interface DomainReadinessResult {
  domainId: string;
  domainName: string;
  ready: boolean;
  score: number;
  level: "ready" | "almost" | "incomplete";
  checks: ReadinessCheckResult[];
  criticalPassed: number;
  criticalTotal: number;
  recommendedPassed: number;
  recommendedTotal: number;
}

// =====================================================
// SPEC LOADER
// =====================================================

/**
 * Load readiness checks from DOMAIN-READY-001 spec.
 * Falls back to hardcoded defaults if spec not found (during initial setup).
 */
export async function loadReadinessChecks(): Promise<ReadinessCheck[]> {
  const spec = await prisma.analysisSpec.findFirst({
    where: {
      slug: { contains: "domain-ready-001", mode: "insensitive" },
      isActive: true,
    },
    select: { config: true },
  });

  if (spec?.config) {
    const config = spec.config as Record<string, any>;
    const params = config.parameters || [];
    const checksParam = params.find((p: any) => p.id === "readiness_checks");
    if (checksParam?.config?.checks) {
      return checksParam.config.checks as ReadinessCheck[];
    }
  }

  // Fallback: return a minimal set so readiness works even before spec is seeded
  return [
    {
      id: "playbook_published",
      name: "Published Playbook",
      description: "Domain has at least one published playbook",
      severity: "critical",
      query: "playbook",
      fixAction: { label: "Create Playbook", href: "/x/domains?tab=playbooks" },
    },
    {
      id: "identity_spec",
      name: "Identity Spec",
      description: "Playbook includes an IDENTITY spec",
      severity: "critical",
      query: "playbook_spec_role",
      queryArgs: { specRole: "IDENTITY" },
      fixAction: { label: "Create Identity Spec", href: "/x/specs/new" },
    },
    {
      id: "ai_keys",
      name: "AI Keys Configured",
      description: "At least one AI provider has an API key",
      severity: "critical",
      query: "ai_keys",
      fixAction: { label: "Configure AI Keys", href: "/x/settings" },
    },
    {
      id: "content_curriculum_valid",
      name: "Curriculum Structure",
      description: "CONTENT spec has valid curriculum metadata for progress tracking",
      severity: "recommended",
      query: "content_spec_curriculum",
      fixAction: { label: "Edit Content Spec", href: "/x/specs" },
    },
  ];
}

// =====================================================
// CHECK EXECUTORS
// =====================================================

type CheckExecutor = (
  domainId: string,
  check: ReadinessCheck,
) => Promise<{ passed: boolean; detail: string }>;

/**
 * Registry of check executors keyed by query type.
 * Each executor evaluates a specific condition and returns pass/fail + detail.
 */
const checkExecutors: Record<string, CheckExecutor> = {
  // Domain has a PUBLISHED playbook
  playbook: async (domainId) => {
    const playbook = await prisma.playbook.findFirst({
      where: { domainId, status: "PUBLISHED" },
      select: { id: true, name: true },
    });
    return playbook
      ? { passed: true, detail: `Published: "${playbook.name}"` }
      : { passed: false, detail: "No published playbook found" };
  },

  // Playbook contains a spec with the given specRole (domain items + system spec toggles)
  playbook_spec_role: async (domainId, check) => {
    const specRole = check.queryArgs?.specRole;
    if (!specRole) return { passed: false, detail: "Missing queryArgs.specRole" };

    const playbook = await prisma.playbook.findFirst({
      where: { domainId, status: "PUBLISHED" },
      select: {
        config: true,
        items: {
          where: {
            itemType: "SPEC",
            isEnabled: true,
            spec: { specRole: specRole as any, isActive: true },
          },
          select: { spec: { select: { slug: true, name: true } } },
        },
      },
    });

    const domainSpecs = playbook?.items?.map((i) => i.spec).filter(Boolean) || [];

    // Also check system specs enabled via config.systemSpecToggles
    const systemSpecs: { name: string }[] = [];
    if (playbook?.config) {
      const config = playbook.config as Record<string, any>;
      const toggles = config.systemSpecToggles || {};
      const enabledIds = Object.entries(toggles)
        .filter(([, v]: [string, any]) => v?.isEnabled !== false)
        .map(([id]) => id);

      if (enabledIds.length > 0) {
        const matching = await prisma.analysisSpec.findMany({
          where: {
            id: { in: enabledIds },
            specRole: specRole as any,
            isActive: true,
          },
          select: { name: true },
        });
        systemSpecs.push(...matching);
      }
    }

    const allSpecs = [...domainSpecs.map((s) => s!.name), ...systemSpecs.map((s) => s.name)];
    return allSpecs.length > 0
      ? { passed: true, detail: `${allSpecs.length} ${specRole} spec(s): ${allSpecs.join(", ")}` }
      : { passed: false, detail: `No ${specRole} spec in published playbook` };
  },

  // Domain's subjects have content sources linked
  content_sources: async (domainId) => {
    const count = await prisma.subjectSource.count({
      where: {
        subject: {
          domains: { some: { domainId } },
        },
      },
    });
    return count > 0
      ? { passed: true, detail: `${count} content source(s) linked` }
      : { passed: false, detail: "No content sources linked to domain subjects" };
  },

  // ContentAssertions exist for domain's content sources
  assertions: async (domainId) => {
    // Get source IDs through domain → subjects → sources
    const sourceIds = await prisma.subjectSource.findMany({
      where: {
        subject: {
          domains: { some: { domainId } },
        },
      },
      select: { sourceId: true },
    });

    if (sourceIds.length === 0) {
      return { passed: false, detail: "No content sources to extract from" };
    }

    const count = await prisma.contentAssertion.count({
      where: { sourceId: { in: sourceIds.map((s) => s.sourceId) } },
    });

    return count > 0
      ? { passed: true, detail: `${count} teaching point(s) extracted` }
      : { passed: false, detail: "No teaching points extracted from documents" };
  },

  // Domain has onboarding configured
  onboarding: async (domainId) => {
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: {
        onboardingIdentitySpecId: true,
        onboardingFlowPhases: true,
      },
    });

    const hasIdentity = !!domain?.onboardingIdentitySpecId;
    const hasPhases = !!domain?.onboardingFlowPhases;

    if (hasIdentity && hasPhases) {
      return { passed: true, detail: "Identity spec + flow phases configured" };
    }
    const missing = [];
    if (!hasIdentity) missing.push("identity spec");
    if (!hasPhases) missing.push("flow phases");
    return { passed: false, detail: `Missing: ${missing.join(", ")}` };
  },

  // System spec is active and not dirty
  system_spec: async (_domainId, check) => {
    const slug = check.queryArgs?.slug;
    if (!slug) return { passed: false, detail: "Missing queryArgs.slug" };

    const spec = await prisma.analysisSpec.findFirst({
      where: {
        slug: { contains: slug.toLowerCase(), mode: "insensitive" },
        isActive: true,
        isDirty: false,
      },
      select: { slug: true, name: true },
    });

    return spec
      ? { passed: true, detail: `${spec.name} is active` }
      : { passed: false, detail: `${slug} is not active or needs recompilation` };
  },

  // AI API keys configured
  ai_keys: async () => {
    const hasClaude = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAI = !!(process.env.OPENAI_HF_MVP_KEY || process.env.OPENAI_API_KEY);

    if (hasClaude && hasOpenAI) {
      return { passed: true, detail: "Claude + OpenAI configured" };
    }
    if (hasClaude) return { passed: true, detail: "Claude configured" };
    if (hasOpenAI) return { passed: true, detail: "OpenAI configured" };
    return { passed: false, detail: "No AI provider API keys found" };
  },

  // Domain has at least one caller
  test_caller: async (domainId) => {
    const count = await prisma.caller.count({
      where: { domainId },
    });
    return count > 0
      ? { passed: true, detail: `${count} caller(s) in domain` }
      : { passed: false, detail: "No callers assigned to this domain" };
  },

  // CONTENT spec has valid curriculum metadata for pipeline progress tracking
  content_spec_curriculum: async (domainId) => {
    const playbook = await prisma.playbook.findFirst({
      where: { domainId, status: "PUBLISHED" },
      select: {
        items: {
          where: {
            itemType: "SPEC",
            isEnabled: true,
          },
          select: {
            spec: {
              select: { slug: true, name: true, config: true, specRole: true, isActive: true },
            },
          },
        },
      },
    });

    const contentSpecItem = playbook?.items.find(
      (i) => i.spec?.specRole === "CONTENT" && i.spec?.isActive,
    );
    const contentSpec = contentSpecItem?.spec;

    if (!contentSpec) {
      // No CONTENT spec is fine — domain may not have a curriculum
      return { passed: true, detail: "No CONTENT spec in playbook (curriculum not required)" };
    }

    const config = contentSpec.config as Record<string, any> | null;
    const meta = config?.metadata?.curriculum;
    if (!meta) {
      return {
        passed: false,
        detail: `${contentSpec.name} is missing metadata.curriculum section`,
      };
    }

    const missing = CURRICULUM_REQUIRED_FIELDS.filter((f) => meta[f] === undefined);
    if (missing.length > 0) {
      return {
        passed: false,
        detail: `${contentSpec.name} curriculum metadata missing: ${missing.join(", ")}`,
      };
    }

    // Check that at least one parameter matches moduleSelector
    const params = config?.parameters || [];
    const [selectorKey, selectorValue] = (meta.moduleSelector as string).split("=");
    const matchingModules = params.filter((p: any) => p[selectorKey] === selectorValue);
    if (matchingModules.length === 0) {
      return {
        passed: false,
        detail: `No parameters match moduleSelector "${meta.moduleSelector}" in ${contentSpec.name}`,
      };
    }

    // Check if any modules have learningOutcomes
    const withLOs = matchingModules.filter(
      (p: any) => p.learningOutcomes?.length > 0 || p.config?.learningOutcomes?.length > 0,
    );

    if (withLOs.length === 0) {
      return {
        passed: true,
        detail: `${matchingModules.length} modules but no learningOutcomes — mastery scoring will be limited`,
      };
    }

    return {
      passed: true,
      detail: `${matchingModules.length} modules, ${withLOs.length} with learning outcomes`,
    };
  },
};

// =====================================================
// MAIN EXECUTOR
// =====================================================

/**
 * Check domain readiness by evaluating all checks from DOMAIN-READY-001 spec.
 * All checks run in parallel for performance.
 */
export async function checkDomainReadiness(
  domainId: string,
): Promise<DomainReadinessResult> {
  // Load domain info
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    select: { id: true, name: true },
  });

  if (!domain) {
    throw new Error(`Domain not found: ${domainId}`);
  }

  // Load checks from spec
  const checks = await loadReadinessChecks();

  // Execute all checks in parallel
  const results: ReadinessCheckResult[] = await Promise.all(
    checks.map(async (check) => {
      const executor = checkExecutors[check.query];
      if (!executor) {
        return {
          id: check.id,
          name: check.name,
          description: check.description,
          severity: check.severity,
          passed: false,
          detail: `Unknown check query: "${check.query}"`,
          fixAction: check.fixAction,
        };
      }

      try {
        const { passed, detail } = await executor(domainId, check);
        return {
          id: check.id,
          name: check.name,
          description: check.description,
          severity: check.severity,
          passed,
          detail,
          fixAction: check.fixAction,
        };
      } catch (err: any) {
        return {
          id: check.id,
          name: check.name,
          description: check.description,
          severity: check.severity,
          passed: false,
          detail: `Check failed: ${err.message}`,
          fixAction: check.fixAction,
        };
      }
    }),
  );

  // Compute summary
  const criticalChecks = results.filter((r) => r.severity === "critical");
  const recommendedChecks = results.filter((r) => r.severity === "recommended");
  const criticalPassed = criticalChecks.filter((r) => r.passed).length;
  const recommendedPassed = recommendedChecks.filter((r) => r.passed).length;
  const allPassed = results.filter((r) => r.passed).length;

  const allCriticalPass = criticalPassed === criticalChecks.length;
  const allRecommendedPass = recommendedPassed === recommendedChecks.length;

  const level = allCriticalPass && allRecommendedPass
    ? "ready"
    : allCriticalPass
      ? "almost"
      : "incomplete";

  const score = results.length > 0
    ? Math.round((allPassed / results.length) * 100)
    : 0;

  return {
    domainId: domain.id,
    domainName: domain.name,
    ready: allCriticalPass,
    score,
    level,
    checks: results,
    criticalPassed,
    criticalTotal: criticalChecks.length,
    recommendedPassed,
    recommendedTotal: recommendedChecks.length,
  };
}
