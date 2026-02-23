'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { BookOpen, Users, FileText, Plus } from 'lucide-react';
import { useTerminology } from '@/contexts/TerminologyContext';
import { useStepFlow } from '@/contexts';
import { useWizardResume } from '@/hooks/useWizardResume';
import { WizardResumeBanner } from '@/components/shared/WizardResumeBanner';
import { CourseSetupWizard } from './_components/CourseSetupWizard';
import { StatusBadge, DomainPill } from '@/src/components/shared/EntityPill';
import { FancySelect } from '@/components/shared/FancySelect';
import { EditableTitle } from '@/components/shared/EditableTitle';
import { AdvancedBanner } from '@/components/shared/AdvancedBanner';

type Domain = { id: string; name: string };

type CourseListItem = {
  id: string;
  name: string;
  description: string | null;
  domain: Domain;
  studentCount: number;
  specCount: number;
  status: string;
  version: string;
  createdAt: string;
};

type PlaybookDetail = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  version: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  domain: Domain & { slug: string };
  items: Array<{
    id: string;
    itemType: string;
    isEnabled: boolean;
    sortOrder: number;
    spec: {
      id: string;
      slug: string;
      name: string;
      scope: string;
      outputType: string;
      specRole: string | null;
    } | null;
  }>;
  _count: { items: number };
};

const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

const statusColors: Record<string, { bg: string; text: string; icon: string; desc: string }> = {
  DRAFT: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', icon: '\u{1F4DD}', desc: 'Work in progress' },
  PUBLISHED: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', icon: '\u2705', desc: 'Active and in use' },
  ARCHIVED: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)', icon: '\u{1F4E6}', desc: 'No longer active' },
};

const statusMap: Record<string, 'draft' | 'active' | 'archived'> = {
  draft: 'draft',
  published: 'active',
  archived: 'archived',
};

const outputTypeColors: Record<string, { bg: string; text: string }> = {
  LEARN: { bg: 'var(--badge-violet-bg)', text: 'var(--badge-violet-text)' },
  MEASURE: { bg: 'var(--badge-green-bg)', text: 'var(--badge-green-text)' },
  ADAPT: { bg: 'var(--badge-yellow-bg)', text: 'var(--badge-yellow-text)' },
  COMPOSE: { bg: 'var(--badge-pink-bg)', text: 'var(--badge-pink-text)' },
  AGGREGATE: { bg: 'var(--badge-indigo-bg)', text: 'var(--badge-indigo-text)' },
  REWARD: { bg: 'var(--badge-amber-bg)', text: 'var(--badge-amber-text)' },
};

