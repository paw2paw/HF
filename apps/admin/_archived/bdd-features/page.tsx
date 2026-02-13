"use client";

import { useState, useEffect, useMemo } from "react";
import SourcePageHeader from "@/components/shared/SourcePageHeader";

type ScoringAnchor = {
  id: string;
  score: number;
  example: string;
  rationale: string | null;
  positiveSignals: string[];
  negativeSignals: string[];
  isGold: boolean;
};

type ParameterInfo = {
  parameterId: string;
  name: string;
  definition?: string;
  scaleType: string;
  domainGroup?: string;
  interpretationHigh?: string;
  interpretationLow?: string;
  scoringAnchors: ScoringAnchor[];
};

type AcceptanceCriteria = {
  id: string;
  description: string;
  weight: number;
  parameter: ParameterInfo;
};

type Scenario = {
  id: string;
  name: string | null;
  given: string;
  when: string;
  then: string;
  criteria: AcceptanceCriteria[];
};

type BddFeature = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  priority: number;
  isActive: boolean;
  version: string;
  scenarioCount?: number;
  scenarios?: Scenario[];
};

type FullParameter = {
  parameterId: string;
  name: string;
  definition: string | null;
  domainGroup: string;
  scaleType: string;
  interpretationHigh: string | null;
  interpretationLow: string | null;
};

// Domain colors for visual distinction
const DOMAIN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  personality: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  engagement: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  conversation: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  memory: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  safety: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  commercial: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
};

function getDomainColor(domain: string | null) {
  if (!domain) return { bg: "bg-neutral-50", text: "text-neutral-700", border: "border-neutral-200" };
  return DOMAIN_COLORS[domain.toLowerCase()] || { bg: "bg-neutral-50", text: "text-neutral-700", border: "border-neutral-200" };
}

