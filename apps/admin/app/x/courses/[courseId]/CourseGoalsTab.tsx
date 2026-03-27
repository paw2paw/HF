'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Target, Filter } from 'lucide-react';
import { FancySelect } from '@/components/shared/FancySelect';
import { CallerPill, GoalPill } from '@/src/components/shared/EntityPill';
import {
  GOAL_TYPE_CONFIG,
  GOAL_STATUS_CONFIG,
  GOAL_TYPE_OPTIONS,
  GOAL_STATUS_OPTIONS,
} from '@/lib/goals/goal-constants';

// ── Types ──────────────────────────────────────────────

type Goal = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  status: string;
  priority: number;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  targetDate: string | null;
  caller: {
    id: string;
    name: string;
    domain: { id: string; slug: string; name: string } | null;
  };
  playbook: { id: string; name: string; version: string } | null;
  contentSpec: { id: string; slug: string; name: string } | null;
};

type GoalCounts = {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
};

export type CourseGoalsTabProps = {
  courseId: string;
};

// ── Progress Ring ──────────────────────────────────────

function ProgressRing({ progress, size = 48, strokeWidth = 4, color }: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}): React.ReactElement {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-default)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: size * 0.24, fontWeight: 700, fill: color, fontFamily: 'ui-monospace, monospace' }}>
        {Math.round(progress * 100)}%
      </text>
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────

export function CourseGoalsTab({ courseId }: CourseGoalsTabProps): React.ReactElement {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [counts, setCounts] = useState<GoalCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');

  // Fetch goals scoped to this course (playbook)
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ playbookId: courseId });
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (filterType !== 'all') params.set('type', filterType);

    fetch(`/api/goals?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setGoals(data.goals);
          setCounts(data.counts);
        } else {
          setError(data.error || 'Failed to load goals');
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Network error'))
      .finally(() => setLoading(false));
  }, [courseId, filterStatus, filterType]);

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search) return goals;
    const s = search.toLowerCase();
    return goals.filter((g) =>
      g.name.toLowerCase().includes(s) ||
      g.description?.toLowerCase().includes(s) ||
      g.caller.name.toLowerCase().includes(s)
    );
  }, [goals, search]);

  // Group by caller for the per-student view
  const byCaller = useMemo(() => {
    const map = new Map<string, { caller: Goal['caller']; goals: Goal[] }>();
    for (const g of filtered) {
      const existing = map.get(g.caller.id);
      if (existing) {
        existing.goals.push(g);
      } else {
        map.set(g.caller.id, { caller: g.caller, goals: [g] });
      }
    }
    return [...map.values()].sort((a, b) => a.caller.name.localeCompare(b.caller.name));
  }, [filtered]);

  // ── Loading ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="hf-empty-compact">
        <div className="hf-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="hf-banner hf-banner-error hf-mt-md">{error}</div>
    );
  }

  // ── Empty State ──────────────────────────────────────

  if (goals.length === 0 && filterStatus === 'all' && filterType === 'all') {
    return (
      <div className="hf-empty-state hf-mt-lg">
        <div className="hf-empty-state-icon"><Target size={48} /></div>
        <div className="hf-empty-state-title">No goals yet</div>
        <div className="hf-empty-state-desc">
          Goals are created automatically when students are enrolled in this course
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────

  return (
    <div className="hf-mt-md">
      {/* Status summary cards */}
      {counts && (
        <div className="hf-grid-auto hf-gap-sm hf-mb-md">
          {Object.entries(GOAL_STATUS_CONFIG).map(([key, cfg]) => {
            const count = counts.byStatus[key] || 0;
            return (
              <button
                key={key}
                type="button"
                className={`hf-stat-card hf-stat-card-compact hf-stat-card-clickable${filterStatus === key ? ' hf-stat-card-active' : ''}`}
                onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
              >
                <div className="hf-stat-value-sm" style={{ color: cfg.color }}>{count}</div>
                <div className="hf-text-xs hf-text-muted">{cfg.icon} {cfg.label}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="hf-flex hf-gap-sm hf-mb-md hf-flex-wrap hf-items-center">
        <Filter size={14} className="hf-text-muted" />
        <input
          type="text"
          placeholder="Search goals or students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="hf-input hf-input-sm"
          style={{ width: 200 }}
        />
        <FancySelect
          value={filterStatus}
          onChange={setFilterStatus}
          searchable={false}
          style={{ minWidth: 130 }}
          options={GOAL_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
        />
        <FancySelect
          value={filterType}
          onChange={setFilterType}
          searchable={false}
          style={{ minWidth: 130 }}
          options={GOAL_TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }))}
        />
        <span className="hf-text-xs hf-text-muted hf-ml-auto">
          {filtered.length} goal{filtered.length !== 1 ? 's' : ''} across {byCaller.length} student{byCaller.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* No results after filter */}
      {filtered.length === 0 && (
        <div className="hf-empty-state hf-mt-md">
          <div className="hf-empty-state-icon"><Target size={36} /></div>
          <div className="hf-empty-state-title">No goals match filters</div>
          <div className="hf-empty-state-desc">Try adjusting the status or type filter</div>
        </div>
      )}

      {/* Goals grouped by student */}
      <div className="hf-flex-col hf-gap-md">
        {byCaller.map(({ caller, goals: callerGoals }) => (
          <div key={caller.id} className="hf-card">
            {/* Student header */}
            <div className="hf-flex hf-items-center hf-gap-sm hf-mb-sm">
              <Link href={`/x/callers/${caller.id}?tab=learning`}>
                <CallerPill label={caller.name} size="compact" />
              </Link>
              <span className="hf-text-xs hf-text-muted">
                {callerGoals.length} goal{callerGoals.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Goal rows */}
            <div className="hf-flex-col hf-gap-xs">
              {callerGoals.map((goal) => {
                const typeConfig = GOAL_TYPE_CONFIG[goal.type] || { label: goal.type, icon: '\u{1F3AF}', color: 'var(--text-muted)', glow: 'var(--text-muted)' };
                const statusConfig = GOAL_STATUS_CONFIG[goal.status] || { label: goal.status, icon: '', color: 'var(--text-muted)' };

                return (
                  <Link
                    key={goal.id}
                    href={`/x/callers/${goal.caller.id}?tab=learning`}
                    className="hf-list-row hf-list-row-clickable"
                  >
                    <ProgressRing progress={goal.progress} color={typeConfig.color} />
                    <div className="hf-flex-1 hf-min-w-0">
                      <div className="hf-flex hf-items-center hf-gap-xs hf-mb-2xs">
                        <span
                          className="hf-chip hf-chip-xs"
                          style={{ background: `color-mix(in srgb, ${typeConfig.color} 10%, transparent)`, color: typeConfig.color }}
                        >
                          {typeConfig.icon} {typeConfig.label}
                        </span>
                        <span
                          className="hf-chip hf-chip-xs"
                          style={{ background: `color-mix(in srgb, ${statusConfig.color} 10%, transparent)`, color: statusConfig.color }}
                        >
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="hf-text-sm hf-text-primary hf-text-bold hf-truncate">{goal.name}</div>
                      {goal.description && (
                        <div className="hf-text-xs hf-text-muted hf-truncate">{goal.description}</div>
                      )}
                    </div>
                    <div className="hf-text-xs hf-text-muted hf-text-right hf-flex-shrink-0">
                      {goal.startedAt && <div>Started {new Date(goal.startedAt).toLocaleDateString()}</div>}
                      {goal.completedAt && <div className="hf-text-success">Completed {new Date(goal.completedAt).toLocaleDateString()}</div>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
