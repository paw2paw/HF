'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';
import { AgentTuningPanel, type AgentTuningPanelOutput } from '@/components/shared/AgentTuningPanel';
import type { CommunityDetail } from './types';

interface IdentityTabProps {
  community: CommunityDetail;
  onSave: (patch: Record<string, any>) => Promise<void>;
  saving: boolean;
}

export function IdentityTab({ community, onSave, saving }: IdentityTabProps) {
  const [selectedSpecId, setSelectedSpecId] = useState(community.onboardingIdentitySpecId || '');
  const [matrixOutput, setMatrixOutput] = useState<AgentTuningPanelOutput | null>(null);
  const [dirty, setDirty] = useState(false);

  const handleSpecChange = (specId: string) => {
    setSelectedSpecId(specId);
    setDirty(true);
  };

  const handleMatrixChange = (output: AgentTuningPanelOutput) => {
    setMatrixOutput(output);
    setDirty(true);
  };

  const handleSave = async () => {
    const patch: Record<string, any> = {};

    if (selectedSpecId !== (community.onboardingIdentitySpecId || '')) {
      patch.onboardingIdentitySpecId = selectedSpecId || null;
    }

    if (matrixOutput) {
      // Persist both the structured targets AND the matrix positions for round-trip
      const targets: Record<string, { value: number; confidence: number }> = {};
      for (const [paramId, value] of Object.entries(matrixOutput.parameterMap)) {
        targets[paramId] = { value, confidence: 0.5 };
      }
      patch.onboardingDefaultTargets = {
        ...targets,
        _matrixPositions: matrixOutput.matrixPositions,
        _traits: matrixOutput.traits,
      };
    }

    if (Object.keys(patch).length > 0) {
      await onSave(patch);
      setDirty(false);
    }
  };

  const existingTargets = community.onboardingDefaultTargets as Record<string, any> | null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="hf-section-title" style={{ marginBottom: 4 }}>AI Companion Voice</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Shape who the companion is — pick an archetype, then tune its voice and style.
          </p>
        </div>
        {community.onboardingIdentitySpecId && (
          <Link
            href={`/x/layers?overlayId=${community.onboardingIdentitySpecId}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: 'var(--accent-primary)',
              textDecoration: 'none',
            }}
          >
            <Layers size={14} />
            View Layers
          </Link>
        )}
      </div>

      {/* Archetype Picker */}
      <div className="hf-card" style={{ marginBottom: 20 }}>
        <label className="hf-label" style={{ marginBottom: 8, display: 'block' }}>
          Base Archetype
        </label>
        <select
          className="hf-input"
          value={selectedSpecId}
          onChange={(e) => handleSpecChange(e.target.value)}
          style={{ width: '100%', maxWidth: 400 }}
        >
          <option value="">— Select archetype —</option>
          {(community.identitySpecs || []).map((spec) => (
            <option key={spec.id} value={spec.id}>
              {spec.name} ({spec.slug})
            </option>
          ))}
        </select>
        {community.identitySpec && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Current: {community.identitySpec.name} ({community.identitySpec.slug})
          </p>
        )}
      </div>

      {/* Boston Matrix Voice Tuning */}
      <div className="hf-card" style={{ marginBottom: 20 }}>
        <h3 className="hf-section-title" style={{ marginBottom: 4 }}>Voice & Style</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Drag the dots to set the companion&apos;s personality. Click a preset to start from a known style.
        </p>
        <AgentTuningPanel
          initialPositions={existingTargets?._matrixPositions}
          existingParams={
            existingTargets
              ? Object.fromEntries(
                  Object.entries(existingTargets)
                    .filter(([k]) => !k.startsWith('_'))
                    .map(([k, v]) => [k, typeof v === 'object' && v !== null ? (v as any).value : v])
                )
              : undefined
          }
          onChange={handleMatrixChange}
        />
      </div>

      {/* Save Button */}
      {dirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="hf-btn hf-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Identity'}
          </button>
        </div>
      )}
    </div>
  );
}
