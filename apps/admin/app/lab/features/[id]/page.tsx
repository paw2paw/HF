"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type CompiledParameter = {
  id: string;
  name: string;
  definition: string;
  formula?: string;
  components?: { id: string; name: string; weight?: number; definition?: string }[];
  source: string;
};

type CompiledConstraint = {
  id: string;
  description: string;
  severity: "critical" | "warning";
  threshold?: string | number;
  source: string;
};

type CompiledValidation = {
  name: string;
  tags?: string[];
  given: string[];
  when: string[];
  then: string[];
  source: string;
};

type Definition = {
  term: string;
  definition: string;
  source: string;
  type: string;
};

type ThresholdValue = {
  name: string;
  value: string | number;
  source: string;
  parameterId?: string;
};

type CreatedSpec = {
  id: string;
  slug: string;
  name: string;
  outputType: string;
  specType: string;
  scope: string;
  isActive: boolean;
};

type CreatedParameter = {
  parameterId: string;
  name: string;
  domainGroup: string;
  isActive: boolean;
};

type CreatedPromptSlug = {
  id: string;
  slug: string;
  name: string;
  sourceType: string;
  isActive: boolean;
};

type CreatedAnchor = {
  id: string;
  parameterId: string;
  score: number;
  example: string;
};

type BDDFeatureSet = {
  id: string;
  featureId: string;
  name: string;
  description: string | null;
  version: string;
  parameters: CompiledParameter[];
  constraints: CompiledConstraint[];
  validations: CompiledValidation[];
  promptGuidance: Record<string, string>;
  definitions: Record<string, Definition>;
  thresholds: Record<string, ThresholdValue>;
  parameterCount: number;
  constraintCount: number;
  definitionCount: number;
  isActive: boolean;
  activatedAt: string | null;
  compiledAt: string;
  lastTestAt: string | null;
  uploads: {
    id: string;
    filename: string;
    fileType: string;
    status: string;
    name: string | null;
    uploadedAt: string;
  }[];
  // Created entities (provenance)
  createdSpecs?: CreatedSpec[];
  createdParameters?: CreatedParameter[];
  createdPromptSlugs?: CreatedPromptSlug[];
  createdAnchors?: CreatedAnchor[];
};

