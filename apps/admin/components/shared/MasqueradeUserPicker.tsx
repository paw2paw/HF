'use client';

/**
 * MasqueradeUserPicker — Popover for selecting a user to masquerade as.
 * Anchored to a trigger button (typically in the sidebar footer).
 * Fetches users from /api/admin/masquerade/users with search.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMasquerade } from '@/contexts/MasqueradeContext';
import { Search, X, VenetianMask } from 'lucide-react';

interface PickerUser {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  role: string;
  assignedDomainId: string | null;
  assignedDomain: { id: string; name: string } | null;
}

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: 'var(--status-error-text)',
  ADMIN: 'var(--badge-orange-text, #ea580c)',
  OPERATOR: 'var(--accent-primary)',
  EDUCATOR: 'var(--status-success-text)',
  SUPER_TESTER: 'var(--accent-secondary, #8b5cf6)',
  TESTER: 'var(--text-muted)',
  DEMO: 'var(--text-muted)',
  VIEWER: 'var(--text-muted)',
};

export function MasqueradeUserPicker({ onClose }: { onClose: () => void }) {
  const { startMasquerade, isMasquerading, masquerade } = useMasquerade();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<PickerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus search on open
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Fetch users
  const fetchUsers = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : '';
      const res = await fetch(`/api/admin/masquerade/users${params}`);
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(search), 200);
    return () => clearTimeout(timer);
  }, [search, fetchUsers]);

  const handleSelect = async (user: PickerUser) => {
    try {
      await startMasquerade(user.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: 8,
        background: 'var(--surface-primary)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        boxShadow: '0 8px 32px color-mix(in srgb, var(--text-primary) 20%, transparent)',
        zIndex: 100,
        maxHeight: 400,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 12px 8px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          <VenetianMask size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
          Step In As
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 12px', position: 'relative' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }}
        />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px 6px 28px',
            fontSize: 12,
            border: '1px solid var(--border-default)',
            borderRadius: 4,
            background: 'var(--surface-secondary)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </div>

      {/* Active masquerade indicator */}
      {isMasquerading && masquerade && (
        <div
          style={{
            padding: '6px 12px',
            background: `color-mix(in srgb, var(--masquerade-color) 10%, transparent)`,
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--masquerade-color)',
          }}
        >
          <VenetianMask size={12} />
          <span>Stepped in as: {masquerade.name || masquerade.email}</span>
        </div>
      )}

      {/* User list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {loading && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            Loading...
          </div>
        )}
        {error && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--status-error-text)' }}>
            {error}
          </div>
        )}
        {!loading && !error && users.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            No users found
          </div>
        )}
        {!loading &&
          !error &&
          users.map((user) => {
            const isCurrentMasquerade = masquerade?.userId === user.id;
            const label = user.displayName || user.name || user.email;
            return (
              <button
                key={user.id}
                onClick={() => !isCurrentMasquerade && handleSelect(user)}
                disabled={isCurrentMasquerade}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: isCurrentMasquerade ? `color-mix(in srgb, var(--masquerade-color) 6%, transparent)` : 'transparent',
                  cursor: isCurrentMasquerade ? 'default' : 'pointer',
                  textAlign: 'left',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  opacity: isCurrentMasquerade ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isCurrentMasquerade) e.currentTarget.style.background = 'var(--hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isCurrentMasquerade ? `color-mix(in srgb, var(--masquerade-color) 6%, transparent)` : 'transparent';
                }}
              >
                {/* Avatar circle */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: ROLE_COLORS[user.role] || 'var(--text-muted)',
                    color: 'var(--surface-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {(label[0] || '?').toUpperCase()}
                </div>

                {/* User info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user.email}
                  </div>
                </div>

                {/* Role badge */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: `color-mix(in srgb, ${ROLE_COLORS[user.role] || 'var(--text-muted)'} 10%, transparent)`,
                    color: ROLE_COLORS[user.role] || 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.role}
                </span>

                {/* Domain pill */}
                {user.assignedDomain && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'var(--surface-secondary)',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user.assignedDomain.name}
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}
