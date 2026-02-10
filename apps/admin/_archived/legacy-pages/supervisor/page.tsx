"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

type Domain = {
  id: string;
  slug: string;
  name: string;
};

type SpecInfo = {
  id: string;
  slug: string;
  name: string;
  outputType: string;
  specRole: string | null;
  scope: string;
  isActive: boolean;
  priority: number;
  domain: string | null;
};

type PipelineStage = {
  name: string;
  order: number;
  outputTypes: string[];
  description?: string;
  batched?: boolean;
  requiresMode?: "prep" | "prompt";
  systemSpecs: SpecInfo[];
  domainSpecs: SpecInfo[];
  totalSpecs: number;
};

type SupervisorData = {
  superviseSpec: { id: string; slug: string; name: string } | null;
  domain: Domain | null;
  playbook: { id: string; name: string; status: string } | null;
  stages: PipelineStage[];
  allDomains: Domain[];
  counts: {
    stages: number;
    systemSpecs: number;
    domainSpecs: number;
    totalSpecs: number;
    domains: number;
  };
};

export default function SupervisorPage() {
  const [data, setData] = useState<SupervisorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string>("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const url = selectedDomainId
        ? `/api/supervisor?domainId=${selectedDomainId}`
        : "/api/supervisor";
      const res = await fetch(url);
      const result = await res.json();

      if (result.ok) {
        setData(result);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDomainId]);

  const outputTypeBadge = (outputType: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      LEARN: { bg: "#ede9fe", color: "#5b21b6" },
      MEASURE: { bg: "#dcfce7", color: "#166534" },
      MEASURE_AGENT: { bg: "#dbeafe", color: "#1e40af" },
      AGGREGATE: { bg: "#fef3c7", color: "#92400e" },
      REWARD: { bg: "#fee2e2", color: "#991b1b" },
      ADAPT: { bg: "#fce7f3", color: "#be185d" },
      SUPERVISE: { bg: "#fed7aa", color: "#9a3412" },
      COMPOSE: { bg: "#e0e7ff", color: "#4338ca" },
    };
    const s = styles[outputType] || { bg: "#f3f4f6", color: "#6b7280" };
    return (
      <span
        style={{
          fontSize: 9,
          padding: "2px 6px",
          background: s.bg,
          color: s.color,
          borderRadius: 4,
          fontWeight: 500,
        }}
      >
        {outputType}
      </span>
    );
  };

  const scopeBadge = (scope: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      SYSTEM: { bg: "#dbeafe", color: "#1e40af" },
      DOMAIN: { bg: "#d1fae5", color: "#065f46" },
    };
    const s = styles[scope] || { bg: "#f3f4f6", color: "#6b7280" };
    return (
      <span
        style={{
          fontSize: 9,
          padding: "2px 6px",
          background: s.bg,
          color: s.color,
          borderRadius: 4,
          fontWeight: 500,
        }}
      >
        {scope}
      </span>
    );
  };

  const stageIcon = (stageName: string) => {
    const icons: Record<string, string> = {
      EXTRACT: "🔍",
      SCORE_AGENT: "📊",
      AGGREGATE: "🧮",
      REWARD: "⭐",
      ADAPT: "🎯",
      SUPERVISE: "👁️",
      COMPOSE: "✍️",
    };
    return icons[stageName] || "📋";
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ color: "#dc2626" }}>Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 32 }}>
        <div>No data available</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      <SourcePageHeader
        title="Pipeline Supervisor"
        description="View pipeline configuration and specs organized by execution stage"
        dataNodeId="supervisor"
      />

      {/* Info Bar */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          display: "flex",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
            Pipeline Configuration
          </div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            {data.superviseSpec ? (
              <Link href={`/analysis-specs?id=${data.superviseSpec.id}`}>
                {data.superviseSpec.name} ({data.superviseSpec.slug})
              </Link>
            ) : (
              <span style={{ color: "#dc2626" }}>Default (no SUPERVISE spec found)</span>
            )}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
            Stages
          </div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{data.counts.stages}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
            System Specs
          </div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{data.counts.systemSpecs}</div>
        </div>
        {selectedDomainId && (
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              Domain Specs
            </div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{data.counts.domainSpecs}</div>
          </div>
        )}
      </div>

      {/* Domain Selector */}
      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 500,
            color: "#374151",
            marginBottom: 8,
          }}
        >
          Domain (optional)
        </label>
        <select
          value={selectedDomainId}
          onChange={(e) => setSelectedDomainId(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            minWidth: 300,
          }}
        >
          <option value="">All Domains (System specs only)</option>
          {data.allDomains.map((domain) => (
            <option key={domain.id} value={domain.id}>
              {domain.name} ({domain.slug})
            </option>
          ))}
        </select>

        {data.playbook && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
            Using playbook:{" "}
            <Link
              href={`/playbooks/${data.playbook.id}`}
              style={{ color: "#4f46e5", fontWeight: 500 }}
            >
              {data.playbook.name}
            </Link>{" "}
            ({data.playbook.status})
          </div>
        )}
      </div>

      {/* Pipeline Stages */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {data.stages.map((stage) => (
          <div
            key={stage.name}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {/* Stage Header */}
            <div
              style={{
                background: "#f9fafb",
                padding: 16,
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 24 }}>{stageIcon(stage.name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                    {stage.order}. {stage.name}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    {stage.description || "No description"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {stage.batched && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        background: "#ede9fe",
                        color: "#5b21b6",
                        borderRadius: 4,
                        fontWeight: 500,
                      }}
                    >
                      BATCHED
                    </span>
                  )}
                  {stage.requiresMode && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        background: "#fef3c7",
                        color: "#92400e",
                        borderRadius: 4,
                        fontWeight: 500,
                      }}
                    >
                      {stage.requiresMode.toUpperCase()} ONLY
                    </span>
                  )}
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#6b7280",
                    }}
                  >
                    {stage.totalSpecs} spec{stage.totalSpecs !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                {stage.outputTypes.map((type) => (
                  <span key={type}>{outputTypeBadge(type)}</span>
                ))}
              </div>
            </div>

            {/* Specs List */}
            <div>
              {/* System Specs */}
              {stage.systemSpecs.length > 0 && (
                <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#1e40af",
                      marginBottom: 12,
                    }}
                  >
                    SYSTEM SPECS ({stage.systemSpecs.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {stage.systemSpecs.map((spec) => (
                      <div
                        key={spec.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: 8,
                          background: "#f9fafb",
                          borderRadius: 6,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <Link
                            href={`/analysis-specs?id=${spec.id}`}
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#111827",
                            }}
                          >
                            {spec.name}
                          </Link>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>
                            {spec.slug}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {scopeBadge(spec.scope)}
                          {outputTypeBadge(spec.outputType)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Domain Specs */}
              {stage.domainSpecs.length > 0 && (
                <div style={{ padding: 16 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#065f46",
                      marginBottom: 12,
                    }}
                  >
                    DOMAIN SPECS ({stage.domainSpecs.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {stage.domainSpecs.map((spec) => (
                      <div
                        key={spec.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: 8,
                          background: "#f9fafb",
                          borderRadius: 6,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <Link
                            href={`/analysis-specs?id=${spec.id}`}
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#111827",
                            }}
                          >
                            {spec.name}
                          </Link>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>
                            {spec.slug}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {scopeBadge(spec.scope)}
                          {outputTypeBadge(spec.outputType)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {stage.systemSpecs.length === 0 && stage.domainSpecs.length === 0 && (
                <div
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: 13,
                  }}
                >
                  No specs configured for this stage
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
