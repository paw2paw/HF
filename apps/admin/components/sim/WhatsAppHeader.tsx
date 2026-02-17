'use client';

import { ArrowLeft, Phone, PhoneOff, FolderOpen } from 'lucide-react';

interface WhatsAppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onEndCall?: () => void;
  onMediaLibrary?: () => void;
  mediaLibraryActive?: boolean;
  callActive?: boolean;
  avatarColor?: string;
}

export function WhatsAppHeader({ title, subtitle, onBack, onEndCall, onMediaLibrary, mediaLibraryActive, callActive, avatarColor = '#6B7B8D' }: WhatsAppHeaderProps) {
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
      {onMediaLibrary && (
        <button
          className="wa-back-btn"
          onClick={onMediaLibrary}
          aria-label="Shared files"
          title="Shared files"
          style={{ color: mediaLibraryActive ? '#4338ca' : undefined }}
        >
          <FolderOpen size={20} />
        </button>
      )}
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
