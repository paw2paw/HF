"use client";

import React from "react";
import { usePathname } from "next/navigation";

export default function SidebarNav({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  const links = [
    { href: "/cockpit", label: "Cockpit", icon: "🧭" },
    { href: "/parameters", label: "Parameters", icon: "🧩" },
    { href: "/ops", label: "Ops", icon: "🛠️" },
    { href: "/knowledge", label: "Knowledge", icon: "📚" },
    { href: "/prompt-preview", label: "Prompt Preview", icon: "📝" },
    { href: "/services", label: "Services", icon: "⚙️" },
    { href: "/sessions", label: "Sessions", icon: "🎧" },
    { href: "/import", label: "Import", icon: "⬆️" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: 12,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          marginBottom: 12,
        }}
      >
        {!collapsed && <div style={{ fontWeight: 700 }}>HF Admin</div>}
        <button
          onClick={onToggle}
          aria-label="Toggle sidebar"
          style={{
            border: "1px solid #ddd",
            background: "white",
            borderRadius: 6,
            padding: "4px 8px",
            cursor: "pointer",
          }}
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {links.map((l) => {
          const active = pathname === l.href || pathname?.startsWith(l.href + "/");

          return (
            <a
              key={l.href}
              href={l.href}
              title={collapsed ? l.label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 6,
                textDecoration: "none",
                color: active ? "#000" : "#333",
                background: active ? "#eef2ff" : "transparent",
                fontWeight: active ? 600 : 400,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 16 }}>{l.icon}</span>
              {!collapsed && <span>{l.label}</span>}
            </a>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: "auto",
          fontSize: 11,
          color: "#888",
          textAlign: "center",
        }}
      >
        {!collapsed && "HumanFirst Admin"}
      </div>
    </div>
  );
}