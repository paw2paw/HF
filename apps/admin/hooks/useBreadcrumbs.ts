"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { usePathname, useParams } from "next/navigation";
import { useTerminology } from "@/contexts/TerminologyContext";
import { useEntityContext, type EntityBreadcrumb } from "@/contexts/EntityContext";
import type { BreadcrumbSegment } from "@/components/shared/HierarchyBreadcrumb";
import type { TermKey } from "@/lib/terminology/types";
import {
  ROUTE_LABELS,
  DYNAMIC_ROUTES,
  PARENT_ROUTES,
  ENTITY_API_MAP,
  ENTITY_NAME_PATH,
  slugToTitle,
  type BreadcrumbEntityType,
  type DynamicRoutePattern,
} from "@/lib/topbar/route-map";

// ── Entity Name Cache ────────────────────────────────────

type NameCache = Map<string, string>;

function cacheKey(entityType: string, id: string): string {
  return `${entityType}:${id}`;
}

/**
 * Fetch an entity name from the API.
 * Returns the name or null on failure.
 */
async function fetchEntityName(
  entityType: BreadcrumbEntityType,
  id: string,
): Promise<string | null> {
  const base = ENTITY_API_MAP[entityType];
  if (!base) return null;

  try {
    const res = await fetch(`${base}/${id}`);
    if (!res.ok) return null;
    const data = await res.json();

    // Navigate the name path (e.g., ["playbook", "name"] → data.playbook.name)
    const namePath = ENTITY_NAME_PATH[entityType];
    let value: unknown = data;
    for (const key of namePath) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[key];
      } else {
        return null;
      }
    }

    // Some APIs return the name at root level too
    if (typeof value === "string") return value;
    if (typeof data.name === "string") return data.name;

    return null;
  } catch {
    return null;
  }
}

// ── Label Resolution ─────────────────────────────────────

function resolveLabel(
  label: string | { termKey: TermKey; plural?: boolean },
  terms: { plural: (key: TermKey) => string; terms: Record<string, string> },
): string {
  if (typeof label === "string") return label;
  if (label.plural) return terms.plural(label.termKey);
  return terms.terms[label.termKey] || label.termKey;
}

// ── Hook ─────────────────────────────────────────────────

/**
 * Derives breadcrumb segments from the current URL pathname.
 *
 * Resolution strategy:
 * 1. Static segments: matched against ROUTE_LABELS → instant, zero-fetch
 * 2. Dynamic segments (UUIDs/IDs): checked against EntityContext first,
 *    then fetched from API with local cache
 * 3. Unknown segments: title-cased from the slug
 */
