/**
 * memory-extract.ts
 *
 * Spec-Driven Memory Extraction
 *
 * Extracts structured memories from call transcripts using LEARN-type AnalysisSpecs.
 * Each LEARN-type spec defines:
 * - domain: Memory category (facts, preferences, events, etc.)
 * - promptTemplate: The LLM prompt for extraction
 *
 * Flow:
 * 1. Query AnalysisSpecs where outputType = LEARN and isActive = true
 * 2. For each call without extracted memories:
 *    a. For each LEARN spec, render promptTemplate with transcript
 *    b. Call LLM to extract (or use pattern matching for mock)
 *    c. Normalize keys and detect contradictions
 *    d. Store in CallerMemory with category from spec.domain
 * 3. Update CallerMemorySummary aggregates
 *
 * Fallback: If no LEARN AnalysisSpecs exist, falls back to pattern matching.
 */

import { PrismaClient, MemoryCategory, MemorySource } from "@prisma/client";

const prisma = new PrismaClient();

// Config loaded from MEMORY_TAXONOMY spec
interface MemoryTaxonomyConfig {
  keyNormalization: Record<string, string>;
  categoryMappings: Record<string, string>;
  domainCategoryMappings: Record<string, string>;
  confidenceThresholds: {
    default: number;
    highConfidence: number;
    lowConfidence: number;
  };
  defaultCategory: string;
}

const DEFAULT_TAXONOMY_CONFIG: MemoryTaxonomyConfig = {
  keyNormalization: {
    location: "location",
    city: "location",
    town: "location",
    lives_in: "location",
    residence: "location",
    job: "occupation",
    job_title: "occupation",
    occupation: "occupation",
    profession: "occupation",
    work: "occupation",
    spouse: "spouse",
    wife: "spouse",
    husband: "spouse",
    partner: "spouse",
    kids: "children_count",
    children: "children_count",
    contact_method: "preferred_contact",
    preferred_contact: "preferred_contact",
  },
  categoryMappings: {
    BIOGRAPHICAL: "FACT",
    PERSONAL: "FACT",
    DEMOGRAPHIC: "FACT",
    FACTS: "FACT",
    LIKE: "PREFERENCE",
    DISLIKE: "PREFERENCE",
    PREFER: "PREFERENCE",
    PREFERENCES: "PREFERENCE",
    APPOINTMENT: "EVENT",
    MEETING: "EVENT",
    HISTORY: "EVENT",
    EVENTS: "EVENT",
    INTEREST: "TOPIC",
    DISCUSSION: "TOPIC",
    TOPICS: "TOPIC",
    FAMILY: "RELATIONSHIP",
    FRIEND: "RELATIONSHIP",
    COLLEAGUE: "RELATIONSHIP",
    RELATIONSHIPS: "RELATIONSHIP",
    SITUATION: "CONTEXT",
    TEMPORARY: "CONTEXT",
  },
  domainCategoryMappings: {
    fact: "FACT",
    personal: "FACT",
    preference: "PREFERENCE",
    like: "PREFERENCE",
    event: "EVENT",
    history: "EVENT",
    topic: "TOPIC",
    interest: "TOPIC",
    relationship: "RELATIONSHIP",
    family: "RELATIONSHIP",
    context: "CONTEXT",
    situation: "CONTEXT",
  },
  confidenceThresholds: {
    default: 0.5,
    highConfidence: 0.8,
    lowConfidence: 0.3,
  },
  defaultCategory: "FACT",
};

// Cached taxonomy config
let cachedTaxonomyConfig: MemoryTaxonomyConfig | null = null;

/**
 * Load MEMORY_TAXONOMY spec config from database
 */
