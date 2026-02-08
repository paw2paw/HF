"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";
import { DraggableTabs } from "@/components/shared/DraggableTabs";

type TabKey = "parameters" | "variables" | "prefixes" | "entities" | "dependencies";

type SpecDependency = {
  id: string;
  name: string;
  slug: string;
  type: "spec";
  outputType: string;
  specRole: string | null;
  variables: string[];
  prefixes: string[];
};

type PlaybookDependency = {
  id: string;
  name: string;
  type: "playbook";
  version: string;
  domain: string | null;
  specs: Array<{ id: string; name: string; outputType: string }>;
  templates: Array<{ id: string; slug: string; name: string }>;
};

type XRefData = {
  analysisSpecs: Array<{ id: string; name: string; slug: string; outputType: string; field: string }>;
  promptTemplates: Array<{ id: string; name: string; slug: string; field: string }>;
  promptSlugs: Array<{ id: string; slug: string; name: string; field: string }>;
  playbooks: Array<{ id: string; name: string; status: string; domain: string | null }>;
};

type ParameterSpec = {
  id: string;
  slug: string;
  name: string;
  outputType: string;
  scope: string;
  domain: string | null;
  isActive: boolean;
  actionCount: number;
  triggers: string[];
};

type ParameterPlaybook = {
  id: string;
  name: string;
  status: string;
  domain: { id: string; name: string; slug: string } | null;
};

type ParameterData = {
  parameterId: string;
  name: string;
  definition: string | null;
  domainGroup: string;
  scaleType: string;
  interpretationHigh: string | null;
  interpretationLow: string | null;
  isActive: boolean;
  sourceFeatureSet?: {
    id: string;
    featureId: string;
    name: string;
    version: string;
  } | null;
  scoringAnchors: Array<{
    id: string;
    score: number;
    example: string;
    rationale: string | null;
    isGold: boolean;
  }>;
  behaviorTargets: Array<{
    id: string;
    scope: string;
    targetValue: number;
    confidence: number;
    source: string;
    playbook: { id: string; name: string } | null;
  }>;
  specs: ParameterSpec[];
  playbooks: ParameterPlaybook[];
  promptSlugs: Array<{
    id: string;
    slug: string;
    name: string;
    weight: number;
    mode: string;
    memoryCategory: string | null;
    memoryMode: string | null;
    fallbackPrompt: string | null;
    rangeCount: number;
    ranges: Array<{
      id: string;
      minValue: number;
      maxValue: number;
      label: string | null;
      prompt: string;
      condition: string | null;
    }>;
  }>;
  _counts: {
    specs: number;
    activeSpecs: number;
    playbooks: number;
    behaviorTargets: number;
    promptSlugs: number;
    scoringAnchors: number;
  };
};

type ParameterSummary = {
  total: number;
  active: number;
  withSpecs: number;
  withPlaybooks: number;
  withTargets: number;
  withAnchors: number;
  orphaned: number;
  byDomainGroup: Record<string, number>;
};

// Template Variables Data
const TEMPLATE_VARIABLES = [
  // Value & Measurement
  { name: "{{value}}", type: "number (0-1)", context: "MEASURE specs, personality scoring", example: '"The caller scores {{value}} on openness"', category: "Measurement" },
  { name: "{{label}}", type: "string", context: "Auto-generated from value", example: '"high", "medium", "low"', category: "Measurement" },
  { name: "{{count}}", type: "number", context: "Memory summaries", example: '"You have {{count}} pieces of information"', category: "Measurement" },

  // Parameters
  { name: "{{param.name}}", type: "string", context: "Parameter name", example: '"scores {{value}} on {{param.name}}"', category: "Parameters" },
  { name: "{{param.definition}}", type: "string", context: "Parameter definition text", example: "Enrichment context", category: "Parameters" },
  { name: "{{param.highLabel}}", type: "string", context: "What 'high' means for parameter", example: "Interpretation guidance", category: "Parameters" },
  { name: "{{param.lowLabel}}", type: "string", context: "What 'low' means for parameter", example: "Interpretation guidance", category: "Parameters" },

  // Transcript & Context
  { name: "{{transcript}}", type: "string", context: "Full or truncated call transcript", example: "Personality analysis, memory extraction", category: "Context" },
  { name: "{{domain}}", type: "string", context: "Domain/category of spec", example: "Memory extraction categorization", category: "Context" },
  { name: "{{anchors}}", type: "array", context: "Scoring calibration examples", example: "Personality scoring templates", category: "Context" },

  // Memories
  { name: "{{memories.all}}", type: "array", context: "All memories regardless of category", example: "Comprehensive memory display", category: "Memories" },
  { name: "{{memories.facts}}", type: "array", context: "FACT category memories", example: "Personal facts recall", category: "Memories" },
  { name: "{{memories.preferences}}", type: "array", context: "PREFERENCE category memories", example: "Preference-based decisions", category: "Memories" },
  { name: "{{memories.events}}", type: "array", context: "EVENT category memories", example: "Recent events context", category: "Memories" },
  { name: "{{memories.relationships}}", type: "array", context: "RELATIONSHIP category memories", example: "People mentioned", category: "Memories" },
  { name: "{{memories.topics}}", type: "array", context: "TOPIC category memories", example: "Interest/discussion topics", category: "Memories" },
  { name: "{{memories.CONTEXT}}", type: "array", context: "CONTEXT category memories", example: "Situational context", category: "Memories" },

  // Memory Item Properties
  { name: "{{this.key}}", type: "string", context: "Memory key name (in loop)", example: '"{{this.key}}: {{this.value}}"', category: "Loop Items" },
  { name: "{{this.value}}", type: "string", context: "Memory value (in loop)", example: "The actual memory content", category: "Loop Items" },
  { name: "{{this.category}}", type: "string", context: "Memory category (in loop)", example: '"[{{this.category}}] {{this.key}}"', category: "Loop Items" },
  { name: "{{this}}", type: "primitive", context: "Current item for string arrays", example: "Direct reference in loop", category: "Loop Items" },
  { name: "{{@index}}", type: "number", context: "Loop iteration index", example: "Array position counter", category: "Loop Items" },

  // Caller
  { name: "{{user.name}}", type: "string", context: "Caller/user name", example: '"Hello {{user.name}}"', category: "Caller" },
  { name: "{{caller.name}}", type: "string", context: "Caller name (alternative)", example: "Personalization", category: "Caller" },
  { name: "{{caller.id}}", type: "string", context: "Caller ID", example: "For reference", category: "Caller" },

  // Conditionals
  { name: "{{#if high}}...{{/if}}", type: "boolean", context: "value >= 0.7", example: '"{{#if high}}Be warm{{/if}}"', category: "Conditionals" },
  { name: "{{#if medium}}...{{/if}}", type: "boolean", context: "0.3 <= value < 0.7", example: '"{{#if medium}}Be balanced{{/if}}"', category: "Conditionals" },
  { name: "{{#if low}}...{{/if}}", type: "boolean", context: "value < 0.3", example: '"{{#if low}}Be direct{{/if}}"', category: "Conditionals" },
  { name: "{{#if hasMemories}}...{{/if}}", type: "boolean", context: "memories.length > 0", example: "Show/hide memory sections", category: "Conditionals" },
  { name: "{{#unless condition}}...{{/unless}}", type: "boolean", context: "Inverse of if", example: "Opposite condition", category: "Conditionals" },

  // Loops
  { name: "{{#each memories.facts}}...{{/each}}", type: "loop", context: "Iterate FACT memories", example: "List facts with key/value", category: "Loops" },
  { name: "{{#each anchors}}...{{/each}}", type: "loop", context: "Iterate scoring anchors", example: '"Score {{score}}: {{example}}"', category: "Loops" },

  // Spec
  { name: "{{spec.name}}", type: "string", context: "Analysis spec name", example: '"Analysis: {{spec.name}}"', category: "Spec" },
  { name: "{{spec.slug}}", type: "string", context: "Analysis spec slug", example: "Reference/linking", category: "Spec" },
  { name: "{{spec.domain}}", type: "string", context: "Analysis spec domain", example: "Category context", category: "Spec" },
];

