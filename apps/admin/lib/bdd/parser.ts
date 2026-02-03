/**
 * BDD XML Parser
 *
 * Parses BDD story specs and parameter measurement specs from XML format.
 *
 * Supported formats:
 * - *.bdd.xml: Story specs with acceptance criteria and Gherkin scenarios
 * - *.param.xml: Parameter measurement guides with formulas
 */

export type ParsedBDD = {
  storyId?: string;
  parameterIds: string[];
  name?: string;
  version?: string;
  description?: string;
  story?: ParsedStory;
  parameters?: ParsedParameter[];
};

export type ParsedStory = {
  id: string;
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  timeWindow?: {
    name: string;
    start?: string;
    end?: string;
    exclusions?: string[];
  };
  acceptanceCriteria: AcceptanceCriterion[];
  scenarios: GherkinScenario[];
  constraints: Constraint[];
  failureConditions: FailureCondition[];
};

export type AcceptanceCriterion = {
  id: string;
  title?: string;
  given: string;
  when: string;
  then: string;
  reason?: string;
  parameters?: string[];
  thresholds?: Record<string, ThresholdDef>;
  gherkin?: string;
};

export type ThresholdDef = {
  value: string | number;
  operator?: string;
  basis?: string;
  parameter?: string;
};

export type Constraint = {
  id: string;
  type?: string;
  description: string;
  threshold?: string | number;
  severity?: "critical" | "warning";
};

export type FailureCondition = {
  id: string;
  severity: string;
  trigger: string;
  threshold?: { operator: string; value: number };
  implication?: string;
  action?: string;
};

export type GherkinScenario = {
  name: string;
  tags?: string[];
  given: string[];
  when: string[];
  then: string[];
};

export type ParsedParameter = {
  id: string;
  name: string;
  definition?: string;
  formula?: string;
  targetRange?: { min: number; max: number };
  components?: ParameterComponent[];
  submetrics?: Submetric[];
  thresholds?: Record<string, ThresholdDef>;
  constraints?: Constraint[];
  promptGuidance?: string;
  interpretationScale?: InterpretationRange[];
  workedExample?: WorkedExample;
};

export type Submetric = {
  id: string;
  name: string;
  weight: number;
  description?: string;
  formula?: string;
  inputs?: { name: string; source: string; required: boolean; description?: string }[];
  thresholds?: Record<string, ThresholdDef>;
  definitions?: Record<string, string>;
  assumptions?: string[];
};

export type InterpretationRange = {
  min: number;
  max: number;
  label: string;
  implication?: string;
};

export type ParameterComponent = {
  id: string;
  name: string;
  weight?: number;
  definition?: string;
};

export type WorkedExample = {
  description?: string;
  inputs: Record<string, string | number>;
  steps: { submetric: string; formula: string; result: string }[];
  finalResult: { value: string; interpretation: string };
};

/**
 * Parse BDD XML content
 */
export function parseBDDXml(xmlContent: string, fileType: "STORY" | "PARAMETER"): ParsedBDD {
  const result: ParsedBDD = {
    parameterIds: [],
  };

  if (fileType === "STORY") {
    result.story = parseStoryXml(xmlContent);
    result.storyId = result.story.id;
    result.name = result.story.title;

    // Extract parameter references
    const paramRefs = extractParameterRefs(xmlContent);
    result.parameterIds = paramRefs;
  } else {
    result.parameters = parseParameterXml(xmlContent);
    result.parameterIds = result.parameters.map((p) => p.id);

    // Get name from guide metadata or first parameter
    const titleMatch = xmlContent.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      result.name = titleMatch[1];
    } else if (result.parameters.length > 0) {
      result.name = `Parameters: ${result.parameters.map(p => p.id).join(", ")}`;
    }
  }

  // Extract version
  const versionMatch = xmlContent.match(/version=["']([^"']+)["']/);
  if (versionMatch) {
    result.version = versionMatch[1];
  }

  return result;
}

