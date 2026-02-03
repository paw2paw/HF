'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import SidebarNav from '@/src/components/shared/SidebarNav';
import SimpleSidebarNav from '@/src/components/shared/SimpleSidebarNav';
import { EntityProvider, ChatProvider, useChatContext } from '@/contexts';
import { ChatPanel } from '@/components/chat';
import './globals.css';

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const { isOpen, chatLayout } = useChatContext();

  // Determine if we're in the simplified /x/* routes
  const isSimplifiedUI = pathname?.startsWith('/x');

  // persist sidebar state (separate for each mode)
  const storageKey = isSimplifiedUI ? 'hf.sidebar.collapsed.simple' : 'hf.sidebar.collapsed';

  useEffect(() => {
    const v = window.localStorage.getItem(storageKey);
    if (v === '1') setCollapsed(true);
    else setCollapsed(false);
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, collapsed ? '1' : '0');
  }, [collapsed, storageKey]);

  // Calculate main content style based on chat layout
  const getMainStyle = (): React.CSSProperties => {
    if (!isOpen) return {};

    switch (chatLayout) {
      case 'horizontal':
        return { paddingBottom: '320px' };
      case 'popout':
        return {};
      case 'vertical':
      default:
        return {};
    }
  };

  // Sidebar width config
  const sidebarWidth = isSimplifiedUI
    ? (collapsed ? '64px' : '220px')
    : (collapsed ? '64px' : '280px');

  const maxContentWidth = isSimplifiedUI ? '1200px' : '1400px';
  const contentPadding = isSimplifiedUI ? 'px-6 py-6' : 'px-8 py-8';

  return (
    <div
      className="grid h-screen transition-[grid-template-columns] duration-150 ease-out"
      style={{ gridTemplateColumns: `${sidebarWidth} 1fr` }}
    >
      {/* Sidebar */}
      <aside className="h-screen overflow-hidden border-r border-neutral-200 bg-white">
        <div className="h-full px-2 py-4">
          {isSimplifiedUI ? (
            <SimpleSidebarNav
              collapsed={collapsed}
              onToggle={() => setCollapsed((v) => !v)}
            />
          ) : (
            <SidebarNav
              collapsed={collapsed}
              onToggle={() => setCollapsed((v) => !v)}
            />
          )}
        </div>
      </aside>

      {/* Main content */}
      <main
        className="flex h-screen min-w-0 flex-col transition-all duration-200"
        style={getMainStyle()}
      >
        <div className="flex-1 overflow-auto">
          <div className={`mx-auto ${contentPadding}`} style={{ maxWidth: maxContentWidth }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="h-screen overflow-hidden bg-neutral-50 text-neutral-900 antialiased">
        <EntityProvider>
          <ChatProvider>
            <LayoutInner>{children}</LayoutInner>
            {/* AI Chat Panel */}
            <ChatPanel />
          </ChatProvider>
        </EntityProvider>
      </body>
    </html>
  );
}