export function useBreadcrumbs(): BreadcrumbSegment[] {
  const pathname = usePathname();
  const params = useParams();
  const terminology = useTerminology();
  const entityContext = useEntityContext();

  // Persistent name cache (survives re-renders, cleared on unmount)
  const nameCache = useRef<NameCache>(new Map());
  const [resolvedNames, setResolvedNames] = useState<NameCache>(new Map());

  // Track pending fetches to avoid duplicates
  const pendingFetches = useRef<Set<string>>(new Set());

  // Find entity name from EntityContext breadcrumbs
  const findInEntityContext = useCallback(
    (entityType: string, id: string): string | null => {
      const match = entityContext.breadcrumbs.find(
        (b: EntityBreadcrumb) => b.id === id || (b.type === entityType && b.id === id),
      );
      return match?.label || null;
    },
    [entityContext.breadcrumbs],
  );

  // Resolve a dynamic segment name (cache → EntityContext → fetch)
  const resolveEntityName = useCallback(
    (entityType: BreadcrumbEntityType, id: string) => {
      const key = cacheKey(entityType, id);

      // Already cached locally
      if (nameCache.current.has(key)) return;

      // Already fetching
      if (pendingFetches.current.has(key)) return;

      // Try EntityContext
      const fromContext = findInEntityContext(entityType, id);
      if (fromContext) {
        nameCache.current.set(key, fromContext);
        setResolvedNames(new Map(nameCache.current));
        return;
      }

      // Fetch from API
      pendingFetches.current.add(key);
      fetchEntityName(entityType, id).then((name) => {
        pendingFetches.current.delete(key);
        if (name) {
          nameCache.current.set(key, name);
          setResolvedNames(new Map(nameCache.current));
        }
      });
    },
    [findInEntityContext],
  );

  // Build segments from pathname
  const segments = useMemo((): BreadcrumbSegment[] => {
    if (!pathname || !pathname.startsWith("/x")) return [];

    const parts = pathname.split("/").filter(Boolean); // ["x", "courses", "abc", "subjects", "def"]
    if (parts.length < 2) return []; // Just "/x" — no breadcrumb

    const result: BreadcrumbSegment[] = [];

    // Check for exact static match first (for leaf pages like /x/settings)
    const exactLabel = ROUTE_LABELS[pathname];
    if (exactLabel && !isUuid(parts[parts.length - 1])) {
      // Prepend parent breadcrumb if one is defined (e.g. wizard pages)
      const parent = PARENT_ROUTES[pathname];
      if (parent) {
        result.push({ label: parent.label, href: parent.href });
      }
      result.push({
        label: resolveLabel(exactLabel, terminology),
        href: pathname,
      });
      return result;
    }

    // Try to match against dynamic route patterns
    const matched = matchDynamicRoute(parts, terminology, nameCache.current, resolvedNames);
    if (matched) return matched;

    // Fallback: build segments piece by piece
    let accumPath = "";
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      if (i === 0 && seg === "x") continue; // Skip /x prefix

      accumPath += `/${seg}`;
      const fullPath = `/x${accumPath.startsWith("/x") ? accumPath.slice(2) : accumPath}`;
      // Fix: ensure the path is /x/...
      const normalPath = pathname.startsWith("/x")
        ? "/" + parts.slice(0, i + 1).join("/")
        : fullPath;

      const label = ROUTE_LABELS[normalPath];
      if (label) {
        result.push({
          label: resolveLabel(label, terminology),
          href: normalPath,
        });
      } else if (isUuid(seg) || isNumeric(seg)) {
        // Dynamic segment — skip (handled by dynamic route matching)
        continue;
      } else {
        result.push({
          label: slugToTitle(seg),
          href: normalPath,
        });
      }
    }

    return result.length > 0 ? result : fallbackSegments(pathname);
  }, [pathname, terminology, resolvedNames]);

  // Trigger entity name resolution for dynamic segments
  useEffect(() => {
    if (!pathname || !pathname.startsWith("/x")) return;

    const parts = pathname.split("/").filter(Boolean);
    matchAndResolveEntities(parts, resolveEntityName);
  }, [pathname, resolveEntityName]);

  // Also update from EntityContext when it changes
  useEffect(() => {
    let changed = false;
    for (const breadcrumb of entityContext.breadcrumbs) {
      for (const [key, existingName] of nameCache.current) {
        if (key.endsWith(`:${breadcrumb.id}`) && existingName !== breadcrumb.label) {
          nameCache.current.set(key, breadcrumb.label);
          changed = true;
        }
      }
      // Also add new entries from EntityContext
      const type = breadcrumb.type as string;
      const key = cacheKey(type, breadcrumb.id);
      if (!nameCache.current.has(key)) {
        nameCache.current.set(key, breadcrumb.label);
        changed = true;
      }
    }
    if (changed) {
      setResolvedNames(new Map(nameCache.current));
    }
  }, [entityContext.breadcrumbs]);

  return segments;
}

// ── Matching Helpers ─────────────────────────────────────

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ||
    /^c[a-z0-9]{24,}$/i.test(s); // cuid format
}

function isNumeric(s: string): boolean {
  return /^\d+$/.test(s);
}

/**
 * Match the current path against DYNAMIC_ROUTES and build breadcrumb segments.
 */
