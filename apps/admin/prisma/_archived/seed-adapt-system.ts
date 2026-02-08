/**
 * Seed ADAPT System
 *
 * Creates:
 * 1. ADAPT parameters (deltas for key metrics)
 * 2. GOAL parameters (progress toward targets)
 * 3. ADAPT Analysis Specs (compute deltas)
 * 4. Adapt PromptSlugs (fire based on deltas/goals)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Seeding ADAPT System ===\n");

  // =====================================
  // 0. BASE STATE PARAMETERS (needed for ADAPT deltas)
  // =====================================
  console.log("0. Creating base STATE parameters...");

  const stateParameters = [
    {
      parameterId: "engagement",
      name: "Engagement Level",
      definition: "How engaged the user is in the current conversation (0-1)",
      sectionId: "state",
      domainGroup: "engagement",
      scaleType: "continuous",
      directionality: "higher_better",
      computedBy: "MEASURE",
      parameterType: "STATE" as const,
      interpretationHigh: "User is highly engaged, attentive, and participating actively",
      interpretationLow: "User seems disengaged, distracted, or giving minimal responses",
    },
    {
      parameterId: "mood",
      name: "Detected Mood",
      definition: "The user's apparent mood during the conversation (0-1, higher=more positive)",
      sectionId: "state",
      domainGroup: "emotion",
      scaleType: "continuous",
      directionality: "higher_better",
      computedBy: "MEASURE",
      parameterType: "STATE" as const,
      interpretationHigh: "User appears happy, positive, or enthusiastic",
      interpretationLow: "User appears frustrated, upset, or negative",
    },
    {
      parameterId: "rapport",
      name: "Rapport Level",
      definition: "The quality of connection and trust between user and system (0-1)",
      sectionId: "state",
      domainGroup: "relationship",
      scaleType: "continuous",
      directionality: "higher_better",
      computedBy: "MEASURE",
      parameterType: "STATE" as const,
      interpretationHigh: "Strong rapport - user is comfortable, trusting, and open",
      interpretationLow: "Weak rapport - user is guarded, formal, or distant",
    },
    {
      parameterId: "satisfaction",
      name: "Expressed Satisfaction",
      definition: "Level of satisfaction expressed by the user (0-1)",
      sectionId: "state",
      domainGroup: "outcome",
      scaleType: "continuous",
      directionality: "higher_better",
      computedBy: "MEASURE",
      parameterType: "STATE" as const,
      interpretationHigh: "User expresses satisfaction with the interaction or outcome",
      interpretationLow: "User expresses dissatisfaction or unmet expectations",
    },
    {
      parameterId: "resolution",
      name: "Issue Resolution",
      definition: "Whether the user's issue or need has been addressed (0-1)",
      sectionId: "state",
      domainGroup: "outcome",
      scaleType: "continuous",
      directionality: "higher_better",
      computedBy: "MEASURE",
      parameterType: "STATE" as const,
      interpretationHigh: "Issue fully resolved, user's needs met",
      interpretationLow: "Issue unresolved, user's needs not addressed",
    },
  ];

  for (const param of stateParameters) {
    await prisma.parameter.upsert({
      where: { parameterId: param.parameterId },
      create: param,
      update: {
        ...param,
        updatedAt: new Date(),
      },
    });
    console.log(`  + ${param.parameterId}: ${param.name}`);
  }

  // =====================================
  // 1. ADAPT PARAMETERS (Deltas)
  // =====================================
  console.log("\n1. Creating ADAPT parameters...");

  const adaptParameters = [
    {
      parameterId: "engagement_delta",
      name: "Engagement Change",
      definition: "Change in engagement level from previous call to current call",
      sectionId: "adapt",
      domainGroup: "engagement",
      scaleType: "delta",
      directionality: "bidirectional",
      computedBy: "ADAPT",
      parameterType: "ADAPT" as const,
      baseParameterId: "engagement",
      interpretationHigh: "Engagement improved significantly since last call",
      interpretationLow: "Engagement dropped since last call - re-engagement needed",
    },
    {
      parameterId: "mood_delta",
      name: "Mood Change",
      definition: "Change in detected mood from previous call to current call",
      sectionId: "adapt",
      domainGroup: "emotion",
      scaleType: "delta",
      directionality: "bidirectional",
      computedBy: "ADAPT",
      parameterType: "ADAPT" as const,
      baseParameterId: "mood",
      interpretationHigh: "Mood improved - conversation is going well",
      interpretationLow: "Mood declined - may need to adjust approach",
    },
    {
      parameterId: "rapport_delta",
      name: "Rapport Change",
      definition: "Change in rapport level from previous call",
      sectionId: "adapt",
      domainGroup: "relationship",
      scaleType: "delta",
      directionality: "bidirectional",
      computedBy: "ADAPT",
      parameterType: "ADAPT" as const,
      baseParameterId: "rapport",
      interpretationHigh: "Rapport strengthening - relationship building is working",
      interpretationLow: "Rapport weakening - focus on connection",
    },
    {
      parameterId: "satisfaction_delta",
      name: "Satisfaction Change",
      definition: "Change in expressed satisfaction from previous call",
      sectionId: "adapt",
      domainGroup: "outcome",
      scaleType: "delta",
      directionality: "bidirectional",
      computedBy: "ADAPT",
      parameterType: "ADAPT" as const,
      baseParameterId: "satisfaction",
      interpretationHigh: "Satisfaction trending up - maintain current approach",
      interpretationLow: "Satisfaction declining - identify and address concerns",
    },
    {
      parameterId: "session_momentum",
      name: "Session Momentum",
      definition: "Average trend over last 3 calls - are things generally improving?",
      sectionId: "adapt",
      domainGroup: "trend",
      scaleType: "delta",
      directionality: "bidirectional",
      computedBy: "ADAPT",
      parameterType: "ADAPT" as const,
      baseParameterId: "engagement",
      interpretationHigh: "Positive momentum - user is increasingly engaged over time",
      interpretationLow: "Negative momentum - engagement declining over multiple calls",
    },
  ];

  for (const param of adaptParameters) {
    await prisma.parameter.upsert({
      where: { parameterId: param.parameterId },
      create: param,
      update: {
        ...param,
        updatedAt: new Date(),
      },
    });
    console.log(`  + ${param.parameterId}: ${param.name}`);
  }

  // =====================================
  // 2. GOAL PARAMETERS
  // =====================================
  console.log("\n2. Creating GOAL parameters...");

  const goalParameters = [
    {
      parameterId: "rapport_goal_progress",
      name: "Rapport Goal Progress",
      definition: "Progress toward target rapport level (0.8)",
      sectionId: "goals",
      domainGroup: "relationship",
      scaleType: "ratio",
      directionality: "higher_better",
      computedBy: "GOAL",
      parameterType: "GOAL" as const,
      baseParameterId: "rapport",
      goalTarget: 0.8,
      goalWindow: 5,
      interpretationHigh: "Close to or achieved rapport goal",
      interpretationLow: "Far from rapport goal - focus on building connection",
    },
    {
      parameterId: "engagement_goal_progress",
      name: "Engagement Goal Progress",
      definition: "Progress toward target engagement level (0.75)",
      sectionId: "goals",
      domainGroup: "engagement",
      scaleType: "ratio",
      directionality: "higher_better",
      computedBy: "GOAL",
      parameterType: "GOAL" as const,
      baseParameterId: "engagement",
      goalTarget: 0.75,
      goalWindow: 3,
      interpretationHigh: "Meeting engagement targets",
      interpretationLow: "Below engagement target - need to re-engage",
    },
    {
      parameterId: "resolution_goal_progress",
      name: "Resolution Goal Progress",
      definition: "Progress toward successful resolution (1.0)",
      sectionId: "goals",
      domainGroup: "outcome",
      scaleType: "ratio",
      directionality: "higher_better",
      computedBy: "GOAL",
      parameterType: "GOAL" as const,
      baseParameterId: "resolution",
      goalTarget: 1.0,
      goalWindow: 1,
      interpretationHigh: "Issue resolved or nearly resolved",
      interpretationLow: "Issue not yet resolved - continue working toward solution",
    },
  ];

  for (const param of goalParameters) {
    await prisma.parameter.upsert({
      where: { parameterId: param.parameterId },
      create: param,
      update: {
        ...param,
        updatedAt: new Date(),
      },
    });
    console.log(`  + ${param.parameterId}: ${param.name}`);
  }

  // =====================================
  // 3. ADAPT ANALYSIS SPECS
  // =====================================
  console.log("\n3. Creating ADAPT Analysis Specs...");

  // Create the ADAPT spec
  const adaptSpec = await prisma.analysisSpec.upsert({
    where: { slug: "adapt-delta-calculation" },
    create: {
      slug: "adapt-delta-calculation",
      name: "Adaptation - Delta Calculation",
      description: "Computes changes (deltas) between current and previous calls for key metrics. Runs automatically after MEASURE specs.",
      outputType: "ADAPT",
      domain: "adapt",
      priority: 100, // Run after all MEASURE specs
      isActive: true,
      version: "1.0",
    },
    update: {
      name: "Adaptation - Delta Calculation",
      description: "Computes changes (deltas) between current and previous calls for key metrics. Runs automatically after MEASURE specs.",
      outputType: "ADAPT",
      priority: 100,
    },
  });
  console.log(`  + ${adaptSpec.slug}: ${adaptSpec.name}`);

  // Add triggers for the ADAPT spec
  const adaptTrigger = await prisma.analysisTrigger.upsert({
    where: {
      id: `${adaptSpec.id}-delta-trigger`,
    },
    create: {
      id: `${adaptSpec.id}-delta-trigger`,
      specId: adaptSpec.id,
      name: "Calculate Deltas",
      given: "A call has completed analysis with MEASURE scores",
      when: "The user has at least one previous call with scores",
      then: "Compute delta scores for all tracked parameters",
      sortOrder: 0,
    },
    update: {
      given: "A call has completed analysis with MEASURE scores",
      when: "The user has at least one previous call with scores",
      then: "Compute delta scores for all tracked parameters",
    },
  });

  // Add actions for each ADAPT parameter
  for (const param of adaptParameters) {
    await prisma.analysisAction.upsert({
      where: {
        id: `${adaptTrigger.id}-${param.parameterId}`,
      },
      create: {
        id: `${adaptTrigger.id}-${param.parameterId}`,
        triggerId: adaptTrigger.id,
        description: `Calculate ${param.name}: current ${param.baseParameterId} - previous ${param.baseParameterId}`,
        parameterId: param.parameterId,
        weight: 1.0,
      },
      update: {
        description: `Calculate ${param.name}: current ${param.baseParameterId} - previous ${param.baseParameterId}`,
      },
    });
  }

  // Goal calculation spec
  const goalSpec = await prisma.analysisSpec.upsert({
    where: { slug: "adapt-goal-progress" },
    create: {
      slug: "adapt-goal-progress",
      name: "Adaptation - Goal Progress",
      description: "Computes progress toward defined goals. Runs automatically after MEASURE specs.",
      outputType: "ADAPT",
      domain: "goals",
      priority: 101, // Run after deltas
      isActive: true,
      version: "1.0",
    },
    update: {
      name: "Adaptation - Goal Progress",
      description: "Computes progress toward defined goals. Runs automatically after MEASURE specs.",
      outputType: "ADAPT",
      priority: 101,
    },
  });
  console.log(`  + ${goalSpec.slug}: ${goalSpec.name}`);

  // =====================================
  // 4. ADAPT PROMPT SLUGS
  // =====================================
  console.log("\n4. Creating ADAPT PromptSlugs...");

  const adaptSlugs = [
    {
      slug: "engagement-recovery",
      name: "Engagement Recovery",
      description: "Fires when engagement has dropped - suggests re-engagement strategies",
      sourceType: "ADAPT" as const,
      parameterId: "engagement_delta",
      priority: 80,
      ranges: [
        {
          label: "Significant Drop",
          minValue: null,
          maxValue: -0.2,
          prompt: `ADAPTATION REQUIRED - ENGAGEMENT DROPPED

The user's engagement has noticeably decreased from our previous conversation.

Re-engagement strategies:
- Ask about something they previously showed interest in
- Acknowledge if you sense frustration or distraction
- Offer a brief, interesting tangent before returning to the main topic
- Use their name and reference previous positive moments
- Consider if the current topic is too complex or off-putting

Be genuinely curious about what might be different for them today.`,
          sortOrder: 0,
        },
        {
          label: "Slight Drop",
          minValue: -0.2,
          maxValue: -0.05,
          prompt: `NOTE: Engagement slightly lower than last time.

Subtle adjustments:
- Vary your communication style slightly
- Ask more open-ended questions
- Show genuine interest in their responses
- Don't over-explain - keep things concise`,
          sortOrder: 1,
        },
      ],
    },
    {
      slug: "engagement-reinforcement",
      name: "Engagement Reinforcement",
      description: "Fires when engagement has improved - reinforces what's working",
      sourceType: "ADAPT" as const,
      parameterId: "engagement_delta",
      priority: 70,
      ranges: [
        {
          label: "Significant Improvement",
          minValue: 0.2,
          maxValue: null,
          prompt: `POSITIVE SIGNAL - ENGAGEMENT IMPROVED

Whatever approach you're using is working well. The user is more engaged than in our previous conversation.

Reinforcement strategies:
- Continue with similar communication style
- Build on topics that are generating interest
- Match their energy level
- Look for opportunities to deepen the connection`,
          sortOrder: 0,
        },
        {
          label: "Slight Improvement",
          minValue: 0.05,
          maxValue: 0.2,
          prompt: `NOTE: Engagement trending upward - maintain current approach.`,
          sortOrder: 1,
        },
      ],
    },
    {
      slug: "mood-shift-response",
      name: "Mood Shift Response",
      description: "Adapts to changes in user mood between calls",
      sourceType: "ADAPT" as const,
      parameterId: "mood_delta",
      priority: 85,
      ranges: [
        {
          label: "Mood Declined",
          minValue: null,
          maxValue: -0.15,
          prompt: `ATTENTION: User's mood appears lower than previous conversation.

Approach adjustments:
- Be gentle and patient
- Avoid pushing too hard on difficult topics
- Acknowledge if they seem stressed without making assumptions
- Offer support without being overbearing
- Consider if external factors might be affecting them`,
          sortOrder: 0,
        },
        {
          label: "Mood Improved",
          minValue: 0.15,
          maxValue: null,
          prompt: `POSITIVE: User's mood has improved since last conversation.

- Match their more positive energy
- This may be a good time for more substantive discussions
- Build on the positive momentum`,
          sortOrder: 1,
        },
      ],
    },
    {
      slug: "rapport-building-push",
      name: "Rapport Building Push",
      description: "Fires when rapport goal needs more progress",
      sourceType: "ADAPT" as const,
      parameterId: "rapport_goal_progress",
      priority: 75,
      ranges: [
        {
          label: "Far from Goal",
          minValue: null,
          maxValue: 0.5,
          prompt: `GOAL FOCUS: Rapport building needed

Current rapport is below target. Focus on connection:
- Find common ground and shared interests
- Remember and reference past conversations
- Show genuine curiosity about their perspective
- Be authentic and consistent in your approach
- Build trust through reliability and follow-through`,
          sortOrder: 0,
        },
        {
          label: "Approaching Goal",
          minValue: 0.5,
          maxValue: 0.8,
          prompt: `PROGRESS: Rapport building on track

Good progress toward rapport goal. Continue:
- Deepening existing connection points
- Being consistent and reliable
- Showing you remember previous conversations`,
          sortOrder: 1,
        },
        {
          label: "Goal Achieved",
          minValue: 0.8,
          maxValue: null,
          prompt: `SUCCESS: Rapport goal achieved

Strong rapport established. Now:
- Maintain the relationship quality
- Don't take the connection for granted
- Look for opportunities to deepen further`,
          sortOrder: 2,
        },
      ],
    },
    {
      slug: "momentum-indicator",
      name: "Session Momentum Indicator",
      description: "Indicates overall trend direction over multiple calls",
      sourceType: "ADAPT" as const,
      parameterId: "session_momentum",
      priority: 60,
      ranges: [
        {
          label: "Negative Momentum",
          minValue: null,
          maxValue: -0.1,
          prompt: `TREND ALERT: Negative momentum detected

Engagement has been declining over recent conversations. Consider:
- Varying your approach more significantly
- Directly asking what would make conversations more valuable
- Checking if their needs or circumstances have changed
- Reviewing what worked well in earlier, more engaged conversations`,
          sortOrder: 0,
        },
        {
          label: "Positive Momentum",
          minValue: 0.1,
          maxValue: null,
          prompt: `TREND POSITIVE: Momentum building

Conversations are improving over time. You're on the right track.
Keep doing what's working while looking for opportunities to enhance further.`,
          sortOrder: 1,
        },
      ],
    },
  ];

  for (const slugData of adaptSlugs) {
    // Find or create the parameter link
    const existingParam = await prisma.parameter.findUnique({
      where: { parameterId: slugData.parameterId },
    });

    if (!existingParam) {
      console.log(`  ! Skipping ${slugData.slug} - parameter ${slugData.parameterId} not found`);
      continue;
    }

    // Create the slug
    const slug = await prisma.promptSlug.upsert({
      where: { slug: slugData.slug },
      create: {
        slug: slugData.slug,
        name: slugData.name,
        description: slugData.description,
        sourceType: slugData.sourceType,
        priority: slugData.priority,
        isActive: true,
      },
      update: {
        name: slugData.name,
        description: slugData.description,
        sourceType: slugData.sourceType,
        priority: slugData.priority,
      },
    });

    // Link to parameter
    await prisma.promptSlugParameter.upsert({
      where: {
        slugId_parameterId: {
          slugId: slug.id,
          parameterId: slugData.parameterId,
        },
      },
      create: {
        slugId: slug.id,
        parameterId: slugData.parameterId,
        weight: 1.0,
        mode: "DELTA",
      },
      update: {
        weight: 1.0,
        mode: "DELTA",
      },
    });

    // Delete existing ranges for clean update
    await prisma.promptSlugRange.deleteMany({
      where: { slugId: slug.id },
    });

    // Create ranges
    for (const range of slugData.ranges) {
      await prisma.promptSlugRange.create({
        data: {
          slugId: slug.id,
          label: range.label,
          minValue: range.minValue,
          maxValue: range.maxValue,
          prompt: range.prompt,
          sortOrder: range.sortOrder,
        },
      });
    }

    console.log(`  + ${slugData.slug}: ${slugData.ranges.length} ranges`);
  }

  // =====================================
  // 5. Update PromptStack to include ADAPT
  // =====================================
  console.log("\n5. Adding ADAPT to default PromptStack...");

  // Find the default published stack
  const defaultStack = await prisma.promptStack.findFirst({
    where: { isDefault: true, status: "PUBLISHED" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (defaultStack) {
    // Check if AUTO_SLUGS already exists for ADAPT
    const hasAdaptItem = defaultStack.items.some(
      (item) =>
        item.itemType === "AUTO_SLUGS" &&
        item.autoSlugSourceTypes?.includes("ADAPT")
    );

    if (!hasAdaptItem) {
      // Find AUTO_SLUGS item and update it to include ADAPT
      const autoSlugsItem = defaultStack.items.find((item) => item.itemType === "AUTO_SLUGS");

      if (autoSlugsItem) {
        const currentTypes = autoSlugsItem.autoSlugSourceTypes || ["PARAMETER", "COMPOSITE"];
        await prisma.promptStackItem.update({
          where: { id: autoSlugsItem.id },
          data: {
            autoSlugSourceTypes: [...currentTypes, "ADAPT"],
          },
        });
        console.log("  + Updated AUTO_SLUGS to include ADAPT source type");
      } else {
        // Add a new AUTO_SLUGS item for ADAPT
        const maxOrder = Math.max(...defaultStack.items.map((i) => i.sortOrder), 0);
        await prisma.promptStackItem.create({
          data: {
            stackId: defaultStack.id,
            itemType: "AUTO_SLUGS",
            autoSlugSourceTypes: ["ADAPT"],
            autoSlugOrderBy: "priority",
            isEnabled: true,
            sortOrder: maxOrder + 1,
          },
        });
        console.log("  + Added new AUTO_SLUGS item for ADAPT");
      }
    } else {
      console.log("  - ADAPT already included in stack");
    }
  } else {
    console.log("  ! No default published stack found");
  }

  console.log("\n=== ADAPT System Seeding Complete ===");
  console.log(`
Summary:
- ${adaptParameters.length} ADAPT parameters created
- ${goalParameters.length} GOAL parameters created
- 2 ADAPT Analysis Specs created
- ${adaptSlugs.length} ADAPT PromptSlugs with ranges created

Next steps:
1. Run analysis on a call to generate MEASURE scores
2. Run again on another call for the same user
3. ADAPT scores will be computed automatically
4. Generate prompt to see ADAPT slugs in action
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
