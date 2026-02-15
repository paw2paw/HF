/**
 * Admin Tool Handlers
 *
 * Executes tools called by the Cmd+K AI assistant.
 * Each handler receives parsed input from the AI and returns JSON results.
 */

import { prisma } from "@/lib/prisma";

const MAX_RESULT_LENGTH = 3000;

/** Truncate JSON to fit in context window */
function truncateResult(obj: any): string {
  const json = JSON.stringify(obj, null, 2);
  if (json.length <= MAX_RESULT_LENGTH) return json;
  return json.slice(0, MAX_RESULT_LENGTH) + "\n... (truncated)";
}

/**
 * Dispatch a tool call to the appropriate handler.
 */
export async function executeAdminTool(
  name: string,
  input: Record<string, any>,
): Promise<string> {
  try {
    let result: any;
    switch (name) {
      case "query_specs":
        result = await handleQuerySpecs(input);
        break;
      case "get_spec_config":
        result = await handleGetSpecConfig(input);
        break;
      case "update_spec_config":
        result = await handleUpdateSpecConfig(input);
        break;
      case "query_callers":
        result = await handleQueryCallers(input);
        break;
      case "get_domain_info":
        result = await handleGetDomainInfo(input);
        break;
      default:
        result = { error: `Unknown tool: ${name}` };
    }
    return truncateResult(result);
  } catch (error) {
    console.error(`[admin-tools] Error executing ${name}:`, error);
    return JSON.stringify({
      error: `Tool execution failed: ${error instanceof Error ? error.message : "unknown error"}`,
    });
  }
}

// ============================================================
// Tool Handlers
// ============================================================

async function handleQuerySpecs(input: Record<string, any>) {
  const where: any = {};

  if (input.is_active !== false) {
    where.isActive = true;
  }
  if (input.name) {
    where.name = { contains: input.name, mode: "insensitive" };
  }
  if (input.spec_role) {
    where.specRole = input.spec_role;
  }
  if (input.slug) {
    where.slug = { contains: input.slug, mode: "insensitive" };
  }

  const limit = Math.min(input.limit || 10, 25);

  const specs = await prisma.analysisSpec.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      specRole: true,
      outputType: true,
      scope: true,
      extendsAgent: true,
      isActive: true,
      description: true,
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  return {
    count: specs.length,
    specs: specs.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      specRole: s.specRole,
      outputType: s.outputType,
      scope: s.scope,
      extendsAgent: s.extendsAgent,
      description: s.description?.slice(0, 150),
    })),
  };
}

async function handleGetSpecConfig(input: Record<string, any>) {
  const spec = await prisma.analysisSpec.findUnique({
    where: { id: input.spec_id },
    select: {
      id: true,
      name: true,
      slug: true,
      specRole: true,
      extendsAgent: true,
      config: true,
      description: true,
      isActive: true,
    },
  });

  if (!spec) {
    return { error: `Spec not found: ${input.spec_id}` };
  }

  return {
    id: spec.id,
    name: spec.name,
    slug: spec.slug,
    specRole: spec.specRole,
    extendsAgent: spec.extendsAgent,
    isActive: spec.isActive,
    description: spec.description,
    config: spec.config,
  };
}

async function handleUpdateSpecConfig(input: Record<string, any>) {
  const { spec_id, config_updates, reason } = input;

  // Load current spec
  const spec = await prisma.analysisSpec.findUnique({
    where: { id: spec_id },
    select: { id: true, name: true, config: true, isLocked: true },
  });

  if (!spec) {
    return { error: `Spec not found: ${spec_id}` };
  }

  if (spec.isLocked) {
    return { error: `Spec "${spec.name}" is locked. Unlock it first before making changes.` };
  }

  // Merge: existing config + updates (updates win on conflicts)
  const currentConfig = (spec.config as Record<string, any>) || {};
  const mergedConfig = { ...currentConfig, ...config_updates };

  // Apply the update
  await prisma.analysisSpec.update({
    where: { id: spec_id },
    data: { config: mergedConfig },
  });

  // Log the change
  console.log(`[admin-tools] Updated spec "${spec.name}" config. Reason: ${reason}. Fields changed: ${Object.keys(config_updates).join(", ")}`);

  return {
    ok: true,
    message: `Updated "${spec.name}" config successfully.`,
    fieldsUpdated: Object.keys(config_updates),
    reason,
  };
}

async function handleQueryCallers(input: Record<string, any>) {
  const where: any = {};

  if (input.name) {
    where.name = { contains: input.name, mode: "insensitive" };
  }
  if (input.domain_id) {
    where.domainId = input.domain_id;
  }
  if (input.domain_name) {
    where.domain = { name: { contains: input.domain_name, mode: "insensitive" } };
  }

  const limit = Math.min(input.limit || 10, 25);

  const callers = await prisma.caller.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      domain: { select: { name: true } },
      personality: {
        select: {
          openness: true,
          conscientiousness: true,
          extraversion: true,
          agreeableness: true,
          neuroticism: true,
        },
      },
      _count: { select: { calls: true } },
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  return {
    count: callers.length,
    callers: callers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      domain: c.domain?.name || null,
      totalCalls: c._count.calls,
      personality: c.personality
        ? {
            O: c.personality.openness !== null ? Math.round(c.personality.openness * 100) : null,
            C: c.personality.conscientiousness !== null ? Math.round(c.personality.conscientiousness * 100) : null,
            E: c.personality.extraversion !== null ? Math.round(c.personality.extraversion * 100) : null,
            A: c.personality.agreeableness !== null ? Math.round(c.personality.agreeableness * 100) : null,
            N: c.personality.neuroticism !== null ? Math.round(c.personality.neuroticism * 100) : null,
          }
        : null,
    })),
  };
}

async function handleGetDomainInfo(input: Record<string, any>) {
  const where: any = {};
  if (input.domain_id) {
    where.id = input.domain_id;
  } else if (input.domain_name) {
    where.name = { contains: input.domain_name, mode: "insensitive" };
  } else {
    return { error: "Provide either domain_id or domain_name" };
  }

  const domain = await prisma.domain.findFirst({
    where,
    include: {
      playbooks: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          items: {
            where: { itemType: "SPEC" },
            include: {
              spec: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  specRole: true,
                  config: true,
                  extendsAgent: true,
                },
              },
            },
          },
        },
      },
      _count: { select: { callers: true } },
    },
  });

  if (!domain) {
    return { error: `Domain not found` };
  }

  // Find identity and content specs from the published playbook
  const publishedPlaybook = domain.playbooks.find((p) => p.status === "PUBLISHED") || domain.playbooks[0];
  const specs = publishedPlaybook?.items?.map((i) => i.spec).filter(Boolean) || [];
  const identitySpec = specs.find((s: any) => s?.specRole === "IDENTITY");
  const contentSpec = specs.find((s: any) => s?.specRole === "CONTENT");

  return {
    id: domain.id,
    name: domain.name,
    slug: domain.slug,
    description: domain.description,
    callerCount: domain._count.callers,
    publishedPlaybook: publishedPlaybook
      ? {
          id: publishedPlaybook.id,
          name: publishedPlaybook.name,
          status: publishedPlaybook.status,
          specCount: specs.length,
        }
      : null,
    specs: specs.map((s: any) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      specRole: s.specRole,
      extendsAgent: s.extendsAgent,
    })),
    identitySpecConfig: identitySpec ? (identitySpec as any).config : null,
    contentSpecConfig: contentSpec ? (contentSpec as any).config : null,
  };
}
