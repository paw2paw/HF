'use client';

import React, { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import SimpleSidebarNav from '@/src/components/shared/SimpleSidebarNav';
import { EntityProvider, ChatProvider, ThemeProvider, PaletteProvider, useChatContext, themeInitScript, MasqueradeProvider, useMasquerade, BrandingProvider, useBranding, ViewModeProvider } from '@/contexts';
import { TerminologyProvider } from '@/contexts/TerminologyContext';
import { GuidanceProvider } from '@/contexts/GuidanceContext';
import { GlobalAssistantProvider } from '@/contexts/AssistantContext';
import { ChatPanel } from '@/components/chat';
import { GlobalAssistant } from '@/components/shared/GlobalAssistant';
import { ContentJobQueueProvider, ContentJobQueue } from '@/components/shared/ContentJobQueue';
import EnvironmentBanner, { envSidebarColor, envLabel } from '@/components/shared/EnvironmentBanner';
import MasqueradeBanner, { MASQUERADE_BANNER_HEIGHT, MASQUERADE_COLOR } from '@/components/shared/MasqueradeBanner';
import { TourOverlay } from '@/src/components/shared/TourOverlay';
import { useResponsive } from '@/hooks/useResponsive';
import { Menu, PanelLeft } from 'lucide-react';
import './globals.css';

const SIDEBAR_WIDTH_KEY = 'hf.sidebar.width';
const DEFAULT_SIDEBAR_WIDTH = 180;
const MIN_SIDEBAR_WIDTH = 140;
const MAX_SIDEBAR_WIDTH = 320;
const COLLAPSED_WIDTH = 0;


function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const { isOpen, chatLayout } = useChatContext();
  const { isMobile, showDesktop } = useResponsive();
  const { isMasquerading } = useMasquerade();
  const { branding } = useBranding();

  // Hydration guard is now centralized in MasqueradeContext — isMasquerading
  // is always false until after mount, so all consumers are automatically safe.
  const showMasqueradeChrome = isMasquerading;

  // Embed mode - render without sidebar/chrome (for iframes)
  const isEmbed = searchParams.get('embed') === '1';

  // Auth pages (login, etc.) - render without sidebar
  const isAuthPage = pathname?.startsWith('/login');

  // Sim pages - render without sidebar/chrome (standalone WhatsApp-style app)
  const isSimPage = pathname?.startsWith('/x/sim');

  // Demo player — auto-collapse sidebar to give demos full width
  const isDemoPlayer = /^\/x\/demos\/[^/]+$/.test(pathname || '');
  const preDemoCollapsedRef = useRef<boolean | null>(null);
  const demoForcedRef = useRef(false);

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
    // Skip persisting when demo auto-forced the collapse
    if (demoForcedRef.current) return;
    window.localStorage.setItem(storageKey, collapsed ? '1' : '0');
  }, [collapsed, storageKey]);

  // Auto-collapse when entering a demo, restore when leaving
  useEffect(() => {
    if (isDemoPlayer && preDemoCollapsedRef.current === null) {
      preDemoCollapsedRef.current = collapsed;
      demoForcedRef.current = true;
      setCollapsed(true);
    } else if (!isDemoPlayer && preDemoCollapsedRef.current !== null) {
      demoForcedRef.current = false;
      setCollapsed(preDemoCollapsedRef.current);
      preDemoCollapsedRef.current = null;
    }
  }, [isDemoPlayer]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Height accounts for fixed banners (MasqueradeBanner only — env banner removed)
  const bannerHeight = showMasqueradeChrome ? MASQUERADE_BANNER_HEIGHT : 0;
  const layoutHeight = bannerHeight > 0 ? `calc(100vh - ${bannerHeight}px)` : '100vh';

  // Auth pages, embed mode, and sim pages render without sidebar/chrome
  if (isAuthPage || isEmbed || isSimPage) {
    return <>{children}</>;
  }

  // Masquerade border — visible purple frame around the viewport
  const masqueradeBorderStyle: React.CSSProperties = showMasqueradeChrome
    ? { boxShadow: `inset 0 0 0 3px ${MASQUERADE_COLOR}` }
    : {};

  // Mobile layout (< 768px, not forced desktop mode)
  if (isMobile && !showDesktop) {
    return (
      <div className="flex flex-col" style={{ height: layoutHeight, ...masqueradeBorderStyle }}>
        {/* Mobile header with hamburger */}
        <header
          className="h-14 border-b flex items-center px-4 gap-3 flex-shrink-0"
          style={{
            borderColor: 'var(--border-default)',
            background: 'var(--surface-primary)',
          }}
        >
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2.5 rounded-md hover:bg-[var(--hover-bg)] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
          </button>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.name} style={{ height: 28 }} />
          ) : (
            <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              {branding.name}
            </span>
          )}
        </header>

        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Sidebar */}
            <aside
              className="fixed top-0 left-0 h-full w-64 z-50 shadow-xl"
              style={{
                background: 'var(--surface-primary)',
                borderRight: '1px solid var(--border-default)',
                borderLeft: envSidebarColor ? `3px solid ${envSidebarColor}` : undefined,
              }}
            >
              <div className="h-full px-2 py-4">
                <SimpleSidebarNav
                  collapsed={false}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              </div>
            </aside>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="px-4 py-6">
            {children}
          </div>
        </main>
      </div>
    );
  }

  // Desktop layout (current grid)
  return (
    <div
      className="grid relative"
      style={{
        height: layoutHeight,
        gridTemplateColumns: `${effectiveSidebarWidth}px 1fr`,
        gridTemplateRows: '1fr',
        transition: isResizing ? 'none' : 'grid-template-columns 200ms ease-out',
        ...masqueradeBorderStyle,
      }}
    >
      {/* Floating sidebar open button when fully hidden */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute top-4 left-3 z-30 flex h-8 w-8 items-center justify-center rounded-md transition-all hover:bg-[var(--hover-bg)]"
          style={{
            background: 'var(--surface-primary)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <PanelLeft className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className="relative h-full overflow-hidden"
        style={{
          background: 'var(--surface-primary)',
          borderRight: collapsed ? 'none' : '1px solid var(--border-subtle)',
          borderLeft: envSidebarColor ? `3px solid ${envSidebarColor}` : undefined,
        }}
      >
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
        className="h-full min-w-0 overflow-auto transition-all duration-200"
        style={getMainStyle()}
      >
        <div className="py-6" style={{ paddingLeft: collapsed ? 56 : 32, paddingRight: 32 }}>
          {children}
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
        {/* PWA manifest and mobile meta tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#075E54" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 antialiased">
        <EnvironmentBanner />
        <ThemeProvider>
          <PaletteProvider>
            <SessionProvider>
              <BrandingProvider>
              <TerminologyProvider>
              <MasqueradeProvider>
              <ViewModeProvider>
              <MasqueradeBanner />
              <EntityProvider>
                <GuidanceProvider>
                  <ChatProvider>
                    <GlobalAssistantProvider>
                      <ContentJobQueueProvider>
                        <TourOverlay />
                        <Suspense fallback={null}>
                          <LayoutInner>{children}</LayoutInner>
                        </Suspense>
                        {/* New Unified AI Assistant (Cmd+K) - includes search & all features */}
                        <GlobalAssistant />
                        <ContentJobQueue />
                      </ContentJobQueueProvider>
                    </GlobalAssistantProvider>
                  </ChatProvider>
                </GuidanceProvider>
              </EntityProvider>
              </ViewModeProvider>
              </MasqueradeProvider>
              </TerminologyProvider>
              </BrandingProvider>
            </SessionProvider>
          </PaletteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
