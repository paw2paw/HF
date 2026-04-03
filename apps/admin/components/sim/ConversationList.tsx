'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Search, RefreshCw, ChevronDown, ArrowLeft, LogOut, BookOpen, RotateCcw, Play, Check } from 'lucide-react';
import { ConversationItem } from './ConversationItem';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { ROLE_LEVEL } from '@/lib/roles';
import type { UserRole } from '@prisma/client';

interface CourseEnrollment {
  id: string;
  playbookId: string;
  courseName: string;
  institutionName: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'DROPPED';
  isDefault: boolean;
  sessionCount: number;
  activeGoals: number;
}

interface Conversation {
  callerId: string;
  name: string;
  domain: { name: string; slug: string } | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

type SortMode = 'recent' | 'name-asc' | 'name-desc' | 'newest';

const SORT_LABELS: Record<SortMode, string> = {
  recent: 'Recent',
  'name-asc': 'A→Z',
  'name-desc': 'Z→A',
  newest: 'Newest',
};

export function ConversationList() {
  const router = useRouter();
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [domainFilter, setDomainFilter] = useState('');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showDomainDropdown, setShowDomainDropdown] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [courses, setCourses] = useState<CourseEnrollment[]>([]);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const domainRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const courseRef = useRef<HTMLDivElement>(null);

  const roleLevel = ROLE_LEVEL[(session?.user?.role as UserRole) ?? 'DEMO'] ?? -1;
  const isStudentView = roleLevel >= 1 && roleLevel <= 2;
  const activeCourse = courses.find(c => c.isDefault) || courses.find(c => c.status === 'ACTIVE') || courses[0];

