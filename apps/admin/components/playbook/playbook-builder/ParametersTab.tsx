"use client";

export type ParameterCategory = {
  category: string;
  icon: string;
  description: string;
  parameters: {
    id: string;
    parameterId: string;
    name: string;
    definition: string | null;
    scaleType: string;
    parameterType: string;
    interpretationHigh: string | null;
    interpretationLow: string | null;
    sourceFeatureSet?: { id: string; featureId: string; name: string; version: string } | null;
    scoringAnchors: {
      id: string;
      score: number;
      example: string;
      rationale: string | null;
      positiveSignals: string[];
      negativeSignals: string[];
      isGold: boolean;
    }[];
    usedBySpecs: { specId: string; specSlug: string; specName: string }[];
  }[];
};

export type ParametersData = {
  categories: ParameterCategory[];
  counts: { parameters: number; anchors: number; categories: number };
};

export interface ParametersTabContentProps {
  parametersLoading: boolean;
  parametersData: ParametersData | null;
  activeFilter: string | null;
  setActiveFilter: (filter: string | null) => void;
  toggleFilter: (filter: string) => void;
  parameterSearch: string;
  setParameterSearch: (search: string) => void;
  expandedParamCategories: Set<string>;
  toggleParamCategoryExpand: (category: string) => void;
  expandedParams: Set<string>;
  toggleParamExpand: (paramId: string) => void;
}

