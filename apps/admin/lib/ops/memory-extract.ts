/**
 * memory-extract.ts
 *
 * Extracts structured memories (facts, preferences, events, topics, relationships, context)
 * from call transcripts using LLM analysis.
 *
 * Flow:
 * 1. Query calls that don't have extracted memories yet
 * 2. For each call, run LLM to extract structured memories
 * 3. Normalize keys for deduplication
 * 4. Handle contradictions via supersededBy chain
 * 5. Upsert UserMemory records
 * 6. Update UserMemorySummary aggregates
 */

import { PrismaClient, MemoryCategory, MemorySource } from "@prisma/client";

const prisma = new PrismaClient();

interface MemoryExtractorOptions {
  verbose?: boolean;
  plan?: boolean;
  callId?: string; // Process specific call, or all unprocessed calls if not provided
  userId?: string; // Process specific user's calls
  limit?: number; // Max calls to process
  aggregate?: boolean; // Whether to re-aggregate UserMemorySummary after extraction
  confidenceThreshold?: number; // Minimum confidence to store (default 0.5)
}

interface ExtractedMemory {
  category: string;
  key: string;
  value: string;
  evidence?: string;
  context?: string;
  confidence: number;
  expiresInDays?: number; // For temporary context like "traveling next week"
}

interface ExtractionResult {
  callsProcessed: number;
  memoriesExtracted: number;
  memoriesStored: number;
  contradictionsResolved: number;
  summariesUpdated: number;
  errors: string[];
}

// Canonical key mappings for deduplication
const KEY_NORMALIZATION: Record<string, string> = {
  // Location variants
  location: "location",
  city: "location",
  town: "location",
  lives_in: "location",
  residence: "location",
  home_city: "location",
  home_location: "location",

  // Job variants
  job: "occupation",
  job_title: "occupation",
  occupation: "occupation",
  profession: "occupation",
  work: "occupation",
  role: "occupation",
  position: "occupation",
  works_at: "employer",
  employer: "employer",
  company: "employer",
  organization: "employer",

  // Family variants
  spouse: "spouse",
  wife: "spouse",
  husband: "spouse",
  partner: "spouse",
  kids: "children_count",
  children: "children_count",
  children_count: "children_count",
  number_of_kids: "children_count",

  // Contact preferences
  contact_method: "preferred_contact",
  preferred_contact: "preferred_contact",
  contact_preference: "preferred_contact",
  best_way_to_reach: "preferred_contact",
  response_length: "response_length_preference",
  preferred_length: "response_length_preference",
};

function normalizeKey(key: string): string {
  const lower = key.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  return KEY_NORMALIZATION[lower] || lower;
}

function mapCategory(category: string): MemoryCategory {
  const upper = category.toUpperCase();
  if (upper in MemoryCategory) {
    return upper as MemoryCategory;
  }
  // Fallback mappings
  switch (upper) {
    case "BIOGRAPHICAL":
    case "PERSONAL":
    case "DEMOGRAPHIC":
      return MemoryCategory.FACT;
    case "LIKE":
    case "DISLIKE":
    case "PREFER":
      return MemoryCategory.PREFERENCE;
    case "APPOINTMENT":
    case "MEETING":
    case "HISTORY":
      return MemoryCategory.EVENT;
    case "INTEREST":
    case "DISCUSSION":
      return MemoryCategory.TOPIC;
    case "FAMILY":
    case "FRIEND":
    case "COLLEAGUE":
      return MemoryCategory.RELATIONSHIP;
    case "SITUATION":
    case "TEMPORARY":
      return MemoryCategory.CONTEXT;
    default:
      return MemoryCategory.FACT;
  }
}

