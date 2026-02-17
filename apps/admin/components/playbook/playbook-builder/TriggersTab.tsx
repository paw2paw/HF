"use client";

import type { TriggersData } from "./types";

export interface TriggersTabContentProps {
  triggersLoading: boolean;
  triggersData: TriggersData | null;
  activeFilter: string | null;
  setActiveFilter: (filter: string | null) => void;
  toggleFilter: (filter: string) => void;
  expandedTriggerCategories: Set<string>;
  toggleTriggerCategoryExpand: (outputType: string) => void;
  expandedTriggerSpecs: Set<string>;
  toggleTriggerSpecExpand: (specId: string) => void;
  expandedTriggerItems: Set<string>;
  toggleTriggerItemExpand: (triggerId: string) => void;
}

export function TriggersTabContent({
  triggersLoading,
  triggersData,
  activeFilter,
  setActiveFilter,
  toggleFilter,
  expandedTriggerCategories,
  toggleTriggerCategoryExpand,
  expandedTriggerSpecs,
  toggleTriggerSpecExpand,
  expandedTriggerItems,
  toggleTriggerItemExpand,
}: TriggersTabContentProps) {
  return (
        <div style={{ marginTop: 24 }}>
          {triggersLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Loading triggers...
            </div>
          ) : !triggersData ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Failed to load triggers data
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
                  <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === null ? "var(--button-primary-bg)" : "var(--text-primary)" }}>{triggersData.counts.triggers}</div>
                </button>
                {triggersData.categories.map(cat => (
                  <button
                    key={cat.outputType}
                    onClick={() => toggleFilter(cat.outputType)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: activeFilter === cat.outputType ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
                      background: activeFilter === cat.outputType ? "var(--status-info-bg)" : "var(--surface-primary)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: 70,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>{cat.icon} {cat.outputType}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === cat.outputType ? "var(--button-primary-bg)" : "var(--text-primary)" }}>{cat.specs.reduce((sum, s) => sum + s.triggers.length, 0)}</div>
                  </button>
                ))}
              </div>

              {/* Categories by Output Type */}
              <div style={{
                background: "var(--surface-primary)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                overflow: "hidden",
                maxHeight: "calc(100vh - 400px)",
                overflowY: "auto",
              }}>
                {triggersData.categories
                  .filter(category => !activeFilter || activeFilter === category.outputType)
                  .map((category) => (
                  <div key={category.outputType}>
                    {/* Output Type Header */}
                    <div
                      onClick={() => toggleTriggerCategoryExpand(category.outputType)}
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
                      <span style={{ fontWeight: 600 }}>{category.outputType}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>({category.specs.length} specs)</span>
                      <span style={{ marginLeft: 8, color: "var(--text-placeholder)", fontSize: 11, fontStyle: "italic" }}>
                        {category.description}
                      </span>
                      <span style={{ marginLeft: "auto", color: "var(--text-placeholder)", fontSize: 12 }}>
                        {expandedTriggerCategories.has(category.outputType) ? "▼" : "▶"}
                      </span>
                    </div>
                    {/* Specs in this category */}
                    {expandedTriggerCategories.has(category.outputType) && (
                      <div style={{ padding: "8px 0" }}>
                        {category.specs.map((spec, specIdx) => (
                          <div key={`${category.outputType}-${spec.specId}-${specIdx}`}>
                            {/* Spec Header */}
                            <div
                              onClick={() => toggleTriggerSpecExpand(spec.specId)}
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
                                fontSize: 10,
                                fontFamily: "monospace",
                                color: "var(--status-success-text)",
                                background: "var(--status-success-bg)",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}>
                                {spec.specSlug}
                              </span>
                              <span style={{ fontWeight: 500 }}>{spec.specName}</span>
                              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                                {spec.triggers.length} trigger{spec.triggers.length !== 1 ? "s" : ""}
                              </span>
                              <span style={{ marginLeft: "auto", color: "var(--text-placeholder)", fontSize: 11 }}>
                                {expandedTriggerSpecs.has(spec.specId) ? "▼" : "▶"}
                              </span>
                            </div>
                            {/* Triggers for this spec */}
                            {expandedTriggerSpecs.has(spec.specId) && (
                              <div style={{ padding: "8px 16px 8px 48px" }}>
                                {spec.triggers.map((trigger, triggerIdx) => (
                                  <div
                                    key={trigger.id}
                                    style={{
                                      marginBottom: 12,
                                      padding: 12,
                                      background: "var(--status-warning-bg)",
                                      borderRadius: 6,
                                      border: "1px solid var(--status-warning-border)",
                                    }}
                                  >
                                    {/* Trigger Header */}
                                    <div
                                      onClick={() => toggleTriggerItemExpand(trigger.id)}
                                      style={{ cursor: "pointer", marginBottom: 8 }}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 14 }}>⚡</span>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                                          {trigger.name || `Trigger ${triggerIdx + 1}`}
                                        </span>
                                        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                                          ({trigger.actions.length} action{trigger.actions.length !== 1 ? "s" : ""})
                                        </span>
                                        <span style={{ marginLeft: "auto", color: "var(--text-placeholder)", fontSize: 10 }}>
                                          {expandedTriggerItems.has(trigger.id) ? "▼" : "▶"}
                                        </span>
                                      </div>
                                      {/* Given/When/Then */}
                                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                        <div><span style={{ color: "var(--badge-purple-text)", fontWeight: 500 }}>Given:</span> {trigger.given}</div>
                                        <div><span style={{ color: "var(--status-warning-text)", fontWeight: 500 }}>When:</span> {trigger.when}</div>
                                        <div><span style={{ color: "var(--status-success-text)", fontWeight: 500 }}>Then:</span> {trigger.then}</div>
                                      </div>
                                    </div>
                                    {/* Actions */}
                                    {expandedTriggerItems.has(trigger.id) && trigger.actions.length > 0 && (
                                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--status-warning-border)" }}>
                                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>
                                          Actions
                                        </div>
                                        {trigger.actions.map((action) => (
                                          <div
                                            key={action.id}
                                            style={{
                                              padding: "6px 10px",
                                              background: "var(--surface-primary)",
                                              borderRadius: 4,
                                              marginBottom: 4,
                                              fontSize: 12,
                                              border: "1px solid var(--border-default)",
                                            }}
                                          >
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                              <span>▶️</span>
                                              <span style={{ flex: 1 }}>{action.description}</span>
                                              <span style={{
                                                fontSize: 10,
                                                color: "var(--text-muted)",
                                                background: "var(--surface-secondary)",
                                                padding: "1px 4px",
                                                borderRadius: 2,
                                              }}>
                                                w:{action.weight.toFixed(1)}
                                              </span>
                                            </div>
                                            {action.parameterId && (
                                              <div style={{ marginLeft: 24, fontSize: 11, color: "var(--button-primary-bg)" }}>
                                                → {action.parameterName || action.parameterId}
                                              </div>
                                            )}
                                            {action.learnCategory && (
                                              <div style={{ marginLeft: 24, fontSize: 11, color: "var(--badge-purple-text)" }}>
                                                → Learn: {action.learnCategory}
                                                {action.learnKeyPrefix && ` (prefix: ${action.learnKeyPrefix})`}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {triggersData.categories.length === 0 && (
                  <div style={{ padding: 48, textAlign: "center", color: "var(--text-placeholder)" }}>
                    No triggers found in this playbook
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
  );
}
