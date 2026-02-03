"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type FeatureSet = {
  id: string;
  featureId: string;
  name: string;
  description: string | null;
  version: string;
  specType: string;
  rawSpec: Record<string, unknown> | null;
  parameters: any[];
  constraints: any[];
  promptGuidance: any[];
  scoringSpec: Record<string, unknown> | null;
  definitions: Record<string, string> | null;
  thresholds: any[];
  parameterCount: number;
  constraintCount: number;
  definitionCount: number;
  isActive: boolean;
  activatedAt: string | null;
  compiledAt: string;
  lastTestAt: string | null;
  lastTestResult: Record<string, unknown> | null;
};

type Spec = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  scope: string;
  outputType: string;
  specRole: string | null;
  domain: string | null;
  config: Record<string, unknown> | null;
  promptTemplate: string | null;
  isActive: boolean;
  isLocked: boolean;
  lockedReason: string | null;
  priority: number;
  version: string | null;
  compiledAt: string | null;
  compiledSetId: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function SpecDetailPage() {
  const params = useParams();
  const router = useRouter();
  const specId = params.id as string;

  const [spec, setSpec] = useState<Spec | null>(null);
  const [featureSet, setFeatureSet] = useState<FeatureSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recompiling, setRecompiling] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Editable fields
  const [configText, setConfigText] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [promptTemplate, setPromptTemplate] = useState("");
  const [specRole, setSpecRole] = useState("");

  // Track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState(false);

  // Collapsible sections
  const [showRawSpec, setShowRawSpec] = useState(false);
  const [showParameters, setShowParameters] = useState(true);
  const [showPromptGuidance, setShowPromptGuidance] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<"derived" | "source">("derived");

  useEffect(() => {
    fetch(`/api/analysis-specs/${specId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setSpec(data.spec);
          setFeatureSet(data.featureSet);
          setConfigText(JSON.stringify(data.spec.config || {}, null, 2));
          setPromptTemplate(data.spec.promptTemplate || "");
          setSpecRole(data.spec.specRole || "");
        } else {
          setError(data.error);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [specId]);

  // Validate JSON as user types
  const handleConfigChange = useCallback((value: string) => {
    setConfigText(value);
    setHasChanges(true);
    try {
      JSON.parse(value);
      setConfigError(null);
    } catch (e: any) {
      setConfigError(e.message);
    }
  }, []);

  const handlePromptTemplateChange = useCallback((value: string) => {
    setPromptTemplate(value);
    setHasChanges(true);
  }, []);

  const handleSpecRoleChange = useCallback((value: string) => {
    setSpecRole(value);
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    if (configError) {
      setSaveMessage({ type: "error", text: "Fix JSON errors before saving" });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const parsedConfig = JSON.parse(configText);
      const res = await fetch(`/api/analysis-specs/${specId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: parsedConfig,
          promptTemplate: promptTemplate || null,
          specRole: specRole || null,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSpec(data.spec);
        setHasChanges(false);
        setSaveMessage({ type: "success", text: "Saved successfully" });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to save" });
      }
    } catch (e: any) {
      setSaveMessage({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRecompile = async () => {
    setRecompiling(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`/api/analysis-specs/${specId}/recompile`, {
        method: "POST",
      });

      const data = await res.json();
      if (data.ok) {
        setSpec(data.spec);
        setConfigText(JSON.stringify(data.spec.config || {}, null, 2));
        setPromptTemplate(data.spec.promptTemplate || "");
        setHasChanges(false);
        setSaveMessage({ type: "success", text: "Recompiled successfully from source spec" });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to recompile" });
      }
    } catch (e: any) {
      setSaveMessage({ type: "error", text: e.message });
    } finally {
      setRecompiling(false);
    }
  };

  // Format JSON button
  const formatJson = () => {
    try {
      const parsed = JSON.parse(configText);
      setConfigText(JSON.stringify(parsed, null, 2));
      setConfigError(null);
    } catch (e: any) {
      setConfigError(e.message);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-neutral-500">Loading spec...</div>
    );
  }

  if (error || !spec) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
          {error || "Spec not found"}
        </div>
        <Link href="/x/specs" className="text-indigo-600 hover:underline">
          &larr; Back to specs
        </Link>
      </div>
    );
  }

  const scopeColors: Record<string, string> = {
    SYSTEM: "bg-neutral-100 text-neutral-700",
    DOMAIN: "bg-blue-100 text-blue-700",
    CALLER: "bg-pink-100 text-pink-700",
  };

  const outputTypeColors: Record<string, string> = {
    LEARN: "bg-purple-100 text-purple-700",
    MEASURE: "bg-green-100 text-green-700",
    ADAPT: "bg-amber-100 text-amber-700",
    COMPOSE: "bg-pink-100 text-pink-700",
  };

  const roleColors: Record<string, string> = {
    IDENTITY: "bg-indigo-100 text-indigo-700",
    CONTENT: "bg-orange-100 text-orange-700",
    CONTEXT: "bg-amber-100 text-amber-700",
    META: "bg-slate-100 text-slate-700",
  };

  // Determine what content is primary based on spec type
  const isMeasureSpec = spec.outputType === "MEASURE";
  const isIdentityOrContent = spec.specRole === "IDENTITY" || spec.specRole === "CONTENT";
  const hasRichConfig = spec.config && Object.keys(spec.config).length > 2;
  const hasPromptTemplate = spec.promptTemplate && spec.promptTemplate.length > 100;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/x/specs"
          className="text-sm text-neutral-500 hover:text-indigo-600 mb-2 inline-block"
        >
          &larr; Back to specs
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{spec.name}</h1>
            <div className="text-sm text-neutral-500 font-mono mt-1">
              {spec.slug}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {spec.isLocked && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                Locked
              </span>
            )}
            {!spec.isActive && (
              <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-1 rounded">
                Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span
          className={`text-xs px-2 py-1 rounded ${scopeColors[spec.scope] || "bg-neutral-100"}`}
        >
          {spec.scope}
        </span>
        <span
          className={`text-xs px-2 py-1 rounded ${outputTypeColors[spec.outputType] || "bg-neutral-100"}`}
        >
          {spec.outputType}
        </span>
        {spec.specRole && (
          <span
            className={`text-xs px-2 py-1 rounded ${roleColors[spec.specRole] || "bg-neutral-100"}`}
          >
            {spec.specRole}
          </span>
        )}
        {spec.domain && (
          <span className="text-xs px-2 py-1 rounded bg-cyan-100 text-cyan-700">
            {spec.domain}
          </span>
        )}
        {featureSet && (
          <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">
            Has Source Spec
          </span>
        )}
      </div>

      {/* Description */}
      {spec.description && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-6">
          <div className="text-sm text-neutral-700">{spec.description}</div>
        </div>
      )}

      {/* Data Flow Overview */}
      {featureSet && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Data Flow</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">
              {featureSet.featureId}.spec.json
            </span>
            <span className="text-blue-400">-&gt;</span>
            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
              BDDFeatureSet
            </span>
            <span className="text-purple-400">-&gt;</span>
            <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
              AnalysisSpec
            </span>
            <span className="text-neutral-400 ml-2">
              ({featureSet.parameterCount} params, {featureSet.constraintCount} constraints)
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-neutral-200 mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("derived")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "derived"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            Derived Output
          </button>
          {featureSet && (
            <button
              onClick={() => setActiveTab("source")}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "source"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Source Spec
            </button>
          )}
        </div>
      </div>

      {activeTab === "derived" && (
        <>
          {/* Spec Role Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Spec Role
            </label>
            <select
              value={specRole}
              onChange={(e) => handleSpecRoleChange(e.target.value)}
              disabled={spec.isLocked}
              className="w-full max-w-xs border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-neutral-100"
            >
              <option value="">None</option>
              <option value="IDENTITY">IDENTITY (who the agent is)</option>
              <option value="CONTENT">CONTENT (domain knowledge)</option>
              <option value="CONTEXT">CONTEXT (caller-specific)</option>
              <option value="META">META (legacy)</option>
            </select>
          </div>

          {/* Prompt Template - Show prominently for MEASURE specs */}
          {(isMeasureSpec || hasPromptTemplate) && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-neutral-700">
                  Compiled Prompt Template
                  {isMeasureSpec && (
                    <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      Primary output for MEASURE specs
                    </span>
                  )}
                </label>
                <span className="text-xs text-neutral-500">
                  {promptTemplate.length.toLocaleString()} chars
                </span>
              </div>
              <textarea
                value={promptTemplate}
                onChange={(e) => handlePromptTemplateChange(e.target.value)}
                disabled={spec.isLocked}
                rows={isMeasureSpec ? 20 : 10}
                className="w-full font-mono text-xs border border-neutral-300 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-neutral-100"
                placeholder="Compiled prompt template..."
              />
            </div>
          )}

          {/* Config Editor - Show prominently for IDENTITY/CONTENT specs */}
          {(!isMeasureSpec || hasRichConfig) && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-neutral-700">
                  Config (JSON)
                  {isIdentityOrContent && (
                    <span className="ml-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      Primary output for {spec.specRole} specs
                    </span>
                  )}
                </label>
                <button
                  onClick={formatJson}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  Format JSON
                </button>
              </div>
              <div className="relative">
                <textarea
                  value={configText}
                  onChange={(e) => handleConfigChange(e.target.value)}
                  disabled={spec.isLocked}
                  rows={isIdentityOrContent ? 20 : 10}
                  className={`w-full font-mono text-xs border rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-neutral-100 ${
                    configError
                      ? "border-red-300 bg-red-50"
                      : "border-neutral-300 bg-white"
                  }`}
                  placeholder="{}"
                />
                {configError && (
                  <div className="absolute bottom-2 left-2 right-2 bg-red-100 text-red-700 text-xs p-2 rounded">
                    JSON Error: {configError}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save / Recompile Buttons */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={handleSave}
              disabled={saving || spec.isLocked || !hasChanges}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                saving || spec.isLocked || !hasChanges
                  ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {featureSet && (
              <button
                onClick={handleRecompile}
                disabled={recompiling || spec.isLocked}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  recompiling || spec.isLocked
                    ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                    : "bg-amber-600 text-white hover:bg-amber-700"
                }`}
              >
                {recompiling ? "Recompiling..." : "Recompile from Source"}
              </button>
            )}
            {saveMessage && (
              <span
                className={`text-sm ${
                  saveMessage.type === "success" ? "text-green-600" : "text-red-600"
                }`}
              >
                {saveMessage.text}
              </span>
            )}
            {hasChanges && !saveMessage && (
              <span className="text-sm text-amber-600">Unsaved changes</span>
            )}
          </div>
        </>
      )}

      {activeTab === "source" && featureSet && (
        <>
          {/* Parameters from Source Spec */}
          <div className="mb-6">
            <button
              onClick={() => setShowParameters(!showParameters)}
              className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-3 hover:text-indigo-600"
            >
              <span>{showParameters ? "▼" : "▶"}</span>
              Parameters ({featureSet.parameterCount})
            </button>
            {showParameters && featureSet.parameters && featureSet.parameters.length > 0 && (
              <div className="space-y-3">
                {featureSet.parameters.map((param: any, idx: number) => (
                  <div
                    key={param.id || idx}
                    className="bg-white border border-neutral-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-neutral-900">{param.name}</div>
                        <div className="text-xs text-neutral-500 font-mono">{param.id}</div>
                      </div>
                      {param.targetRange && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          Target: {param.targetRange.min}-{param.targetRange.max}
                        </span>
                      )}
                    </div>
                    {param.definition && (
                      <p className="text-sm text-neutral-600 mb-2">{param.definition}</p>
                    )}
                    {param.interpretationScale && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-neutral-500 mb-1">Interpretation Scale:</div>
                        <div className="flex gap-2 text-xs">
                          <span className="bg-red-50 text-red-700 px-2 py-1 rounded">
                            Low: {param.interpretationScale.low}
                          </span>
                          <span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded">
                            Mid: {param.interpretationScale.mid}
                          </span>
                          <span className="bg-green-50 text-green-700 px-2 py-1 rounded">
                            High: {param.interpretationScale.high}
                          </span>
                        </div>
                      </div>
                    )}
                    {param.scoringAnchors && param.scoringAnchors.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-neutral-500 mb-1">Scoring Anchors:</div>
                        <div className="grid grid-cols-5 gap-1 text-xs">
                          {param.scoringAnchors.map((anchor: any, ai: number) => (
                            <div
                              key={ai}
                              className="bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-center"
                            >
                              <div className="font-medium">{anchor.score}</div>
                              <div className="text-neutral-500 truncate" title={anchor.label}>
                                {anchor.label}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {showParameters && (!featureSet.parameters || featureSet.parameters.length === 0) && (
              <p className="text-sm text-neutral-500 italic">No parameters defined in source spec</p>
            )}
          </div>

          {/* Prompt Guidance from Source Spec */}
          <div className="mb-6">
            <button
              onClick={() => setShowPromptGuidance(!showPromptGuidance)}
              className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-3 hover:text-indigo-600"
            >
              <span>{showPromptGuidance ? "▼" : "▶"}</span>
              Prompt Guidance ({featureSet.promptGuidance?.length || 0})
            </button>
            {showPromptGuidance && featureSet.promptGuidance && featureSet.promptGuidance.length > 0 && (
              <div className="space-y-3">
                {featureSet.promptGuidance.map((guidance: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-white border border-neutral-200 rounded-lg p-4"
                  >
                    <div className="font-medium text-neutral-900 mb-2">{guidance.parameterId}</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs font-medium text-green-600 mb-1">When High:</div>
                        <p className="text-neutral-600">{guidance.whenHigh}</p>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-red-600 mb-1">When Low:</div>
                        <p className="text-neutral-600">{guidance.whenLow}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Raw Spec JSON */}
          <div className="mb-6">
            <button
              onClick={() => setShowRawSpec(!showRawSpec)}
              className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-3 hover:text-indigo-600"
            >
              <span>{showRawSpec ? "▼" : "▶"}</span>
              Raw Spec JSON (Source)
            </button>
            {showRawSpec && featureSet.rawSpec && (
              <pre className="bg-neutral-900 text-neutral-100 text-xs font-mono p-4 rounded-lg overflow-auto max-h-96">
                {JSON.stringify(featureSet.rawSpec, null, 2)}
              </pre>
            )}
            {showRawSpec && !featureSet.rawSpec && (
              <p className="text-sm text-neutral-500 italic">No rawSpec stored - spec may have been created before rawSpec storage was added</p>
            )}
          </div>

          {/* Feature Set Metadata */}
          <div className="border-t border-neutral-200 pt-6">
            <h3 className="text-sm font-medium text-neutral-700 mb-3">BDDFeatureSet Metadata</h3>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-neutral-500">Feature ID</dt>
                <dd className="font-mono text-neutral-900">{featureSet.featureId}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Version</dt>
                <dd className="text-neutral-900">{featureSet.version}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Spec Type</dt>
                <dd className="text-neutral-900">{featureSet.specType}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Compiled At</dt>
                <dd className="text-neutral-900">
                  {new Date(featureSet.compiledAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Activated At</dt>
                <dd className="text-neutral-900">
                  {featureSet.activatedAt
                    ? new Date(featureSet.activatedAt).toLocaleString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Status</dt>
                <dd>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      featureSet.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {featureSet.isActive ? "Active" : "Inactive"}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </>
      )}

      {/* AnalysisSpec Metadata */}
      <div className="border-t border-neutral-200 pt-6 mt-6">
        <h3 className="text-sm font-medium text-neutral-700 mb-3">AnalysisSpec Metadata</h3>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-neutral-500">ID</dt>
            <dd className="font-mono text-xs text-neutral-900">{spec.id}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Priority</dt>
            <dd className="text-neutral-900">{spec.priority}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Version</dt>
            <dd className="text-neutral-900">{spec.version || "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Compiled At</dt>
            <dd className="text-neutral-900">
              {spec.compiledAt
                ? new Date(spec.compiledAt).toLocaleString()
                : "Never"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Created</dt>
            <dd className="text-neutral-900">
              {new Date(spec.createdAt).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Linked FeatureSet</dt>
            <dd className="font-mono text-xs text-neutral-900">
              {spec.compiledSetId ? spec.compiledSetId.slice(0, 8) + "..." : "None"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
