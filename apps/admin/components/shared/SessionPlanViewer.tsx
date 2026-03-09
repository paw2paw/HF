"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, BookOpen, Zap, RefreshCw, Users2, Image,
  ListOrdered, Plus, AlertTriangle, ChevronDown, Paperclip, X,
} from "lucide-react";
import { SortableList } from "@/components/shared/SortableList";
import { reorderItems } from "@/lib/sortable/reorder";
import { SessionTPList, UnassignedTPList, type TPItem, type SessionOption } from "@/components/shared/SessionTPList";
import { SESSION_TYPES, SESSION_TYPE_ICONS, getSessionTypeColor, getSessionTypeLabel } from "@/lib/lesson-plan/session-ui";
import { getLessonPlanModel } from "@/lib/lesson-plan/models";
import { PlanSummary, type PlanSession } from "@/app/x/courses/_components/PlanSummary";
import type {
  SessionEntry,
  SessionMediaRef,
  SessionMediaMap,
  StudentProgress,
} from "@/lib/lesson-plan/types";
import "./session-plan-viewer.css";

// ── Available Media (for "add material" dropdowns) ─────

export interface AvailableMedia {
  id: string;
  fileName: string;
  title: string | null;
}

// ── Props ──────────────────────────────────────────────

export interface SessionPlanViewerProps {
  variant: "timeline" | "full";

  // Core data
  entries: SessionEntry[];
  model?: string | null;
  generatedAt?: string | null;
  estimatedSessions?: number;

  // Enrichment (optional)
  sessionTPs?: Record<number, TPItem[]>;
  unassignedTPs?: TPItem[];
  mediaMap?: SessionMediaMap | null;
  studentProgress?: StudentProgress[];
  activeSession?: number;

  // Editing callbacks (omit = read-only)
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onRemove?: (index: number) => void;
  onTPMove?: (assertionId: string, toSession: number) => void;
  onSessionMediaAssign?: (mediaId: string, sessionNum: number) => void;
  onSessionMediaRemove?: (sessionNum: number, mediaId: string) => void;
  onPhaseMediaAssign?: (sessionNum: number, phaseId: string, mediaId: string) => void;
  onPhaseMediaRemove?: (sessionNum: number, phaseId: string, mediaId: string) => void;
  onMediaReorder?: (sessionNum: number, fromIdx: number, toIdx: number) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
  regenSessionCount?: number | null;
  onRegenSessionCountChange?: (n: number | null) => void;
  availableMedia?: AvailableMedia[];

  // Navigation
  courseId?: string;

  // Display
  readonly?: boolean;
  maxCollapsed?: number;

  // Loading / error / empty state
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;

  // Empty state: modules exist but no plan
  modules?: Array<{ id: string; slug: string; title: string; estimatedDurationMinutes: number | null; learningObjectiveCount: number }>;
  curriculumId?: string | null;
  isOperator?: boolean;

  // Callbacks for tab changes (empty state "Set Up Course")
  domainId?: string;
}

// ── Noop helpers ───────────────────────────────────────

const noop = () => {};

// ── Component ──────────────────────────────────────────