  const fetchConversations = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    fetch('/api/sim/conversations')
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          if (data.needsSetup) {
            router.push('/x/sim/setup');
            return;
          }
          setConversations(data.conversations);
        }
      })
      .catch((e) => console.warn("[ConversationList] Failed to load conversations:", e))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchConversations();
    if (isStudentView) {
      fetch('/api/student/courses')
        .then(res => res.json())
        .then(data => {
          if (data.ok) setCourses(data.enrollments);
        })
        .catch(() => {});
    }
  }, [isStudentView]);

  // Close dropdowns on click outside
  useEffect(() => {
    if (!showSortDropdown && !showDomainDropdown && !showAccountMenu && !showCourseDropdown) return;
    const handler = (e: MouseEvent) => {
      if (showSortDropdown && sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
      if (showDomainDropdown && domainRef.current && !domainRef.current.contains(e.target as Node)) {
        setShowDomainDropdown(false);
      }
      if (showAccountMenu && accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
      if (showCourseDropdown && courseRef.current && !courseRef.current.contains(e.target as Node)) {
        setShowCourseDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortDropdown, showDomainDropdown, showAccountMenu, showCourseDropdown]);

  const uniqueDomains = useMemo(() => {
    const map = new Map<string, string>();
    conversations.forEach(c => {
      if (c.domain) map.set(c.domain.slug, c.domain.name);
    });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [conversations]);

  const activeDomainLabel = domainFilter
    ? uniqueDomains.find(d => d.slug === domainFilter)?.name || 'All'
    : 'All';

  const filteredAndSorted = useMemo(() => {
    let result = conversations;

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.domain?.name.toLowerCase().includes(q)
      );
    }

    // Domain filter
    if (domainFilter) {
      result = result.filter(c => c.domain?.slug === domainFilter);
    }

    // Sort
    return [...result].sort((a, b) => {
      switch (sortMode) {
        case 'recent': {
          if (!a.lastMessageAt && !b.lastMessageAt) return 0;
          if (!a.lastMessageAt) return 1;
          if (!b.lastMessageAt) return -1;
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        }
        case 'name-asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'name-desc':
          return (b.name || '').localeCompare(a.name || '');
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });
  }, [conversations, search, domainFilter, sortMode]);

  async function handleActivateCourse(enrollmentId: string) {
    setShowCourseDropdown(false);
    const res = await fetch(`/api/student/courses/${enrollmentId}/activate`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      setCourses(prev => prev.map(c => ({ ...c, isDefault: c.id === enrollmentId, status: c.id === enrollmentId && c.status === 'PAUSED' ? 'ACTIVE' as const : c.status })));
      fetchConversations(true);
    }
  }

  async function handleRetakeCourse(enrollmentId: string) {
    setShowCourseDropdown(false);
    const res = await fetch(`/api/student/courses/${enrollmentId}/retake`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      setCourses(prev => prev.map(c => ({
        ...c,
        isDefault: c.id === enrollmentId,
        status: c.id === enrollmentId ? 'ACTIVE' as const : c.status,
      })));
      fetchConversations(true);
    }
  }

  return (
    <>
      {/* Header — course-aware for students, standard for admins */}
      {isStudentView && activeCourse ? (
        <div className="wa-header" style={{ justifyContent: 'space-between' }} ref={courseRef}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <BookOpen size={18} style={{ color: 'var(--wa-header-text)', opacity: 0.85, flexShrink: 0 }} />
            <button
              onClick={() => courses.length > 1 ? setShowCourseDropdown(v => !v) : undefined}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: courses.length > 1 ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                minWidth: 0,
                flex: 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="wa-header-title" style={{ fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeCourse.courseName}
                </span>
                {courses.length > 1 && <ChevronDown size={14} style={{ color: 'var(--wa-header-text)', opacity: 0.7, flexShrink: 0 }} />}
              </div>
              {activeCourse.institutionName && (
                <span style={{ fontSize: 11, color: 'var(--wa-header-text)', opacity: 0.65 }}>
                  {activeCourse.institutionName}
                </span>
              )}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => fetchConversations(true)}
              disabled={refreshing}
              className="wa-header-icon-btn"
            >
              <RefreshCw size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <div style={{ position: 'relative' }} ref={accountRef}>
              <button onClick={() => setShowAccountMenu(v => !v)} className="wa-header-icon-btn">
                <UserAvatar
                  name={session?.user?.name || session?.user?.email || '?'}
                  initials={session?.user?.avatarInitials}
                  role={session?.user?.role}
                  size={28}
                />
              </button>
              {showAccountMenu && (
                <div className="wa-dropdown-menu" style={{ right: 0, width: 220 }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--wa-divider)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--wa-text-primary)' }}>
                      {(session?.user as any)?.displayName || session?.user?.name || session?.user?.email}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--wa-text-muted)', marginTop: 2 }}>
                      {session?.user?.email}
                    </div>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="wa-dropdown-item"
                    style={{ color: 'var(--status-error-text)' }}
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Course dropdown */}
          {showCourseDropdown && courses.length > 1 && (
            <div className="wa-dropdown-menu" style={{ left: 0, right: 0, top: '100%' }}>
              {courses.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    className="wa-dropdown-item"
                    style={{ flex: 1 }}
                    onClick={() => {
                      if (c.status === 'COMPLETED') handleRetakeCourse(c.id);
                      else if (c.status === 'PAUSED' || (c.status === 'ACTIVE' && !c.isDefault)) handleActivateCourse(c.id);
                    }}
                    disabled={c.isDefault && c.status === 'ACTIVE'}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      {c.isDefault && c.status === 'ACTIVE' && <Check size={14} style={{ color: 'var(--wa-green-primary)', flexShrink: 0 }} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.courseName}</span>
                    </span>
                    <span className={`wa-course-status wa-course-status-${c.status.toLowerCase()}`}>
                      {c.status === 'COMPLETED' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><RotateCcw size={11} /> Retake</span>
                      ) : c.status === 'PAUSED' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Play size={11} /> Resume</span>
                      ) : c.isDefault ? 'Active' : 'Switch'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="wa-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="wa-back-btn" onClick={() => router.push('/x')}>
              <ArrowLeft size={20} />
            </button>
            <div className="wa-header-title" style={{ fontSize: 20 }}>HumanFirst</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => fetchConversations(true)}
              disabled={refreshing}
              style={{
                background: 'none',
                border: 'none',
                padding: 8,
                cursor: 'pointer',
                color: 'var(--wa-header-text)',
                opacity: 0.75,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <RefreshCw
                size={20}
                style={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
            </button>

            {/* Account avatar */}
            <div style={{ position: 'relative' }} ref={accountRef}>
              <button
                onClick={() => setShowAccountMenu(v => !v)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <UserAvatar
                  name={session?.user?.name || session?.user?.email || '?'}
                  initials={session?.user?.avatarInitials}
                  role={session?.user?.role}
                  size={28}
                />
              </button>
              {showAccountMenu && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: 4,
                    background: 'var(--wa-surface)',
                    border: '1px solid var(--wa-divider)',
                    borderRadius: 12,
                    boxShadow: '0 4px 16px color-mix(in srgb, black 15%, transparent)',
                    width: 220,
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--wa-divider)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--wa-text-primary)' }}>
                      {(session?.user as any)?.displayName || session?.user?.name || session?.user?.email}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--wa-text-muted)', marginTop: 2 }}>
                      {session?.user?.email}
                    </div>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '10px 14px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--status-error-text)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--wa-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search row — domain dropdown + search input + sort dropdown */}
      <div className="wa-search">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Domain filter dropdown */}
          <div className="wa-filter-dropdown-wrapper" ref={domainRef}>
            <button
              className={`wa-filter-btn ${domainFilter ? 'wa-filter-btn-active' : ''}`}
              onClick={() => { setShowDomainDropdown(!showDomainDropdown); setShowSortDropdown(false); }}
            >
              {activeDomainLabel}
              <ChevronDown size={12} />
            </button>
            {showDomainDropdown && (
              <div className="wa-sort-dropdown" style={{ left: 0, right: 'auto' }}>
                <button
                  className={`wa-sort-option ${!domainFilter ? 'wa-sort-option-active' : ''}`}
                  onClick={() => { setDomainFilter(''); setShowDomainDropdown(false); }}
                >
                  All
                </button>
                {uniqueDomains.map(d => (
                  <button
                    key={d.slug}
                    className={`wa-sort-option ${domainFilter === d.slug ? 'wa-sort-option-active' : ''}`}
                    onClick={() => { setDomainFilter(d.slug); setShowDomainDropdown(false); }}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search input */}
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--wa-text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Sort dropdown */}
          <div className="wa-filter-dropdown-wrapper" ref={sortRef}>
            <button
              className="wa-filter-btn"
              onClick={() => { setShowSortDropdown(!showSortDropdown); setShowDomainDropdown(false); }}
            >
              {SORT_LABELS[sortMode]}
              <ChevronDown size={12} />
            </button>
            {showSortDropdown && (
              <div className="wa-sort-dropdown">
                {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
                  <button
                    key={mode}
                    className={`wa-sort-option ${sortMode === mode ? 'wa-sort-option-active' : ''}`}
                    onClick={() => { setSortMode(mode); setShowSortDropdown(false); }}
                  >
                    {SORT_LABELS[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--wa-surface)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--wa-text-muted)' }}>
            Loading conversations...
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--wa-text-muted)' }}>
            {search || domainFilter ? 'No callers match your filters' : 'No callers found'}
          </div>
        ) : (
          filteredAndSorted.map((convo) => (
            <ConversationItem
              key={convo.callerId}
              callerId={convo.callerId}
              name={convo.name}
              domain={convo.domain?.name}
              lastMessage={convo.lastMessage}
              lastMessageAt={convo.lastMessageAt}
            />
          ))
        )}
      </div>
    </>
  );
}
