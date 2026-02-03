"use client";

import { useEffect, useCallback, useMemo } from "react";
import { usePathname, useParams } from "next/navigation";
import { useEntityContext, EntityType } from "@/contexts/EntityContext";

/**
 * Get route prefix from pathname (e.g., "/x" if in /x/ section, "" otherwise)
 */
function getRoutePrefix(pathname: string): string {
  if (pathname.startsWith("/x/") || pathname === "/x") {
    return "/x";
  }
  return "";
}

/**
 * Hook to automatically detect and push entities from URL params
 * Use this in your layout or pages to auto-populate entity context
 */
export function useEntityDetection() {
  const pathname = usePathname();
  const params = useParams();
  const { pushEntity, setPageContext, reset } = useEntityContext();

  // Detect route prefix from current pathname
  const routePrefix = useMemo(() => getRoutePrefix(pathname), [pathname]);

  // Extract page context from pathname
  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    const page = segments[0] || "";
    setPageContext(page, params as Record<string, string>);
  }, [pathname, params, setPageContext]);

  // Fetch and push caller entity
  const fetchAndPushCaller = useCallback(
    async (callerId: string) => {
      try {
        const res = await fetch(`/api/callers/${callerId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.caller) {
          pushEntity({
            type: "caller",
            id: callerId,
            label: data.caller.name || `Caller ${callerId.slice(0, 8)}`,
            href: `${routePrefix}/callers/${callerId}`,
            data: {
              name: data.caller.name,
              email: data.caller.email,
              phone: data.caller.phone,
              domainId: data.caller.domainId,
            },
          });
        }
      } catch {
        // Silently fail - entity detection is best-effort
      }
    },
    [pushEntity, routePrefix]
  );

  // Fetch and push call entity
  const fetchAndPushCall = useCallback(
    async (callId: string) => {
      try {
        const res = await fetch(`/api/calls/${callId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.call) {
          const date = new Date(data.call.createdAt);
          pushEntity({
            type: "call",
            id: callId,
            label: date.toLocaleDateString(),
            href: `${routePrefix}/calls/${callId}`,
            data: {
              createdAt: data.call.createdAt,
              callerId: data.call.callerId,
              source: data.call.source,
            },
          });
        }
      } catch {
        // Silently fail
      }
    },
    [pushEntity, routePrefix]
  );

  // Fetch and push spec entity
  const fetchAndPushSpec = useCallback(
    async (specId: string) => {
      try {
        const res = await fetch(`/api/analysis-specs/${specId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.spec) {
          pushEntity({
            type: "spec",
            id: specId,
            label: data.spec.name || data.spec.slug || `Spec ${specId.slice(0, 8)}`,
            href: `${routePrefix}/analysis-specs?specId=${specId}`,
            data: {
              name: data.spec.name,
              slug: data.spec.slug,
              scope: data.spec.scope,
              outputType: data.spec.outputType,
            },
          });
        }
      } catch {
        // Silently fail
      }
    },
    [pushEntity, routePrefix]
  );

  // Fetch and push playbook entity
  const fetchAndPushPlaybook = useCallback(
    async (playbookId: string) => {
      try {
        const res = await fetch(`/api/playbooks/${playbookId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.playbook) {
          pushEntity({
            type: "playbook",
            id: playbookId,
            label: data.playbook.name || `Playbook ${playbookId.slice(0, 8)}`,
            href: `${routePrefix}/playbooks/${playbookId}`,
            data: {
              name: data.playbook.name,
              status: data.playbook.status,
              domainId: data.playbook.domainId,
            },
          });
        }
      } catch {
        // Silently fail
      }
    },
    [pushEntity, routePrefix]
  );

  // Detect entities from URL params
  useEffect(() => {
    // Reset context when navigating to a new top-level page
    // But preserve if navigating within the same entity type
    const segments = pathname.split("/").filter(Boolean);
    const page = segments[0];

    // Auto-detect entities from URL params
    if (params.callerId && typeof params.callerId === "string") {
      fetchAndPushCaller(params.callerId);
    }

    if (params.callId && typeof params.callId === "string") {
      fetchAndPushCall(params.callId);
    }

    if (params.specId && typeof params.specId === "string") {
      fetchAndPushSpec(params.specId);
    }

    if (params.playbookId && typeof params.playbookId === "string") {
      fetchAndPushPlaybook(params.playbookId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, params]);

  return {
    fetchAndPushCaller,
    fetchAndPushCall,
    fetchAndPushSpec,
    fetchAndPushPlaybook,
  };
}

/**
 * Hook for manual entity selection within pages
 * Use this when the user clicks on an entity card/row
 */
export function useEntitySelection() {
  const pathname = usePathname();
  const { pushEntity, popEntity, clearToEntity, replaceEntity } = useEntityContext();

  // Detect route prefix from current pathname
  const routePrefix = useMemo(() => getRoutePrefix(pathname), [pathname]);

  const selectCaller = useCallback(
    (caller: { id: string; name?: string | null; email?: string | null }) => {
      pushEntity({
        type: "caller",
        id: caller.id,
        label: caller.name || caller.email || `Caller ${caller.id.slice(0, 8)}`,
        href: `${routePrefix}/callers/${caller.id}`,
        data: caller,
      });
    },
    [pushEntity, routePrefix]
  );

  const selectCall = useCallback(
    (call: { id: string; createdAt: string | Date; callerId?: string }) => {
      const date = typeof call.createdAt === "string" ? new Date(call.createdAt) : call.createdAt;
      pushEntity({
        type: "call",
        id: call.id,
        label: date.toLocaleDateString(),
        href: `${routePrefix}/calls/${call.id}`,
        data: call,
      });
    },
    [pushEntity, routePrefix]
  );

  const selectSpec = useCallback(
    (spec: { id: string; name?: string | null; slug?: string | null }) => {
      pushEntity({
        type: "spec",
        id: spec.id,
        label: spec.name || spec.slug || `Spec ${spec.id.slice(0, 8)}`,
        href: `${routePrefix}/analysis-specs?specId=${spec.id}`,
        data: spec,
      });
    },
    [pushEntity, routePrefix]
  );

  const selectPlaybook = useCallback(
    (playbook: { id: string; name?: string | null }) => {
      pushEntity({
        type: "playbook",
        id: playbook.id,
        label: playbook.name || `Playbook ${playbook.id.slice(0, 8)}`,
        href: `${routePrefix}/playbooks/${playbook.id}`,
        data: playbook,
      });
    },
    [pushEntity, routePrefix]
  );

  const selectDomain = useCallback(
    (domain: { id: string; name?: string | null }) => {
      pushEntity({
        type: "domain",
        id: domain.id,
        label: domain.name || `Domain ${domain.id.slice(0, 8)}`,
        href: `${routePrefix}/domains/${domain.id}`,
        data: domain,
      });
    },
    [pushEntity, routePrefix]
  );

  const selectMemory = useCallback(
    (memory: { id: string; key: string; value: string; category: string }) => {
      pushEntity({
        type: "memory",
        id: memory.id,
        label: `${memory.key}: ${memory.value.slice(0, 20)}${memory.value.length > 20 ? "..." : ""}`,
        data: memory,
      });
    },
    [pushEntity]
  );

  return {
    selectCaller,
    selectCall,
    selectSpec,
    selectPlaybook,
    selectDomain,
    selectMemory,
    popEntity,
    clearToEntity,
    replaceEntity,
  };
}
