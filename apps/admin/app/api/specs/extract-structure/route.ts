import { NextRequest, NextResponse } from "next/server";
import { getAICompletion, getDefaultEngine } from "@/lib/ai/client";

export const runtime = "nodejs";

// Extraction prompts by spec type
const EXTRACTION_PROMPTS: Record<string, string> = {
  CURRICULUM: `You are converting a curriculum/training document into a structured BDD specification JSON.

Extract all curriculum content and organize it into the following structure. Be thorough - extract ALL modules, learning objectives, key terms, etc. from the document.

Required output structure (respond with ONLY valid JSON, no explanation):
{
  "id": "CURR-XXX-001",
  "title": "Full curriculum title",
  "version": "1.0",
  "status": "Draft",
  "date": "{TODAY}",
  "domain": "curriculum",
  "specType": "DOMAIN",
  "outputType": "COMPOSE",
  "specRole": "CONTENT",

  "story": {
    "asA": "learner preparing for [qualification]",
    "iWant": "to learn [topic] through AI tutoring",
    "soThat": "I can [outcome]"
  },

  "context": {
    "applies": "When tutoring through this curriculum",
    "dependsOn": [],
    "assumptions": ["list of assumptions about the learner"]
  },

  "qualification": {
    "name": "Full qualification name if mentioned",
    "number": "Qualification number if mentioned",
    "tqt": null,
    "glh": null,
    "refreshPeriod": null
  },

  "assessment": {
    "format": "Assessment format if mentioned",
    "questions": null,
    "durationMinutes": null,
    "passMarkPercent": null
  },

  "learningOutcomes": [
    {
      "id": "LO1",
      "title": "Learning outcome title",
      "criteria": [
        { "id": "1.1", "text": "Assessment criterion", "bloomsLevel": "Knowledge|Understanding|Application|Analysis" }
      ]
    }
  ],

  "modules": [
    {
      "id": "MOD-1",
      "title": "Module title",
      "durationMinutes": 45,
      "learningOutcome": "LO1",
      "assessmentCriteria": ["1.1", "1.2"],
      "learningObjectives": ["Objective 1", "Objective 2"],
      "content": [
        {
          "id": "1A",
          "title": "Section title",
          "points": ["Key point 1", "Key point 2"]
        }
      ],
      "keyTerms": [
        { "term": "Term", "definition": "Definition" }
      ],
      "examTopics": ["Exam-relevant topic 1"],
      "tutoringGuidance": {
        "scaffolding": "How to scaffold learning",
        "commonMisconceptions": ["Misconception 1"],
        "readinessIndicator": "How to know learner is ready to advance"
      }
    }
  ],

  "misconceptionBank": [
    {
      "id": "MC-1",
      "topic": "Topic",
      "wrongBelief": "What learners often believe incorrectly",
      "correction": "The correct understanding",
      "teachingApproach": "How to address this"
    }
  ],

  "sessionStructure": {
    "typicalDuration": "15-20 minutes",
    "phases": ["Hook/recall", "New content", "Practice", "Summary"]
  },

  "assessmentStrategy": {
    "formativeApproaches": ["Comprehension checks", "Application questions"],
    "summativePrep": ["Practice questions", "Review sessions"]
  },

  "parameters": [],
  "acceptanceCriteria": [],
  "constraints": []
}

Document content:
---
{CONTENT}
---`,

  MEASURE: `You are converting a behavioral measurement document into a structured BDD specification JSON.

Extract all measurement parameters, scoring anchors, and triggers. Be thorough.

Required output structure (respond with ONLY valid JSON):
{
  "id": "MEAS-XXX-001",
  "title": "Measurement spec title",
  "version": "1.0",
  "status": "Draft",
  "date": "{TODAY}",
  "domain": "behavior",
  "specType": "DOMAIN",
  "outputType": "MEASURE",
  "specRole": "MEASURE",

  "story": {
    "asA": "system measuring [what]",
    "iWant": "to measure [parameters]",
    "soThat": "the system can [adapt/respond]"
  },

  "context": {
    "applies": "When this measurement applies",
    "dependsOn": [],
    "assumptions": []
  },

  "acceptanceCriteria": [
    {
      "id": "AC-1",
      "title": "Criterion title",
      "given": "Given condition",
      "when": "When action",
      "then": "Then outcome",
      "measuredBy": ["parameter_id"]
    }
  ],

  "parameters": [
    {
      "id": "parameter_id",
      "name": "Parameter Name",
      "description": "What this parameter measures",
      "section": "category",
      "isAdjustable": true,
      "targetRange": { "min": 0.0, "max": 1.0 },
      "scoringAnchors": [
        { "score": 0.0, "example": "Low example", "rationale": "Why this is low" },
        { "score": 0.5, "example": "Medium example", "rationale": "Why this is medium" },
        { "score": 1.0, "example": "High example", "rationale": "Why this is high" }
      ],
      "promptGuidance": {
        "whenHigh": "What to do when high",
        "whenLow": "What to do when low"
      }
    }
  ],

  "triggers": [
    {
      "name": "Trigger name",
      "given": "Condition",
      "when": "Event",
      "then": "Action",
      "actions": [
        { "parameterId": "target_param", "targetValue": 0.7, "rationale": "Why" }
      ]
    }
  ],

  "constraints": [
    {
      "id": "C-1",
      "type": "category",
      "description": "Constraint description",
      "severity": "critical|warning|info"
    }
  ]
}

Document content:
---
{CONTENT}
---`,

  IDENTITY: `You are converting a character/persona document into a structured BDD specification JSON.

Extract all identity traits, voice characteristics, and behavioral patterns.

Required output structure (respond with ONLY valid JSON):
{
  "id": "IDENT-XXX-001",
  "title": "Identity spec title",
  "version": "1.0",
  "status": "Draft",
  "date": "{TODAY}",
  "domain": "identity",
  "specType": "SYSTEM",
  "outputType": "COMPOSE",
  "specRole": "IDENTITY",

  "story": {
    "asA": "AI agent with this identity",
    "iWant": "to embody [characteristics]",
    "soThat": "I can [purpose]"
  },

  "context": {
    "applies": "All interactions",
    "dependsOn": [],
    "assumptions": []
  },

  "parameters": [
    {
      "id": "voice_style",
      "name": "Voice Style",
      "description": "How the agent speaks",
      "section": "voice",
      "config": {
        "tone": "Description of tone",
        "vocabulary": "Vocabulary level and style",
        "patterns": ["Speech patterns"]
      }
    },
    {
      "id": "personality_traits",
      "name": "Personality Traits",
      "description": "Core personality characteristics",
      "section": "personality",
      "config": {
        "traits": ["Trait 1", "Trait 2"],
        "values": ["Value 1", "Value 2"]
      }
    },
    {
      "id": "behavioral_patterns",
      "name": "Behavioral Patterns",
      "description": "How the agent behaves",
      "section": "behavior",
      "config": {
        "greetings": "How to greet",
        "responses": "Response patterns",
        "boundaries": "What not to do"
      }
    }
  ],

  "acceptanceCriteria": [],
  "constraints": []
}

Document content:
---
{CONTENT}
---`,

  // Default/fallback prompt for other types
  DEFAULT: `You are converting a document into a structured BDD specification JSON.

Analyze the content and create an appropriate spec structure.

Required output structure (respond with ONLY valid JSON):
{
  "id": "SPEC-XXX-001",
  "title": "Spec title from document",
  "version": "1.0",
  "status": "Draft",
  "date": "{TODAY}",
  "domain": "general",
  "specType": "DOMAIN",
  "outputType": "COMPOSE",
  "specRole": "",

  "story": {
    "asA": "user/system",
    "iWant": "to [action]",
    "soThat": "[outcome]"
  },

  "context": {
    "applies": "When this spec applies",
    "dependsOn": [],
    "assumptions": []
  },

  "acceptanceCriteria": [
    {
      "id": "AC-1",
      "title": "Criterion title",
      "given": "Given condition",
      "when": "When action",
      "then": "Then outcome"
    }
  ],

  "parameters": [],
  "constraints": []
}

Document content:
---
{CONTENT}
---`,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rawText, specType, fileName } = body;

    if (!rawText?.trim()) {
      return NextResponse.json({ ok: false, error: "No content provided" }, { status: 400 });
    }

    // Get the appropriate prompt template
    const promptTemplate = EXTRACTION_PROMPTS[specType] || EXTRACTION_PROMPTS.DEFAULT;

    // Truncate if too long (keep first 25k chars for extraction)
    const contentForExtraction = rawText.length > 25000
      ? rawText.slice(0, 25000) + "\n...[truncated]..."
      : rawText;

    // Replace placeholders
    const today = new Date().toISOString().split("T")[0];
    const prompt = promptTemplate
      .replace("{CONTENT}", contentForExtraction)
      .replace("{TODAY}", today);

    // Call AI for extraction
    const engine = getDefaultEngine();
    const result = await getAICompletion({
      engine,
      messages: [
        { role: "user", content: prompt },
      ],
      maxTokens: 8000,
      temperature: 0.3,
    });

    // Parse the JSON response
    let spec;
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      spec = JSON.parse(jsonMatch[0]);

      // Generate ID if not present or generic
      if (!spec.id || spec.id.includes("XXX")) {
        const prefix = specType === "CURRICULUM" ? "CURR" :
                       specType === "MEASURE" ? "MEAS" :
                       specType === "IDENTITY" ? "IDENT" :
                       specType === "CONTENT" ? "CONT" :
                       specType === "ADAPT" ? "ADAPT" :
                       specType === "GUARDRAIL" ? "GUARD" : "SPEC";
        const suffix = fileName
          ? fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "-").toUpperCase().slice(0, 20)
          : "001";
        spec.id = `${prefix}-${suffix}-001`;
      }

      // Ensure date is set
      if (!spec.date) {
        spec.date = today;
      }

    } catch (parseError) {
      console.error("Failed to parse AI extraction response:", result.content);
      return NextResponse.json(
        { ok: false, error: "Failed to parse extracted structure. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      spec,
      warnings: [],
      needsReview: [],
    });
  } catch (error) {
    console.error("Extract structure error:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