export function SessionPlanViewer({
  variant,
  entries,
  model,
  generatedAt,
  estimatedSessions,
  sessionTPs = {},
  unassignedTPs = [],
  mediaMap,
  studentProgress,
  activeSession,
  onReorder,
  onRemove,
  onTPMove,
  onSessionMediaAssign,
  onSessionMediaRemove,
  onPhaseMediaAssign,
  onPhaseMediaRemove,
  onMediaReorder,
  onRegenerate,
  regenerating = false,
  regenSessionCount,
  onRegenSessionCountChange,
  availableMedia = [],
  courseId,
  readonly = false,
  maxCollapsed = 6,
  loading = false,
  error,
  onRetry,
  modules,
  curriculumId,
  isOperator = false,
  domainId,
}: SessionPlanViewerProps) {
  const router = useRouter();
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<(SessionMediaRef & { mimeType: string }) | null>(null);
  const [unassignedSearch, setUnassignedSearch] = useState("");
  const [dragMediaId, setDragMediaId] = useState<string | null>(null);
  const [phaseDropdown, setPhaseDropdown] = useState<{ sessionNum: number; phaseId: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close phase media dropdown on outside click
  useEffect(() => {
    if (!phaseDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPhaseDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [phaseDropdown]);

  // ── Derived ──────────────────────────────────────────

  const totalTPs = useMemo(
    () => Object.values(sessionTPs).reduce((sum, tps) => sum + tps.length, 0) + unassignedTPs.length,
    [sessionTPs, unassignedTPs],
  );

  const totalDuration = useMemo(
    () => entries.reduce((sum, e) => sum + (e.estimatedDurationMins || 0), 0),
    [entries],
  );

  const sessionTPOptions: SessionOption[] = useMemo(
    () => entries.map((e, i) => ({ session: i + 1, label: e.label })),
    [entries],
  );

  const tpLoaded = Object.keys(sessionTPs).length > 0 || unassignedTPs.length > 0;

  // Determine which entries to show (timeline variant may collapse)
  const visibleEntries = variant === "timeline" && !showAll && entries.length > maxCollapsed
    ? [...entries.slice(0, maxCollapsed - 1), entries[entries.length - 1]]
    : entries;

  const hiddenCount = variant === "timeline" && !showAll && entries.length > maxCollapsed
    ? entries.length - maxCollapsed
    : 0;

  // Media already assigned to phases (to exclude from "available" dropdowns)
  const assignedMediaIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of entries) {
      for (const m of entry.media || []) ids.add(m.mediaId);
      for (const phase of entry.phases || []) {
        for (const m of phase.media || []) ids.add(m.mediaId);
      }
    }
    return ids;
  }, [entries]);

  const filteredAvailableMedia = useMemo(
    () => availableMedia.filter((m) => !assignedMediaIds.has(m.id)),
    [availableMedia, assignedMediaIds],
  );

  // ── Loading / Error / Empty States ───────────────────

  if (loading) {
    return (
      <div className="hf-empty-compact">
        <div className="hf-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="hf-flex-col hf-items-center hf-gap-sm hf-py-xl">
        <div className="hf-banner hf-banner-error">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
        {onRetry && (
          <button onClick={onRetry} className="hf-btn hf-btn-secondary hf-btn-sm">
            Retry
          </button>
        )}
      </div>
    );
  }

  if (entries.length === 0) {
    // No plan — check if modules exist
    if (modules && modules.length > 0) {
      return (
        <div className="hf-empty-compact">
          <ListOrdered size={36} className="hf-text-tertiary hf-mb-sm" />
          <div className="hf-heading-sm hf-text-secondary hf-mb-sm">Lesson plan not yet generated</div>
          <p className="hf-text-xs hf-text-muted hf-mb-md">
            Your curriculum has {modules.length} module{modules.length !== 1 ? "s" : ""}. Generate a lesson plan to organise them into sessions.
          </p>
          <div className="hf-card-compact hf-w-full hf-mb-md">
            {modules.map((mod) => (
              <div key={mod.id} className="hf-list-row">
                <span className="hf-text-xs hf-text-bold hf-text-muted">{mod.slug}</span>
                <span className="hf-text-sm hf-flex-1">{mod.title}</span>
                {mod.estimatedDurationMinutes ? (
                  <span className="hf-text-xs hf-text-muted">{mod.estimatedDurationMinutes}m</span>
                ) : null}
                <span className="hf-text-xs hf-text-muted">{mod.learningObjectiveCount} LOs</span>
              </div>
            ))}
          </div>
          {isOperator && curriculumId && (
            <div className="hf-flex hf-flex-col hf-items-center hf-gap-sm">
              <label className="hf-flex hf-items-center hf-gap-xs hf-text-xs hf-text-muted">
                Sessions
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={regenSessionCount ?? ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    onRegenSessionCountChange?.(v > 0 && v <= 100 ? v : null);
                  }}
                  className="hf-input hf-input-sm"
                  style={{ width: 56 }}
                />
              </label>
              <button onClick={onRegenerate} disabled={regenerating} className="hf-btn hf-btn-primary">
                {regenerating ? (
                  <><div className="hf-spinner hf-spinner-xs" /> Generating...</>
                ) : (
                  <><Sparkles size={14} /> Generate Lesson Plan</>
                )}
              </button>
            </div>
          )}
        </div>
      );
    }

    // No modules at all
    return (
      <div className="hf-empty-compact">
        <ListOrdered size={36} className="hf-text-tertiary hf-mb-sm" />
        <div className="hf-heading-sm hf-text-secondary hf-mb-sm">No lesson plan yet</div>
        <p className="hf-text-xs hf-text-muted hf-mb-md">
          A lesson plan is created automatically when you set up your course content.
        </p>
        {isOperator && domainId && (
          <Link href={`/x/courses/new?domainId=${domainId}`} className="hf-btn hf-btn-primary">
            <Plus size={14} />
            Set Up Course
          </Link>
        )}
      </div>
    );
  }

  // ── Plan Header (full variant only) ──────────────────

  const renderPlanHeader = () => {
    if (variant !== "full") return null;
    return (
      <div className="cd-plan-header hf-card hf-mb-lg">
        <div className="hf-flex hf-flex-between hf-items-center hf-mb-sm">
          <div className="hf-flex hf-items-center hf-gap-sm">
            <Sparkles size={18} className="hf-text-accent" />
            <span className="hf-section-title hf-mb-0">Your Lesson Plan</span>
          </div>
          {!readonly && curriculumId && onRegenerate && (
            <div className="hf-flex hf-items-center hf-gap-sm">
              <label className="hf-flex hf-items-center hf-gap-xs hf-text-xs hf-text-muted">
                Sessions
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={regenSessionCount ?? ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    onRegenSessionCountChange?.(v > 0 && v <= 100 ? v : null);
                  }}
                  className="hf-input hf-input-sm"
                  style={{ width: 56 }}
                />
              </label>
              <button onClick={onRegenerate} disabled={regenerating} className="hf-btn hf-btn-secondary hf-btn-sm">
                {regenerating ? (
                  <><div className="hf-spinner hf-spinner-xs" /> Regenerating...</>
                ) : (
                  <><RefreshCw size={13} /> Regenerate Plan</>
                )}
              </button>
            </div>
          )}
        </div>
        <div className="hf-flex hf-items-center hf-gap-md hf-mb-sm">
          <span className="hf-text-sm hf-text-primary">
            {entries.length} session{entries.length !== 1 ? "s" : ""}
          </span>
          {model && (
            <span className="hf-chip hf-chip-sm">{getLessonPlanModel(model).label}</span>
          )}
          {totalTPs > 0 && (
            <span className="hf-text-xs hf-text-muted">{totalTPs} teaching points</span>
          )}
          {totalDuration > 0 && (
            <span className="hf-text-xs hf-text-muted">~{totalDuration} min total</span>
          )}
        </div>
        <PlanSummary
          state={regenerating ? "generating" : "ready"}
          sessions={entries.map((e) => ({ type: e.type, label: e.label }))}
        />
        {generatedAt && (
          <div className="hf-text-xs hf-text-muted hf-mt-sm">
            Generated {new Date(generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        )}
      </div>
    );
  };

  // ── Timeline header (timeline variant) ───────────────

  const renderTimelineHeader = () => {
    if (variant !== "timeline") return null;
    return (
      <div className="spv-timeline-header">
        <span className="hf-section-title hf-mb-0">Session Plan</span>
        <span className="hf-text-xs hf-text-muted">
          {entries.length} session{entries.length !== 1 ? "s" : ""}
          {totalDuration > 0 ? ` \u00b7 ~${totalDuration} min` : ""}
        </span>
      </div>
    );
  };

  // ── Phase rows (zebra-striped) ───────────────────────

  const renderPhases = (entry: SessionEntry, sessionNum: number) => {
    if (!entry.phases?.length) return null;
    const typeColor = getSessionTypeColor(entry.type);

    return (
      <div className="spv-phases">
        {entry.phases.map((phase, pi) => (
          <div
            key={phase.id + pi}
            className={`spv-phase ${pi % 2 === 0 ? "spv-phase--even" : "spv-phase--odd"}`}
          >
            <div className="spv-phase-accent" style={{ background: typeColor }} />
            <div className="spv-phase-content">
              <div className="spv-phase-header">
                <span className="spv-phase-label">{phase.label}</span>
                {phase.durationMins && (
                  <span className="spv-phase-dur">{phase.durationMins}m</span>
                )}
              </div>
              {phase.teachMethods?.length ? (
                <div className="spv-phase-methods">
                  <Zap size={9} className="hf-session-methods-icon" />
                  {phase.teachMethods.map((m) => (
                    <span key={m} className="hf-chip hf-chip-sm">{m}</span>
                  ))}
                </div>
              ) : null}
              {phase.guidance && (
                <div className="spv-phase-guidance">{phase.guidance}</div>
              )}
              {/* Per-phase materials */}
              {(phase.media?.length || !readonly) && (
                <div className="spv-phase-materials">
                  {phase.media?.map((m) => (
                    <span key={m.mediaId} className="spv-material-chip">
                      <Paperclip size={10} />
                      <span className="spv-material-name">{m.fileName || m.figureRef || "File"}</span>
                      {!readonly && onPhaseMediaRemove && (
                        <button
                          className="spv-material-remove"
                          onClick={(e) => { e.stopPropagation(); onPhaseMediaRemove(sessionNum, phase.id, m.mediaId); }}
                          title="Remove"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  ))}
                  {!readonly && onPhaseMediaAssign && filteredAvailableMedia.length > 0 && (
                    <div className="spv-add-material-wrap" ref={phaseDropdown?.sessionNum === sessionNum && phaseDropdown?.phaseId === phase.id ? dropdownRef : undefined}>
                      <button
                        className="spv-add-material-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhaseDropdown(
                            phaseDropdown?.sessionNum === sessionNum && phaseDropdown?.phaseId === phase.id
                              ? null
                              : { sessionNum, phaseId: phase.id },
                          );
                        }}
                      >
                        <Plus size={10} /> Add material
                      </button>
                      {phaseDropdown?.sessionNum === sessionNum && phaseDropdown?.phaseId === phase.id && (
                        <div className="spv-material-dropdown">
                          {filteredAvailableMedia.slice(0, 10).map((media) => (
                            <button
                              key={media.id}
                              className="spv-material-dropdown-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPhaseMediaAssign(sessionNum, phase.id, media.id);
                                setPhaseDropdown(null);
                              }}
                            >
                              <Paperclip size={10} />
                              {media.title || media.fileName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Phase breadcrumb trail (collapsed view) ──────────

  const renderPhaseBreadcrumbs = (entry: SessionEntry) => {
    if (!entry.phases?.length) return null;
    return (
      <div className="spv-phase-trail">
        {entry.phases.map((p, i) => (
          <span key={p.id + i}>
            {i > 0 && <span className="spv-phase-separator"> &rsaquo; </span>}
            {p.label.split(" — ")[0]}
          </span>
        ))}
      </div>
    );
  };

  // ── Session media strip ──────────────────────────────

  const renderSessionMedia = (entry: SessionEntry, index: number) => {
    const sm = mediaMap?.sessions?.find((s) => s.session === entry.session);
    const hasImages = sm && sm.images.length > 0;
    const hasUnassigned = (mediaMap?.unassigned?.length ?? 0) > 0;

    return (
      <div
        className={`spv-session-media${dragMediaId ? " spv-drop-target" : ""}`}
        onDragOver={(e) => { if (dragMediaId) { e.preventDefault(); e.currentTarget.classList.add("spv-drop-hover"); } }}
        onDragLeave={(e) => e.currentTarget.classList.remove("spv-drop-hover")}
        onDrop={(e) => {
          e.currentTarget.classList.remove("spv-drop-hover");
          if (dragMediaId && onSessionMediaAssign) {
            onSessionMediaAssign(dragMediaId, entry.session);
            setDragMediaId(null);
          }
        }}
      >
        {hasImages ? sm.images.map((img, imgIdx) => (
          <div
            key={img.mediaId}
            className="hf-session-media-thumb"
            title={img.captionText || img.figureRef || img.fileName}
            draggable={!readonly}
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", `reorder:${imgIdx}`); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("cd-img-drag-over"); }}
            onDragLeave={(e) => e.currentTarget.classList.remove("cd-img-drag-over")}
            onDrop={(e) => {
              e.stopPropagation();
              e.currentTarget.classList.remove("cd-img-drag-over");
              const data = e.dataTransfer.getData("text/plain");
              if (data.startsWith("reorder:") && onMediaReorder) {
                const fromIdx = parseInt(data.split(":")[1], 10);
                if (!isNaN(fromIdx) && fromIdx !== imgIdx) onMediaReorder(entry.session, fromIdx, imgIdx);
              }
            }}
          >
            {img.mimeType.startsWith("image/") ? (
              <img
                src={`/api/media/${img.mediaId}`}
                alt={img.captionText || img.figureRef || ""}
                onClick={() => setLightboxImage(img)}
                style={{ cursor: "pointer" }}
              />
            ) : (
              <span className="hf-session-media-icon" onClick={() => setLightboxImage(img)} style={{ cursor: "pointer" }}>{img.figureRef || "File"}</span>
            )}
            {!readonly && onSessionMediaRemove && (
              <button
                className="hf-session-media-remove"
                onClick={(e) => { e.stopPropagation(); onSessionMediaRemove(entry.session, img.mediaId); }}
                title="Remove from session"
              >&#10005;</button>
            )}
          </div>
        )) : !readonly && hasUnassigned ? (
          <span className="hf-text-xs hf-text-muted cd-no-images-hint">
            <Image size={12} /> No images — drag from unassigned below
          </span>
        ) : null}
      </div>
    );
  };

  // ── Session card render function ─────────────────────

  const renderSessionCard = (entry: SessionEntry, index: number) => {
    const typeColor = getSessionTypeColor(entry.type);
    const typeLabel = getSessionTypeLabel(entry.type);
    const TypeIcon = SESSION_TYPE_ICONS[entry.type];
    const allMethods = [...new Set((entry.phases ?? []).flatMap((p) => p.teachMethods ?? []))];
    const isExpanded = expandedSession === index;
    const sessionNum = entry.session;
    const isActive = activeSession === sessionNum;
    const tpCount = sessionTPs[sessionNum]?.length || entry.assertionCount || 0;
    const sm = mediaMap?.sessions?.find((s) => s.session === sessionNum);
    const mediaCount = sm?.images?.length ?? (entry.media?.length ?? 0);

    return (
      <div className={isActive ? "spv-session--active" : ""}>
        {/* Header row */}
        <div
          className="hf-session-row cd-session-row-clickable"
          style={{ "--session-color": typeColor } as React.CSSProperties}
          onClick={() => {
            if (courseId) router.push(`/x/courses/${courseId}/sessions/${sessionNum}`);
          }}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" && courseId) router.push(`/x/courses/${courseId}/sessions/${sessionNum}`); }}
        >
          <span className="hf-session-num">{sessionNum}</span>
          {TypeIcon && <TypeIcon size={12} className="cd-session-icon" style={{ color: "var(--session-color)" }} />}
          <span className="hf-session-type cd-session-type">{typeLabel}</span>
          <span className="hf-session-label">{entry.label}</span>
          {tpCount > 0 && (
            <span className="hf-session-tp-badge" title="Teaching points">
              <BookOpen size={10} />
              {tpCount} TPs
            </span>
          )}
          {mediaCount > 0 && (
            <span className="hf-session-media-badge" title={`${mediaCount} image${mediaCount > 1 ? "s" : ""}`}>
              &#128444; {mediaCount}
            </span>
          )}
          {entry.learningOutcomeRefs?.length ? (
            <span className="hf-session-lo-badges">
              {entry.learningOutcomeRefs.map((lo) => (
                <span key={lo} className="hf-session-lo-chip">{lo}</span>
              ))}
            </span>
          ) : null}
          {entry.estimatedDurationMins ? (
            <span className="hf-session-meta">{entry.estimatedDurationMins}m</span>
          ) : null}
          {(entry.phases?.length || tpCount > 0) && (
            <button
              className="hf-session-expand-btn"
              onClick={(e) => { e.stopPropagation(); setExpandedSession(isExpanded ? null : index); }}
              title={isExpanded ? "Collapse details" : "Show details"}
            >
              <span className={`hf-chevron--sm${isExpanded ? " hf-chevron--open" : ""}`} />
            </button>
          )}
        </div>

        {/* Methods bar */}
        {allMethods.length > 0 && (
          <div className="hf-session-methods-bar">
            <Zap size={10} className="hf-session-methods-icon" />
            {allMethods.map((m) => (
              <span key={m} className="hf-chip hf-chip-sm">{m}</span>
            ))}
          </div>
        )}

        {/* Collapsed: phase breadcrumbs */}
        {!isExpanded && renderPhaseBreadcrumbs(entry)}

        {/* Expanded: zebra-striped phases */}
        {isExpanded && renderPhases(entry, sessionNum)}

        {/* Expanded: Teaching Points */}
        {isExpanded && tpLoaded && onTPMove && (
          <SessionTPList
            sessionNumber={sessionNum}
            assertions={sessionTPs[sessionNum] || []}
            sessions={sessionTPOptions}
            onMove={onTPMove}
            readonly={readonly}
          />
        )}

        {/* Expanded: Session media strip */}
        {isExpanded && variant === "full" && renderSessionMedia(entry, index)}
      </div>
    );
  };

  // ── Sessions heading (full variant) ──────────────────

  const renderSessionsHeading = () => {
    if (variant !== "full") return null;
    return (
      <div className="hf-flex hf-items-center hf-gap-sm hf-mb-md">
        <span className="hf-section-title hf-mb-0">Sessions</span>
        <span className="hf-text-xs hf-text-muted">
          {SESSION_TYPES.map((t) => {
            const count = entries.filter((e) => e.type === t.value).length;
            return count > 0 ? `${count} ${t.label.toLowerCase()}` : null;
          }).filter(Boolean).join(" \u00b7 ")}
        </span>
      </div>
    );
  };

  // ── Unassigned TPs (full variant) ────────────────────

  const renderUnassignedTPs = () => {
    if (variant !== "full" || !tpLoaded || unassignedTPs.length === 0 || !onTPMove) return null;
    return (
      <UnassignedTPList
        assertions={unassignedTPs}
        sessions={sessionTPOptions}
        onMove={onTPMove}
      />
    );
  };

  // ── Unassigned images (full variant) ─────────────────

  const renderUnassignedImages = () => {
    if (variant !== "full" || !mediaMap || mediaMap.unassigned.length === 0) return null;
    const filtered = unassignedSearch
      ? mediaMap.unassigned.filter((img) => {
          const q = unassignedSearch.toLowerCase();
          return (img.fileName?.toLowerCase().includes(q)) ||
            (img.captionText?.toLowerCase().includes(q)) ||
            (img.figureRef?.toLowerCase().includes(q));
        })
      : mediaMap.unassigned;
    const PAGE_SIZE = 12;
    const shown = filtered.slice(0, PAGE_SIZE);
    const remaining = filtered.length - PAGE_SIZE;

    return (
      <div className="hf-card-compact hf-mt-md cd-unassigned-images">
        <div className="hf-flex hf-flex-between hf-items-center hf-mb-sm">
          <span className="hf-section-title hf-text-sm">
            <Image size={14} /> Unassigned Images ({mediaMap.unassigned.length})
          </span>
          <div className="hf-flex hf-gap-sm hf-items-center">
            {mediaMap.unassigned.length > 6 && (
              <input
                type="text"
                className="hf-input hf-input-xs"
                placeholder="Filter images\u2026"
                value={unassignedSearch}
                onChange={(e) => setUnassignedSearch(e.target.value)}
                style={{ width: 140 }}
              />
            )}
            <span className="hf-text-xs hf-text-muted">
              {mediaMap.stats.assigned} of {mediaMap.stats.total} assigned
            </span>
          </div>
        </div>
        <div className="hf-session-media-grid">
          {shown.map((img) => (
            <div
              key={img.mediaId}
              className="hf-session-media-card"
              draggable={!readonly}
              onDragStart={(e) => { setDragMediaId(img.mediaId); e.dataTransfer.setData("text/plain", `assign:${img.mediaId}`); e.dataTransfer.effectAllowed = "move"; }}
              onDragEnd={() => setDragMediaId(null)}
            >
              <div className="hf-session-media-card-thumb" onClick={() => setLightboxImage(img)} style={{ cursor: "pointer" }}>
                {img.mimeType.startsWith("image/") ? (
                  <img src={`/api/media/${img.mediaId}`} alt={img.captionText || img.figureRef || ""} />
                ) : (
                  <span className="hf-session-media-icon">{img.figureRef || "File"}</span>
                )}
              </div>
              <div className="hf-session-media-card-label">
                {img.figureRef || img.captionText || img.fileName}
              </div>
              {!readonly && onSessionMediaAssign && (
                <select
                  className="hf-input hf-input-xs"
                  defaultValue=""
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val > 0) onSessionMediaAssign(img.mediaId, val);
                    e.target.value = "";
                  }}
                >
                  <option value="" disabled>Assign to session\u2026</option>
                  {entries.map((se) => (
                    <option key={se.session} value={se.session}>
                      S{se.session}: {se.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
        {remaining > 0 && (
          <p className="hf-text-xs hf-text-muted hf-mt-sm">
            +{remaining} more — use the filter to find specific images
          </p>
        )}
      </div>
    );
  };

  // ── Class Progress (full variant) ────────────────────

  const renderClassProgress = () => {
    if (variant !== "full" || !studentProgress) return null;

    if (studentProgress.length === 0) {
      return (
        <div className="hf-mt-xl">
          <div className="hf-flex hf-items-center hf-gap-sm hf-mb-sm">
            <Users2 size={16} className="hf-text-muted" />
            <span className="hf-section-title hf-mb-0">Class Progress</span>
          </div>
          <p className="hf-text-sm hf-text-muted">
            No students enrolled yet.
          </p>
        </div>
      );
    }

    const sp = studentProgress;
    const total = sp.length;

    return (
      <div className="hf-mt-xl">
        <div className="hf-flex hf-flex-between hf-items-center hf-mb-md">
          <div className="hf-flex hf-items-center hf-gap-sm">
            <Users2 size={16} className="hf-text-muted" />
            <span className="hf-section-title hf-mb-0">Class Progress</span>
          </div>
          <span className="hf-text-xs hf-text-muted">{total} enrolled</span>
        </div>
        <div className="hf-card-compact cd-progress-section">
          {entries.map((entry) => {
            const completed = sp.filter((s) => s.currentSession !== null && s.currentSession > entry.session);
            const active = sp.filter((s) => s.currentSession === entry.session);
            const reached = completed.length + active.length;
            const pct = total > 0 ? Math.round((reached / total) * 100) : 0;
            const allDone = total > 0 && completed.length === total;
            const hasActive = active.length > 0;
            const typeColor = getSessionTypeColor(entry.type);

            return (
              <div key={entry.session} className="cd-progress-row">
                <span className="cd-progress-num hf-text-xs hf-text-muted">{entry.session}</span>
                <span
                  className="cd-session-type hf-text-xs"
                  style={{ "--session-color": typeColor } as React.CSSProperties}
                >
                  {getSessionTypeLabel(entry.type)}
                </span>
                <div className="cd-progress-bar">
                  <div
                    className="cd-progress-fill"
                    style={{
                      width: `${pct}%`,
                      background: allDone
                        ? "var(--status-success-text)"
                        : hasActive
                          ? "var(--status-info-text)"
                          : "var(--border-default)",
                    }}
                  />
                </div>
                <span className="cd-progress-count hf-text-xs">
                  {allDone ? (
                    <span style={{ color: "var(--status-success-text)" }}>&#10003; {total}</span>
                  ) : hasActive ? (
                    <span style={{ color: "var(--status-info-text)" }}>&#9654; {active.length}/{total}</span>
                  ) : (
                    <span className="hf-text-muted">{reached}/{total}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Active + not-started summary */}
        {(() => {
          const active = sp.filter((s) => s.currentSession !== null && s.currentSession > 0);
          const notStarted = sp.filter((s) => s.currentSession === null);
          if (active.length === 0 && notStarted.length === 0) return null;
          return (
            <div className="hf-mt-sm">
              {active.length > 0 && (
                <div className="hf-text-xs hf-text-muted">
                  <span className="hf-text-bold">Active: </span>
                  {active.map((s) => {
                    const se = entries.find((e) => e.session === s.currentSession);
                    return `${s.name} \u2192 Session ${s.currentSession}${se ? ` (${getSessionTypeLabel(se.type)})` : ""}`;
                  }).join(" \u00b7 ")}
                </div>
              )}
              {notStarted.length > 0 && (
                <div className="hf-text-xs hf-text-muted hf-mt-xs">
                  <span className="hf-text-bold">Not started: </span>
                  {notStarted.map((s) => s.name).join(", ")}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // ── Lightbox ─────────────────────────────────────────

  const renderLightbox = () => {
    if (!lightboxImage) return null;
    return (
      <div className="cd-lightbox-overlay" onClick={() => setLightboxImage(null)}>
        <div className="cd-lightbox-content" onClick={(e) => e.stopPropagation()}>
          {lightboxImage.mimeType.startsWith("image/") ? (
            <img src={`/api/media/${lightboxImage.mediaId}`} alt={lightboxImage.captionText || ""} />
          ) : null}
          {lightboxImage.captionText && <p className="cd-lightbox-caption">{lightboxImage.captionText}</p>}
          {lightboxImage.figureRef && <p className="cd-lightbox-figref">{lightboxImage.figureRef}</p>}
          <button className="cd-lightbox-close" onClick={() => setLightboxImage(null)}>&#10005;</button>
        </div>
      </div>
    );
  };

  // ── Main Render ──────────────────────────────────────

  return (
    <div className={`spv-container spv-container--${variant}`}>
      {renderPlanHeader()}
      {renderTimelineHeader()}
      {renderSessionsHeading()}

      {/* Session cards — using SortableList for full variant, simple list for timeline */}
      {variant === "full" && onReorder && onRemove && !readonly ? (
        <SortableList
          items={entries}
          getItemId={(e) => `session-${e.session}`}
          onReorder={onReorder}
          onRemove={onRemove}
          disabled={readonly}
          minItems={1}
          renderCard={(entry, index) => renderSessionCard(entry, index)}
        />
      ) : (
        <div className={variant === "timeline" ? "spv-timeline" : "hf-card-compact"}>
          {variant === "timeline" && <div className="spv-timeline-line" />}
          {visibleEntries.map((entry, i) => {
            const realIndex = variant === "timeline" && !showAll && entries.length > maxCollapsed && i === visibleEntries.length - 1
              ? entries.length - 1
              : i;

            return (
              <div key={`sess-${entry.session}`} className={variant === "timeline" ? "spv-timeline-item" : ""}>
                {variant === "timeline" && (
                  <div
                    className="spv-timeline-node"
                    style={{ borderColor: getSessionTypeColor(entry.type) }}
                  />
                )}
                {renderSessionCard(entry, realIndex)}

                {/* "Show all" toggle between collapsed items */}
                {variant === "timeline" && hiddenCount > 0 && i === maxCollapsed - 2 && (
                  <button className="spv-show-all-btn" onClick={() => setShowAll(true)}>
                    Show all {entries.length} sessions ({hiddenCount} hidden)
                  </button>
                )}
              </div>
            );
          })}
          {variant === "timeline" && showAll && entries.length > maxCollapsed && (
            <button className="spv-show-all-btn" onClick={() => setShowAll(false)}>
              Show fewer
            </button>
          )}
        </div>
      )}

      {renderUnassignedTPs()}
      {renderUnassignedImages()}
      {renderClassProgress()}
      {renderLightbox()}
    </div>
  );
}
