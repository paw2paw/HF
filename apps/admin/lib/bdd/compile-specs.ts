/**
 * BDD Spec Compiler - Auto-generate promptTemplate from spec structure
 *
 * This module generates LLM-ready promptTemplate strings from BDD spec JSON.
 * Instead of manually maintaining templates in seed-mabel.ts, the compiler
 * derives them from the spec structure.
 *
 * Spec types handled:
 * - IDENTITY: Who the agent is (role, name, traits, boundaries)
 * - CONTENT: What the agent knows/teaches (curriculum, case studies)
 * - ADAPT: How to adapt behavior (personality → behavior mappings)
 * - MEASURE: How to score calls (parameters, anchors)
 * - MEASURE_AGENT: How to evaluate agent behavior
 * - LEARN: What memories to extract
 * - VOICE: Voice-specific guidance
 *
 * Usage:
 *   import { compileSpecToTemplate } from "./compile-specs";
 *   const template = compileSpecToTemplate(specJson);
 */

import { JsonFeatureSpec, JsonParameter } from "./ai-parser";

export interface CompileResult {
  promptTemplate: string;
  sections: string[];
  warnings: string[];
}

/**
 * Compile a BDD spec JSON into a promptTemplate string
 */
export function compileSpecToTemplate(spec: JsonFeatureSpec): CompileResult {
  const warnings: string[] = [];
  const sections: string[] = [];

  // Route to appropriate compiler based on specRole and outputType
  const specRole = spec.specRole || "META";
  const outputType = spec.outputType || "MEASURE";

  let template = "";

  switch (specRole) {
    case "IDENTITY":
      template = compileIdentitySpec(spec, sections, warnings);
      break;
    case "CONTENT":
      template = compileContentSpec(spec, sections, warnings);
      break;
    default:
      // For META specs, route by outputType
      switch (outputType) {
        case "ADAPT":
          template = compileAdaptSpec(spec, sections, warnings);
          break;
        case "MEASURE":
          template = compileMeasureSpec(spec, sections, warnings);
          break;
        case "MEASURE_AGENT":
          template = compileMeasureAgentSpec(spec, sections, warnings);
          break;
        case "LEARN":
          template = compileLearnSpec(spec, sections, warnings);
          break;
        case "REWARD":
          template = compileRewardSpec(spec, sections, warnings);
          break;
        case "COMPOSE":
          template = compileComposeSpec(spec, sections, warnings);
          break;
        default:
          template = compileGenericSpec(spec, sections, warnings);
      }
  }

  return { promptTemplate: template, sections, warnings };
}

/**
 * Compile IDENTITY spec - defines WHO the agent is
 */
