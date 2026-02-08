"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";

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
  /** Show reset button to restore default order (default: true) */
  showReset?: boolean;
};

export function DraggableTabs({
  storageKey,
  tabs,
  activeTab,
  onTabChange,
  containerStyle,
  showReset = true,
}: DraggableTabsProps) {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [orderedTabs, setOrderedTabs] = useState<TabDefinition[]>(tabs);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [hasCustomOrder, setHasCustomOrder] = useState(false);
  const dragStartX = useRef<number>(0);

  // Load order from localStorage on mount or when user changes
  useEffect(() => {
    const stored = getStoredOrder(storageKey, userId);
    if (stored) {
      // Reorder tabs based on stored order, handling new/removed tabs gracefully
      const orderedIds = stored.filter((id) => tabs.some((t) => t.id === id));
      const newTabIds = tabs.filter((t) => !stored.includes(t.id)).map((t) => t.id);
      const finalOrder = [...orderedIds, ...newTabIds];

      const reordered = finalOrder
        .map((id) => tabs.find((t) => t.id === id))
        .filter((t): t is TabDefinition => t !== undefined);

      setOrderedTabs(reordered);
      // Check if order differs from default
      const defaultOrder = tabs.map((t) => t.id).join(",");
      const currentOrder = reordered.map((t) => t.id).join(",");
      setHasCustomOrder(defaultOrder !== currentOrder);
    } else {
      setOrderedTabs(tabs);
      setHasCustomOrder(false);
    }
  }, [storageKey, tabs, userId]);

  const handleReset = useCallback(() => {
    setOrderedTabs(tabs);
    setHasCustomOrder(false);
    clearOrder(storageKey, userId);
  }, [storageKey, tabs, userId]);

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
    saveOrder(storageKey, newOrder.map((t) => t.id), userId);
    setHasCustomOrder(true);

    setDraggedTab(null);
    setDragOverTab(null);
  }, [draggedTab, orderedTabs, storageKey, userId]);

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
      {showReset && hasCustomOrder && (
        <button
          type="button"
          onClick={handleReset}
          title="Reset tab order"
          style={{
            marginLeft: "auto",
            padding: "8px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            opacity: 0.5,
            fontSize: 14,
            lineHeight: 1,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
        >
          ↻
        </button>
      )}
    </div>
  );
}

function getStorageKey(key: string, userId: string | undefined): string {
  return userId ? `tab-order:${key}.${userId}` : `tab-order:${key}`;
}

function getStoredOrder(key: string, userId: string | undefined): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(getStorageKey(key, userId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveOrder(key: string, order: string[], userId: string | undefined): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(key, userId), JSON.stringify(order));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

function clearOrder(key: string, userId: string | undefined): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getStorageKey(key, userId));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}