async function loadTaxonomyConfig(): Promise<MemoryTaxonomyConfig> {
  if (cachedTaxonomyConfig) {
    return cachedTaxonomyConfig;
  }

  const spec = await prisma.analysisSpec.findFirst({
    where: {
      domain: "memory-taxonomy",
      outputType: "LEARN",
      isActive: true,
      scope: "SYSTEM",
    },
  });

  if (!spec?.config) {
    return DEFAULT_TAXONOMY_CONFIG;
  }

  const config = spec.config as any;
  cachedTaxonomyConfig = {
    keyNormalization: config.keyNormalization ?? DEFAULT_TAXONOMY_CONFIG.keyNormalization,
    categoryMappings: config.categoryMappings ?? DEFAULT_TAXONOMY_CONFIG.categoryMappings,
    domainCategoryMappings: config.domainCategoryMappings ?? DEFAULT_TAXONOMY_CONFIG.domainCategoryMappings,
    confidenceThresholds: {
      default: config.confidenceThresholds?.default ?? DEFAULT_TAXONOMY_CONFIG.confidenceThresholds.default,
      highConfidence: config.confidenceThresholds?.highConfidence ?? DEFAULT_TAXONOMY_CONFIG.confidenceThresholds.highConfidence,
      lowConfidence: config.confidenceThresholds?.lowConfidence ?? DEFAULT_TAXONOMY_CONFIG.confidenceThresholds.lowConfidence,
    },
    defaultCategory: config.defaultCategory ?? DEFAULT_TAXONOMY_CONFIG.defaultCategory,
  };

  return cachedTaxonomyConfig;
}

interface MemoryExtractorOptions {
  verbose?: boolean;
  plan?: boolean;
  mock?: boolean;           // Use pattern matching instead of LLM
  callId?: string;          // Process specific call
  callerId?: string;          // Process specific user's calls
  limit?: number;           // Max calls to process
  aggregate?: boolean;      // Re-aggregate summaries after extraction
  confidenceThreshold?: number;
  specSlug?: string;        // Only run specific spec
}

interface ExtractedMemory {
  category: string;
  key: string;
  value: string;
  evidence?: string;
  context?: string;
  confidence: number;
  expiresInDays?: number;
}

interface ExtractionResult {
  callsProcessed: number;
  specsUsed: number;
  memoriesExtracted: number;
  memoriesStored: number;
  contradictionsResolved: number;
  summariesUpdated: number;
  errors: string[];
}

/**
 * Normalize a key using the taxonomy config
 */
function normalizeKey(key: string, taxonomyConfig: MemoryTaxonomyConfig): string {
  const lower = key.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  return taxonomyConfig.keyNormalization[lower] || lower;
}

/**
 * Map a category string to MemoryCategory enum using taxonomy config
 */
function mapCategory(category: string, taxonomyConfig: MemoryTaxonomyConfig): MemoryCategory {
  const upper = category.toUpperCase();
  if (upper in MemoryCategory) {
    return upper as MemoryCategory;
  }
  // Use taxonomy mappings
  const mapped = taxonomyConfig.categoryMappings[upper];
  if (mapped && mapped in MemoryCategory) {
    return mapped as MemoryCategory;
  }
  return taxonomyConfig.defaultCategory as MemoryCategory;
}

/**
 * Map a domain to MemoryCategory using taxonomy config
 */
function domainToCategory(domain: string | null, taxonomyConfig: MemoryTaxonomyConfig): MemoryCategory {
  if (!domain) return taxonomyConfig.defaultCategory as MemoryCategory;

  const domainLower = domain.toLowerCase();

  // Check direct mapping first
  if (taxonomyConfig.domainCategoryMappings[domainLower]) {
    const mapped = taxonomyConfig.domainCategoryMappings[domainLower];
    if (mapped in MemoryCategory) {
      return mapped as MemoryCategory;
    }
  }

  // Check for partial matches in domain name
  for (const [key, value] of Object.entries(taxonomyConfig.domainCategoryMappings)) {
    if (domainLower.includes(key)) {
      if (value in MemoryCategory) {
        return value as MemoryCategory;
      }
    }
  }

  return taxonomyConfig.defaultCategory as MemoryCategory;
}

