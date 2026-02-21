'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CommunityDetail } from './types';

interface SettingsTabProps {
  community: CommunityDetail;
  onSave: (patch: Record<string, any>) => Promise<void>;
  saving: boolean;
}

export function SettingsTab({ community, onSave, saving }: SettingsTabProps) {
  const router = useRouter();
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description || '');
  const [dirty, setDirty] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const handleSave = async () => {
    const patch: Record<string, any> = {};
    if (name !== community.name) patch.name = name.trim();
    if (description !== (community.description || '')) patch.description = description.trim();
    if (Object.keys(patch).length > 0) {
      await onSave(patch);
      setDirty(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/communities/${community.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        router.push('/x/communities');
      }
    } catch (err) {
      console.error('Archive failed:', err);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div>
      <h2 className="hf-section-title" style={{ marginBottom: 20 }}>Settings</h2>

      {/* Name + Description */}
      <div className="hf-card" style={{ marginBottom: 20 }}>
        <label className="hf-label" style={{ marginBottom: 8, display: 'block' }}>
          Community Name
        </label>
        <input
          className="hf-input"
          value={name}
          onChange={(e) => { setName(e.target.value); setDirty(true); }}
          style={{ width: '100%', maxWidth: 400, marginBottom: 20 }}
        />

        <label className="hf-label" style={{ marginBottom: 8, display: 'block' }}>
          Description
        </label>
        <textarea
          className="hf-input"
          value={description}
          onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
          rows={3}
          placeholder="What is this community about?"
          style={{ width: '100%', resize: 'vertical', marginBottom: 12 }}
        />

        {dirty && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="hf-btn hf-btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Community ID */}
      <div className="hf-card" style={{ marginBottom: 20 }}>
        <label className="hf-label" style={{ marginBottom: 8, display: 'block' }}>
          Community ID
        </label>
        <p style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--surface-secondary)', borderRadius: 8 }}>
          {community.id}
        </p>
      </div>

      {/* Danger Zone */}
      <div
        style={{
          padding: 20,
          borderRadius: 12,
          border: '1px solid var(--status-error-border)',
          background: 'var(--status-error-bg)',
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--status-error-text)', marginBottom: 8 }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: 13, color: 'var(--status-error-text)', marginBottom: 16, opacity: 0.8 }}>
          Archiving deactivates this community. Members will no longer be able to interact with the AI companion.
        </p>
        {confirmArchive ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="hf-btn hf-btn-destructive"
              onClick={handleArchive}
              disabled={archiving}
            >
              {archiving ? 'Archiving...' : 'Confirm Archive'}
            </button>
            <button
              className="hf-btn hf-btn-secondary"
              onClick={() => setConfirmArchive(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="hf-btn hf-btn-destructive"
            onClick={() => setConfirmArchive(true)}
          >
            Archive Community
          </button>
        )}
      </div>
    </div>
  );
}
