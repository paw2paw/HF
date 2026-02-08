/**
 * Seed script for Playbook system:
 * - PromptTemplates (output templates with Mustache variables)
 * - Playbooks per domain with items
 * - Assigns scope to AnalysisSpecs
 *
 * Run with: npx tsx prisma/seed-playbooks.ts
 */

import { PrismaClient, SpecificationScope } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// PROMPT TEMPLATES - Output templates for agent prompts
// ============================================================
const PROMPT_TEMPLATES = [
  {
    slug: "tutor-default",
    name: "Tutor - Default",
    description: "Default tutoring template with personality adaptation and memory injection",
    systemPrompt: `You are a knowledgeable and patient tutor helping the caller learn and grow.

## Caller Context
{{#if caller.name}}You're speaking with {{caller.name}}.{{/if}}

## Personality Adaptation
{{#if personality.extraversion.high}}
Engage warmly and conversationally. Match their energy, share enthusiasm for the subject, and use an animated teaching style.
{{/if}}
{{#if personality.extraversion.low}}
Be calm and focused. Give them space to process. Avoid overwhelming them with too much energy or rapid-fire questions.
{{/if}}

{{#if personality.openness.high}}
Feel free to explore tangential topics, offer creative examples, and encourage their curiosity.
{{/if}}
{{#if personality.openness.low}}
Stick to conventional explanations and proven methods. Avoid abstract discussions unless necessary.
{{/if}}

## Memories
{{#if memories.facts}}
What we know about this caller:
{{#each memories.facts}}- {{this.key}}: {{this.value}}
{{/each}}
{{/if}}

{{#if memories.preferences}}
Their preferences:
{{#each memories.preferences}}- {{this.key}}: {{this.value}}
{{/each}}
{{/if}}

## Guidelines
- Be encouraging but honest
- Adapt explanations to their level
- Ask clarifying questions when needed
- Celebrate progress and effort`,
  },
  {
    slug: "support-empathetic",
    name: "Support - Empathetic",
    description: "Customer support template focusing on empathy and issue resolution",
    systemPrompt: `You are a helpful and empathetic customer support agent.

## Caller Context
{{#if caller.name}}You're speaking with {{caller.name}}.{{/if}}

## Personality Adaptation
{{#if personality.neuroticism.high}}
This caller may be anxious or frustrated. Be extra patient, provide reassurance, and clearly explain next steps to reduce uncertainty.
{{/if}}

{{#if personality.agreeableness.low}}
This caller is direct and may push back. Stay factual, don't take it personally, and focus on solutions rather than rapport.
{{/if}}

{{#if personality.conscientiousness.high}}
They value thoroughness. Provide complete information, confirm details, and document everything clearly.
{{/if}}

## Previous Interactions
{{#if memories.context}}
Recent context:
{{#each memories.context}}- {{this.value}}
{{/each}}
{{/if}}

## Guidelines
- Acknowledge their frustration first
- Take ownership of issues
- Provide clear timelines
- Follow up on promises`,
  },
  {
    slug: "sales-consultative",
    name: "Sales - Consultative",
    description: "Sales template with consultative approach and need discovery",
    systemPrompt: `You are a consultative sales representative focused on understanding needs and providing value.

## Caller Context
{{#if caller.name}}You're speaking with {{caller.name}}.{{/if}}

## Personality Adaptation
{{#if personality.extraversion.high}}
Build rapport through conversation. They enjoy the social aspect - don't rush to the pitch.
{{/if}}
{{#if personality.extraversion.low}}
Be efficient and respect their time. Get to value propositions quickly.
{{/if}}

{{#if personality.openness.high}}
Present innovative solutions and new possibilities. They're interested in what's cutting-edge.
{{/if}}
{{#if personality.openness.low}}
Focus on proven results and established products. Use case studies and testimonials.
{{/if}}

## Known Interests
{{#if memories.topics}}
Topics they've discussed:
{{#each memories.topics}}- {{this.value}}
{{/each}}
{{/if}}

## Guidelines
- Ask questions first, pitch second
- Focus on their specific needs
- Be transparent about limitations
- Never pressure or manipulate`,
  },
  {
    slug: "wellness-supportive",
    name: "Wellness - Supportive",
    description: "Wellness coaching template with emotional support and gentle guidance",
    systemPrompt: `You are a compassionate wellness coach providing support and guidance.

## Caller Context
{{#if caller.name}}You're speaking with {{caller.name}}.{{/if}}

## Personality Adaptation
{{#if personality.neuroticism.high}}
Be especially gentle and reassuring. Acknowledge their feelings before offering suggestions.
{{/if}}
{{#if personality.neuroticism.low}}
They're emotionally stable - you can be more direct with feedback and suggestions.
{{/if}}

{{#if personality.conscientiousness.high}}
They respond well to structured plans and trackable goals.
{{/if}}
{{#if personality.conscientiousness.low}}
Keep suggestions flexible. Avoid rigid schedules or detailed tracking.
{{/if}}

## What We Know
{{#if memories.facts}}
About them:
{{#each memories.facts}}- {{this.key}}: {{this.value}}
{{/each}}
{{/if}}

{{#if memories.events}}
Recent events:
{{#each memories.events}}- {{this.value}}
{{/each}}
{{/if}}

## Guidelines
- Listen actively and empathetically
- Validate feelings before problem-solving
- Suggest, don't prescribe
- Encourage self-compassion
- Recognize when to escalate to professionals`,
  },
];

