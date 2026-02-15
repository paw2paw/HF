/**
 * Admin Tool Definitions
 *
 * Tool schemas for the Cmd+K AI assistant (DATA mode).
 * Used with Anthropic's native tool calling format.
 */

import type { AITool } from "@/lib/ai/client";

export const ADMIN_TOOLS: AITool[] = [
  {
    name: "query_specs",
    description:
      "Search and list analysis specs. Use to find specs by role, name, slug, or domain. Returns id, name, slug, specRole, extendsAgent, and a config summary.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Filter by name (case-insensitive, partial match)",
        },
        spec_role: {
          type: "string",
          enum: ["IDENTITY", "CONTENT", "EXTRACT", "SYNTHESISE", "CONSTRAIN", "ORCHESTRATE", "VOICE"],
          description: "Filter by spec role",
        },
        slug: {
          type: "string",
          description: "Filter by slug (case-insensitive, partial match)",
        },
        is_active: {
          type: "boolean",
          description: "Filter by active status (default: true)",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 10, max: 25)",
        },
      },
    },
  },
  {
    name: "get_spec_config",
    description:
      "Get the full config JSON for a specific spec by ID. Use this before proposing changes to see the current state.",
    input_schema: {
      type: "object",
      properties: {
        spec_id: {
          type: "string",
          description: "The spec ID (UUID)",
        },
      },
      required: ["spec_id"],
    },
  },
  {
    name: "update_spec_config",
    description:
      "Update a spec's config JSON by merging new values. Only updates the fields you provide — other fields are preserved. ALWAYS show the user what will change and get confirmation before calling this tool.",
    input_schema: {
      type: "object",
      properties: {
        spec_id: {
          type: "string",
          description: "The spec ID to update",
        },
        config_updates: {
          type: "object",
          description:
            "Fields to merge into the config. Example: { styleGuidelines: [...], constraints: [...] }",
        },
        reason: {
          type: "string",
          description: "Why this change is being made (for audit trail)",
        },
      },
      required: ["spec_id", "config_updates", "reason"],
    },
  },
  {
    name: "query_callers",
    description:
      "Search callers by name or domain. Returns name, email, domain, call count, and personality summary.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Filter by caller name (case-insensitive, partial match)",
        },
        domain_id: {
          type: "string",
          description: "Filter by domain ID",
        },
        domain_name: {
          type: "string",
          description: "Filter by domain name (case-insensitive, partial match)",
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 10, max: 25)",
        },
      },
    },
  },
  {
    name: "get_domain_info",
    description:
      "Get detailed info about a domain: description, playbook, specs in the playbook, caller count, and identity/content spec configs.",
    input_schema: {
      type: "object",
      properties: {
        domain_id: {
          type: "string",
          description: "The domain ID (UUID)",
        },
        domain_name: {
          type: "string",
          description: "Domain name to search for (if ID not known)",
        },
      },
    },
  },
];
