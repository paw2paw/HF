"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useChatContext } from "@/contexts/ChatContext";
import { useGuidance } from "@/contexts/GuidanceContext";
import { useSidebarLayout } from "@/hooks/useSidebarLayout";
import type { NavSection } from "@/lib/sidebar/types";

// ============================================================================
// Base Section Definitions
// ============================================================================

const BASE_SECTIONS: NavSection[] = [
  {
    id: "home",
    items: [{ href: "/x", label: "Home", icon: "🏠" }],
    dividerAfter: true,
  },
  {
    id: "work",
    title: "Work",
    items: [
      { href: "/x/playground", label: "Playground", icon: "✏️" },
    ],
    dividerAfter: true,
  },
  {
    id: "data",
    title: "Data",
    items: [
      { href: "/x/callers", label: "Callers", icon: "👤" },
      { href: "/x/onboarding", label: "Onboard", icon: "🚀" },
      { href: "/x/goals", label: "Goals", icon: "🎯" },
      { href: "/x/import", label: "Import", icon: "📥" },
    ],
    dividerAfter: true,
  },
  {
    id: "config",
    title: "Configure",
    items: [
      { href: "/x/domains", label: "Domains", icon: "🌐" },
      { href: "/x/personas", label: "Personas", icon: "🎭" },
      { href: "/x/playbooks", label: "Playbooks", icon: "📒" },
      { href: "/x/specs", label: "Specs", icon: "📋" },
      { href: "/x/taxonomy", label: "Taxonomy", icon: "🌳" },
      { href: "/x/taxonomy-graph", label: "Visualizer", icon: "🌌" },
    ],
    dividerAfter: true,
  },
  {
    id: "system",
    title: "System",
    items: [
      { href: "/x/metering", label: "Metering", icon: "📈" },
      { href: "/x/ai-config", label: "AI Config", icon: "🤖" },
      { href: "/x/users", label: "Team", icon: "👥" },
      { href: "/x/settings", label: "Appearance", icon: "🎨" },
    ],
    dividerAfter: true,
  },
  {
    id: "supervisor",
    items: [{ href: "/x/supervisor", label: "Pipeline", icon: "⚡", highlighted: true }],
  },
  {
    id: "devtools",
    title: "Dev Tools",
    collapsedByDefault: true,
    items: [
      { href: "/x/debug", label: "Debug", icon: "🐛" },
      { href: "/x/logs", label: "Logs", icon: "📝" },
      { href: "/x/admin/tests", label: "E2E Tests", icon: "🎭" },
      { href: "/x/data-management", label: "Seed Data", icon: "🌱" },
    ],
  },
];

// ============================================================================
// Component
// ============================================================================

