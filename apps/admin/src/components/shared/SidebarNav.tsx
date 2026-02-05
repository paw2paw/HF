"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useChatContext } from "@/contexts/ChatContext";

type NavItem = {
  href: string;
  label: string;
  icon?: string;
  working?: boolean;
  indent?: boolean; // For sub-items
};

type NavSection = {
  id: string;
  title?: string;
  items: NavItem[];
  dividerAfter?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

export default function SidebarNav({
  collapsed: externalCollapsed,
  onToggle: externalOnToggle,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
} = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const navRef = useRef<HTMLElement>(null);

  // Use external state if provided, otherwise use internal state
  const collapsed = externalCollapsed ?? internalCollapsed;
  const onToggle = externalOnToggle ?? (() => setInternalCollapsed(prev => !prev));

  useEffect(() => {
    setMounted(true);
  }, []);

  const sections: NavSection[] = useMemo(
    () => [
      // ============================================================
      // AI ASSISTANT: Top priority - always visible
      // ============================================================
      {
        id: "ai-chat",
        items: [], // ChatToggleButton is rendered separately
        collapsible: false,
        dividerAfter: true,
      },

      // ============================================================
      // DATA: View callers and calls (results of analysis)
      // ============================================================
      {
        id: "data",
        title: "Data",
        items: [
          { href: "/callers", label: "Callers", icon: "👥", working: true },
          { href: "/calls", label: "Calls", icon: "📞", working: true },
        ],
        collapsible: true,
        defaultCollapsed: false,
      },

      // ============================================================
      // PLAYBOOKS: Domain segmentation and playbook management
      // ============================================================
      {
        id: "playbooks",
        title: "Playbooks",
        items: [
          { href: "/domains", label: "Domains", icon: "🌐", working: true },
          { href: "/playbooks", label: "Playbooks", icon: "📚", working: true },
          { href: "/x/supervisor", label: "Supervisor", icon: "👁️", working: true },
          { href: "/analysis-specs?scope=DOMAIN&locked=1", label: "Domain Specs", icon: "🏢", working: true },
          { href: "/analysis-specs?scope=SYSTEM&locked=1", label: "System Specs", icon: "🛡️", working: true },
          { href: "/prompt-templates", label: "Prompt Templates", icon: "📝", working: true },
          { href: "/data-dictionary", label: "Data Dictionary", icon: "📖", working: true },
        ],
        collapsible: true,
        defaultCollapsed: false,
      },

      // ============================================================
      // LAB: Experimental BDD-first spec development
      // ============================================================
      {
        id: "lab",
        title: "Lab",
        items: [
          { href: "/lab", label: "BDD Lab", icon: "🧪", working: true },
          { href: "/lab/upload", label: "Upload Specs", icon: "📤", working: true },
          { href: "/lab/features", label: "Feature Sets", icon: "📦", working: true },
        ],
        collapsible: true,
        defaultCollapsed: false,
        dividerAfter: true,
      },

      // ============================================================
      // SOURCES: Raw input data that feeds the pipeline
      // ============================================================
      {
        id: "sources",
        title: "Sources",
        items: [
          { href: "/knowledge-docs", label: "Knowledge Docs", icon: "📚", working: true },
          { href: "/transcripts", label: "Transcripts", icon: "🎙️", working: true },
        ],
        collapsible: true,
        defaultCollapsed: false,
      },

      // ============================================================
      // ANALYSIS CONFIG: Configure how analysis runs
      // ============================================================
      {
        id: "analysis-config",
        title: "Analysis Config",
        items: [
          { href: "/analysis-profiles", label: "Profiles", icon: "📊", working: true },
          { href: "/analysis-runs", label: "Run History", icon: "▶️", working: true },
          { href: "/analysis-test", label: "Test Lab", icon: "🧪", working: true },
        ],
        collapsible: true,
        defaultCollapsed: true,
      },

      // ============================================================
      // SETUP: Define what to measure and how to adapt
      // ============================================================
      {
        id: "setup",
        title: "Setup",
        items: [
          { href: "/admin", label: "Parameters", icon: "📐", working: true },
          { href: "/analysis-specs", label: "All Specs", icon: "🎯", working: true },
          { href: "/prompt-slugs", label: "Prompt Slugs", icon: "🔀", working: true },
          { href: "/prompt-blocks", label: "Prompt Blocks", icon: "🧱", working: true },
          { href: "/memories", label: "Memory Config", icon: "🧠", working: true },
        ],
        collapsible: true,
        defaultCollapsed: true,
      },

      // ============================================================
      // PROCESSING: Derived data from sources
      // ============================================================
      {
        id: "processing",
        title: "Processing",
        items: [
          { href: "/chunks", label: "Chunks", icon: "📄", working: true },
          { href: "/vectors", label: "Vectors", icon: "🔢", working: true },
          { href: "/knowledge-artifacts", label: "Artifacts", icon: "💎", working: true },
        ],
        collapsible: true,
        defaultCollapsed: true,
      },

      // ============================================================
      // CONFIG: System configuration
      // ============================================================
      {
        id: "config",
        title: "Config",
        items: [
          { href: "/run-configs", label: "Run Configs", icon: "📦", working: true },
          { href: "/behavior-targets", label: "Behavior Targets", icon: "🎯", working: true },
          { href: "/settings-library", label: "Settings", icon: "⚙️", working: true },
        ],
        collapsible: true,
        defaultCollapsed: true,
        dividerAfter: true,
      },

      // ============================================================
      // ANALYZE & OPERATIONS: Moved to bottom
      // ============================================================
      {
        id: "analyze",
        title: "Analyze",
        items: [
          { href: "/analyze", label: "Analyze", icon: "🔬", working: true },
          { href: "/prompts", label: "Prompts", icon: "📝", working: true },
        ],
        collapsible: true,
        defaultCollapsed: true,
      },

      {
        id: "operations",
        title: "Operations",
        items: [
          { href: "/cockpit", label: "Cockpit", icon: "🧭", working: true },
          { href: "/flow", label: "Flow", icon: "🔀", working: true },
          { href: "/ops", label: "Ops", icon: "🛠️", working: true },
          { href: "/guide", label: "Guide", icon: "📖", working: true },
        ],
        collapsible: true,
        defaultCollapsed: true,
      },
    ],
    []
  );

  // section collapsed state (independent from global sidebar collapse)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const s of sections) {
      if (s.collapsible) initial[s.id] = !!s.defaultCollapsed;
    }
    return initial;
  });

  const isActive = (href: string) => {
    if (!mounted || !pathname) return false;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Flatten all visible nav items for keyboard navigation
  const flatNavItems = useMemo(() => {
    const items: { href: string; label: string }[] = [];
    for (const section of sections) {
      const sectionIsCollapsed = section.collapsible && section.title ? !!collapsedSections[section.id] : false;
      if (!sectionIsCollapsed) {
        for (const item of section.items) {
          items.push({ href: item.href, label: item.label });
        }
      }
    }
    return items;
  }, [sections, collapsedSections]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (flatNavItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1) % flatNavItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex(prev => (prev - 1 + flatNavItems.length) % flatNavItems.length);
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      const item = flatNavItems[focusedIndex];
      if (item) {
        router.push(item.href);
      }
    }
  }, [flatNavItems, focusedIndex, router]);

  // Focus the link when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0 && navRef.current) {
      const links = navRef.current.querySelectorAll('a[data-nav-item]');
      const link = links[focusedIndex] as HTMLElement;
      if (link) {
        link.focus();
      }
    }
  }, [focusedIndex]);

  // Handle navigation for links with query params on same route
  // Next.js useSearchParams should automatically react to URL changes,
  // but we use replace to ensure the URL updates cleanly
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const [targetPath] = href.split('?');
    const currentPath = pathname;

    // If navigating to same path but different query params, use router.replace
    // This ensures clean URL update without adding to history stack
    if (targetPath === currentPath) {
      e.preventDefault();
      router.replace(href);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-900 p-3 text-neutral-900 dark:text-neutral-100 overflow-hidden">
      <div className="mb-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Toggle sidebar"
          className="inline-flex items-center justify-center rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-sm text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Scrollable nav area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
        <nav
          ref={navRef}
          className="flex flex-col gap-3"
          onKeyDown={handleKeyDown}
          role="navigation"
          aria-label="Main navigation"
        >
          {sections.map((section) => {
            const canCollapse = !!section.collapsible && !!section.title;
            const sectionIsCollapsed = canCollapse ? !!collapsedSections[section.id] : false;

            return (
              <div key={section.id} className="flex flex-col">
                {section.title && !collapsed ? (
                  <button
                    type="button"
                    onClick={() => (canCollapse ? toggleSection(section.id) : undefined)}
                    className={
                      "flex items-center justify-between gap-2 rounded-md px-2 pb-1 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 " +
                      (canCollapse ? "hover:bg-neutral-50 dark:hover:bg-neutral-800" : "")
                    }
                    aria-label={
                      canCollapse
                        ? sectionIsCollapsed
                          ? `Expand ${section.title}`
                          : `Collapse ${section.title}`
                        : section.title
                    }
                    disabled={!canCollapse}
                  >
                    <span>{section.title}</span>
                    {canCollapse ? (
                      <span className="text-[12px] leading-none text-neutral-500 dark:text-neutral-400" aria-hidden>
                        {sectionIsCollapsed ? "▸" : "▾"}
                      </span>
                    ) : null}
                  </button>
                ) : null}

                {sectionIsCollapsed ? null : (
                  <div className="flex flex-col gap-0.5">
                    {section.items.map((l) => {
                      const active = isActive(l.href);
                      const isSubItem = l.indent && !l.icon;
                      const itemIndex = flatNavItems.findIndex(fi => fi.href === l.href);
                      const isFocused = itemIndex === focusedIndex;
                      return (
                        <Link
                          key={l.href}
                          href={l.href}
                          title={collapsed ? l.label : undefined}
                          data-nav-item
                          tabIndex={0}
                          onClick={(e) => handleNavClick(e, l.href)}
                          onFocus={() => setFocusedIndex(itemIndex)}
                          className={
                            "flex items-center gap-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200 " +
                            (isSubItem
                              ? "pl-7 pr-2 py-1.5 text-[13px] "
                              : "px-2 py-2 text-sm ") +
                            (active
                              ? "bg-indigo-600 text-white font-semibold"
                              : isFocused
                              ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium"
                              : isSubItem
                              ? "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100"
                              : l.working
                              ? "text-neutral-900 dark:text-neutral-100 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                              : "text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800")
                          }
                        >
                          {l.icon && (
                            <span className={"text-base " + (active ? "opacity-100" : "opacity-80")} aria-hidden>
                              {l.icon}
                            </span>
                          )}
                          {!collapsed ? <span className="truncate">{l.label}</span> : null}
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* AI Chat at top */}
                {section.id === "ai-chat" && (
                  <div className="mb-1">
                    <ChatToggleButton collapsed={collapsed} />
                  </div>
                )}

                {section.dividerAfter ? <div className="my-3 border-t border-neutral-300 dark:border-neutral-700" /> : null}
              </div>
            );
          })}
        </nav>

        <div className="mt-3">
          {!collapsed ? <div className="text-center text-[11px] text-neutral-600 dark:text-neutral-400">HumanFirst Admin</div> : null}
        </div>
      </div>
    </div>
  );
}

function ChatToggleButton({ collapsed }: { collapsed: boolean }) {
  const { togglePanel, isOpen } = useChatContext();

  return (
    <div>
      <button
        type="button"
        onClick={togglePanel}
        className={
          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors " +
          (isOpen
            ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-medium"
            : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800")
        }
        title={collapsed ? "AI Chat (Cmd+K)" : undefined}
      >
        <span className="text-base" aria-hidden>
          💬
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">AI Chat</span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
              ⌘K
            </span>
          </>
        )}
      </button>
    </div>
  );
}
