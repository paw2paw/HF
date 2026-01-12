"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
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

  const sections: NavSection[] = useMemo(
    () => [
      {
        id: "root",
        items: [{ href: "/cockpit", label: "Cockpit", icon: "🧭" }],
        collapsible: false,
      },
      {
        id: "agents",
        title: "Agents",
        items: [
          { href: "/agents", label: "Agents", icon: "🤖" },
          { href: "/prompt-preview", label: "Prompt Preview", icon: "📝" },
        ],
        collapsible: true,
        defaultCollapsed: false,
      },
      {
        id: "people",
        title: "People",
        items: [
          { href: "/people", label: "People", icon: "👤" },
          { href: "/people/segments", label: "Segments", icon: "🧩" },
          { href: "/people/identity", label: "Identity", icon: "🪪" },
        ],
        collapsible: true,
        defaultCollapsed: false,
      },
      {
        id: "sessions",
        title: "Sessions",
        items: [
          { href: "/sessions", label: "Sessions", icon: "🎧" },
          { href: "/sessions/analytics", label: "Analytics", icon: "📊" },
        ],
        collapsible: true,
        defaultCollapsed: false,
      },
      {
        id: "sources",
        title: "Sources",
        items: [
          { href: "/controls", label: "Controls", icon: "🧷" },
          { href: "/parameters", label: "Parameters", icon: "🗄️" },
          { href: "/transcripts", label: "Transcripts (Raw)", icon: "🗣️" },
          { href: "/audio", label: "Audio (Raw)", icon: "🎙️" },
          { href: "/knowledge", label: "Knowledge (Raw)", icon: "📚" },
          { href: "/integrations", label: "Integrations", icon: "🔌" },
        ],
        dividerAfter: true,
        collapsible: true,
        defaultCollapsed: false,
      },
      {
        id: "derived",
        title: "Derived",
        items: [
          { href: "/derived/control-sets", label: "Control Sets", icon: "📌" },
          { href: "/derived/transcript-imports", label: "Transcript Imports", icon: "📥" },
          { href: "/derived/transcript-analyses", label: "Transcript Analyses", icon: "🧠" },
          { href: "/derived/knowledge-artifacts", label: "Knowledge Artifacts", icon: "🧾" },
          { href: "/derived/vectors", label: "Vectors", icon: "🧬" },
          { href: "/derived/reports", label: "Reports", icon: "🗂️" },
        ],
        collapsible: true,
        defaultCollapsed: false,
      },
      {
        id: "models",
        title: "Models",
        items: [
          { href: "/models/traits", label: "Trait Library", icon: "📐" },
          { href: "/models/trait-targets", label: "Trait Targets", icon: "🎯" },
          { href: "/models/assemblies", label: "Model Assemblies", icon: "🧱" },
          { href: "/models/policies", label: "Policies (Reward/NBM)", icon: "🏁" },
          { href: "/models/prompt-templates", label: "Prompt Templates", icon: "🧬" },
          { href: "/models/experiments", label: "Experiments", icon: "🧪" },
        ],
        collapsible: true,
        defaultCollapsed: false,
      },
      {
        id: "admin",
        title: "Ops & Admin",
        items: [
          { href: "/ops", label: "Ops", icon: "🛠️" },
          { href: "/history", label: "History", icon: "🕘" },
          { href: "/services", label: "Services", icon: "⚙️" },
          { href: "/config", label: "Runtime Config", icon: "🔧" },
          { href: "/access", label: "Access / Roles", icon: "🔒" },
          { href: "/audit", label: "Audit Log", icon: "🧾" },
          { href: "/settings", label: "System Settings", icon: "🧰" },
        ],
        collapsible: true,
        defaultCollapsed: false,
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
    if (!pathname) return false;
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
                  <div className="flex flex-col gap-1">
                    {section.items.map((l) => {
                      const active = isActive(l.href);
                      return (
                        <Link
                          key={l.href}
                          href={l.href}
                          title={collapsed ? l.label : undefined}
                          className={
                            "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200 " +
                            (active
                              ? "bg-indigo-600 text-white font-semibold"
                              : "text-neutral-900 hover:bg-neutral-100")
                          }
                        >
                          <span className={"text-base " + (active ? "opacity-100" : "opacity-90")} aria-hidden>
                            {l.icon}
                          </span>
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