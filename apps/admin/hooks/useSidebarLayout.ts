"use client";

import { useReducer, useMemo, useCallback, useEffect, useRef } from "react";
import {
  NavItem,
  NavSection,
  SidebarState,
  SidebarAction,
  SidebarDragState,
  EMPTY_LAYOUT,
  EMPTY_DRAG_STATE,
} from "@/lib/sidebar/types";
import {
  loadLayout,
  saveLayout,
  clearLayout,
  loadGlobalDefault,
  saveGlobalDefault,
} from "@/lib/sidebar/storage";

// ============================================================================
// Reducer
// ============================================================================

function sidebarReducer(state: SidebarState, action: SidebarAction): SidebarState {
  switch (action.type) {
    case "SET_LAYOUT":
      return {
        ...state,
        layout: { ...state.layout, ...action.layout },
        hasCustomLayout: true,
        isLoaded: true,
      };

    case "RESET_LAYOUT":
      return {
        ...state,
        layout: EMPTY_LAYOUT,
        hasCustomLayout: false,
      };

    case "MOVE_SECTION": {
      const { fromId, toId } = action;
      if (fromId === toId) return state;

      const currentOrder = state.layout.sectionOrder.length > 0
        ? [...state.layout.sectionOrder]
        : [];

      const fromIndex = currentOrder.indexOf(fromId);
      const toIndex = currentOrder.indexOf(toId);

      if (fromIndex === -1 || toIndex === -1) return state;

      const [removed] = currentOrder.splice(fromIndex, 1);
      currentOrder.splice(toIndex, 0, removed);

      return {
        ...state,
        layout: { ...state.layout, sectionOrder: currentOrder },
        hasCustomLayout: true,
      };
    }

    case "MOVE_ITEM": {
      const { itemHref, toSectionId, atIndex } = action;
      const newPlacements = { ...state.layout.itemPlacements };
      const newItemOrder = { ...state.layout.itemOrder };

      // Update placement
      newPlacements[itemHref] = toSectionId;

      // Update item order if atIndex specified
      if (atIndex !== undefined) {
        const sectionItems = newItemOrder[toSectionId] || [];
        const filteredItems = sectionItems.filter((h) => h !== itemHref);
        filteredItems.splice(atIndex, 0, itemHref);
        newItemOrder[toSectionId] = filteredItems;
      }

      return {
        ...state,
        layout: {
          ...state.layout,
          itemPlacements: newPlacements,
          itemOrder: newItemOrder,
        },
        hasCustomLayout: true,
      };
    }

    case "RENAME_SECTION": {
      const { sectionId, title } = action;
      const newTitles = { ...state.layout.sectionTitles };

      if (title) {
        newTitles[sectionId] = title;
      } else {
        delete newTitles[sectionId];
      }

      return {
        ...state,
        layout: { ...state.layout, sectionTitles: newTitles },
        hasCustomLayout: true,
      };
    }

    case "HIDE_SECTION": {
      const hidden = state.layout.hiddenSections || [];
      if (hidden.includes(action.sectionId)) return state;

      return {
        ...state,
        layout: {
          ...state.layout,
          hiddenSections: [...hidden, action.sectionId],
        },
        hasCustomLayout: true,
      };
    }

    case "SHOW_SECTION": {
      const hidden = state.layout.hiddenSections || [];
      if (!hidden.includes(action.sectionId)) return state;

      return {
        ...state,
        layout: {
          ...state.layout,
          hiddenSections: hidden.filter((id) => id !== action.sectionId),
        },
        hasCustomLayout: true,
      };
    }

    case "SET_DRAG_STATE":
      return {
        ...state,
        dragState: { ...state.dragState, ...action.dragState },
      };

    case "CLEAR_DRAG_STATE":
      return {
        ...state,
        dragState: EMPTY_DRAG_STATE,
      };

    default:
      return state;
  }
}

const INITIAL_STATE: SidebarState = {
  layout: EMPTY_LAYOUT,
  dragState: EMPTY_DRAG_STATE,
  hasCustomLayout: false,
  isLoaded: false,
};

