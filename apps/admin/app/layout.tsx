"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import SidebarNav from "@/src/components/shared/SidebarNav";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  // persist sidebar state
  useEffect(() => {
    const v = window.localStorage.getItem("hf.sidebar.collapsed");
    if (v === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("hf.sidebar.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Arial",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: collapsed ? "56px 1fr" : "260px 1fr",
            height: "100vh",
            transition: "grid-template-columns 160ms ease",
          }}
        >
          <aside
            style={{
              borderRight: "1px solid #e5e5e5",
              overflow: "hidden",
            }}
          >
            <SidebarNav collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
          </aside>

          <main
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              height: "100vh",
            }}
          >
            <div
              style={{
                borderBottom: "1px solid #e5e5e5",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                background: "white",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Link href="/ops" style={{ fontSize: 13, fontWeight: 800, color: "#111", textDecoration: "none" }}>
                  Ops
                </Link>
                <Link
                  href="/knowledge"
                  style={{ fontSize: 13, fontWeight: 800, color: "#111", textDecoration: "none" }}
                >
                  Knowledge
                </Link>
              </div>

              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                {process.env.NODE_ENV === "production" ? "" : "Local"}
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: 16,
              }}
            >
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}