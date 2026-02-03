/**
 * Scoring Spec Generator
 *
 * Takes compiled BDD feature data and generates a structured scoring specification
 * that can be used directly as an LLM prompt for transcript analysis.
 */

export interface ScoringSpec {
  version: string;
  featureId: string;
  name: string;
  description?: string;

  // The full instruction block for the LLM
  instruction: string;

  // Individual parameter specs for targeted scoring
  parameterSpecs: ParameterSpec[];

  // Output schema for the LLM to follow
  outputSchema: OutputSchema;

  // Metadata for validation
  metadata: {
    parameterCount: number;
    constraintCount: number;
    generatedAt: string;
  };
}

export interface ParameterSpec {
  id: string;
  name: string;
  description: string;
  targetRange: { min: number; max: number } | null;
  formula: string;
  submetrics: SubmetricSpec[];
  interpretationScale: { min: number; max: number; label: string; action?: string }[];
}

export interface SubmetricSpec {
  id: string;
  name: string;
  weight: number;
  description: string;
  formula: string;
  inputs: string[];
}

export interface OutputSchema {
  type: "object";
  properties: Record<string, any>;
  required: string[];
}

/**
 * Generate a complete scoring specification from compiled feature data
 */
export function generateScoringSpec(featureSet: any): ScoringSpec {
  const parameters = featureSet.parameters || [];
  const constraints = featureSet.constraints || [];

  // Build parameter specs
  const parameterSpecs: ParameterSpec[] = parameters.map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.definition || p.description || "",
    targetRange: p.targetRange || null,
    formula: p.formula || "",
    submetrics: (p.submetrics || []).map((sm: any) => ({
      id: sm.id,
      name: sm.name,
      weight: sm.weight,
      description: sm.description || "",
      formula: sm.formula || "",
      inputs: (sm.inputs || []).map((i: any) => i.name),
    })),
    interpretationScale: (p.interpretationScale || []).map((r: any) => ({
      min: r.min,
      max: r.max,
      label: r.label,
      action: r.implication || r.action,
    })),
  }));

  // Generate the main instruction block
  const instruction = generateInstruction(featureSet.name, featureSet.description, parameterSpecs, constraints);

  // Generate output schema
  const outputSchema = generateOutputSchema(parameterSpecs);

  return {
    version: featureSet.version || "1.0",
    featureId: featureSet.featureId,
    name: featureSet.name,
    description: featureSet.description,
    instruction,
    parameterSpecs,
    outputSchema,
    metadata: {
      parameterCount: parameters.length,
      constraintCount: constraints.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

function generateInstruction(
  name: string,
  description: string | undefined,
  parameters: ParameterSpec[],
  constraints: any[]
): string {
  const lines: string[] = [];

  lines.push(`# Scoring Specification: ${name}`);
  lines.push("");

  if (description) {
    lines.push(`## Context`);
    lines.push(description);
    lines.push("");
  }

  lines.push(`## Task`);
  lines.push(`Analyze the provided transcript and calculate scores for each parameter defined below.`);
  lines.push(`For each parameter, calculate the component submetrics first, then combine using the weighted formula.`);
  lines.push("");

  // Constraints section
  if (constraints.length > 0) {
    lines.push(`## Constraints`);
    lines.push(`The following constraints must be checked. If violated, flag in the output.`);
    lines.push("");
    for (const c of constraints) {
      const severity = c.severity === "critical" ? "🔴 CRITICAL" : "🟡 WARNING";
      lines.push(`- **${c.id}** [${severity}]: ${c.description}`);
    }
    lines.push("");
  }

  // Parameters section
  lines.push(`## Parameters to Score`);
  lines.push("");

  for (const param of parameters) {
    lines.push(`### ${param.id}: ${param.name}`);
    lines.push("");
    lines.push(`**Description:** ${param.description}`);
    lines.push("");

    if (param.targetRange) {
      lines.push(`**Target Range:** ${param.targetRange.min} - ${param.targetRange.max}`);
      lines.push("");
    }

    if (param.formula) {
      lines.push(`**Formula:**`);
      lines.push("```");
      lines.push(param.formula);
      lines.push("```");
      lines.push("");
    }

    if (param.submetrics.length > 0) {
      lines.push(`**Submetrics:**`);
      lines.push("");
      for (const sm of param.submetrics) {
        lines.push(`#### ${sm.id}: ${sm.name} (weight: ${sm.weight})`);
        if (sm.description) {
          lines.push(sm.description);
        }
        if (sm.formula) {
          lines.push(`Formula: \`${sm.formula}\``);
        }
        if (sm.inputs.length > 0) {
          lines.push(`Inputs: ${sm.inputs.join(", ")}`);
        }
        lines.push("");
      }
    }

    if (param.interpretationScale.length > 0) {
      lines.push(`**Interpretation Scale:**`);
      lines.push("| Range | Label | Action |");
      lines.push("|-------|-------|--------|");
      for (const scale of param.interpretationScale) {
        lines.push(`| ${scale.min} - ${scale.max} | ${scale.label} | ${scale.action || "-"} |`);
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  // Output format section
  lines.push(`## Output Format`);
  lines.push("");
  lines.push(`Return a JSON object with the following structure:`);
  lines.push("```json");
  lines.push(`{`);
  lines.push(`  "scores": {`);
  for (let i = 0; i < parameters.length; i++) {
    const p = parameters[i];
    const comma = i < parameters.length - 1 ? "," : "";
    lines.push(`    "${p.id}": {`);
    lines.push(`      "value": <number 0-1>,`);
    lines.push(`      "interpretation": "<label from scale>",`);
    lines.push(`      "submetrics": {`);
    for (let j = 0; j < p.submetrics.length; j++) {
      const sm = p.submetrics[j];
      const smComma = j < p.submetrics.length - 1 ? "," : "";
      lines.push(`        "${sm.id}": <number 0-1>${smComma}`);
    }
    lines.push(`      },`);
    lines.push(`      "reasoning": "<brief explanation>"`);
    lines.push(`    }${comma}`);
  }
  lines.push(`  },`);
  lines.push(`  "constraintViolations": [<list of violated constraint IDs>],`);
  lines.push(`  "overallAssessment": "<summary>",`);
  lines.push(`  "recommendations": [<list of action items>]`);
  lines.push(`}`);
  lines.push("```");

  return lines.join("\n");
}

function generateOutputSchema(parameters: ParameterSpec[]): OutputSchema {
  const scoreProperties: Record<string, any> = {};

  for (const p of parameters) {
    const submetricProps: Record<string, any> = {};
    for (const sm of p.submetrics) {
      submetricProps[sm.id] = { type: "number", minimum: 0, maximum: 1 };
    }

    scoreProperties[p.id] = {
      type: "object",
      properties: {
        value: { type: "number", minimum: 0, maximum: 1 },
        interpretation: { type: "string" },
        submetrics: {
          type: "object",
          properties: submetricProps,
        },
        reasoning: { type: "string" },
      },
      required: ["value", "interpretation", "submetrics", "reasoning"],
    };
  }

  return {
    type: "object",
    properties: {
      scores: {
        type: "object",
        properties: scoreProperties,
        required: parameters.map((p) => p.id),
      },
      constraintViolations: {
        type: "array",
        items: { type: "string" },
      },
      overallAssessment: { type: "string" },
      recommendations: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["scores", "constraintViolations", "overallAssessment", "recommendations"],
  };
}

/**
 * Generate a compact scoring prompt for a single parameter
 */
export function generateParameterPrompt(paramSpec: ParameterSpec): string {
  const lines: string[] = [];

  lines.push(`# Score: ${paramSpec.id} (${paramSpec.name})`);
  lines.push("");
  lines.push(paramSpec.description);
  lines.push("");

  if (paramSpec.targetRange) {
    lines.push(`Target: ${paramSpec.targetRange.min} - ${paramSpec.targetRange.max}`);
  }

  if (paramSpec.formula) {
    lines.push(`Formula: ${paramSpec.formula}`);
  }
  lines.push("");

  if (paramSpec.submetrics.length > 0) {
    lines.push("## Submetrics");
    for (const sm of paramSpec.submetrics) {
      lines.push(`- **${sm.name}** (weight ${sm.weight}): ${sm.description}`);
      if (sm.formula) lines.push(`  Formula: ${sm.formula}`);
    }
  }
  lines.push("");

  lines.push("Return: { value: 0-1, interpretation: string, submetrics: {...}, reasoning: string }");

  return lines.join("\n");
}