// ============================================================================
// Hook
// ============================================================================

export interface UseSidebarLayoutOptions {
  userId?: string;
  baseSections: NavSection[];
  isAdmin?: boolean;
}

export interface UseSidebarLayoutResult {
  // Computed sections (ordered, with items moved, filtered by visibility)
  sections: NavSection[];
  visibleSections: NavSection[];
  hiddenSectionIds: string[];
  hasCustomLayout: boolean;
  isLoaded: boolean;

  // Drag state for UI
  dragState: SidebarDragState;

  // Section actions
  renameSection: (sectionId: string, title: string) => void;
  hideSection: (sectionId: string) => void;
  showSection: (sectionId: string) => void;

  // Layout actions
  resetLayout: () => void;
  setAsDefault: () => Promise<boolean>;

  // Drag handlers for sections
  sectionDragHandlers: {
    onDragStart: (e: React.DragEvent, sectionId: string) => void;
    onDragOver: (e: React.DragEvent, sectionId: string) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent, targetSectionId: string) => void;
    onDragEnd: () => void;
  };

  // Drag handlers for items
  itemDragHandlers: {
    onDragStart: (e: React.DragEvent, itemHref: string) => void;
    onDragOverSection: (e: React.DragEvent, sectionId: string) => void;
    onDragOverItem: (e: React.DragEvent, itemHref: string, sectionId: string) => void;
    onDropOnSection: (e: React.DragEvent, sectionId: string) => void;
    onDropOnItem: (e: React.DragEvent, targetItemHref: string, sectionId: string) => void;
    onDragEnd: () => void;
  };
}

