"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FancySelect } from "@/components/shared/FancySelect";
import type { FancySelectOption } from "@/components/shared/FancySelect";

// ── Types ──────────────────────────────────────────

type CourseCheck = {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "recommended" | "optional";
  passed: boolean;
  detail: string;
  fixAction?: { label: string; href: string };
};

type DomainInfo = {
  id: string;
  slug: string;
  name: string;
  isDefault: boolean;
  callerCount: number;
};

type CallerInfo = {
  id: string;
  name: string;
};

// ── Page ───────────────────────────────────────────

export default function DemonstratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Domain selector state
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [domainOptions, setDomainOptions] = useState<FancySelectOption[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [loadingDomains, setLoadingDomains] = useState(true);

  // Caller for the selected domain (needed for prompt check + Start Lesson)
  const [callers, setCallers] = useState<CallerInfo[]>([]);
  const [selectedCallerId, setSelectedCallerId] = useState("");
  const [callerOptions, setCallerOptions] = useState<FancySelectOption[]>([]);

  // Course readiness
  const [checks, setChecks] = useState<CourseCheck[]>([]);
  const [ready, setReady] = useState(false);
  const [checksLoading, setChecksLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState<"ready" | "almost" | "incomplete">("incomplete");

  // ── Load domains on mount ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/domains");
        const data = await res.json();
        if (data.ok) {
          const list: DomainInfo[] = data.domains || [];
          setDomains(list);
          setDomainOptions(
            list.map((d) => ({
              value: d.id,
              label: d.name,
              subtitle: d.slug,
              badge: d.isDefault ? "Default" : undefined,
            })),
          );
          // Auto-select from URL param or default domain
          const urlDomainId = searchParams.get("domainId");
          if (urlDomainId && list.some((d) => d.id === urlDomainId)) {
            setSelectedDomainId(urlDomainId);
          } else {
            const defaultDomain = list.find((d) => d.isDefault);
            if (defaultDomain) setSelectedDomainId(defaultDomain.id);
            else if (list.length === 1) setSelectedDomainId(list[0].id);
          }
        }
      } catch (e) {
        console.warn("[Demonstrate] Failed to load domains:", e);
      } finally {
        setLoadingDomains(false);
      }
    })();
  }, [searchParams]);

  // ── Load callers when domain changes ──
  useEffect(() => {
    if (!selectedDomainId) {
      setCallers([]);
      setCallerOptions([]);
      setSelectedCallerId("");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/callers?scope=ALL");
        const data = await res.json();
        if (data.ok) {
          const domainCallers = (data.callers || []).filter(
            (c: any) => c.domainId === selectedDomainId,
          );
          const list: CallerInfo[] = domainCallers.map((c: any) => ({
            id: c.id,
            name: c.name || c.email || c.id,
          }));
          setCallers(list);
          setCallerOptions(
            list.map((c) => ({
              value: c.id,
              label: c.name,
            })),
          );
          // Auto-select first caller, or from URL param
          const urlCallerId = searchParams.get("callerId");
          if (urlCallerId && list.some((c) => c.id === urlCallerId)) {
            setSelectedCallerId(urlCallerId);
          } else if (list.length > 0) {
            setSelectedCallerId(list[0].id);
          } else {
            setSelectedCallerId("");
          }
        }
      } catch (e) {
        console.warn("[Demonstrate] Failed to load callers:", e);
      }
    })();
  }, [selectedDomainId, searchParams]);

  // ── Fetch course readiness ──
  const fetchReadiness = useCallback(async () => {
    if (!selectedDomainId) return;
    setChecksLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCallerId) params.set("callerId", selectedCallerId);
      const res = await fetch(`/api/domains/${selectedDomainId}/course-readiness?${params}`);
      const data = await res.json();
      if (data.ok) {
        setChecks(data.checks || []);
        setReady(data.ready ?? false);
        setScore(data.score ?? 0);
        setLevel(data.level ?? "incomplete");
      }
    } catch (e) {
      console.warn("[Demonstrate] Readiness fetch failed:", e);
    } finally {
      setChecksLoading(false);
    }
  }, [selectedDomainId, selectedCallerId]);

  // Fetch on domain/caller change
  useEffect(() => {
    if (selectedDomainId) fetchReadiness();
  }, [selectedDomainId, selectedCallerId, fetchReadiness]);

  // Poll every 10s
  useEffect(() => {
    if (!selectedDomainId) return;
    const interval = setInterval(fetchReadiness, 10_000);
    return () => clearInterval(interval);
  }, [selectedDomainId, fetchReadiness]);

  // ── Helpers ──
  const selectedDomain = domains.find((d) => d.id === selectedDomainId);

  const levelColor =
    level === "ready"
      ? "var(--status-success-text)"
      : level === "almost"
        ? "var(--status-warning-text)"
        : "var(--text-muted)";

  const levelLabel =
    level === "ready" ? "Ready" : level === "almost" ? "Almost Ready" : "Incomplete";

  // ── Render ───────────────────────────────────────

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 32px 64px" }}>
      {/* ── Header ── */}
      <div
        style={{
          marginBottom: 32,
          textAlign: "center",
          padding: "32px 24px 28px",
          borderRadius: 20,
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, var(--surface-primary)), color-mix(in srgb, var(--accent-primary) 3%, var(--surface-primary)))",
          border: "1px solid color-mix(in srgb, var(--accent-primary) 12%, transparent)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 14,
            background:
              "linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))",
            marginBottom: 16,
            boxShadow:
              "0 4px 12px color-mix(in srgb, var(--accent-primary) 30%, transparent)",
          }}
        >
          <span style={{ fontSize: 24, color: "#fff" }}>&#127916;</span>
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: 8,
            color: "var(--text-primary)",
            lineHeight: 1.1,
          }}
        >
          Demonstrate
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--text-secondary)",
            maxWidth: 480,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          Pick a domain and review readiness before starting a live lesson.
        </p>
      </div>

      {/* ── Domain Selector ── */}
      <div
        style={{
          padding: 24,
          borderRadius: 14,
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            marginBottom: 8,
          }}
        >
          Domain
        </div>
        {loadingDomains ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
            Loading domains...
          </div>
        ) : domainOptions.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
            No domains found.{" "}
            <span
              style={{ color: "var(--accent-primary)", cursor: "pointer", fontWeight: 600 }}
              onClick={() => router.push("/x/quick-launch")}
            >
              Create one with Quick Launch
            </span>
          </div>
        ) : (
          <FancySelect
            value={selectedDomainId}
            onChange={setSelectedDomainId}
            options={domainOptions}
            placeholder="Select a domain..."
            searchable={domainOptions.length > 5}
          />
        )}

        {/* Caller selector (when domain has multiple callers) */}
        {callerOptions.length > 1 && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                marginBottom: 8,
              }}
            >
              Test Caller
            </div>
            <FancySelect
              value={selectedCallerId}
              onChange={setSelectedCallerId}
              options={callerOptions}
              placeholder="Select a caller..."
              searchable={callerOptions.length > 5}
            />
          </div>
        )}
      </div>

      {/* ── Readiness Checklist ── */}
      {selectedDomainId && (
        <div
          style={{
            padding: 24,
            borderRadius: 14,
            background: "var(--surface-primary)",
            border: `1px solid ${level === "ready" ? "var(--status-success-border)" : "var(--border-default)"}`,
            marginBottom: 20,
            transition: "border-color 0.3s",
          }}
        >
          {/* Status badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
              }}
            >
              Course Readiness
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: levelColor,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: `color-mix(in srgb, ${levelColor} 12%, transparent)`,
                }}
              >
                {levelLabel}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                }}
              >
                {score}%
              </div>
            </div>
          </div>

          {/* Check items */}
          {checksLoading && checks.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
              Loading checks...
            </div>
          ) : checks.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
              No readiness checks configured.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {checks.map((check) => (
                <div
                  key={check.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: check.passed
                      ? "color-mix(in srgb, var(--status-success-bg) 50%, transparent)"
                      : "var(--surface-secondary)",
                    border: `1px solid ${check.passed ? "var(--status-success-border)" : "var(--border-default)"}`,
                    cursor: check.fixAction?.href ? "pointer" : "default",
                    transition: "background 0.15s",
                  }}
                  onClick={() => {
                    if (check.fixAction?.href) router.push(check.fixAction.href);
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                      background: check.passed
                        ? "var(--status-success-text)"
                        : check.severity === "critical"
                          ? "var(--status-error-text)"
                          : "var(--border-default)",
                      color: "#fff",
                    }}
                  >
                    {check.passed ? "\u2713" : check.severity === "critical" ? "!" : "\u2022"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {check.name}
                      {check.severity === "critical" && !check.passed && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--status-error-text)",
                            marginLeft: 6,
                          }}
                        >
                          REQUIRED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {check.detail}
                    </div>
                  </div>
                  {check.fixAction?.href && (
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--accent-primary)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {check.fixAction.label} &rarr;
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Start Lesson CTA */}
          {checks.length > 0 && (
            <button
              onClick={() => {
                if (selectedCallerId) router.push(`/x/sim/${selectedCallerId}`);
              }}
              disabled={!ready || !selectedCallerId}
              title={
                !selectedCallerId
                  ? "No caller available for this domain"
                  : !ready
                    ? "Complete required steps above first"
                    : undefined
              }
              style={{
                width: "100%",
                padding: "14px 24px",
                borderRadius: 10,
                marginTop: 16,
                background:
                  ready && selectedCallerId
                    ? "var(--accent-primary)"
                    : "var(--border-default)",
                color:
                  ready && selectedCallerId ? "white" : "var(--text-muted)",
                border: "none",
                fontSize: 16,
                fontWeight: 700,
                cursor:
                  ready && selectedCallerId ? "pointer" : "not-allowed",
                letterSpacing: "-0.01em",
                transition: "all 0.2s",
              }}
            >
              Start Lesson
            </button>
          )}
        </div>
      )}

      {/* ── Quick actions ── */}
      {selectedDomainId && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push(`/x/domains?selected=${selectedDomainId}`)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--border-default)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            View Domain
          </button>
          {selectedCallerId && (
            <button
              onClick={() => router.push(`/x/callers/${selectedCallerId}`)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid var(--border-default)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                color: "var(--text-secondary)",
              }}
            >
              View Caller
            </button>
          )}
          <button
            onClick={() => router.push("/x/quick-launch")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--border-default)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            Quick Launch
          </button>
        </div>
      )}
    </div>
  );
}