export default function BddFeaturesPage() {
  const [features, setFeatures] = useState<BddFeature[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<BddFeature | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddScenarioModal, setShowAddScenarioModal] = useState(false);

  // Full parameters list for picker
  const [parameters, setParameters] = useState<FullParameter[]>([]);

  // Group features by domain (category)
  const domains = useMemo(() => {
    const domainMap = new Map<string, BddFeature[]>();
    for (const f of features) {
      const domain = f.category || "uncategorized";
      if (!domainMap.has(domain)) domainMap.set(domain, []);
      domainMap.get(domain)!.push(f);
    }
    return domainMap;
  }, [features]);

  // Filtered features based on selected domain
  const filteredFeatures = useMemo(() => {
    if (!selectedDomain) return features;
    return features.filter((f) => (f.category || "uncategorized") === selectedDomain);
  }, [features, selectedDomain]);

  useEffect(() => {
    fetchFeatures();
    fetchParameters();
  }, []);

  async function fetchFeatures() {
    try {
      setLoading(true);
      const res = await fetch("/api/bdd-features");
      const data = await res.json();
      if (data.ok) {
        setFeatures(data.features);
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchParameters() {
    try {
      const res = await fetch("/api/parameters?limit=200");
      const data = await res.json();
      if (data.ok) {
        setParameters(data.parameters);
      }
    } catch (e) {
      // Ignore
    }
  }

  async function fetchFeatureDetail(featureId: string) {
    try {
      const res = await fetch(`/api/bdd-features/${featureId}`);
      const data = await res.json();
      if (data.ok) {
        setSelectedFeature(data.feature);
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  function toggleScenario(id: string) {
    setExpandedScenarios((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCriteria(id: string) {
    setExpandedCriteria((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function getScoreColor(score: number) {
    if (score >= 0.7) return "bg-green-100 text-green-800";
    if (score >= 0.4) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  }

  if (loading) {
    return (
      <div className="p-6">
        <SourcePageHeader title="BDD Features" />
        <div className="text-neutral-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <SourcePageHeader
        title="BDD Features"
        description="Specification by Example - Acceptance criteria linked to Parameters with scoring anchors"
      />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-4">
        {/* Domain List (Column 1) */}
        <div className="w-48 flex-shrink-0">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-neutral-700">Domains</h2>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedDomain(null)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                selectedDomain === null
                  ? "bg-indigo-100 font-medium text-indigo-700"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              All Domains
              <span className="ml-2 text-xs text-neutral-400">({features.length})</span>
            </button>
            {Array.from(domains.entries()).map(([domain, domainFeatures]) => {
              const colors = getDomainColor(domain);
              return (
                <button
                  key={domain}
                  onClick={() => setSelectedDomain(domain)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selectedDomain === domain
                      ? `${colors.bg} font-medium ${colors.text}`
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${colors.bg} ${colors.border} border`}
                    />
                    <span className="capitalize">{domain}</span>
                  </div>
                  <span className="ml-4 text-xs text-neutral-400">
                    ({domainFeatures.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Feature List (Column 2) */}
        <div className="w-72 flex-shrink-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">
              Features
              {selectedDomain && (
                <span className="ml-2 font-normal text-neutral-500">
                  in {selectedDomain}
                </span>
              )}
            </h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              + New
            </button>
          </div>

          <div className="space-y-2">
            {filteredFeatures.length === 0 ? (
              <div className="text-sm text-neutral-500">
                {selectedDomain ? `No features in ${selectedDomain}.` : "No features yet."}
              </div>
            ) : (
              filteredFeatures.map((f) => {
                const colors = getDomainColor(f.category);
                return (
                  <div
                    key={f.id}
                    onClick={() => fetchFeatureDetail(f.id)}
                    className={`cursor-pointer rounded-md border p-3 transition-colors ${
                      selectedFeature?.id === f.id
                        ? "border-indigo-500 bg-indigo-50"
                        : `${colors.border} bg-white hover:border-neutral-300`
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-neutral-900 truncate">{f.name}</div>
                        <div className="text-xs text-neutral-500 truncate">{f.slug}</div>
                      </div>
                      {!selectedDomain && f.category && (
                        <span
                          className={`ml-2 flex-shrink-0 rounded px-1.5 py-0.5 text-xs ${colors.bg} ${colors.text}`}
                        >
                          {f.category}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                      <span>{f.scenarioCount || 0} scenario{(f.scenarioCount || 0) !== 1 ? "s" : ""}</span>
                      {f.isActive ? (
                        <span className="text-green-600">●</span>
                      ) : (
                        <span className="text-neutral-400">○</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Feature Detail */}
        <div className="flex-1">
          {selectedFeature ? (
            <div>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">{selectedFeature.name}</h2>
                  <p className="text-sm text-neutral-500">{selectedFeature.description}</p>
                </div>
                <button
                  onClick={() => setShowAddScenarioModal(true)}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  + Add Scenario
                </button>
              </div>

              {/* Scenarios */}
              <div className="space-y-4">
                {selectedFeature.scenarios?.map((scenario, sIdx) => (
                  <div key={scenario.id} className="rounded-lg border border-neutral-200 bg-white">
                    <div
                      onClick={() => toggleScenario(scenario.id)}
                      className="flex cursor-pointer items-center justify-between p-4 hover:bg-neutral-50"
                    >
                      <div>
                        <div className="font-medium text-neutral-900">
                          Scenario {sIdx + 1}: {scenario.name || "Unnamed"}
                        </div>
                        <div className="mt-1 text-sm text-neutral-500">
                          {scenario.criteria.length} criteria
                        </div>
                      </div>
                      <span className="text-neutral-400">
                        {expandedScenarios.has(scenario.id) ? "▾" : "▸"}
                      </span>
                    </div>

                    {expandedScenarios.has(scenario.id) && (
                      <div className="border-t border-neutral-100 p-4">
                        {/* Gherkin */}
                        <div className="mb-4 space-y-1 rounded bg-neutral-50 p-3 font-mono text-sm">
                          <div>
                            <span className="font-semibold text-purple-600">Given</span>{" "}
                            <span className="text-neutral-700">{scenario.given}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-blue-600">When</span>{" "}
                            <span className="text-neutral-700">{scenario.when}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-green-600">Then</span>{" "}
                            <span className="text-neutral-700">{scenario.then}</span>
                          </div>
                        </div>

                        {/* Criteria */}
                        <div className="space-y-3">
                          {scenario.criteria.map((criteria, cIdx) => (
                            <div key={criteria.id} className="rounded border border-neutral-200">
                              <div
                                onClick={() => toggleCriteria(criteria.id)}
                                className="flex cursor-pointer items-center justify-between p-3 hover:bg-neutral-50"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                    AC{cIdx + 1}
                                  </span>
                                  <span className="text-sm font-medium text-neutral-900">
                                    {criteria.description}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                                    {criteria.parameter.parameterId}
                                  </span>
                                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                    {criteria.parameter.scoringAnchors?.length || 0} anchors
                                  </span>
                                  <span className="text-neutral-400">
                                    {expandedCriteria.has(criteria.id) ? "▾" : "▸"}
                                  </span>
                                </div>
                              </div>

                              {expandedCriteria.has(criteria.id) && (
                                <div className="border-t border-neutral-100 p-3">
                                  {/* Parameter info */}
                                  <div className="mb-3 rounded bg-purple-50 p-2 text-sm">
                                    <div className="font-medium text-purple-900">
                                      Parameter: {criteria.parameter.name}
                                    </div>
                                    {criteria.parameter.definition && (
                                      <div className="mt-1 text-purple-700">
                                        {criteria.parameter.definition}
                                      </div>
                                    )}
                                    <div className="mt-2 flex gap-4 text-xs">
                                      {criteria.parameter.interpretationHigh && (
                                        <div>
                                          <span className="font-medium text-green-700">High:</span>{" "}
                                          {criteria.parameter.interpretationHigh}
                                        </div>
                                      )}
                                      {criteria.parameter.interpretationLow && (
                                        <div>
                                          <span className="font-medium text-red-700">Low:</span>{" "}
                                          {criteria.parameter.interpretationLow}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Anchors */}
                                  {criteria.parameter.scoringAnchors?.length > 0 ? (
                                    <>
                                      <div className="mb-2 flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase text-neutral-500">
                                          Scoring Anchors
                                        </span>
                                        <a
                                          href={`/admin#/parameters?id=${criteria.parameter.parameterId}`}
                                          className="text-xs text-indigo-600 hover:underline"
                                        >
                                          Edit in Parameters →
                                        </a>
                                      </div>
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                                            <th className="pb-2 pr-3">Score</th>
                                            <th className="pb-2 pr-3">Example</th>
                                            <th className="pb-2">Signals</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {criteria.parameter.scoringAnchors.map((anchor) => (
                                            <tr key={anchor.id} className="border-b border-neutral-100">
                                              <td className="py-2 pr-3">
                                                <span
                                                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${getScoreColor(
                                                    anchor.score
                                                  )}`}
                                                >
                                                  {anchor.score}
                                                  {anchor.isGold && " ⭐"}
                                                </span>
                                              </td>
                                              <td className="py-2 pr-3">
                                                <div className="max-w-md text-neutral-700">
                                                  "{anchor.example}"
                                                </div>
                                                {anchor.rationale && (
                                                  <div className="mt-1 text-xs text-neutral-500">
                                                    {anchor.rationale}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="py-2">
                                                <div className="flex flex-wrap gap-1">
                                                  {anchor.positiveSignals.map((s, i) => (
                                                    <span
                                                      key={i}
                                                      className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700"
                                                    >
                                                      +{s}
                                                    </span>
                                                  ))}
                                                  {anchor.negativeSignals.map((s, i) => (
                                                    <span
                                                      key={i}
                                                      className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700"
                                                    >
                                                      -{s}
                                                    </span>
                                                  ))}
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </>
                                  ) : (
                                    <div className="rounded bg-yellow-50 p-2 text-sm text-yellow-700">
                                      No scoring anchors defined.{" "}
                                      <a
                                        href={`/admin#/parameters?id=${criteria.parameter.parameterId}`}
                                        className="underline"
                                      >
                                        Add anchors →
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {(!selectedFeature.scenarios || selectedFeature.scenarios.length === 0) && (
                  <div className="rounded-md bg-neutral-50 p-4 text-center text-sm text-neutral-500">
                    No scenarios yet. Click "+ Add Scenario" to get started.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-neutral-500">
              Select a feature to view details
            </div>
          )}
        </div>
      </div>

      {/* Create Feature Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Create BDD Feature</h3>
            <CreateFeatureForm
              onClose={() => setShowCreateModal(false)}
              onCreated={() => {
                setShowCreateModal(false);
                fetchFeatures();
              }}
            />
          </div>
        </div>
      )}

      {/* Add Scenario Modal */}
      {showAddScenarioModal && selectedFeature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Add Scenario to "{selectedFeature.name}"</h3>
            <AddScenarioForm
              featureId={selectedFeature.id}
              parameters={parameters}
              onClose={() => setShowAddScenarioModal(false)}
              onCreated={() => {
                setShowAddScenarioModal(false);
                fetchFeatureDetail(selectedFeature.id);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CreateFeatureForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !name) return;

    try {
      setSaving(true);
      const res = await fetch("/api/bdd-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, description: description || undefined, category: category || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        onCreated();
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-700">Slug</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
          placeholder="session-continuity-after-break"
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          required
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-700">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Session Continuity After Break"
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          required
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-700">Domain</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Select domain...</option>
          <option value="personality">Personality</option>
          <option value="engagement">Engagement</option>
          <option value="conversation">Conversation</option>
          <option value="memory">Memory</option>
          <option value="safety">Safety</option>
          <option value="commercial">Commercial</option>
        </select>
        <p className="mt-1 text-xs text-neutral-500">
          Domains group related behavioral features for analysis
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !slug || !name}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
}

type CriteriaInput = {
  description: string;
  parameterId: string;
  weight: number;
};

function AddScenarioForm({
  featureId,
  parameters,
  onClose,
  onCreated,
}: {
  featureId: string;
  parameters: FullParameter[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [given, setGiven] = useState("");
  const [when, setWhen] = useState("");
  const [then, setThen] = useState("");
  const [criteria, setCriteria] = useState<CriteriaInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parameter picker state
  const [parameterSearch, setParameterSearch] = useState("");
  const [showParameterPicker, setShowParameterPicker] = useState(false);
  const [currentCriteriaIndex, setCurrentCriteriaIndex] = useState<number | null>(null);

  // Group parameters by domain
  const groupedParameters = useMemo(() => {
    const groups: Record<string, FullParameter[]> = {};
    for (const p of parameters) {
      const group = p.domainGroup || "Other";
      if (!groups[group]) groups[group] = [];
      groups[group].push(p);
    }
    return groups;
  }, [parameters]);

  // Filtered parameters
  const filteredParameters = useMemo(() => {
    if (!parameterSearch) return groupedParameters;
    const search = parameterSearch.toLowerCase();
    const filtered: Record<string, FullParameter[]> = {};
    for (const [group, params] of Object.entries(groupedParameters)) {
      const matches = params.filter(
        (p) =>
          p.parameterId.toLowerCase().includes(search) ||
          p.name.toLowerCase().includes(search) ||
          (p.definition && p.definition.toLowerCase().includes(search))
      );
      if (matches.length > 0) filtered[group] = matches;
    }
    return filtered;
  }, [groupedParameters, parameterSearch]);

  function addCriteria() {
    setCriteria([...criteria, { description: "", parameterId: "", weight: 1.0 }]);
  }

  function updateCriteria(index: number, field: keyof CriteriaInput, value: string | number) {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [field]: value };
    setCriteria(updated);
  }

  function removeCriteria(index: number) {
    setCriteria(criteria.filter((_, i) => i !== index));
  }

  function openParameterPicker(index: number) {
    setCurrentCriteriaIndex(index);
    setParameterSearch("");
    setShowParameterPicker(true);
  }

  function selectParameter(parameterId: string) {
    if (currentCriteriaIndex !== null) {
      updateCriteria(currentCriteriaIndex, "parameterId", parameterId);
    }
    setShowParameterPicker(false);
    setCurrentCriteriaIndex(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!given || !when || !then) return;

    // Validate all criteria have parameters
    const invalidCriteria = criteria.filter((c) => !c.parameterId || !c.description);
    if (invalidCriteria.length > 0) {
      setError("All criteria must have a description and a linked parameter");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/bdd-features/${featureId}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          given,
          when,
          then,
          criteria: criteria.length > 0 ? criteria : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onCreated();
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const selectedParam = currentCriteriaIndex !== null ? parameters.find(p => p.parameterId === criteria[currentCriteriaIndex]?.parameterId) : null;

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-neutral-700">Scenario Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Caller returns after 2+ week break"
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mb-4 rounded bg-neutral-50 p-3">
        <label className="mb-2 block text-sm font-medium text-neutral-700">Gherkin Definition</label>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="w-16 pt-2 text-sm font-semibold text-purple-600">Given</span>
            <textarea
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              placeholder="The caller hasn't contacted us in more than 2 weeks"
              rows={2}
              className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="flex items-start gap-2">
            <span className="w-16 pt-2 text-sm font-semibold text-blue-600">When</span>
            <textarea
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              placeholder="They initiate a new conversation"
              rows={2}
              className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="flex items-start gap-2">
            <span className="w-16 pt-2 text-sm font-semibold text-green-600">Then</span>
            <textarea
              value={then}
              onChange={(e) => setThen(e.target.value)}
              placeholder="The AI should acknowledge the absence warmly and demonstrate memory"
              rows={2}
              className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
              required
            />
          </div>
        </div>
      </div>

      {/* Acceptance Criteria */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-neutral-700">Acceptance Criteria</label>
          <button
            type="button"
            onClick={addCriteria}
            className="rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
          >
            + Add Criteria
          </button>
        </div>

        {criteria.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-300 p-3 text-center text-sm text-neutral-500">
            No criteria yet. Click "+ Add Criteria" to link measurable parameters.
          </div>
        ) : (
          <div className="space-y-3">
            {criteria.map((c, idx) => (
              <div key={idx} className="rounded border border-neutral-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-500">AC {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeCriteria(idx)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="mb-2">
                  <input
                    type="text"
                    value={c.description}
                    onChange={(e) => updateCriteria(idx, "description", e.target.value)}
                    placeholder="Acknowledge absence warmly"
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openParameterPicker(idx)}
                    className={`flex-1 rounded border px-3 py-2 text-left text-sm ${
                      c.parameterId
                        ? "border-purple-300 bg-purple-50 text-purple-700"
                        : "border-neutral-300 text-neutral-500"
                    }`}
                  >
                    {c.parameterId ? (
                      <>
                        <span className="font-medium">{c.parameterId}</span>
                        <span className="ml-2 text-purple-600">
                          ({parameters.find((p) => p.parameterId === c.parameterId)?.name || "?"})
                        </span>
                      </>
                    ) : (
                      "Select Parameter..."
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-neutral-500">Weight:</label>
                    <input
                      type="number"
                      value={c.weight}
                      onChange={(e) => updateCriteria(idx, "weight", parseFloat(e.target.value) || 1)}
                      step="0.1"
                      min="0"
                      max="2"
                      className="w-16 rounded border border-neutral-300 px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !given || !when || !then}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add Scenario"}
        </button>
      </div>

      {/* Parameter Picker Modal */}
      {showParameterPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="max-h-[80vh] w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="border-b border-neutral-200 p-4">
              <h4 className="text-lg font-semibold">Select Parameter</h4>
              <input
                type="text"
                value={parameterSearch}
                onChange={(e) => setParameterSearch(e.target.value)}
                placeholder="Search by ID, name, or definition..."
                className="mt-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {Object.keys(filteredParameters).length === 0 ? (
                <div className="p-4 text-center text-sm text-neutral-500">No parameters found</div>
              ) : (
                Object.entries(filteredParameters).map(([group, params]) => (
                  <div key={group} className="mb-4">
                    <div className="mb-1 px-2 text-xs font-semibold uppercase text-neutral-500">
                      {group}
                    </div>
                    {params.map((p) => (
                      <button
                        key={p.parameterId}
                        type="button"
                        onClick={() => selectParameter(p.parameterId)}
                        className="w-full rounded px-3 py-2 text-left hover:bg-neutral-100"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-neutral-900">{p.parameterId}</span>
                          <span className="text-xs text-neutral-500">{p.scaleType}</span>
                        </div>
                        <div className="text-sm text-neutral-600">{p.name}</div>
                        {p.definition && (
                          <div className="mt-1 truncate text-xs text-neutral-500">{p.definition}</div>
                        )}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-neutral-200 p-3">
              <button
                type="button"
                onClick={() => setShowParameterPicker(false)}
                className="w-full rounded border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
