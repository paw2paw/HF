import { NextResponse } from "next/server";

/**
 * Parse pagination parameters from URL search params.
 *
 * @example
 * ```ts
 * const { limit, offset } = parsePagination(url.searchParams);
 * const items = await prisma.item.findMany({ take: limit, skip: offset });
 * ```
 */
export function parsePagination(
  searchParams: URLSearchParams,
  opts: { defaultLimit?: number; maxLimit?: number } = {}
): { limit: number; offset: number } {
  const { defaultLimit = 100, maxLimit = 500 } = opts;
  const limit = Math.min(
    maxLimit,
    parseInt(searchParams.get("limit") || String(defaultLimit))
  );
  const offset = parseInt(searchParams.get("offset") || "0");
  return { limit: Math.max(1, limit), offset: Math.max(0, offset) };
}

/**
 * Standard JSON error response with `ok: false`.
 *
 * Use this instead of inline `NextResponse.json({ error: ... })` to ensure
 * consistent error shape across all API routes.
 *
 * @example
 * ```ts
 * if (!id) return apiError("ID is required", 400);
 * ```
 */
export function apiError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Standard JSON success response with `ok: true`.
 *
 * @example
 * ```ts
 * return apiOk({ items, total });
 * ```
 */
export function apiOk<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}
