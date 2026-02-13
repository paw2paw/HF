"use client";

import { useReducer, useMemo, useCallback, useEffect, useRef, useState } from "react";
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
  loadPersonalDefault,
  savePersonalDefault,
  clearPersonalDefault,
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

    case "DELETE_SECTION": {
      const deleted = state.layout.deletedSections || [];
      if (deleted.includes(action.sectionId)) return state;
      const hidden = (state.layout.hiddenSections || []).filter(
        (id) => id !== action.sectionId
      );
      return {
        ...state,
        layout: {
          ...state.layout,
          deletedSections: [...deleted, action.sectionId],
          hiddenSections: hidden,
        },
        hasCustomLayout: true,
      };
    }

    case "UNDO_DELETE_SECTION": {
      const deleted = state.layout.deletedSections || [];
      if (!deleted.includes(action.sectionId)) return state;
      return {
        ...state,
        layout: {
          ...state.layout,
          deletedSections: deleted.filter((id) => id !== action.sectionId),
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

// Role hierarchy for requiredRole checks — must match lib/permissions.ts ROLE_LEVEL
const SIDEBAR_ROLE_LEVEL: Record<string, number> = {
  SUPERADMIN: 5,
  ADMIN: 4,
  OPERATOR: 3,
  SUPER_TESTER: 2,
  TESTER: 1,
  DEMO: 0,
  VIEWER: 1, // @deprecated alias
};

export interface UseSidebarLayoutOptions {
  userId?: string;
  userRole?: string;
  baseSections: NavSection[];
  isAdmin?: boolean;
}

export interface UseSidebarLayoutResult {
  // Computed sections (ordered, with items moved, filtered by visibility)
  sections: NavSection[];
  visibleSections: NavSection[];
  hiddenSectionIds: string[];
  deletedSectionIds: string[];
  hasCustomLayout: boolean;
  hasPersonalDefault: boolean;
  isLoaded: boolean;

  // Drag state for UI
  dragState: SidebarDragState;

  // Section actions
  renameSection: (sectionId: string, title: string) => void;
  hideSection: (sectionId: string) => void;
  showSection: (sectionId: string) => void;
  deleteSection: (sectionId: string) => void;
  undoDeleteSection: (sectionId: string) => void;

  // Layout actions
  resetLayout: () => Promise<void>;
  setAsDefault: () => Promise<boolean>;
  setAsPersonalDefault: () => Promise<boolean>;

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
  userRole,
  baseSections,
  isAdmin = false,
}: UseSidebarLayoutOptions): UseSidebarLayoutResult {
  const [state, dispatch] = useReducer(sidebarReducer, INITIAL_STATE);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);
  const [hasPersonalDefault, setHasPersonalDefault] = useState(false);

  // ============================================================================
  // Role-based section filtering
  // ============================================================================

  // Filter baseSections by requiredRole (hard gate) and apply defaultHiddenFor
  const { roleSections, roleDefaultHidden } = useMemo(() => {
    const userLevel = SIDEBAR_ROLE_LEVEL[userRole || "OPERATOR"] ?? 3;

    // Hard gate: remove sections the user's role can't see
    const filtered = baseSections.filter((section) => {
      if (!section.requiredRole) return true;
      const requiredLevel = SIDEBAR_ROLE_LEVEL[section.requiredRole] ?? 0;
      return userLevel >= requiredLevel;
    });

    // Soft default: collect section IDs that should be hidden by default for this role
    const defaultHidden = filtered
      .filter((section) => section.defaultHiddenFor?.includes(userRole || "OPERATOR"))
      .map((section) => section.id);

    return { roleSections: filtered, roleDefaultHidden: defaultHidden };
  }, [baseSections, userRole]);

  // ============================================================================
  // Load layout on mount
  // ============================================================================

  useEffect(() => {
    if (hasLoadedRef.current) return;

    let cancelled = false;

    const load = async () => {
      // 1. Try localStorage (working copy)
      const userLayout = loadLayout(userId);
      if (userLayout && !cancelled) {
        dispatch({ type: "SET_LAYOUT", layout: userLayout });
        hasLoadedRef.current = true;
        // Check if personal default exists in the background
        loadPersonalDefault().then((p) => {
          if (p && !cancelled) setHasPersonalDefault(true);
        });
        return;
      }

      // 2. Try personal DB default (survives cache clears)
      const personalLayout = await loadPersonalDefault();
      if (personalLayout && !cancelled) {
        setHasPersonalDefault(true);
        dispatch({ type: "SET_LAYOUT", layout: personalLayout });
        hasLoadedRef.current = true;
        return;
      }

      // 3. Try global default
      const globalLayout = await loadGlobalDefault();
      if (globalLayout && !cancelled) {
        dispatch({ type: "SET_LAYOUT", layout: globalLayout });
        hasLoadedRef.current = true;
      } else if (!cancelled) {
        // 4. No saved layout — apply role-based defaults
        const roleLayout: Partial<typeof EMPTY_LAYOUT> = {};
        if (roleDefaultHidden.length > 0) {
          roleLayout.hiddenSections = roleDefaultHidden;
        }
        dispatch({ type: "SET_LAYOUT", layout: roleLayout });
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

    // Use role-filtered sections (hard gate applied via requiredRole)
    const effectiveSections = roleSections;

    // Determine section order
    let orderedSections: NavSection[];
    if (sectionOrder.length === 0) {
      orderedSections = effectiveSections;
    } else {
      const orderedIds = sectionOrder.filter((id) =>
        effectiveSections.some((s) => s.id === id)
      );
      const newSectionIds = effectiveSections
        .filter((s) => !sectionOrder.includes(s.id))
        .map((s) => s.id);
      const finalOrder = [...orderedIds, ...newSectionIds];

      orderedSections = finalOrder
        .map((id) => effectiveSections.find((s) => s.id === id))
        .filter((s): s is NavSection => s !== undefined);
    }

    // Build section items map
    const sectionItems: Record<string, NavItem[]> = {};
    for (const section of orderedSections) {
      sectionItems[section.id] = [];
    }

    // Collect items into target sections
    for (const section of effectiveSections) {
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
  }, [roleSections, state.layout]);

  // Filter visible sections (exclude both hidden and deleted)
  const hiddenSectionIds = useMemo(
    () => state.layout.hiddenSections || [],
    [state.layout.hiddenSections]
  );
  const deletedSectionIds = useMemo(
    () => state.layout.deletedSections || [],
    [state.layout.deletedSections]
  );
  const visibleSections = useMemo(
    () => sections.filter(
      (s) => !hiddenSectionIds.includes(s.id) && !deletedSectionIds.includes(s.id)
    ),
    [sections, hiddenSectionIds, deletedSectionIds]
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

  const deleteSection = useCallback((sectionId: string) => {
    dispatch({ type: "DELETE_SECTION", sectionId });
  }, []);

  const undoDeleteSection = useCallback((sectionId: string) => {
    dispatch({ type: "UNDO_DELETE_SECTION", sectionId });
  }, []);

  const resetLayout = useCallback(async () => {
    // 1. Clear user layer: localStorage + personal DB default
    clearLayout(userId);
    await clearPersonalDefault();
    setHasPersonalDefault(false);

    // 2. Re-load from the default layer chain: Global DB → BASE_SECTIONS
    const globalLayout = await loadGlobalDefault();
    if (globalLayout) {
      dispatch({ type: "SET_LAYOUT", layout: globalLayout });
    } else {
      dispatch({ type: "RESET_LAYOUT" });
    }
  }, [userId]);

  const setAsDefault = useCallback(async () => {
    if (!isAdmin) return false;
    return saveGlobalDefault(state.layout);
  }, [isAdmin, state.layout]);

  const setAsPersonalDefault = useCallback(async () => {
    const ok = await savePersonalDefault(state.layout);
    if (ok) setHasPersonalDefault(true);
    return ok;
  }, [state.layout]);

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
    deletedSectionIds,
    hasCustomLayout: state.hasCustomLayout,
    hasPersonalDefault,
    isLoaded: state.isLoaded,
    dragState: state.dragState,
    renameSection,
    hideSection,
    showSection,
    deleteSection,
    undoDeleteSection,
    resetLayout,
    setAsDefault,
    setAsPersonalDefault,
    sectionDragHandlers,
    itemDragHandlers,
  };
}