export function ParametersTabContent({
  parametersLoading,
  parametersData,
  activeFilter,
  setActiveFilter,
  toggleFilter,
  parameterSearch,
  setParameterSearch,
  expandedParamCategories,
  toggleParamCategoryExpand,
  expandedParams,
  toggleParamExpand,
}: ParametersTabContentProps) {
  return (
        <div style={{ marginTop: 24 }}>
          {parametersLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Loading parameters...
            </div>
          ) : !parametersData ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Failed to load parameters data
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Summary - Clickable Filters */}
              <div style={{
                padding: 16,
                background: "var(--background)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}>
                <button
                  onClick={() => setActiveFilter(null)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: activeFilter === null ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
                    background: activeFilter === null ? "var(--status-info-bg)" : "var(--surface-primary)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: 70,
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>All</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === null ? "var(--button-primary-bg)" : "var(--text-primary)" }}>{parametersData.counts.parameters}</div>
                </button>
                {parametersData.categories.map(cat => (
                  <button
                    key={cat.category}
                    onClick={() => toggleFilter(cat.category)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: activeFilter === cat.category ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
                      background: activeFilter === cat.category ? "var(--status-info-bg)" : "var(--surface-primary)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: 70,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>{cat.icon} {cat.category}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === cat.category ? "var(--button-primary-bg)" : "var(--text-primary)" }}>{cat.parameters.length}</div>
                  </button>
                ))}
                <div style={{ marginLeft: "auto", position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Search parameters..."
                    value={parameterSearch}
                    onChange={(e) => setParameterSearch(e.target.value)}
                    style={{
                      padding: "8px 12px 8px 32px",
                      borderRadius: 6,
                      border: "1px solid var(--border-default)",
                      background: "var(--surface-primary)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      width: 200,
                      outline: "none",
                    }}
                  />
                  <span style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    fontSize: 14,
                    pointerEvents: "none",
                  }}>🔍</span>
                  {parameterSearch && (
                    <button
                      onClick={() => setParameterSearch("")}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        fontSize: 12,
                        padding: 0,
                      }}
                    >✕</button>
                  )}
                </div>
              </div>

              {/* Categories */}
              <div style={{
                background: "var(--surface-primary)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                overflow: "hidden",
                maxHeight: "calc(100vh - 400px)",
                overflowY: "auto",
              }}>
                {parametersData.categories
                  .filter(category => !activeFilter || activeFilter === category.category)
                  .map((category) => {
                    const searchLower = parameterSearch.toLowerCase();
                    const filteredParams = parameterSearch
                      ? category.parameters.filter(p =>
                          p.parameterId.toLowerCase().includes(searchLower) ||
                          p.name.toLowerCase().includes(searchLower) ||
                          (p.definition && p.definition.toLowerCase().includes(searchLower))
                        )
                      : category.parameters;
                    if (parameterSearch && filteredParams.length === 0) return null;
                    return (
                  <div key={category.category}>
                    {/* Category Header */}
                    <div
                      onClick={() => toggleParamCategoryExpand(category.category)}
                      style={{
                        padding: "12px 16px",
                        background: "var(--background)",
                        borderBottom: "1px solid var(--border-default)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{category.icon}</span>
                      <span style={{ fontWeight: 600 }}>{category.category}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>({filteredParams.length}{parameterSearch && filteredParams.length !== category.parameters.length ? ` / ${category.parameters.length}` : ""})</span>
                      <span style={{ marginLeft: "auto", color: "var(--text-placeholder)", fontSize: 12 }}>
                        {expandedParamCategories.has(category.category) ? "▼" : "▶"}
                      </span>
                    </div>
                    {/* Category Content */}
                    {expandedParamCategories.has(category.category) && (
                      <div style={{ padding: "8px 0" }}>
                        {filteredParams.map((param) => (
                          <div key={param.parameterId}>
                            {/* Parameter Header */}
                            <div
                              onClick={() => toggleParamExpand(param.parameterId)}
                              style={{
                                padding: "8px 16px 8px 32px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                borderBottom: "1px solid var(--border-subtle)",
                              }}
                            >
                              <span style={{
                                fontSize: 11,
                                fontFamily: "monospace",
                                color: "var(--button-primary-bg)",
                                background: "var(--status-info-bg)",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}>
                                {param.parameterId}
                              </span>
                              <span style={{ fontWeight: 500 }}>{param.name}</span>
                              {param.sourceFeatureSet && (
                                <a
                                  href={`/lab/features/${param.sourceFeatureSet.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    fontSize: 10,
                                    background: "var(--status-success-bg)",
                                    color: "var(--status-success-text)",
                                    padding: "1px 6px",
                                    borderRadius: 3,
                                    textDecoration: "none",
                                  }}
                                >
                                  📦 {param.sourceFeatureSet.name}
                                </a>
                              )}
                              {param.scoringAnchors.length > 0 && (
                                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                                  {param.scoringAnchors.length} anchors
                                </span>
                              )}
                              <span style={{ marginLeft: "auto", color: "var(--text-placeholder)", fontSize: 11 }}>
                                {expandedParams.has(param.parameterId) ? "▼" : "▶"}
                              </span>
                            </div>
                            {/* Parameter Details */}
                            {expandedParams.has(param.parameterId) && (
                              <div style={{ padding: "8px 16px 16px 48px", background: "var(--background)" }}>
                                {param.definition && (
                                  <div style={{ marginBottom: 8, color: "var(--text-secondary)", fontSize: 13 }}>
                                    {param.definition}
                                  </div>
                                )}
                                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, fontSize: 12 }}>
                                  <div>
                                    <span style={{ color: "var(--text-muted)" }}>Scale:</span>{" "}
                                    <span style={{ fontWeight: 500 }}>{param.scaleType}</span>
                                  </div>
                                  <div>
                                    <span style={{ color: "var(--text-muted)" }}>Type:</span>{" "}
                                    <span style={{ fontWeight: 500 }}>{param.parameterType}</span>
                                  </div>
                                </div>
                                {(param.interpretationHigh || param.interpretationLow) && (
                                  <div style={{ marginBottom: 12, fontSize: 12 }}>
                                    {param.interpretationHigh && (
                                      <div style={{ marginBottom: 4 }}>
                                        <span style={{ color: "var(--status-success-text)" }}>↑ High:</span>{" "}
                                        <span style={{ color: "var(--text-secondary)" }}>{param.interpretationHigh}</span>
                                      </div>
                                    )}
                                    {param.interpretationLow && (
                                      <div>
                                        <span style={{ color: "var(--status-error-text)" }}>↓ Low:</span>{" "}
                                        <span style={{ color: "var(--text-secondary)" }}>{param.interpretationLow}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Scoring Anchors */}
                                {param.scoringAnchors.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>
                                      Scoring Anchors
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                      {param.scoringAnchors.map((anchor) => (
                                        <div
                                          key={anchor.id}
                                          style={{
                                            padding: "8px 12px",
                                            background: "var(--surface-primary)",
                                            borderRadius: 6,
                                            border: anchor.isGold ? "2px solid var(--status-warning-border)" : "1px solid var(--border-default)",
                                          }}
                                        >
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                            <span style={{
                                              fontWeight: 700,
                                              fontSize: 14,
                                              color: anchor.score >= 0.7 ? "var(--status-success-text)" : anchor.score <= 0.3 ? "var(--status-error-text)" : "var(--status-warning-text)",
                                            }}>
                                              {anchor.score.toFixed(1)}
                                            </span>
                                            {anchor.isGold && (
                                              <span style={{ fontSize: 11, color: "var(--status-warning-text)", background: "var(--status-warning-bg)", padding: "1px 4px", borderRadius: 3 }}>
                                                Gold
                                              </span>
                                            )}
                                          </div>
                                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, fontStyle: "italic" }}>
                                            &ldquo;{anchor.example}&rdquo;
                                          </div>
                                          {anchor.rationale && (
                                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                              {anchor.rationale}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* Used by Specs */}
                                {param.usedBySpecs.length > 0 && (
                                  <div style={{ marginTop: 12 }}>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Used by:</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                      {param.usedBySpecs.map((spec) => (
                                        <span
                                          key={spec.specId}
                                          style={{
                                            fontSize: 10,
                                            background: "var(--status-success-bg)",
                                            color: "var(--status-success-text)",
                                            padding: "2px 6px",
                                            borderRadius: 3,
                                            border: "1px solid var(--status-success-border)",
                                          }}
                                        >
                                          {spec.specSlug}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
                })}
                {parametersData.categories.length === 0 && (
                  <div style={{ padding: 48, textAlign: "center", color: "var(--text-placeholder)" }}>
                    No parameters found in this playbook
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
  );
}
