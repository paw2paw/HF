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
  const [hovered, setHovered] = useState(false);
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

  return (
    <div
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: isDragTarget
          ? "2px dashed var(--accent-primary, #3b82f6)"
          : enabled
            ? "1px solid var(--border-default, #e5e7eb)"
            : "1px dashed var(--border-default, #e5e7eb)",
        background: isDragTarget
          ? "color-mix(in srgb, var(--accent-primary, #3b82f6) 5%, transparent)"
          : "var(--surface-primary, #fff)",
        opacity: enabled ? 1 : 0.45,
        transition: "all 0.15s ease",
        marginBottom: 6,
        position: "relative",
        cursor: disabled ? "default" : "grab",
      }}
      data-testid="sortable-card"
    >
      {/* Drag handle */}
      {!disabled && (
        <div
          data-testid="drag-handle"
          style={{
            flexShrink: 0,
            color: hovered ? "var(--text-secondary, #6b7280)" : "var(--text-muted, #9ca3af)",
            display: "flex",
            alignItems: "center",
            cursor: "grab",
            transition: "color 0.15s",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={16} />
        </div>
      )}

      {/* Card content (render slot) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>

      {/* Enable/disable toggle */}
      {onToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: enabled ? "var(--status-success, #22c55e)" : "var(--text-muted, #9ca3af)",
            display: "flex",
            alignItems: "center",
            padding: 2,
          }}
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
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            style={{
              width: 28,
              height: 28,
              border: "none",
              background: menuOpen ? "rgba(255,255,255,0.06)" : "none",
              color: "var(--text-muted, #9ca3af)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              opacity: hovered || menuOpen ? 1 : 0,
              transition: "opacity 0.15s",
            }}
            data-testid="kebab-trigger"
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: 32,
                right: 0,
                background: "var(--surface-primary, #fff)",
                border: "1px solid var(--border-default, #e5e7eb)",
                borderRadius: 10,
                padding: 4,
                minWidth: 150,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                zIndex: 50,
              }}
              data-testid="kebab-menu"
            >
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
  return (
    <button
      onClick={onClick}
      disabled={itemDisabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 6,
        fontSize: 12,
        color: itemDisabled
          ? "var(--text-muted, #9ca3af)"
          : danger
            ? "var(--status-error, #ef4444)"
            : "var(--text-secondary, #6b7280)",
        cursor: itemDisabled ? "default" : "pointer",
        border: "none",
        background: "none",
        width: "100%",
        textAlign: "left",
        opacity: itemDisabled ? 0.4 : 1,
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!itemDisabled) {
          (e.currentTarget as HTMLButtonElement).style.background = danger
            ? "rgba(239,68,68,0.08)"
            : "rgba(0,0,0,0.04)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "none";
      }}
    >
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );
}

function KebabSep() {
  return <div style={{ height: 1, background: "var(--border-default, #e5e7eb)", margin: "4px 6px" }} />;
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
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            padding: "24px 16px",
            textAlign: "center",
            color: "var(--text-muted, #9ca3af)",
            fontSize: 13,
            borderRadius: 10,
            border: "1px dashed var(--border-default, #e5e7eb)",
          }}
          data-testid="empty-state"
        >
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
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {sections.map((section, sectionIdx) => {
          const sectionItems = grouped.get(section.key) || [];
          return (
            <div key={section.key} style={{ marginTop: sectionIdx > 0 ? 16 : 0 }}>
              {/* Section header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  paddingBottom: 6,
                  marginBottom: 8,
                  borderBottom: `2px solid ${section.color || "var(--border-default, #e5e7eb)"}`,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                    padding: "2px 8px",
                    borderRadius: 5,
                    background: section.color
                      ? `color-mix(in srgb, ${section.color} 12%, transparent)`
                      : "var(--surface-secondary, #f9fafb)",
                    color: section.color || "var(--text-secondary, #6b7280)",
                  }}
                >
                  {section.label}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted, #9ca3af)" }}>
                  {sectionItems.length} {sectionItems.length === 1 ? "step" : "steps"}
                </span>
                {onAdd && !disabled && (
                  <button
                    onClick={() => (onAdd as (sectionKey?: string) => void)(section.key)}
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      color: section.color || "var(--accent-primary, #3b82f6)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 4,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = section.color
                        ? `color-mix(in srgb, ${section.color} 8%, transparent)`
                        : "rgba(59,130,246,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "none";
                    }}
                  >
                    + Add
                  </button>
                )}
              </div>

              {/* Section items */}
              {sectionItems.length === 0 && (
                <div style={{
                  padding: "12px",
                  textAlign: "center",
                  color: "var(--text-muted, #9ca3af)",
                  fontSize: 11,
                  fontStyle: "italic",
                }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
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
    <button
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: 8,
        border: "1px dashed var(--border-default, #e5e7eb)",
        background: "transparent",
        fontSize: 12,
        cursor: "pointer",
        color: "var(--text-secondary, #6b7280)",
        marginTop: 4,
        width: "100%",
        textAlign: "center",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.borderColor = "var(--accent-primary, #3b82f6)";
        btn.style.color = "var(--accent-primary, #3b82f6)";
        btn.style.background = "color-mix(in srgb, var(--accent-primary, #3b82f6) 5%, transparent)";
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.borderColor = "var(--border-default, #e5e7eb)";
        btn.style.color = "var(--text-secondary, #6b7280)";
        btn.style.background = "transparent";
      }}
      data-testid="add-btn"
    >
      {label}
    </button>
  );
}
