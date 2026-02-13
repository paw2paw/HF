'use client';

import { MessageCircle } from 'lucide-react';
import { useResponsive } from '@/hooks/useResponsive';
import { ConversationList } from '@/components/sim/ConversationList';

export default function SimChatListPage() {
  const { isDesktop } = useResponsive();

  // Desktop: list is already in layout sidebar, show empty state in main panel
  if (isDesktop) {
    return (
      <div className="wa-desktop-empty">
        <div style={{ color: 'var(--wa-border)' }}>
          <MessageCircle size={72} strokeWidth={1} />
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 300, color: 'var(--wa-text-secondary)', margin: '24px 0 12px' }}>
          HF Simulator
        </h2>
        <p style={{ fontSize: 14, color: 'var(--wa-text-muted)', maxWidth: 460, lineHeight: 1.5 }}>
          Select a conversation from the sidebar to start chatting.
        </p>
      </div>
    );
  }

  // Mobile/Tablet: show conversation list
  return <ConversationList />;
}