export default function FeatureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [feature, setFeature] = useState<BDDFeatureSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dictionary" | "parameters" | "constraints" | "validations" | "sources" | "entities">("dictionary");

  useEffect(() => {
    const fetchFeature = async () => {
      try {
        const res = await fetch(`/api/lab/features/${params.id}`);
        const data = await res.json();
        if (data.ok) {
          setFeature(data.feature);
        }
      } catch (err) {
        console.error("Failed to fetch feature:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeature();
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm("Delete this feature set? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/lab/features/${params.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        router.push("/lab/features");
      }
    } catch (err) {
      console.error("Failed to delete feature:", err);
    }
  };

  const handleActivate = async () => {
    if (!feature) return;

    try {
      const res = await fetch(`/api/lab/features/${params.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activate: !feature.isActive }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeature({ ...feature, isActive: data.feature.isActive, activatedAt: data.feature.activatedAt });
      }
    } catch (err) {
      console.error("Failed to toggle activation:", err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        Loading feature set...
      </div>
    );
  }

  if (!feature) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#374151" }}>Feature set not found</div>
        <Link href="/lab/features" style={{ color: "#4f46e5", marginTop: 12, display: "inline-block" }}>
          ← Back to Feature Sets
        </Link>
      </div>
    );
  }

  const definitions = Object.values(feature.definitions || {});
  const thresholds = Object.entries(feature.thresholds || {});
  const createdEntitiesCount =
    (feature.createdSpecs?.length || 0) +
    (feature.createdParameters?.length || 0) +
    (feature.createdPromptSlugs?.length || 0);

  const tabs = [
    { id: "dictionary", label: "Data Dictionary", count: definitions.length },
    { id: "parameters", label: "Parameters", count: feature.parameters?.length || 0 },
    { id: "constraints", label: "Constraints", count: feature.constraints?.length || 0 },
    { id: "validations", label: "Validations", count: feature.validations?.length || 0 },
    { id: "sources", label: "Sources", count: feature.uploads?.length || 0 },
    { id: "entities", label: "Created Entities", count: createdEntitiesCount },
  ] as const;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Link href="/lab/features" style={{ color: "#6b7280", textDecoration: "none" }}>
            ← Feature Sets
          </Link>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{feature.name}</h1>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  background: "#f3f4f6",
                  color: "#6b7280",
                  borderRadius: 4,
                  fontWeight: 500,
                }}
              >
                v{feature.version}
              </span>
              {feature.isActive && (
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    background: "#dcfce7",
                    color: "#166534",
                    borderRadius: 4,
                    fontWeight: 500,
                  }}
                >
                  Active
                </span>
              )}
            </div>
            {feature.description && (
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>{feature.description}</p>
            )}
            <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
              Feature ID: <code style={{ background: "#f3f4f6", padding: "2px 4px", borderRadius: 3 }}>{feature.featureId}</code>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href={`/lab/features/${feature.id}/test`}
              style={{
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 500,
                background: "#fef3c7",
                color: "#92400e",
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              Test Feature
            </Link>
            <button
              onClick={handleActivate}
              style={{
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 500,
                background: feature.isActive ? "#fef2f2" : "#f0fdf4",
                color: feature.isActive ? "#dc2626" : "#166534",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {feature.isActive ? "Deactivate" : "Activate"}
            </button>
            <button
              onClick={handleDelete}
              style={{
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 500,
                background: "#fff",
                color: "#dc2626",
                border: "1px solid #fecaca",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ background: "#eef2ff", padding: 16, borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#4f46e5" }}>{feature.parameterCount}</div>
          <div style={{ fontSize: 12, color: "#6366f1" }}>Parameters</div>
        </div>
        <div style={{ background: "#faf5ff", padding: 16, borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#8b5cf6" }}>{feature.constraintCount}</div>
          <div style={{ fontSize: 12, color: "#a78bfa" }}>Constraints</div>
        </div>
        <div style={{ background: "#f0fdf4", padding: 16, borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>{feature.definitionCount}</div>
          <div style={{ fontSize: 12, color: "#34d399" }}>Definitions</div>
        </div>
        <div style={{ background: "#fef3c7", padding: 16, borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>{thresholds.length}</div>
          <div style={{ fontSize: 12, color: "#fbbf24" }}>Thresholds</div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: 4,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 500,
              background: activeTab === tab.id ? "#4f46e5" : "transparent",
              color: activeTab === tab.id ? "#fff" : "#6b7280",
              border: "none",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
        {/* Data Dictionary Tab */}
        {activeTab === "dictionary" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Data Dictionary</h3>
            {definitions.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>No definitions</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Term</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Definition</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Type</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {definitions.map((def, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 500 }}>{typeof def.term === 'object' ? JSON.stringify(def.term) : def.term}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151" }}>{typeof def.definition === 'object' ? JSON.stringify(def.definition) : def.definition}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            background: def.type === "parameter" ? "#dbeafe" : def.type === "constraint" ? "#fef3c7" : "#e5e7eb",
                            color: def.type === "parameter" ? "#1d4ed8" : def.type === "constraint" ? "#92400e" : "#6b7280",
                            borderRadius: 4,
                          }}
                        >
                          {def.type}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#9ca3af" }}>{def.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Thresholds Section */}
            {thresholds.length > 0 && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16 }}>Thresholds</h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Key</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Name</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Value</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {thresholds.map(([key, t]) => (
                      <tr key={key} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 12px", fontSize: 12, fontFamily: "monospace", color: "#6b7280" }}>{key}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13 }}>{typeof t.name === 'object' ? JSON.stringify(t.name) : t.name}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "#4f46e5" }}>{typeof t.value === 'object' ? JSON.stringify(t.value) : String(t.value)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "#9ca3af" }}>{typeof t.source === 'object' ? JSON.stringify(t.source) : t.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* Parameters Tab */}
        {activeTab === "parameters" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Parameters</h3>
            {!feature.parameters || feature.parameters.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>No parameters</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {feature.parameters.map((param) => (
                  <div
                    key={param.id}
                    style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{param.name}</span>
                        <code style={{ marginLeft: 8, fontSize: 11, background: "#f3f4f6", padding: "2px 6px", borderRadius: 3 }}>
                          {param.id}
                        </code>
                      </div>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>{param.source}</span>
                    </div>
                    {param.definition && (
                      <p style={{ fontSize: 13, color: "#374151", margin: "0 0 8px 0" }}>{typeof param.definition === 'object' ? JSON.stringify(param.definition) : param.definition}</p>
                    )}
                    {param.formula && (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Formula: <code style={{ background: "#f3f4f6", padding: "2px 4px" }}>{param.formula}</code>
                      </div>
                    )}
                    {param.components && param.components.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Components:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {param.components.map((c) => (
                            <span
                              key={c.id}
                              style={{ fontSize: 11, padding: "4px 8px", background: "#eef2ff", color: "#4338ca", borderRadius: 4 }}
                            >
                              {c.name} {c.weight ? `(${c.weight})` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Constraints Tab */}
        {activeTab === "constraints" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Constraints</h3>
            {!feature.constraints || feature.constraints.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>No constraints</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {feature.constraints.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      border: `1px solid ${c.severity === "critical" ? "#fecaca" : "#fef3c7"}`,
                      background: c.severity === "critical" ? "#fef2f2" : "#fffbeb",
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{c.severity === "critical" ? "🔴" : "🟡"}</span>
                    <div style={{ flex: 1 }}>
                      <code style={{ fontSize: 11, color: "#6b7280" }}>{c.id}</code>
                      <div style={{ fontSize: 13, marginTop: 2 }}>{typeof c.description === 'object' ? JSON.stringify(c.description) : c.description}</div>
                    </div>
                    {c.threshold && (
                      <span style={{ fontSize: 12, color: "#6b7280" }}>
                        Threshold: <strong>{typeof c.threshold === 'object' ? JSON.stringify(c.threshold) : String(c.threshold)}</strong>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Validations Tab */}
        {activeTab === "validations" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Gherkin Validations</h3>
            {!feature.validations || feature.validations.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>No validations</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {feature.validations.map((v, i) => (
                  <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                      Scenario: {v.name}
                      {v.tags && v.tags.length > 0 && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "#6b7280" }}>
                          {v.tags.map((t) => `@${t}`).join(" ")}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.8 }}>
                      {v.given.map((g, gi) => (
                        <div key={gi}><span style={{ color: "#8b5cf6" }}>Given</span> {g}</div>
                      ))}
                      {v.when.map((w, wi) => (
                        <div key={wi}><span style={{ color: "#f59e0b" }}>When</span> {w}</div>
                      ))}
                      {v.then.map((t, ti) => (
                        <div key={ti}><span style={{ color: "#10b981" }}>Then</span> {t}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sources Tab */}
        {activeTab === "sources" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Source Files</h3>
            {!feature.uploads || feature.uploads.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>No source files</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {feature.uploads.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      background: "#f9fafb",
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{u.fileType === "STORY" ? "📖" : "📐"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{u.filename}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {u.name || u.fileType} • Uploaded {new Date(u.uploadedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        background: "#dcfce7",
                        color: "#166534",
                        borderRadius: 4,
                      }}
                    >
                      {u.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Created Entities Tab */}
        {activeTab === "entities" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              Created Entities
              {!feature.isActive && (
                <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 400, color: "#6b7280" }}>
                  (Activate this feature set to create entities in production)
                </span>
              )}
            </h3>

            {createdEntitiesCount === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
                {feature.isActive
                  ? "No entities created yet"
                  : "Activate this feature set to create specs, parameters, and prompt slugs"}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Created Specs */}
                {feature.createdSpecs && feature.createdSpecs.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#4f46e5", marginBottom: 8 }}>
                      Analysis Specs ({feature.createdSpecs.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {feature.createdSpecs.map((spec) => (
                        <Link
                          key={spec.id}
                          href={`/analysis-specs?select=${spec.id}`}
                          style={{ textDecoration: "none" }}
                        >
                          <div
                            style={{
                              padding: "8px 12px",
                              background: spec.outputType === "MEASURE" ? "#eef2ff" : "#fffbeb",
                              border: `1px solid ${spec.outputType === "MEASURE" ? "#c7d2fe" : "#fde68a"}`,
                              borderRadius: 6,
                              fontSize: 13,
                            }}
                          >
                            <div style={{ fontWeight: 500, color: spec.outputType === "MEASURE" ? "#4338ca" : "#92400e" }}>
                              {spec.name}
                            </div>
                            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                              {spec.outputType} • {spec.scope}
                              {!spec.isActive && " • inactive"}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Created Parameters */}
                {feature.createdParameters && feature.createdParameters.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#059669", marginBottom: 8 }}>
                      Parameters ({feature.createdParameters.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {feature.createdParameters.map((param) => (
                        <Link
                          key={param.parameterId}
                          href={`/data-dictionary?search=${param.parameterId}`}
                          style={{ textDecoration: "none" }}
                        >
                          <div
                            style={{
                              padding: "8px 12px",
                              background: "#d1fae5",
                              border: "1px solid #a7f3d0",
                              borderRadius: 6,
                              fontSize: 13,
                            }}
                          >
                            <div style={{ fontWeight: 500, color: "#065f46" }}>
                              {param.name || param.parameterId}
                            </div>
                            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                              {param.domainGroup}
                              {!param.isActive && " • inactive"}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Created Prompt Slugs */}
                {feature.createdPromptSlugs && feature.createdPromptSlugs.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#7c3aed", marginBottom: 8 }}>
                      Prompt Slugs ({feature.createdPromptSlugs.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {feature.createdPromptSlugs.map((slug) => (
                        <Link
                          key={slug.id}
                          href={`/prompt-slugs?select=${slug.id}`}
                          style={{ textDecoration: "none" }}
                        >
                          <div
                            style={{
                              padding: "8px 12px",
                              background: "#f3e8ff",
                              border: "1px solid #ddd6fe",
                              borderRadius: 6,
                              fontSize: 13,
                            }}
                          >
                            <div style={{ fontWeight: 500, color: "#6d28d9" }}>
                              {slug.name}
                            </div>
                            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                              {slug.sourceType}
                              {!slug.isActive && " • inactive"}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Created Anchors Summary */}
                {feature.createdAnchors && feature.createdAnchors.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#d97706", marginBottom: 8 }}>
                      Scoring Anchors ({feature.createdAnchors.length})
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {feature.createdAnchors.length} anchors created across{" "}
                      {new Set(feature.createdAnchors.map((a) => a.parameterId)).size} parameters
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
