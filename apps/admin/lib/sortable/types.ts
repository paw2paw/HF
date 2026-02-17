import type { ReactNode } from "react";

/** Section grouping definition (optional) */
export interface SortableSection {
  key: string;
  label: string;
  color?: string;
}

/** Props for the SortableList component */
export interface SortableListProps<T> {
  items: T[];
  sections?: SortableSection[];

  // Callbacks
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAdd?: (() => void) | ((sectionKey?: string) => void);
  onDuplicate?: (index: number) => void;
  onToggle?: (index: number) => void;
  onRemove: (index: number) => void;

  // Render slot
  renderCard: (item: T, index: number) => ReactNode;

  // Identity and classification
  getItemId: (item: T) => string;
  getItemSection?: (item: T) => string;
  isItemEnabled?: (item: T) => boolean;

  // Configuration
  disabled?: boolean;
  minItems?: number;
  addLabel?: string;
  emptyLabel?: string;
}

/** Internal drag state */
export interface DragState {
  fromIndex: number | null;
  overIndex: number | null;
}