export default function CoursesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id');
  const { data: session } = useSession();
  const isOperator = ['OPERATOR', 'EDUCATOR', 'ADMIN', 'SUPERADMIN'].includes((session?.user?.role as string) || '');
  const { terms, plural } = useTerminology();
  const { state, isActive: isSetupFlowActive, startFlow } = useStepFlow();
  const { pendingTask, isLoading: resumeLoading } = useWizardResume('course_setup');

  // List state
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedDomain, setSelectedDomain] = useState('');

  // Detail state
  const [detail, setDetail] = useState<PlaybookDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Actions state
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Wizard
  const showWizard = isSetupFlowActive && state?.flowId === 'create-course';

  const loadCourses = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/courses');
      if (!res.ok) throw new Error('Failed to load courses');
      const data = await res.json();
      setCourses(data.courses || []);
      setDomains(data.domains || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  // Fetch detail when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    fetch(`/api/playbooks/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setDetail(data.playbook);
        else setDetailError(data.error);
        setDetailLoading(false);
      })
      .catch((e) => {
        setDetailError(e.message);
        setDetailLoading(false);
      });
  }, [selectedId]);

  // Filter courses (client-side)
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (search) {
        const s = search.toLowerCase();
        const matchesSearch = c.name.toLowerCase().includes(s) || c.description?.toLowerCase().includes(s) || c.domain.name.toLowerCase().includes(s);
        if (!matchesSearch) return false;
      }
      if (selectedStatuses.size > 0 && !selectedStatuses.has(c.status.toUpperCase())) return false;
      if (selectedDomain && selectedDomain !== c.domain.id) return false;
      return true;
    });
  }, [courses, search, selectedStatuses, selectedDomain]);

  const selectCourse = (id: string) => {
    router.push(`/x/courses?id=${id}`, { scroll: false });
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  // Detail actions
  const handlePublish = async () => {
    if (!detail) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/playbooks/${detail.id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setDetail(data.playbook);
        loadCourses();
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleArchive = async () => {
    if (!detail) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/playbooks/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });
      const data = await res.json();
      if (data.ok) {
        setDetail((prev) => prev ? { ...prev, status: 'ARCHIVED' } : prev);
        loadCourses();
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async () => {
    if (!detail) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/playbooks/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT' }),
      });
      const data = await res.json();
      if (data.ok) {
        setDetail((prev) => prev ? { ...prev, status: 'DRAFT' } : prev);
        loadCourses();
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/playbooks/${detail.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        router.push('/x/courses', { scroll: false });
        loadCourses();
        setShowDeleteConfirm(false);
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  // Wizard steps
  const COURSE_STEPS_FALLBACK = [
    { id: 'intent', label: 'Intent', activeLabel: 'Setting Intent' },
    { id: 'content', label: 'Content', activeLabel: 'Adding Content' },
    { id: 'lesson-plan', label: 'Lesson Plan', activeLabel: 'Planning Lessons' },
    { id: 'course-config', label: 'Configure AI', activeLabel: 'Configuring AI' },
    { id: 'students', label: 'Students', activeLabel: 'Adding Students' },
    { id: 'done', label: 'Launch', activeLabel: 'Creating Course' },
  ];

  const loadWizardSteps = async () => {
    try {
      const response = await fetch('/api/wizard-steps?wizard=course');
      const data = await response.json();
      if (data.ok && data.steps?.length > 0) {
        return data.steps.map((step: any) => ({
          id: step.id,
          label: step.label,
          activeLabel: step.activeLabel,
        }));
      }
    } catch (err) {
      console.warn('[CoursesPage] Failed to load spec steps, using defaults', err);
    }
    return COURSE_STEPS_FALLBACK;
  };

  const handleNewCourse = async () => {
    const stepsToUse = await loadWizardSteps();
    let taskId: string | undefined;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType: 'course_setup', currentStep: 0, context: { _wizardStep: 0 } }),
      });
      const data = await res.json();
      if (data.ok) taskId = data.taskId;
    } catch {
      // Continue without DB persistence
    }
    startFlow({
      flowId: 'create-course',
      steps: stepsToUse,
      returnPath: '/x/courses',
      taskType: 'course_setup',
      taskId,
    });
  };

  const handleResumeCourse = async () => {
    if (!pendingTask) return;
    const stepsToUse = await loadWizardSteps();
    const ctx = pendingTask.context || {};
    startFlow({
      flowId: 'create-course',
      steps: stepsToUse,
      returnPath: '/x/courses',
      taskType: 'course_setup',
      taskId: pendingTask.id,
      initialData: ctx,
      initialStep: ctx._wizardStep ?? 0,
    });
  };

  const handleDiscardResume = async () => {
    if (pendingTask) {
      try {
        await fetch(`/api/tasks?taskId=${pendingTask.id}`, { method: 'DELETE' });
      } catch { /* ignore */ }
    }
    await handleNewCourse();
  };

  // Resume banner (shown before wizard or list)
  if (!showWizard && !resumeLoading && pendingTask) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ paddingTop: 64 }}>
          <WizardResumeBanner
            task={pendingTask}
            onResume={handleResumeCourse}
            onDiscard={handleDiscardResume}
            label="Course Setup"
          />
        </div>
      </div>
    );
  }

  // Wizard mode
  if (showWizard) {
    return (
      <CourseSetupWizard
        onComplete={async () => {
          await loadCourses();
        }}
      />
    );
  }

  // Group detail items by scope
  const groupedItems = detail?.items.reduce<Record<string, PlaybookDetail['items']>>((acc, item) => {
    if (!item.spec) return acc;
    const scope = item.spec.scope || 'OTHER';
    if (!acc[scope]) acc[scope] = [];
    acc[scope].push(item);
    return acc;
  }, {});

  const FilterPill = ({
    label, isActive, colors, onClick, icon, tooltip,
  }: {
    label: string; isActive: boolean; colors: { bg: string; text: string }; onClick: () => void; icon?: string; tooltip?: string;
  }) => (
    <button
      onClick={onClick}
      title={tooltip}
      className="hf-filter-pill"
      style={isActive ? {
        border: `1px solid color-mix(in srgb, ${colors.text} 25%, transparent)`,
        background: colors.bg,
        color: colors.text,
      } : undefined}
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AdvancedBanner />

      {/* Header + Filters */}
      <div className="hf-card-compact hf-mb-md" style={{ borderRadius: 8, position: 'relative', zIndex: 2 }}>
        <div className="hf-flex hf-flex-between" style={{ marginBottom: 10 }}>
          <h1 className="hf-section-title">{plural('playbook')}</h1>
          {isOperator && (
            <button onClick={handleNewCourse} className="hf-btn-sm hf-btn-primary">
              <Plus size={14} style={{ marginRight: 4 }} />
              New {terms.playbook}
            </button>
          )}
        </div>

        <div className="hf-flex hf-flex-wrap hf-gap-lg hf-items-center">
          {/* Search */}
          <input
            type="text"
            placeholder={`Search ${plural('playbook').toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="hf-input"
            style={{ padding: '6px 10px', borderRadius: 6, width: 180, fontSize: 12, borderColor: 'var(--border-strong)' }}
          />

          <div className="hf-divider-v" />

          {/* Status Pills */}
          <div className="hf-flex hf-gap-sm hf-items-center">
            <span className="hf-text-xs hf-text-muted hf-text-bold">Status</span>
            {selectedStatuses.size > 0 && (
              <button onClick={() => setSelectedStatuses(new Set())} className="hf-clear-btn" title="Clear filter">&times;</button>
            )}
            <div className="hf-flex hf-gap-xs">
              {STATUSES.map((status) => {
                const config = statusColors[status];
                return (
                  <FilterPill
                    key={status}
                    label={status}
                    icon={config.icon}
                    tooltip={config.desc}
                    isActive={selectedStatuses.has(status)}
                    colors={config}
                    onClick={() => toggleStatus(status)}
                  />
                );
              })}
            </div>
          </div>

          {/* Domain Filter */}
          {domains.length > 1 && (
            <>
              <div className="hf-divider-v" />
              <div className="hf-flex hf-gap-sm hf-items-center">
                <span className="hf-text-xs hf-text-muted hf-text-bold">{terms.domain}</span>
                <FancySelect
                  value={selectedDomain}
                  onChange={setSelectedDomain}
                  placeholder={`All ${plural('domain').toLowerCase()}`}
                  clearable
                  options={domains.map((d) => ({ value: d.id, label: d.name }))}
                  style={{ width: 180 }}
                />
              </div>
            </>
          )}

          {/* Results count */}
          <span className="hf-text-xs hf-text-muted hf-text-bold">
            {filteredCourses.length} of {courses.length}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="hf-banner hf-banner-error hf-mb-md" style={{ borderRadius: 8 }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hf-text-xs" style={{ marginLeft: 'auto', textDecoration: 'underline', color: 'inherit' }}>Dismiss</button>
        </div>
      )}

      {/* Master-Detail Layout */}
      <div className="hf-flex hf-gap-lg hf-flex-1" style={{ minHeight: 0, overflow: 'hidden', alignItems: 'stretch' }}>
        {/* List Panel */}
        <div className="hf-master-list">
          {loading ? (
            <div className="hf-text-center hf-text-muted" style={{ padding: 40 }}>
              <div className="hf-spinner" />
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="hf-empty-compact" style={{ border: '1px solid var(--border-default)', borderRadius: 12 }}>
              <div style={{ fontSize: 48 }} className="hf-mb-md">
                <BookOpen size={48} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div className="hf-heading-lg hf-text-secondary hf-mb-md">
                {search || selectedStatuses.size > 0 || selectedDomain
                  ? `No ${plural('playbook').toLowerCase()} match filters`
                  : `No ${plural('playbook').toLowerCase()} yet`}
              </div>
              {isOperator && !search && selectedStatuses.size === 0 && !selectedDomain && (
                <button onClick={handleNewCourse} className="hf-btn hf-btn-primary">
                  <Plus size={14} style={{ marginRight: 4 }} />
                  Create First {terms.playbook}
                </button>
              )}
            </div>
          ) : (
            <div className="hf-flex-col hf-gap-sm">
              {filteredCourses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => selectCourse(course.id)}
                  className={`hf-master-item${selectedId === course.id ? ' hf-master-item-selected' : ''}${course.status === 'archived' ? ' hf-master-item-inactive' : ''}`}
                >
                  <div className="hf-flex hf-gap-sm hf-mb-sm hf-items-center">
                    <h3 className="hf-heading-sm hf-mb-0" style={{ flex: 1 }}>{course.name}</h3>
                    <StatusBadge status={statusMap[course.status] || 'draft'} size="compact" />
                  </div>
                  <p className="hf-text-xs hf-text-muted" style={{ margin: '0 0 8px', lineHeight: 1.4 }}>
                    {course.domain.name}
                  </p>
                  <div className="hf-flex hf-gap-md hf-text-xs hf-text-muted hf-items-center">
                    <span><strong>{course.studentCount}</strong> {plural('caller').toLowerCase()}</span>
                    <span><strong>{course.specCount}</strong> specs</span>
                    <span className="hf-text-xs hf-text-placeholder">v{course.version}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="hf-master-detail-right">
          {!selectedId ? (
            <div className="hf-flex-center hf-text-placeholder" style={{ height: '100%' }}>
              <div className="hf-text-center">
                <BookOpen size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
                <div className="hf-text-md">Select a {terms.playbook.toLowerCase()} to view details</div>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="hf-text-center hf-text-muted" style={{ padding: 40 }}>
              <div className="hf-spinner" />
            </div>
          ) : detailError || !detail ? (
            <div className="hf-banner hf-banner-error" style={{ borderRadius: 8 }}>
              {detailError || `${terms.playbook} not found`}
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="hf-flex hf-flex-between hf-mb-lg hf-items-start">
                <div>
                  <div className="hf-flex hf-gap-md hf-items-center hf-mb-sm">
                    <EditableTitle
                      value={detail.name}
                      as="h2"
                      onSave={async (newName) => {
                        const res = await fetch(`/api/playbooks/${detail.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newName }),
                        });
                        const data = await res.json();
                        if (!data.ok) throw new Error(data.error);
                        setDetail((prev) => prev ? { ...prev, name: newName } : prev);
                        loadCourses();
                      }}
                    />
                    <StatusBadge status={statusMap[detail.status.toLowerCase()] || 'draft'} />
                  </div>
                  <div className="hf-flex hf-gap-sm hf-items-center">
                    <DomainPill label={detail.domain.name} href={`/x/domains?id=${detail.domain.id}`} size="compact" />
                    <span className="hf-text-xs hf-text-placeholder">v{detail.version}</span>
                  </div>
                </div>
                <Link
                  href={`/x/playbooks/${detail.id}`}
                  className="hf-btn-sm hf-btn-primary hf-nowrap"
                >
                  Open Editor
                </Link>
              </div>

              {/* Description */}
              {detail.description && (
                <p className="hf-text-sm hf-text-muted hf-mb-lg" style={{ lineHeight: 1.6 }}>
                  {detail.description}
                </p>
              )}

              {/* Stats */}
              <div className="hf-flex hf-gap-lg hf-mb-lg">
                <div className="hf-stat-card" style={{ minWidth: 90, gap: 0 }}>
                  <div className="hf-stat-value-sm">{detail._count.items}</div>
                  <div className="hf-text-xs hf-text-muted">Specs</div>
                </div>
                <div className="hf-stat-card" style={{ minWidth: 90, gap: 0 }}>
                  <div className="hf-stat-value-sm">{detail.items.filter((i) => i.isEnabled).length}</div>
                  <div className="hf-text-xs hf-text-muted">Enabled</div>
                </div>
                {detail.publishedAt && (
                  <div className="hf-stat-card" style={{ minWidth: 90, gap: 0 }}>
                    <div className="hf-text-sm hf-text-bold">{new Date(detail.publishedAt).toLocaleDateString()}</div>
                    <div className="hf-text-xs hf-text-muted">Published</div>
                  </div>
                )}
                <div className="hf-stat-card" style={{ minWidth: 90, gap: 0 }}>
                  <div className="hf-text-sm hf-text-bold">{new Date(detail.createdAt).toLocaleDateString()}</div>
                  <div className="hf-text-xs hf-text-muted">Created</div>
                </div>
              </div>

              {/* Actions */}
              {isOperator && (
                <div className="hf-flex hf-gap-sm hf-mb-lg hf-flex-wrap">
                  {detail.status === 'DRAFT' && (
                    <button
                      onClick={handlePublish}
                      disabled={publishing}
                      className="hf-btn-sm"
                      style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}
                    >
                      {publishing ? 'Publishing...' : 'Publish'}
                    </button>
                  )}
                  {detail.status !== 'ARCHIVED' && (
                    <button
                      onClick={handleArchive}
                      disabled={archiving}
                      className="hf-btn-sm hf-btn-secondary"
                    >
                      {archiving ? 'Archiving...' : 'Archive'}
                    </button>
                  )}
                  {detail.status === 'ARCHIVED' && (
                    <button
                      onClick={handleRestore}
                      disabled={archiving}
                      className="hf-btn-sm hf-btn-secondary"
                    >
                      {archiving ? 'Restoring...' : 'Restore'}
                    </button>
                  )}
                  {detail.status === 'DRAFT' && (
                    <>
                      {!showDeleteConfirm ? (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="hf-btn-sm hf-btn-destructive"
                        >
                          Delete
                        </button>
                      ) : (
                        <div className="hf-flex hf-gap-xs hf-items-center">
                          <span className="hf-text-xs hf-text-error">Delete permanently?</span>
                          <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="hf-btn-sm hf-btn-destructive"
                          >
                            {deleting ? '...' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="hf-btn-sm hf-btn-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Specs by Scope */}
              {groupedItems && Object.keys(groupedItems).length > 0 && (
                <div>
                  <h3 className="hf-heading-lg hf-mb-md">Specs by Scope</h3>
                  <div className="hf-flex-col hf-gap-lg">
                    {Object.entries(groupedItems)
                      .sort(([a], [b]) => {
                        const order = ['SYSTEM', 'DOMAIN', 'CALLER'];
                        return order.indexOf(a) - order.indexOf(b);
                      })
                      .map(([scope, items]) => (
                        <div key={scope}>
                          <div className="hf-text-xs hf-text-bold hf-text-muted hf-uppercase hf-mb-sm">
                            {scope} ({items.length})
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                            {items.map((item) => (
                              <div
                                key={item.id}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 6,
                                  border: '1px solid var(--border-default)',
                                  background: item.isEnabled ? 'var(--surface-primary)' : 'var(--surface-tertiary)',
                                  opacity: item.isEnabled ? 1 : 0.6,
                                }}
                              >
                                <div className="hf-text-xs hf-text-bold" style={{ marginBottom: 4 }}>
                                  {item.spec?.name}
                                </div>
                                <div className="hf-flex hf-gap-xs">
                                  {item.spec?.outputType && (
                                    <span
                                      className="hf-text-xs"
                                      style={{
                                        padding: '1px 6px',
                                        borderRadius: 3,
                                        background: outputTypeColors[item.spec.outputType]?.bg || 'var(--surface-secondary)',
                                        color: outputTypeColors[item.spec.outputType]?.text || 'var(--text-secondary)',
                                        fontSize: 10,
                                      }}
                                    >
                                      {item.spec.outputType}
                                    </span>
                                  )}
                                  {!item.isEnabled && (
                                    <span className="hf-text-xs hf-text-muted" style={{ fontSize: 10 }}>OFF</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="hf-mt-lg" style={{ paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
                <div className="hf-flex hf-gap-lg hf-text-xs hf-text-muted">
                  <span>ID: <span className="hf-mono">{detail.id.slice(0, 8)}...</span></span>
                  <span>Updated: {new Date(detail.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
