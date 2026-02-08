// Sidebar navigation types

export type NavItem = {
  href: string;
  label: string;
  icon?: string;
  highlighted?: boolean;
};

export type NavSection = {
  id: string;
  title?: string;
  items: NavItem[];
  dividerAfter?: boolean;
};

// Persisted layout configuration
export type SidebarLayout = {
  sectionOrder: string[];
  itemPlacements: Record<string, string>; // itemHref → sectionId
  itemOrder: Record<string, string[]>; // sectionId → [itemHrefs in order]
  sectionTitles?: Record<string, string>; // sectionId → custom title
  hiddenSections?: string[]; // sectionIds to hide
};

// Drag state for UI binding
export type SidebarDragState = {
  draggedSection: string | null;
  draggedItem: string | null;
  dragOverSection: string | null;
  dragOverItem: string | null;
  dragOverSectionForItem: string | null;
};

// Actions for the reducer
export type SidebarAction =
  | { type: "SET_LAYOUT"; layout: Partial<SidebarLayout> }
  | { type: "RESET_LAYOUT" }
  | { type: "MOVE_SECTION"; fromId: string; toId: string }
  | { type: "MOVE_ITEM"; itemHref: string; toSectionId: string; atIndex?: number }
  | { type: "RENAME_SECTION"; sectionId: string; title: string }
  | { type: "HIDE_SECTION"; sectionId: string }
  | { type: "SHOW_SECTION"; sectionId: string }
  | { type: "SET_DRAG_STATE"; dragState: Partial<SidebarDragState> }
  | { type: "CLEAR_DRAG_STATE" };

// Combined state for reducer
export type SidebarState = {
  layout: SidebarLayout;
  dragState: SidebarDragState;
  hasCustomLayout: boolean;
  isLoaded: boolean;
};

// Initial/empty layout
export const EMPTY_LAYOUT: SidebarLayout = {
  sectionOrder: [],
  itemPlacements: {},
  itemOrder: {},
  sectionTitles: {},
  hiddenSections: [],
};

export const EMPTY_DRAG_STATE: SidebarDragState = {
  draggedSection: null,
  draggedItem: null,
  dragOverSection: null,
  dragOverItem: null,
  dragOverSectionForItem: null,
};