/**
 * Parse a BDD story XML (your format: <bdd_story>)
 */
function parseStoryXml(xml: string): ParsedStory {
  // Extract story ID from <bdd_story id="...">
  const idMatch = xml.match(/<bdd_story[^>]*id=["']([^"']+)["']/);
  const id = idMatch?.[1] || generateId("STORY");

  // Extract title from <title> in metadata
  const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch?.[1] || "Untitled Story";

  // Extract user story parts from <user_story>
  const userStoryMatch = xml.match(/<user_story>([\s\S]*?)<\/user_story>/);
  let asA = "", iWant = "", soThat = "";
  if (userStoryMatch) {
    const usContent = userStoryMatch[1];
    const asAMatch = usContent.match(/<as_a>([^<]+)<\/as_a>/);
    const iWantMatch = usContent.match(/<i_want>([^<]+)<\/i_want>/);
    const soThatMatch = usContent.match(/<so_that>([^<]+)<\/so_that>/);
    asA = asAMatch?.[1] || "";
    iWant = iWantMatch?.[1] || "";
    soThat = soThatMatch?.[1] || "";
  }

  // Extract time window from <time_window_definition>
  let timeWindow;
  const timeWindowMatch = xml.match(/<time_window_definition>([\s\S]*?)<\/time_window_definition>/);
  if (timeWindowMatch) {
    const twContent = timeWindowMatch[1];
    const nameMatch = twContent.match(/<name>([^<]+)<\/name>/);
    const startMatch = twContent.match(/<start_condition>([^<]+)<\/start_condition>/);
    const endMatch = twContent.match(/<end_condition>([^<]+)<\/end_condition>/);
    const exclusionsMatch = twContent.matchAll(/<exclusion>([^<]+)<\/exclusion>/g);
    const exclusions = Array.from(exclusionsMatch, (m) => m[1]);

    timeWindow = {
      name: nameMatch?.[1] || "default",
      start: startMatch?.[1],
      end: endMatch?.[1],
      exclusions: exclusions.length > 0 ? exclusions : undefined,
    };
  }

  // Extract acceptance criteria from <ac id="...">
  const acceptanceCriteria: AcceptanceCriterion[] = [];
  const acMatches = xml.matchAll(/<ac\s+id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/ac>/g);
  for (const match of acMatches) {
    const acContent = match[2];
    const titleMatch = acContent.match(/<title>([^<]+)<\/title>/);
    const givenMatch = acContent.match(/<given>([^<]+)<\/given>/);
    const whenMatch = acContent.match(/<when>([^<]+)<\/when>/);
    const thenMatch = acContent.match(/<then>([\s\S]*?)<\/then>/);
    const reasonMatch = acContent.match(/<reason>([\s\S]*?)<\/reason>/);
    const paramsMatch = acContent.match(/<parameters>([^<]+)<\/parameters>/);
    const gherkinMatch = acContent.match(/<gherkin>([\s\S]*?)<\/gherkin>/);

    // Extract thresholds
    const thresholds: Record<string, ThresholdDef> = {};
    const thresholdMatches = acContent.matchAll(/<threshold\s+name=["']([^"']+)["']([^>]*)>([^<]*)<\/threshold>/g);
    for (const tm of thresholdMatches) {
      const name = tm[1];
      const attrs = tm[2];
      const value = tm[3].trim();

      const operatorMatch = attrs.match(/operator=["']([^"']+)["']/);
      const basisMatch = attrs.match(/basis=["']([^"']+)["']/);
      const paramMatch = attrs.match(/parameter=["']([^"']+)["']/);

      thresholds[name] = {
        value: isNaN(Number(value)) ? value : Number(value),
        operator: operatorMatch?.[1],
        basis: basisMatch?.[1],
        parameter: paramMatch?.[1],
      };
    }

    acceptanceCriteria.push({
      id: match[1],
      title: titleMatch?.[1],
      given: givenMatch?.[1] || "",
      when: whenMatch?.[1] || "",
      then: thenMatch?.[1]?.trim() || "",
      reason: reasonMatch?.[1]?.trim(),
      parameters: paramsMatch?.[1]?.split(/[,\s]+/).filter(Boolean),
      thresholds: Object.keys(thresholds).length > 0 ? thresholds : undefined,
      gherkin: gherkinMatch?.[1]?.trim(),
    });
  }

  // Extract Gherkin scenarios from acceptance criteria gherkin blocks
  const scenarios: GherkinScenario[] = [];
  for (const ac of acceptanceCriteria) {
    if (ac.gherkin) {
      const scenarioMatches = ac.gherkin.matchAll(/Scenario(?:\s+Outline)?:\s*([^\n]+)([\s\S]*?)(?=Scenario|$)/g);
      for (const sm of scenarioMatches) {
        const name = sm[1].trim();
        const content = sm[2];

        const givenSteps = Array.from(content.matchAll(/Given\s+(.+?)(?=\n\s*(?:And|When|Then|$))/g), m => m[1].trim());
        const andGivenSteps = Array.from(content.matchAll(/(?<=Given.+\n(?:\s*And\s+.+\n)*)\s*And\s+(.+?)(?=\n)/g), m => m[1].trim());
        const whenSteps = Array.from(content.matchAll(/When\s+(.+?)(?=\n\s*(?:And|Then|$))/g), m => m[1].trim());
        const thenSteps = Array.from(content.matchAll(/Then\s+(.+?)(?=\n\s*(?:And|Examples|Scenario|$))/g), m => m[1].trim());
        const andThenSteps = Array.from(content.matchAll(/(?<=Then.+\n(?:\s*And\s+.+\n)*)\s*And\s+(.+?)(?=\n)/g), m => m[1].trim());

        scenarios.push({
          name,
          given: [...givenSteps, ...andGivenSteps],
          when: whenSteps,
          then: [...thenSteps, ...andThenSteps],
        });
      }
    }
  }

  // Extract constraints from <constraints>
  const constraints: Constraint[] = [];
  const constraintsMatch = xml.match(/<constraints>([\s\S]*?)<\/constraints>/);
  if (constraintsMatch) {
    const constraintMatches = constraintsMatch[1].matchAll(/<constraint\s+id=["']([^"']+)["']\s+type=["']([^"']+)["'][^>]*>([\s\S]*?)<\/constraint>/g);
    for (const cm of constraintMatches) {
      constraints.push({
        id: cm[1],
        type: cm[2],
        description: cm[3].trim(),
      });
    }
  }

  // Extract failure conditions
  const failureConditions: FailureCondition[] = [];
  const failureMatch = xml.match(/<failure_conditions>([\s\S]*?)<\/failure_conditions>/);
  if (failureMatch) {
    const condMatches = failureMatch[1].matchAll(/<condition\s+id=["']([^"']+)["']\s+severity=["']([^"']+)["'][^>]*>([\s\S]*?)<\/condition>/g);
    for (const cm of condMatches) {
      const content = cm[3];
      const triggerMatch = content.match(/<trigger>([^<]+)<\/trigger>/);
      const threshMatch = content.match(/<threshold\s+operator=["']([^"']+)["']\s+value=["']([^"']+)["']/);
      const implMatch = content.match(/<implication>([^<]+)<\/implication>/);
      const actionMatch = content.match(/<action>([^<]+)<\/action>/);

      failureConditions.push({
        id: cm[1],
        severity: cm[2],
        trigger: triggerMatch?.[1] || "",
        threshold: threshMatch ? { operator: threshMatch[1], value: parseFloat(threshMatch[2]) } : undefined,
        implication: implMatch?.[1],
        action: actionMatch?.[1],
      });
    }
  }

  return {
    id,
    title,
    asA,
    iWant,
    soThat,
    timeWindow,
    acceptanceCriteria,
    scenarios,
    constraints,
    failureConditions,
  };
}