// ============================================================
// SPEC SCOPE ASSIGNMENTS - Which specs apply at which level
// ============================================================
// Note: CALLER specs are NEVER manually created - they are auto-generated
// by the learning system. Specs that define HOW to analyze personality/memory
// are DOMAIN-scoped (the analysis rules), while SYSTEM specs are global.
const SPEC_SCOPES: { slugPattern: string; scope: SpecificationScope }[] = [
  // Domain-level specs (personality, memory analysis rules - per domain)
  { slugPattern: "personality-%", scope: "DOMAIN" },
  { slugPattern: "memory-%", scope: "DOMAIN" },
  { slugPattern: "engagement-%", scope: "DOMAIN" },
  { slugPattern: "conversation-%", scope: "DOMAIN" },

  // System-level specs (safety, compliance - global)
  { slugPattern: "safety-%", scope: "SYSTEM" },
  { slugPattern: "compliance-%", scope: "SYSTEM" },
  { slugPattern: "commercial-%", scope: "SYSTEM" },
  { slugPattern: "agent-%", scope: "SYSTEM" },
];

async function main() {
  console.log("Seeding Playbook system...\n");

  // ============================================================
  // 1. Seed Prompt Templates
  // ============================================================
  console.log("1. Seeding Prompt Templates...");

  for (const template of PROMPT_TEMPLATES) {
    const existing = await prisma.promptTemplate.findUnique({
      where: { slug: template.slug },
    });

    if (existing) {
      console.log(`  Updating: ${template.slug}`);
      await prisma.promptTemplate.update({
        where: { slug: template.slug },
        data: template,
      });
    } else {
      console.log(`  Creating: ${template.slug}`);
      await prisma.promptTemplate.create({
        data: {
          ...template,
          isActive: true,
          version: "1.0",
        },
      });
    }
  }

  const templateCount = await prisma.promptTemplate.count();
  console.log(`  Done. ${templateCount} prompt templates in database.\n`);

  // ============================================================
  // 2. Assign Scopes to AnalysisSpecs
  // ============================================================
  console.log("2. Assigning scopes to AnalysisSpecs...");

  for (const { slugPattern, scope } of SPEC_SCOPES) {
    // Convert SQL LIKE pattern to regex for Prisma
    const likePattern = slugPattern.replace(/%/g, "");

    const updated = await prisma.analysisSpec.updateMany({
      where: {
        slug: { startsWith: likePattern },
      },
      data: { scope },
    });

    if (updated.count > 0) {
      console.log(`  ${scope}: Updated ${updated.count} specs matching "${slugPattern}"`);
    }
  }

  // Count specs by scope
  const scopeCounts = await Promise.all([
    prisma.analysisSpec.count({ where: { scope: "CALLER" } }),
    prisma.analysisSpec.count({ where: { scope: "DOMAIN" } }),
    prisma.analysisSpec.count({ where: { scope: "SYSTEM" } }),
  ]);
  console.log(`  Scope distribution: CALLER=${scopeCounts[0]}, DOMAIN=${scopeCounts[1]}, SYSTEM=${scopeCounts[2]}\n`);

  // ============================================================
  // 3. Get domains for playbook creation
  // ============================================================
  const domains = await prisma.domain.findMany({
    where: { isActive: true },
  });

  if (domains.length === 0) {
    console.log("  No domains found. Run seed-domains.ts first.\n");
    return;
  }

  // ============================================================
  // 4. Create sample Playbooks for each domain
  // ============================================================
  console.log("3. Creating sample Playbooks...");

  // Get all active specs grouped by scope
  const callerSpecs = await prisma.analysisSpec.findMany({
    where: { scope: "CALLER", isActive: true },
    take: 5,
  });
  const systemSpecs = await prisma.analysisSpec.findMany({
    where: { scope: "SYSTEM", isActive: true },
    take: 3,
  });

  // Map domains to their template slugs
  const domainTemplateMap: Record<string, string> = {
    tutor: "tutor-default",
    support: "support-empathetic",
    sales: "sales-consultative",
    wellness: "wellness-supportive",
  };

  for (const domain of domains) {
    const templateSlug = domainTemplateMap[domain.slug] || "tutor-default";
    const template = await prisma.promptTemplate.findUnique({
      where: { slug: templateSlug },
    });

    if (!template) {
      console.log(`  Skipping ${domain.name}: No matching template found`);
      continue;
    }

    const playbookName = `${domain.name} - Default Playbook`;

    // Check if playbook already exists
    const existingPlaybook = await prisma.playbook.findFirst({
      where: {
        domainId: domain.id,
        name: playbookName,
      },
    });

    if (existingPlaybook) {
      console.log(`  Playbook already exists: ${playbookName}`);
      continue;
    }

    // Create the playbook
    const playbook = await prisma.playbook.create({
      data: {
        name: playbookName,
        description: `Default playbook for ${domain.name} domain with personality specs and ${templateSlug} template`,
        domainId: domain.id,
        status: "DRAFT",
        version: "1.0",
        measureSpecCount: callerSpecs.filter(s => s.outputType === "MEASURE").length,
        learnSpecCount: callerSpecs.filter(s => s.outputType === "LEARN").length,
      },
    });

    // Add caller specs as items
    let sortOrder = 0;
    for (const spec of callerSpecs) {
      await prisma.playbookItem.create({
        data: {
          playbookId: playbook.id,
          itemType: "SPEC",
          specId: spec.id,
          sortOrder: sortOrder++,
          isEnabled: true,
        },
      });
    }

    // Add system specs
    for (const spec of systemSpecs) {
      await prisma.playbookItem.create({
        data: {
          playbookId: playbook.id,
          itemType: "SPEC",
          specId: spec.id,
          sortOrder: sortOrder++,
          isEnabled: true,
        },
      });
    }

    // Add the prompt template as final item
    await prisma.playbookItem.create({
      data: {
        playbookId: playbook.id,
        itemType: "PROMPT_TEMPLATE",
        promptTemplateId: template.id,
        sortOrder: sortOrder++,
        isEnabled: true,
      },
    });

    console.log(`  Created: ${playbookName} (${sortOrder} items)`);
  }

  const playbookCount = await prisma.playbook.count();
  const itemCount = await prisma.playbookItem.count();
  console.log(`\nDone! ${playbookCount} playbooks, ${itemCount} items total.`);
}

main()
  .catch((e) => {
    console.error("Error seeding playbooks:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
