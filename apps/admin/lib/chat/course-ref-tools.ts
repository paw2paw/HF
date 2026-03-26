/**
 * Course Reference Builder Tools
 *
 * Tool set for the COURSE_REF chat mode. The AI uses these to
 * progressively build a COURSE_REFERENCE document through interview.
 *
 * Tools:
 * - update_ref: Save/update a section of the course reference
 * - show_ref_preview: Show the current state of a section in the preview panel
 * - check_completeness: Check which mandatory sections are filled
 * - finalize_ref: Finalize and create the course + reference
 * - show_suggestions: Quick-reply chips (reused pattern)
 */

import type { AITool } from "@/lib/ai/client";

export const COURSE_REF_TOOLS: AITool[] = [
  {
    name: "update_ref",
    description:
      "Save or update a section of the course reference document. " +
      "Call this EVERY time the educator provides information for a section. " +
      "Do not batch — save immediately after each meaningful exchange. " +
      "Valid section keys: courseOverview, learningOutcomes, skillsFramework, " +
      "skillDependencies, teachingApproach, coursePhases, edgeCases, " +
      "communicationRules, assessmentBoundaries, metrics. " +
      "For nested sections, use the top-level key and include the full sub-object. " +
      "For array sections (skillsFramework, edgeCases, coursePhases), " +
      "send the COMPLETE array each time (replace, not append).",
    input_schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          description: "The skeleton section key to update.",
          enum: [
            "courseOverview",
            "learningOutcomes",
            "skillsFramework",
            "skillDependencies",
            "teachingApproach",
            "coursePhases",
            "edgeCases",
            "communicationRules",
            "assessmentBoundaries",
            "metrics",
            "moduleDescriptors",
          ],
        },
        data: {
          type: "object",
          description: "The section data matching the COURSE_REFERENCE skeleton shape.",
          additionalProperties: true,
        },
      },
      required: ["section", "data"],
    },
  },
  {
    name: "show_ref_preview",
    description:
      "Update the preview panel to show the current state of one or more sections. " +
      "Call after update_ref to refresh the right-side panel. " +
      "Pass 'all' to show the full document preview.",
    input_schema: {
      type: "object",
      properties: {
        sections: {
          type: "array",
          items: { type: "string" },
          description: "Section keys to preview, or ['all'] for full preview.",
        },
      },
      required: ["sections"],
    },
  },
  {
    name: "check_completeness",
    description:
      "Check which sections of the course reference are complete, partial, or empty. " +
      "Returns a completeness report including which mandatory sections are missing. " +
      "Call before finalize_ref to ensure the document is ready.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "finalize_ref",
    description:
      "Finalize the course reference and create the course. " +
      "This creates: institution + domain (if new), playbook, caller, " +
      "content source (COURSE_REFERENCE), and content assertions. " +
      "Only call when check_completeness reports all mandatory sections filled. " +
      "The educator must have confirmed the document in the preview panel.",
    input_schema: {
      type: "object",
      properties: {
        institutionName: {
          type: "string",
          description: "Institution/school name. Required if no courseId provided.",
        },
        courseName: {
          type: "string",
          description: "Course name. Required if no courseId provided.",
        },
        courseId: {
          type: "string",
          description: "Existing course ID. If provided, attaches reference to existing course.",
        },
      },
      required: [],
    },
  },
  {
    name: "show_suggestions",
    description:
      "Show clickable quick-reply chips above the chat input. " +
      "ONLY for confirmation and navigation chips. " +
      "Good: 'Looks right', 'Let me correct that', 'Move on', 'Add another skill'. " +
      "Never use for presenting choices that need explanation.",
    input_schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "Brief context shown above the chips.",
        },
        suggestions: {
          type: "array",
          items: { type: "string" },
          description: "2-4 short chip labels.",
        },
      },
      required: ["question", "suggestions"],
    },
  },
];
