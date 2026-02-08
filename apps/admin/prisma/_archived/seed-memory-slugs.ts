/**
 * seed-memory-slugs.ts
 *
 * Creates MEMORY-sourced PromptSlugs with different injection policies.
 * These slugs control how memories are retrieved and injected into prompts.
 *
 * Memory Categories:
 * - FACT: Concrete facts about the person (spouse name, job, etc.)
 * - PREFERENCE: Stated preferences (likes hiking, prefers morning calls)
 * - EVENT: Past events mentioned (went to Hawaii, started new job)
 * - TOPIC: Topics of interest or discussion patterns
 * - RELATIONSHIP: People mentioned and their relationships
 *
 * Run with: npx ts-node prisma/seed-memory-slugs.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface MemorySlugDefinition {
  slug: string;
  name: string;
  description: string;
  priority: number;
  // Memory injection policy
  memoryCategory?: string; // Filter to specific category
  memoryMode: string; // "latest" | "all" | "count:N" | "summary"
  memoryMaxItems?: number;
  memoryMinConfidence?: number;
  memoryKeyPattern?: string;
  memoryDecayEnabled: boolean;
  memorySummaryTemplate?: string;
  memoryTrigger: string; // "always" | "if_exists" | "recent_only"
  // Range prompts
  ranges: {
    condition: string;
    label: string;
    prompt: string;
  }[];
  fallbackPrompt?: string;
}

const memorySlugDefinitions: MemorySlugDefinition[] = [
  // =====================================
  // FACTS - Personal details to reference
  // =====================================
  {
    slug: "memory-personal-facts",
    name: "Personal Facts Recall",
    description: "Injects known personal facts about the caller for personalization",
    priority: 30, // High - facts are very useful
    memoryCategory: "FACT",
    memoryMode: "all",
    memoryMaxItems: 10,
    memoryMinConfidence: 0.6,
    memoryDecayEnabled: false, // Facts don't decay
    memoryTrigger: "if_exists",
    ranges: [
      {
        condition: "has_value",
        label: "Has facts",
        prompt: `You know these facts about this person:
{{#each memories}}
- {{this.key}}: {{this.value}}
{{/each}}

Use this information naturally in conversation when relevant. Don't list facts unprompted, but reference them when they add value.`,
      },
    ],
    fallbackPrompt: "", // No output if no facts
  },

  // =====================================
  // PREFERENCES - How they like things
  // =====================================
  {
    slug: "memory-preferences",
    name: "Preference Recall",
    description: "Injects known preferences for personalizing recommendations and approach",
    priority: 25,
    memoryCategory: "PREFERENCE",
    memoryMode: "all",
    memoryMaxItems: 8,
    memoryMinConfidence: 0.5,
    memoryDecayEnabled: true, // Preferences can change
    memoryTrigger: "if_exists",
    ranges: [
      {
        condition: "has_value",
        label: "Has preferences",
        prompt: `Known preferences for this person:
{{#each memories}}
- {{this.key}}: {{this.value}}
{{/each}}

Respect these preferences in your suggestions and approach.`,
      },
    ],
  },

  // =====================================
  // EVENTS - Past discussions/happenings
  // =====================================
  {
    slug: "memory-recent-events",
    name: "Recent Events Recall",
    description: "Recalls recent events mentioned in past conversations for continuity",
    priority: 20,
    memoryCategory: "EVENT",
    memoryMode: "latest",
    memoryMaxItems: 5,
    memoryMinConfidence: 0.5,
    memoryDecayEnabled: true,
    memoryTrigger: "recent_only", // Only inject if there are recent events
    ranges: [
      {
        condition: "has_value",
        label: "Has recent events",
        prompt: `Recent things mentioned by this person:
{{#each memories}}
- {{this.value}}
{{/each}}

Consider following up on these if relevant to the current conversation.`,
      },
    ],
  },

  // =====================================
  // RELATIONSHIPS - People they mention
  // =====================================
  {
    slug: "memory-relationships",
    name: "Relationship Recall",
    description: "Recalls people the caller has mentioned (family, colleagues, etc.)",
    priority: 15,
    memoryCategory: "RELATIONSHIP",
    memoryMode: "all",
    memoryMaxItems: 10,
    memoryMinConfidence: 0.7, // Higher threshold - want to be sure
    memoryDecayEnabled: false,
    memoryTrigger: "if_exists",
    ranges: [
      {
        condition: "has_value",
        label: "Has relationships",
        prompt: `People this caller has mentioned:
{{#each memories}}
- {{this.key}}: {{this.value}}
{{/each}}

Use names naturally when referring to these people if they come up.`,
      },
    ],
  },

  // =====================================
  // COMPREHENSIVE - All memories summarized
  // =====================================
  {
    slug: "memory-summary-all",
    name: "Complete Memory Summary",
    description: "Comprehensive summary of all memories when there are many",
    priority: 5, // Lower priority - use as backup
    memoryMode: "summary",
    memoryMaxItems: 30,
    memoryMinConfidence: 0.4,
    memoryDecayEnabled: true,
    memoryTrigger: "if_exists",
    memorySummaryTemplate: `You have {{count}} pieces of information about this caller:

FACTS: {{memories.FACT}}
PREFERENCES: {{memories.PREFERENCE}}
RECENT EVENTS: {{memories.EVENT}}
PEOPLE MENTIONED: {{memories.RELATIONSHIP}}

Use this context to personalize the conversation.`,
    ranges: [
      {
        condition: "has_value",
        label: "Has memories",
        prompt: `{{#if hasMemories}}
Known about this caller:
{{#each memories}}
- [{{this.category}}] {{this.key}}: {{this.value}}
{{/each}}
{{/if}}`,
      },
    ],
    fallbackPrompt:
      "This is a new caller with no prior conversation history. Treat them as a first-time interaction.",
  },

  // =====================================
  // TOPICS - Conversation patterns
  // =====================================
  {
    slug: "memory-topic-interests",
    name: "Topic Interests",
    description: "Topics this person frequently discusses or shows interest in",
    priority: 10,
    memoryCategory: "TOPIC",
    memoryMode: "all",
    memoryMaxItems: 6,
    memoryMinConfidence: 0.5,
    memoryDecayEnabled: true,
    memoryTrigger: "if_exists",
    ranges: [
      {
        condition: "has_value",
        label: "Has topic interests",
        prompt: `Topics this person is interested in or frequently discusses:
{{#each memories}}
- {{this.value}}
{{/each}}

You can reference these topics to build rapport or make relevant suggestions.`,
      },
    ],
  },

  // =====================================
  // RECENT CONTEXT - Last call summary
  // =====================================
  {
    slug: "memory-last-call-context",
    name: "Last Call Context",
    description: "Quick context from the most recent interaction",
    priority: 35, // Very high - recent context is valuable
    memoryMode: "latest",
    memoryMaxItems: 3,
    memoryMinConfidence: 0.6,
    memoryKeyPattern: "last_call_*", // Match keys like last_call_topic, last_call_outcome
    memoryDecayEnabled: true,
    memoryTrigger: "recent_only",
    ranges: [
      {
        condition: "has_value",
        label: "Has last call context",
        prompt: `From your last conversation with this person:
{{#each memories}}
- {{this.key}}: {{this.value}}
{{/each}}

Consider acknowledging continuity from the previous conversation.`,
      },
    ],
  },
];

async function main() {
  console.log("Seeding MEMORY-sourced PromptSlugs...\n");

  for (const def of memorySlugDefinitions) {
    console.log(`Creating memory slug: ${def.slug}`);

    try {
      // Upsert the slug
      const slug = await prisma.promptSlug.upsert({
        where: { slug: def.slug },
        create: {
          slug: def.slug,
          name: def.name,
          description: def.description,
          sourceType: "MEMORY",
          priority: def.priority,
          memoryCategory: def.memoryCategory,
          memoryMode: def.memoryMode,
          memoryMaxItems: def.memoryMaxItems,
          memoryMinConfidence: def.memoryMinConfidence,
          memoryKeyPattern: def.memoryKeyPattern,
          memoryDecayEnabled: def.memoryDecayEnabled,
          memorySummaryTemplate: def.memorySummaryTemplate,
          memoryTrigger: def.memoryTrigger,
          fallbackPrompt: def.fallbackPrompt,
          isActive: true,
          version: "1.0",
        },
        update: {
          name: def.name,
          description: def.description,
          priority: def.priority,
          memoryCategory: def.memoryCategory,
          memoryMode: def.memoryMode,
          memoryMaxItems: def.memoryMaxItems,
          memoryMinConfidence: def.memoryMinConfidence,
          memoryKeyPattern: def.memoryKeyPattern,
          memoryDecayEnabled: def.memoryDecayEnabled,
          memorySummaryTemplate: def.memorySummaryTemplate,
          memoryTrigger: def.memoryTrigger,
          fallbackPrompt: def.fallbackPrompt,
        },
      });

      // Delete existing ranges and recreate
      await prisma.promptSlugRange.deleteMany({
        where: { slugId: slug.id },
      });

      // Create ranges
      for (let i = 0; i < def.ranges.length; i++) {
        const range = def.ranges[i];
        await prisma.promptSlugRange.create({
          data: {
            slugId: slug.id,
            label: range.label,
            condition: range.condition,
            prompt: range.prompt,
            sortOrder: i,
          },
        });
      }

      console.log(`  ✓ Created with ${def.ranges.length} range(s)`);
      console.log(`    Category: ${def.memoryCategory || "all"}`);
      console.log(`    Mode: ${def.memoryMode}`);
      console.log(`    Trigger: ${def.memoryTrigger}`);
      console.log(`    Max items: ${def.memoryMaxItems || "default"}`);
    } catch (err: any) {
      console.error(`  ✗ Error: ${err.message}`);
    }
  }

  // Also create the default PromptCompositionConfig
  console.log("\nCreating default PromptCompositionConfig...");

  try {
    await prisma.promptCompositionConfig.upsert({
      where: { name: "default" },
      create: {
        name: "default",
        description: "Default memory injection configuration",
        memoryMaxCount: 20,
        memoryMinConfidence: 0.5,
        memoryDecayEnabled: true,
        memoryCategories: [], // All categories
        memoryRelevanceMode: "all",
        memoryRecencyDays: null,
        memorySummarizeAbove: 15, // Summarize if > 15 memories
        memorySummaryPrompt: null, // Use default summary format
        slugSeparator: "\n\n",
        includeMetadata: false,
        isActive: true,
        isDefault: true,
      },
      update: {
        description: "Default memory injection configuration",
        memoryMaxCount: 20,
        memoryMinConfidence: 0.5,
        memoryDecayEnabled: true,
        isDefault: true,
      },
    });
    console.log("  ✓ Created default config");
  } catch (err: any) {
    console.error(`  ✗ Error creating config: ${err.message}`);
  }

  console.log("\n✓ Memory slug seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
