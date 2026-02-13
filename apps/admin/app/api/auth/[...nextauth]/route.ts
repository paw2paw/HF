import { handlers } from "@/lib/auth";

/**
 * @api GET /api/auth/[...nextauth]
 * @visibility internal
 * @scope auth:nextauth
 * @auth none
 * @tags auth
 * @description NextAuth.js catch-all route handler for OAuth flows, session management, CSRF tokens, and sign-in/sign-out pages.
 * @response 200 HTML page or JSON session data depending on the route path
 */

/**
 * @api POST /api/auth/[...nextauth]
 * @visibility internal
 * @scope auth:nextauth
 * @auth none
 * @tags auth
 * @description NextAuth.js catch-all route handler for OAuth callbacks, credential sign-in, and session updates.
 * @response 200 Redirect or JSON response depending on the auth action
 */
export const { GET, POST } = handlers;
