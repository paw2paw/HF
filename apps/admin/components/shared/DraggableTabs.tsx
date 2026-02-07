"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * TODO [AUTH]: When user authentication is implemented:
 * 1. Replace localStorage calls with API calls to persist tab order per user
 * 2. Add a UserPreferences table: { userId, preferenceKey, preferenceValue }
 * 3. Create API endpoints:
 *    - GET /api/user/preferences/:key
 *    - PUT /api/user/preferences/:key
 * 4. Update getStoredOrder() to fetch from API
 * 5. Update saveOrder() to POST to API
 * 6. Consider caching with SWR or React Query for performance
 */

export type TabDefinition = {
  id: string;
  label: React.ReactNode;
  title?: string;
};

type DraggableTabsProps = {
  /** Unique key for localStorage persistence (e.g., "playbook-builder-tabs") */
  storageKey: string;
  /** Tab definitions in default order */
  tabs: TabDefinition[];
  /** Currently active tab id */
  activeTab: string;
  /** Callback when tab is clicked */
  onTabChange: (tabId: string) => void;
  /** Optional custom styles for the container */
  containerStyle?: React.CSSProperties;
};

export function DraggableTabs({
  storageKey,
  tabs,
  activeTab,
  onTabChange,
  containerStyle,
}: DraggableTabsProps) {
  const [orderedTabs, setOrderedTabs] = useState<TabDefinition[]>(tabs);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const dragStartX = useRef<number>(0);

  // Load order from localStorage on mount
  useEffect(() => {
    const stored = getStoredOrder(storageKey);
    if (stored) {
      // Reorder tabs based on stored order, handling new/removed tabs gracefully
      const orderedIds = stored.filter((id) => tabs.some((t) => t.id === id));
      const newTabIds = tabs.filter((t) => !stored.includes(t.id)).map((t) => t.id);
      const finalOrder = [...orderedIds, ...newTabIds];

      const reordered = finalOrder
        .map((id) => tabs.find((t) => t.id === id))
        .filter((t): t is TabDefinition => t !== undefined);

      setOrderedTabs(reordered);
    } else {
      setOrderedTabs(tabs);
    }
  }, [storageKey, tabs]);

  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    setDraggedTab(tabId);
    dragStartX.current = e.clientX;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tabId);

    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 50, 20);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (tabId !== draggedTab) {
      setDragOverTab(tabId);
    }
  }, [draggedTab]);

  const handleDragLeave = useCallback(() => {
    setDragOverTab(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();

    if (!draggedTab || draggedTab === targetTabId) {
      setDraggedTab(null);
      setDragOverTab(null);
      return;
    }

    const newOrder = [...orderedTabs];
    const draggedIndex = newOrder.findIndex((t) => t.id === draggedTab);
    const targetIndex = newOrder.findIndex((t) => t.id === targetTabId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Remove dragged item and insert at target position
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    setOrderedTabs(newOrder);
    saveOrder(storageKey, newOrder.map((t) => t.id));

    setDraggedTab(null);
    setDragOverTab(null);
  }, [draggedTab, orderedTabs, storageKey]);

  const handleDragEnd = useCallback(() => {
    setDraggedTab(null);
    setDragOverTab(null);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--border-default)",
        ...containerStyle,
      }}
    >
      {orderedTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDragging = draggedTab === tab.id;
        const isDragOver = dragOverTab === tab.id;

        return (
          <button
            key={tab.id}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            onClick={() => onTabChange(tab.id)}
            title={tab.title}
            style={{
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 500,
              background: isActive ? "var(--surface-primary)" : "transparent",
              color: isActive ? "var(--button-primary-bg)" : "var(--text-muted)",
              border: "none",
              borderBottom: isActive
                ? "2px solid var(--button-primary-bg)"
                : "2px solid transparent",
              borderLeft: isDragOver ? "2px solid var(--button-primary-bg)" : "2px solid transparent",
              cursor: isDragging ? "grabbing" : "grab",
              marginBottom: -1,
              opacity: isDragging ? 0.5 : 1,
              transition: "border-left 0.15s, opacity 0.15s",
              userSelect: "none",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * TODO [AUTH]: Replace with API call when user auth is implemented
 * Example: const order = await fetch(`/api/user/preferences/${key}`).then(r => r.json());
 */
function getStoredOrder(key: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(`tab-order:${key}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * TODO [AUTH]: Replace with API call when user auth is implemented
 * Example: await fetch(`/api/user/preferences/${key}`, { method: 'PUT', body: JSON.stringify(order) });
 */
function saveOrder(key: string, order: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`tab-order:${key}`, JSON.stringify(order));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}
