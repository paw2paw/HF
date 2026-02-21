'use client';

import { useState, useEffect, useCallback } from 'react';

interface MediaItem {
  id: string;
  fileName: string;
  mimeType: string;
  title?: string | null;
  description?: string | null;
  tags: string[];
  trustLevel: string;
  url: string;
}

interface ContentPickerProps {
  callerId: string;
  callId: string;
  onClose: () => void;
  onShared: () => void;
}

export function ContentPicker({ callerId, callId, onClose, onShared }: ContentPickerProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState<string | null>(null);
  const [contextMsg, setContextMsg] = useState('');
  const [filter, setFilter] = useState<'all' | 'image' | 'pdf' | 'audio'>('all');

  // Load media for this caller's subject(s)
  useEffect(() => {
    async function load() {
      try {
        // Get caller's domain → subject → media
        const res = await fetch(`/api/callers/${callerId}/available-media`);
        if (!res.ok) {
          setMedia([]);
          return;
        }
        const data = await res.json();
        if (data.ok) setMedia(data.media || []);
      } catch {
        setMedia([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [callerId]);

  const filtered = media.filter((m) => {
    if (filter === 'all') return true;
    if (filter === 'image') return m.mimeType.startsWith('image/');
    if (filter === 'pdf') return m.mimeType === 'application/pdf';
    if (filter === 'audio') return m.mimeType.startsWith('audio/');
    return true;
  });

  const handleShare = useCallback(async (mediaItem: MediaItem) => {
    setSharing(mediaItem.id);
    try {
      const res = await fetch(`/api/calls/${callId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'assistant',
          content: contextMsg || mediaItem.title || mediaItem.fileName,
          mediaId: mediaItem.id,
        }),
      });
      if (res.ok) {
        onShared();
        onClose();
      }
    } catch {
      // Error handling
    } finally {
      setSharing(null);
    }
  }, [callId, contextMsg, onShared, onClose]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        maxHeight: '70%',
        background: 'var(--surface-primary)',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>Share Content</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 6px' }}
        >
          {'\u2715'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ padding: '8px 16px', display: 'flex', gap: 6 }}>
        {(['all', 'image', 'pdf', 'audio'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 10px',
              borderRadius: 14,
              fontSize: 12,
              border: '1px solid',
              borderColor: filter === f ? 'var(--accent-primary)' : 'var(--border-default)',
              background: filter === f ? 'var(--accent-primary)' : 'var(--surface-primary)',
              color: filter === f ? 'var(--surface-primary)' : 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            {f === 'all' ? 'All' : f === 'image' ? 'Images' : f === 'pdf' ? 'PDFs' : 'Audio'}
          </button>
        ))}
      </div>

      {/* Context message input */}
      <div style={{ padding: '0 16px 8px' }}>
        <input
          type="text"
          placeholder="Add a message (optional)..."
          value={contextMsg}
          onChange={(e) => setContextMsg(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--border-default)',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {/* Media grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Loading content library...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            {media.length === 0 ? 'No content uploaded for this subject yet' : 'No matching content'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => handleShare(item)}
                disabled={sharing === item.id}
                style={{
                  padding: 8,
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  background: 'var(--surface-primary)',
                  cursor: sharing === item.id ? 'wait' : 'pointer',
                  textAlign: 'left',
                  opacity: sharing === item.id ? 0.5 : 1,
                }}
              >
                {/* Thumbnail */}
                <div style={{ width: '100%', height: 80, borderRadius: 4, overflow: 'hidden', marginBottom: 6, background: 'var(--surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.mimeType.startsWith('image/') ? (
                    <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : item.mimeType === 'application/pdf' ? (
                    <span style={{ fontSize: 32 }}>{'\u{1F4C4}'}</span>
                  ) : item.mimeType.startsWith('audio/') ? (
                    <span style={{ fontSize: 32 }}>{'\u{1F3B5}'}</span>
                  ) : (
                    <span style={{ fontSize: 32 }}>{'\u{1F4CE}'}</span>
                  )}
                </div>

                {/* Label */}
                <div style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title || item.fileName}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {item.mimeType.startsWith('image/') ? 'Image' : item.mimeType === 'application/pdf' ? 'PDF' : item.mimeType.startsWith('audio/') ? 'Audio' : 'File'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
