"use client";

import "./triggers-tab.css";
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
        <div className="tt-root">
          {triggersLoading ? (
            <div className="tt-status">
              Loading triggers...
            </div>
          ) : !triggersData ? (
            <div className="tt-status">
              Failed to load triggers data
            </div>
          ) : (
            <div className="tt-layout">
              {/* Summary - Clickable Filters */}
              <div className="tt-filter-bar">
                <button
                  onClick={() => setActiveFilter(null)}
                  className={`tt-filter-chip${activeFilter === null ? " tt-active" : ""}`}
                >
                  <div className="tt-filter-label">All</div>
                  <div className="tt-filter-count">{triggersData.counts.triggers}</div>
                </button>
                {triggersData.categories.map(cat => (
                  <button
                    key={cat.outputType}
                    onClick={() => toggleFilter(cat.outputType)}
                    className={`tt-filter-chip${activeFilter === cat.outputType ? " tt-active" : ""}`}
                  >
                    <div className="tt-filter-label">{cat.icon} {cat.outputType}</div>
                    <div className="tt-filter-count">{cat.specs.reduce((sum, s) => sum + s.triggers.length, 0)}</div>
                  </button>
                ))}
              </div>

              {/* Categories by Output Type */}
              <div className="tt-category-panel">
                {triggersData.categories
                  .filter(category => !activeFilter || activeFilter === category.outputType)
                  .map((category) => (
                  <div key={category.outputType}>
                    {/* Output Type Header */}
                    <div
                      onClick={() => toggleTriggerCategoryExpand(category.outputType)}
                      className="tt-category-header"
                    >
                      <span className="tt-category-icon">{category.icon}</span>
                      <span className="tt-category-name">{category.outputType}</span>
                      <span className="tt-category-count">({category.specs.length} specs)</span>
                      <span className="tt-category-desc">
                        {category.description}
                      </span>
                      <span className="tt-chevron">
                        {expandedTriggerCategories.has(category.outputType) ? "▼" : "▶"}
                      </span>
                    </div>
                    {/* Specs in this category */}
                    {expandedTriggerCategories.has(category.outputType) && (
                      <div className="tt-spec-list">
                        {category.specs.map((spec, specIdx) => (
                          <div key={`${category.outputType}-${spec.specId}-${specIdx}`}>
                            {/* Spec Header */}
                            <div
                              onClick={() => toggleTriggerSpecExpand(spec.specId)}
                              className="tt-spec-header"
                            >
                              <span className="tt-spec-slug">
                                {spec.specSlug}
                              </span>
                              <span className="tt-spec-name">{spec.specName}</span>
                              <span className="tt-spec-count">
                                {spec.triggers.length} trigger{spec.triggers.length !== 1 ? "s" : ""}
                              </span>
                              <span className="tt-spec-chevron">
                                {expandedTriggerSpecs.has(spec.specId) ? "▼" : "▶"}
                              </span>
                            </div>
                            {/* Triggers for this spec */}
                            {expandedTriggerSpecs.has(spec.specId) && (
                              <div className="tt-trigger-list">
                                {spec.triggers.map((trigger, triggerIdx) => (
                                  <div
                                    key={trigger.id}
                                    className="tt-trigger-card"
                                  >
                                    {/* Trigger Header */}
                                    <div
                                      onClick={() => toggleTriggerItemExpand(trigger.id)}
                                      className="tt-trigger-header"
                                    >
                                      <div className="tt-trigger-title-row">
                                        <span className="tt-trigger-icon">⚡</span>
                                        <span className="tt-trigger-name">
                                          {trigger.name || `Trigger ${triggerIdx + 1}`}
                                        </span>
                                        <span className="tt-trigger-action-count">
                                          ({trigger.actions.length} action{trigger.actions.length !== 1 ? "s" : ""})
                                        </span>
                                        <span className="tt-trigger-chevron">
                                          {expandedTriggerItems.has(trigger.id) ? "▼" : "▶"}
                                        </span>
                                      </div>
                                      {/* Given/When/Then */}
                                      <div className="tt-gwt">
                                        <div><span className="tt-gwt-given">Given:</span> {trigger.given}</div>
                                        <div><span className="tt-gwt-when">When:</span> {trigger.when}</div>
                                        <div><span className="tt-gwt-then">Then:</span> {trigger.then}</div>
                                      </div>
                                    </div>
                                    {/* Actions */}
                                    {expandedTriggerItems.has(trigger.id) && trigger.actions.length > 0 && (
                                      <div className="tt-actions-section">
                                        <div className="tt-actions-label">
                                          Actions
                                        </div>
                                        {trigger.actions.map((action) => (
                                          <div
                                            key={action.id}
                                            className="tt-action-card"
                                          >
                                            <div className="tt-action-row">
                                              <span>▶️</span>
                                              <span className="tt-action-desc">{action.description}</span>
                                              <span className="tt-action-weight">
                                                w:{action.weight.toFixed(1)}
                                              </span>
                                            </div>
                                            {action.parameterId && (
                                              <div className="tt-action-param">
                                                → {action.parameterName || action.parameterId}
                                              </div>
                                            )}
                                            {action.learnCategory && (
                                              <div className="tt-action-learn">
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
                  <div className="tt-empty">
                    No triggers found in this playbook
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
  );
}
