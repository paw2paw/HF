/**
 * Tests for SortableList component and reorder logic
 *
 * Covers:
 * - Pure reorderItems function (splice-and-insert, boundary safety)
 * - Component rendering (items, add button, empty state, drag handles)
 * - Section grouping
 * - Kebab menu interactions
 * - Enable/disable toggle
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { reorderItems } from "@/lib/sortable/reorder";
import { SortableList } from "@/components/shared/SortableList";

// ── Pure reorder logic ──────────────────────────────────────────

describe("reorderItems", () => {
  it("moves item forward", () => {
    expect(reorderItems(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves item backward", () => {
    expect(reorderItems(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("returns same reference when from === to", () => {
    const items = ["a", "b", "c"];
    expect(reorderItems(items, 1, 1)).toBe(items);
  });

  it("returns same reference for out-of-bounds from", () => {
    const items = ["a", "b"];
    expect(reorderItems(items, -1, 0)).toBe(items);
    expect(reorderItems(items, 5, 0)).toBe(items);
  });

  it("returns same reference for out-of-bounds to", () => {
    const items = ["a", "b"];
    expect(reorderItems(items, 0, -1)).toBe(items);
    expect(reorderItems(items, 0, 5)).toBe(items);
  });

  it("does not mutate original array", () => {
    const items = ["a", "b", "c"];
    const result = reorderItems(items, 0, 2);
    expect(items).toEqual(["a", "b", "c"]);
    expect(result).not.toBe(items);
  });

  it("handles single-item array", () => {
    expect(reorderItems(["a"], 0, 0)).toEqual(["a"]);
  });

  it("handles adjacent swap forward", () => {
    expect(reorderItems(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  it("handles adjacent swap backward", () => {
    expect(reorderItems(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
  });

  it("moves last item to first position", () => {
    expect(reorderItems(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("moves first item to last position", () => {
    expect(reorderItems(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("handles empty array", () => {
    const items: string[] = [];
    expect(reorderItems(items, 0, 0)).toBe(items);
  });
});

// ── Component rendering ─────────────────────────────────────────

type TestItem = { id: string; label: string; section?: string; enabled?: boolean };

const testItems: TestItem[] = [
  { id: "1", label: "Alpha" },
  { id: "2", label: "Beta" },
  { id: "3", label: "Gamma" },
];

const defaultProps = {
  onReorder: vi.fn(),
  onRemove: vi.fn(),
  renderCard: (item: TestItem) => <span>{item.label}</span>,
  getItemId: (item: TestItem) => item.id,
};

describe("SortableList rendering", () => {
  it("renders all items via renderCard", () => {
    render(<SortableList items={testItems} {...defaultProps} />);
    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
    expect(screen.getByText("Gamma")).toBeDefined();
  });

  it("renders drag handles when not disabled", () => {
    const { container } = render(<SortableList items={testItems} {...defaultProps} />);
    const handles = container.querySelectorAll('[data-testid="drag-handle"]');
    expect(handles).toHaveLength(3);
  });

  it("hides drag handles when disabled", () => {
    const { container } = render(<SortableList items={testItems} {...defaultProps} disabled />);
    const handles = container.querySelectorAll('[data-testid="drag-handle"]');
    expect(handles).toHaveLength(0);
  });

  it("renders add button with custom label when onAdd provided", () => {
    render(
      <SortableList items={testItems} {...defaultProps} onAdd={() => {}} addLabel="+ Add Session" />
    );
    expect(screen.getByText("+ Add Session")).toBeDefined();
  });

  it("hides add button when onAdd not provided", () => {
    render(<SortableList items={testItems} {...defaultProps} />);
    expect(screen.queryByTestId("add-btn")).toBeNull();
  });

  it("renders empty state when items is empty", () => {
    render(<SortableList items={[]} {...defaultProps} emptyLabel="Nothing here." />);
    expect(screen.getByText("Nothing here.")).toBeDefined();
  });

  it("renders add button in empty state", () => {
    render(
      <SortableList items={[]} {...defaultProps} onAdd={() => {}} addLabel="+ Add First" />
    );
    expect(screen.getByText("+ Add First")).toBeDefined();
  });
});

// ── Callbacks ───────────────────────────────────────────────────

describe("SortableList callbacks", () => {
  it("calls onAdd when add button clicked", () => {
    const onAdd = vi.fn();
    render(<SortableList items={testItems} {...defaultProps} onAdd={onAdd} />);
    fireEvent.click(screen.getByTestId("add-btn"));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("calls onRemove from kebab menu", () => {
    const onRemove = vi.fn();
    const { container } = render(
      <SortableList items={testItems} {...defaultProps} onRemove={onRemove} />
    );
    // Open kebab on first card
    const kebabs = container.querySelectorAll('[data-testid="kebab-trigger"]');
    fireEvent.click(kebabs[0]);
    // Click Delete
    fireEvent.click(screen.getByText("Delete"));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it("calls onDuplicate from kebab menu", () => {
    const onDuplicate = vi.fn();
    const { container } = render(
      <SortableList items={testItems} {...defaultProps} onDuplicate={onDuplicate} />
    );
    const kebabs = container.querySelectorAll('[data-testid="kebab-trigger"]');
    fireEvent.click(kebabs[1]);
    fireEvent.click(screen.getByText("Duplicate"));
    expect(onDuplicate).toHaveBeenCalledWith(1);
  });

  it("calls onToggle from toggle button", () => {
    const onToggle = vi.fn();
    const { container } = render(
      <SortableList items={testItems} {...defaultProps} onToggle={onToggle} />
    );
    const toggles = container.querySelectorAll('[data-testid="toggle-btn"]');
    fireEvent.click(toggles[0]);
    expect(onToggle).toHaveBeenCalledWith(0);
  });

  it("calls onReorder via move up in kebab menu", () => {
    const onReorder = vi.fn();
    const { container } = render(
      <SortableList items={testItems} {...defaultProps} onReorder={onReorder} />
    );
    // Open kebab on second item (index 1)
    const kebabs = container.querySelectorAll('[data-testid="kebab-trigger"]');
    fireEvent.click(kebabs[1]);
    fireEvent.click(screen.getByText("Move up"));
    expect(onReorder).toHaveBeenCalledWith(1, 0);
  });

  it("calls onReorder via move down in kebab menu", () => {
    const onReorder = vi.fn();
    const { container } = render(
      <SortableList items={testItems} {...defaultProps} onReorder={onReorder} />
    );
    // Open kebab on first item (index 0)
    const kebabs = container.querySelectorAll('[data-testid="kebab-trigger"]');
    fireEvent.click(kebabs[0]);
    fireEvent.click(screen.getByText("Move down"));
    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });
});

// ── minItems guard ──────────────────────────────────────────────

describe("SortableList minItems", () => {
  it("hides delete when at minItems", () => {
    const { container } = render(
      <SortableList items={testItems.slice(0, 2)} {...defaultProps} minItems={2} />
    );
    // Open kebab
    const kebabs = container.querySelectorAll('[data-testid="kebab-trigger"]');
    fireEvent.click(kebabs[0]);
    expect(screen.queryByText("Delete")).toBeNull();
  });

  it("shows delete when above minItems", () => {
    const { container } = render(
      <SortableList items={testItems} {...defaultProps} minItems={2} />
    );
    const kebabs = container.querySelectorAll('[data-testid="kebab-trigger"]');
    fireEvent.click(kebabs[0]);
    expect(screen.getByText("Delete")).toBeDefined();
  });
});

// ── Section grouping ────────────────────────────────────────────

describe("SortableList with sections", () => {
  const sectionedItems: TestItem[] = [
    { id: "1", label: "Personality", section: "measure" },
    { id: "2", label: "Learning Style", section: "measure" },
    { id: "3", label: "Build Prompt", section: "compose" },
  ];

  const sections = [
    { key: "measure", label: "Measure", color: "#a78bfa" },
    { key: "compose", label: "Compose", color: "#3b82f6" },
  ];

  it("renders section headers", () => {
    render(
      <SortableList
        items={sectionedItems}
        sections={sections}
        getItemSection={(item) => item.section || ""}
        {...defaultProps}
      />
    );
    expect(screen.getByText("Measure")).toBeDefined();
    expect(screen.getByText("Compose")).toBeDefined();
  });

  it("shows step count per section", () => {
    render(
      <SortableList
        items={sectionedItems}
        sections={sections}
        getItemSection={(item) => item.section || ""}
        {...defaultProps}
      />
    );
    expect(screen.getByText("2 steps")).toBeDefined();
    expect(screen.getByText("1 step")).toBeDefined();
  });

  it("renders items under correct sections", () => {
    render(
      <SortableList
        items={sectionedItems}
        sections={sections}
        getItemSection={(item) => item.section || ""}
        {...defaultProps}
      />
    );
    expect(screen.getByText("Personality")).toBeDefined();
    expect(screen.getByText("Learning Style")).toBeDefined();
    expect(screen.getByText("Build Prompt")).toBeDefined();
  });

  it("shows per-section add button when onAdd provided", () => {
    const onAdd = vi.fn();
    render(
      <SortableList
        items={sectionedItems}
        sections={sections}
        getItemSection={(item) => item.section || ""}
        {...defaultProps}
        onAdd={onAdd}
      />
    );
    const addBtns = screen.getAllByText("+ Add");
    expect(addBtns).toHaveLength(2);
  });
});

// ── Enable/disable visual state ─────────────────────────────────

describe("SortableList enable/disable", () => {
  const itemsWithEnabled: TestItem[] = [
    { id: "1", label: "Active", enabled: true },
    { id: "2", label: "Disabled", enabled: false },
  ];

  it("renders cards with reduced opacity when disabled", () => {
    const { container } = render(
      <SortableList
        items={itemsWithEnabled}
        {...defaultProps}
        isItemEnabled={(item) => item.enabled !== false}
        onToggle={() => {}}
      />
    );
    const cards = container.querySelectorAll('[data-testid="sortable-card"]');
    expect(cards[0].getAttribute("style")).toContain("opacity: 1");
    expect(cards[1].getAttribute("style")).toContain("opacity: 0.45");
  });

  it("renders dashed border on disabled cards", () => {
    const { container } = render(
      <SortableList
        items={itemsWithEnabled}
        {...defaultProps}
        isItemEnabled={(item) => item.enabled !== false}
        onToggle={() => {}}
      />
    );
    const cards = container.querySelectorAll('[data-testid="sortable-card"]');
    expect(cards[1].getAttribute("style")).toContain("dashed");
  });
});
