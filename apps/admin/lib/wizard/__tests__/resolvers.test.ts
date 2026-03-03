import { describe, it, expect, vi } from "vitest";
import { processUpdate, findTriggeredResolvers, RESOLVER_REGISTRY } from "../resolvers";
import type { ResolverResult } from "../graph-schema";
import type { ResolverExecutor } from "../resolvers";

// ── Mock executor ────────────────────────────────────────

function createMockExecutor(
  results: Record<string, ResolverResult | null>,
): ResolverExecutor {
  return vi.fn(async (key) => results[key] ?? null);
}

// ── findTriggeredResolvers ───────────────────────────────

describe("findTriggeredResolvers", () => {
  it("institutionName triggers institution-lookup and name-type-inference", () => {
    const triggered = findTriggeredResolvers(["institutionName"], {});
    const keys = triggered.map((r) => r.key);
    expect(keys).toContain("institution-lookup");
    expect(keys).toContain("name-type-inference");
  });

  it("subjectDiscipline triggers subject-lookup only when domainId present", () => {
    const withoutDomain = findTriggeredResolvers(["subjectDiscipline"], {});
    expect(withoutDomain.map((r) => r.key)).not.toContain("subject-lookup");

    const withDomain = findTriggeredResolvers(["subjectDiscipline"], {
      existingDomainId: "d1",
    });
    expect(withDomain.map((r) => r.key)).toContain("subject-lookup");
  });

  it("courseName triggers course-lookup only when domainId present", () => {
    const withDomain = findTriggeredResolvers(["courseName"], {
      draftDomainId: "d2",
    });
    expect(withDomain.map((r) => r.key)).toContain("course-lookup");
  });

  it("packSubjectIds triggers file-upload resolver when domainId present", () => {
    const triggered = findTriggeredResolvers(["packSubjectIds"], {
      existingDomainId: "d1",
    });
    expect(triggered.map((r) => r.key)).toContain("file-upload");
  });

  it("unrelated fields trigger no resolvers", () => {
    const triggered = findTriggeredResolvers(["welcomeMessage", "sessionCount"], {});
    expect(triggered).toHaveLength(0);
  });
});

// ── processUpdate ────────────────────────────────────────

