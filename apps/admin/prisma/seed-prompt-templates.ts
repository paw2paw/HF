/**
 * Seed script for adding prompt templates to Analysis Specs
 *
 * Each spec can now have a promptTemplate that gets rendered at prompt composition time.
 * Templates use Mustache-style syntax with variables and conditionals.
 *
 * Run with: npx tsx prisma/seed-prompt-templates.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Prompt templates for Big Five personality specs
const PERSONALITY_TEMPLATES: Record<string, string> = {
  "personality-openness": `The caller scores {{value}} on openness to experience ({{label}}).
{{#if high}}They enjoy exploring new ideas and approaches. Feel free to suggest creative solutions, discuss abstract concepts, and explore tangential topics they might find interesting.{{/if}}
{{#if medium}}They're moderately open to new ideas. Balance conventional approaches with occasional novel suggestions.{{/if}}
{{#if low}}They prefer familiar, proven approaches. Stick to standard solutions and avoid overwhelming them with too many options or abstract discussions.{{/if}}`,

  "personality-conscientiousness": `The caller scores {{value}} on conscientiousness ({{label}}).
{{#if high}}They value organization and thoroughness. Be systematic, provide clear step-by-step guidance, and confirm details. They appreciate when things are done correctly.{{/if}}
{{#if medium}}They have a balanced approach to organization. Provide clear information but don't over-structure the conversation.{{/if}}
{{#if low}}They prefer flexibility over rigid processes. Keep things simple and avoid overwhelming them with detailed procedures or extensive checklists.{{/if}}`,

  "personality-extraversion": `The caller scores {{value}} on extraversion ({{label}}).
{{#if high}}They're energetic and talkative. Match their energy, engage in friendly conversation, and don't rush through interactions. They enjoy the social aspect of calls.{{/if}}
{{#if medium}}They're balanced between social engagement and task focus. Be friendly but respect their time.{{/if}}
{{#if low}}They prefer efficient, focused interactions. Be warm but concise. Don't force excessive small talk - get to the point while remaining personable.{{/if}}`,

  "personality-agreeableness": `The caller scores {{value}} on agreeableness ({{label}}).
{{#if high}}They're warm and cooperative. Acknowledge their patience and kindness. They respond well to appreciation and collaborative problem-solving.{{/if}}
{{#if medium}}They're balanced in their approach. Be professional and friendly without being overly effusive.{{/if}}
{{#if low}}They're direct and may challenge recommendations. Be factual, don't take pushback personally, and focus on practical outcomes rather than building rapport.{{/if}}`,

  "personality-neuroticism": `The caller scores {{value}} on emotional sensitivity ({{label}}).
{{#if high}}They may be anxious or worried about the situation. Provide reassurance, be patient with repeated questions, and clearly explain what to expect next to reduce uncertainty.{{/if}}
{{#if medium}}They have typical emotional responses. Be empathetic when appropriate but don't overdo reassurance.{{/if}}
{{#if low}}They're emotionally stable and calm. You don't need to provide extra reassurance - they handle uncertainty well. Be efficient and straightforward.{{/if}}`,
};

// Templates for memory/learning specs
const MEMORY_TEMPLATES: Record<string, string> = {
  "memory-personal-facts": `{{#if hasMemories}}About this caller - things we've learned:
{{#each memories.facts}}- {{this.key}}: {{this.value}}
{{/each}}
Use this information naturally in conversation when relevant.{{/if}}`,

  "memory-preferences": `{{#if hasMemories}}This caller's preferences:
{{#each memories.preferences}}- {{this.key}}: {{this.value}}
{{/each}}
Honor these preferences in how you communicate and handle their requests.{{/if}}`,

  "memory-context": `{{#if hasMemories}}Recent context for this caller:
{{#each memories.context}}- {{this.value}}
{{/each}}
Keep this context in mind during the conversation.{{/if}}`,
};

// Templates for engagement specs
const ENGAGEMENT_TEMPLATES: Record<string, string> = {
  "engagement-recall-preference": `The caller has a memory recall preference of {{value}} ({{label}}).
{{#if high}}They appreciate when you reference past interactions and remember details about them. Actively bring up relevant history.{{/if}}
{{#if low}}They prefer each interaction to feel fresh. Don't over-reference past conversations.{{/if}}`,

  "engagement-detail-level": `The caller prefers {{label}} detail in explanations.
{{#if high}}Provide thorough, comprehensive explanations with context and reasoning.{{/if}}
{{#if medium}}Give clear explanations with key details but don't over-explain.{{/if}}
{{#if low}}Be concise and to the point. Skip background info unless asked.{{/if}}`,
};

async function main() {
  console.log("Seeding prompt templates to Analysis Specs...\n");

  // Combine all templates
  const allTemplates = {
    ...PERSONALITY_TEMPLATES,
    ...MEMORY_TEMPLATES,
    ...ENGAGEMENT_TEMPLATES,
  };

  let updated = 0;
  let notFound = 0;

  for (const [slug, template] of Object.entries(allTemplates)) {
    const spec = await prisma.analysisSpec.findUnique({
      where: { slug },
    });

    if (spec) {
      await prisma.analysisSpec.update({
        where: { slug },
        data: {
          promptTemplate: template,
          isDirty: true,
          dirtyReason: "prompt_template_added",
        },
      });
      console.log(`✓ Updated: ${slug}`);
      updated++;
    } else {
      console.log(`✗ Not found: ${slug}`);
      notFound++;
    }
  }

  console.log(`\nDone! Updated ${updated} specs, ${notFound} not found.`);

  // Also create the Big Five specs if they don't exist
  const big5Specs = [
    {
      slug: "personality-openness",
      name: "Personality - Openness",
      description: "Measures openness to experience: curiosity, creativity, and willingness to try new things",
      outputType: "MEASURE" as const,
      domain: "personality",
    },
    {
      slug: "personality-conscientiousness",
      name: "Personality - Conscientiousness",
      description: "Measures conscientiousness: organization, dependability, and self-discipline",
      outputType: "MEASURE" as const,
      domain: "personality",
    },
    {
      slug: "personality-extraversion",
      name: "Personality - Extraversion",
      description: "Measures extraversion: sociability, energy, and assertiveness",
      outputType: "MEASURE" as const,
      domain: "personality",
    },
    {
      slug: "personality-agreeableness",
      name: "Personality - Agreeableness",
      description: "Measures agreeableness: warmth, empathy, and cooperativeness",
      outputType: "MEASURE" as const,
      domain: "personality",
    },
    {
      slug: "personality-neuroticism",
      name: "Personality - Neuroticism",
      description: "Measures emotional sensitivity: anxiety, stress response, and emotional stability",
      outputType: "MEASURE" as const,
      domain: "personality",
    },
  ];

  console.log("\nEnsuring Big Five specs exist...");
  for (const spec of big5Specs) {
    const existing = await prisma.analysisSpec.findUnique({
      where: { slug: spec.slug },
    });

    if (!existing) {
      await prisma.analysisSpec.create({
        data: {
          ...spec,
          promptTemplate: PERSONALITY_TEMPLATES[spec.slug],
          isActive: true,
          isDirty: true,
        },
      });
      console.log(`✓ Created: ${spec.slug}`);
    }
  }

  // Create memory specs if they don't exist
  const memorySpecs = [
    {
      slug: "memory-personal-facts",
      name: "Memory - Personal Facts",
      description: "Extracts and stores personal facts about the caller (location, job, family)",
      outputType: "LEARN" as const,
      domain: "memory",
    },
    {
      slug: "memory-preferences",
      name: "Memory - Preferences",
      description: "Extracts and stores caller preferences (communication style, contact method)",
      outputType: "LEARN" as const,
      domain: "memory",
    },
  ];

  console.log("\nEnsuring Memory specs exist...");
  for (const spec of memorySpecs) {
    const existing = await prisma.analysisSpec.findUnique({
      where: { slug: spec.slug },
    });

    if (!existing) {
      await prisma.analysisSpec.create({
        data: {
          ...spec,
          promptTemplate: MEMORY_TEMPLATES[spec.slug],
          isActive: true,
          isDirty: true,
        },
      });
      console.log(`✓ Created: ${spec.slug}`);
    }
  }

  console.log("\nSeeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
