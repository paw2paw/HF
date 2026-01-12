'use client';

import React, { useEffect, useState } from 'react';
import SidebarNav from '@/src/components/shared/SidebarNav';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  // persist sidebar state
  useEffect(() => {
    const v = window.localStorage.getItem('hf.sidebar.collapsed');
    if (v === '1') setCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('hf.sidebar.collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="h-screen overflow-hidden bg-neutral-50 text-neutral-900 antialiased">
        <div
          className="grid h-screen transition-[grid-template-columns] duration-150 ease-out"
          style={{ gridTemplateColumns: collapsed ? '64px 1fr' : '280px 1fr' }}
        >
          {/* Sidebar */}
          <aside className="h-screen overflow-hidden border-r border-neutral-200 bg-white">
            <div className="h-full px-2 py-4">
              <SidebarNav
                collapsed={collapsed}
                onToggle={() => setCollapsed((v) => !v)}
              />
            </div>
          </aside>

          {/* Main content */}
          <main className="flex h-screen min-w-0 flex-col">
            <div className="flex-1 overflow-auto">
              <div className="mx-auto max-w-[1400px] px-8 py-8">
                {children}
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}