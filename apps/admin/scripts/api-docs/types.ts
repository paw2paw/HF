/**
 * API Documentation Annotation Types
 *
 * Every route.ts file should have an @api JSDoc block on each exported
 * handler function (GET, POST, PUT, PATCH, DELETE).
 *
 * Example:
 *
 *   /**
 *    * @api GET /api/callers
 *    * @visibility public
 *    * @scope callers:read
 *    * @auth session
 *    * @tags callers
 *    * @description List all callers with optional counts
 *    * @query withCounts boolean - Include memory and call counts
 *    * @query limit number - Max results (default: 100, max: 500)
 *    * @query offset number - Pagination offset (default: 0)
 *    * @response 200 { ok: true, callers: Caller[], total: number, limit: number, offset: number }
 *    * @response 500 { ok: false, error: string }
 *    *\/
 *   export async function GET(req: Request) { ... }
 */

// ---------------------------------------------------------------------------
// Parsed annotation types
// ---------------------------------------------------------------------------

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type Visibility = "public" | "internal";

export type AuthType =
  | "session"     // NextAuth session cookie (browser)
  | "bearer"      // Bearer token (HF_SUPERADMIN_TOKEN or API key)
  | "internal"    // x-internal-secret header (server-to-server)
  | "none"        // No auth (health, ready, public webhooks)
  | "api-key";    // Future: public API key (hf_xxx)

export interface ApiParam {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  default?: string;
}

export interface ApiResponse {
  status: number;
  shape: string;
}

export interface ApiEndpoint {
  /** HTTP method */
  method: HttpMethod;
  /** Full URL path, e.g. /api/callers/:callerId */
  path: string;
  /** public = exposed in public API docs; internal = dev team only */
  visibility: Visibility;
  /** API key scope required, e.g. "callers:read", "pipeline:execute" */
  scope?: string;
  /** Auth mechanism */
  auth: AuthType;
  /** Grouping tags, e.g. ["callers", "crud"] */
  tags: string[];
  /** Human-readable description */
  description: string;
  /** URL query parameters */
  query?: ApiParam[];
  /** URL path parameters */
  pathParams?: ApiParam[];
  /** Request body fields (for POST/PUT/PATCH) */
  body?: ApiParam[];
  /** Response shapes by status code */
  responses?: ApiResponse[];
  /** Source file path (auto-populated by parser) */
  sourceFile?: string;
}

// ---------------------------------------------------------------------------
// Doc generation types
// ---------------------------------------------------------------------------

export interface ApiGroup {
  name: string;
  description: string;
  tag: string;
  endpoints: ApiEndpoint[];
}

export interface DocTemplate {
  title: string;
  intro: string;
  sections: DocSection[];
}

export interface DocSection {
  id: string;
  title: string;
  content: string;
}
