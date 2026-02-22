'use client';

import { useRouter, usePathname } from 'next/navigation';

const AVATAR_COLORS = [
  'var(--text-muted)', 'var(--status-error-text)', 'var(--accent-secondary, #7c6bc4)', 'var(--status-success-text)', 'var(--status-warning-text)',
  'var(--accent-primary)', 'var(--badge-pink-text, #c45baa)', 'var(--status-success-text)', 'var(--status-warning-text)', 'var(--text-muted)',
];

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ConversationItemProps {
  callerId: string;
  name: string;
  domain?: string;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
}

export function ConversationItem({ callerId, name, domain, lastMessage, lastMessageAt }: ConversationItemProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname === `/x/sim/${callerId}`;
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const color = hashColor(callerId);

  return (
    <div className={`wa-convo-item${isActive ? ' wa-convo-active' : ''}`} onClick={() => router.push(`/x/sim/${callerId}`)}>
      <div className="wa-avatar wa-avatar-sm" style={{ background: color }}>
        {initials}
      </div>
      <div className="wa-convo-info">
        <div className="wa-convo-name">
          {name}
          {domain && <span className="wa-domain-badge">{domain}</span>}
        </div>
        <div className="wa-convo-preview">
          {lastMessage || 'Tap to start a conversation'}
        </div>
      </div>
      {lastMessageAt && (
        <div className="wa-convo-time">{formatTime(lastMessageAt)}</div>
      )}
    </div>
  );
}
