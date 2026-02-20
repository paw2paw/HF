'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Settings, Plus } from 'lucide-react';

type CommunityDetail = {
  id: string;
  name: string;
  description?: string;
  onboardingWelcome?: string;
  personaName: string;
  memberCount: number;
  playbookCount: number;
  recentMembers: Array<{ id: string; name: string; createdAt: string }>;
};

type Tab = 'members' | 'identity' | 'onboarding' | 'settings';

export default function CommunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const communityId = params.communityId as string;

  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [editingName, setEditingName] = useState(false);
  const [editingWelcome, setEditingWelcome] = useState(false);
  const [formData, setFormData] = useState({ name: '', onboardingWelcome: '' });
  const [saving, setSaving] = useState(false);

  // Load community details
  useEffect(() => {
    const loadCommunity = async () => {
      try {
        const res = await fetch(`/api/communities/${communityId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Community not found');
          } else {
            throw new Error('Failed to load community');
          }
          return;
        }
        const data = await res.json();
        if (data.ok && data.community) {
          setCommunity(data.community);
          setFormData({
            name: data.community.name,
            onboardingWelcome: data.community.onboardingWelcome || '',
          });
        } else {
          setError(data.error || 'Failed to load community');
        }
      } catch (err) {
        console.error('Error loading community:', err);
        setError(err instanceof Error ? err.message : 'Failed to load community');
      } finally {
        setLoading(false);
      }
    };
    loadCommunity();
  }, [communityId]);

  const handleSaveName = async () => {
    if (!formData.name.trim()) {
      setError('Community name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/communities/${communityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setCommunity(data.community);
        setEditingName(false);
      } else {
        setError(data.error || 'Failed to update community name');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update community');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWelcome = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/communities/${communityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingWelcome: formData.onboardingWelcome.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setCommunity(data.community);
        setEditingWelcome(false);
      } else {
        setError(data.error || 'Failed to update welcome message');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update community');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-16">
          <div className="text-[var(--text-secondary)]">Loading community...</div>
        </div>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[var(--accent)] hover:opacity-80 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error || 'Community not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-[var(--accent)] hover:opacity-80 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Communities
      </button>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Community Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          {editingName ? (
            <div className="flex gap-2 flex-1 max-w-md">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="flex-1 px-3 py-2 border border-[var(--border-default)] rounded-lg bg-[var(--input-bg)] text-[var(--text-primary)]"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                disabled={saving}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingName(false);
                  setFormData({ ...formData, name: community.name });
                }}
                className="px-4 py-2 border border-[var(--border-default)] rounded-lg hover:bg-[var(--hover-bg)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
                {community.name}
              </h1>
              <button
                onClick={() => setEditingName(true)}
                className="text-sm text-[var(--accent)] hover:opacity-80"
              >
                Edit name
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-[var(--surface-secondary)] rounded-lg">
            <p className="text-sm text-[var(--text-secondary)] mb-1">Members</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{community.memberCount}</p>
          </div>
          <div className="p-4 bg-[var(--surface-secondary)] rounded-lg">
            <p className="text-sm text-[var(--text-secondary)] mb-1">AI Persona</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{community.personaName}</p>
          </div>
          <div className="p-4 bg-[var(--surface-secondary)] rounded-lg">
            <p className="text-sm text-[var(--text-secondary)] mb-1">Playbooks</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{community.playbookCount}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-[var(--border-default)] flex gap-4">
        {(['members', 'identity', 'onboarding', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'members' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Community Members</h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90">
              <Plus className="w-4 h-4" />
              Add Member
            </button>
          </div>
          <div className="bg-[var(--surface-primary)] border border-[var(--border-default)] rounded-lg">
            {community.recentMembers.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-secondary)]">
                No members yet. Invite people to join this community.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {community.recentMembers.map((member) => (
                  <div key={member.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{member.name}</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Joined {new Date(member.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button className="text-sm text-[var(--accent)] hover:opacity-80">
                      View Profile
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'identity' && (
        <div>
          <h2 className="text-xl font-bold mb-4">AI Persona</h2>
          <div className="bg-[var(--surface-secondary)] border border-[var(--border-default)] rounded-lg p-6">
            <p className="text-[var(--text-secondary)] mb-4">
              The AI persona that guides interactions in this community.
            </p>
            <div className="p-4 bg-[var(--surface-primary)] rounded-lg border border-[var(--border-default)]">
              <p className="font-medium text-[var(--text-primary)]">{community.personaName}</p>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                Configured during community creation. To change, edit the community settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'onboarding' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Onboarding</h2>
          {editingWelcome ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Welcome Message
                </label>
                <textarea
                  value={formData.onboardingWelcome}
                  onChange={(e) => setFormData({ ...formData, onboardingWelcome: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-[var(--border-default)] rounded-lg bg-[var(--input-bg)] text-[var(--text-primary)]"
                  placeholder="Welcome message for new members..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveWelcome}
                  disabled={saving}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingWelcome(false);
                    setFormData({ ...formData, onboardingWelcome: community.onboardingWelcome || '' });
                  }}
                  className="px-4 py-2 border border-[var(--border-default)] rounded-lg hover:bg-[var(--hover-bg)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--surface-secondary)] border border-[var(--border-default)] rounded-lg p-6">
              {community.onboardingWelcome ? (
                <>
                  <p className="text-[var(--text-primary)] mb-4">{community.onboardingWelcome}</p>
                  <button
                    onClick={() => setEditingWelcome(true)}
                    className="text-sm text-[var(--accent)] hover:opacity-80"
                  >
                    Edit welcome message
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[var(--text-secondary)] mb-4">No welcome message set yet.</p>
                  <button
                    onClick={() => setEditingWelcome(true)}
                    className="text-sm text-[var(--accent)] hover:opacity-80"
                  >
                    Add welcome message
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Settings</h2>
          <div className="space-y-4">
            <div className="bg-[var(--surface-secondary)] border border-[var(--border-default)] rounded-lg p-6">
              <h3 className="font-medium text-[var(--text-primary)] mb-2">Community ID</h3>
              <p className="text-sm text-[var(--text-secondary)] font-mono bg-[var(--surface-primary)] p-2 rounded">
                {community.id}
              </p>
            </div>
            <div className="bg-[var(--status-error-bg)] border border-[var(--status-error-border)] rounded-lg p-6">
              <h3 className="font-medium text-[var(--status-error-text)] mb-2">Danger Zone</h3>
              <p className="text-sm text-[var(--status-error-text)] mb-4">
                Archive this community. This cannot be undone.
              </p>
              <button className="px-4 py-2 bg-[var(--status-error-bg)] border border-[var(--status-error-border)] text-[var(--status-error-text)] rounded-lg hover:opacity-80">
                Archive Community
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
