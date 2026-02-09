'use client';

import React, { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import SimpleSidebarNav from '@/src/components/shared/SimpleSidebarNav';
import { EntityProvider, ChatProvider, ThemeProvider, PaletteProvider, useChatContext, themeInitScript } from '@/contexts';
import { GuidanceProvider } from '@/contexts/GuidanceContext';
import { ChatPanel } from '@/components/chat';
import { GuidanceBridge } from '@/src/components/shared/GuidanceBridge';
import './globals.css';

const SIDEBAR_WIDTH_KEY = 'hf.sidebar.width';
const DEFAULT_SIDEBAR_WIDTH = 180;
const MIN_SIDEBAR_WIDTH = 140;
const MAX_SIDEBAR_WIDTH = 320;
const COLLAPSED_WIDTH = 56;


function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const { isOpen, chatLayout } = useChatContext();

  // Embed mode - render without sidebar/chrome (for iframes)
  const isEmbed = searchParams.get('embed') === '1';

  // Auth pages (login, etc.) - render without sidebar
  const isAuthPage = pathname?.startsWith('/login');

  // persist sidebar state
  const storageKey = 'hf.sidebar.collapsed';

  useEffect(() => {
    const v = window.localStorage.getItem(storageKey);
    if (v === '1') setCollapsed(true);
    else setCollapsed(false);

    // Load saved width
    const savedWidth = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(parsed);
      }
    }
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, collapsed ? '1' : '0');
  }, [collapsed, storageKey]);

  // Save width when it changes
  useEffect(() => {
    if (!collapsed) {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
    }
  }, [sidebarWidth, collapsed]);

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

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
  const effectiveSidebarWidth = collapsed ? COLLAPSED_WIDTH : sidebarWidth;

  // Auth pages and embed mode render without sidebar/chrome
  if (isAuthPage || isEmbed) {
    return <>{children}</>;
  }

  return (
    <div
      className="grid h-screen"
      style={{
        gridTemplateColumns: `${effectiveSidebarWidth}px 1fr`,
        transition: isResizing ? 'none' : 'grid-template-columns 150ms ease-out',
      }}
    >
      {/* Sidebar */}
      <aside className="relative h-screen overflow-hidden border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="h-full px-2 py-4">
          <SimpleSidebarNav
            collapsed={collapsed}
            onToggle={() => setCollapsed((v) => !v)}
          />
        </div>
        {/* Resize handle - thin line, wider hit target */}
        {!collapsed && (
          <div
            ref={resizeRef}
            onMouseDown={handleMouseDown}
            className="absolute top-0 right-0 w-3 h-full cursor-col-resize flex justify-end"
            style={{ zIndex: 10 }}
            title="Drag to resize"
          >
            <div
              className={
                "w-px h-full transition-all " +
                (isResizing ? "w-0.5 bg-indigo-500" : "bg-neutral-300 dark:bg-neutral-600 hover:w-0.5 hover:bg-indigo-400")
              }
            />
          </div>
        )}
      </aside>

      {/* Main content */}
      <main
        className="flex h-screen min-w-0 flex-col transition-all duration-200"
        style={getMainStyle()}
      >
        <div className="flex-1 overflow-auto">
          <div className="mx-auto px-8 py-6" style={{ maxWidth: '1200px' }}>
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
      <head>
        {/* Prevent flash of wrong theme on initial load */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 antialiased">
        <ThemeProvider>
          <PaletteProvider>
            <SessionProvider>
              <EntityProvider>
                <GuidanceProvider>
                  <ChatProvider>
                    <GuidanceBridge />
                    <Suspense fallback={null}>
                      <LayoutInner>{children}</LayoutInner>
                    </Suspense>
                    {/* AI Chat Panel */}
                    <ChatPanel />
                  </ChatProvider>
                </GuidanceProvider>
              </EntityProvider>
            </SessionProvider>
          </PaletteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