function compileIdentitySpec(
  spec: JsonFeatureSpec,
  sections: string[],
  warnings: string[]
): string {
  const lines: string[] = [];
  const title = spec.title.toUpperCase().replace(/\s+/g, " ");

  lines.push(`## ${title}`);
  lines.push("");

  // Extract identity config from parameters
  for (const param of spec.parameters) {
    const cfg = param.config || {};
    const paramName = param.name.toLowerCase();

    // Role/persona
    if (paramName.includes("role") || paramName.includes("persona") || paramName.includes("identity")) {
      if (cfg.role) {
        lines.push(`You are **${cfg.role}**.`);
        sections.push("role");
      }
      if (cfg.name) {
        lines.push(`Your name is **${cfg.name}**.`);
      }
      if (cfg.corePurpose) {
        lines.push("");
        lines.push(`### Core Purpose`);
        lines.push(cfg.corePurpose);
        sections.push("corePurpose");
      }
    }

    // Traits/characteristics
    if (paramName.includes("trait") || paramName.includes("characteristic") || paramName.includes("personality")) {
      const traits = cfg.traits || cfg.characteristics || [];
      if (traits.length > 0) {
        lines.push("");
        lines.push(`### Your Traits`);
        for (const trait of traits) {
          if (typeof trait === "string") {
            lines.push(`- ${trait}`);
          } else if (trait.name) {
            lines.push(`- **${trait.name}**: ${trait.description || ""}`);
          }
        }
        sections.push("traits");
      }
    }

    // Techniques/methods
    if (paramName.includes("technique") || paramName.includes("method") || paramName.includes("approach")) {
      const techniques = cfg.techniques || cfg.methods || [];
      if (techniques.length > 0) {
        lines.push("");
        lines.push(`### Techniques`);
        lines.push("Use these based on the situation:");
        for (const tech of techniques) {
          if (typeof tech === "string") {
            lines.push(`- ${tech}`);
          } else if (tech.name) {
            lines.push(`- **${tech.name}**: ${tech.description || tech.when || ""}`);
          }
        }
        sections.push("techniques");
      }
    }

    // Boundaries
    if (paramName.includes("boundar") || paramName.includes("limit") || paramName.includes("constraint")) {
      const dos = cfg.dos || cfg.youDo || [];
      const donts = cfg.donts || cfg.youDont || cfg.avoid || [];

      if (dos.length > 0 || donts.length > 0) {
        lines.push("");
        lines.push(`### Boundaries`);

        if (dos.length > 0) {
          lines.push("YOU DO:");
          for (const item of dos) {
            lines.push(`- ${item}`);
          }
        }

        if (donts.length > 0) {
          lines.push("");
          lines.push("YOU DO NOT:");
          for (const item of donts) {
            lines.push(`- ${item}`);
          }
        }
        sections.push("boundaries");
      }
    }

    // Response patterns
    if (paramName.includes("response") || paramName.includes("pattern") || paramName.includes("behavior")) {
      const patterns = cfg.responsePatterns || cfg.patterns || [];
      if (patterns.length > 0) {
        lines.push("");
        lines.push(`### Response Patterns`);
        for (const pattern of patterns) {
          if (typeof pattern === "string") {
            lines.push(`- ${pattern}`);
          } else if (pattern.situation) {
            lines.push(`- **${pattern.situation}**: ${pattern.response || pattern.action || ""}`);
          }
        }
        sections.push("responsePatterns");
      }
    }

    // Session structure
    if (paramName.includes("session") || paramName.includes("structure") || paramName.includes("flow")) {
      const structure = cfg.sessionStructure || cfg;
      if (structure.opening || structure.closing || structure.phases) {
        lines.push("");
        lines.push(`### Session Structure`);
        if (structure.opening?.instruction) {
          lines.push(`**Opening**: ${structure.opening.instruction}`);
        }
        if (structure.phases && Array.isArray(structure.phases)) {
          for (const phase of structure.phases) {
            if (phase.name) {
              lines.push(`**${phase.name}**: ${phase.description || phase.instruction || ""}`);
            }
          }
        }
        if (structure.closing?.instruction) {
          lines.push(`**Closing**: ${structure.closing.instruction}`);
        }
        sections.push("sessionStructure");
      }
    }
  }

  // Add prompt guidance from parameters
  const guidance = extractPromptGuidance(spec.parameters);
  if (guidance) {
    lines.push("");
    lines.push(guidance);
    sections.push("promptGuidance");
  }

  if (lines.length <= 2) {
    warnings.push("IDENTITY spec has no extractable config - using generic template");
    lines.push(`This is ${spec.title}.`);
    lines.push("");
    lines.push(spec.story.iWant);
  }

  return lines.join("\n");
}

/**
 * Compile CONTENT spec - defines WHAT the agent knows/teaches
 */