/**
 * Extract balanced XML tag blocks from content
 * Handles nested tags of the same name by counting open/close tags
 * Excludes self-closing tags (e.g., <parameter id="..." />)
 */
function extractBalancedTags(xml: string, tagName: string): string[] {
  const results: string[] = [];
  // Match opening tag with id attribute that is NOT self-closing
  // Self-closing tags end with /> and should be skipped
  const openTagRegex = new RegExp(`<${tagName}\\s+id=["'][^"']+["'][^>]*(?<!/)>`, "g");
  const closeTag = `</${tagName}>`;

  let match;
  while ((match = openTagRegex.exec(xml)) !== null) {
    // Skip if this is inside <parameter_summary> - those are self-closing references
    const before = xml.substring(Math.max(0, match.index - 100), match.index);
    if (before.includes("<parameter_summary>") && !before.includes("</parameter_summary>")) {
      continue;
    }

    const startIndex = match.index;
    let depth = 1;
    let searchIndex = match.index + match[0].length;

    // Find the matching closing tag by counting depth
    while (depth > 0 && searchIndex < xml.length) {
      const nextOpen = xml.indexOf(`<${tagName}`, searchIndex);
      const nextClose = xml.indexOf(closeTag, searchIndex);

      if (nextClose === -1) break; // No more closing tags

      // Check if nextOpen is actually a self-closing tag - if so, skip it
      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Check if this is self-closing
        const tagEnd = xml.indexOf(">", nextOpen);
        if (tagEnd !== -1 && xml[tagEnd - 1] === "/") {
          // Self-closing, skip it
          searchIndex = tagEnd + 1;
          continue;
        }
        // Found another opening tag before the close
        depth++;
        searchIndex = nextOpen + tagName.length + 1;
      } else {
        // Found closing tag
        depth--;
        if (depth === 0) {
          // This is the matching close tag
          const endIndex = nextClose + closeTag.length;
          results.push(xml.substring(startIndex, endIndex));
        }
        searchIndex = nextClose + closeTag.length;
      }
    }
  }

  return results;
}

