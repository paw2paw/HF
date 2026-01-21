"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sections: NavSection[] = useMemo(
    () => [
      // Primary tools - no header
      {
        id: "primary",
        items: [
          { href: "/flow", label: "Flow", icon: "🔀", working: true },
          { href: "/cockpit", label: "Cockpit", icon: "🧭", working: true },
          { href: "/ops", label: "Ops", icon: "🛠️", working: true },
        ],
        collapsible: false,
        dividerAfter: true,
      },
      // Sources section
      {
        id: "sources",
        title: "Sources",
        items: [
          { href: "/knowledge-docs", label: "Knowledge Docs", icon: "📚", working: true },
          { href: "/transcript-batches", label: "Transcripts", icon: "🎙️", working: true },
        ],
        collapsible: true,
        defaultCollapsed: false,
      },
      // Derived section (processed from sources)
      {
        id: "derived",
        title: "Derived",
        items: [
          { href: "/chunks", label: "Chunks", icon: "📄", working: true },
          { href: "/vectors", label: "Embeddings", icon: "🧠", working: true },
          { href: "/knowledge-artifacts", label: "Artifacts", icon: "💎", working: true },
          { href: "/callers", label: "Callers", icon: "👥", working: true },
          { href: "/calls", label: "Calls", icon: "📞", working: true },
        ],
        collapsible: true,
        defaultCollapsed: false,
      },
      // Analysis section
      {
        id: "analysis",
        title: "Analysis",
        items: [
          { href: "/admin#/parameters", label: "Parameters", icon: "⚙️", working: true },
          { href: "/analysis-specs", label: "Analysis Specs", icon: "🎯", working: true },
          { href: "/run-configs", label: "Run Configs", icon: "📦", working: true },
          { href: "/analysis-profiles", label: "Profiles", icon: "📊", working: true },
          { href: "/analysis-runs", label: "Runs", indent: true, working: true },
          { href: "/analysis-test", label: "Test", icon: "🧪", working: true },
        ],
        collapsible: true,
        defaultCollapsed: false,
      },
      // Prompts section
      {
        id: "prompts",
        title: "Prompts",
        items: [
          { href: "/prompt-blocks", label: "Static Prompts", icon: "🧱", working: true },
          { href: "/prompt-slugs", label: "Dynamic Prompts", icon: "🔀", working: true },
          { href: "/prompt-stacks", label: "Stacks", icon: "📚", working: true },
          { href: "/prompt-preview", label: "Preview", icon: "👁️", working: true },
          { href: "/prompt-generate", label: "Generate", icon: "✨", working: true },
        ],
        collapsible: true,
        defaultCollapsed: false,
      },
      // Config section
      {
        id: "config",
        title: "Config",
        items: [
          { href: "/agents", label: "Agents", icon: "🤖", working: true },
          { href: "/prompt-templates", label: "Templates", icon: "📝", working: true },
          { href: "/control-sets", label: "Control Sets", icon: "📌", working: true },
          { href: "/settings-library", label: "Settings", icon: "⚙️", working: true },
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

  return (
    <div className="flex h-full flex-col bg-white p-3 text-neutral-900 overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-2">
        {!collapsed ? (
          <div className="text-sm font-extrabold tracking-tight text-neutral-900">HF Admin</div>
        ) : (
          <div className="w-6" />
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-label="Toggle sidebar"
          className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Scrollable nav area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
        <nav className="flex flex-col gap-3">
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
                      "flex items-center justify-between gap-2 rounded-md px-2 pb-1 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-600 " +
                      (canCollapse ? "hover:bg-neutral-50" : "")
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
                      <span className="text-[12px] leading-none text-neutral-500" aria-hidden>
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
                      return (
                        <Link
                          key={l.href}
                          href={l.href}
                          title={collapsed ? l.label : undefined}
                          className={
                            "flex items-center gap-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200 " +
                            (isSubItem
                              ? "pl-7 pr-2 py-1.5 text-[13px] "
                              : "px-2 py-2 text-sm ") +
                            (active
                              ? "bg-indigo-600 text-white font-semibold"
                              : isSubItem
                              ? "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                              : l.working
                              ? "text-neutral-900 font-medium hover:bg-neutral-100"
                              : "text-neutral-900 hover:bg-neutral-100")
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

                {section.dividerAfter ? <div className="my-3 border-t border-neutral-300" /> : null}
              </div>
            );
          })}
        </nav>

        <div className="mt-3">
          {!collapsed ? <div className="text-center text-[11px] text-neutral-600">HumanFirst Admin</div> : null}
        </div>
      </div>
    </div>
  );
}