export async function extractMemories(
  options: MemoryExtractorOptions = {}
): Promise<ExtractionResult> {
  const {
    verbose = false,
    plan = false,
    mock = true,  // Default to pattern matching
    callId,
    callerId,
    limit = 100,
    aggregate = true,
    confidenceThreshold = 0.5,
    specSlug,
  } = options;

  const result: ExtractionResult = {
    callsProcessed: 0,
    specsUsed: 0,
    memoriesExtracted: 0,
    memoriesStored: 0,
    contradictionsResolved: 0,
    summariesUpdated: 0,
    errors: [],
  };

  if (plan) {
    console.log("\n📋 MEMORY EXTRACTOR PLAN (Spec-Driven)\n");
    console.log("Steps:");
    console.log("1. Query AnalysisSpecs where outputType=LEARN and isActive=true");
    if (specSlug) {
      console.log(`   - Filtering to spec: ${specSlug}`);
    }
    console.log("2. Find calls to process:");
    if (callId) {
      console.log(`   - Specific call: ${callId}`);
    } else if (callerId) {
      console.log(`   - Calls for user: ${callerId}`);
    } else {
      console.log(`   - Up to ${limit} unprocessed calls`);
    }
    console.log("3. For each call × spec:");
    console.log("   - Render spec's promptTemplate with transcript");
    console.log("   - Extract memories via LLM (or patterns if --mock)");
    console.log("   - Normalize keys, detect contradictions");
    console.log("   - Store CallerMemory records");
    if (aggregate) {
      console.log("4. Update CallerMemorySummary aggregates");
    }
    console.log("\nEffects:");
    console.log("- Reads: AnalysisSpec, Call");
    console.log("- Writes: CallerMemory");
    if (aggregate) {
      console.log("- Updates: CallerMemorySummary");
    }
    console.log(`\nConfidence threshold: ${confidenceThreshold}`);
    console.log("\nRun without --plan to execute.\n");
    return result;
  }

  try {
    // Load taxonomy config from spec
    const taxonomyConfig = await loadTaxonomyConfig();
    if (verbose) console.log("📋 Loaded memory taxonomy config from spec");

    // Step 1: Get LEARN-type AnalysisSpecs
    if (verbose) console.log("\n🔍 Loading LEARN AnalysisSpecs...");

    const specWhere: any = {
      outputType: "LEARN",
      isActive: true,
    };
    if (specSlug) {
      specWhere.slug = specSlug;
    }

    const specs = await prisma.analysisSpec.findMany({
      where: specWhere,
      orderBy: { priority: "desc" },
    });

    if (specs.length === 0) {
      if (verbose) {
        console.log("⚠️  No LEARN AnalysisSpecs found, using legacy pattern matching");
      }
      // Continue with legacy extraction (no specs)
    } else {
      result.specsUsed = specs.length;
      if (verbose) {
        console.log(`✅ Found ${specs.length} LEARN spec(s):`);
        specs.forEach((s) => {
          console.log(`   - ${s.slug} → ${s.domain || "general"}`);
        });
      }
    }

    // Step 2: Find calls to process
    if (verbose) console.log("\n📞 Finding calls to process...");

    const callWhere: any = {
      callerId: { not: null },
      transcript: { not: null },
    };

    if (callId) {
      callWhere.id = callId;
    } else if (callerId) {
      callWhere.callerId = callerId;
    } else {
      // Only process calls without extracted memories
      callWhere.extractedMemories = { none: {} };
    }

    const calls = await prisma.call.findMany({
      where: callWhere,
      take: callId ? 1 : limit,
      orderBy: { createdAt: "desc" },
      include: {
        caller: { select: { id: true, name: true } },
        extractedMemories: {
          where: { supersededById: null },
        },
      },
    });

    if (calls.length === 0) {
      const msg = callId
        ? `Call ${callId} not found or has no caller`
        : "No unprocessed calls found";
      console.log(`⚠️  ${msg}`);
      result.errors.push(msg);
      return result;
    }

    if (verbose) {
      console.log(`✅ Found ${calls.length} call(s) to process`);
    }

    // Track users for summary aggregation
    const callerIds = new Set<string>();

    // Step 3: Process each call
    for (const call of calls) {
      if (!call.callerId || !call.transcript) continue;

      result.callsProcessed++;
      callerIds.add(call.callerId);

      if (verbose) {
        console.log(`\n📝 Processing call ${call.id.substring(0, 8)}...`);
      }

      // Get existing memories for contradiction detection
      const existingMemories = await prisma.callerMemory.findMany({
        where: {
          callerId: call.callerId,
          supersededById: null,
        },
      });

      const existingByKey = new Map(
        existingMemories.map((m) => [m.normalizedKey || m.key, m])
      );

      // Extract memories using specs or fallback
      const extractedMemories: ExtractedMemory[] = [];

      if (specs.length > 0) {
        // Spec-driven extraction
        for (const spec of specs) {
          try {
            const specMemories = await extractWithSpec(
              call.transcript,
              spec,
              mock,
              verbose
            );

            // Tag with category from spec domain
            const category = domainToCategory(spec.domain, taxonomyConfig);
            for (const mem of specMemories) {
              mem.category = mem.category || category;
              extractedMemories.push(mem);
            }

            if (verbose && specMemories.length > 0) {
              console.log(`   [${spec.slug}] Extracted ${specMemories.length} memories`);
            }
          } catch (err: any) {
            result.errors.push(`Spec ${spec.slug}: ${err.message}`);
          }
        }
      } else {
        // Legacy pattern-based extraction
        const legacyMemories = await extractMemoriesFromPatterns(
          call.transcript,
          verbose
        );
        extractedMemories.push(...legacyMemories);
      }

      result.memoriesExtracted += extractedMemories.length;

      // Store extracted memories
      for (const extracted of extractedMemories) {
        if (extracted.confidence < confidenceThreshold) {
          if (verbose) {
            console.log(
              `   ⏭️  Skipping low-confidence: ${extracted.key} (${extracted.confidence.toFixed(2)})`
            );
          }
          continue;
        }

        const category = mapCategory(extracted.category, taxonomyConfig);
        const normalizedKey = normalizeKey(extracted.key, taxonomyConfig);

        // Check for contradiction
        const existing = existingByKey.get(normalizedKey);

        if (existing) {
          if (existing.value !== extracted.value) {
            // Contradiction - supersede old memory
            if (verbose) {
              console.log(
                `   🔄 Updating: ${normalizedKey} "${existing.value}" → "${extracted.value}"`
              );
            }

            const newMemory = await prisma.callerMemory.create({
              data: {
                callerId: call.callerId,
                callId: call.id,
                category,
                source: MemorySource.EXTRACTED,
                key: extracted.key,
                value: extracted.value,
                normalizedKey,
                evidence: extracted.evidence,
                context: extracted.context,
                confidence: extracted.confidence,
                expiresAt: extracted.expiresInDays
                  ? new Date(Date.now() + extracted.expiresInDays * 24 * 60 * 60 * 1000)
                  : null,
                extractedBy: mock ? "pattern_v2" : "llm_v1",
              },
            });

            await prisma.callerMemory.update({
              where: { id: existing.id },
              data: { supersededById: newMemory.id },
            });

            existingByKey.set(normalizedKey, newMemory);
            result.contradictionsResolved++;
            result.memoriesStored++;
          } else {
            // Same value - update confidence if higher
            if (extracted.confidence > (existing.confidence || 0)) {
              await prisma.callerMemory.update({
                where: { id: existing.id },
                data: {
                  confidence: extracted.confidence,
                  updatedAt: new Date(),
                },
              });
            }
          }
        } else {
          // New memory
          const newMemory = await prisma.callerMemory.create({
            data: {
              callerId: call.callerId,
              callId: call.id,
              category,
              source: MemorySource.EXTRACTED,
              key: extracted.key,
              value: extracted.value,
              normalizedKey,
              evidence: extracted.evidence,
              context: extracted.context,
              confidence: extracted.confidence,
              expiresAt: extracted.expiresInDays
                ? new Date(Date.now() + extracted.expiresInDays * 24 * 60 * 60 * 1000)
                : null,
              extractedBy: mock ? "pattern_v2" : "llm_v1",
            },
          });

          existingByKey.set(normalizedKey, newMemory);
          result.memoriesStored++;

          if (verbose) {
            console.log(
              `   ✓ [${category}] ${extracted.key} = "${extracted.value}" (${extracted.confidence.toFixed(2)})`
            );
          }
        }
      }
    }

    // Step 4: Aggregate summaries
    if (aggregate && callerIds.size > 0) {
      if (verbose) {
        console.log(`\n🔄 Updating summaries for ${callerIds.size} caller(s)...`);
      }

      for (const uid of callerIds) {
        try {
          await aggregateCallerMemorySummary(uid, verbose);
          result.summariesUpdated++;
        } catch (err: any) {
          result.errors.push(`Summary error for ${uid}: ${err.message}`);
        }
      }
    }

    // Summary
    console.log("\n✅ MEMORY EXTRACTION COMPLETE\n");
    console.log(`Specs used: ${result.specsUsed}`);
    console.log(`Calls processed: ${result.callsProcessed}`);
    console.log(`Memories extracted: ${result.memoriesExtracted}`);
    console.log(`Memories stored: ${result.memoriesStored}`);
    console.log(`Contradictions resolved: ${result.contradictionsResolved}`);
    if (aggregate) {
      console.log(`Summaries updated: ${result.summariesUpdated}`);
    }
    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors: ${result.errors.length}`);
      result.errors.slice(0, 5).forEach((err) => console.log(`   - ${err}`));
    }

    return result;
  } catch (error) {
    console.error("❌ Error during memory extraction:", error);
    result.errors.push(String(error));
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Extract memories using an AnalysisSpec
 */
async function extractWithSpec(
  transcript: string,
  spec: { slug: string; name: string; domain: string | null; promptTemplate: string | null },
  mock: boolean,
  verbose: boolean
): Promise<ExtractedMemory[]> {
  // Build the extraction prompt
  let promptTemplate = spec.promptTemplate;

  if (!promptTemplate) {
    // Default extraction template
    promptTemplate = `Extract memories from this call transcript.

Category: {{domain}}

Look for:
- Facts about the person (location, job, family)
- Preferences they express
- Events they mention
- Relationships they reference
- Current context (temporary situations)

---
TRANSCRIPT:
{{transcript}}
---

Return JSON array:
[
  {
    "category": "FACT|PREFERENCE|EVENT|TOPIC|RELATIONSHIP|CONTEXT",
    "key": "descriptive_key",
    "value": "the information",
    "evidence": "quote from transcript",
    "confidence": 0.0-1.0,
    "expiresInDays": null or number for temporary info
  }
]`;
  }

  const renderedPrompt = promptTemplate
    .replace(/\{\{transcript\}\}/g, transcript.substring(0, 8000))
    .replace(/\{\{domain\}\}/g, spec.domain || "general")
    .replace(/\{\{spec\.name\}\}/g, spec.name);

  if (mock) {
    // Use pattern matching
    return extractMemoriesFromPatterns(transcript, verbose);
  }

  // TODO: Real LLM call
  // const response = await callLLM(renderedPrompt);
  // return JSON.parse(response);

  throw new Error("LLM extraction not yet implemented. Use --mock flag.");
}

/**
 * Legacy pattern-based extraction
 */
async function extractMemoriesFromPatterns(
  transcript: string,
  verbose: boolean
): Promise<ExtractedMemory[]> {
  const memories: ExtractedMemory[] = [];

  const patterns = [
    {
      regex: /(?:I live in|I'm from|I'm located in|based in)\s+([A-Z][a-zA-Z\s,]+?)(?:\.|,|$)/i,
      category: "FACT",
      key: "location",
    },
    {
      regex: /(?:I work at|I'm with|employed by|work for)\s+([A-Z][a-zA-Z\s&]+?)(?:\.|,|$)/i,
      category: "FACT",
      key: "employer",
    },
    {
      regex: /(?:I'm a|I work as|my job is|I'm an?)\s+([a-zA-Z\s]+?)(?:\s+at|\s+for|\.|,|$)/i,
      category: "FACT",
      key: "occupation",
    },
    {
      regex: /(?:I have|we have)\s+(\d+)\s+(?:kids|children)/i,
      category: "RELATIONSHIP",
      key: "children_count",
    },
    {
      regex: /(?:my wife|my husband|my spouse|my partner)(?:'s name is|,?\s+)([A-Z][a-z]+)/i,
      category: "RELATIONSHIP",
      key: "spouse_name",
    },
    {
      regex: /(?:prefer|rather have|like to receive)\s+(?:contact via|communication via|messages via|by)?\s*(email|phone|text|sms)/i,
      category: "PREFERENCE",
      key: "preferred_contact",
    },
    {
      regex: /(?:I like|I enjoy|I love|I prefer)\s+([a-zA-Z\s]+?)(?:\.|,|!|$)/i,
      category: "PREFERENCE",
      key: "likes",
    },
    {
      regex: /(?:I'm traveling|I'll be traveling|on vacation|on holiday)\s+(?:to\s+)?([a-zA-Z\s]+?)?\s*(?:next|this)\s+(week|month)/i,
      category: "CONTEXT",
      key: "traveling",
      expiresInDays: 14,
    },
    {
      regex: /(?:I'm interested in|curious about|want to learn about)\s+([a-zA-Z\s]+?)(?:\.|,|$)/i,
      category: "TOPIC",
      key: "interest",
    },
    {
      regex: /(?:my (?:son|daughter|brother|sister|mother|father|friend))\s+([A-Z][a-z]+)/i,
      category: "RELATIONSHIP",
      key: "family_member",
    },
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern.regex);
    if (match) {
      const value = (match[1] || match[2] || "").trim();
      if (value && value.length > 1 && value.length < 100) {
        memories.push({
          category: pattern.category,
          key: pattern.key,
          value: value,
          evidence: match[0],
          confidence: 0.7 + Math.random() * 0.2,
          expiresInDays: (pattern as any).expiresInDays,
        });
      }
    }
  }

  if (verbose && memories.length === 0) {
    console.log("   [PATTERN] No patterns matched");
  } else if (verbose) {
    console.log(`   [PATTERN] Matched ${memories.length} memories`);
  }

  return memories;
}

/**
 * Aggregate caller memories into summary
 */
async function aggregateCallerMemorySummary(
  callerId: string,
  verbose: boolean
): Promise<void> {
  const memories = await prisma.callerMemory.findMany({
    where: {
      callerId,
      supersededById: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: { confidence: "desc" },
  });

  if (memories.length === 0) {
    if (verbose) console.log(`   ⏭️  No active memories for caller ${callerId.substring(0, 8)}...`);
    return;
  }

  const factCount = memories.filter((m) => m.category === MemoryCategory.FACT).length;
  const preferenceCount = memories.filter((m) => m.category === MemoryCategory.PREFERENCE).length;
  const eventCount = memories.filter((m) => m.category === MemoryCategory.EVENT).length;
  const topicCount = memories.filter((m) => m.category === MemoryCategory.TOPIC).length;

  const keyFacts = memories
    .filter((m) => m.category === MemoryCategory.FACT)
    .slice(0, 10)
    .map((m) => ({
      key: m.normalizedKey || m.key,
      value: m.value,
      confidence: m.confidence,
    }));

  const topTopics = memories
    .filter((m) => m.category === MemoryCategory.TOPIC)
    .slice(0, 5)
    .map((m) => ({
      topic: m.value,
      lastMentioned: m.extractedAt,
    }));

  const preferences: Record<string, string> = {};
  for (const m of memories.filter((m) => m.category === MemoryCategory.PREFERENCE)) {
    preferences[m.normalizedKey || m.key] = m.value;
  }

  const lastMemoryAt = memories.reduce(
    (latest, m) => (m.extractedAt > latest ? m.extractedAt : latest),
    memories[0].extractedAt
  );

  await prisma.callerMemorySummary.upsert({
    where: { callerId },
    create: {
      callerId,
      factCount,
      preferenceCount,
      eventCount,
      topicCount,
      keyFacts,
      topTopics,
      preferences,
      lastMemoryAt,
      lastAggregatedAt: new Date(),
    },
    update: {
      factCount,
      preferenceCount,
      eventCount,
      topicCount,
      keyFacts,
      topTopics,
      preferences,
      lastMemoryAt,
      lastAggregatedAt: new Date(),
    },
  });

  if (verbose) {
    console.log(`   ✅ Summary for ${callerId.substring(0, 8)}...: ${memories.length} memories`);
    console.log(`      Facts: ${factCount}, Prefs: ${preferenceCount}, Events: ${eventCount}, Topics: ${topicCount}`);
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);

  const options: MemoryExtractorOptions = {
    verbose: args.includes("--verbose") || args.includes("-v"),
    plan: args.includes("--plan"),
    mock: !args.includes("--no-mock"),
    callId: args.find((a) => a.startsWith("--call="))?.split("=")[1],
    callerId: args.find((a) => a.startsWith("--user="))?.split("=")[1],
    limit: parseInt(
      args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "100"
    ),
    aggregate: !args.includes("--no-aggregate"),
    confidenceThreshold: parseFloat(
      args.find((a) => a.startsWith("--confidence="))?.split("=")[1] || "0.5"
    ),
    specSlug: args.find((a) => a.startsWith("--spec="))?.split("=")[1],
  };

  extractMemories(options)
    .then((result) => {
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