function compileContentSpec(
  spec: JsonFeatureSpec,
  sections: string[],
  warnings: string[]
): string {
  const lines: string[] = [];
  const title = spec.title.toUpperCase().replace(/\s+/g, " ");

  lines.push(`## ${title}`);
  lines.push("");

  // Extract content config from parameters
  for (const param of spec.parameters) {
    const cfg = param.config || {};
    const paramName = param.name.toLowerCase();

    // Source metadata
    if (paramName.includes("source") || paramName.includes("metadata")) {
      if (cfg.title) {
        lines.push(`### Source: ${cfg.title}`);
        if (cfg.authors && cfg.authors.length > 0) {
          lines.push(`By ${cfg.authors.join(", ")}${cfg.year ? ` (${cfg.year})` : ""}`);
        }
        if (cfg.notableInfo) {
          lines.push("");
          lines.push(`*${cfg.notableInfo}*`);
        }
        lines.push("");
        sections.push("sourceMetadata");
      }
    }

    // Core argument/thesis
    if (paramName.includes("argument") || paramName.includes("thesis") || paramName.includes("core")) {
      if (cfg.mainThesis || cfg.thesis) {
        lines.push(`### Core Argument`);
        lines.push(cfg.mainThesis || cfg.thesis);
        lines.push("");
        sections.push("coreArgument");
      }
      if (cfg.supportingPoints && Array.isArray(cfg.supportingPoints)) {
        lines.push("**Key Points:**");
        for (const point of cfg.supportingPoints) {
          lines.push(`- ${point}`);
        }
        lines.push("");
      }
    }

    // Case studies
    if (paramName.includes("case") || paramName.includes("example") || paramName.includes("stud")) {
      const studies = cfg.studies || cfg.cases || cfg.examples || [];
      if (studies.length > 0) {
        lines.push(`### Case Studies`);
        for (const study of studies) {
          if (typeof study === "string") {
            lines.push(`- ${study}`);
          } else if (study.name) {
            lines.push(`- **${study.name}**: ${study.description || study.lesson || ""}`);
          }
        }
        lines.push("");
        sections.push("caseStudies");
      }
    }

    // Discussion questions
    if (paramName.includes("discussion") || paramName.includes("question")) {
      const questions = cfg.questions || [];
      if (questions.length > 0) {
        lines.push(`### Discussion Questions`);
        for (const q of questions) {
          lines.push(`- ${q}`);
        }
        lines.push("");
        sections.push("discussionQuestions");
      }
    }

    // Critiques
    if (paramName.includes("critique") || paramName.includes("criticism") || paramName.includes("limitation")) {
      const critiques = cfg.critiques || cfg.limitations || [];
      if (critiques.length > 0) {
        lines.push(`### Critiques & Limitations`);
        for (const c of critiques) {
          if (typeof c === "string") {
            lines.push(`- ${c}`);
          } else if (c.point) {
            lines.push(`- **${c.point}**: ${c.response || c.note || ""}`);
          }
        }
        lines.push("");
        sections.push("critiques");
      }
    }

    // Modules/curriculum
    if (paramName.includes("module") || paramName.includes("curriculum") || paramName.includes("lesson")) {
      const modules = cfg.modules || cfg.lessons || [];
      if (modules.length > 0) {
        lines.push(`### Curriculum Modules`);
        for (let i = 0; i < modules.length; i++) {
          const m = modules[i];
          if (typeof m === "string") {
            lines.push(`${i + 1}. ${m}`);
          } else if (m.name || m.title) {
            lines.push(`${i + 1}. **${m.name || m.title}**: ${m.description || m.objective || ""}`);
          }
        }
        lines.push("");
        sections.push("modules");
      }
    }
  }

  if (lines.length <= 2) {
    warnings.push("CONTENT spec has no extractable config - using story");
    lines.push(spec.story.iWant);
    lines.push("");
    lines.push(spec.story.soThat);
  }

  return lines.join("\n");
}

/**
 * Compile ADAPT spec - defines behavior adaptations
 */
function compileAdaptSpec(
  spec: JsonFeatureSpec,
  sections: string[],
  warnings: string[]
): string {
  const lines: string[] = [];
  const title = spec.title.toUpperCase().replace(/\s+/g, " ");

  lines.push(`## ${title}`);
  lines.push("");
  lines.push(spec.story.soThat);
  lines.push("");

  // Extract adaptation parameters
  for (const param of spec.parameters) {
    const guidance = param.promptGuidance;
    if (!guidance) continue;

    lines.push(`### ${param.name}`);
    lines.push(param.description);
    lines.push("");

    // Add interpretation scale
    if (param.interpretationScale && param.interpretationScale.length > 0) {
      for (const range of param.interpretationScale) {
        lines.push(`- **${range.label}** (${range.min}-${range.max}): ${range.implication || ""}`);
      }
      lines.push("");
    }

    // Add guidance
    if (guidance.whenHigh) {
      lines.push(`**When High**: ${guidance.whenHigh}`);
    }
    if (guidance.whenLow) {
      lines.push(`**When Low**: ${guidance.whenLow}`);
    }
    lines.push("");
    sections.push(param.id);
  }

  // Extract triggers
  const specTriggers = (spec as any).triggers || [];
  if (specTriggers.length > 0) {
    lines.push(`### Adaptation Triggers`);
    for (const trigger of specTriggers) {
      lines.push(`- **${trigger.name || "Trigger"}**: ${trigger.then}`);
      if (trigger.parameterId && trigger.targetValue !== undefined) {
        lines.push(`  → Set ${trigger.parameterId} to ${trigger.targetValue}`);
      }
    }
    sections.push("triggers");
  }

  return lines.join("\n");
}

