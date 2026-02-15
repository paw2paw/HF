"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useGlobalAssistant } from "@/contexts/AssistantContext";
import { useGuidance } from "@/contexts/GuidanceContext";
import { useMasquerade } from "@/contexts/MasqueradeContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useSidebarLayout } from "@/hooks/useSidebarLayout";
import { ICON_MAP } from "@/lib/sidebar/icons";
import type { NavSection } from "@/lib/sidebar/types";
import sidebarManifest from "@/lib/sidebar/sidebar-manifest.json";
import {
  MoreVertical,
  ChevronDown,
  PanelLeft,
  EyeOff,
  Trash2,
  PenLine,
  Bot,
  Home,
  VenetianMask,
  PlayCircle,
} from "lucide-react";
import { MasqueradeUserPicker } from "@/components/shared/MasqueradeUserPicker";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { AccountPanel } from "@/components/shared/AccountPanel";

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
  const realRole = session?.user?.role as string | undefined;
  const realIsAdmin = realRole === "ADMIN" || realRole === "SUPERADMIN";

  // Branding: institution name + logo
  const { branding } = useBranding();

  // Masquerade: override sidebar role filtering to match masqueraded user
  const { isMasquerading, effectiveRole } = useMasquerade();
  const userRole = isMasquerading ? effectiveRole : realRole;
  const isAdmin = realIsAdmin; // Keep admin features (layout save, masquerade trigger) based on real role

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
  const [showMasqueradePicker, setShowMasqueradePicker] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteToast, setDeleteToast] = useState<{
    sectionId: string;
    sectionTitle: string;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null);

  // Auto-close account panel on navigation
  useEffect(() => {
    setShowAccountPanel(false);
  }, [pathname]);

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
  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus edit input when editing
  useEffect(() => {
    if (editingSectionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSectionId]);

  // Flatten items for keyboard navigation (with role variants resolved)
  const flatNavItems = useMemo(() => {
    const items: { href: string; label: string }[] = [];
    for (const section of visibleSections) {
      for (const item of section.items) {
        const variant = item.roleVariants?.[userRole || ""] ?? {};
        items.push({
          href: variant.href ?? item.href,
          label: variant.label ?? item.label,
        });
      }
    }
    return items;
  }, [visibleSections, userRole]);

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

  // Handle account panel toggle
  const handleAvatarClick = useCallback(() => {
    if (showAccountPanel) {
      setShowAccountPanel(false);
      return;
    }
    if (collapsed && onToggle) {
      onToggle();
    }
    setShowAccountPanel(true);
  }, [collapsed, onToggle, showAccountPanel]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ color: "var(--text-primary)", zIndex: 50 }}>
      {/* Sliding container for nav ↔ account panel */}
      <div
        style={{
          display: "flex",
          width: "200%",
          flex: 1,
          minHeight: 0,
          transform: showAccountPanel ? "translateX(0)" : "translateX(-50%)",
          transition: "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Left: Account panel (hidden by default, slides in from left) */}
        <div style={{ width: "50%", flexShrink: 0, height: "100%", overflow: "hidden" }}>
          <AccountPanel
            onClose={() => setShowAccountPanel(false)}
            onNavigate={onNavigate}
            unreadCount={unreadCount}
            layoutOptions={{
              isAdmin,
              hasCustomLayout,
              hiddenSections: hiddenSectionIds.map((id) => ({
                id,
                title: BASE_SECTIONS.find((s) => s.id === id)?.title || id,
              })),
              onSavePersonalDefault: setAsPersonalDefault,
              onSaveGlobalDefault: setAsDefault,
              onResetLayout: resetLayout,
              onShowSection: showSection,
            }}
          />
        </div>

        {/* Right: Navigation panel */}
        <div className="flex h-full flex-col p-2" style={{ width: "50%", flexShrink: 0 }}>
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
            <PanelLeft className="w-3.5 h-3.5 text-[var(--text-muted)]" />
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
          {branding.logoUrl ? (
            <Link href="/x" className="flex items-center">
              <img src={branding.logoUrl} alt={branding.name} style={{ height: 22 }} />
            </Link>
          ) : (
            <Link
              href="/x"
              className="text-[13px] font-bold tracking-tight hover:text-[var(--accent-primary)] transition-colors"
            >
              {branding.name}
            </Link>
          )}

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

            {/* Collapse toggle */}
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--hover-bg)] transition-colors"
            >
              <PanelLeft className="w-3.5 h-3.5" />
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
                {/* Section divider — slightly more breathing room */}
                {section.title && !collapsed && (
                  <div className="mx-2 mt-1 border-t" style={{ borderColor: "var(--border-subtle)" }} />
                )}

                {/* Section title with kebab menu */}
                {section.title && !collapsed && (
                  <div
                    className="flex items-center justify-between px-2 pb-0.5 pt-2"
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
                        className="w-full text-[10px] font-semibold tracking-widest uppercase bg-transparent border-b border-[var(--accent-primary)] outline-none"
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
                            className="group flex items-center text-[10px] font-semibold tracking-widest uppercase transition-colors"
                            style={{
                              color: isActive(section.href) ? "var(--accent-primary)" : "var(--text-muted)",
                              textDecoration: "none",
                            }}
                          >
                            <span>{section.title}</span>
                            <span className="opacity-0 group-hover:opacity-60 transition-opacity text-[9px] ml-1">{"\u203A"}</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleSectionCollapse(section.id)}
                            className="text-[10px] font-semibold tracking-widest uppercase transition-colors"
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
                  {section.items.map((rawItem) => {
                    // Resolve role-specific overrides
                    const variant = rawItem.roleVariants?.[userRole || ""] ?? {};
                    const item = {
                      ...rawItem,
                      label: variant.label ?? rawItem.label,
                      href: variant.href ?? rawItem.href,
                      icon: variant.icon ?? rawItem.icon,
                    };
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
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 " +
                          (isDraggingItem ? "opacity-50 " : "") +
                          (isDragOverThisItem ? "border-t-2 border-[var(--accent-primary)] " : "") +
                          (active
                            ? "font-semibold"
                            : isFocused
                              ? "bg-[var(--hover-bg)] font-medium"
                              : "font-medium hover:bg-[var(--hover-bg)]")
                        }
                        style={{
                          cursor: collapsed ? "default" : "grab",
                          color: active ? "var(--accent-primary)" : "var(--text-primary)",
                          background: active ? "color-mix(in srgb, var(--accent-primary) 8%, transparent)" : undefined,
                        }}
                      >
                        {item.icon && (
                          <span className="flex items-center justify-center w-6 h-6 flex-shrink-0 rounded-md transition-colors">
                            <NavIcon
                              name={item.icon}
                              className={
                                "w-[16px] h-[16px] " +
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

        <div className="mt-auto pt-2" style={{ position: "relative" }}>
          {/* Demos link — pinned above avatar */}
          <Link
            href="/x/demos"
            onClick={(e) => handleNavClick(e, "/x/demos")}
            title={collapsed ? "Demos" : undefined}
            className={
              "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors mb-0.5 " +
              (isActive("/x/demos")
                ? "font-semibold"
                : "hover:bg-[var(--hover-bg)]")
            }
            style={{
              color: isActive("/x/demos") ? "var(--accent-primary)" : "var(--text-muted)",
              background: isActive("/x/demos") ? "color-mix(in srgb, var(--accent-primary) 8%, transparent)" : undefined,
            }}
          >
            <span className="flex items-center justify-center w-6 h-6 flex-shrink-0">
              <PlayCircle size={16} />
            </span>
            {!collapsed && "Demos"}
          </Link>

          {/* Masquerade user picker popover */}
          {showMasqueradePicker && (
            <MasqueradeUserPicker onClose={() => setShowMasqueradePicker(false)} />
          )}

          {/* Masquerade trigger — only for real ADMIN+ */}
          {realIsAdmin && (
            <button
              onClick={() => setShowMasqueradePicker((v) => !v)}
              className="w-full flex items-center justify-center gap-1.5 rounded px-2 py-1.5 mb-1 transition-colors"
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: isMasquerading ? "#7c3aed" : "var(--text-muted)",
                background: isMasquerading ? "rgba(124,58,237,0.08)" : "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isMasquerading) e.currentTarget.style.background = "var(--hover-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isMasquerading ? "rgba(124,58,237,0.08)" : "transparent";
              }}
              title={isMasquerading ? "Change or exit step-in" : "Step in as another user"}
            >
              {collapsed ? (
                <VenetianMask size={16} />
              ) : (
                <>
                  <VenetianMask size={12} />
                  {isMasquerading ? "Stepped In" : "Step In"}
                </>
              )}
            </button>
          )}

          {/* Account avatar trigger */}
          <button
            onClick={handleAvatarClick}
            className="relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--hover-bg)]"
            title="Account"
            style={{ border: "none", background: "transparent", cursor: "pointer" }}
          >
            <div className="relative flex-shrink-0">
              <UserAvatar
                name={session?.user?.name || session?.user?.email || "?"}
                role={session?.user?.role}
                size={collapsed ? 28 : 24}
              />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    background: "var(--accent-primary)",
                    borderColor: "var(--surface-primary)",
                  }}
                />
              )}
            </div>
            {!collapsed && (
              <span
                className="truncate text-[11px] font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {(session?.user as any)?.displayName || session?.user?.name || session?.user?.email}
              </span>
            )}
          </button>
        </div>
        </div>
        </div>
        {/* End: Navigation panel */}
      </div>
      {/* End: Sliding container */}

      {/* Backdrop: click anywhere on main content to close account panel */}
      {showAccountPanel && (
        <div
          onClick={() => setShowAccountPanel(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            cursor: "default",
          }}
        />
      )}

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
