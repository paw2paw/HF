"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useChatContext } from "@/contexts/ChatContext";

type NavItem = {
  href: string;
  label: string;
  icon?: string;
  highlighted?: boolean; // Show with light background stripe
};

type NavSection = {
  id: string;
  title?: string;
  items: NavItem[];
  dividerAfter?: boolean;
};

export default function SimpleSidebarNav({
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

  const collapsed = externalCollapsed ?? internalCollapsed;
  const onToggle = externalOnToggle ?? (() => setInternalCollapsed(prev => !prev));

  useEffect(() => {
    setMounted(true);
  }, []);

  const sections: NavSection[] = useMemo(
    () => [
      // ============================================================
      // PROMPTS
      // ============================================================
      {
        id: "prompts",
        title: "Prompts",
        items: [
          { href: "/x/playground?mode=caller", label: "Prompt Tuner", icon: "🧪" },
        ],
        dividerAfter: false,
      },

      // ============================================================
      // PLAYBOOKS
      // ============================================================
      {
        id: "playbook-tools",
        title: "Playbooks",
        items: [
          { href: "/x/playground?mode=compare", label: "Compare Playbooks", icon: "📖📖" },
          { href: "/x/playground?mode=playbook", label: "Validate Playbook", icon: "✅" },
        ],
        dividerAfter: false,
      },

      // ============================================================
      // HISTORY
      // ============================================================
      {
        id: "history",
        title: "History",
        items: [
          { href: "/x/pipeline", label: "Run History", icon: "📜" },
        ],
        dividerAfter: true,
      },

      // ============================================================
      // DATA
      // ============================================================
      {
        id: "data",
        title: "Data",
        items: [
          { href: "/x/callers", label: "Callers", icon: "👥" },
          { href: "/x/goals", label: "Goals", icon: "🎯" },
          { href: "/x/import", label: "Import", icon: "📥" },
          { href: "/x/data-management", label: "Seed Data", icon: "🌱" },
        ],
        dividerAfter: true,
      },

      // ============================================================
      // CONFIGURATION
      // ============================================================
      {
        id: "config",
        title: "Configure",
        items: [
          { href: "/x/domains", label: "Domains", icon: "🌐" },
          { href: "/x/playbooks", label: "Playbooks", icon: "📚" },
          { href: "/x/specs", label: "Specs", icon: "📐" },
          { href: "/x/taxonomy", label: "Taxonomy", icon: "📊" },
        ],
        dividerAfter: true,
      },

      // ============================================================
      // OPERATIONS
      // ============================================================
      {
        id: "operations",
        title: "Operations",
        items: [
          { href: "/x/metering", label: "Metering", icon: "📊" },
          { href: "/x/ai-config", label: "AI Config", icon: "🤖" },
        ],
        dividerAfter: true,
      },

      // ============================================================
      // SUPERVISOR (Bottom)
      // ============================================================
      {
        id: "supervisor",
        items: [
          { href: "/x/supervisor", label: "Supervisor", icon: "👁️", highlighted: true },
        ],
        dividerAfter: false,
      },
    ],
    []
  );

  const isActive = (href: string) => {
    if (!mounted || !pathname) return false;
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Flatten all nav items for keyboard navigation
  const flatNavItems = useMemo(() => {
    const items: { href: string; label: string }[] = [];
    for (const section of sections) {
      for (const item of section.items) {
        items.push({ href: item.href, label: item.label });
      }
    }
    return items;
  }, [sections]);

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

  useEffect(() => {
    if (focusedIndex >= 0 && navRef.current) {
      const links = navRef.current.querySelectorAll('a[data-nav-item]');
      const link = links[focusedIndex] as HTMLElement;
      if (link) {
        link.focus();
      }
    }
  }, [focusedIndex]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const [targetPath] = href.split('?');
    const currentPath = pathname;
    if (targetPath === currentPath) {
      e.preventDefault();
      router.replace(href);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-900 p-3 text-neutral-900 dark:text-neutral-100 overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-2">
        {!collapsed ? (
          <div className="text-sm font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">HumanFirst</div>
        ) : (
          <div className="w-6" />
        )}

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
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col">
              {section.title && !collapsed ? (
                <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {section.title}
                </div>
              ) : null}

              <div className="flex flex-col gap-0.5">
                {section.items.map((l) => {
                  const active = isActive(l.href);
                  const itemIndex = flatNavItems.findIndex(fi => fi.href === l.href);
                  const isFocused = itemIndex === focusedIndex;
                  const baseClass = l.highlighted && !active ? "bg-indigo-50/70 dark:bg-indigo-950/70 " : "";
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
                        baseClass +
                        "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200 " +
                        (active
                          ? "bg-indigo-600 text-white font-semibold"
                          : isFocused
                          ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium"
                          : "text-neutral-900 dark:text-neutral-100 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800")
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

              {section.dividerAfter ? <div className="my-3 border-t border-neutral-300 dark:border-neutral-700" /> : null}
            </div>
          ))}
        </nav>

        {/* Chat Toggle Button */}
        <ChatToggleButton collapsed={collapsed} />

        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
          {!collapsed ? (
            <>
              <Link
                href="/cockpit"
                className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 rounded transition-colors"
              >
                <span>⚙️</span>
                <span>Full Admin →</span>
              </Link>
              <div className="text-center text-[10px] text-neutral-400 dark:text-neutral-500 mt-2">HumanFirst Studio</div>
            </>
          ) : (
            <Link
              href="/cockpit"
              title="Full Admin"
              className="flex items-center justify-center py-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              <span>⚙️</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatToggleButton({ collapsed }: { collapsed: boolean }) {
  const { togglePanel, isOpen, chatLayout, setChatLayout } = useChatContext();

  const layoutLabels: Record<string, string> = {
    vertical: "│",
    horizontal: "─",
    popout: "⧉",
  };

  const nextLayout = (current: string) => {
    const layouts = ["vertical", "horizontal", "popout"];
    const idx = layouts.indexOf(current);
    return layouts[(idx + 1) % layouts.length];
  };

  return (
    <div className="mt-auto pt-3 border-t border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={togglePanel}
          className={
            "flex flex-1 items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors " +
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
        {!collapsed && (
          <button
            type="button"
            onClick={() => setChatLayout(nextLayout(chatLayout) as any)}
            className="px-2 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md"
            title={`Layout: ${chatLayout} (click to change)`}
          >
            {layoutLabels[chatLayout]}
          </button>
        )}
      </div>
    </div>
  );
}