export function useSidebarLayout({
  userId,
  baseSections,
  isAdmin = false,
}: UseSidebarLayoutOptions): UseSidebarLayoutResult {
  const [state, dispatch] = useReducer(sidebarReducer, INITIAL_STATE);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);

  // ============================================================================
  // Load layout on mount
  // ============================================================================

  useEffect(() => {
    if (hasLoadedRef.current) return;

    let cancelled = false;

    const load = async () => {
      // Try user's personal layout first
      const userLayout = loadLayout(userId);
      if (userLayout && !cancelled) {
        dispatch({ type: "SET_LAYOUT", layout: userLayout });
        hasLoadedRef.current = true;
        return;
      }

      // Then try global default
      const globalLayout = await loadGlobalDefault();
      if (globalLayout && !cancelled) {
        dispatch({ type: "SET_LAYOUT", layout: globalLayout });
        // Don't mark as custom since it's the default
        hasLoadedRef.current = true;
      } else if (!cancelled) {
        // Mark as loaded even if no layout found
        dispatch({ type: "SET_LAYOUT", layout: {} });
        hasLoadedRef.current = true;
      }
    };

    load();
    return () => { cancelled = true; };
  }, [userId]);

  // ============================================================================
  // Persist layout on changes (debounced)
  // ============================================================================

  useEffect(() => {
    if (!state.isLoaded || !state.hasCustomLayout) return;

    // Debounce saves
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveLayout(state.layout, userId);
    }, 100);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state.layout, state.isLoaded, state.hasCustomLayout, userId]);

  // ============================================================================
  // Compute ordered sections
  // ============================================================================

  const sections = useMemo(() => {
    const { sectionOrder, itemPlacements, itemOrder, sectionTitles } = state.layout;

    // Determine section order
    let orderedSections: NavSection[];
    if (sectionOrder.length === 0) {
      orderedSections = baseSections;
    } else {
      const orderedIds = sectionOrder.filter((id) =>
        baseSections.some((s) => s.id === id)
      );
      const newSectionIds = baseSections
        .filter((s) => !sectionOrder.includes(s.id))
        .map((s) => s.id);
      const finalOrder = [...orderedIds, ...newSectionIds];

      orderedSections = finalOrder
        .map((id) => baseSections.find((s) => s.id === id))
        .filter((s): s is NavSection => s !== undefined);
    }

    // Build section items map
    const sectionItems: Record<string, NavItem[]> = {};
    for (const section of orderedSections) {
      sectionItems[section.id] = [];
    }

    // Collect items into target sections
    for (const section of baseSections) {
      for (const item of section.items) {
        const targetSection = itemPlacements[item.href] || section.id;
        if (sectionItems[targetSection]) {
          sectionItems[targetSection].push(item);
        } else {
          sectionItems[section.id]?.push(item);
        }
      }
    }

    // Apply item ordering within each section
    for (const sectionId of Object.keys(sectionItems)) {
      const order = itemOrder[sectionId];
      if (order && order.length > 0) {
        const items = sectionItems[sectionId];
        const orderedItems: NavItem[] = [];

        for (const href of order) {
          const item = items.find((i) => i.href === href);
          if (item) orderedItems.push(item);
        }

        for (const item of items) {
          if (!order.includes(item.href)) {
            orderedItems.push(item);
          }
        }

        sectionItems[sectionId] = orderedItems;
      }
    }

    // Build final sections with custom titles
    return orderedSections.map((section) => ({
      ...section,
      title: sectionTitles?.[section.id] ?? section.title,
      items: sectionItems[section.id] || [],
    }));
  }, [baseSections, state.layout]);

  // Filter visible sections
  const hiddenSectionIds = useMemo(
    () => state.layout.hiddenSections || [],
    [state.layout.hiddenSections]
  );
  const visibleSections = useMemo(
    () => sections.filter((s) => !hiddenSectionIds.includes(s.id)),
    [sections, hiddenSectionIds]
  );

  // ============================================================================
  // Section actions
  // ============================================================================

  const renameSection = useCallback((sectionId: string, title: string) => {
    dispatch({ type: "RENAME_SECTION", sectionId, title });
  }, []);

  const hideSection = useCallback((sectionId: string) => {
    dispatch({ type: "HIDE_SECTION", sectionId });
  }, []);

  const showSection = useCallback((sectionId: string) => {
    dispatch({ type: "SHOW_SECTION", sectionId });
  }, []);

  const resetLayout = useCallback(() => {
    dispatch({ type: "RESET_LAYOUT" });
    clearLayout(userId);
  }, [userId]);

  const setAsDefault = useCallback(async () => {
    if (!isAdmin) return false;
    return saveGlobalDefault(state.layout);
  }, [isAdmin, state.layout]);

  // ============================================================================
  // Section drag handlers
  // ============================================================================

  const sectionDragHandlers = useMemo(
    () => ({
      onDragStart: (e: React.DragEvent, sectionId: string) => {
        dispatch({
          type: "SET_DRAG_STATE",
          dragState: { draggedSection: sectionId },
        });
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", `section:${sectionId}`);
      },

      onDragOver: (e: React.DragEvent, sectionId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (sectionId !== state.dragState.draggedSection) {
          dispatch({
            type: "SET_DRAG_STATE",
            dragState: { dragOverSection: sectionId },
          });
        }
      },

      onDragLeave: () => {
        dispatch({
          type: "SET_DRAG_STATE",
          dragState: { dragOverSection: null },
        });
      },

      onDrop: (e: React.DragEvent, targetSectionId: string) => {
        e.preventDefault();
        const { draggedSection } = state.dragState;

        if (draggedSection && draggedSection !== targetSectionId) {
          // Need to initialize section order if empty
          if (state.layout.sectionOrder.length === 0) {
            const initialOrder = baseSections.map((s) => s.id);
            dispatch({ type: "SET_LAYOUT", layout: { sectionOrder: initialOrder } });
            // Then move
            setTimeout(() => {
              dispatch({ type: "MOVE_SECTION", fromId: draggedSection, toId: targetSectionId });
            }, 0);
          } else {
            dispatch({ type: "MOVE_SECTION", fromId: draggedSection, toId: targetSectionId });
          }
        }

        dispatch({ type: "CLEAR_DRAG_STATE" });
      },

      onDragEnd: () => {
        dispatch({ type: "CLEAR_DRAG_STATE" });
      },
    }),
    [state.dragState, state.layout, baseSections]
  );

  // ============================================================================
  // Item drag handlers
  // ============================================================================

  const itemDragHandlers = useMemo(
    () => ({
      onDragStart: (e: React.DragEvent, itemHref: string) => {
        e.stopPropagation();
        dispatch({
          type: "SET_DRAG_STATE",
          dragState: { draggedItem: itemHref },
        });
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", `item:${itemHref}`);
      },

      onDragOverSection: (e: React.DragEvent, sectionId: string) => {
        if (!state.dragState.draggedItem) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        dispatch({
          type: "SET_DRAG_STATE",
          dragState: { dragOverSectionForItem: sectionId, dragOverItem: null },
        });
      },

      onDragOverItem: (e: React.DragEvent, itemHref: string, sectionId: string) => {
        if (!state.dragState.draggedItem || state.dragState.draggedItem === itemHref) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        dispatch({
          type: "SET_DRAG_STATE",
          dragState: { dragOverItem: itemHref, dragOverSectionForItem: sectionId },
        });
      },

      onDropOnSection: (e: React.DragEvent, targetSectionId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const { draggedItem } = state.dragState;
        if (!draggedItem) return;

        // Find original section
        let originalSection: string | null = null;
        for (const section of baseSections) {
          if (section.items.some((i) => i.href === draggedItem)) {
            originalSection = section.id;
            break;
          }
        }

        // Update placements
        const newPlacements = { ...state.layout.itemPlacements };
        if (targetSectionId === originalSection) {
          delete newPlacements[draggedItem];
        } else {
          newPlacements[draggedItem] = targetSectionId;
        }

        dispatch({ type: "SET_LAYOUT", layout: { itemPlacements: newPlacements } });
        dispatch({ type: "CLEAR_DRAG_STATE" });
      },

      onDropOnItem: (e: React.DragEvent, targetItemHref: string, sectionId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const { draggedItem } = state.dragState;
        if (!draggedItem || draggedItem === targetItemHref) return;

        // Find current section of dragged item
        const currentSection = sections.find((s) =>
          s.items.some((i) => i.href === draggedItem)
        );
        const targetSection = sections.find((s) => s.id === sectionId);
        if (!currentSection || !targetSection) return;

        // Calculate new placements
        const newPlacements = { ...state.layout.itemPlacements };
        if (currentSection.id !== sectionId) {
          let originalSection: string | null = null;
          for (const section of baseSections) {
            if (section.items.some((i) => i.href === draggedItem)) {
              originalSection = section.id;
              break;
            }
          }
          if (sectionId === originalSection) {
            delete newPlacements[draggedItem];
          } else {
            newPlacements[draggedItem] = sectionId;
          }
        }

        // Calculate new item order
        const currentItems = targetSection.items.map((i) => i.href);
        const newSectionOrder = currentItems.filter((h) => h !== draggedItem);
        const targetIndex = newSectionOrder.indexOf(targetItemHref);
        newSectionOrder.splice(targetIndex, 0, draggedItem);

        const newItemOrder = { ...state.layout.itemOrder, [sectionId]: newSectionOrder };

        // Update old section order if moving between sections
        if (currentSection.id !== sectionId) {
          const oldItems = currentSection.items
            .map((i) => i.href)
            .filter((h) => h !== draggedItem);
          if (oldItems.length > 0) {
            newItemOrder[currentSection.id] = oldItems;
          }
        }

        dispatch({
          type: "SET_LAYOUT",
          layout: { itemPlacements: newPlacements, itemOrder: newItemOrder },
        });
        dispatch({ type: "CLEAR_DRAG_STATE" });
      },

      onDragEnd: () => {
        dispatch({ type: "CLEAR_DRAG_STATE" });
      },
    }),
    [state.dragState, state.layout, sections, baseSections]
  );

  return {
    sections,
    visibleSections,
    hiddenSectionIds,
    hasCustomLayout: state.hasCustomLayout,
    isLoaded: state.isLoaded,
    dragState: state.dragState,
    renameSection,
    hideSection,
    showSection,
    resetLayout,
    setAsDefault,
    sectionDragHandlers,
    itemDragHandlers,
  };
}
