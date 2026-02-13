'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useResponsive } from '@/hooks/useResponsive';
import { ConversationList } from '@/components/sim/ConversationList';
import './sim.css';

export default function SimLayout({ children }: { children: React.ReactNode }) {
  const { isDesktop } = useResponsive();
  const pathname = usePathname();
  const isLogin = pathname === '/x/sim/login';

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Login page: no split view
  if (isLogin) {
    return (
      <div className="wa-mobile-container">
        {children}
      </div>
    );
  }

  // Desktop: WhatsApp Web split view
  if (isDesktop) {
    return (
      <div className="wa-desktop-container">
        <div className="wa-desktop-sidebar">
          <ConversationList />
        </div>
        <div className="wa-desktop-main">
          {children}
        </div>
      </div>
    );
  }

  // Mobile/Tablet: full-screen single panel
  return (
    <div className="wa-mobile-container">
      {children}
    </div>
  );
}
