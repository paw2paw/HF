"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface StepProps {
  setData: (key: string, value: unknown) => void;
  getData: <T = unknown>(key: string) => T | undefined;
  onNext: () => void;
  onPrev: () => void;
  endFlow: () => void;
}

type ReadinessCheck = {
  id: string;
  label: string;
  passed: boolean;
  level: string;
  actionLabel?: string;
  actionHref?: string;
};

type ReadinessResult = {
  ready: boolean;
  score: number;
  level: string;
  checks: ReadinessCheck[];
  criticalPassed: number;
  criticalTotal: number;
};

export default function DoneStep({ getData, endFlow }: StepProps) {
  const sourceId = getData<string>("sourceId");
  const sourceName = getData<string>("sourceName");
  const subjectName = getData<string>("subjectName");
  const domainId = getData<string>("domainId");
  const domainName = getData<string>("domainName");
  const lessonCount = getData<number>("lessonCount");
  const reviewedCount = getData<number>("reviewedCount");
  const assertionCount = getData<number>("assertionCount");
  const curriculumId = getData<string>("curriculumId");

  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);

  // ── Fetch course readiness ───────────────────────────
  useEffect(() => {
    if (!domainId) return;
    setLoadingReadiness(true);
    const params = new URLSearchParams({ domainId });
    if (sourceId) params.set("sourceId", sourceId);
    fetch(`/api/domains/${domainId}/course-readiness?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setReadiness({
            ready: data.ready,
            score: data.score,
            level: data.level,
            checks: data.checks || [],
            criticalPassed: data.criticalPassed,
            criticalTotal: data.criticalTotal,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingReadiness(false));
  }, [domainId, sourceId]);

  const scorePct = readiness ? Math.round(readiness.score * 100) : 0;

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
        You&apos;re all set!
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>
        Here&apos;s a summary of everything you&apos;ve configured.
      </p>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16, marginBottom: 24 }}>
        {/* Content card */}
        <SummaryCard title="Content" icon="\uD83D\uDCDA">
          <SummaryRow label="Source" value={sourceName || "—"} />
          {assertionCount != null && <SummaryRow label="Assertions" value={String(assertionCount)} />}
          {reviewedCount != null && (
            <SummaryRow label="Reviewed" value={assertionCount ? `${reviewedCount}/${assertionCount}` : String(reviewedCount)} />
          )}
        </SummaryCard>

        {/* Curriculum card */}
        <SummaryCard title="Curriculum" icon="\uD83C\uDF93">
          <SummaryRow label="Subject" value={subjectName || "—"} />
          {curriculumId && <SummaryRow label="Curriculum" value="Generated" />}
          {lessonCount != null && <SummaryRow label="Lesson plan" value={`${lessonCount} sessions`} />}
        </SummaryCard>

        {/* Delivery card */}
        <SummaryCard title="Delivery" icon="\uD83D\uDCE1">
          <SummaryRow label="Domain" value={domainName || "—"} />
          {domainId && <SummaryRow label="Onboarding" value="Configured" />}
        </SummaryCard>
      </div>

      {/* Course Readiness */}
      {domainId && (
        <div style={{
          padding: 20, borderRadius: 12, marginBottom: 24,
          border: "1px solid var(--border-default)", background: "var(--surface-primary)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              Course Readiness
            </h3>
            {loadingReadiness ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Checking...</span>
            ) : readiness ? (
              <span style={{
                padding: "3px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                color: readiness.ready ? "var(--status-success-text, #16a34a)" : "var(--status-error-text)",
                background: readiness.ready
                  ? "color-mix(in srgb, var(--status-success-text, #16a34a) 10%, transparent)"
                  : "color-mix(in srgb, var(--status-error-text) 10%, transparent)",
              }}>
                {readiness.ready ? `${scorePct}% Ready` : `${scorePct}% — Not Ready`}
              </span>
            ) : null}
          </div>

          {readiness && (
            <>
              {/* Progress bar */}
              <div style={{ height: 8, borderRadius: 4, background: "var(--surface-tertiary)", overflow: "hidden", marginBottom: 16 }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  background: readiness.ready
                    ? "var(--status-success-text, #16a34a)"
                    : "linear-gradient(90deg, var(--accent-primary), #6366f1)",
                  width: `${scorePct}%`, transition: "width 0.3s ease-out",
                }} />
              </div>

              {/* Checks */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {readiness.checks.map((check) => (
                  <div key={check.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    borderRadius: 6, background: "var(--surface-secondary)",
                  }}>
                    <span style={{
                      width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "50%", fontSize: 11, fontWeight: 700,
                      background: check.passed
                        ? "color-mix(in srgb, var(--status-success-text, #16a34a) 15%, transparent)"
                        : "color-mix(in srgb, var(--status-error-text) 15%, transparent)",
                      color: check.passed ? "var(--status-success-text, #16a34a)" : "var(--status-error-text)",
                    }}>
                      {check.passed ? "\u2713" : "\u2717"}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>
                      {check.label}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                      color: check.level === "critical" ? "var(--status-error-text)" : "var(--text-muted)",
                    }}>
                      {check.level}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {sourceId && (
          <ActionLink href={`/x/content-sources/${sourceId}`} label="View Source Details" onClick={endFlow} />
        )}
        {domainId && (
          <ActionLink href={`/x/domains?id=${domainId}`} label="Go to Domain" onClick={endFlow} />
        )}
        {domainId && (
          <ActionLink href={`/x/teach?domainId=${domainId}`} label="Teach This" primary onClick={endFlow} />
        )}
        <button
          onClick={endFlow}
          style={{
            padding: "12px 24px", borderRadius: 8,
            border: "1px solid var(--border-default)", background: "transparent",
            color: "var(--text-secondary)", fontSize: 14, cursor: "pointer",
          }}
        >
          Start Another
        </button>
      </div>
    </div>
  );
}

// ── Shared components ──────────────────────────────────

function SummaryCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: 16, borderRadius: 10,
      border: "1px solid var(--border-default)", background: "var(--surface-primary)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function ActionLink({ href, label, primary, onClick }: { href: string; label: string; primary?: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        padding: "12px 24px", borderRadius: 8, textDecoration: "none",
        fontSize: 14, fontWeight: primary ? 700 : 500, cursor: "pointer",
        background: primary ? "var(--accent-primary)" : "transparent",
        color: primary ? "#fff" : "var(--accent-primary)",
        border: primary ? "none" : "1px solid var(--accent-primary)",
      }}
    >
      {label}
    </Link>
  );
}