describe("processUpdate", () => {
  it("merges incoming fields into blackboard", async () => {
    const executor = createMockExecutor({});
    const result = await processUpdate(
      { welcomeMessage: "Hello students!" },
      { institutionName: "PAW" },
      executor,
    );

    expect(result.mergedFields.welcomeMessage).toBe("Hello students!");
    expect(result.mergedFields.institutionName).toBe("PAW");
  });

  it("fires institution-lookup when institutionName is set", async () => {
    const executor = createMockExecutor({
      "institution-lookup": {
        fields: {
          existingInstitutionId: "inst-1",
          existingDomainId: "dom-1",
          defaultDomainKind: "STANDARD",
          typeSlug: "school",
        },
        aiContext: "Resolved institution: PAW Campus (school).",
        autoCommit: true,
      },
      "name-type-inference": null, // institution-lookup already set typeSlug
    });

    const result = await processUpdate(
      { institutionName: "PAW Campus" },
      {},
      executor,
    );

    // Resolver results merged
    expect(result.mergedFields.existingDomainId).toBe("dom-1");
    expect(result.mergedFields.typeSlug).toBe("school");
    expect(result.mergedFields.defaultDomainKind).toBe("STANDARD");

    // AI context captured
    expect(result.aiContextMessages).toContain("Resolved institution: PAW Campus (school).");

    // Graph re-evaluated: institution satisfied, domain-dependent nodes now available
    expect(result.evaluation.nodeStatuses.get("institutionName")).toBe("satisfied");
    expect(result.evaluation.nodeStatuses.get("subjectDiscipline")).toBe("available");
    expect(result.evaluation.nodeStatuses.get("courseName")).toBe("available");
  });

  it("fires subject-lookup when subjectDiscipline is set with domainId", async () => {
    const executor = createMockExecutor({
      "subject-lookup": {
        fields: {
          courseName: "11+ Comprehension",
          draftPlaybookId: "pb-1",
          interactionPattern: "socratic",
        },
        aiContext: "Auto-committed: subject 'English Language', course '11+ Comprehension' (socratic).",
        autoCommit: true,
      },
    });

    const result = await processUpdate(
      { subjectDiscipline: "English Language" },
      { institutionName: "PAW", existingDomainId: "dom-1" },
      executor,
    );

    // Course auto-committed via chain
    expect(result.mergedFields.courseName).toBe("11+ Comprehension");
    expect(result.mergedFields.interactionPattern).toBe("socratic");
    expect(result.mergedFields.draftPlaybookId).toBe("pb-1");

    // Can launch now (all 3 required fields satisfied)
    expect(result.evaluation.canLaunch).toBe(true);
  });

  it("handles multi-field update (PAW Campus + English + 5 sessions)", async () => {
    const executor = createMockExecutor({
      "institution-lookup": {
        fields: {
          existingInstitutionId: "inst-1",
          existingDomainId: "dom-1",
          defaultDomainKind: "STANDARD",
          typeSlug: "school",
        },
        aiContext: "Resolved: PAW Campus (school).",
        autoCommit: true,
      },
      "name-type-inference": null,
      "subject-lookup": {
        fields: {},
        aiContext: "Multiple courses found for English Language.",
        autoCommit: false,
      },
    });

    const result = await processUpdate(
      {
        institutionName: "PAW Campus",
        subjectDiscipline: "English Language",
        sessionCount: "5",
        interactionPattern: "socratic",
      },
      {},
      executor,
    );

    // 7+ fields should be in merged (4 incoming + 4 from resolver)
    expect(Object.keys(result.mergedFields).length).toBeGreaterThanOrEqual(7);
    expect(result.mergedFields.institutionName).toBe("PAW Campus");
    expect(result.mergedFields.existingDomainId).toBe("dom-1");
    expect(result.mergedFields.sessionCount).toBe("5");

    // Multiple context messages
    expect(result.aiContextMessages.length).toBeGreaterThanOrEqual(1);

    // Still needs courseName
    expect(result.evaluation.canLaunch).toBe(false);
    expect(result.evaluation.missingRequired.map((n) => n.key)).toContain("courseName");
  });

  it("file-upload bulk resolver satisfies multiple nodes", async () => {
    const executor = createMockExecutor({
      "file-upload": {
        fields: {
          subjectDiscipline: "Biology",
          sessionCount: "5",
        },
        aiContext: "Extracted from upload: Biology, 5 chapters → 5 sessions.",
        autoCommit: true,
      },
    });

    const result = await processUpdate(
      { packSubjectIds: ["sub-1"] },
      {
        institutionName: "PAW",
        existingDomainId: "dom-1",
        courseName: "GCSE Biology",
        interactionPattern: "socratic",
      },
      executor,
    );

    // File upload filled subject + sessions
    expect(result.mergedFields.subjectDiscipline).toBe("Biology");
    expect(result.mergedFields.sessionCount).toBe("5");

    // All required satisfied + extras from upload
    expect(result.evaluation.canLaunch).toBe(true);
    expect(result.evaluation.readinessPct).toBeGreaterThan(30);
  });

  it("does not overwrite existing values with undefined resolver results", async () => {
    const executor = createMockExecutor({
      "institution-lookup": {
        fields: {
          existingDomainId: "dom-1",
          typeSlug: undefined as unknown as string, // resolver doesn't know type
        },
        aiContext: "Found institution.",
        autoCommit: true,
      },
      "name-type-inference": null,
    });

    const result = await processUpdate(
      { institutionName: "PAW" },
      { typeSlug: "school" }, // Already set
      executor,
    );

    // typeSlug should NOT be overwritten by undefined
    expect(result.mergedFields.typeSlug).toBe("school");
  });
});

// ── Registry completeness ────────────────────────────────

describe("RESOLVER_REGISTRY", () => {
  it("has entries for all known resolver keys", () => {
    const keys = RESOLVER_REGISTRY.map((r) => r.key);
    expect(keys).toContain("institution-lookup");
    expect(keys).toContain("name-type-inference");
    expect(keys).toContain("subject-lookup");
    expect(keys).toContain("course-lookup");
    expect(keys).toContain("file-upload");
  });

  it("each resolver has non-empty triggerOn", () => {
    for (const r of RESOLVER_REGISTRY) {
      expect(r.triggerOn.length).toBeGreaterThan(0);
    }
  });

  it("each resolver has non-empty canSatisfy", () => {
    for (const r of RESOLVER_REGISTRY) {
      expect(r.canSatisfy.length).toBeGreaterThan(0);
    }
  });
});
