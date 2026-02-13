'use client';

import { ArrowLeft, Phone, PhoneOff } from 'lucide-react';

interface WhatsAppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onEndCall?: () => void;
  callActive?: boolean;
  avatarColor?: string;
}

export function WhatsAppHeader({ title, subtitle, onBack, onEndCall, callActive, avatarColor = '#6B7B8D' }: WhatsAppHeaderProps) {
  const initials = title.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="wa-header">
      {onBack && (
        <button className="wa-back-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={24} />
        </button>
      )}
      <div className="wa-avatar" style={{ background: avatarColor }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="wa-header-title">{title}</div>
        {subtitle && <div className="wa-header-subtitle">{subtitle}</div>}
      </div>
      {callActive && onEndCall && (
        <button
          className="wa-back-btn"
          onClick={onEndCall}
          aria-label="End call"
          style={{ color: '#FF5252' }}
        >
          <PhoneOff size={22} />
        </button>
      )}
    </div>
  );
}