export default function SimpleSidebarNav({
  collapsed: externalCollapsed,
  onToggle: externalOnToggle,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
} = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const isAdmin = session?.user?.role === "ADMIN";
  const { togglePanel, isOpen: chatOpen } = useChatContext();
  const guidance = useGuidance();

  // Collapse state
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = externalCollapsed ?? internalCollapsed;
  const onToggle = externalOnToggle ?? (() => setInternalCollapsed((prev) => !prev));

  // Layout hook
  const {
    visibleSections,
    hiddenSectionIds,
    hasCustomLayout,
    isLoaded,
    dragState,
    renameSection,
    hideSection,
    showSection,
    resetLayout,
    setAsDefault,
    sectionDragHandlers,
    itemDragHandlers,
  } = useSidebarLayout({ userId, baseSections: BASE_SECTIONS, isAdmin });

  // UI state
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sectionId: string } | null>(null);

  // Collapsed sections state (persisted to localStorage)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [collapsedSectionsLoaded, setCollapsedSectionsLoaded] = useState(false);

  // Hydrate from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hf-sidebar-collapsed-sections");
      if (saved) {
        setCollapsedSections(new Set(JSON.parse(saved)));
      } else {
        // Initialize from collapsedByDefault
        const defaults = BASE_SECTIONS
          .filter((s) => s.collapsedByDefault)
          .map((s) => s.id);
        if (defaults.length > 0) {
          setCollapsedSections(new Set(defaults));
        }
      }
    } catch {
      // ignore
    }
    setCollapsedSectionsLoaded(true);
  }, []);

  // Persist collapsed sections (only after initial load to avoid overwriting)
  useEffect(() => {
    if (collapsedSectionsLoaded) {
      localStorage.setItem("hf-sidebar-collapsed-sections", JSON.stringify([...collapsedSections]));
    }
  }, [collapsedSections, collapsedSectionsLoaded]);

  const toggleSectionCollapse = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowLayoutMenu(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus edit input when editing
  useEffect(() => {
    if (editingSectionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSectionId]);

  // Flatten items for keyboard navigation
  const flatNavItems = useMemo(() => {
    const items: { href: string; label: string }[] = [];
    for (const section of visibleSections) {
      for (const item of section.items) {
        items.push({ href: item.href, label: item.label });
      }
    }
    return items;
  }, [visibleSections]);

  // Active state
  const isActive = useCallback(
    (href: string) => {
      if (!isLoaded || !pathname) return false;
      return pathname === href || pathname.startsWith(href + "/");
    },
    [isLoaded, pathname]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (flatNavItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % flatNavItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + flatNavItems.length) % flatNavItems.length);
      } else if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        const item = flatNavItems[focusedIndex];
        if (item) router.push(item.href);
      }
    },
    [flatNavItems, focusedIndex, router]
  );

  // Focus link on index change
  useEffect(() => {
    if (focusedIndex >= 0 && navRef.current) {
      const links = navRef.current.querySelectorAll("a[data-nav-item]");
      const link = links[focusedIndex] as HTMLElement;
      if (link) link.focus();
    }
  }, [focusedIndex]);

  // Handle nav click (refresh if same page)
  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      const [targetPath] = href.split("?");
      if (targetPath === pathname) {
        e.preventDefault();
        router.replace(href);
      }
    },
    [pathname, router]
  );

  // Section context menu
  const handleSectionContextMenu = useCallback((e: React.MouseEvent, sectionId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sectionId });
  }, []);

  // Handle rename
  const handleStartRename = useCallback((sectionId: string, currentTitle: string) => {
    setEditingSectionId(sectionId);
    setEditingTitle(currentTitle || "");
    setContextMenu(null);
  }, []);

  const handleFinishRename = useCallback(() => {
    if (editingSectionId) {
      renameSection(editingSectionId, editingTitle.trim());
      setEditingSectionId(null);
      setEditingTitle("");
    }
  }, [editingSectionId, editingTitle, renameSection]);

  // Handle set as default
  const handleSetAsDefault = useCallback(async () => {
    setSavingDefault(true);
    await setAsDefault();
    setSavingDefault(false);
    setShowLayoutMenu(false);
  }, [setAsDefault]);

  // Handle reset
  const handleReset = useCallback(() => {
    resetLayout();
    setShowLayoutMenu(false);
  }, [resetLayout]);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-900 p-3 text-neutral-900 dark:text-neutral-100 overflow-hidden">
      {/* Header */}
      {collapsed ? (
        // Collapsed: tiny expand arrow at top, icons below in same positions
        <div className="mb-3 flex flex-col items-center">
          {/* Tiny expand arrow - minimal footprint */}
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="w-full h-4 flex items-center justify-center text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors mb-1"
          >
            »
          </button>
          {/* Icons - same vertical spacing as expanded */}
          <div className="flex flex-col items-center gap-1">
            <Link href="/x" className="w-7 h-7 flex items-center justify-center text-base hover:scale-110 transition-transform rounded hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Home">
              🏠
            </Link>
            <button
              type="button"
              onClick={togglePanel}
              title={chatOpen ? "Hide AI Chat (⌘K)" : "Show AI Chat (⌘K)"}
              className={
                "inline-flex items-center justify-center rounded-md w-7 h-7 transition-colors " +
                (chatOpen
                  ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400"
                  : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800")
              }
            >
              🤖
            </button>
          </div>
        </div>
      ) : (
        // Expanded: horizontal layout
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link
            href="/x"
            className="text-sm font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            HumanFirst
          </Link>

          <div className="flex items-center gap-1">
            {/* Chat toggle */}
            <button
              type="button"
              onClick={togglePanel}
              title={chatOpen ? "Hide AI Chat (⌘K)" : "Show AI Chat (⌘K)"}
              className={
                "inline-flex items-center justify-center rounded-md w-7 h-7 transition-colors " +
                (chatOpen
                  ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400"
                  : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800")
              }
            >
              🤖
            </button>

            {/* Layout menu - only render after hydration to avoid mismatch */}
            {isLoaded && (hasCustomLayout || isAdmin || hiddenSectionIds.length > 0) && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowLayoutMenu((prev) => !prev)}
                  title="Layout options"
                  className={
                    "inline-flex items-center justify-center rounded-md w-7 h-7 transition-colors " +
                    (showLayoutMenu
                      ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
                      : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800")
                  }
                >
                  ⚙
                </button>
                {showLayoutMenu && (
                  <div className="absolute right-0 top-8 z-50 min-w-[180px] rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg py-1">
                    {hasCustomLayout && (
                      <button
                        type="button"
                        onClick={handleReset}
                        className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      >
                        ↻ Reset to Default
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleSetAsDefault}
                        disabled={savingDefault}
                        className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50"
                      >
                        {savingDefault ? "Saving..." : "💾 Set as Default for All"}
                      </button>
                    )}
                    {hiddenSectionIds.length > 0 && (
                      <>
                        <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
                        <div className="px-3 py-1 text-xs font-medium text-neutral-500 uppercase">Hidden Sections</div>
                        {hiddenSectionIds.map((id) => {
                          const section = BASE_SECTIONS.find((s) => s.id === id);
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                showSection(id);
                                setShowLayoutMenu(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                            >
                              👁 Show {section?.title || id}
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Collapse toggle */}
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-sm text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              ←
            </button>
          </div>
        </div>
      )}

      {/* Scrollable nav area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
        <nav ref={navRef} className="flex flex-col gap-3" onKeyDown={handleKeyDown} role="navigation" aria-label="Main navigation">
          {visibleSections.map((section) => {
            const isDraggingSection = dragState.draggedSection === section.id;
            const isDragOverForSection = dragState.dragOverSection === section.id;
            const isDragOverForItem = dragState.dragOverSectionForItem === section.id && dragState.draggedItem !== null;

            return (
              <div
                key={section.id}
                draggable={!collapsed && !dragState.draggedItem}
                onDragStart={(e) => !dragState.draggedItem && sectionDragHandlers.onDragStart(e, section.id)}
                onDragOver={(e) =>
                  dragState.draggedItem
                    ? itemDragHandlers.onDragOverSection(e, section.id)
                    : sectionDragHandlers.onDragOver(e, section.id)
                }
                onDragLeave={sectionDragHandlers.onDragLeave}
                onDrop={(e) =>
                  dragState.draggedItem
                    ? itemDragHandlers.onDropOnSection(e, section.id)
                    : sectionDragHandlers.onDrop(e, section.id)
                }
                onDragEnd={sectionDragHandlers.onDragEnd}
                onContextMenu={(e) => !collapsed && handleSectionContextMenu(e, section.id)}
                className={
                  "flex flex-col transition-all rounded-md " +
                  (isDraggingSection ? "opacity-50 " : "") +
                  (isDragOverForSection ? "border-t-2 border-indigo-500 " : "") +
                  (isDragOverForItem ? "bg-indigo-50 dark:bg-indigo-950/50 ring-2 ring-indigo-400 ring-inset " : "")
                }
                style={{ cursor: collapsed ? "default" : dragState.draggedItem ? "default" : "grab" }}
              >
                {/* Section title (editable, clickable to collapse) */}
                {section.title && !collapsed && (
                  <div className="px-2 pb-1">
                    {editingSectionId === section.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={handleFinishRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleFinishRename();
                          if (e.key === "Escape") {
                            setEditingSectionId(null);
                            setEditingTitle("");
                          }
                        }}
                        className="w-full text-[11px] font-semibold uppercase tracking-wide bg-transparent border-b border-indigo-400 outline-none text-neutral-700 dark:text-neutral-200"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleSectionCollapse(section.id)}
                        className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                      >
                        <span>{section.title}</span>
                        <span className="text-[10px] opacity-60 transition-transform" style={{ transform: collapsedSections.has(section.id) ? "rotate(-90deg)" : "rotate(0deg)" }}>
                          ▼
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* Section items (collapsible) */}
                <div
                  className="flex flex-col gap-0.5 overflow-hidden transition-all duration-200"
                  style={{
                    maxHeight: section.title && collapsedSections.has(section.id) ? "0px" : "500px",
                    opacity: section.title && collapsedSections.has(section.id) ? 0 : 1,
                  }}
                >
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    const itemIndex = flatNavItems.findIndex((fi) => fi.href === item.href);
                    const isFocused = itemIndex === focusedIndex;
                    const isDraggingItem = dragState.draggedItem === item.href;
                    const isDragOverThisItem = dragState.dragOverItem === item.href;
                    const baseClass = item.highlighted && !active ? "bg-indigo-50/70 dark:bg-indigo-950/70 " : "";

                    // Dynamic highlight from GuidanceContext
                    const highlight = guidance?.getHighlight(item.href);
                    const highlightClass = highlight && !active
                      ? `sidebar-highlight-${highlight.type} `
                      : "";

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        data-nav-item
                        tabIndex={0}
                        draggable={!collapsed}
                        onDragStart={(e) => itemDragHandlers.onDragStart(e, item.href)}
                        onDragOver={(e) => itemDragHandlers.onDragOverItem(e, item.href, section.id)}
                        onDrop={(e) => itemDragHandlers.onDropOnItem(e, item.href, section.id)}
                        onDragEnd={itemDragHandlers.onDragEnd}
                        onClick={(e) => handleNavClick(e, item.href)}
                        onFocus={() => setFocusedIndex(itemIndex)}
                        className={
                          baseClass +
                          highlightClass +
                          "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200 " +
                          (isDraggingItem ? "opacity-50 " : "") +
                          (isDragOverThisItem ? "border-t-2 border-indigo-500 " : "") +
                          (active
                            ? "bg-indigo-600 text-white font-semibold"
                            : isFocused
                              ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium"
                              : "text-neutral-900 dark:text-neutral-100 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800")
                        }
                        style={{ cursor: collapsed ? "default" : "grab" }}
                      >
                        {item.icon && (
                          <span className={"text-base " + (active ? "opacity-100" : "opacity-80")} aria-hidden>
                            {item.icon}
                          </span>
                        )}
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>

                {section.dividerAfter && <div className="my-3 border-t border-neutral-300 dark:border-neutral-700" />}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <div className="text-center text-[10px] text-neutral-400 dark:text-neutral-500">HumanFirst Studio</div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[140px] rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            onClick={() => {
              const section = visibleSections.find((s) => s.id === contextMenu.sectionId);
              handleStartRename(contextMenu.sectionId, section?.title || "");
            }}
            className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            ✏️ Rename Section
          </button>
          <button
            type="button"
            onClick={() => {
              hideSection(contextMenu.sectionId);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            👁️‍🗨️ Hide Section
          </button>
        </div>
      )}
    </div>
  );
}
