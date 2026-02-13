import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Edge-compatible middleware - no Node.js dependencies
// For database sessions, we can only check cookie existence here
// Full session validation happens in server components via auth()

const publicRoutes = ["/login", "/login/verify", "/login/error", "/invite"];
// Routes that handle their own auth (webhooks, external APIs)
const apiTokenRoutes = ["/api/auth", "/api/vapi", "/api/webhook", "/api/invite"];

// Internal API secret for server-to-server calls (bypasses session check)
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || "hf-internal-dev-secret";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow API routes with their own auth
  if (apiTokenRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow internal server-to-server API calls with secret header
  const internalSecret = request.headers.get("x-internal-secret");
  if (internalSecret === INTERNAL_API_SECRET) {
    return NextResponse.next();
  }

  // Check for session cookie (JWT or database session)
  // NextAuth v5 uses different cookie names depending on environment
  const sessionToken =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token") ||
    request.cookies.get("next-auth.session-token") ||
    request.cookies.get("__Secure-next-auth.session-token");

  if (!sessionToken) {
    // No session cookie - redirect to login
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session cookie exists - allow (full validation in server components)
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icons/.*|sounds/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