// Key Prefix Patterns
const KEY_PREFIXES = [
  // Personal Demographics
  { prefix: "location_", category: "FACT", examples: "location_city, location_country, location_lived_london", purpose: "Geographic information" },
  { prefix: "bio_", category: "FACT", examples: "bio_occupation, bio_employer", purpose: "Biographical basics" },
  { prefix: "job_", category: "FACT", examples: "job_title, job_company, job_industry", purpose: "Employment info" },
  { prefix: "work_", category: "FACT", examples: "work_manager, work_colleague", purpose: "Work relationships" },

  // Relationships
  { prefix: "person_family_", category: "RELATIONSHIP", examples: "person_family_spouse, person_family_child_1", purpose: "Family members" },
  { prefix: "person_work_", category: "RELATIONSHIP", examples: "person_work_manager, person_work_colleague", purpose: "Work relationships" },
  { prefix: "relationship_", category: "RELATIONSHIP", examples: "relationship_friend, relationship_neighbor", purpose: "Other relationships" },
  { prefix: "family_", category: "RELATIONSHIP", examples: "family_spouse, family_children", purpose: "Family details" },

  // Preferences
  { prefix: "prefers_contact_", category: "PREFERENCE", examples: "prefers_contact_method, prefers_contact_time", purpose: "Contact preferences" },
  { prefix: "prefers_style_", category: "PREFERENCE", examples: "prefers_style_brief, prefers_style_detailed", purpose: "Communication style" },
  { prefix: "prefers_", category: "PREFERENCE", examples: "prefers_pace, prefers_formality", purpose: "General preferences" },
  { prefix: "pref_comm_", category: "PREFERENCE", examples: "pref_comm_email, pref_comm_phone", purpose: "Communication preferences" },
  { prefix: "pace_", category: "PREFERENCE", examples: "pace_slow, pace_fast", purpose: "Conversation pace" },
  { prefix: "formality_", category: "PREFERENCE", examples: "formality_casual, formality_formal", purpose: "Formality level" },

  // Events
  { prefix: "event_", category: "EVENT", examples: "event_upcoming, event_travel, event_meeting", purpose: "General events" },
  { prefix: "event_sentiment_", category: "EVENT", examples: "event_sentiment_positive, event_sentiment_negative", purpose: "Event sentiment" },
  { prefix: "future_event_", category: "EVENT", examples: "future_event_vacation, future_event_appointment", purpose: "Upcoming events" },

  // Context
  { prefix: "context_", category: "CONTEXT", examples: "context_traveling, context_busy_period", purpose: "Current situation" },
  { prefix: "situation_", category: "CONTEXT", examples: "situation_traveling, situation_stress", purpose: "Life situations" },

  // Topics & Interests
  { prefix: "interest_", category: "TOPIC", examples: "interest_product_premium, interest_topic_pricing", purpose: "Topic interests" },
  { prefix: "topic_", category: "TOPIC", examples: "topic_cluster, topic_connection", purpose: "Topic clustering" },
  { prefix: "expertise_", category: "TOPIC", examples: "expertise_languages, expertise_skills", purpose: "Known expertise" },
  { prefix: "hobby_", category: "TOPIC", examples: "hobby_hiking, hobby_cooking", purpose: "Hobbies" },
  { prefix: "curious_about_", category: "TOPIC", examples: "curious_about_technology, curious_about_history", purpose: "Learning interests" },

  // History
  { prefix: "history_job_", category: "FACT", examples: "history_job_previous_company, history_job_past_role", purpose: "Past employment" },
  { prefix: "history_location_", category: "FACT", examples: "history_location_lived_london, history_location_visited_japan", purpose: "Travel/relocation history" },
  { prefix: "history_education_", category: "FACT", examples: "history_education_degree, history_education_school", purpose: "Educational background" },

  // Learning
  { prefix: "learning_goal_", category: "EVENT", examples: "learning_goal_python, learning_goal_history", purpose: "Learning objectives" },
  { prefix: "learning_style_", category: "PREFERENCE", examples: "learning_style_visual, learning_style_hands_on", purpose: "Learning approach" },
  { prefix: "knowledge_gap_", category: "TOPIC", examples: "knowledge_gap_math, knowledge_gap_grammar", purpose: "Knowledge gaps identified" },
  { prefix: "misconception_", category: "TOPIC", examples: "misconception_history, misconception_science", purpose: "Misconceptions identified" },

  // Lifestyle
  { prefix: "living_", category: "FACT", examples: "living_situation, living_with_family", purpose: "Living situation" },
  { prefix: "routine_", category: "PREFERENCE", examples: "routine_morning, routine_evening", purpose: "Daily routines" },
  { prefix: "health_", category: "FACT", examples: "health_condition, health_medication", purpose: "Health-related info" },
];

// Entity Usage
const ENTITY_USAGE = [
  { entity: "AnalysisSpec", stores: "promptTemplate", usesVariables: "All template variables", usesPrefixes: "Via learnKeyPrefix in actions" },
  { entity: "CallerMemory", stores: "key, value, category", usesVariables: "Via {{memories.*}}", usesPrefixes: "Stores keys with prefixes" },
  { entity: "PromptSlug", stores: "Range prompts, summary templates", usesVariables: "All template variables", usesPrefixes: "Via memory injection" },
  { entity: "PromptSlugRange", stores: "Conditional prompts", usesVariables: "Conditionals, loops", usesPrefixes: "Via ranges" },
  { entity: "Parameter", stores: "Definition, interpretation", usesVariables: "Via {{param.*}}", usesPrefixes: "For measurement context" },
  { entity: "ParameterScoringAnchor", stores: "Score + example", usesVariables: "{{score}}, {{example}}", usesPrefixes: "For scoring rubric" },
  { entity: "AnalysisAction", stores: "learnCategory, learnKeyPrefix, learnKeyHint", usesVariables: "Via injected templates", usesPrefixes: "Defines memory keys" },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  FACT: { bg: "#dbeafe", text: "#1e40af" },
  RELATIONSHIP: { bg: "#fce7f3", text: "#be185d" },
  PREFERENCE: { bg: "#d1fae5", text: "#065f46" },
  EVENT: { bg: "#fef3c7", text: "#92400e" },
  CONTEXT: { bg: "#e0e7ff", text: "#3730a3" },
  TOPIC: { bg: "#f3e8ff", text: "#7c3aed" },
  Measurement: { bg: "#dbeafe", text: "#1e40af" },
  Parameters: { bg: "#fef3c7", text: "#92400e" },
  Context: { bg: "#e0e7ff", text: "#3730a3" },
  Memories: { bg: "#d1fae5", text: "#065f46" },
  "Loop Items": { bg: "#fce7f3", text: "#be185d" },
  Caller: { bg: "#f3e8ff", text: "#7c3aed" },
  Conditionals: { bg: "#fee2e2", text: "#991b1b" },
  Loops: { bg: "#ccfbf1", text: "#0f766e" },
  Spec: { bg: "#f1f5f9", text: "#475569" },
};