export async function extractMemories(
  options: MemoryExtractorOptions = {}
): Promise<ExtractionResult> {
  const {
    verbose = false,
    plan = false,
    callId,
    userId,
    limit = 100,
    aggregate = true,
    confidenceThreshold = 0.5,
  } = options;

  const result: ExtractionResult = {
    callsProcessed: 0,
    memoriesExtracted: 0,
    memoriesStored: 0,
    contradictionsResolved: 0,
    summariesUpdated: 0,
    errors: [],
  };

  if (plan) {
    console.log("\n📋 MEMORY EXTRACTOR PLAN\n");
    console.log("Steps:");
    console.log("1. Find calls without extracted memories");
    if (callId) {
      console.log("   - Processing specific call:", callId);
    } else if (userId) {
      console.log("   - Processing calls for user:", userId);
    } else {
      console.log("   - Processing up to", limit, "unprocessed calls");
    }
    console.log("2. For each call:");
    console.log("   - Extract memories using LLM (facts, preferences, events, etc.)");
    console.log("   - Normalize keys for deduplication");
    console.log("   - Check for contradictions with existing memories");
    console.log("   - Store new UserMemory records");
    if (aggregate) {
      console.log("3. Update UserMemorySummary aggregates");
    }
    console.log("\nEffects:");
    console.log("- Reads: Call table");
    console.log("- Writes: UserMemory table");
    if (aggregate) {
      console.log("- Updates: UserMemorySummary table");
    }
    console.log("\nRun without --plan to execute.\n");
    return result;
  }

  try {
    // Step 1: Find calls to process
    if (verbose) console.log("\n🔍 Finding calls to process...");

    const whereClause: any = {
      userId: { not: null }, // Must have a user
    };

    if (callId) {
      whereClause.id = callId;
    } else if (userId) {
      whereClause.userId = userId;
    } else {
      // Only process calls without extracted memories
      whereClause.extractedMemories = { none: {} };
    }

    const calls = await prisma.call.findMany({
      where: whereClause,
      take: callId ? 1 : limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        extractedMemories: {
          where: { supersededById: null }, // Only active memories
        },
      },
    });

    if (calls.length === 0) {
      const msg = callId
        ? `Call ${callId} not found or has no user`
        : "No unprocessed calls found";
      console.log(`⚠️  ${msg}`);
      result.errors.push(msg);
      return result;
    }

    if (verbose) {
      console.log(`✅ Found ${calls.length} call(s) to process`);
    }

    // Track users for summary aggregation
    const userIds = new Set<string>();

    // Step 2: Process each call
    for (const call of calls) {
      if (!call.userId) continue;

      result.callsProcessed++;
      userIds.add(call.userId);

      if (verbose) {
        console.log(`\n📞 Processing call ${call.id} for user ${call.userId}...`);
      }

      try {
        // Extract memories from transcript
        const extractedMemories = await extractMemoriesFromTranscript(
          call.transcript,
          verbose
        );

        result.memoriesExtracted += extractedMemories.length;

        if (verbose) {
          console.log(`   Extracted ${extractedMemories.length} memories`);
        }

        // Get existing memories for this user to check for contradictions
        const existingMemories = await prisma.userMemory.findMany({
          where: {
            userId: call.userId,
            supersededById: null, // Only active memories
          },
        });

        const existingByKey = new Map(
          existingMemories.map((m) => [m.normalizedKey || m.key, m])
        );

        // Process each extracted memory
        for (const extracted of extractedMemories) {
          if (extracted.confidence < confidenceThreshold) {
            if (verbose) {
              console.log(
                `   ⏭️  Skipping low-confidence memory: ${extracted.key} (${extracted.confidence.toFixed(2)})`
              );
            }
            continue;
          }

          const category = mapCategory(extracted.category);
          const normalizedKey = normalizeKey(extracted.key);

          // Check for existing memory with same normalized key
          const existing = existingByKey.get(normalizedKey);

          if (existing) {
            // Check if values differ (contradiction)
            if (existing.value !== extracted.value) {
              if (verbose) {
                console.log(
                  `   🔄 Updating memory: ${normalizedKey} "${existing.value}" → "${extracted.value}"`
                );
              }

              // Create new memory that supersedes the old one
              const newMemory = await prisma.userMemory.create({
                data: {
                  userId: call.userId,
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
                  extractedBy: "memory_extractor_v1",
                },
              });

              // Mark old memory as superseded
              await prisma.userMemory.update({
                where: { id: existing.id },
                data: { supersededById: newMemory.id },
              });

              result.contradictionsResolved++;
              result.memoriesStored++;

              // Update our local map
              existingByKey.set(normalizedKey, newMemory);
            } else {
              // Same value, just update confidence if higher
              if (extracted.confidence > (existing.confidence || 0)) {
                await prisma.userMemory.update({
                  where: { id: existing.id },
                  data: {
                    confidence: extracted.confidence,
                    updatedAt: new Date(),
                  },
                });
                if (verbose) {
                  console.log(
                    `   ↑ Updated confidence for ${normalizedKey}: ${extracted.confidence.toFixed(2)}`
                  );
                }
              }
            }
          } else {
            // New memory
            const newMemory = await prisma.userMemory.create({
              data: {
                userId: call.userId,
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
                extractedBy: "memory_extractor_v1",
              },
            });

            existingByKey.set(normalizedKey, newMemory);
            result.memoriesStored++;

            if (verbose) {
              console.log(
                `   ✓ Stored: [${category}] ${extracted.key} = "${extracted.value}" (${extracted.confidence.toFixed(2)})`
              );
            }
          }
        }
      } catch (err: any) {
        const errMsg = `Error processing call ${call.id}: ${err.message}`;
        console.error(`   ❌ ${errMsg}`);
        result.errors.push(errMsg);
      }
    }

    // Step 3: Aggregate summaries
    if (aggregate && userIds.size > 0) {
      if (verbose) {
        console.log(`\n🔄 Updating summaries for ${userIds.size} user(s)...`);
      }

      for (const userId of userIds) {
        try {
          await aggregateUserMemorySummary(userId, verbose);
          result.summariesUpdated++;
        } catch (err: any) {
          const errMsg = `Error aggregating summary for ${userId}: ${err.message}`;
          console.error(`   ❌ ${errMsg}`);
          result.errors.push(errMsg);
        }
      }
    }

    // Summary
    console.log("\n✅ MEMORY EXTRACTION COMPLETE\n");
    console.log(`Calls processed: ${result.callsProcessed}`);
    console.log(`Memories extracted: ${result.memoriesExtracted}`);
    console.log(`Memories stored: ${result.memoriesStored}`);
    console.log(`Contradictions resolved: ${result.contradictionsResolved}`);
    if (aggregate) {
      console.log(`Summaries updated: ${result.summariesUpdated}`);
    }
    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors: ${result.errors.length}`);
      result.errors.forEach((err) => console.log(`   - ${err}`));
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
 * Extract memories from a transcript using LLM
 *
 * For now, this is a mock implementation. In production, this would call an LLM
 * with a structured extraction prompt.
 */
async function extractMemoriesFromTranscript(
  transcript: string,
  verbose: boolean
): Promise<ExtractedMemory[]> {
  // TODO: Replace with actual LLM call
  //
  // const prompt = `
  //   Analyze this call transcript and extract structured memories about the customer.
  //
  //   Categories to extract:
  //   - FACT: Immutable facts (location, occupation, name)
  //   - PREFERENCE: User preferences (contact method, response style)
  //   - EVENT: Time-bound events (appointments, complaints, purchases)
  //   - TOPIC: Topics discussed (interests, products mentioned)
  //   - RELATIONSHIP: Relationships (family members, colleagues)
  //   - CONTEXT: Temporary situational context (traveling, in a meeting)
  //
  //   Transcript:
  //   ${transcript.substring(0, 8000)}
  //
  //   Return JSON array of memories, each with:
  //   - category: one of FACT, PREFERENCE, EVENT, TOPIC, RELATIONSHIP, CONTEXT
  //   - key: the memory key (e.g., "location", "preferred_contact", "spouse_name")
  //   - value: the memory value
  //   - evidence: the quote from transcript supporting this
  //   - confidence: 0-1 how confident you are
  //   - expiresInDays: (optional) for temporary context, when it expires
  // `;
  //
  // const result = await callLLM(prompt);
  // return JSON.parse(result);

  // Mock implementation: extract some basic patterns
  const memories: ExtractedMemory[] = [];

  // Simple pattern matching for demo
  const patterns = [
    {
      regex: /(?:I live in|I'm from|I'm located in|based in)\s+([A-Z][a-zA-Z\s]+)/i,
      category: "FACT",
      key: "location",
    },
    {
      regex: /(?:I work at|I'm with|employed by|work for)\s+([A-Z][a-zA-Z\s]+)/i,
      category: "FACT",
      key: "employer",
    },
    {
      regex: /(?:I'm a|I work as|my job is|I'm an?)\s+([a-zA-Z\s]+?)(?:\s+at|\s+for|\.|\,)/i,
      category: "FACT",
      key: "occupation",
    },
    {
      regex: /(?:I have|we have)\s+(\d+)\s+(?:kids|children)/i,
      category: "RELATIONSHIP",
      key: "children_count",
    },
    {
      regex: /(?:my wife|my husband|my spouse|my partner)\s+([A-Z][a-z]+)/i,
      category: "RELATIONSHIP",
      key: "spouse_name",
    },
    {
      regex: /(?:prefer|rather have|like to receive)\s+(?:contact via|communication via|messages via)?\s*(email|phone|text|sms)/i,
      category: "PREFERENCE",
      key: "preferred_contact",
    },
    {
      regex: /(?:I'm traveling|I'll be traveling|on vacation|on holiday)\s+(?:next|this)\s+(week|month)/i,
      category: "CONTEXT",
      key: "traveling",
      expiresInDays: 14,
    },
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern.regex);
    if (match) {
      memories.push({
        category: pattern.category,
        key: pattern.key,
        value: match[1].trim(),
        evidence: match[0],
        confidence: 0.7 + Math.random() * 0.2, // 0.7-0.9
        expiresInDays: (pattern as any).expiresInDays,
      });
    }
  }

  if (verbose && memories.length === 0) {
    console.log("   [MOCK] No patterns matched in transcript");
  } else if (verbose) {
    console.log(`   [MOCK] Pattern-matched ${memories.length} memories`);
  }

  return memories;
}

