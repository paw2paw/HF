"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useGlobalAssistant } from "@/contexts/AssistantContext";
import { useGuidance } from "@/contexts/GuidanceContext";
import { useSidebarLayout } from "@/hooks/useSidebarLayout";
import { ICON_MAP } from "@/lib/sidebar/icons";
import type { NavSection } from "@/lib/sidebar/types";
import sidebarManifest from "@/lib/sidebar/sidebar-manifest.json";
import {
  MoreVertical,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  RotateCcw,
  Save,
  Eye,
  EyeOff,
  Trash2,
  PenLine,
  Bot,
  Home,
} from "lucide-react";

// ============================================================================
// Icon Helper
// ============================================================================

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

// ============================================================================
// Kebab Menu (appears on section header hover)
// ============================================================================

function SectionKebabMenu({
  sectionId,
  sectionTitle,
  visible,
  onRename,
  onHide,
  onDelete,
}: {
  sectionId: string;
  sectionTitle: string;
  visible: boolean;
  onRename: (id: string, title: string) => void;
  onHide: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const showButton = visible || open;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-2 rounded hover:bg-[var(--hover-bg)] transition-opacity"
        style={{ opacity: showButton ? 1 : 0 }}
        aria-label={`Options for ${sectionTitle}`}
      >
        <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] shadow-lg py-1">
          <button
            type="button"
            onClick={() => {
              onRename(sectionId, sectionTitle);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
          >
            <PenLine className="w-3.5 h-3.5" /> Rename
          </button>
          <button
            type="button"
            onClick={() => {
              onHide(sectionId);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5" /> Hide
          </button>
          <div className="my-1 border-t border-[var(--border-subtle)]" />
          <button
            type="button"
            onClick={() => {
              onDelete(sectionId);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Base Section Definitions (manifest is structural fallback; DB rules override visibility)
// ============================================================================

const MANIFEST_SECTIONS: NavSection[] = sidebarManifest as NavSection[];

// ============================================================================
// Component
// ============================================================================

export default function SimpleSidebarNav({
  collapsed: externalCollapsed,
  onToggle: externalOnToggle,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
} = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const userRole = session?.user?.role as string | undefined;
  const isAdmin = userRole === "ADMIN" || userRole === "SUPERADMIN";

  // ── DB-backed visibility rules (overrides manifest requiredRole/defaultHiddenFor) ──
  const [visibilityRules, setVisibilityRules] = useState<Record<
    string,
    { requiredRole: string | null; defaultHiddenFor: string[] }
  > | null>(null);

  useEffect(() => {
    // Only admins have access to this endpoint; for others, manifest defaults are fine
    if (!isAdmin) return;
    fetch("/api/admin/access-control/sidebar-visibility")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.rules?.sections) {
          setVisibilityRules(data.rules.sections);
        }
      })
      .catch(() => {}); // Fall back to manifest defaults silently
  }, [isAdmin]);

  const BASE_SECTIONS = useMemo(() => {
    if (!visibilityRules) return MANIFEST_SECTIONS;
    return MANIFEST_SECTIONS.map((section) => {
      const dbRule = visibilityRules[section.id];
      if (!dbRule) return section;
      return {
        ...section,
        requiredRole: dbRule.requiredRole ?? section.requiredRole,
        defaultHiddenFor: dbRule.defaultHiddenFor ?? section.defaultHiddenFor,
      };
    });
  }, [visibilityRules]);
  const assistant = useGlobalAssistant();
  const guidance = useGuidance();

  // Unread message count
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread count
  useEffect(() => {
    if (!userId) return;

    const fetchUnreadCount = async () => {
      try {
        const res = await fetch("/api/messages/unread-count");
        const data = await res.json();
        if (data.ok) {
          setUnreadCount(data.count || 0);
        }
      } catch {
        // Silent fail
      }
    };

    fetchUnreadCount();

    // Refetch every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  // Collapse state
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = externalCollapsed ?? internalCollapsed;
  const onToggle = externalOnToggle ?? (() => setInternalCollapsed((prev) => !prev));

  // Layout hook
  const {
    visibleSections,
    hiddenSectionIds,
    hasCustomLayout,
    hasPersonalDefault,
    isLoaded,
    dragState,
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
  } = useSidebarLayout({ userId, userRole, baseSections: BASE_SECTIONS, isAdmin });

  // UI state
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteToast, setDeleteToast] = useState<{
    sectionId: string;
    sectionTitle: string;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null);

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
  const editInputRef = useRef<HTMLInputElement>(null);

  // Close layout menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowLayoutMenu(false);
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
      // Call onNavigate for mobile overlay close
      onNavigate?.();
    },
    [pathname, router, onNavigate]
  );

  // Handle rename
  const handleStartRename = useCallback((sectionId: string, currentTitle: string) => {
    setEditingSectionId(sectionId);
    setEditingTitle(currentTitle || "");
  }, []);

  const handleFinishRename = useCallback(() => {
    if (editingSectionId) {
      renameSection(editingSectionId, editingTitle.trim());
      setEditingSectionId(null);
      setEditingTitle("");
    }
  }, [editingSectionId, editingTitle, renameSection]);

  // Handle delete with undo toast
  const handleDeleteSection = useCallback((sectionId: string) => {
    const section = visibleSections.find((s) => s.id === sectionId);
    const title = section?.title || sectionId;

    deleteSection(sectionId);

    // Clear any existing toast timeout
    if (deleteToast?.timeoutId) clearTimeout(deleteToast.timeoutId);

    const timeoutId = setTimeout(() => {
      setDeleteToast(null);
    }, 5000);

    setDeleteToast({ sectionId, sectionTitle: title, timeoutId });
  }, [visibleSections, deleteSection, deleteToast]);

  const handleUndoDelete = useCallback(() => {
    if (!deleteToast) return;
    clearTimeout(deleteToast.timeoutId);
    undoDeleteSection(deleteToast.sectionId);
    setDeleteToast(null);
  }, [deleteToast, undoDeleteSection]);

  // Handle set as default for all
  const handleSetAsDefault = useCallback(async () => {
    setSavingDefault(true);
    await setAsDefault();
    setSavingDefault(false);
    setShowLayoutMenu(false);
  }, [setAsDefault]);

  // Handle set as personal default
  const handleSavePersonalDefault = useCallback(async () => {
    setSavingPersonal(true);
    await setAsPersonalDefault();
    setSavingPersonal(false);
    setShowLayoutMenu(false);
  }, [setAsPersonalDefault]);

  // Handle reset
  const handleReset = useCallback(() => {
    resetLayout();
    setShowLayoutMenu(false);
  }, [resetLayout]);

  return (
    <div className="relative flex h-full flex-col p-2 overflow-hidden" style={{ color: "var(--text-primary)" }}>
      {/* Header */}
      {collapsed ? (
        <div className="mb-2 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="w-full h-5 flex items-center justify-center rounded hover:bg-[var(--hover-bg)] transition-colors mb-0.5"
          >
            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>
          <Link
            href="/x"
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--hover-bg)] transition-colors"
            title="Home"
          >
            <Home className="w-4 h-4 text-[var(--text-secondary)]" />
          </Link>
          <button
            type="button"
            onClick={assistant.toggle}
            title={assistant.isOpen ? "Hide AI Assistant" : "Show AI Assistant"}
            className={
              "w-8 h-8 flex items-center justify-center rounded-md transition-colors " +
              (assistant.isOpen
                ? "bg-[var(--surface-selected)] text-[var(--accent-primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--hover-bg)]")
            }
          >
            <Bot className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link
            href="/x"
            className="text-[13px] font-bold tracking-tight hover:text-[var(--accent-primary)] transition-colors"
          >
            HumanFirst
          </Link>

          <div className="flex items-center gap-0.5">
            {/* AI assistant toggle */}
            <button
              type="button"
              onClick={assistant.toggle}
              title={assistant.isOpen ? "Hide AI Assistant" : "Show AI Assistant"}
              className={
                "w-9 h-9 flex items-center justify-center rounded-md transition-colors " +
                (assistant.isOpen
                  ? "bg-[var(--surface-selected)] text-[var(--accent-primary)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--hover-bg)]")
              }
            >
              <Bot className="w-4.5 h-4.5" />
            </button>

            {/* Layout menu */}
            {isLoaded && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowLayoutMenu((prev) => !prev)}
                  title="Layout options"
                  className={
                    "relative w-9 h-9 flex items-center justify-center rounded-md transition-colors " +
                    (showLayoutMenu
                      ? "bg-[var(--surface-tertiary)] text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--hover-bg)]")
                  }
                >
                  <Settings className="w-4 h-4" />
                  {hasCustomLayout && !hasPersonalDefault && (
                    <span
                      className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--accent-primary)" }}
                    />
                  )}
                </button>
                {showLayoutMenu && (
                  <div className="absolute left-0 top-8 z-50 w-52 rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] shadow-lg py-1">
                    {/* Save as personal default */}
                    <button
                      type="button"
                      onClick={handleSavePersonalDefault}
                      disabled={savingPersonal}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] disabled:opacity-50 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingPersonal ? "Saving..." : "Set as Default for Me"}
                    </button>

                    {/* Set as default for all (admin only) */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleSetAsDefault}
                        disabled={savingDefault}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-[var(--accent-primary)] hover:bg-[var(--hover-bg)] disabled:opacity-50 transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingDefault ? "Saving..." : "Set as Default for All"}
                      </button>
                    )}

                    {/* Reset */}
                    {hasCustomLayout && (
                      <>
                        <div className="my-1 border-t border-[var(--border-subtle)]" />
                        <button
                          type="button"
                          onClick={handleReset}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reset to Default
                        </button>
                      </>
                    )}

                    {/* Show hidden sections (NOT deleted) */}
                    {hiddenSectionIds.length > 0 && (
                      <>
                        <div className="my-1 border-t border-[var(--border-subtle)]" />
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Hidden
                        </div>
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
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Show {section?.title || id}
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
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--hover-bg)] transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Scrollable nav area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sidebar-scroll">
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
                className={
                  "flex flex-col transition-all rounded-md " +
                  (isDraggingSection ? "opacity-50 " : "") +
                  (isDragOverForSection ? "border-t-2 border-[var(--accent-primary)] " : "") +
                  (isDragOverForItem ? "bg-[var(--surface-selected)] ring-2 ring-[var(--accent-primary)] ring-inset " : "")
                }
                style={{ cursor: collapsed ? "default" : dragState.draggedItem ? "default" : "grab" }}
              >
                {/* Section divider */}
                {section.title && !collapsed && (
                  <div className="mx-2 border-t border-[var(--border-subtle)]" />
                )}

                {/* Section title with kebab menu */}
                {section.title && !collapsed && (
                  <div
                    className="flex items-center justify-between px-2 pb-0.5 pt-1"
                    onMouseEnter={() => setHoveredSectionId(section.id)}
                    onMouseLeave={() => setHoveredSectionId(null)}
                  >
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
                        className="w-full text-[11px] font-medium tracking-wide bg-transparent border-b border-[var(--accent-primary)] outline-none"
                        style={{ color: "var(--text-secondary)" }}
                      />
                    ) : (
                      <div className="flex-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleSectionCollapse(section.id)}
                          className="flex-shrink-0 p-0 transition-colors"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <ChevronDown
                            className="w-3 h-3 transition-transform"
                            style={{
                              transform: collapsedSections.has(section.id) ? "rotate(-90deg)" : "rotate(0deg)",
                            }}
                          />
                        </button>
                        {section.href ? (
                          <Link
                            href={section.href}
                            className="group flex items-center text-[11px] font-medium tracking-wide transition-colors"
                            style={{
                              color: isActive(section.href) ? "var(--accent-primary)" : "var(--text-muted)",
                              textDecoration: "none",
                            }}
                          >
                            <span>{section.title}</span>
                            <span className="opacity-0 group-hover:opacity-60 transition-opacity text-[9px] ml-0.5">{"\u2192"}</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleSectionCollapse(section.id)}
                            className="text-[11px] font-medium tracking-wide transition-colors"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {section.title}
                          </button>
                        )}
                      </div>
                    )}

                    {editingSectionId !== section.id && (
                      <SectionKebabMenu
                        sectionId={section.id}
                        sectionTitle={section.title || section.id}
                        visible={hoveredSectionId === section.id}
                        onRename={handleStartRename}
                        onHide={hideSection}
                        onDelete={handleDeleteSection}
                      />
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

                    // Highlighted items (e.g. Pipeline)
                    const baseClass = item.highlighted && !active
                      ? "bg-[var(--surface-selected)] "
                      : "";

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
                          "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 " +
                          (isDraggingItem ? "opacity-50 " : "") +
                          (isDragOverThisItem ? "border-t-2 border-[var(--accent-primary)] " : "") +
                          (active
                            ? "bg-[var(--accent-primary)]/8 font-semibold"
                            : isFocused
                              ? "bg-[var(--hover-bg)] font-medium"
                              : "font-medium hover:bg-[var(--hover-bg)] hover:shadow-[inset_2px_0_0_var(--accent-primary)]")
                        }
                        style={{
                          cursor: collapsed ? "default" : "grab",
                          color: active ? "var(--accent-primary)" : "var(--text-primary)",
                        }}
                      >
                        {item.icon && (
                          <span className={
                            "flex items-center justify-center w-6 h-6 flex-shrink-0 rounded-md transition-colors " +
                            (active ? "bg-[var(--accent-primary)]/10" : "")
                          }>
                            <NavIcon
                              name={item.icon}
                              className={
                                "w-4 h-4 " +
                                (active ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]")
                              }
                            />
                          </span>
                        )}
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && item.href === "/x/messages" && unreadCount > 0 && (
                          <span
                            className="ml-auto inline-flex items-center justify-center rounded-full text-[10px] font-semibold text-white min-w-[18px] px-1.5 py-0.5"
                            style={{
                              background: active ? "var(--accent-primary)" : "var(--accent-primary)",
                              opacity: active ? 0.8 : 1,
                            }}
                          >
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto pt-2">
          <div className="text-center text-[10px]" style={{ color: "var(--text-muted)" }}>
            HumanFirst Studio
          </div>
        </div>
      </div>

      {/* Undo delete toast */}
      {deleteToast && (
        <div
          className="absolute bottom-3 left-2 right-2 z-50 flex items-center justify-between gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2 shadow-lg"
          style={{ color: "var(--text-secondary)" }}
        >
          <span className="text-xs">
            Deleted <strong>{deleteToast.sectionTitle}</strong>
          </span>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="text-xs font-semibold transition-colors"
            style={{ color: "var(--accent-primary)" }}
          >
            Undo
          </button>
        </div>
      )}

      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 4px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--text-muted) 30%, transparent); border-radius: 4px; }
        .sidebar-scroll:hover::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--text-muted) 50%, transparent); }
      `}</style>
    </div>
  );
}