// Expandable Row Component for Variables
function VariableRow({ v }: { v: typeof TEMPLATE_VARIABLES[0] }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [xrefs, setXrefs] = useState<XRefData | null>(null);

  const colors = CATEGORY_COLORS[v.category] || { bg: "#f3f4f6", text: "#374151" };

  const fetchXrefs = async () => {
    if (xrefs) {
      setExpanded(!expanded);
      return;
    }
    setLoading(true);
    setExpanded(true);
    try {
      const res = await fetch(`/api/data-dictionary/xrefs?type=variable&pattern=${encodeURIComponent(v.name)}`);
      const data = await res.json();
      if (data.ok) {
        setXrefs(data.xrefs);
      }
    } catch (e) {
      console.error("Failed to fetch xrefs:", e);
    } finally {
      setLoading(false);
    }
  };

  const totalRefs = xrefs
    ? xrefs.analysisSpecs.length + xrefs.promptTemplates.length + xrefs.promptSlugs.length
    : 0;

  return (
    <>
      <tr
        onClick={fetchXrefs}
        style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <td style={{ padding: "10px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#9ca3af", fontSize: 10 }}>{expanded ? "▼" : "▶"}</span>
            <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" }}>
              {v.name}
            </code>
          </div>
        </td>
        <td style={{ padding: "10px 16px", color: "#6b7280" }}>{v.type}</td>
        <td style={{ padding: "10px 16px", color: "#374151" }}>{v.context}</td>
        <td style={{ padding: "10px 16px", color: "#6b7280", fontStyle: "italic", fontSize: 12 }}>{v.example}</td>
        <td style={{ padding: "10px 16px" }}>
          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500, background: colors.bg, color: colors.text }}>
            {v.category}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ padding: 0, background: "#f9fafb" }}>
            <div style={{ padding: "12px 16px 12px 40px" }}>
              {loading ? (
                <div style={{ color: "#6b7280", fontSize: 12 }}>Loading cross-references...</div>
              ) : xrefs && totalRefs > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Analysis Specs */}
                  {xrefs.analysisSpecs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                        Analysis Specs ({xrefs.analysisSpecs.length})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {xrefs.analysisSpecs.map((spec) => (
                          <Link
                            key={spec.id}
                            href={`/analysis-specs?select=${spec.id}`}
                            style={{ textDecoration: "none" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 12,
                                background: spec.outputType === "MEASURE" ? "#eef2ff" : "#fffbeb",
                                color: spec.outputType === "MEASURE" ? "#4338ca" : "#92400e",
                                border: `1px solid ${spec.outputType === "MEASURE" ? "#c7d2fe" : "#fde68a"}`,
                              }}
                            >
                              {spec.name}
                              <span style={{ marginLeft: 4, opacity: 0.6 }}>({spec.outputType})</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prompt Templates */}
                  {xrefs.promptTemplates.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                        Prompt Templates ({xrefs.promptTemplates.length})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {xrefs.promptTemplates.map((t) => (
                          <Link
                            key={t.id}
                            href={`/prompt-templates?select=${t.id}`}
                            style={{ textDecoration: "none" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 12,
                                background: "#f0fdf4",
                                color: "#166534",
                                border: "1px solid #bbf7d0",
                              }}
                            >
                              {t.name}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prompt Slugs */}
                  {xrefs.promptSlugs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                        Prompt Slugs ({xrefs.promptSlugs.length})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {xrefs.promptSlugs.map((s) => (
                          <Link
                            key={s.id}
                            href={`/prompt-slugs?select=${s.id}`}
                            style={{ textDecoration: "none" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 12,
                                background: "#fdf4ff",
                                color: "#86198f",
                                border: "1px solid #f5d0fe",
                              }}
                            >
                              {s.name || s.slug}
                              <span style={{ marginLeft: 4, opacity: 0.6 }}>({s.field})</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Playbooks */}
                  {xrefs.playbooks.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                        Used in Playbooks ({xrefs.playbooks.length})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {xrefs.playbooks.map((pb) => (
                          <Link
                            key={pb.id}
                            href={`/playbooks/${pb.id}`}
                            style={{ textDecoration: "none" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 12,
                                background: "#fff7ed",
                                color: "#c2410c",
                                border: "1px solid #fed7aa",
                              }}
                            >
                              {pb.name}
                              {pb.domain && <span style={{ marginLeft: 4, opacity: 0.6 }}>({pb.domain})</span>}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: "#9ca3af", fontSize: 12, fontStyle: "italic" }}>
                  No cross-references found in database
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Expandable Row Component for Prefixes
function PrefixRow({ p }: { p: typeof KEY_PREFIXES[0] }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [xrefs, setXrefs] = useState<XRefData | null>(null);

  const colors = CATEGORY_COLORS[p.category] || { bg: "#f3f4f6", text: "#374151" };

  const fetchXrefs = async () => {
    if (xrefs) {
      setExpanded(!expanded);
      return;
    }
    setLoading(true);
    setExpanded(true);
    try {
      const res = await fetch(`/api/data-dictionary/xrefs?type=prefix&pattern=${encodeURIComponent(p.prefix)}`);
      const data = await res.json();
      if (data.ok) {
        setXrefs(data.xrefs);
      }
    } catch (e) {
      console.error("Failed to fetch xrefs:", e);
    } finally {
      setLoading(false);
    }
  };

  const totalRefs = xrefs
    ? xrefs.analysisSpecs.length + xrefs.playbooks.length
    : 0;

  return (
    <>
      <tr
        onClick={fetchXrefs}
        style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <td style={{ padding: "10px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#9ca3af", fontSize: 10 }}>{expanded ? "▼" : "▶"}</span>
            <code style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", color: "#92400e" }}>
              {p.prefix}
            </code>
          </div>
        </td>
        <td style={{ padding: "10px 16px" }}>
          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500, background: colors.bg, color: colors.text }}>
            {p.category}
          </span>
        </td>
        <td style={{ padding: "10px 16px", color: "#6b7280", fontSize: 12, fontFamily: "monospace" }}>{p.examples}</td>
        <td style={{ padding: "10px 16px", color: "#374151" }}>{p.purpose}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} style={{ padding: 0, background: "#f9fafb" }}>
            <div style={{ padding: "12px 16px 12px 40px" }}>
              {loading ? (
                <div style={{ color: "#6b7280", fontSize: 12 }}>Loading cross-references...</div>
              ) : xrefs && totalRefs > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Analysis Specs using this prefix */}
                  {xrefs.analysisSpecs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                        Analysis Specs using this prefix ({xrefs.analysisSpecs.length})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {xrefs.analysisSpecs.map((spec) => (
                          <Link
                            key={spec.id}
                            href={`/analysis-specs?select=${spec.id}`}
                            style={{ textDecoration: "none" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 12,
                                background: "#fffbeb",
                                color: "#92400e",
                                border: "1px solid #fde68a",
                              }}
                            >
                              {spec.name}
                              <span style={{ marginLeft: 4, opacity: 0.6, fontSize: 10 }}>{spec.field}</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Playbooks */}
                  {xrefs.playbooks.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                        Used in Playbooks ({xrefs.playbooks.length})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {xrefs.playbooks.map((pb) => (
                          <Link
                            key={pb.id}
                            href={`/playbooks/${pb.id}`}
                            style={{ textDecoration: "none" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 12,
                                background: "#fff7ed",
                                color: "#c2410c",
                                border: "1px solid #fed7aa",
                              }}
                            >
                              {pb.name}
                              {pb.domain && <span style={{ marginLeft: 4, opacity: 0.6 }}>({pb.domain})</span>}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: "#9ca3af", fontSize: 12, fontStyle: "italic" }}>
                  No cross-references found in database (prefix may be documented but not yet used)
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Expandable Row Component for Parameters
function ParameterRow({ param }: { param: ParameterData }) {
  const [expanded, setExpanded] = useState(false);
  const [showAllAnchors, setShowAllAnchors] = useState(false);
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());
  const [showTargetDetails, setShowTargetDetails] = useState(false);

  const toggleSlugExpanded = (slugId: string) => {
    setExpandedSlugs(prev => {
      const next = new Set(prev);
      if (next.has(slugId)) {
        next.delete(slugId);
      } else {
        next.add(slugId);
      }
      return next;
    });
  };

  const domainColors: Record<string, { bg: string; text: string }> = {
    personality: { bg: "#f3e8ff", text: "#7c3aed" },
    behavior: { bg: "#dbeafe", text: "#2563eb" },
    conversation: { bg: "#ccfbf1", text: "#0d9488" },
    companion: { bg: "#fef3c7", text: "#d97706" },
    tutor: { bg: "#fce7f3", text: "#be185d" },
    mvp: { bg: "#dcfce7", text: "#16a34a" },
  };

  const colors = domainColors[param.domainGroup.toLowerCase()] || { bg: "#f3f4f6", text: "#374151" };
  const hasRelationships = param._counts.specs > 0 || param._counts.playbooks > 0 || param._counts.behaviorTargets > 0 || param._counts.promptSlugs > 0;

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <td style={{ padding: "10px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#9ca3af", fontSize: 10 }}>{expanded ? "▼" : "▶"}</span>
            <code style={{ background: "#e0e7ff", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", color: "#4338ca", fontWeight: 500 }}>
              {param.parameterId}
            </code>
            {!param.isActive && (
              <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, background: "#fee2e2", color: "#991b1b" }}>
                inactive
              </span>
            )}
            {param.sourceFeatureSet && (
              <Link
                href={`/lab/features/${param.sourceFeatureSet.id}`}
                onClick={(e) => e.stopPropagation()}
                style={{ textDecoration: "none" }}
              >
                <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, background: "#d1fae5", color: "#059669" }}>
                  📦 {param.sourceFeatureSet.name}
                </span>
              </Link>
            )}
          </div>
        </td>
        <td style={{ padding: "10px 16px", color: "#374151", fontWeight: 500 }}>{param.name}</td>
        <td style={{ padding: "10px 16px" }}>
          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500, background: colors.bg, color: colors.text }}>
            {param.domainGroup}
          </span>
        </td>
        <td style={{ padding: "10px 16px", color: "#6b7280", fontSize: 12 }}>{param.scaleType}</td>
        <td style={{ padding: "10px 16px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {param._counts.specs > 0 && (
              <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "#eef2ff", color: "#4338ca" }}>
                {param._counts.specs} specs
              </span>
            )}
            {param._counts.playbooks > 0 && (
              <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "#fff7ed", color: "#c2410c" }}>
                {param._counts.playbooks} playbooks
              </span>
            )}
            {param._counts.behaviorTargets > 0 && (
              <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "#f0fdf4", color: "#166534" }}>
                {param._counts.behaviorTargets} targets
              </span>
            )}
            {param._counts.scoringAnchors > 0 && (
              <span style={{
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 10,
                background: param.scoringAnchors.some(a => a.isGold) ? "#fef3c7" : "#fff7ed",
                color: "#92400e",
                border: param.scoringAnchors.some(a => a.isGold) ? "1px solid #fbbf24" : "1px solid #fed7aa",
                fontWeight: param.scoringAnchors.some(a => a.isGold) ? 600 : 400,
              }}>
                {param.scoringAnchors.some(a => a.isGold) ? "★ " : "⚖️ "}
                {param._counts.scoringAnchors} anchors
              </span>
            )}
            {param._counts.promptSlugs > 0 && (() => {
              const totalRanges = param.promptSlugs.reduce((sum, s) => sum + (s.rangeCount || 0), 0);
              return (
                <span style={{
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 10,
                  background: totalRanges > 0 ? "#fdf4ff" : "#f9fafb",
                  color: "#86198f",
                  border: totalRanges > 0 ? "1px solid #f5d0fe" : "1px solid #e5e7eb",
                }}>
                  📝 {param._counts.promptSlugs} slugs
                  {totalRanges > 0 && <span style={{ opacity: 0.7 }}> ({totalRanges} ranges)</span>}
                </span>
              );
            })()}
            {!hasRelationships && (
              <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "#fee2e2", color: "#991b1b" }}>
                orphan
              </span>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ padding: 0, background: "#f9fafb" }}>
            <div style={{ padding: "16px 16px 16px 40px" }}>
              {/* Definition */}
              {param.definition && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" }}>Definition</div>
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{param.definition}</div>
                </div>
              )}

              {/* Interpretation */}
              {(param.interpretationHigh || param.interpretationLow) && (
                <div style={{ marginBottom: 16, display: "flex", gap: 24 }}>
                  {param.interpretationHigh && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", marginBottom: 4 }}>HIGH means</div>
                      <div style={{ fontSize: 12, color: "#374151" }}>{param.interpretationHigh}</div>
                    </div>
                  )}
                  {param.interpretationLow && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", marginBottom: 4 }}>LOW means</div>
                      <div style={{ fontSize: 12, color: "#374151" }}>{param.interpretationLow}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Specs using this parameter */}
              {param.specs.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase" }}>
                    Used in Analysis Specs ({param.specs.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {param.specs.map((spec) => (
                      <Link
                        key={spec.id}
                        href={`/analysis-specs?select=${spec.id}`}
                        style={{ textDecoration: "none" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 12,
                            background: spec.outputType === "MEASURE" ? "#eef2ff" : spec.outputType === "ADAPT" ? "#ccfbf1" : "#fffbeb",
                            color: spec.outputType === "MEASURE" ? "#4338ca" : spec.outputType === "ADAPT" ? "#0d9488" : "#92400e",
                            border: `1px solid ${spec.outputType === "MEASURE" ? "#c7d2fe" : spec.outputType === "ADAPT" ? "#99f6e4" : "#fde68a"}`,
                            opacity: spec.isActive ? 1 : 0.5,
                          }}
                        >
                          {spec.name}
                          <span style={{ marginLeft: 4, opacity: 0.6 }}>({spec.outputType})</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Playbooks */}
              {param.playbooks.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase" }}>
                    Included in Playbooks ({param.playbooks.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {param.playbooks.map((pb) => (
                      <Link
                        key={pb.id}
                        href={`/playbooks/${pb.id}`}
                        style={{ textDecoration: "none" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 12,
                            background: "#fff7ed",
                            color: "#c2410c",
                            border: "1px solid #fed7aa",
                          }}
                        >
                          {pb.name}
                          {pb.domain && <span style={{ marginLeft: 4, opacity: 0.6 }}>({pb.domain.name})</span>}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Behavior Targets */}
              {param.behaviorTargets.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#166534", textTransform: "uppercase" }}>
                      🎯 Behavior Targets ({param.behaviorTargets.length})
                    </div>
                    {param.behaviorTargets.length > 2 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowTargetDetails(!showTargetDetails); }}
                        style={{
                          padding: "3px 8px",
                          borderRadius: 4,
                          border: "1px solid #bbf7d0",
                          background: showTargetDetails ? "#dcfce7" : "#fff",
                          color: "#166534",
                          fontSize: 10,
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        {showTargetDetails ? "Collapse" : "Expand details"}
                      </button>
                    )}
                  </div>
                  {/* Compact view: scope badges with values */}
                  {!showTargetDetails && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {param.behaviorTargets.map((target) => (
                        <span
                          key={target.id}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 12,
                            background: target.scope === "SYSTEM" ? "#dbeafe" : target.scope === "PLAYBOOK" ? "#f0fdf4" : "#fef3c7",
                            color: target.scope === "SYSTEM" ? "#1e40af" : target.scope === "PLAYBOOK" ? "#166534" : "#92400e",
                            border: `1px solid ${target.scope === "SYSTEM" ? "#93c5fd" : target.scope === "PLAYBOOK" ? "#bbf7d0" : "#fde68a"}`,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{target.scope[0]}</span>
                          <span style={{ marginLeft: 4 }}>{(target.targetValue * 100).toFixed(0)}%</span>
                          {target.playbook && <span style={{ marginLeft: 4, opacity: 0.6 }}>({target.playbook.name})</span>}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Expanded view: full details with bars */}
                  {showTargetDetails && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {param.behaviorTargets.map((target) => (
                        <div
                          key={target.id}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            background: "#fff",
                            border: "1px solid #e5e7eb",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          {/* Scope badge */}
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 600,
                              background: target.scope === "SYSTEM" ? "#dbeafe" : target.scope === "PLAYBOOK" ? "#dcfce7" : "#fef3c7",
                              color: target.scope === "SYSTEM" ? "#1e40af" : target.scope === "PLAYBOOK" ? "#166534" : "#92400e",
                              minWidth: 70,
                              textAlign: "center",
                            }}
                          >
                            {target.scope}
                          </span>
                          {/* Value bar */}
                          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              flex: 1,
                              height: 8,
                              background: "#f3f4f6",
                              borderRadius: 4,
                              overflow: "hidden",
                            }}>
                              <div style={{
                                width: `${target.targetValue * 100}%`,
                                height: "100%",
                                background: target.scope === "SYSTEM" ? "#3b82f6" : target.scope === "PLAYBOOK" ? "#22c55e" : "#f59e0b",
                                borderRadius: 4,
                              }} />
                            </div>
                            <span style={{
                              fontWeight: 700,
                              fontFamily: "ui-monospace, monospace",
                              fontSize: 13,
                              minWidth: 36,
                            }}>
                              {(target.targetValue * 100).toFixed(0)}%
                            </span>
                          </div>
                          {/* Confidence */}
                          <span style={{ fontSize: 10, color: "#9ca3af" }}>
                            conf: {(target.confidence * 100).toFixed(0)}%
                          </span>
                          {/* Source */}
                          <span style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 9,
                            background: "#f3f4f6",
                            color: "#6b7280",
                          }}>
                            {target.source}
                          </span>
                          {/* Playbook link */}
                          {target.playbook && (
                            <Link
                              href={`/playbooks/${target.playbook.id}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ textDecoration: "none" }}
                            >
                              <span style={{
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontSize: 10,
                                background: "#fff7ed",
                                color: "#c2410c",
                                border: "1px solid #fed7aa",
                              }}>
                                {target.playbook.name}
                              </span>
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Scoring Anchors */}
              {param.scoringAnchors.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#92400e", textTransform: "uppercase" }}>
                      ⚖️ Scoring Anchors ({param.scoringAnchors.length})
                    </div>
                    {param.scoringAnchors.length > 3 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowAllAnchors(!showAllAnchors); }}
                        style={{
                          padding: "3px 8px",
                          borderRadius: 4,
                          border: "1px solid #fde68a",
                          background: showAllAnchors ? "#fef3c7" : "#fff",
                          color: "#92400e",
                          fontSize: 10,
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        {showAllAnchors ? "Show less" : `Show all ${param.scoringAnchors.length}`}
                      </button>
                    )}
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 10,
                    maxHeight: showAllAnchors ? "none" : 320,
                    overflow: showAllAnchors ? "visible" : "hidden",
                    position: "relative",
                  }}>
                    {(showAllAnchors ? param.scoringAnchors : param.scoringAnchors.slice(0, 6))
                      .sort((a, b) => b.score - a.score) // Sort by score descending
                      .map((anchor) => (
                      <div
                        key={anchor.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: anchor.isGold ? "#fffbeb" : "#fff",
                          border: anchor.isGold ? "2px solid #fbbf24" : "1px solid #e5e7eb",
                          fontSize: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {/* Score bar */}
                            <div style={{
                              width: 40,
                              height: 6,
                              background: "#f3f4f6",
                              borderRadius: 3,
                              overflow: "hidden",
                            }}>
                              <div style={{
                                width: `${anchor.score * 100}%`,
                                height: "100%",
                                background: anchor.score >= 0.7 ? "#22c55e" : anchor.score >= 0.4 ? "#eab308" : "#ef4444",
                                borderRadius: 3,
                              }} />
                            </div>
                            <span style={{
                              fontWeight: 700,
                              color: anchor.score >= 0.7 ? "#16a34a" : anchor.score >= 0.4 ? "#ca8a04" : "#dc2626",
                              fontFamily: "ui-monospace, monospace",
                              fontSize: 13,
                            }}>
                              {anchor.score.toFixed(2)}
                            </span>
                          </div>
                          {anchor.isGold && (
                            <span style={{
                              color: "#fbbf24",
                              fontSize: 11,
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: 2,
                            }}>
                              ★ Gold
                            </span>
                          )}
                        </div>
                        <div style={{
                          color: "#374151",
                          fontSize: 12,
                          lineHeight: 1.4,
                          background: "#f9fafb",
                          padding: "6px 8px",
                          borderRadius: 4,
                        }}>
                          &ldquo;{anchor.example}&rdquo;
                        </div>
                        {anchor.rationale && (
                          <div style={{
                            color: "#6b7280",
                            fontSize: 11,
                            fontStyle: "italic",
                            paddingTop: 2,
                          }}>
                            {anchor.rationale}
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Fade overlay when collapsed and more items */}
                    {!showAllAnchors && param.scoringAnchors.length > 6 && (
                      <div style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 60,
                        background: "linear-gradient(to bottom, transparent, #f9fafb)",
                        pointerEvents: "none",
                      }} />
                    )}
                  </div>
                  {!showAllAnchors && param.scoringAnchors.length > 6 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowAllAnchors(true); }}
                      style={{
                        marginTop: 8,
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid #fde68a",
                        background: "#fffbeb",
                        color: "#92400e",
                        fontSize: 12,
                        cursor: "pointer",
                        fontWeight: 500,
                        width: "100%",
                      }}
                    >
                      Show {param.scoringAnchors.length - 6} more anchors...
                    </button>
                  )}
                </div>
              )}

              {/* Prompt Slugs with Ranges */}
              {param.promptSlugs.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#86198f", marginBottom: 8, textTransform: "uppercase" }}>
                    📝 Prompt Slugs ({param.promptSlugs.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {param.promptSlugs.map((slug) => {
                      const isSlugExpanded = expandedSlugs.has(slug.id);
                      const hasRanges = slug.ranges && slug.ranges.length > 0;

                      return (
                        <div
                          key={slug.id}
                          style={{
                            background: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            overflow: "hidden",
                          }}
                        >
                          {/* Slug header */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasRanges) toggleSlugExpanded(slug.id);
                            }}
                            style={{
                              padding: "10px 12px",
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              cursor: hasRanges ? "pointer" : "default",
                              background: isSlugExpanded ? "#fdf4ff" : "transparent",
                            }}
                          >
                            {hasRanges && (
                              <span style={{ color: "#9ca3af", fontSize: 10 }}>
                                {isSlugExpanded ? "▼" : "▶"}
                              </span>
                            )}
                            <Link
                              href={`/prompt-slugs?select=${slug.id}`}
                              style={{ textDecoration: "none" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span style={{
                                fontWeight: 600,
                                color: "#86198f",
                                fontSize: 13,
                              }}>
                                {slug.name || slug.slug}
                              </span>
                            </Link>
                            {/* Weight & Mode badges */}
                            <span style={{
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: 9,
                              background: "#f3f4f6",
                              color: "#6b7280",
                            }}>
                              {slug.mode} × {slug.weight}
                            </span>
                            {hasRanges && (
                              <span style={{
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontSize: 9,
                                background: "#fdf4ff",
                                color: "#86198f",
                                border: "1px solid #f5d0fe",
                              }}>
                                {slug.ranges.length} ranges
                              </span>
                            )}
                            {slug.memoryCategory && (
                              <span style={{
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontSize: 9,
                                background: "#ecfdf5",
                                color: "#059669",
                              }}>
                                📦 {slug.memoryCategory}
                              </span>
                            )}
                          </div>

                          {/* Expanded ranges */}
                          {isSlugExpanded && hasRanges && (
                            <div style={{
                              borderTop: "1px solid #f3f4f6",
                              background: "#fafafa",
                            }}>
                              {slug.ranges.map((range, idx) => (
                                <div
                                  key={range.id}
                                  style={{
                                    padding: "10px 12px 10px 32px",
                                    borderBottom: idx < slug.ranges.length - 1 ? "1px solid #f3f4f6" : "none",
                                    display: "flex",
                                    gap: 12,
                                  }}
                                >
                                  {/* Range indicator */}
                                  <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    minWidth: 60,
                                  }}>
                                    {/* Range bar */}
                                    <div style={{
                                      width: 50,
                                      height: 6,
                                      background: "#e5e7eb",
                                      borderRadius: 3,
                                      position: "relative",
                                      marginBottom: 4,
                                    }}>
                                      <div style={{
                                        position: "absolute",
                                        left: `${range.minValue * 100}%`,
                                        right: `${(1 - range.maxValue) * 100}%`,
                                        height: "100%",
                                        background: range.minValue >= 0.7 ? "#22c55e" : range.maxValue <= 0.3 ? "#ef4444" : "#eab308",
                                        borderRadius: 3,
                                      }} />
                                    </div>
                                    <span style={{
                                      fontSize: 10,
                                      color: "#6b7280",
                                      fontFamily: "ui-monospace, monospace",
                                    }}>
                                      {(range.minValue * 100).toFixed(0)}–{(range.maxValue * 100).toFixed(0)}%
                                    </span>
                                    {range.label && (
                                      <span style={{
                                        fontSize: 9,
                                        color: "#9ca3af",
                                        marginTop: 2,
                                      }}>
                                        {range.label}
                                      </span>
                                    )}
                                  </div>
                                  {/* Prompt text */}
                                  <div style={{
                                    flex: 1,
                                    fontSize: 12,
                                    color: "#374151",
                                    lineHeight: 1.4,
                                    background: "#fff",
                                    padding: "8px 10px",
                                    borderRadius: 6,
                                    border: "1px solid #e5e7eb",
                                    maxHeight: 80,
                                    overflow: "auto",
                                  }}>
                                    {range.prompt.length > 200
                                      ? `${range.prompt.slice(0, 200)}...`
                                      : range.prompt}
                                  </div>
                                </div>
                              ))}
                              {/* Fallback prompt if exists */}
                              {slug.fallbackPrompt && (
                                <div style={{
                                  padding: "8px 12px 8px 32px",
                                  background: "#fef3c7",
                                  borderTop: "1px solid #fde68a",
                                  fontSize: 11,
                                  color: "#92400e",
                                }}>
                                  <span style={{ fontWeight: 600 }}>Fallback:</span>{" "}
                                  {slug.fallbackPrompt.length > 100
                                    ? `${slug.fallbackPrompt.slice(0, 100)}...`
                                    : slug.fallbackPrompt}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No relationships warning */}
              {!hasRelationships && (
                <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", fontSize: 13 }}>
                  ⚠️ This parameter is not referenced by any specs, playbooks, or behavior targets. Consider removing it or connecting it to the system.
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Spec Dependency Row Component
function SpecDependencyRow({ spec }: { spec: SpecDependency }) {
  const [expanded, setExpanded] = useState(false);

  const typeColors: Record<string, { bg: string; text: string }> = {
    MEASURE: { bg: "#eef2ff", text: "#4338ca" },
    LEARN: { bg: "#ede9fe", text: "#5b21b6" },
    ADAPT: { bg: "#ccfbf1", text: "#0d9488" },
    COMPOSE: { bg: "#fce7f3", text: "#be185d" },
  };

  const colors = typeColors[spec.outputType] || { bg: "#f3f4f6", text: "#374151" };
  const hasDependencies = spec.variables.length > 0 || spec.prefixes.length > 0;

  return (
    <div style={{ borderBottom: "1px solid #f3f4f6" }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "12px 16px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: expanded ? "#f9fafb" : "transparent",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
        onMouseLeave={(e) => (e.currentTarget.style.background = expanded ? "#f9fafb" : "transparent")}
      >
        <span style={{ color: "#9ca3af", fontSize: 10 }}>{expanded ? "▼" : "▶"}</span>
        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: colors.bg, color: colors.text }}>
          {spec.outputType}
        </span>
        <span style={{ fontWeight: 500, color: "#1f2937", flex: 1 }}>{spec.name}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {spec.variables.length > 0 && (
            <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "#f1f5f9", color: "#475569" }}>
              {spec.variables.length} vars
            </span>
          )}
          {spec.prefixes.length > 0 && (
            <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "#fef3c7", color: "#92400e" }}>
              {spec.prefixes.length} prefix
            </span>
          )}
          {!hasDependencies && (
            <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "#fee2e2", color: "#991b1b" }}>
              no deps
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "12px 16px 16px 44px", background: "#f9fafb" }}>
          {/* Variables */}
          {spec.variables.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                Template Variables ({spec.variables.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {spec.variables.map((v) => (
                  <code
                    key={v}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      background: "#f1f5f9",
                      color: "#475569",
                      fontFamily: "monospace",
                    }}
                  >
                    {v}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Prefixes */}
          {spec.prefixes.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                Key Prefixes ({spec.prefixes.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {spec.prefixes.map((p) => (
                  <code
                    key={p}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      background: "#fef3c7",
                      color: "#92400e",
                      fontFamily: "monospace",
                    }}
                  >
                    {p}
                  </code>
                ))}
              </div>
            </div>
          )}

          {!hasDependencies && (
            <div style={{ color: "#9ca3af", fontSize: 12, fontStyle: "italic" }}>
              This spec has no detected taxonomy dependencies
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Playbook Dependency Row Component
function PlaybookDependencyRow({ playbook }: { playbook: PlaybookDependency }) {
  const [expanded, setExpanded] = useState(false);

  const hasDependencies = playbook.specs.length > 0 || playbook.templates.length > 0;

  return (
    <div style={{ borderBottom: "1px solid #f3f4f6" }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "12px 16px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: expanded ? "#f9fafb" : "transparent",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
        onMouseLeave={(e) => (e.currentTarget.style.background = expanded ? "#f9fafb" : "transparent")}
      >
        <span style={{ color: "#9ca3af", fontSize: 10 }}>{expanded ? "▼" : "▶"}</span>
        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "#fff7ed", color: "#c2410c" }}>
          v{playbook.version}
        </span>
        <span style={{ fontWeight: 500, color: "#1f2937", flex: 1 }}>{playbook.name}</span>
        {playbook.domain && (
          <span style={{ fontSize: 11, color: "#6b7280" }}>{playbook.domain}</span>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          {playbook.specs.length > 0 && (
            <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "#eef2ff", color: "#4338ca" }}>
              {playbook.specs.length} specs
            </span>
          )}
          {playbook.templates.length > 0 && (
            <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "#f0fdf4", color: "#166534" }}>
              {playbook.templates.length} templates
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "12px 16px 16px 44px", background: "#f9fafb" }}>
          {/* Specs */}
          {playbook.specs.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                Analysis Specs ({playbook.specs.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {playbook.specs.map((s) => {
                  const typeColors: Record<string, { bg: string; text: string; border: string }> = {
                    MEASURE: { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
                    LEARN: { bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe" },
                    ADAPT: { bg: "#ccfbf1", text: "#0d9488", border: "#99f6e4" },
                    COMPOSE: { bg: "#fce7f3", text: "#be185d", border: "#fbcfe8" },
                  };
                  const c = typeColors[s.outputType] || { bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" };
                  return (
                    <Link key={s.id} href={`/analysis-specs?select=${s.id}`} style={{ textDecoration: "none" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          background: c.bg,
                          color: c.text,
                          border: `1px solid ${c.border}`,
                        }}
                      >
                        {s.name}
                        <span style={{ marginLeft: 4, opacity: 0.6 }}>({s.outputType})</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Templates */}
          {playbook.templates.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                Prompt Templates ({playbook.templates.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {playbook.templates.map((t) => (
                  <Link key={t.id} href={`/prompt-templates?select=${t.id}`} style={{ textDecoration: "none" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        background: "#f0fdf4",
                        color: "#166534",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      {t.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!hasDependencies && (
            <div style={{ color: "#9ca3af", fontSize: 12, fontStyle: "italic" }}>
              This playbook has no items
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DataDictionaryPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>("parameters");
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Parameters state
  const [parameters, setParameters] = useState<ParameterData[]>([]);
  const [parameterSummary, setParameterSummary] = useState<ParameterSummary | null>(null);
  const [parametersLoading, setParametersLoading] = useState(false);
  const [showOrphansOnly, setShowOrphansOnly] = useState(false);
  const [showAnchorsOnly, setShowAnchorsOnly] = useState(false);

  // Dependencies state
  const [specDeps, setSpecDeps] = useState<SpecDependency[]>([]);
  const [playbookDeps, setPlaybookDeps] = useState<PlaybookDependency[]>([]);
  const [depsLoading, setDepsLoading] = useState(false);
  const [depsView, setDepsView] = useState<"specs" | "playbooks">("specs");
  const [depsTypeFilter, setDepsTypeFilter] = useState<string | null>(null);

  // Fetch parameters on mount
  useEffect(() => {
    async function fetchParameters() {
      setParametersLoading(true);
      try {
        const res = await fetch("/api/data-dictionary/parameters");
        const data = await res.json();
        if (data.ok) {
          setParameters(data.parameters);
          setParameterSummary(data.summary);
        }
      } catch (e) {
        console.error("Failed to fetch parameters:", e);
      } finally {
        setParametersLoading(false);
      }
    }
    fetchParameters();
  }, []);

  // Fetch dependencies on mount (for accurate tab counts)
  useEffect(() => {
    async function fetchDependencies() {
      setDepsLoading(true);
      try {
        const res = await fetch("/api/data-dictionary/dependencies");
        const data = await res.json();
        if (data.ok) {
          setSpecDeps(data.specs);
          setPlaybookDeps(data.playbooks);
        }
      } catch (e) {
        console.error("Failed to fetch dependencies:", e);
      } finally {
        setDepsLoading(false);
      }
    }
    fetchDependencies();
  }, []);

  // Get unique categories for current tab
  const variableCategories = [...new Set(TEMPLATE_VARIABLES.map(v => v.category))];
  const prefixCategories = [...new Set(KEY_PREFIXES.map(p => p.category))];
  const parameterDomainGroups = [...new Set(parameters.map(p => p.domainGroup))];

  // Filter based on search and category
  const filteredVariables = TEMPLATE_VARIABLES.filter(v => {
    const matchesSearch = !searchTerm ||
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.context.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || v.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredPrefixes = KEY_PREFIXES.filter(p => {
    const matchesSearch = !searchTerm ||
      p.prefix.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.examples.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.purpose.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filter parameters
  const filteredParameters = parameters.filter(p => {
    const matchesSearch = !searchTerm ||
      p.parameterId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.definition && p.definition.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !selectedCategory || p.domainGroup === selectedCategory;
    const matchesOrphan = !showOrphansOnly || (p._counts.specs === 0 && p._counts.playbooks === 0 && p._counts.behaviorTargets === 0 && p._counts.promptSlugs === 0);
    const matchesAnchors = !showAnchorsOnly || p._counts.scoringAnchors > 0;
    return matchesSearch && matchesCategory && matchesOrphan && matchesAnchors;
  });

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <SourcePageHeader
        title="Taxonomy"
        description="Parameters, template variables, and memory key patterns used throughout the system. Click any row to see where it's used."
        dataNodeId="data:dictionary"
        actions={
          <Link
            href="/x/taxonomy-graph"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              background: "#4f46e5",
              color: "#fff",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
              transition: "background 0.2s",
            }}
          >
            <span>🕸️</span>
            Visualise
          </Link>
        }
      />

      {/* Tabs */}
      <DraggableTabs
        storageKey="data-dictionary-tabs"
        tabs={[
          { id: "parameters", label: `📐 Parameters (${parameters.length})` },
          { id: "variables", label: `🔤 Template Variables (${TEMPLATE_VARIABLES.length})` },
          { id: "prefixes", label: `🏷️ Key Prefixes (${KEY_PREFIXES.length})` },
          { id: "entities", label: `📦 Entity Usage (${ENTITY_USAGE.length})` },
          { id: "dependencies", label: `🔗 Dependencies (${specDeps.filter(s => s.variables.length > 0 || s.prefixes.length > 0).length + playbookDeps.filter(pb => pb.specs.length > 0 || pb.templates.length > 0).length})` },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => { setActiveTab(id as TabKey); setSelectedCategory(null); setSearchTerm(""); }}
        containerStyle={{ marginBottom: 20 }}
      />

      {/* Search & Filter */}
      {activeTab !== "entities" && (
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder={activeTab === "parameters" ? "Search by ID, name, or definition..." : "Search..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 14,
              width: 300,
            }}
          />
          {/* Filters for parameters */}
          {activeTab === "parameters" && (
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={showAnchorsOnly}
                  onChange={(e) => { setShowAnchorsOnly(e.target.checked); if (e.target.checked) setShowOrphansOnly(false); }}
                  style={{ accentColor: "#92400e" }}
                />
                <span style={{ color: showAnchorsOnly ? "#92400e" : "#6b7280" }}>⚖️ With anchors</span>
                {parameterSummary && (
                  <span style={{ color: "#9ca3af" }}>({parameterSummary.withAnchors})</span>
                )}
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={showOrphansOnly}
                  onChange={(e) => { setShowOrphansOnly(e.target.checked); if (e.target.checked) setShowAnchorsOnly(false); }}
                  style={{ accentColor: "#dc2626" }}
                />
                <span style={{ color: showOrphansOnly ? "#dc2626" : "#6b7280" }}>Orphans only</span>
                {parameterSummary && (
                  <span style={{ color: "#9ca3af" }}>({parameterSummary.orphaned})</span>
                )}
              </label>
            </div>
          )}
          {/* Back button when category selected */}
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: "#fff",
                fontSize: 12,
                cursor: "pointer",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 14 }}>←</span> Back to All
            </button>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => setSelectedCategory(null)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: selectedCategory === null ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                background: selectedCategory === null ? "#eef2ff" : "#fff",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              All
            </button>
            {(activeTab === "parameters" ? parameterDomainGroups : activeTab === "variables" ? variableCategories : prefixCategories).map(cat => {
              const colors = CATEGORY_COLORS[cat] || { bg: "#f3f4f6", text: "#374151" };
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: selectedCategory === cat ? `2px solid ${colors.text}` : "1px solid #e5e7eb",
                    background: selectedCategory === cat ? colors.bg : "#fff",
                    color: selectedCategory === cat ? colors.text : "#374151",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: selectedCategory === cat ? 600 : 400,
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Hint */}
      {activeTab !== "entities" && activeTab !== "parameters" && (
        <div style={{ marginBottom: 16, padding: "8px 12px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 6, fontSize: 12, color: "#0369a1" }}>
          Click any row to expand and see cross-references (Analysis Specs, Prompt Templates, Playbooks)
        </div>
      )}

      {/* Parameters Summary */}
      {activeTab === "parameters" && parameterSummary && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
            <div>
              <span style={{ color: "#6b7280" }}>Total:</span>{" "}
              <span style={{ fontWeight: 600 }}>{parameterSummary.total}</span>
            </div>
            <div>
              <span style={{ color: "#6b7280" }}>With Specs:</span>{" "}
              <span style={{ fontWeight: 600, color: "#4338ca" }}>{parameterSummary.withSpecs}</span>
            </div>
            <div>
              <span style={{ color: "#6b7280" }}>With Playbooks:</span>{" "}
              <span style={{ fontWeight: 600, color: "#c2410c" }}>{parameterSummary.withPlaybooks}</span>
            </div>
            <div>
              <span style={{ color: "#6b7280" }}>With Targets:</span>{" "}
              <span style={{ fontWeight: 600, color: "#166534" }}>{parameterSummary.withTargets}</span>
            </div>
            <div>
              <span style={{ color: "#6b7280" }}>With Anchors:</span>{" "}
              <span style={{ fontWeight: 600, color: "#92400e" }}>{parameterSummary.withAnchors}</span>
            </div>
            <div>
              <span style={{ color: "#dc2626" }}>Orphaned:</span>{" "}
              <span style={{ fontWeight: 600, color: "#dc2626" }}>{parameterSummary.orphaned}</span>
            </div>
          </div>
        </div>
      )}

      {/* Parameters Tab */}
      {activeTab === "parameters" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          {parametersLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading parameters...</div>
          ) : (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Parameter ID</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Name</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Domain</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Scale</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Relationships</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParameters.map((param) => (
                    <ParameterRow key={param.parameterId} param={param} />
                  ))}
                </tbody>
              </table>
              {filteredParameters.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  {parameters.length === 0 ? "No parameters found" : "No parameters match your filters"}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Template Variables Tab */}
      {activeTab === "variables" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Variable</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Type</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Context</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Example</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Category</th>
              </tr>
            </thead>
            <tbody>
              {filteredVariables.map((v, i) => (
                <VariableRow key={i} v={v} />
              ))}
            </tbody>
          </table>
          {filteredVariables.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No variables match your search</div>
          )}
        </div>
      )}

      {/* Key Prefixes Tab */}
      {activeTab === "prefixes" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Prefix</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Category</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Examples</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrefixes.map((p, i) => (
                <PrefixRow key={i} p={p} />
              ))}
            </tbody>
          </table>
          {filteredPrefixes.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No prefixes match your search</div>
          )}
        </div>
      )}

      {/* Entity Usage Tab */}
      {activeTab === "entities" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Entity</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Stores</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Uses Variables</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Uses Prefixes</th>
              </tr>
            </thead>
            <tbody>
              {ENTITY_USAGE.map((e, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 16px" }}>
                    <code style={{ background: "#e0e7ff", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", color: "#4338ca" }}>
                      {e.entity}
                    </code>
                  </td>
                  <td style={{ padding: "10px 16px", color: "#6b7280", fontSize: 12 }}>{e.stores}</td>
                  <td style={{ padding: "10px 16px", color: "#374151" }}>{e.usesVariables}</td>
                  <td style={{ padding: "10px 16px", color: "#6b7280" }}>{e.usesPrefixes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dependencies Tab */}
      {activeTab === "dependencies" && (
        <div>
          {/* Sub-tabs: Specs vs Playbooks */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => { setDepsView("specs"); setDepsTypeFilter(null); }}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: depsView === "specs" ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                background: depsView === "specs" ? "#eef2ff" : "#fff",
                color: depsView === "specs" ? "#4f46e5" : "#374151",
                fontWeight: 500,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Specs ({specDeps.filter(s => s.variables.length > 0 || s.prefixes.length > 0).length})
            </button>
            <button
              onClick={() => { setDepsView("playbooks"); setDepsTypeFilter(null); }}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: depsView === "playbooks" ? "2px solid #c2410c" : "1px solid #e5e7eb",
                background: depsView === "playbooks" ? "#fff7ed" : "#fff",
                color: depsView === "playbooks" ? "#c2410c" : "#374151",
                fontWeight: 500,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Playbooks ({playbookDeps.filter(pb => pb.specs.length > 0 || pb.templates.length > 0).length})
            </button>
          </div>

          {/* Type filters for specs */}
          {depsView === "specs" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              <button
                onClick={() => setDepsTypeFilter(null)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 4,
                  border: depsTypeFilter === null ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                  background: depsTypeFilter === null ? "#eef2ff" : "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                All
              </button>
              {["MEASURE", "LEARN", "ADAPT", "COMPOSE"].map((type) => (
                <button
                  key={type}
                  onClick={() => setDepsTypeFilter(depsTypeFilter === type ? null : type)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: depsTypeFilter === type ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                    background: depsTypeFilter === type ? "#eef2ff" : "#fff",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  {type} ({specDeps.filter((s) => s.outputType === type && (s.variables.length > 0 || s.prefixes.length > 0)).length})
                </button>
              ))}
            </div>
          )}

          {/* Info hint */}
          <div style={{ marginBottom: 16, padding: "8px 12px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, fontSize: 12, color: "#92400e" }}>
            🔗 This view shows what each spec/playbook <strong>depends on</strong> (parameters, variables, prefixes). Click to expand.
          </div>

          {depsLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading dependencies...</div>
          ) : depsView === "specs" ? (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              {specDeps
                .filter((s) => s.variables.length > 0 || s.prefixes.length > 0)
                .filter((s) => !depsTypeFilter || s.outputType === depsTypeFilter)
                .map((spec) => (
                  <SpecDependencyRow key={spec.id} spec={spec} />
                ))}
              {specDeps.filter((s) => s.variables.length > 0 || s.prefixes.length > 0).filter((s) => !depsTypeFilter || s.outputType === depsTypeFilter).length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No specs with dependencies found</div>
              )}
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              {playbookDeps
                .filter((pb) => pb.specs.length > 0 || pb.templates.length > 0)
                .map((pb) => (
                  <PlaybookDependencyRow key={pb.id} playbook={pb} />
                ))}
              {playbookDeps.filter((pb) => pb.specs.length > 0 || pb.templates.length > 0).length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No playbooks with dependencies found</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div style={{ marginTop: 24, padding: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#166534", marginBottom: 8 }}>Template Rendering</div>
        <div style={{ fontSize: 13, color: "#166534", lineHeight: 1.6 }}>
          Templates are processed by <code style={{ background: "#dcfce7", padding: "1px 4px", borderRadius: 3 }}>PromptTemplateCompiler</code> in this order:
          <ol style={{ margin: "8px 0", paddingLeft: 20 }}>
            <li>Conditionals: <code>{`{{#if condition}}...{{/if}}`}</code></li>
            <li>Inverse conditionals: <code>{`{{#unless condition}}...{{/unless}}`}</code></li>
            <li>Loops: <code>{`{{#each array}}...{{/each}}`}</code></li>
            <li>Variable substitution: <code>{`{{variable}}`}</code> or <code>{`{{nested.path}}`}</code></li>
            <li>Cleanup: Removes unmatched tags, cleans extra whitespace</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