/**
 * Compile MEASURE spec - defines how to score calls
 */
function compileMeasureSpec(
  spec: JsonFeatureSpec,
  sections: string[],
  warnings: string[]
): string {
  const lines: string[] = [];
  const title = spec.title.toUpperCase().replace(/\s+/g, " ");

  lines.push(`## ${title}`);
  lines.push("");

  // Story context
  lines.push(`*${spec.story.soThat}*`);
  lines.push("");

  // Parameters with scoring guidance
  for (const param of spec.parameters) {
    lines.push(`### ${param.name}`);
    lines.push(param.description);
    lines.push("");

    // Target range
    if (param.targetRange) {
      lines.push(`**Scale**: ${param.targetRange.min} - ${param.targetRange.max}`);
    }

    // Interpretation scale
    if (param.interpretationScale && param.interpretationScale.length > 0) {
      lines.push("");
      lines.push("**Interpretation:**");
      for (const range of param.interpretationScale) {
        lines.push(`- ${range.label} (${range.min}-${range.max}): ${range.implication || ""}`);
      }
    }

    // Scoring anchors (calibration examples)
    if (param.scoringAnchors && param.scoringAnchors.length > 0) {
      lines.push("");
      lines.push("**Calibration Examples:**");
      for (const anchor of param.scoringAnchors) {
        lines.push(`- Score ${anchor.score}: "${anchor.example.substring(0, 100)}${anchor.example.length > 100 ? "..." : ""}"`);
        if (anchor.rationale) {
          lines.push(`  *${anchor.rationale}*`);
        }
      }
    }

    // Prompt guidance
    const guidance = param.promptGuidance;
    if (guidance) {
      lines.push("");
      if (guidance.whenHigh) lines.push(`**High Score Guidance**: ${guidance.whenHigh}`);
      if (guidance.whenLow) lines.push(`**Low Score Guidance**: ${guidance.whenLow}`);
    }

    lines.push("");
    sections.push(param.id);
  }

  return lines.join("\n");
}

/**
 * Compile MEASURE_AGENT spec - defines how to evaluate agent behavior
 */
function compileMeasureAgentSpec(
  spec: JsonFeatureSpec,
  sections: string[],
  warnings: string[]
): string {
  const lines: string[] = [];
  const title = spec.title.toUpperCase().replace(/\s+/g, " ");

  lines.push(`## ${title}`);
  lines.push("");
  lines.push(`*Evaluating agent responses against targets*`);
  lines.push("");

  for (const param of spec.parameters) {
    lines.push(`### ${param.name}`);
    lines.push(param.description);
    lines.push("");

    // Interpretation
    if (param.interpretationScale) {
      for (const range of param.interpretationScale) {
        lines.push(`- **${range.label}**: ${range.implication || ""}`);
      }
    }

    const guidance = param.promptGuidance;
    if (guidance) {
      if (guidance.whenHigh) lines.push(`**When High**: ${guidance.whenHigh}`);
      if (guidance.whenLow) lines.push(`**When Low**: ${guidance.whenLow}`);
    }
    lines.push("");
    sections.push(param.id);
  }

  return lines.join("\n");
}

/**
 * Compile LEARN spec - defines memory extraction
 */