/**
 * Aggregate user memories into a summary
 */
async function aggregateUserMemorySummary(
  userId: string,
  verbose: boolean
): Promise<void> {
  // Get all active memories for this user
  const memories = await prisma.userMemory.findMany({
    where: {
      userId,
      supersededById: null, // Only active
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }, // Not expired
      ],
    },
    orderBy: { confidence: "desc" },
  });

  if (memories.length === 0) {
    if (verbose) {
      console.log(`   ⏭️  No active memories for user ${userId}`);
    }
    return;
  }

  // Count by category
  const factCount = memories.filter((m) => m.category === MemoryCategory.FACT).length;
  const preferenceCount = memories.filter((m) => m.category === MemoryCategory.PREFERENCE).length;
  const eventCount = memories.filter((m) => m.category === MemoryCategory.EVENT).length;
  const topicCount = memories.filter((m) => m.category === MemoryCategory.TOPIC).length;

  // Extract key facts (top 10 by confidence)
  const keyFacts = memories
    .filter((m) => m.category === MemoryCategory.FACT)
    .slice(0, 10)
    .map((m) => ({
      key: m.normalizedKey || m.key,
      value: m.value,
      confidence: m.confidence,
    }));

  // Extract top topics
  const topTopics = memories
    .filter((m) => m.category === MemoryCategory.TOPIC)
    .slice(0, 5)
    .map((m) => ({
      topic: m.value,
      lastMentioned: m.extractedAt,
    }));

  // Extract preferences as object
  const preferences: Record<string, string> = {};
  for (const m of memories.filter((m) => m.category === MemoryCategory.PREFERENCE)) {
    const key = m.normalizedKey || m.key;
    preferences[key] = m.value;
  }

  // Get most recent memory timestamp
  const lastMemoryAt = memories.reduce(
    (latest, m) => (m.extractedAt > latest ? m.extractedAt : latest),
    memories[0].extractedAt
  );

  // Upsert summary
  await prisma.userMemorySummary.upsert({
    where: { userId },
    create: {
      userId,
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
    console.log(`   ✅ Updated summary for user ${userId}: ${memories.length} memories`);
    console.log(`      Facts: ${factCount}, Preferences: ${preferenceCount}, Events: ${eventCount}, Topics: ${topicCount}`);
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: MemoryExtractorOptions = {
    verbose: args.includes("--verbose") || args.includes("-v"),
    plan: args.includes("--plan"),
    callId: args.find((a) => a.startsWith("--call="))?.split("=")[1],
    userId: args.find((a) => a.startsWith("--user="))?.split("=")[1],
    limit: parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "100"),
    aggregate: !args.includes("--no-aggregate"),
    confidenceThreshold: parseFloat(
      args.find((a) => a.startsWith("--confidence="))?.split("=")[1] || "0.5"
    ),
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
