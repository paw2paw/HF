'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users } from 'lucide-react';

type Community = {
  id: string;
  name: string;
  description?: string;
  onboardingWelcome?: string;
  personaName: string;
  memberCount: number;
  createdAt: string;
};

export default function CommunitiesPage() {
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load communities on mount
  useEffect(() => {
    const loadCommunities = async () => {
      try {
        const res = await fetch('/api/communities');
        if (!res.ok) throw new Error('Failed to load communities');
        const data = await res.json();
        if (data.ok) {
          setCommunities(data.communities || []);
        } else {
          setError(data.error || 'Failed to load communities');
        }
      } catch (err) {
        console.error('Error loading communities:', err);
        setError(err instanceof Error ? err.message : 'Failed to load communities');
      } finally {
        setLoading(false);
      }
    };
    loadCommunities();
  }, []);

  const handleNewCommunity = () => {
    router.push('/x/quick-launch?mode=community');
  };

  const handleSelectCommunity = (communityId: string) => {
    router.push(`/x/communities/${communityId}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Communities</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Create purpose-led groups for individuals to learn together
          </p>
        </div>
        <button
          onClick={handleNewCommunity}
          className="hf-btn hf-btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Community
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 hf-banner hf-banner-error">
          {error}
        </div>
      )}

      {/* Communities Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-[var(--text-secondary)]">Loading communities...</div>
        </div>
      ) : communities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-16 h-16 text-[var(--text-tertiary)] mb-4" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            No communities yet
          </h2>
          <p className="text-[var(--text-secondary)] mb-6 max-w-md">
            Create your first community to bring together a group of individuals with a shared purpose.
          </p>
          <button
            onClick={handleNewCommunity}
            className="hf-btn hf-btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create First Community
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {communities.map((community) => (
            <div
              key={community.id}
              onClick={() => handleSelectCommunity(community.id)}
              className="p-6 border border-[var(--border-default)] rounded-lg hover:border-[var(--accent)] hover:shadow-lg transition-all cursor-pointer bg-[var(--surface-primary)]"
            >
              {/* Name */}
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                {community.name}
              </h3>

              {/* Persona */}
              {community.personaName && (
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                  <span className="font-medium">AI Persona:</span> {community.personaName}
                </p>
              )}

              {/* Description/Purpose */}
              {community.onboardingWelcome && (
                <p className="text-sm text-[var(--text-muted)] mb-4 line-clamp-2">
                  {community.onboardingWelcome}
                </p>
              )}

              {/* Meta info */}
              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Users className="w-4 h-4" />
                  <span>{community.memberCount} member{community.memberCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {new Date(community.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
