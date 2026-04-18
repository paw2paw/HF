'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  BookMarked, AlertTriangle, Zap, RefreshCw, Target,
} from 'lucide-react';
import { TeachMethodStats } from '@/components/shared/TeachMethodStats';
import { getDocTypeInfo } from '@/lib/doc-type-icons';
import { CONTENT_CATEGORIES, CATEGORY_ORDER } from '@/lib/content-categories';
import { INSTRUCTION_CATEGORIES, TEACH_METHOD_CONFIG } from '@/lib/content-trust/resolve-config';
import { ReExtractModal } from './ReExtractModal';
import { SectionHeader } from './SectionHeader';
import { AssertionDetailDrawer } from '@/components/shared/AssertionDetailDrawer';
import { getCategoryStyle } from '@/lib/content-categories';

// ── Types ──────────────────────────────────────────────

type SourceDetail = {
  id: string;
  name: string;
  documentType: string;
  extractorVersion: number | null;
  assertionCount: number;
  linkedSourceId: string | null;
  linkedSourceName: string | null;
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
  sources?: SourceDetail[];
};

type MethodBreakdown = { teachMethod: string; count: number; reviewed: number };

export type CourseWhatTabProps = {
  courseId: string;
  detail: {
    id: string;
    name: string;
    config?: Record<string, unknown> | null;
    domain: { id: string; name: string; slug: string };
  };
  subjects: SubjectSummary[];
  /** Flat source list from PlaybookSource (no double-counting) */
  courseSources?: Array<{
    id: string; name: string; documentType: string;
    extractorVersion: number | null; assertionCount: number;
    contentAssertionCount: number; instructionAssertionCount: number;
    sortOrder: number; tags: string[];
  }>;
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

// ── Types (internal) ───────────────────────────────────

type TPData = {
  id: string;
  assertion: string;
  category: string;
  teachMethod: string | null;
  learningOutcomeRef: string | null;
  sourceName: string;
  session?: number | null;
};

// ── AssertionList ──────────────────────────────────────
// Reusable list of assertions grouped by learningOutcomeRef.

function AssertionList({ items, drawerAssertionId, onSelect }: {
  items: TPData[];
  drawerAssertionId: string | null;
  onSelect: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const groups = new Map<string, TPData[]>();
    for (const tp of items) {
      const key = tp.learningOutcomeRef || 'Unassigned';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tp);
    }
    return groups;
  }, [items]);

  return (
    <div className="hf-flex-col hf-gap-sm cwt-expand-scroll">
      {Array.from(grouped.entries()).map(([loRef, groupItems]) => (
        <div key={loRef}>
          <div className="hf-text-xs hf-text-bold hf-text-muted hf-mb-xs hf-pl-xs">
            {loRef}
            <span className="hf-text-placeholder hf-ml-sm">({groupItems.length})</span>
          </div>
          {groupItems.map((tp) => {
            const cs = getCategoryStyle(tp.category);
            return (
              <button
                key={tp.id}
                type="button"
                className={`hf-btn-reset hf-flex hf-items-start hf-gap-xs hf-text-xs cwt-tp-row${drawerAssertionId === tp.id ? ' cwt-tp-row-active' : ''}`}
                onClick={() => onSelect(tp.id)}
              >
                <span
                  className="hf-micro-badge-sm hf-flex-shrink-0 cwt-tp-cat"
                  style={{ background: cs.color }}
                >
                  {tp.category}
                </span>
                <span className="hf-flex-1 hf-text-secondary hf-text-left">{tp.assertion}</span>
                <span className="hf-text-placeholder hf-flex-shrink-0">[{tp.sourceName}]</span>
                {tp.session != null && (
                  <span className="hf-micro-badge-sm hf-flex-shrink-0 cwt-tp-session">
                    S{tp.session}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── MethodGroupedList ─────────────────────────────────
// TPs grouped by teachMethod, rendered when Teaching Methods is expanded.

function MethodGroupedList({ tpsByMethod, drawerAssertionId, onSelect }: {
  tpsByMethod: Map<string, TPData[]>;
  drawerAssertionId: string | null;
  onSelect: (id: string) => void;
}) {
  // Render known methods first (in config order), then unassigned
  const methodKeys = Object.keys(TEACH_METHOD_CONFIG) as Array<keyof typeof TEACH_METHOD_CONFIG>;

  return (
    <div className="cwt-expand-scroll">
      {methodKeys.map((method) => {
        const items = tpsByMethod.get(method);
        if (!items || items.length === 0) return null;
        const cfg = TEACH_METHOD_CONFIG[method];
        return (
          <div key={method} className="hf-mb-sm">
            <div className="cwt-method-heading">
              <span className="hf-text-sm">{cfg.icon}</span>
              <span className="hf-text-xs hf-text-bold hf-text-secondary">
                {cfg.label}
              </span>
              <span className="hf-text-xs hf-text-placeholder">({items.length})</span>
            </div>
            {items.map((tp) => {
              const cs = getCategoryStyle(tp.category);
              return (
                <button
                  key={tp.id}
                  type="button"
                  className={`hf-btn-reset hf-flex hf-items-start hf-gap-xs hf-text-xs cwt-tp-row${drawerAssertionId === tp.id ? ' cwt-tp-row-active' : ''}`}
                  onClick={() => onSelect(tp.id)}
                >
                  <span
                    className="hf-micro-badge-sm hf-flex-shrink-0 cwt-tp-cat"
                    style={{ background: cs.color }}
                  >
                    {tp.category}
                  </span>
                  <span className="hf-flex-1 hf-text-secondary hf-text-left">{tp.assertion}</span>
                  <span className="hf-text-placeholder hf-flex-shrink-0">[{tp.sourceName}]</span>
                </button>
              );
            })}
          </div>
        );
      })}

      {/* Unassigned group */}
      {(() => {
        const unassigned = tpsByMethod.get('unassigned');
        if (!unassigned || unassigned.length === 0) return null;
        return (
          <div className="hf-mb-sm">
            <div className="cwt-method-heading">
              <span className="hf-text-sm">⚠️</span>
              <span className="hf-text-xs hf-text-bold hf-text-secondary">Unassigned</span>
              <span className="hf-text-xs hf-text-placeholder">({unassigned.length})</span>
            </div>
            {unassigned.map((tp) => {
              const cs = getCategoryStyle(tp.category);
              return (
                <button
                  key={tp.id}
                  type="button"
                  className={`hf-btn-reset hf-flex hf-items-start hf-gap-xs hf-text-xs cwt-tp-row${drawerAssertionId === tp.id ? ' cwt-tp-row-active' : ''}`}
                  onClick={() => onSelect(tp.id)}
                >
                  <span
                    className="hf-micro-badge-sm hf-flex-shrink-0 cwt-tp-cat"
                    style={{ background: cs.color }}
                  >
                    {tp.category}
                  </span>
                  <span className="hf-flex-1 hf-text-secondary hf-text-left">{tp.assertion}</span>
                  <span className="hf-text-placeholder hf-flex-shrink-0">[{tp.sourceName}]</span>
                </button>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ── ContentHeroCard ───────────────────────────────────
// Compact nav strip with clickable stat chips.

function ContentHeroCard({ contentMethods, contentOnlyTotal, instructionCount, unassignedContentCount, onScrollTo }: {
  contentMethods: MethodBreakdown[];
  contentOnlyTotal: number;
  instructionCount: number;
  unassignedContentCount: number;
  onScrollTo: (section: 'tm' | 'tp' | 'ti') => void;
}) {
  if (contentOnlyTotal === 0 && instructionCount === 0) return null;

  const visibleMethods = contentMethods.filter((m) => m.count > 0);

  return (
    <div className="cwt-hero hf-mb-lg">
      <div className="hf-flex hf-gap-sm hf-flex-wrap">
        {/* Method chips → scroll to Teaching Methods */}
        {visibleMethods.map((m) => {
          const cfg = TEACH_METHOD_CONFIG[m.teachMethod as keyof typeof TEACH_METHOD_CONFIG];
          const icon = cfg?.icon || '?';
          const label = cfg?.label || m.teachMethod;
          return (
            <button
              key={m.teachMethod}
              type="button"
              className="cwt-hero-chip"
              onClick={() => onScrollTo('tm')}
            >
              <span className="hf-text-sm hf-text-bold">{icon} {m.count}</span>
              <span className="hf-text-xs hf-text-muted">{label}</span>
            </button>
          );
        })}

        {/* Unassigned chip → scroll to Teaching Methods */}
        {unassignedContentCount > 0 && (
          <button
            type="button"
            className="cwt-hero-chip"
            onClick={() => onScrollTo('tm')}
          >
            <span className="hf-text-sm hf-text-bold">⚠️ {unassignedContentCount}</span>
            <span className="hf-text-xs hf-text-muted">Unassigned</span>
          </button>
        )}

        {/* TP chip → scroll to Teaching Points */}
        <button
          type="button"
          className="cwt-hero-chip"
          onClick={() => onScrollTo('tp')}
        >
          <span className="hf-text-sm hf-text-bold">📚 {contentOnlyTotal}</span>
          <span className="hf-text-xs hf-text-muted">Teaching Points</span>
        </button>

        {/* TI chip → scroll to Teaching Instructions */}
        {instructionCount > 0 && (
          <button
            type="button"
            className="cwt-hero-chip"
            onClick={() => onScrollTo('ti')}
          >
            <span className="hf-text-sm hf-text-bold">⚙️ {instructionCount}</span>
            <span className="hf-text-xs hf-text-muted">Instructions</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export function CourseWhatTab({
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
}: CourseWhatTabProps) {
  const contentOnlyTotal = contentTotal - instructionCount;

  // ── State ────────────────────────────────────────────
  const [backfilling, setBackfilling] = useState(false);
  const [showReExtract, setShowReExtract] = useState(false);
  const [allItems, setAllItems] = useState<TPData[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedTM, setExpandedTM] = useState(false);
  const [expandedTP, setExpandedTP] = useState(false);
  const [expandedTI, setExpandedTI] = useState(false);
  const [drawerAssertionId, setDrawerAssertionId] = useState<string | null>(null);

  // ── Refs for scroll targets ──────────────────────────
  const tmRef = useRef<HTMLDivElement>(null);
  const tpRef = useRef<HTMLDivElement>(null);
  const tiRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((section: 'tm' | 'tp' | 'ti') => {
    const refMap = { tm: tmRef, tp: tpRef, ti: tiRef };
    const setterMap = { tm: setExpandedTM, tp: setExpandedTP, ti: setExpandedTI };
    setterMap[section](true);
    // Wait for expansion to render, then scroll
    requestAnimationFrame(() => {
      refMap[section].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // ── Lazy fetch assertions ────────────────────────────
  const anyExpanded = expandedTM || expandedTP || expandedTI;

  useEffect(() => {
    if (!anyExpanded || allItems.length > 0) return;
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
  }, [anyExpanded, courseId, allItems.length]);

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

  const tpsByMethod = useMemo(() => {
    const groups = new Map<string, TPData[]>();
    for (const tp of tps) {
      const key = tp.teachMethod ?? 'unassigned';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tp);
    }
    return groups;
  }, [tps]);

  const tpCount = allItems.length > 0 ? tps.length : null;
  const tiCount = allItems.length > 0 ? tis.length : null;

  // ── Auto-assign handler ──────────────────────────────
  const handleBackfill = useCallback(async () => {
    setBackfilling(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/backfill-teach-methods`, { method: 'POST' });
      const data = await res.json();
      if (data.ok && data.updated > 0) {
        // Clear cached assertions so next expand re-fetches
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

  // ── Collect sources ──────────────────────────────────
  const { courseGuideSources, otherSources } = useMemo(() => {
    const guides: SourceDetail[] = [];
    const others: SourceDetail[] = [];

    if (courseSources && courseSources.length > 0) {
      for (const src of courseSources) {
        const d: SourceDetail = {
          id: src.id,
          name: src.name,
          documentType: src.documentType,
          extractorVersion: src.extractorVersion,
          assertionCount: src.assertionCount,
          linkedSourceId: null,
          linkedSourceName: null,
        };
        if (src.documentType === 'COURSE_REFERENCE') {
          guides.push(d);
        } else {
          others.push(d);
        }
      }
    } else {
      const seen = new Set<string>();
      for (const sub of subjects) {
        for (const src of sub.sources || []) {
          if (seen.has(src.id)) continue;
          seen.add(src.id);
          if (src.documentType === 'COURSE_REFERENCE') {
            guides.push(src);
          } else {
            others.push(src);
          }
        }
      }
    }
    return { courseGuideSources: guides, otherSources: others };
  }, [courseSources, subjects]);

  const allSources = useMemo(
    () => [...courseGuideSources, ...otherSources],
    [courseGuideSources, otherSources],
  );

  const allUnassigned = unassignedContentCount === contentOnlyTotal;

  return (
    <>
      {/* ── Course Guide ──────────────────────────────── */}
      {courseGuideSources.length > 0 && (
        <>
          <SectionHeader
            title="Course Guide"
            icon={getDocTypeInfo('COURSE_REFERENCE').icon}
            actions={isOperator && otherSources.length === 0 && allSources.length > 0 ? (
              <button
                className="hf-btn hf-btn-xs hf-btn-secondary hf-flex hf-items-center hf-gap-xs"
                onClick={() => setShowReExtract(true)}
              >
                <RefreshCw size={12} />
                Re-extract
              </button>
            ) : undefined}
          />
          <div className="hf-card-compact hf-mb-lg" style={{ borderLeft: '3px solid var(--badge-purple-text)' }}>
            {courseGuideSources.map((src) => {
              const info = getDocTypeInfo(src.documentType);
              const Icon = info.icon;
              return (
                <Link key={src.id} href={`/x/content-sources/${src.id}`} className="hf-flex hf-items-center hf-gap-sm hf-link-row">
                  <Icon size={16} style={{ color: info.color, flexShrink: 0 }} />
                  <div className="hf-flex-1">
                    <div className="hf-text-sm hf-text-secondary">{src.name}</div>
                    <div className="hf-text-xs hf-text-muted">
                      Defines your teaching approach, skills framework, and session flow
                    </div>
                  </div>
                  <span className="hf-badge hf-badge-sm" style={{ color: info.color, borderColor: info.color }}>
                    {info.label}
                  </span>
                  <span className="hf-text-xs hf-text-placeholder">{src.assertionCount} rules</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* ── Other Sources ────────────────────────────── */}
      {otherSources.length > 0 && (
        <>
          <SectionHeader
            title="Sources"
            icon={BookMarked}
            actions={isOperator && allSources.length > 0 ? (
              <button
                className="hf-btn hf-btn-xs hf-btn-secondary hf-flex hf-items-center hf-gap-xs"
                onClick={() => setShowReExtract(true)}
              >
                <RefreshCw size={12} />
                Re-extract
              </button>
            ) : undefined}
          />
          <div className="hf-card-compact hf-mb-lg">
            {otherSources.map((src) => {
              const info = getDocTypeInfo(src.documentType);
              const Icon = info.icon;
              return (
                <Link key={src.id} href={`/x/content-sources/${src.id}`} className="hf-flex hf-items-center hf-gap-sm hf-link-row">
                  <Icon size={16} style={{ color: info.color, flexShrink: 0 }} />
                  <div className="hf-flex-1">
                    <div className="hf-text-sm hf-text-secondary">{src.name}</div>
                  </div>
                  <span className="hf-badge hf-badge-sm" style={{ color: info.color, borderColor: info.color }}>
                    {info.label}
                  </span>
                  {src.assertionCount > 0 && (
                    <span className="hf-text-xs hf-text-placeholder">{src.assertionCount} rules</span>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* ── Content Hero Card ────────────────────────── */}
      <ContentHeroCard
        contentMethods={contentMethods}
        contentOnlyTotal={contentOnlyTotal}
        instructionCount={instructionCount}
        unassignedContentCount={unassignedContentCount}
        onScrollTo={scrollTo}
      />

      {/* ── Teaching Methods (expandable) ────────────── */}
      {contentOnlyTotal > 0 && (
        <div ref={tmRef} className="hf-mb-lg">
          <button
            onClick={() => setExpandedTM(!expandedTM)}
            className="hf-btn-reset hf-flex hf-items-center hf-gap-sm hf-w-full hf-section-divider hf-mb-sm"
          >
            <Target size={16} className="hf-text-muted" />
            <span className="hf-text-xs hf-text-bold hf-text-muted hf-uppercase hf-flex-1 hf-text-left">
              Teaching Methods ({contentMethods.filter(m => m.count > 0).length})
            </span>
            {!expandedTM && (
              <TeachMethodStats methods={contentMethods} total={contentOnlyTotal} compact />
            )}
            <span className="hf-text-xs hf-text-placeholder">{expandedTM ? '▼' : '▶'}</span>
          </button>

          {expandedTM && (
            loading ? (
              <div className="hf-text-xs hf-text-muted hf-p-sm">Loading...</div>
            ) : tps.length === 0 ? (
              <div className="hf-text-xs hf-text-muted hf-p-sm">No teaching points</div>
            ) : (
              <MethodGroupedList tpsByMethod={tpsByMethod} drawerAssertionId={drawerAssertionId} onSelect={setDrawerAssertionId} />
            )
          )}
        </div>
      )}

      {/* ── Teaching Points (expandable) ─────────────── */}
      {(contentOnlyTotal > 0 || (allItems.length > 0 && tps.length > 0)) && (
        <div ref={tpRef} className="hf-mb-lg">
          <button
            onClick={() => setExpandedTP(!expandedTP)}
            className="hf-btn-reset hf-flex hf-items-center hf-gap-sm hf-w-full hf-section-divider hf-mb-sm"
          >
            <BookMarked size={16} className="hf-text-muted" />
            <span className="hf-text-xs hf-text-bold hf-text-muted hf-uppercase hf-flex-1 hf-text-left">
              Teaching Points ({tpCount ?? contentOnlyTotal})
            </span>
            <span className="hf-text-xs hf-text-placeholder">{expandedTP ? '▼' : '▶'}</span>
          </button>

          {expandedTP && (
            loading ? (
              <div className="hf-text-xs hf-text-muted hf-p-sm">Loading...</div>
            ) : tps.length === 0 ? (
              <div className="hf-text-xs hf-text-muted hf-p-sm">No teaching points</div>
            ) : (
              <AssertionList items={tps} drawerAssertionId={drawerAssertionId} onSelect={setDrawerAssertionId} />
            )
          )}
        </div>
      )}

      {/* ── Teaching Instructions (expandable) ────────── */}
      {(instructionCount > 0 || (allItems.length > 0 && tis.length > 0)) && (
        <div ref={tiRef} className="hf-mb-lg">
          <button
            onClick={() => setExpandedTI(!expandedTI)}
            className="hf-btn-reset hf-flex hf-items-center hf-gap-sm hf-w-full hf-section-divider hf-mb-sm"
          >
            <Zap size={16} className="hf-text-muted" />
            <span className="hf-text-xs hf-text-bold hf-text-muted hf-uppercase hf-flex-1 hf-text-left">
              Teaching Instructions ({tiCount ?? instructionCount})
            </span>
            <span className="hf-text-xs hf-text-placeholder">{expandedTI ? '▼' : '▶'}</span>
          </button>

          {expandedTI && (
            loading ? (
              <div className="hf-text-xs hf-text-muted hf-p-sm">Loading...</div>
            ) : tis.length === 0 ? (
              <div className="hf-text-xs hf-text-muted hf-p-sm">No teaching instructions</div>
            ) : (
              <AssertionList items={tis} drawerAssertionId={drawerAssertionId} onSelect={setDrawerAssertionId} />
            )
          )}
        </div>
      )}

      {/* ── Category breakdown pills ─────────────────── */}
      {categoryCounts && Object.keys(categoryCounts).length > 0 && (
        <div className="hf-mb-lg">
          <div className="hf-category-label hf-mb-xs">
            By Category
          </div>
          <div className="hf-flex hf-flex-wrap hf-gap-xs">
            {CATEGORY_ORDER
              .filter(cat => (categoryCounts[cat] ?? 0) > 0)
              .map(cat => {
                const meta = CONTENT_CATEGORIES[cat];
                return (
                  <span
                    key={cat}
                    className="hf-badge"
                    style={{
                      color: meta.color,
                      background: meta.bg,
                    }}
                  >
                    {meta.label}
                    <span className="hf-text-placeholder hf-ml-xs">{categoryCounts[cat]}</span>
                  </span>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Unassigned alert + auto-assign ───────────── */}
      {isOperator && unassignedContentCount > 0 && (
        <div className={`hf-banner ${allUnassigned ? 'hf-banner-warning' : 'hf-banner-info'} hf-mb-lg`}>
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

      {/* ── Assertion Detail Drawer ──────────────────── */}
      <AssertionDetailDrawer
        courseId={courseId}
        assertionId={drawerAssertionId}
        onClose={() => setDrawerAssertionId(null)}
      />

      {/* ── Re-extract Modal ────────────────────────── */}
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
    </>
  );
}
