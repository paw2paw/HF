"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { GripVertical, MoreVertical, Copy, Trash2, ChevronUp, ChevronDown, ToggleLeft, ToggleRight, Plus } from "lucide-react";
import { reorderItems } from "@/lib/sortable/reorder";
import type { SortableListProps, SortableSection, DragState } from "@/lib/sortable/types";

// ── SortableCard ────────────────────────────────────────────────

interface SortableCardProps {
  id: string;
  index: number;
  total: number;
  enabled: boolean;
  isDragTarget: boolean;
  isDragging: boolean;
  disabled: boolean;
  canRemove: boolean;

  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle?: () => void;
  onDuplicate?: () => void;
  onRemove?: () => void;

  children: React.ReactNode;
}

function SortableCard({
  index,
  total,
  enabled,
  isDragTarget,
  isDragging,
  disabled,
  canRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onToggle,
  onDuplicate,
  onRemove,
  children,
}: SortableCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const cardClass = [
    "hf-sortable-card",
    isDragTarget && "hf-sortable-card--drag-over",
    !enabled && "hf-sortable-card--disabled-item",
    disabled && "hf-sortable-card--readonly",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={cardClass}
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver(index);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      onMouseLeave={() => setMenuOpen(false)}
      data-testid="sortable-card"
    >
      {/* Drag handle */}
      {!disabled && (
        <div
          className="hf-drag-handle"
          data-testid="drag-handle"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={16} />
        </div>
      )}

      {/* Card content (render slot) */}
      <div className="hf-sortable-content">
        {children}
      </div>

      {/* Enable/disable toggle */}
      {onToggle && (
        <button
          className={`hf-sortable-toggle${enabled ? " hf-sortable-toggle--on" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          title={enabled ? "Disable" : "Enable"}
          data-testid="toggle-btn"
        >
          {enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
        </button>
      )}

      {/* Kebab menu */}
      {!disabled && (
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            className={`hf-kebab-trigger${menuOpen ? " hf-kebab-trigger--open" : ""}`}
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            data-testid="kebab-trigger"
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div className="hf-kebab-menu" data-testid="kebab-menu">
              {onDuplicate && (
                <KebabItem
                  icon={<Copy size={14} />}
                  label="Duplicate"
                  onClick={() => { onDuplicate(); setMenuOpen(false); }}
                />
              )}
              {onToggle && (
                <KebabItem
                  icon={enabled ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                  label={enabled ? "Disable" : "Enable"}
                  onClick={() => { onToggle(); setMenuOpen(false); }}
                />
              )}
              <KebabSep />
              <KebabItem
                icon={<ChevronUp size={14} />}
                label="Move up"
                onClick={() => { onMoveUp(); setMenuOpen(false); }}
                disabled={index === 0}
              />
              <KebabItem
                icon={<ChevronDown size={14} />}
                label="Move down"
                onClick={() => { onMoveDown(); setMenuOpen(false); }}
                disabled={index === total - 1}
              />
              {canRemove && onRemove && (
                <>
                  <KebabSep />
                  <KebabItem
                    icon={<Trash2 size={14} />}
                    label="Delete"
                    onClick={() => { onRemove(); setMenuOpen(false); }}
                    danger
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Kebab menu primitives ───────────────────────────────────────

function KebabItem({
  icon,
  label,
  onClick,
  danger,
  disabled: itemDisabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const cls = [
    "hf-kebab-item",
    danger && "hf-kebab-item--danger",
  ].filter(Boolean).join(" ");

  return (
    <button className={cls} onClick={onClick} disabled={itemDisabled}>
      <span className="hf-kebab-item-icon">{icon}</span>
      {label}
    </button>
  );
}

function KebabSep() {
  return <div className="hf-kebab-sep" />;
}

// ── SortableList ────────────────────────────────────────────────

export function SortableList<T>({
  items,
  sections,
  onReorder,
  onAdd,
  onDuplicate,
  onToggle,
  onRemove,
  renderCard,
  getItemId,
  getItemSection,
  isItemEnabled,
  disabled = false,
  minItems = 0,
  addLabel = "+ Add Item",
  emptyLabel = "No items yet.",
}: SortableListProps<T>) {
  const [dragState, setDragState] = useState<DragState>({ fromIndex: null, overIndex: null });

  const handleDragStart = useCallback((index: number) => {
    setDragState((prev) => ({ ...prev, fromIndex: index }));
  }, []);

  const handleDragOver = useCallback((index: number) => {
    setDragState((prev) => ({ ...prev, overIndex: index }));
  }, []);

  const handleDrop = useCallback(() => {
    if (dragState.fromIndex !== null && dragState.overIndex !== null && dragState.fromIndex !== dragState.overIndex) {
      onReorder(dragState.fromIndex, dragState.overIndex);
    }
    setDragState({ fromIndex: null, overIndex: null });
  }, [dragState.fromIndex, dragState.overIndex, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragState({ fromIndex: null, overIndex: null });
  }, []);

  const canRemove = items.length > minItems;

  // Group items by section (preserving global indices)
  const grouped = useMemo(() => {
    if (!sections || !getItemSection) return null;
    const groups = new Map<string, { item: T; globalIndex: number }[]>();
    // Initialise groups in section order
    for (const s of sections) {
      groups.set(s.key, []);
    }
    for (let i = 0; i < items.length; i++) {
      const key = getItemSection(items[i]);
      const bucket = groups.get(key);
      if (bucket) {
        bucket.push({ item: items[i], globalIndex: i });
      } else {
        // Ungrouped — append to last section
        const lastKey = sections[sections.length - 1].key;
        groups.get(lastKey)?.push({ item: items[i], globalIndex: i });
      }
    }
    return groups;
  }, [items, sections, getItemSection]);

  // Render a single card
  const renderItem = (item: T, globalIndex: number) => {
    const id = getItemId(item);
    const enabled = isItemEnabled ? isItemEnabled(item) : true;
    const isDragTarget = dragState.overIndex === globalIndex && dragState.fromIndex !== globalIndex && dragState.fromIndex !== null;
    const isDragging = dragState.fromIndex === globalIndex;

    return (
      <SortableCard
        key={id}
        id={id}
        index={globalIndex}
        total={items.length}
        enabled={enabled}
        isDragTarget={isDragTarget}
        isDragging={isDragging}
        disabled={disabled}
        canRemove={canRemove}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onMoveUp={() => {
          if (globalIndex > 0) onReorder(globalIndex, globalIndex - 1);
        }}
        onMoveDown={() => {
          if (globalIndex < items.length - 1) onReorder(globalIndex, globalIndex + 1);
        }}
        onToggle={onToggle ? () => onToggle(globalIndex) : undefined}
        onDuplicate={onDuplicate ? () => onDuplicate(globalIndex) : undefined}
        onRemove={canRemove ? () => onRemove(globalIndex) : undefined}
      >
        {renderCard(item, globalIndex)}
      </SortableCard>
    );
  };

  // Empty state
  if (items.length === 0) {
    return (
      <div className="hf-flex hf-flex-col hf-gap-sm">
        <div className="hf-sortable-empty" data-testid="empty-state">
          {emptyLabel}
        </div>
        {onAdd && !disabled && (
          <AddButton label={addLabel} onClick={() => onAdd()} />
        )}
      </div>
    );
  }

  // Sectioned layout
  if (grouped && sections) {
    return (
      <div className="hf-flex hf-flex-col">
        {sections.map((section, sectionIdx) => {
          const sectionItems = grouped.get(section.key) || [];
          return (
            <div key={section.key} className={sectionIdx > 0 ? "hf-sortable-section" : undefined}>
              {/* Section header */}
              <div
                className="hf-sortable-section-header"
                style={{ borderBottom: `2px solid ${section.color || "var(--border-default)"}` }}
              >
                <span
                  className="hf-sortable-section-label"
                  style={{
                    background: section.color
                      ? `color-mix(in srgb, ${section.color} 12%, transparent)`
                      : "var(--surface-secondary)",
                    color: section.color || "var(--text-secondary)",
                  }}
                >
                  {section.label}
                </span>
                <span className="hf-sortable-section-count">
                  {sectionItems.length} {sectionItems.length === 1 ? "step" : "steps"}
                </span>
                {onAdd && !disabled && (
                  <button
                    className="hf-sortable-section-add"
                    onClick={() => (onAdd as (sectionKey?: string) => void)(section.key)}
                    style={{ color: section.color || "var(--accent-primary)" }}
                  >
                    + Add
                  </button>
                )}
              </div>

              {/* Section items */}
              {sectionItems.length === 0 && (
                <div className="hf-sortable-section-empty">
                  No steps in this section
                </div>
              )}
              {sectionItems.map(({ item, globalIndex }) => renderItem(item, globalIndex))}
            </div>
          );
        })}
      </div>
    );
  }

  // Flat layout
  return (
    <div className="hf-flex hf-flex-col">
      {items.map((item, index) => renderItem(item, index))}
      {onAdd && !disabled && (
        <AddButton label={addLabel} onClick={() => onAdd()} />
      )}
    </div>
  );
}

// ── Add button ──────────────────────────────────────────────────

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="hf-sortable-add-btn" onClick={onClick} data-testid="add-btn">
      {label}
    </button>
  );
}
