"use client";

import { useEffect, useState } from "react";
import { useTerminology } from "@/contexts/TerminologyContext";
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

interface ReadinessAction {
  id: string;
  name: string;
  detail: string;
  severity: "critical" | "recommended" | "optional";
  fixAction?: { label: string; href: string };
}

interface DomainReadiness {
  domainId: string;
  domainName: string;
  ready: boolean;
  score: number;
  level: "ready" | "almost" | "incomplete";
  educatorActions: ReadinessAction[];
  adminActions: ReadinessAction[];
}

interface ReadinessData {
  domains: DomainReadiness[];
  overallReady: boolean;
  overallLevel: "ready" | "almost" | "incomplete";
}

interface EducatorReadinessProps {
  institutionId?: string;
}

const levelConfig = {
  ready: {
    bg: "var(--status-success-bg)",
    text: "var(--status-success-text)",
    icon: CheckCircle,
    label: "Ready for learners",
  },
  almost: {
    bg: "var(--status-warning-bg)",
    text: "var(--status-warning-text)",
    icon: AlertTriangle,
    label: "Almost ready",
  },
  incomplete: {
    bg: "var(--status-error-bg)",
    text: "var(--status-error-text)",
    icon: XCircle,
    label: "Setup needed",
  },
};

export default function EducatorReadiness({ institutionId }: EducatorReadinessProps) {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const { lower, lowerPlural } = useTerminology();

  useEffect(() => {
    const url = institutionId
      ? `/api/educator/readiness?institutionId=${institutionId}`
      : "/api/educator/readiness";

    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
      })
      .finally(() => setLoading(false));
  }, [institutionId]);

  if (loading || !data || data.domains.length === 0) return null;

  const config = levelConfig[data.overallLevel];
  const Icon = config.icon;
  const hasActions = data.domains.some(
    (d) => d.educatorActions.length > 0 || d.adminActions.length > 0
  );

  return (
    <div
      style={{
        background: config.bg,
        border: `1px solid color-mix(in srgb, ${config.text} 20%, transparent)`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
      }}
    >
      <button
        onClick={() => hasActions && setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          background: "none",
          border: "none",
          cursor: hasActions ? "pointer" : "default",
          padding: 0,
          textAlign: "left",
        }}
      >
        <Icon size={20} style={{ color: config.text, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: config.text }}>
            {config.label}
          </div>
          <div style={{ fontSize: 12, color: config.text, opacity: 0.8 }}>
            {data.overallReady
              ? `All domains are ready for ${lowerPlural("caller")}`
              : `${data.domains.filter((d) => !d.ready).length} domain(s) need attention`}
          </div>
        </div>
        {hasActions && (
          expanded
            ? <ChevronUp size={16} style={{ color: config.text }} />
            : <ChevronDown size={16} style={{ color: config.text }} />
        )}
      </button>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          {data.domains
            .filter((d) => d.educatorActions.length > 0 || d.adminActions.length > 0)
            .map((domain) => (
              <div key={domain.domainId} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: config.text,
                    marginBottom: 8,
                  }}
                >
                  {domain.domainName} — {domain.score}%
                </div>

                {domain.educatorActions.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: config.text,
                        opacity: 0.7,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 4,
                      }}
                    >
                      You can fix
                    </div>
                    {domain.educatorActions.map((action) => (
                      <div
                        key={action.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 0",
                          borderBottom: `1px solid color-mix(in srgb, ${config.text} 10%, transparent)`,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, color: config.text }}>
                            {action.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: config.text,
                              opacity: 0.7,
                            }}
                          >
                            {action.detail}
                          </div>
                        </div>
                        {action.fixAction && (
                          <a
                            href={action.fixAction.href}
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: config.text,
                              textDecoration: "underline",
                              whiteSpace: "nowrap",
                              marginLeft: 8,
                            }}
                          >
                            {action.fixAction.label}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {domain.adminActions.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: config.text,
                        opacity: 0.7,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 4,
                      }}
                    >
                      Ask your admin
                    </div>
                    {domain.adminActions.map((action) => (
                      <div
                        key={action.id}
                        style={{
                          padding: "6px 0",
                          borderBottom: `1px solid color-mix(in srgb, ${config.text} 10%, transparent)`,
                        }}
                      >
                        <div style={{ fontSize: 13, color: config.text }}>
                          {action.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: config.text,
                            opacity: 0.7,
                          }}
                        >
                          {action.detail}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
