'use client';

import { useState } from 'react';
import type { CommunityDetail } from './types';

interface OnboardingTabProps {
  community: CommunityDetail;
  onSave: (patch: Record<string, any>) => Promise<void>;
  saving: boolean;
}

export function OnboardingTab({ community, onSave, saving }: OnboardingTabProps) {
  const [welcome, setWelcome] = useState(community.onboardingWelcome || '');
  const [dirty, setDirty] = useState(false);

  const handleSave = async () => {
    await onSave({ onboardingWelcome: welcome.trim() });
    setDirty(false);
  };

  return (
    <div>
      <h2 className="hf-section-title" style={{ marginBottom: 4 }}>Onboarding</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        Configure the welcome experience for new community members.
      </p>

      {/* Welcome Message */}
      <div className="hf-card" style={{ marginBottom: 20 }}>
        <label className="hf-label" style={{ marginBottom: 8, display: 'block' }}>
          Welcome Message
        </label>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          This message greets new members on their first interaction with the AI companion.
        </p>
        <textarea
          className="hf-input"
          value={welcome}
          onChange={(e) => { setWelcome(e.target.value); setDirty(true); }}
          rows={5}
          placeholder="Welcome to the community! I'm here to help you..."
          style={{ width: '100%', resize: 'vertical' }}
        />
      </div>

      {/* Flow Phases (read-only for now — set from identity tab / domain setup) */}
      {community.onboardingFlowPhases && (
        <div className="hf-card" style={{ marginBottom: 20 }}>
          <label className="hf-label" style={{ marginBottom: 8, display: 'block' }}>
            Conversation Flow Phases
          </label>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            The phases a first conversation follows. Configure from the Identity tab.
          </p>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {Array.isArray(community.onboardingFlowPhases)
              ? (community.onboardingFlowPhases as Array<{ phase: string; duration: string }>).map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '8px 0',
                      borderBottom: i < (community.onboardingFlowPhases as any[]).length - 1
                        ? '1px solid var(--border-subtle)'
                        : 'none',
                    }}
                  >
                    <span style={{ fontWeight: 600, minWidth: 24 }}>{i + 1}.</span>
                    <span>{p.phase}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{p.duration}</span>
                  </div>
                ))
              : <span style={{ color: 'var(--text-muted)' }}>Not configured</span>
            }
          </div>
        </div>
      )}

      {/* Save */}
      {dirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="hf-btn hf-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Onboarding'}
          </button>
        </div>
      )}
    </div>
  );
}