function compileLearnSpec(
  spec: JsonFeatureSpec,
  sections: string[],
  warnings: string[]
): string {
  const lines: string[] = [];
  const title = spec.title.toUpperCase().replace(/\s+/g, " ");

  lines.push(`## ${title}`);
  lines.push("");
  lines.push(`*${spec.story.soThat}*`);
  lines.push("");

  // Constraints first (important for memory extraction)
  if (spec.constraints && spec.constraints.length > 0) {
    lines.push(`### Constraints`);
    for (const c of spec.constraints) {
      const severity = c.severity === "critical" ? "⚠️" : "ℹ️";
      lines.push(`${severity} ${c.description}`);
    }
    lines.push("");
    sections.push("constraints");
  }

  // Memory types
  for (const param of spec.parameters) {
    lines.push(`### ${param.name}`);
    lines.push(param.description);
    lines.push("");

    // Sub-metrics (what to look for)
    if (param.subMetrics && param.subMetrics.length > 0) {
      lines.push("**Components:**");
      for (const sm of param.subMetrics) {
        lines.push(`- **${sm.name}** (${Math.round(sm.weight * 100)}%): ${sm.description || ""}`);
        if (sm.definitions) {
          if (sm.definitions.high) lines.push(`  - High: ${sm.definitions.high}`);
          if (sm.definitions.low) lines.push(`  - Low: ${sm.definitions.low}`);
        }
      }
      lines.push("");
    }

    // Scoring anchors
    if (param.scoringAnchors && param.scoringAnchors.length > 0) {
      lines.push("**Examples:**");
      for (const anchor of param.scoringAnchors) {
        lines.push(`- (${anchor.score}): "${anchor.example.substring(0, 80)}..."`);
      }
      lines.push("");
    }

    const guidance = param.promptGuidance;
    if (guidance) {
      if (guidance.whenHigh) lines.push(`**High Quality**: ${guidance.whenHigh}`);
      if (guidance.whenLow) lines.push(`**Low Quality**: ${guidance.whenLow}`);
    }
    lines.push("");
    sections.push(param.id);
  }

  return lines.join("\n");
}

/**
 * Compile REWARD spec
 */
function compileRewardSpec(
  spec: JsonFeatureSpec,
  sections: string[],
  warnings: string[]
): string {
  const lines: string[] = [];
  lines.push(`## ${spec.title.toUpperCase()}`);
  lines.push("");
  lines.push(`*${spec.story.soThat}*`);
  lines.push("");

  for (const param of spec.parameters) {
    lines.push(`### ${param.name}`);
    lines.push(param.description);
    if (param.formula) {
      lines.push(`**Formula**: \`${param.formula}\``);
    }
    lines.push("");
    sections.push(param.id);
  }

  return lines.join("\n");
}

/**
 * Compile COMPOSE spec
 */
function compileComposeSpec(
  spec: JsonFeatureSpec,
  sections: string[],
  warnings: string[]
): string {
  const lines: string[] = [];
  lines.push(`## ${spec.title.toUpperCase()}`);
  lines.push("");
  lines.push(`*${spec.story.soThat}*`);
  lines.push("");

  // Composition steps from parameters
  for (const param of spec.parameters) {
    lines.push(`### ${param.name}`);
    lines.push(param.description);
    lines.push("");
    sections.push(param.id);
  }

  return lines.join("\n");
}

/**
 * Compile generic spec (fallback)
 */
function compileGenericSpec(
  spec: JsonFeatureSpec,
  sections: string[],
  warnings: string[]
): string {
  const lines: string[] = [];
  lines.push(`## ${spec.title.toUpperCase()}`);
  lines.push("");
  lines.push(`As ${spec.story.asA}, ${spec.story.iWant.toLowerCase()} so that ${spec.story.soThat.toLowerCase()}.`);
  lines.push("");

  for (const param of spec.parameters) {
    lines.push(`### ${param.name}`);
    lines.push(param.description);

    const guidance = param.promptGuidance;
    if (guidance) {
      if (guidance.whenHigh) lines.push(`- **High**: ${guidance.whenHigh}`);
      if (guidance.whenLow) lines.push(`- **Low**: ${guidance.whenLow}`);
    }
    lines.push("");
    sections.push(param.id);
  }

  warnings.push(`Using generic template for ${spec.outputType || "unknown"} spec`);
  return lines.join("\n");
}

/**
 * Extract promptGuidance sections from parameters
 */
function extractPromptGuidance(parameters: JsonParameter[]): string | null {
  const guidance: string[] = [];

  for (const param of parameters) {
    if (!param.promptGuidance) continue;

    const pg = param.promptGuidance;
    if (pg.whenHigh || pg.whenLow) {
      guidance.push(`**${param.name}**:`);
      if (pg.whenHigh) guidance.push(`- High: ${pg.whenHigh}`);
      if (pg.whenLow) guidance.push(`- Low: ${pg.whenLow}`);
      guidance.push("");
    }
  }

  return guidance.length > 0 ? guidance.join("\n") : null;
}

/**
 * Batch compile all specs and return a map of specId → promptTemplate
 */
export function compileAllSpecs(
  specs: JsonFeatureSpec[]
): Map<string, CompileResult> {
  const results = new Map<string, CompileResult>();

  for (const spec of specs) {
    const result = compileSpecToTemplate(spec);
    results.set(spec.id, result);
  }

  return results;
}
