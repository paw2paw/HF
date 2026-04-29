"use client";

/**
 * Session Flow Timeline — read-only view of a course's resolved Session Flow.
 *
 * Renders BEFORE / DURING / AFTER sections from /api/courses/[courseId]/session-flow.
 * No edit affordances in this story (#223). The editor variant lives in #225.
 *
 * Used on:
 *   - Course page Session Flow tab (#225 once edit lands; read-only here for now)
 *   - Caller page Session Flow panel (#224 will overlay learner state)
 *
 * @see docs/decisions/2026-04-29-session-flow-canonical-model.md
 */

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  Minus,
  Sparkles,
  GraduationCap,
  ClipboardCheck,
  MessageSquare,
  ThumbsUp,
  Settings2,
} from "lucide-react";
import type {
  SessionFlowResolved,
} from "@/lib/types/json-fields";
import {
  sourceLabel,
  kcSummary,
  isPreTest,
  isMidTest,
  isPostTest,
  stopSummary,
  quoted,
} from "./timeline-helpers";
import "./session-flow-timeline.css";

// ── Types ──────────────────────────────────────────────

type SessionFlowApiResponse = {
  ok: true;
  sessionFlow: SessionFlowResolved;
  mode: "continuous" | "structured";
  teachingMode: string | null;
  sessionCount: number | null;
  courseName: string;
} | { ok: false; error: string };

export type SessionFlowTimelineProps = {
  courseId: string;
};

// ── Component ──────────────────────────────────────────────

export function SessionFlowTimeline({ courseId }: SessionFlowTimelineProps) {
  const [data, setData] = useState<SessionFlowApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/courses/${courseId}/session-flow`)
      .then(r => r.json() as Promise<SessionFlowApiResponse>)
      .then(json => {
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error || "Failed to load Session Flow");
        } else {
          setData(json);
        }
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError((err as Error).message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  if (loading) return <div className="hf-sft-loading">Loading Session Flow…</div>;
  if (error) return <div className="hf-sft-error">Could not load Session Flow: {error}</div>;
  if (!data || !data.ok) return null;

  const { sessionFlow, mode, teachingMode } = data;

  return (
    <div className="hf-sft">
      <header className="hf-sft-header">
        <div className="hf-sft-header-title">
          <Settings2 size={16} />
          <span>Session Flow</span>
        </div>
        <div className="hf-sft-header-meta">
          <span className="hf-sft-pill">Mode: {mode}</span>
          {teachingMode && <span className="hf-sft-pill">Type: {teachingMode}</span>}
        </div>
      </header>

      <Section title="BEFORE">
        <Row
          icon={<Sparkles size={16} />}
          label="Onboarding"
          summary={`${sessionFlow.onboarding.phases.length} phases · source: ${sourceLabel(sessionFlow.source.onboarding)}`}
          status="enabled"
        />
        <Row
          icon={<MessageSquare size={16} />}
          label="Welcome message"
          summary={
            sessionFlow.welcomeMessage
              ? quoted(sessionFlow.welcomeMessage)
              : "Generic fallback"
          }
          status={sessionFlow.welcomeMessage ? "enabled" : "default"}
        />
        <Row
          icon={<Circle size={16} />}
          label="Goals question"
          summary="First call asks learner about their goals"
          status={sessionFlow.intake.goals.enabled ? "enabled" : "disabled"}
        />
        <Row
          icon={<Circle size={16} />}
          label="About You"
          summary="Motivation + confidence check"
          status={sessionFlow.intake.aboutYou.enabled ? "enabled" : "disabled"}
        />
        <Row
          icon={<ClipboardCheck size={16} />}
          label="Knowledge Check"
          summary={kcSummary(sessionFlow.intake.knowledgeCheck)}
          status={sessionFlow.intake.knowledgeCheck.enabled ? "enabled" : "disabled"}
        />
        <Row
          icon={<Sparkles size={16} />}
          label="AI Intro Call"
          summary="Separate intro session before teaching starts"
          status={sessionFlow.intake.aiIntroCall.enabled ? "enabled" : "disabled"}
        />
        {sessionFlow.stops.filter(s => isPreTest(s)).map(s => (
          <Row
            key={s.id}
            icon={<ClipboardCheck size={16} />}
            label="Pre-test"
            summary={stopSummary(s)}
            status="enabled"
          />
        ))}
      </Section>

      <Section title="DURING">
        <Row
          icon={<GraduationCap size={16} />}
          label="Sessions"
          summary={
            mode === "continuous"
              ? "Scheduler-driven, no fixed count"
              : `${data.sessionCount ?? "?"} session${data.sessionCount === 1 ? "" : "s"} (structured)`
          }
          status="default"
        />
        {sessionFlow.stops.filter(s => isMidTest(s)).map(s => (
          <Row
            key={s.id}
            icon={<ClipboardCheck size={16} />}
            label="Mid-test"
            summary={stopSummary(s)}
            status="enabled"
          />
        ))}
      </Section>

      <Section title="AFTER">
        {sessionFlow.stops.filter(s => isPostTest(s)).map(s => (
          <Row
            key={s.id}
            icon={<ClipboardCheck size={16} />}
            label="Post-test"
            summary={stopSummary(s)}
            status="enabled"
          />
        ))}
        {sessionFlow.stops.filter(s => s.kind === "nps").map(s => (
          <Row
            key={s.id}
            icon={<ThumbsUp size={16} />}
            label="NPS"
            summary={stopSummary(s)}
            status="enabled"
          />
        ))}
        <Row
          icon={<Minus size={16} />}
          label="Offboarding"
          summary={`${sessionFlow.offboarding.phases.length} phases · trigger after ${sessionFlow.offboarding.triggerAfterCalls} calls`}
          status={sessionFlow.offboarding.phases.length > 0 ? "enabled" : "default"}
        />
      </Section>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hf-sft-section">
      <h3 className="hf-sft-section-title">{title}</h3>
      <ul className="hf-sft-rows">{children}</ul>
    </div>
  );
}

function Row({
  icon,
  label,
  summary,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  summary: string;
  status: "enabled" | "disabled" | "default";
}) {
  return (
    <li className={`hf-sft-row hf-sft-row-${status}`}>
      <span className="hf-sft-row-icon">{statusIcon(status, icon)}</span>
      <span className="hf-sft-row-label">{label}</span>
      <span className="hf-sft-row-summary">{summary}</span>
      <span className={`hf-sft-row-badge hf-sft-row-badge-${status}`}>
        {statusLabel(status)}
      </span>
    </li>
  );
}

// ── Helpers ──────────────────────────────────────────────

function statusIcon(status: "enabled" | "disabled" | "default", fallback: React.ReactNode): React.ReactNode {
  if (status === "enabled") return <CheckCircle2 size={16} />;
  if (status === "disabled") return <XCircle size={16} />;
  return fallback;
}

function statusLabel(status: "enabled" | "disabled" | "default"): string {
  if (status === "enabled") return "ON";
  if (status === "disabled") return "OFF";
  return "—";
}

// Helper functions (sourceLabel, kcSummary, isPreTest, isMidTest, isPostTest,
// stopSummary, quoted) are imported from ./timeline-helpers so they can be
// unit-tested without a React renderer.