function matchDynamicRoute(
  parts: string[],
  terminology: { plural: (key: TermKey) => string; terms: Record<string, string> },
  cache: NameCache,
  resolved: NameCache,
): BreadcrumbSegment[] | null {
  // parts = ["x", "courses", "abc123", "subjects", "def456"]
  if (parts.length < 3 || parts[0] !== "x") return null;

  const basePath = `/x/${parts[1]}`;

  for (const route of DYNAMIC_ROUTES) {
    if (route.parentPath !== basePath) continue;

    const segments: BreadcrumbSegment[] = [];

    // Parent list page
    segments.push({
      label: resolveLabel(route.parentLabel, terminology),
      href: route.parentPath,
    });

    // Entity ID segment
    if (parts.length >= 3 && (isUuid(parts[2]) || isNumeric(parts[2]))) {
      const entityId = parts[2];
      const key = cacheKey(route.entityType, entityId);
      const name = cache.get(key) || resolved.get(key);

      segments.push({
        label: name || "",
        href: `${route.parentPath}/${entityId}`,
        loading: !name,
      });

      // Check for nested children patterns
      if (parts.length >= 5 && route.children) {
        for (const child of route.children) {
          if (parts[3] === child.parentPath) {
            // Child list label (e.g., "Subjects")
            // Only show if there's a deeper level
            if (parts.length >= 5 && (isUuid(parts[4]) || isNumeric(parts[4]))) {
              const childId = parts[4];

              // Special case: session number
              if (child.parentPath === "sessions" && isNumeric(childId)) {
                segments.push({
                  label: `Session ${childId}`,
                  href: `${route.parentPath}/${entityId}/sessions/${childId}`,
                });
              } else {
                const childKey = cacheKey(child.entityType, childId);
                const childName = cache.get(childKey) || resolved.get(childKey);

                segments.push({
                  label: childName || "",
                  href: `${route.parentPath}/${entityId}/${child.parentPath}/${childId}`,
                  loading: !childName,
                });
              }

              // Check for grandchildren (e.g., sources under subjects)
              if (parts.length >= 7 && child.children) {
                for (const grandchild of child.children) {
                  if (parts[5] === grandchild.parentPath && parts.length >= 7) {
                    const gcId = parts[6];
                    if (isUuid(gcId)) {
                      const gcKey = cacheKey(grandchild.entityType, gcId);
                      const gcName = cache.get(gcKey) || resolved.get(gcKey);

                      segments.push({
                        label: gcName || "",
                        href: `${route.parentPath}/${entityId}/${child.parentPath}/${parts[4]}/${grandchild.parentPath}/${gcId}`,
                        loading: !gcName,
                      });
                    }
                  }
                }
              }
            } else {
              // Just the child list page (e.g., /courses/abc/subjects)
              segments.push({
                label: resolveLabel(child.parentLabel, terminology),
                href: `${route.parentPath}/${entityId}/${child.parentPath}`,
              });
            }
            break;
          }
        }
      }

      // Handle remaining static segments after the matched pattern
      const matchedDepth = segments.length === 1 ? 3 : (segments.length + 1) * 2 - 1;
      if (parts.length > matchedDepth) {
        for (let i = matchedDepth; i < parts.length; i++) {
          const seg = parts[i];
          if (!isUuid(seg) && !isNumeric(seg)) {
            const subPath = "/" + parts.slice(0, i + 1).join("/");
            const staticLabel = ROUTE_LABELS[subPath];
            if (staticLabel) {
              segments.push({
                label: resolveLabel(staticLabel, terminology),
                href: subPath,
              });
            }
          }
        }
      }
    }

    return segments;
  }

  return null;
}

/**
 * Walk the path and trigger entity name resolution for any dynamic IDs.
 */
function matchAndResolveEntities(
  parts: string[],
  resolve: (entityType: BreadcrumbEntityType, id: string) => void,
): void {
  if (parts.length < 3 || parts[0] !== "x") return;

  const basePath = `/x/${parts[1]}`;

  for (const route of DYNAMIC_ROUTES) {
    if (route.parentPath !== basePath) continue;

    // Resolve primary entity
    if (parts.length >= 3 && (isUuid(parts[2]) || isNumeric(parts[2]))) {
      resolve(route.entityType, parts[2]);

      // Resolve nested entities
      if (parts.length >= 5 && route.children) {
        for (const child of route.children) {
          if (parts[3] === child.parentPath && (isUuid(parts[4]) || isNumeric(parts[4]))) {
            if (child.parentPath !== "sessions") {
              resolve(child.entityType, parts[4]);
            }

            // Grandchildren
            if (parts.length >= 7 && child.children) {
              for (const grandchild of child.children) {
                if (parts[5] === grandchild.parentPath && isUuid(parts[6])) {
                  resolve(grandchild.entityType, parts[6]);
                }
              }
            }
          }
        }
      }
    }
    break;
  }
}

/** Last-resort fallback: just show the last path segment as title */
function fallbackSegments(pathname: string): BreadcrumbSegment[] {
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last || last === "x") return [];
  return [{ label: slugToTitle(last), href: pathname }];
}
