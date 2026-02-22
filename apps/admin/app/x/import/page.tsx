"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DraggableTabs } from "@/components/shared/DraggableTabs";
import { MessageCircle, ClipboardList } from "lucide-react";
import "./import.css";

type ImportTab = "transcripts" | "specs";

// Wrapper to read search params (must be in Suspense)
function SearchParamsReader({ onTab }: { onTab: (tab: ImportTab) => void }) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  useEffect(() => {
    if (tabParam === "specs") {
      onTab("specs");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

interface ImportConflict {
  conflictKey: string;
  matchType: "phone" | "tag";
  matchValue: string;
  existingCaller: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    callCount: number;
  };
  incomingCaller: {
    name: string | null;
    phone: string | null;
    callCount: number;
    firstTranscriptPreview: string;
  };
  resolution?: "merge" | "create_new" | "skip";
}

interface PreviewResult {
  ok: boolean;
  preview: true;
  conflicts: ImportConflict[];
  summary: {
    filesCount: number;
    callersCount: number;
    callsCount: number;
    conflictsCount: number;
  };
  parseErrors?: string[];
}

type TranscriptResult = {
  ok: boolean;
  created?: number;
  merged?: number;
  updated?: number;
  skipped?: number;
  callsImported?: number;
  errors?: string[];
  savedToRaw?: string[];
  callers?: Array<{
    id: string;
    name: string | null;
    email: string | null;
    isNew: boolean;
    merged?: boolean;
  }>;
};

type SpecResult = {
  ok: boolean;
  created?: number;
  updated?: number;
  errors?: number;
  total?: number;
  results?: Array<{
    specId: string;
    name: string;
    status: "created" | "updated" | "error";
    error?: string;
    compileWarnings?: string[];
  }>;
};

type ImportStep = "select" | "conflicts" | "result";

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<ImportTab>("transcripts");
  const [tabInitialized, setTabInitialized] = useState(false);

  // Handle tab from URL (wrapped in Suspense for Next.js App Router)
  const handleTabFromUrl = (tab: ImportTab) => {
    if (!tabInitialized) {
      setActiveTab(tab);
      setTabInitialized(true);
    }
  };

  // Transcript state
  const [transcriptFiles, setTranscriptFiles] = useState<File[]>([]);
  const [transcriptImporting, setTranscriptImporting] = useState(false);
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResult | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [duplicateHandling, setDuplicateHandling] = useState<"skip" | "overwrite" | "create_new">("skip");
  const [saveToRaw, setSaveToRaw] = useState(true);
  const transcriptFileInputRef = useRef<HTMLInputElement>(null);

  // Conflict resolution state
  const [importStep, setImportStep] = useState<ImportStep>("select");
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, "merge" | "create_new" | "skip">>({});

  // Spec state
  const specImportMode = "schema";
  const [specFiles, setSpecFiles] = useState<File[]>([]);
  const [specImporting, setSpecImporting] = useState(false);
  const [specResult, setSpecResult] = useState<SpecResult | null>(null);
  const [specError, setSpecError] = useState<string | null>(null);
  const [autoActivate, setAutoActivate] = useState(true);
  const specFileInputRef = useRef<HTMLInputElement>(null);


  // Transcript handlers
  const handleTranscriptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setTranscriptFiles(Array.from(e.target.files));
      setTranscriptResult(null);
      setTranscriptError(null);
      setPreviewResult(null);
      setConflictResolutions({});
      setImportStep("select");
    }
  };

  const handleTranscriptDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setTranscriptFiles(Array.from(e.dataTransfer.files));
      setTranscriptResult(null);
      setTranscriptError(null);
      setPreviewResult(null);
      setConflictResolutions({});
      setImportStep("select");
    }
  };

  // Preview to detect conflicts
  const handleTranscriptPreview = async () => {
    if (transcriptFiles.length === 0) return;

    setTranscriptImporting(true);
    setTranscriptError(null);

    const formData = new FormData();
    for (const file of transcriptFiles) {
      formData.append("files", file);
    }
    formData.append("preview", "true");

    try {
      const res = await fetch("/api/transcripts/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.ok && data.preview) {
        setPreviewResult(data);
        // Initialize resolutions to "merge" (default)
        const resolutions: Record<string, "merge" | "create_new" | "skip"> = {};
        for (const conflict of data.conflicts) {
          resolutions[conflict.conflictKey] = "merge";
        }
        setConflictResolutions(resolutions);

        if (data.conflicts.length > 0) {
          setImportStep("conflicts");
        } else {
          // No conflicts, proceed directly to import
          await handleTranscriptImport();
        }
      } else {
        setTranscriptError(data.error || "Preview failed");
      }
    } catch (err: unknown) {
      setTranscriptError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setTranscriptImporting(false);
    }
  };

  // Actual import with conflict resolutions
  const handleTranscriptImport = async () => {
    if (transcriptFiles.length === 0) return;

    setTranscriptImporting(true);
    setTranscriptError(null);
    setTranscriptResult(null);

    const formData = new FormData();
    for (const file of transcriptFiles) {
      formData.append("files", file);
    }
    formData.append("duplicateHandling", duplicateHandling);
    formData.append("saveToRaw", saveToRaw.toString());
    formData.append("conflictResolutions", JSON.stringify(conflictResolutions));

    try {
      const res = await fetch("/api/transcripts/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.ok) {
        setTranscriptResult(data);
        setTranscriptFiles([]);
        setImportStep("result");
        if (transcriptFileInputRef.current) {
          transcriptFileInputRef.current.value = "";
        }
      } else {
        setTranscriptError(data.error || "Import failed");
      }
    } catch (err: unknown) {
      setTranscriptError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setTranscriptImporting(false);
    }
  };

  const handleConflictResolution = (conflictKey: string, resolution: "merge" | "create_new" | "skip") => {
    setConflictResolutions(prev => ({ ...prev, [conflictKey]: resolution }));
  };

  const resetImport = () => {
    setTranscriptFiles([]);
    setTranscriptResult(null);
    setTranscriptError(null);
    setPreviewResult(null);
    setConflictResolutions({});
    setImportStep("select");
    if (transcriptFileInputRef.current) {
      transcriptFileInputRef.current.value = "";
    }
  };

  // Spec handlers
  const handleSpecFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSpecFiles(Array.from(e.target.files));
      setSpecResult(null);
      setSpecError(null);
    }
  };

  const handleSpecDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const jsonFiles = Array.from(e.dataTransfer.files).filter(f =>
        f.name.endsWith(".spec.json") || f.name.endsWith(".json")
      );
      setSpecFiles(jsonFiles);
      setSpecResult(null);
      setSpecError(null);
    }
  };

  const handleSpecImport = async () => {
    if (specFiles.length === 0) return;

    setSpecImporting(true);
    setSpecError(null);
    setSpecResult(null);

    const formData = new FormData();
    for (const file of specFiles) {
      formData.append("files", file);
    }
    formData.append("autoActivate", autoActivate.toString());

    try {
      const res = await fetch("/api/specs/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.ok) {
        setSpecResult(data);
        setSpecFiles([]);
        if (specFileInputRef.current) {
          specFileInputRef.current.value = "";
        }
      } else {
        setSpecError(data.error || "Import failed");
      }
    } catch (err: unknown) {
      setSpecError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setSpecImporting(false);
    }
  };

  return (
    <div>
      {/* Read URL params in Suspense boundary (required by Next.js App Router) */}
      <Suspense fallback={null}>
        <SearchParamsReader onTab={handleTabFromUrl} />
      </Suspense>

      <div className="imp-header">
        <h1 className="hf-page-title">Import</h1>
        <p className="imp-subtitle">
          Upload transcripts or BDD specs to populate the database
        </p>
      </div>

      {/* Tabs */}
      <DraggableTabs
        storageKey="import-tabs"
        tabs={[
          { id: "transcripts", label: "Transcripts", icon: <MessageCircle size={14} /> },
          { id: "specs", label: "BDD Specs", icon: <ClipboardList size={14} /> },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as ImportTab)}
        containerStyle={{ marginBottom: 24 }}
      />

      {/* Transcripts Tab */}
      {activeTab === "transcripts" && (
        <div>
          {/* Step 1: File Selection */}
          {importStep === "select" && (
            <>
              {/* Drop Zone */}
              <div
                onDrop={handleTranscriptDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => transcriptFileInputRef.current?.click()}
                className={`imp-dropzone ${transcriptFiles.length > 0 ? "imp-dropzone-active" : ""}`}
              >
                <input
                  ref={transcriptFileInputRef}
                  type="file"
                  multiple
                  accept=".json,.txt,.csv"
                  onChange={handleTranscriptFileChange}
                  className="imp-hidden-input"
                />
                <div className="imp-dropzone-icon">📥</div>
                {transcriptFiles.length > 0 ? (
                  <div>
                    <div className="imp-dropzone-title-success">
                      {transcriptFiles.length} file(s) selected
                    </div>
                    <div className="imp-dropzone-hint">
                      {transcriptFiles.map((f) => f.name).join(", ")}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="imp-dropzone-title">
                      Drop transcript files here or click to browse
                    </div>
                    <div className="imp-dropzone-hint">
                      Supports JSON, TXT, CSV formats
                    </div>
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="imp-options">
                <label className="imp-options-label">
                  If call already exists (by ID):
                </label>
                <div className="imp-radio-group">
                  {[
                    { value: "skip", label: "Skip", desc: "Keep existing call" },
                    { value: "overwrite", label: "Overwrite", desc: "Replace transcript" },
                    { value: "create_new", label: "Create New", desc: "Create duplicate" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`imp-radio-option ${duplicateHandling === opt.value ? "imp-radio-option-selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="duplicateHandling"
                        value={opt.value}
                        checked={duplicateHandling === opt.value}
                        onChange={(e) => setDuplicateHandling(e.target.value as any)}
                        className="imp-radio-input"
                      />
                      <span className="imp-radio-label">{opt.label}</span>
                      <div className="imp-radio-desc">
                        {opt.desc}
                      </div>
                    </label>
                  ))}
                </div>

                {/* Save to raw folder option */}
                <div className="imp-checkbox-section">
                  <label className="imp-checkbox-label">
                    <input
                      type="checkbox"
                      checked={saveToRaw}
                      onChange={(e) => setSaveToRaw(e.target.checked)}
                      className="imp-checkbox"
                    />
                    <div>
                      <span className="imp-checkbox-text">Save to raw folder</span>
                      <div className="imp-checkbox-hint">
                        Copies files to HF_KB_PATH/sources/transcripts/raw for future bulk imports
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Import Button */}
              <div className="imp-btn-row">
                <button
                  onClick={handleTranscriptPreview}
                  disabled={transcriptFiles.length === 0 || transcriptImporting}
                  className="imp-btn-import"
                >
                  {transcriptImporting ? "Checking..." : "Import Transcripts"}
                </button>
              </div>
            </>
          )}

          {/* Step 2: Conflict Resolution */}
          {importStep === "conflicts" && previewResult && (
            <div>
              <div className="imp-conflict-banner">
                <div className="imp-conflict-banner-title">
                  ⚠️ {previewResult.conflicts.length} Caller Conflict{previewResult.conflicts.length > 1 ? "s" : ""} Detected
                </div>
                <div className="imp-conflict-banner-desc">
                  The following callers match existing records by phone number but have different names.
                  Choose how to handle each one:
                </div>
              </div>

              {/* Summary */}
              <div className="imp-conflict-summary">
                <span>{previewResult.summary.filesCount} file(s)</span>
                <span>{previewResult.summary.callersCount} caller(s)</span>
                <span>{previewResult.summary.callsCount} call(s)</span>
              </div>

              {/* Conflict Cards */}
              <div className="imp-conflict-list">
                {previewResult.conflicts.map((conflict) => (
                  <div
                    key={conflict.conflictKey}
                    className="imp-conflict-card"
                  >
                    {/* Match info */}
                    <div className="imp-conflict-match-info">
                      <div className="imp-conflict-match-label">
                        Match by {conflict.matchType}: <code className="imp-conflict-match-code">{conflict.matchValue}</code>
                      </div>
                    </div>

                    {/* Side by side comparison */}
                    <div className="imp-conflict-grid">
                      {/* Existing Caller */}
                      <div className="imp-conflict-side imp-conflict-side-existing">
                        <div className="imp-conflict-side-label">
                          Existing in Database
                        </div>
                        <div className="imp-conflict-name">
                          {conflict.existingCaller.name || "(no name)"}
                        </div>
                        <div className="imp-conflict-detail">
                          {conflict.existingCaller.phone && <div>📱 {conflict.existingCaller.phone}</div>}
                          {conflict.existingCaller.email && <div>📧 {conflict.existingCaller.email}</div>}
                          <div>📞 {conflict.existingCaller.callCount} call(s) on record</div>
                        </div>
                        <Link
                          href={`/x/callers/${conflict.existingCaller.id}`}
                          target="_blank"
                          className="imp-conflict-link"
                        >
                          View caller →
                        </Link>
                      </div>

                      {/* Incoming Caller */}
                      <div className="imp-conflict-side imp-conflict-side-incoming">
                        <div className="imp-conflict-side-label">
                          From Import
                        </div>
                        <div className="imp-conflict-name">
                          {conflict.incomingCaller.name || "(no name)"}
                        </div>
                        <div className="imp-conflict-detail">
                          {conflict.incomingCaller.phone && <div>📱 {conflict.incomingCaller.phone}</div>}
                          <div>📞 {conflict.incomingCaller.callCount} call(s) to import</div>
                        </div>
                        <div className="imp-conflict-preview">
                          &ldquo;{conflict.incomingCaller.firstTranscriptPreview}&rdquo;
                        </div>
                      </div>
                    </div>

                    {/* Resolution Options */}
                    <div className="imp-conflict-resolution-row">
                      {[
                        { value: "merge" as const, label: "Merge", desc: "Add calls to existing caller", colorClass: "imp-resolution-color-success" },
                        { value: "create_new" as const, label: "Create New", desc: "Create as separate caller", colorClass: "imp-resolution-color-accent" },
                        { value: "skip" as const, label: "Skip", desc: "Don't import these calls", colorClass: "imp-resolution-color-muted" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleConflictResolution(conflict.conflictKey, opt.value)}
                          className={`imp-resolution-btn ${conflictResolutions[conflict.conflictKey] === opt.value ? `imp-resolution-btn-selected ${opt.colorClass}` : ""}`}
                        >
                          <div className={`imp-resolution-label ${conflictResolutions[conflict.conflictKey] === opt.value ? opt.colorClass : ""}`}>
                            {opt.label}
                          </div>
                          <div className="imp-resolution-desc">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="imp-action-row">
                <button
                  onClick={() => setImportStep("select")}
                  className="imp-btn-back"
                >
                  ← Back
                </button>
                <button
                  onClick={handleTranscriptImport}
                  disabled={transcriptImporting}
                  className="imp-btn-import-success"
                >
                  {transcriptImporting ? "Importing..." : "Confirm & Import"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {importStep === "result" && transcriptResult && (
            <div className="imp-result-success">
              <div className="imp-result-title">
                ✓ Import Complete
              </div>
              <div className="imp-result-stats">
                {transcriptResult.created !== undefined && transcriptResult.created > 0 && (
                  <span>🆕 {transcriptResult.created} new caller(s)</span>
                )}
                {transcriptResult.merged !== undefined && transcriptResult.merged > 0 && (
                  <span>🔗 {transcriptResult.merged} merged</span>
                )}
                {transcriptResult.callsImported !== undefined && (
                  <span>📞 {transcriptResult.callsImported} call(s) imported</span>
                )}
                {transcriptResult.skipped !== undefined && transcriptResult.skipped > 0 && (
                  <span className="imp-result-stat-muted">⏭️ {transcriptResult.skipped} skipped</span>
                )}
              </div>

              {transcriptResult.callers && transcriptResult.callers.length > 0 && (
                <div className="imp-result-callers">
                  <div className="imp-result-callers-label">Callers:</div>
                  <div className="imp-result-callers-list">
                    {transcriptResult.callers.map((c) => (
                      <Link
                        key={c.id}
                        href={`/x/callers/${c.id}`}
                        className={`imp-caller-chip ${c.isNew ? "imp-caller-chip-new" : c.merged ? "imp-caller-chip-merged" : ""}`}
                      >
                        {c.name || c.email || c.id.slice(0, 8)}
                        {c.isNew && <span className="imp-caller-badge imp-caller-badge-new">NEW</span>}
                        {c.merged && <span className="imp-caller-badge imp-caller-badge-merged">MERGED</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {transcriptResult.savedToRaw && transcriptResult.savedToRaw.length > 0 && (
                <div className="imp-result-raw-saved">
                  <div className="imp-result-raw-saved-text">
                    📁 Saved to raw folder ({transcriptResult.savedToRaw.length} files)
                  </div>
                </div>
              )}

              {transcriptResult.errors && transcriptResult.errors.length > 0 && (
                <div className="imp-result-warnings">
                  <div className="imp-result-warnings-title">
                    Warnings:
                  </div>
                  {transcriptResult.errors.map((err, i) => (
                    <div key={i} className="imp-result-warning-item">
                      {err}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={resetImport}
                className="imp-btn-reset"
              >
                Import More
              </button>
            </div>
          )}

          {/* Error */}
          {transcriptError && (
            <div className="imp-error">
              {transcriptError}
            </div>
          )}
        </div>
      )}

      {/* BDD Specs Tab */}
      {activeTab === "specs" && (
        <div>
          {/* Mode Toggle */}
          {/* Schema Ready Mode */}
          {specImportMode === "schema" && (
            <>
              {/* Drop Zone */}
              <div
                onDrop={handleSpecDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => specFileInputRef.current?.click()}
                className={`imp-dropzone ${specFiles.length > 0 ? "imp-dropzone-spec-active" : ""}`}
              >
                <input
                  ref={specFileInputRef}
                  type="file"
                  multiple
                  accept=".json,.spec.json"
                  onChange={handleSpecFileChange}
                  className="imp-hidden-input"
                />
                <div className="imp-dropzone-icon">📋</div>
                {specFiles.length > 0 ? (
                  <div>
                    <div className="imp-dropzone-title-warning">
                      {specFiles.length} spec file(s) selected
                    </div>
                    <div className="imp-dropzone-hint">
                      {specFiles.map((f) => f.name).join(", ")}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="imp-dropzone-title">
                      Drop .spec.json files here or click to browse
                    </div>
                    <div className="imp-dropzone-hint">
                      BDD specification files (e.g., CA-001-cognitive-activation.spec.json)
                    </div>
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="imp-options">
                <label className="imp-checkbox-label-center">
                  <input
                    type="checkbox"
                    checked={autoActivate}
                    onChange={(e) => setAutoActivate(e.target.checked)}
                    className="imp-checkbox-no-mt"
                  />
                  <div>
                    <span className="imp-checkbox-text-default">Auto-activate specs</span>
                    <div className="imp-checkbox-hint-inline">
                      Create Parameters, ScoringAnchors, and AnalysisSpec records automatically
                    </div>
                  </div>
                </label>
              </div>

              {/* Import Button */}
              <div className="imp-btn-row">
                <button
                  onClick={handleSpecImport}
                  disabled={specFiles.length === 0 || specImporting}
                  className="imp-btn-import-warning"
                >
                  {specImporting ? "Importing..." : "Import BDD Specs"}
                </button>
              </div>

              {/* Error */}
              {specError && (
                <div className="imp-error">
                  {specError}
                </div>
              )}

              {/* Result */}
              {specResult && (
                <div className="imp-spec-result">
                  <div className="imp-spec-result-title">
                    Import Complete
                  </div>
                  <div className="imp-spec-result-stats">
                    <span>Created: {specResult.created || 0}</span>
                    <span>Updated: {specResult.updated || 0}</span>
                    {(specResult.errors || 0) > 0 && <span className="imp-spec-result-error-count">Errors: {specResult.errors}</span>}
                  </div>

                  {specResult.results && specResult.results.length > 0 && (
                    <div className="imp-spec-results-list">
                      <div className="imp-spec-results-label">Results:</div>
                      <div className="imp-spec-results-col">
                        {specResult.results.map((r) => (
                          <div
                            key={r.specId}
                            className={`imp-spec-result-item ${r.status === "error" ? "imp-spec-result-item-error" : r.status === "created" ? "imp-spec-result-item-created" : ""}`}
                          >
                            <div className="imp-spec-result-row">
                              <span className="imp-spec-result-id">{r.specId}</span>
                              <span
                                className={`imp-spec-result-badge ${r.status === "error" ? "imp-spec-result-badge-error" : r.status === "created" ? "imp-spec-result-badge-created" : "imp-spec-result-badge-updated"}`}
                              >
                                {r.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="imp-spec-result-name">{r.name}</div>
                            {r.error && (
                              <div className="imp-spec-result-error-text">{r.error}</div>
                            )}
                            {r.compileWarnings && r.compileWarnings.length > 0 && (
                              <div className="imp-spec-result-warning-text">
                                Warnings: {r.compileWarnings.join(", ")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Help Section */}
              <div className="imp-help">
                <h3 className="imp-help-title">
                  About BDD Specs
                </h3>
                <div className="imp-help-body">
                  <p><strong>BDD Specs</strong> define analysis parameters, triggers, actions, and prompt guidance.</p>
                  <p>Each spec creates:</p>
                  <ul className="imp-help-list">
                    <li><strong>BDDFeatureSet</strong> - Stores the raw spec JSON</li>
                    <li><strong>AnalysisSpec</strong> - Runtime spec with compiled promptTemplate</li>
                    <li><strong>Parameters</strong> - Measurable dimensions (traits, behaviors)</li>
                    <li><strong>ScoringAnchors</strong> - What high/low values mean</li>
                    <li><strong>PromptSlugs</strong> - Reusable prompt components</li>
                  </ul>
                  <p>Specs are stored in the database, removing the need for filesystem access at runtime.</p>
                </div>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}
