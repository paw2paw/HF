/**
 * Tests for TypePickerDialog component
 *
 * Covers:
 * - Rendering when open/closed
 * - Category sidebar with counts
 * - Item display (name, description, meta, badge, disabled state)
 * - Search filtering (name, description, meta)
 * - Cross-category search (auto-switches to "All")
 * - Category switching clears search
 * - onSelect + onClose callbacks
 * - Disabled items cannot be selected
 * - Close via X button
 * - Close via overlay click
 * - Close via Escape key
 * - Empty state messages
 * - defaultCategory prop
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TypePickerDialog, PickerCategory, PickerItem } from "@/components/shared/TypePickerDialog";

// ── Test data ────────────────────────────────────────────────────

const categories: PickerCategory[] = [
  { key: "agent", label: "Agent / Identity", color: "#3b82f6" },
  { key: "caller", label: "Caller / Understanding", color: "#f59e0b" },
  { key: "content", label: "Content", color: "#22c55e" },
];

const items: PickerItem[] = [
  { id: "s1", name: "Tutor Identity", description: "Main tutor persona", category: "agent", meta: "IDENTITY" },
  { id: "s2", name: "Voice Config", description: "Voice guidance settings", category: "agent", meta: "VOICE" },
  { id: "s3", name: "Personality Measure", description: "Measures personality traits", category: "caller", meta: "EXTRACT" },
  { id: "s4", name: "Learning Style", description: "VARK assessment", category: "caller", meta: "EXTRACT" },
  { id: "s5", name: "Memory Extract", category: "caller", meta: "EXTRACT" },
  { id: "s6", name: "Course Material", description: "Teaching content pack", category: "content", meta: "CONTENT" },
  { id: "s7", name: "Already Added", description: "This one is in use", category: "agent", disabled: true, disabledReason: "Already in playbook" },
];

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSelect: vi.fn(),
  title: "Add Spec to Playbook",
  categories,
  items,
  searchPlaceholder: "Search specs...",
};

// ── Rendering ────────────────────────────────────────────────────

describe("TypePickerDialog rendering", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<TypePickerDialog {...defaultProps} open={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders overlay and dialog when open", () => {
    render(<TypePickerDialog {...defaultProps} />);
    expect(screen.getByTestId("picker-overlay")).toBeDefined();
    expect(screen.getByTestId("picker-dialog")).toBeDefined();
  });

  it("renders the title", () => {
    render(<TypePickerDialog {...defaultProps} />);
    expect(screen.getByText("Add Spec to Playbook")).toBeDefined();
  });

  it("renders search input with placeholder", () => {
    render(<TypePickerDialog {...defaultProps} />);
    const input = screen.getByTestId("picker-search") as HTMLInputElement;
    expect(input.placeholder).toBe("Search specs...");
  });

  it("renders all category buttons with counts", () => {
    render(<TypePickerDialog {...defaultProps} />);
    expect(screen.getByTestId("picker-cat-agent")).toBeDefined();
    expect(screen.getByTestId("picker-cat-caller")).toBeDefined();
    expect(screen.getByTestId("picker-cat-content")).toBeDefined();
    // Agent has 3 items (s1, s2, s7), Caller has 3 (s3, s4, s5), Content has 1 (s6)
    expect(screen.getByTestId("picker-cat-agent").textContent).toContain("3");
    expect(screen.getByTestId("picker-cat-caller").textContent).toContain("3");
    expect(screen.getByTestId("picker-cat-content").textContent).toContain("1");
  });

  it("renders default category items on open", () => {
    render(<TypePickerDialog {...defaultProps} />);
    // Default is first category = "agent" which has: Tutor Identity, Voice Config, Already Added
    expect(screen.getByText("Tutor Identity")).toBeDefined();
    expect(screen.getByText("Voice Config")).toBeDefined();
    expect(screen.getByText("Already Added")).toBeDefined();
    // Should NOT see caller items
    expect(screen.queryByText("Personality Measure")).toBeNull();
  });
});

// ── Item display ─────────────────────────────────────────────────

describe("TypePickerDialog item display", () => {
  it("renders item description", () => {
    render(<TypePickerDialog {...defaultProps} />);
    expect(screen.getByText("Main tutor persona")).toBeDefined();
  });

  it("renders item meta", () => {
    render(<TypePickerDialog {...defaultProps} />);
    expect(screen.getByText("IDENTITY")).toBeDefined();
    expect(screen.getByText("VOICE")).toBeDefined();
  });

  it("renders disabled item with reduced opacity", () => {
    render(<TypePickerDialog {...defaultProps} />);
    const disabledItem = screen.getByTestId("picker-item-s7");
    expect(disabledItem.getAttribute("style")).toContain("opacity: 0.5");
  });

  it("renders disabledReason on disabled items", () => {
    render(<TypePickerDialog {...defaultProps} />);
    expect(screen.getByText(/Already in playbook/)).toBeDefined();
  });

  it("renders badge when provided", () => {
    const itemsWithBadge: PickerItem[] = [
      { id: "b1", name: "Badged Item", category: "agent", badge: <span data-testid="badge-icon">🎯</span> },
    ];
    render(<TypePickerDialog {...defaultProps} items={itemsWithBadge} />);
    expect(screen.getByTestId("badge-icon")).toBeDefined();
  });
});

// ── Category switching ───────────────────────────────────────────

describe("TypePickerDialog category switching", () => {
  it("switches to caller category on click", () => {
    render(<TypePickerDialog {...defaultProps} />);
    fireEvent.click(screen.getByTestId("picker-cat-caller"));
    expect(screen.getByText("Personality Measure")).toBeDefined();
    expect(screen.getByText("Learning Style")).toBeDefined();
    expect(screen.getByText("Memory Extract")).toBeDefined();
    // Agent items should be hidden
    expect(screen.queryByText("Tutor Identity")).toBeNull();
  });

  it("switches to content category on click", () => {
    render(<TypePickerDialog {...defaultProps} />);
    fireEvent.click(screen.getByTestId("picker-cat-content"));
    expect(screen.getByText("Course Material")).toBeDefined();
    expect(screen.queryByText("Tutor Identity")).toBeNull();
  });

  it("uses defaultCategory when provided", () => {
    render(<TypePickerDialog {...defaultProps} defaultCategory="content" />);
    expect(screen.getByText("Course Material")).toBeDefined();
    expect(screen.queryByText("Tutor Identity")).toBeNull();
  });
});

// ── Search filtering ─────────────────────────────────────────────

describe("TypePickerDialog search", () => {
  it("filters items by name", () => {
    render(<TypePickerDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId("picker-search"), { target: { value: "tutor" } });
    expect(screen.getByText("Tutor Identity")).toBeDefined();
    // Other items filtered out
    expect(screen.queryByText("Voice Config")).toBeNull();
  });

  it("filters items by description", () => {
    render(<TypePickerDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId("picker-search"), { target: { value: "VARK" } });
    expect(screen.getByText("Learning Style")).toBeDefined();
    expect(screen.queryByText("Tutor Identity")).toBeNull();
  });

  it("filters items by meta", () => {
    render(<TypePickerDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId("picker-search"), { target: { value: "VOICE" } });
    expect(screen.getByText("Voice Config")).toBeDefined();
    expect(screen.queryByText("Tutor Identity")).toBeNull();
  });

  it("searches across all categories when typing", () => {
    render(<TypePickerDialog {...defaultProps} />);
    // Start on agent category, then search for a caller item
    fireEvent.change(screen.getByTestId("picker-search"), { target: { value: "personality" } });
    // Should find the caller item despite being on "agent" category
    expect(screen.getByText("Personality Measure")).toBeDefined();
  });

  it("shows empty state when search has no results", () => {
    render(<TypePickerDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId("picker-search"), { target: { value: "zzzznotfound" } });
    expect(screen.getByText('No results for "zzzznotfound"')).toBeDefined();
  });

  it("clearing search shows category items again", () => {
    render(<TypePickerDialog {...defaultProps} />);
    const input = screen.getByTestId("picker-search");
    fireEvent.change(input, { target: { value: "personality" } });
    expect(screen.getByText("Personality Measure")).toBeDefined();
    // Clear search
    fireEvent.change(input, { target: { value: "" } });
    // Back to agent category items
    expect(screen.getByText("Tutor Identity")).toBeDefined();
    expect(screen.queryByText("Personality Measure")).toBeNull();
  });

  it("clicking category clears search", () => {
    render(<TypePickerDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId("picker-search"), { target: { value: "personality" } });
    // Click agent category
    fireEvent.click(screen.getByTestId("picker-cat-agent"));
    const input = screen.getByTestId("picker-search") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(screen.getByText("Tutor Identity")).toBeDefined();
  });
});

// ── Selection callbacks ──────────────────────────────────────────

describe("TypePickerDialog callbacks", () => {
  it("calls onSelect and onClose when item clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<TypePickerDialog {...defaultProps} onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("picker-item-s1"));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "s1", name: "Tutor Identity" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onSelect when disabled item clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<TypePickerDialog {...defaultProps} onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("picker-item-s7"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when X button clicked", () => {
    const onClose = vi.fn();
    render(<TypePickerDialog {...defaultProps} onClose={onClose} />);
    // X button is the only button in the header area without data-testid
    const xButton = screen.getByTestId("picker-dialog").querySelector("button");
    fireEvent.click(xButton!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when overlay clicked", () => {
    const onClose = vi.fn();
    render(<TypePickerDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("picker-overlay"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose when dialog body clicked", () => {
    const onClose = vi.fn();
    render(<TypePickerDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("picker-dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<TypePickerDialog {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ── Empty state ──────────────────────────────────────────────────

describe("TypePickerDialog empty state", () => {
  it("shows empty category message when no items in category", () => {
    const emptyItems: PickerItem[] = [
      { id: "x1", name: "Only Agent", category: "agent" },
    ];
    render(<TypePickerDialog {...defaultProps} items={emptyItems} defaultCategory="caller" />);
    expect(screen.getByText("No items in this category")).toBeDefined();
  });

  it("shows category count of 0 for empty categories", () => {
    const emptyItems: PickerItem[] = [
      { id: "x1", name: "Only Agent", category: "agent" },
    ];
    render(<TypePickerDialog {...defaultProps} items={emptyItems} />);
    expect(screen.getByTestId("picker-cat-caller").textContent).toContain("0");
    expect(screen.getByTestId("picker-cat-content").textContent).toContain("0");
  });
});
