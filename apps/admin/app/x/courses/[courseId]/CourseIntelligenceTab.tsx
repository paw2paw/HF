'use client';

/**
 * CourseIntelligenceTab — "Content Intelligence" dashboard.
 *
 * Replaces the old CourseContentTab with a scannable layout:
 *   1. Stat cards row (large method counts)
 *   2. Two-column: sources + category proportional bar
 *   3. Segmented control: Genome | By Method | By Outcome | By Source
 *   4. Single AssertionDetailDrawer shared across all views
 *
 * All data comes from the parent page — no new API routes needed.
 * Assertions lazy-fetch on first segment switch away from Genome.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  BookMarked, AlertTriangle, Zap, RefreshCw, Target, Dna,
} from 'lucide-react';
import { getDocTypeInfo } from '@/lib/doc-type-icons';
import { CONTENT_CATEGORIES, CATEGORY_ORDER, getCategoryStyle } from '@/lib/content-categories';
import { INSTRUCTION_CATEGORIES, TEACH_METHOD_CONFIG } from '@/lib/content-trust/resolve-config';
import { CourseGenomeTab } from './CourseGenomeTab';
import { ReExtractModal } from './ReExtractModal';
import { AssertionDetailDrawer } from '@/components/shared/AssertionDetailDrawer';
import './course-intelligence.css';

// ── Types ──────────────────────────────────────────────

type SourceItem = {
  id: string;
  name: string;
  documentType: string;
  extractorVersion: number | null;
  assertionCount: number;
  contentAssertionCount: number;
  instructionAssertionCount: number;
  sortOrder: number;
  tags: string[];
};

type SubjectSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  defaultTrustLevel: string;
  teachingProfile: string | null;
  sourceCount: number;
  curriculumCount: number;
  assertionCount: number;
  sources?: Array<{
    id: string; name: string; documentType: string;
    extractorVersion: number | null; assertionCount: number;
    linkedSourceId: string | null; linkedSourceName: string | null;
  }>;
};

type MethodBreakdown = { teachMethod: string; count: number; reviewed: number };

export type CourseIntelligenceTabProps = {
  courseId: string;
  detail: {
    id: string;
    name: string;
    config?: Record<string, unknown> | null;
    domain: { id: string; name: string; slug: string };
  };
  subjects: SubjectSummary[];
  courseSources?: SourceItem[];
  courseTeachingProfile?: string | null;
  contentMethods: MethodBreakdown[];
  contentTotal: number;
  instructionCount?: number;
  unassignedContentCount?: number;
  categoryCounts?: Record<string, number>;
  isOperator: boolean;
  onContentRefresh?: (methods: MethodBreakdown[], total: number, instructionCount?: number, unassignedContentCount?: number) => void;
};

// ── Constants ──────────────────────────────────────────

const INSTRUCTION_SET = new Set<string>(INSTRUCTION_CATEGORIES);
type Segment = 'genome' | 'method' | 'outcome' | 'source';

type TPData = {
  id: string;
  assertion: string;
  category: string;
  teachMethod: string | null;
  learningOutcomeRef: string | null;
  sourceName: string;
  session?: number | null;
};

// ── Sub-components ─────────────────────────────────────

/** Segmented control — pill-style toggle bar */
function SegmentedControl({ active, onChange }: {
  active: Segment;
  onChange: (s: Segment) => void;
}) {
  const segments: { id: Segment; label: string; icon: React.ReactNode }[] = [
    { id: 'genome', label: 'Genome', icon: <Dna size={14} /> },
    { id: 'method', label: 'By Method', icon: <Target size={14} /> },
    { id: 'outcome', label: 'By Outcome', icon: <BookMarked size={14} /> },
    { id: 'source', label: 'By Source', icon: <Zap size={14} /> },
  ];

  return (
    <div className="ci-segment-bar" role="tablist">
      {segments.map((s) => (
        <button
          key={s.id}
          role="tab"
          aria-selected={active === s.id}
          className={`ci-segment-btn${active === s.id ? ' ci-segment-active' : ''}`}
          onClick={() => onChange(s.id)}
        >
          {s.icon}
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Assertion list grouped by an arbitrary key */
function GroupedAssertionList({ items, groupBy, drawerAssertionId, onSelect }: {
  items: TPData[];
  groupBy: 'learningOutcomeRef' | 'sourceName' | 'teachMethod';
  drawerAssertionId: string | null;
  onSelect: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const groups = new Map<string, TPData[]>();

    if (groupBy === 'teachMethod') {
      // Ordered by TEACH_METHOD_CONFIG, then unassigned
      const methodKeys = Object.keys(TEACH_METHOD_CONFIG);
      for (const key of methodKeys) groups.set(key, []);
      for (const tp of items) {
        const key = tp.teachMethod ?? 'unassigned';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(tp);
      }
      // Remove empty groups
      for (const [k, v] of groups) { if (v.length === 0) groups.delete(k); }
    } else {
      for (const tp of items) {
        const key = groupBy === 'learningOutcomeRef'
          ? (tp.learningOutcomeRef || 'Unassigned')
          : tp.sourceName;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(tp);
      }
    }
    return groups;
  }, [items, groupBy]);

  return (
    <div className="ci-assertion-scroll">
      {Array.from(grouped.entries()).map(([groupKey, groupItems]) => {
        const isMethod = groupBy === 'teachMethod';
        const cfg = isMethod
          ? TEACH_METHOD_CONFIG[groupKey as keyof typeof TEACH_METHOD_CONFIG]
          : null;
        const heading = isMethod
          ? (cfg ? `${cfg.icon} ${cfg.label}` : (groupKey === 'unassigned' ? 'Unassigned' : groupKey))
          : groupKey;

        return (
          <div key={groupKey} className="ci-group">
            <div className="ci-group-heading">
              <span className="ci-group-label">{heading}</span>
              <span className="ci-group-count">{groupItems.length}</span>
            </div>
            {groupItems.map((tp) => {
              const cs = getCategoryStyle(tp.category);
              return (
                <button
                  key={tp.id}
                  type="button"
                  className={`ci-tp-row${drawerAssertionId === tp.id ? ' ci-tp-row-active' : ''}`}
                  onClick={() => onSelect(tp.id)}
                >
                  <span className="ci-tp-cat" style={{ background: cs.color }}>{tp.category}</span>
                  <span className="ci-tp-text">{tp.assertion}</span>
                  {groupBy !== 'sourceName' && (
                    <span className="ci-tp-source">[{tp.sourceName}]</span>
                  )}
                  {tp.session != null && (
                    <span className="ci-tp-session">S{tp.session}</span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Category proportional bar */
function CategoryBar({ categoryCounts }: { categoryCounts: Record<string, number> }) {
  const total = Object.values(categoryCounts).reduce((s, c) => s + c, 0);
  if (total === 0) return null;

  // All categories with nonzero counts, sorted by count descending
  const entries = Object.entries(categoryCounts)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="ci-cat-bar-container">
      <div className="ci-cat-bar">
        {entries.map(([cat, count]) => {
          const meta = CONTENT_CATEGORIES[cat] ?? getCategoryStyle(cat);
          const pct = (count / total) * 100;
          return (
            <div
              key={cat}
              className="ci-cat-bar-segment"
              style={{ width: `${pct}%`, background: meta.color }}
              title={`${meta.label}: ${count} (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>
      <div className="ci-cat-legend">
        {entries.map(([cat, count]) => {
          const meta = CONTENT_CATEGORIES[cat] ?? getCategoryStyle(cat);
          return (
            <div key={cat} className="ci-cat-legend-item">
              <span className="ci-cat-swatch" style={{ background: meta.color }} />
              <span className="ci-cat-legend-label">{meta.label}</span>
              <span className="ci-cat-legend-count">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export function CourseIntelligenceTab({
  courseId,
  detail,
  subjects,
  courseSources,
  courseTeachingProfile,
  contentMethods,
  contentTotal,
  instructionCount = 0,
  unassignedContentCount = 0,
  categoryCounts,
  isOperator,
  onContentRefresh,
}: CourseIntelligenceTabProps) {
  const contentOnlyTotal = contentTotal - instructionCount;

  // ── State ────────────────────────────────────────────
  const [segment, setSegment] = useState<Segment>('genome');
  const [allItems, setAllItems] = useState<TPData[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerAssertionId, setDrawerAssertionId] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [showReExtract, setShowReExtract] = useState(false);

  // ── Lazy fetch assertions when switching to list segments ──
  const needsAssertions = segment !== 'genome';

  useEffect(() => {
    if (!needsAssertions || allItems.length > 0) return;
    setLoading(true);
    fetch(`/api/courses/${courseId}/assertions?limit=500&scope=all`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok && Array.isArray(res.assertions)) {
          setAllItems(res.assertions);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [needsAssertions, courseId, allItems.length]);

  // ── Arrow key navigation ─────────────────────────────
  const handleKeyNav = useCallback((e: KeyboardEvent) => {
    if (!drawerAssertionId || allItems.length === 0) return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const idx = allItems.findIndex((tp) => tp.id === drawerAssertionId);
    const next = e.key === 'ArrowDown'
      ? Math.min(idx + 1, allItems.length - 1)
      : Math.max(idx - 1, 0);
    if (next !== idx) setDrawerAssertionId(allItems[next].id);
  }, [drawerAssertionId, allItems]);

  useEffect(() => {
    if (!drawerAssertionId) return;
    document.addEventListener('keydown', handleKeyNav);
    return () => document.removeEventListener('keydown', handleKeyNav);
  }, [drawerAssertionId, handleKeyNav]);

  // ── Derived data ─────────────────────────────────────
  const { tps, tis } = useMemo(() => {
    const content: TPData[] = [];
    const instructions: TPData[] = [];
    for (const item of allItems) {
      if (INSTRUCTION_SET.has(item.category)) {
        instructions.push(item);
      } else {
        content.push(item);
      }
    }
    return { tps: content, tis: instructions };
  }, [allItems]);

  // ── Sources ──────────────────────────────────────────
  const { courseGuideSources, otherSources, allSources } = useMemo(() => {
    const guides: SourceItem[] = [];
    const others: SourceItem[] = [];

    if (courseSources && courseSources.length > 0) {
      for (const src of courseSources) {
        if (src.documentType === 'COURSE_REFERENCE') {
          guides.push(src);
        } else {
          others.push(src);
        }
      }
    } else {
      const seen = new Set<string>();
      for (const sub of subjects) {
        for (const src of sub.sources || []) {
          if (seen.has(src.id)) continue;
          seen.add(src.id);
          const item: SourceItem = {
            ...src,
            contentAssertionCount: 0,
            instructionAssertionCount: 0,
            sortOrder: 0,
            tags: [],
          };
          if (src.documentType === 'COURSE_REFERENCE') {
            guides.push(item);
          } else {
            others.push(item);
          }
        }
      }
    }
    return { courseGuideSources: guides, otherSources: others, allSources: [...guides, ...others] };
  }, [courseSources, subjects]);

  // ── Auto-assign handler ──────────────────────────────
  const handleBackfill = useCallback(async () => {
    setBackfilling(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/backfill-teach-methods`, { method: 'POST' });
      const data = await res.json();
      if (data.ok && data.updated > 0) {
        setAllItems([]);
        if (onContentRefresh) {
          const bd = await fetch(`/api/courses/${courseId}/content-breakdown?bySubject=true`).then(r => r.json());
          if (bd.ok) {
            onContentRefresh(bd.methods || [], bd.total || 0, bd.instructionCount || 0, bd.unassignedContentCount || 0);
          }
        }
      }
    } catch { /* ignore */ }
    setBackfilling(false);
  }, [courseId, onContentRefresh]);

  const allUnassigned = unassignedContentCount === contentOnlyTotal;
  const visibleMethods = contentMethods.filter((m) => m.count > 0);

  return (
    <div className="ci-container">
      {/* ── ROW 1: Stat Cards ────────────────────────── */}
      <div className="ci-stats-row">
        {visibleMethods.map((m) => {
          const cfg = TEACH_METHOD_CONFIG[m.teachMethod as keyof typeof TEACH_METHOD_CONFIG];
          const icon = cfg?.icon || '?';
          const label = cfg?.label || m.teachMethod;
          return (
            <div key={m.teachMethod} className="ci-stat-card">
              <div className="ci-stat-number">{icon} {m.count}</div>
              <div className="ci-stat-label">{label}</div>
            </div>
          );
        })}
        {contentOnlyTotal > 0 && (
          <div className="ci-stat-card">
            <div className="ci-stat-number">{contentOnlyTotal}</div>
            <div className="ci-stat-label">Teaching Points</div>
          </div>
        )}
        {instructionCount > 0 && (
          <div className="ci-stat-card">
            <div className="ci-stat-number">{instructionCount}</div>
            <div className="ci-stat-label">Instructions</div>
          </div>
        )}
        {unassignedContentCount > 0 && (
          <div className="ci-stat-card ci-stat-card-warn">
            <div className="ci-stat-number">{unassignedContentCount}</div>
            <div className="ci-stat-label">Unassigned</div>
          </div>
        )}
      </div>

      {/* ── ROW 2: Sources + Categories (2-col) ──────── */}
      <div className="ci-two-col">
        {/* Sources */}
        <div className="ci-sources-panel">
          <div className="ci-panel-header">
            <span className="ci-panel-title">
              <BookMarked size={14} /> Sources ({allSources.length})
            </span>
            {isOperator && allSources.length > 0 && (
              <button
                className="hf-btn hf-btn-xs hf-btn-secondary hf-flex hf-items-center hf-gap-xs"
                onClick={() => setShowReExtract(true)}
              >
                <RefreshCw size={12} />
                Re-extract
              </button>
            )}
          </div>
          <div className="ci-source-list">
            {courseGuideSources.map((src) => {
              const info = getDocTypeInfo(src.documentType);
              const Icon = info.icon;
              return (
                <Link key={src.id} href={`/x/content-sources/${src.id}`} className="ci-source-row">
                  <Icon size={14} style={{ color: info.color, flexShrink: 0 }} />
                  <span className="ci-source-name">{src.name}</span>
                  <span className="hf-badge hf-badge-sm" style={{ color: info.color, borderColor: info.color }}>
                    {info.label}
                  </span>
                  <span className="ci-source-count">{src.assertionCount}</span>
                </Link>
              );
            })}
            {otherSources.map((src) => {
              const info = getDocTypeInfo(src.documentType);
              const Icon = info.icon;
              return (
                <Link key={src.id} href={`/x/content-sources/${src.id}`} className="ci-source-row">
                  <Icon size={14} style={{ color: info.color, flexShrink: 0 }} />
                  <span className="ci-source-name">{src.name}</span>
                  <span className="hf-badge hf-badge-sm" style={{ color: info.color, borderColor: info.color }}>
                    {info.label}
                  </span>
                  {src.assertionCount > 0 && (
                    <span className="ci-source-count">{src.assertionCount}</span>
                  )}
                </Link>
              );
            })}
            {allSources.length === 0 && (
              <div className="hf-empty hf-text-sm">No sources uploaded yet</div>
            )}
          </div>
        </div>

        {/* Category bar */}
        <div className="ci-category-panel">
          <div className="ci-panel-header">
            <span className="ci-panel-title">Content Mix</span>
          </div>
          {categoryCounts && Object.keys(categoryCounts).length > 0 ? (
            <CategoryBar categoryCounts={categoryCounts} />
          ) : (
            <div className="hf-empty hf-text-sm">No categories yet</div>
          )}
        </div>
      </div>

      {/* ── Unassigned alert ─────────────────────────── */}
      {isOperator && unassignedContentCount > 0 && (
        <div className={`hf-banner ${allUnassigned ? 'hf-banner-warning' : 'hf-banner-info'}`}>
          <div className="hf-flex hf-items-center hf-gap-sm hf-flex-1">
            <AlertTriangle size={14} className="hf-flex-shrink-0" />
            <span className="hf-text-sm">
              {allUnassigned
                ? `All ${unassignedContentCount} teaching points need a method assigned`
                : `${unassignedContentCount} teaching point${unassignedContentCount === 1 ? '' : 's'} not yet assigned a method`
              }
            </span>
          </div>
          <button
            className="hf-btn hf-btn-xs hf-btn-primary hf-flex hf-items-center hf-gap-xs"
            disabled={backfilling}
            title="Auto-assign teaching methods based on content categories"
            onClick={handleBackfill}
          >
            <Zap size={12} />
            {backfilling ? 'Assigning\u2026' : 'Auto-assign'}
          </button>
        </div>
      )}

      {/* ── ROW 3: Segmented Control + Content ───────── */}
      <SegmentedControl active={segment} onChange={setSegment} />

      <div className="ci-segment-content">
        {segment === 'genome' && (
          <CourseGenomeTab
            courseId={courseId}
            onAssertionSelect={setDrawerAssertionId}
            activeAssertionId={drawerAssertionId}
          />
        )}

        {segment !== 'genome' && (
          loading ? (
            <div className="hf-empty">
              <span className="hf-spinner" />
              <span>Loading assertions...</span>
            </div>
          ) : tps.length === 0 && tis.length === 0 ? (
            <div className="hf-empty">
              <BookMarked size={24} />
              <span>No teaching points yet</span>
              <span className="hf-text-muted hf-text-xs">
                Upload content sources to extract teaching points.
              </span>
            </div>
          ) : (
            <>
              {/* Teaching Points */}
              {tps.length > 0 && (
                <div className="ci-list-section">
                  <div className="ci-list-section-header">
                    <BookMarked size={14} />
                    <span>Teaching Points ({tps.length})</span>
                  </div>
                  <GroupedAssertionList
                    items={tps}
                    groupBy={segment === 'method' ? 'teachMethod' : segment === 'outcome' ? 'learningOutcomeRef' : 'sourceName'}
                    drawerAssertionId={drawerAssertionId}
                    onSelect={setDrawerAssertionId}
                  />
                </div>
              )}

              {/* Teaching Instructions */}
              {tis.length > 0 && (
                <div className="ci-list-section">
                  <div className="ci-list-section-header">
                    <Zap size={14} />
                    <span>Teaching Instructions ({tis.length})</span>
                  </div>
                  <GroupedAssertionList
                    items={tis}
                    groupBy={segment === 'method' ? 'teachMethod' : segment === 'outcome' ? 'learningOutcomeRef' : 'sourceName'}
                    drawerAssertionId={drawerAssertionId}
                    onSelect={setDrawerAssertionId}
                  />
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* ── Shared Drawer ────────────────────────────── */}
      <AssertionDetailDrawer
        courseId={courseId}
        assertionId={drawerAssertionId}
        onClose={() => setDrawerAssertionId(null)}
      />

      {/* ── Re-extract Modal ─────────────────────────── */}
      {showReExtract && (
        <ReExtractModal
          courseId={courseId}
          sources={allSources}
          onClose={() => setShowReExtract(false)}
          onComplete={async () => {
            if (onContentRefresh) {
              try {
                const bd = await fetch(`/api/courses/${courseId}/content-breakdown?bySubject=true`).then(r => r.json());
                if (bd.ok) {
                  onContentRefresh(bd.methods || [], bd.total || 0, bd.instructionCount || 0, bd.unassignedContentCount || 0);
                }
              } catch { /* ignore */ }
            }
          }}
        />
      )}
    </div>
  );
}