/**
 * Parse parameter measurement XML (your format: <parameter_measurement_guide>)
 */
function parseParameterXml(xml: string): ParsedParameter[] {
  const parameters: ParsedParameter[] = [];

  // Use a more robust approach: find all <parameter id="..."> tags and extract balanced content
  const parameterBlocks = extractBalancedTags(xml, "parameter");

  for (const block of parameterBlocks) {
    // Extract id from the opening tag
    const idMatch = block.match(/<parameter\s+id=["']([^"']+)["']/);
    if (!idMatch) continue;

    const paramId = idMatch[1];
    // Remove the opening and closing tags to get content
    const pContent = block.replace(/<parameter[^>]*>/, "").replace(/<\/parameter>\s*$/, "");

    // Extract metadata
    const metadataMatch = pContent.match(/<metadata>([\s\S]*?)<\/metadata>/);
    let name = paramId;
    let targetMin: number | undefined;
    let targetMax: number | undefined;

    if (metadataMatch) {
      const mContent = metadataMatch[1];
      // Use <n> for name in your format
      const nameMatch = mContent.match(/<n>([^<]+)<\/n>/);
      if (nameMatch) name = nameMatch[1];

      const targetMatch = mContent.match(/<target_range\s+min=["']([^"']+)["']\s+max=["']([^"']+)["']/);
      if (targetMatch) {
        targetMin = parseFloat(targetMatch[1]);
        targetMax = parseFloat(targetMatch[2]);
      }
    }

    // Extract description
    const descMatch = pContent.match(/<description>([\s\S]*?)<\/description>/);
    const definition = descMatch?.[1]?.trim();

    // Extract formula from <calculation>
    const calcMatch = pContent.match(/<calculation>([\s\S]*?)<\/calculation>/);
    let formula: string | undefined;
    if (calcMatch) {
      const formulaMatch = calcMatch[1].match(/<formula>([^<]+)<\/formula>/);
      formula = formulaMatch?.[1];
    }

    // Extract interpretation scale
    const interpretationScale: InterpretationRange[] = [];
    const interpMatch = pContent.match(/<interpretation_scale>([\s\S]*?)<\/interpretation_scale>/);
    if (interpMatch) {
      const rangeMatches = interpMatch[1].matchAll(/<range\s+min=["']([^"']+)["']\s+max=["']([^"']+)["']\s+label=["']([^"']+)["'](?:\s+implication=["']([^"']+)["'])?/g);
      for (const rm of rangeMatches) {
        interpretationScale.push({
          min: parseFloat(rm[1]),
          max: parseFloat(rm[2]),
          label: rm[3],
          implication: rm[4],
        });
      }
    }

    // Extract submetrics - they may be inside a <submetrics> wrapper or directly in content
    const submetrics: Submetric[] = [];
    // First try to find <submetrics> wrapper
    const submetricsWrapperMatch = pContent.match(/<submetrics>([\s\S]*?)<\/submetrics>/);
    const submetricsContent = submetricsWrapperMatch ? submetricsWrapperMatch[1] : pContent;
    const submetricMatches = submetricsContent.matchAll(/<submetric\s+id=["']([^"']+)["']\s+name=["']([^"']+)["']\s+weight=["']([^"']+)["'][^>]*>([\s\S]*?)<\/submetric>/g);
    for (const sm of submetricMatches) {
      const smContent = sm[4];
      const smDescMatch = smContent.match(/<description>([^<]+)<\/description>/);
      const smFormulaMatch = smContent.match(/<formula>([\s\S]*?)<\/formula>/);

      // Extract inputs
      const inputs: { name: string; source: string; required: boolean; description?: string }[] = [];
      const inputMatches = smContent.matchAll(/<input\s+name=["']([^"']+)["']\s+source=["']([^"']+)["']\s+required=["']([^"']+)["'][^>]*>([\s\S]*?)<\/input>/g);
      for (const im of inputMatches) {
        inputs.push({
          name: im[1],
          source: im[2],
          required: im[3] === "true",
          description: im[4]?.trim(),
        });
      }

      // Extract thresholds
      const smThresholds: Record<string, ThresholdDef> = {};
      const smThreshMatches = smContent.matchAll(/<threshold\s+name=["']([^"']+)["']\s+value=["']([^"']+)["'](?:\s+basis=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/threshold>/g);
      for (const tm of smThreshMatches) {
        smThresholds[tm[1]] = {
          value: parseFloat(tm[2]),
          basis: tm[3],
        };
      }

      // Extract definitions
      const definitions: Record<string, string> = {};
      const defMatches = smContent.matchAll(/<definition\s+term=["']([^"']+)["'][^>]*>([\s\S]*?)<\/definition>/g);
      for (const dm of defMatches) {
        definitions[dm[1]] = dm[2].trim();
      }

      // Extract assumptions
      const assumptions: string[] = [];
      const assumptionMatches = smContent.matchAll(/<assumption[^>]*>([\s\S]*?)<\/assumption>/g);
      for (const am of assumptionMatches) {
        assumptions.push(am[1].trim());
      }

      submetrics.push({
        id: sm[1],
        name: sm[2],
        weight: parseFloat(sm[3]),
        description: smDescMatch?.[1],
        formula: smFormulaMatch?.[1]?.trim(),
        inputs: inputs.length > 0 ? inputs : undefined,
        thresholds: Object.keys(smThresholds).length > 0 ? smThresholds : undefined,
        definitions: Object.keys(definitions).length > 0 ? definitions : undefined,
        assumptions: assumptions.length > 0 ? assumptions : undefined,
      });
    }

    // Extract worked example
    let workedExample: WorkedExample | undefined;
    const exampleMatch = pContent.match(/<worked_example>([\s\S]*?)<\/worked_example>/);
    if (exampleMatch) {
      const exContent = exampleMatch[1];
      const exDescMatch = exContent.match(/<description>([^<]+)<\/description>/);

      const exInputs: Record<string, string | number> = {};
      const exInputMatches = exContent.matchAll(/<input\s+name=["']([^"']+)["']\s+value=["']([^"']+)["']/g);
      for (const im of exInputMatches) {
        const val = im[2];
        exInputs[im[1]] = isNaN(Number(val)) ? val : Number(val);
      }

      const steps: { submetric: string; formula: string; result: string }[] = [];
      const stepMatches = exContent.matchAll(/<step\s+submetric=["']([^"']+)["']\s+formula=["']([^"']+)["']\s+result=["']([^"']+)["']/g);
      for (const stm of stepMatches) {
        steps.push({ submetric: stm[1], formula: stm[2], result: stm[3] });
      }

      const finalMatch = exContent.match(/<final_result\s+value=["']([^"']+)["']\s+interpretation=["']([^"']+)["']/);

      if (finalMatch) {
        workedExample = {
          description: exDescMatch?.[1],
          inputs: exInputs,
          steps,
          finalResult: { value: finalMatch[1], interpretation: finalMatch[2] },
        };
      }
    }

    // Extract action thresholds as regular thresholds
    const thresholds: Record<string, ThresholdDef> = {};
    const actionThreshMatch = pContent.match(/<action_thresholds>([\s\S]*?)<\/action_thresholds>/);
    if (actionThreshMatch) {
      const atMatches = actionThreshMatch[1].matchAll(/<threshold\s+value=["']([^"']+)["']\s+operator=["']([^"']+)["'](?:\s+max=["']([^"']+)["'])?\s+status=["']([^"']+)["']\s+action=["']([^"']+)["']/g);
      for (const atm of atMatches) {
        thresholds[atm[4]] = {
          value: parseFloat(atm[1]),
          operator: atm[2],
        };
      }
    }

    parameters.push({
      id: paramId,
      name,
      definition,
      formula,
      targetRange: targetMin !== undefined && targetMax !== undefined ? { min: targetMin, max: targetMax } : undefined,
      submetrics: submetrics.length > 0 ? submetrics : undefined,
      thresholds: Object.keys(thresholds).length > 0 ? thresholds : undefined,
      interpretationScale: interpretationScale.length > 0 ? interpretationScale : undefined,
      workedExample,
    });
  }

  return parameters;
}

/**
 * Extract parameter references from story XML
 */
function extractParameterRefs(xml: string): string[] {
  const refs = new Set<string>();

  // Look for parameter ids in <mvp_parameter_set>
  const paramSetMatch = xml.match(/<mvp_parameter_set>([\s\S]*?)<\/mvp_parameter_set>/);
  if (paramSetMatch) {
    const paramMatches = paramSetMatch[1].matchAll(/<parameter\s+id=["']([^"']+)["']/g);
    for (const m of paramMatches) {
      refs.add(m[1]);
    }
  }

  // Look for <parameters> tags in acceptance criteria
  const paramTagMatches = xml.matchAll(/<parameters>([^<]+)<\/parameters>/g);
  for (const m of paramTagMatches) {
    const params = m[1].split(/[,\s]+/).filter(Boolean);
    for (const p of params) {
      refs.add(p);
    }
  }

  // Look for parameter="..." attributes
  const paramAttrMatches = xml.matchAll(/parameter=["']([^"']+)["']/g);
  for (const m of paramAttrMatches) {
    refs.add(m[1]);
  }

  return Array.from(refs);
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}
